const { handleOptions, readJsonBody, sendError, sendJson } = require("../../_lib/http");
const { getUserFromRequest } = require("../../_lib/supabase");
const {
  assertOrgIntegrationsEnabled,
  createEvent,
  getCalendar,
  getUserIntegration,
  listCalendars,
  listEvents,
  updateEvent,
} = require("../../_lib/nylas");
const {
  parseUnixSeconds,
  extractCalendarHexColor,
  buildCalendarColorMap,
  normalizeCalendarEvent,
  assertTimelineBusinessHours,
} = require("../../_lib/calendar-event-normalize");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "PUT") {
    return sendJson(res, 405, { error: "Method Not Allowed" });
  }

  try {
    const { user } = await getUserFromRequest(req);
    await assertOrgIntegrationsEnabled();
    const integration = await getUserIntegration(user.id);
    if (!integration || integration.status !== "connected" || !integration.nylas_grant_id) {
      return sendJson(res, 409, {
        error: "Connect Google or Outlook in User Settings to use calendar.",
        code: "not_connected",
      });
    }

    if (req.method === "GET") {
      const url = new URL(req.url, "http://localhost");
      const calendarId = url.searchParams.get("calendarId") || "primary";
      const limitRaw = Number(url.searchParams.get("limit") || 15);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 15;
      const nowSec = Math.floor(Date.now() / 1000);
      const start = parseUnixSeconds(url.searchParams.get("start")) ?? nowSec;
      const end =
        parseUnixSeconds(url.searchParams.get("end")) ?? nowSec + 7 * 24 * 60 * 60;

      // Color map from all calendars (hex_color) + targeted getCalendar fallback.
      const [result, calendarsResult, calendarResult] = await Promise.all([
        listEvents(integration.nylas_grant_id, {
          calendarId,
          limit,
          start,
          end,
        }),
        listCalendars(integration.nylas_grant_id, { limit: 50 }).catch((err) => {
          console.warn("[api/integrations/calendar/events] list calendars failed:", err?.message || err);
          return null;
        }),
        getCalendar(integration.nylas_grant_id, calendarId).catch((err) => {
          console.warn("[api/integrations/calendar/events] calendar color lookup failed:", err?.message || err);
          return null;
        }),
      ]);

      const colorByCalendarId = buildCalendarColorMap(calendarsResult);
      const calendarColor =
        extractCalendarHexColor(calendarResult) ||
        colorByCalendarId.get(String(calendarId)) ||
        colorByCalendarId.get("primary") ||
        null;
      if (calendarColor && !colorByCalendarId.has(String(calendarId))) {
        colorByCalendarId.set(String(calendarId), calendarColor);
      }

      const raw = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
      const events = raw
        .map((ev) => normalizeCalendarEvent(ev, { calendarColor, colorByCalendarId }))
        .filter((e) => e.startTime != null)
        .sort((a, b) => a.startTime - b.startTime)
        .slice(0, limit);

      return sendJson(res, 200, {
        ok: true,
        provider: integration.provider,
        calendarColor,
        events,
        result,
      });
    }

    const body = await readJsonBody(req);
    if (!body.title && !body.description && req.method === "POST") {
      return sendJson(res, 400, { error: "Event title or description is required." });
    }

    if (req.method === "PUT") {
      const eventId = body.id || body.eventId;
      if (!eventId) {
        return sendJson(res, 400, { error: "Event id is required to update." });
      }
      if (body.startTime != null && body.endTime != null) {
        const start = Number(body.startTime);
        const end = Number(body.endTime);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
          return sendJson(res, 400, { error: "Event end time must be after start time." });
        }
        // When Command Center sends timezoneOffsetMin, enforce 7am–6pm local window.
        assertTimelineBusinessHours(start, end, body.timezoneOffsetMin);
      }
      const result = await updateEvent(integration.nylas_grant_id, eventId, {
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
    }

    if (body.startTime != null && body.endTime != null) {
      assertTimelineBusinessHours(body.startTime, body.endTime, body.timezoneOffsetMin);
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
