const { handleOptions, readJsonBody, sendError, sendJson } = require("../../_lib/http");
const { getUserFromRequest } = require("../../_lib/supabase");
const {
  assertOrgIntegrationsEnabled,
  createEvent,
  getUserIntegration,
  listEvents,
} = require("../../_lib/nylas");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET" && req.method !== "POST") {
    return sendJson(res, 405, { error: "Method Not Allowed" });
  }

  try {
    const { user } = await getUserFromRequest(req);
    await assertOrgIntegrationsEnabled();
    const integration = await getUserIntegration(user.id);
    if (!integration || integration.status !== "connected" || !integration.nylas_grant_id) {
      return sendJson(res, 409, {
        error: "Connect Google or Outlook from the user menu to use calendar.",
        code: "not_connected",
      });
    }

    if (req.method === "GET") {
      const url = new URL(req.url, "http://localhost");
      const calendarId = url.searchParams.get("calendarId") || "primary";
      const limit = Number(url.searchParams.get("limit") || 20);
      const result = await listEvents(integration.nylas_grant_id, { calendarId, limit });
      return sendJson(res, 200, { ok: true, provider: integration.provider, result });
    }

    const body = await readJsonBody(req);
    if (!body.title && !body.description) {
      return sendJson(res, 400, { error: "Event title or description is required." });
    }

    const result = await createEvent(integration.nylas_grant_id, {
      title: body.title,
      description: body.description,
      startTime: body.startTime,
      endTime: body.endTime,
      calendarId: body.calendarId,
      participants: body.participants,
    });

    return sendJson(res, 200, {
      ok: true,
      provider: integration.provider,
      from: integration.email,
      result,
    });
  } catch (error) {
    console.error("[api/integrations/calendar/events]", error);
    return sendError(res, error);
  }
};
