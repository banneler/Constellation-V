const { handleOptions, readJsonBody, sendError, sendJson } = require("../../_lib/http");
const { getUserFromRequest } = require("../../_lib/supabase");
const {
  appendEmailSignature,
  assertOrgIntegrationsEnabled,
  getUserEmailSignature,
  getUserIntegration,
  sendMessage,
} = require("../../_lib/nylas");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    await assertOrgIntegrationsEnabled();
    const integration = await getUserIntegration(user.id);
    if (!integration || integration.status !== "connected" || !integration.nylas_grant_id) {
      return sendJson(res, 409, {
        error: "Connect Google or Outlook in User Settings to send email in-app.",
        code: "not_connected",
      });
    }

    const body = await readJsonBody(req);
    const to = body.to;
    if (!to || (Array.isArray(to) && !to.length)) {
      return sendJson(res, 400, { error: 'Missing "to" recipient.' });
    }

    const signature = await getUserEmailSignature(user.id);
    const messageBody = appendEmailSignature(body.body, signature);

    const result = await sendMessage(integration.nylas_grant_id, {
      to,
      subject: body.subject,
      body: messageBody,
      cc: body.cc,
      bcc: body.bcc,
    });

    return sendJson(res, 200, {
      ok: true,
      provider: integration.provider,
      from: integration.email,
      signatureApplied: Boolean(signature),
      result,
    });
  } catch (error) {
    console.error("[api/integrations/email/send]", error);
    return sendError(res, error);
  }
};
