const crypto = require("crypto");
const { encodeEq, supabaseRest } = require("./supabase");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw Object.assign(new Error(`${name} is not configured.`), { status: 500 });
  }
  return value;
}

function getNylasApiBase() {
  return (process.env.NYLAS_API_URI || "https://api.us.nylas.com").replace(/\/$/, "");
}

function getRedirectUri(req) {
  if (process.env.NYLAS_REDIRECT_URI) return process.env.NYLAS_REDIRECT_URI.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  if (!host) {
    throw Object.assign(new Error("Unable to determine Nylas redirect URI."), { status: 500 });
  }
  return `${proto}://${host}/api/integrations/nylas/callback`;
}

function getAppOrigin(req) {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  return `${proto}://${host}`;
}

function getStateSecret() {
  return process.env.NYLAS_STATE_SECRET || process.env.NYLAS_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function signState(payload) {
  const secret = getStateSecret();
  if (!secret) {
    throw Object.assign(new Error("No secret available to sign OAuth state."), { status: 500 });
  }
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyState(state) {
  if (!state || typeof state !== "string" || !state.includes(".")) {
    throw Object.assign(new Error("Invalid OAuth state."), { status: 400 });
  }
  const [body, sig] = state.split(".");
  const secret = getStateSecret();
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw Object.assign(new Error("OAuth state signature mismatch."), { status: 400 });
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw Object.assign(new Error("OAuth state could not be parsed."), { status: 400 });
  }
  if (!payload?.uid || !payload?.exp || Date.now() > Number(payload.exp)) {
    throw Object.assign(new Error("OAuth state expired."), { status: 400 });
  }
  return payload;
}

async function nylasFetch(path, options = {}) {
  const apiKey = requireEnv("NYLAS_API_KEY");
  const response = await fetch(`${getNylasApiBase()}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
    body: options.body == null ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      (typeof data === "string" ? data : null) ||
      `Nylas request failed (${response.status}).`;
    throw Object.assign(new Error(message), { status: response.status >= 500 ? 502 : response.status, details: data });
  }
  return data;
}

function buildHostedAuthUrl({ provider, redirectUri, state, loginHint }) {
  const clientId = requireEnv("NYLAS_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    provider,
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `${getNylasApiBase()}/v3/connect/auth?${params.toString()}`;
}

async function exchangeCodeForGrant({ code, redirectUri }) {
  const clientId = requireEnv("NYLAS_CLIENT_ID");
  const apiKey = requireEnv("NYLAS_API_KEY");
  const data = await nylasFetch("/v3/connect/token", {
    method: "POST",
    body: {
      client_id: clientId,
      client_secret: apiKey,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    },
  });
  return data;
}

async function destroyGrant(grantId) {
  if (!grantId) return;
  try {
    await nylasFetch(`/v3/grants/${encodeURIComponent(grantId)}`, { method: "DELETE" });
  } catch (error) {
    // Already revoked / missing is fine.
    if (Number(error?.status) !== 404) throw error;
  }
}

async function sendMessage(grantId, { to, subject, body, cc, bcc }) {
  const toList = (Array.isArray(to) ? to : [to])
    .filter(Boolean)
    .map((email) => (typeof email === "string" ? { email } : email));
  if (!toList.length) {
    throw Object.assign(new Error("At least one recipient is required."), { status: 400 });
  }
  return nylasFetch(`/v3/grants/${encodeURIComponent(grantId)}/messages/send`, {
    method: "POST",
    body: {
      subject: subject || "",
      body: body || "",
      to: toList,
      ...(cc?.length ? { cc: cc.map((email) => (typeof email === "string" ? { email } : email)) } : {}),
      ...(bcc?.length ? { bcc: bcc.map((email) => (typeof email === "string" ? { email } : email)) } : {}),
    },
  });
}

async function createEvent(grantId, event) {
  const calendarId = event.calendarId || "primary";
  const start = event.startTime != null ? Number(event.startTime) : Math.floor(Date.now() / 1000) + 3600;
  const end = event.endTime != null ? Number(event.endTime) : start + 3600;
  return nylasFetch(`/v3/grants/${encodeURIComponent(grantId)}/events?calendar_id=${encodeURIComponent(calendarId)}`, {
    method: "POST",
    body: {
      title: event.title || "Meeting",
      description: event.description || "",
      when: {
        start_time: start,
        end_time: end,
      },
      ...(event.participants?.length
        ? {
            participants: event.participants.map((p) =>
              typeof p === "string" ? { email: p } : { email: p.email, name: p.name }
            ),
          }
        : {}),
    },
  });
}

async function listEvents(grantId, { calendarId = "primary", limit = 20, start, end } = {}) {
  const params = new URLSearchParams({
    calendar_id: calendarId,
    limit: String(limit),
  });
  if (start != null && Number.isFinite(Number(start))) params.set("start", String(Math.floor(Number(start))));
  if (end != null && Number.isFinite(Number(end))) params.set("end", String(Math.floor(Number(end))));
  return nylasFetch(`/v3/grants/${encodeURIComponent(grantId)}/events?${params.toString()}`);
}

async function getOrgSettings() {
  const rows = await supabaseRest("org_settings?id=eq.1&select=*&limit=1", { serviceRole: true });
  return rows?.[0] || { id: 1, email_calendar_enabled: false };
}

async function assertOrgIntegrationsEnabled() {
  const settings = await getOrgSettings();
  if (!settings.email_calendar_enabled) {
    throw Object.assign(new Error("Email & calendar integrations are disabled for this organization."), {
      status: 403,
    });
  }
  return settings;
}

async function getUserIntegration(userId) {
  const rows = await supabaseRest(
    `user_integrations?user_id=eq.${encodeEq(userId)}&select=*&limit=1`,
    { serviceRole: true }
  );
  return rows?.[0] || null;
}

async function getUserEmailSignature(userId) {
  if (!userId) return "";
  const rows = await supabaseRest(
    `user_settings?user_id=eq.${encodeEq(userId)}&select=email_signature&limit=1`,
    { serviceRole: true }
  );
  return String(rows?.[0]?.email_signature || "").trim();
}

function appendEmailSignature(body, signature) {
  const sig = String(signature || "").trim();
  if (!sig) return body || "";
  const base = String(body || "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\s+$/g, "");
  if (!base) return sig;
  if (base.endsWith(sig)) return base;
  return `${base}\n\n${sig}`;
}

/** Nylas messages/send treats `body` as HTML; plain \\n is collapsed by clients. */
function looksLikeHtml(text) {
  return /<[a-z][\s\S]*>/i.test(String(text || ""));
}

function plainTextToEmailHtml(text) {
  const value = String(text ?? "");
  if (!value) return "";
  if (looksLikeHtml(value)) return value;
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\r\n|\r/g, "\n")
    .replace(/\n/g, "<br>");
}

async function upsertUserIntegration(row) {
  const rows = await supabaseRest("user_integrations?on_conflict=user_id", {
    method: "POST",
    serviceRole: true,
    prefer: "resolution=merge-duplicates,return=representation",
    body: row,
  });
  return rows?.[0] || null;
}

async function deleteUserIntegration(userId) {
  await supabaseRest(`user_integrations?user_id=eq.${encodeEq(userId)}`, {
    method: "DELETE",
    serviceRole: true,
  });
}

async function markGrantInvalid(grantId) {
  if (!grantId) return;
  await supabaseRest(`user_integrations?nylas_grant_id=eq.${encodeEq(grantId)}`, {
    method: "PATCH",
    serviceRole: true,
    prefer: "return=minimal",
    body: { status: "invalid" },
  });
}

function verifyNylasWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.NYLAS_WEBHOOK_SECRET;
  if (!secret) return true; // allow when not configured (dev)
  if (!signatureHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody || "").digest("hex");
  try {
    const a = Buffer.from(String(signatureHeader));
    const b = Buffer.from(digest);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = {
  appendEmailSignature,
  plainTextToEmailHtml,
  assertOrgIntegrationsEnabled,
  buildHostedAuthUrl,
  createEvent,
  deleteUserIntegration,
  destroyGrant,
  exchangeCodeForGrant,
  getAppOrigin,
  getOrgSettings,
  getRedirectUri,
  getUserEmailSignature,
  getUserIntegration,
  listEvents,
  markGrantInvalid,
  nylasFetch,
  sendMessage,
  signState,
  upsertUserIntegration,
  verifyNylasWebhookSignature,
  verifyState,
};
