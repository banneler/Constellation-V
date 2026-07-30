const { handleOptions, sendError, sendJson } = require("../../_lib/http");
const { getUserFromRequest } = require("../../_lib/supabase");
const {
  assertOrgIntegrationsEnabled,
  deleteUserIntegration,
  destroyGrant,
  getUserIntegration,
} = require("../../_lib/nylas");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    await assertOrgIntegrationsEnabled();
    const integration = await getUserIntegration(user.id);
    if (integration?.nylas_grant_id) {
      await destroyGrant(integration.nylas_grant_id);
    }
    await deleteUserIntegration(user.id);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("[api/integrations/nylas/disconnect]", error);
    return sendError(res, error);
  }
};
