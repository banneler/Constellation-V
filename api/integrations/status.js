const { handleOptions, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");
const { getOrgSettings, getUserIntegration } = require("../_lib/nylas");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const [settings, integration] = await Promise.all([getOrgSettings(), getUserIntegration(user.id)]);
    const connected = Boolean(integration && integration.status === "connected" && integration.nylas_grant_id);
    return sendJson(res, 200, {
      orgEnabled: Boolean(settings.email_calendar_enabled),
      connected,
      provider: connected ? integration.provider : null,
      email: connected ? integration.email : null,
      status: integration?.status || null,
    });
  } catch (error) {
    console.error("[api/integrations/status]", error);
    return sendError(res, error);
  }
};
