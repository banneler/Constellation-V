const { handleOptions, readJsonBody, sendError, sendJson } = require("../../_lib/http");
const { getUserFromRequest } = require("../../_lib/supabase");
const {
  assertOrgIntegrationsEnabled,
  buildHostedAuthUrl,
  getRedirectUri,
  signState,
} = require("../../_lib/nylas");

const PROVIDERS = new Set(["google", "microsoft"]);

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    await assertOrgIntegrationsEnabled();
    const body = await readJsonBody(req);
    const provider = String(body.provider || "").toLowerCase();
    if (!PROVIDERS.has(provider)) {
      return sendJson(res, 400, { error: 'provider must be "google" or "microsoft".' });
    }

    const redirectUri = getRedirectUri(req);
    const returnTo = typeof body.returnTo === "string" && body.returnTo.startsWith("/") ? body.returnTo : "/command-center.html";
    const state = signState({
      uid: user.id,
      provider,
      returnTo,
      exp: Date.now() + 15 * 60 * 1000,
    });
    const authUrl = buildHostedAuthUrl({
      provider,
      redirectUri,
      state,
      loginHint: user.email || undefined,
    });
    return sendJson(res, 200, { authUrl, provider });
  } catch (error) {
    console.error("[api/integrations/nylas/auth-url]", error);
    return sendError(res, error);
  }
};
