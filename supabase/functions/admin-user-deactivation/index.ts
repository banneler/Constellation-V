import { corsHeaders } from "../_shared/cors.ts";

const LONG_BAN_DURATION = "876000h"; // 100 years; keeps the auth user for audit/history.

type RequestBody = {
  targetUserId?: string;
  action?: string;
  reason?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw Object.assign(new Error(`${name} is not configured.`), { status: 500 });
  return value.replace(/\/$/, "");
}

function normalizeAction(action: unknown) {
  const value = String(action || "").trim().toLowerCase();
  if (value !== "deactivate" && value !== "reactivate") {
    throw Object.assign(new Error("Action must be deactivate or reactivate."), { status: 400 });
  }
  return value;
}

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error("Missing Authorization bearer token."), { status: 401 });
  return match[1];
}

async function fetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const payload = data as { error?: string; message?: string; msg?: string } | null;
    const message = payload?.message || payload?.msg || payload?.error || text || "Request failed.";
    throw Object.assign(new Error(message), { status: response.status, details: data });
  }

  return data;
}

async function getRequester(token: string) {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("ANON_KEY") || "";
  const user = await fetchJson(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
  }) as { id?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> };

  if (!user?.id) throw Object.assign(new Error("Supabase session did not include a user id."), { status: 401 });
  return user;
}

async function supabaseRest(path: string, init: RequestInit = {}) {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return fetchJson(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function loadUserQuota(userId: string) {
  const rows = await supabaseRest(
    `user_quotas?user_id=eq.${encodeURIComponent(userId)}&select=user_id,full_name,is_manager,deactivated_at&limit=1`,
  ) as Array<{ user_id: string; is_manager?: boolean; deactivated_at?: string | null }>;
  return rows?.[0] || null;
}

function isAdminFromMetadata(user: { user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }) {
  return user.user_metadata?.is_admin === true || user.app_metadata?.is_admin === true;
}

async function assertManagerOrAdmin(user: { id?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }) {
  if (!user.id) throw Object.assign(new Error("Missing requester id."), { status: 401 });
  const quota = await loadUserQuota(user.id);
  const allowed = quota?.is_manager === true || isAdminFromMetadata(user);
  if (!allowed) {
    throw Object.assign(new Error("Only managers or admins can change user activation status."), { status: 403 });
  }
  if (quota?.deactivated_at) {
    throw Object.assign(new Error("Your account is deactivated."), { status: 403 });
  }
}

async function patchUserQuota(userId: string, body: Record<string, unknown>) {
  const rows = await supabaseRest(`user_quotas?user_id=eq.${encodeURIComponent(userId)}&select=user_id`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  }) as Array<{ user_id: string }>;

  if (rows?.length) return rows[0];

  const inserted = await supabaseRest("user_quotas?select=user_id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, ...body }),
  }) as Array<{ user_id: string }>;
  return inserted?.[0] || null;
}

async function updateAuthBan(userId: string, banDuration: string) {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return fetchJson(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ban_duration: banDuration }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    const requester = await getRequester(getBearerToken(req));
    await assertManagerOrAdmin(requester);

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const targetUserId = String(body.targetUserId || "").trim();
    const action = normalizeAction(body.action);
    const reason = String(body.reason || "").trim().slice(0, 1000);

    if (!targetUserId) throw Object.assign(new Error("Target user is required."), { status: 400 });
    if (targetUserId === requester.id) {
      throw Object.assign(new Error("You cannot change activation status for your own account."), { status: 400 });
    }

    if (action === "deactivate") {
      const deactivatedAt = new Date().toISOString();
      await patchUserQuota(targetUserId, {
        deactivated_at: deactivatedAt,
        deactivated_by: requester.id,
        deactivation_reason: reason || null,
        is_manager: false,
        exclude_from_reporting: true,
        show_in_pipeline: false,
      });
      await updateAuthBan(targetUserId, LONG_BAN_DURATION);
      return jsonResponse({ ok: true, action, targetUserId, deactivatedAt });
    }

    await patchUserQuota(targetUserId, {
      deactivated_at: null,
      deactivated_by: null,
      deactivation_reason: null,
    });
    await updateAuthBan(targetUserId, "none");
    return jsonResponse({ ok: true, action, targetUserId });
  } catch (error) {
    const status = Number((error as { status?: number })?.status) || 500;
    const message = error instanceof Error ? error.message : String(error || "Unexpected error");
    return jsonResponse({ error: message }, status);
  }
});
