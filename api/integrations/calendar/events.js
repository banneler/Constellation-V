const { handleOptions, readJsonBody, sendError, sendJson } = require("../../_lib/http");
const { getUserFromRequest } = require("../../_lib/supabase");
const {
  assertOrgIntegrationsEnabled,
  createEvent,
  getCalendar,
  getUserIntegration,
  listEvents,
} = require("../../_lib/nylas");

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseUnixSeconds(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // Nylas uses unix seconds; tolerate accidental ms (>= 1e12).
  return n >= 1e12 ? Math.floor(n / 1000) : Math.floor(n);
}

/** Normalize provider/calendar hex colors to `#RRGGBB` (or null). */
function normalizeHexColor(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9A-Fa-f]{6}$/.test(withHash)) return withHash.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(withHash)) {
    const [, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

function extractCalendarHexColor(calendarPayload) {
  const cal = calendarPayload?.data || calendarPayload || {};
  return (
    normalizeHexColor(cal.hex_color) ||
    normalizeHexColor(cal.hexColor) ||
    normalizeHexColor(cal.color) ||
    null
  );
}

/** Normalize Nylas v3 event `when` (timespan / date / datespan) for the UI. */
function normalizeCalendarEvent(ev, { calendarColor } = {}) {
  const when = ev?.when || {};
  let startTime = null;
  let endTime = null;
  let allDay = false;

  if (when.start_time != null) {
    startTime = parseUnixSeconds(when.start_time);
    endTime = parseUnixSeconds(when.end_time);
  } else if (when.start_date) {
    allDay = true;
    const startMs = Date.parse(`${when.start_date}T00:00:00Z`);
    const endDate = when.end_date || when.start_date;
    const endMs = Date.parse(`${endDate}T00:00:00Z`);
    startTime = Number.isFinite(startMs) ? Math.floor(startMs / 1000) : null;
    endTime = Number.isFinite(endMs) ? Math.floor(endMs / 1000) : startTime;
  } else if (when.date) {
    allDay = true;
    const ms = Date.parse(`${when.date}T00:00:00Z`);
    startTime = Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
    endTime = startTime;
  }

  const rawDesc = ev?.text_description || ev?.description || "";
  const description = stripHtml(rawDesc).slice(0, 160) || null;

  // Prefer calendar label color; fall back to any event-level hex if present.
  const color =
    normalizeHexColor(calendarColor) ||
    normalizeHexColor(ev?.hex_color) ||
    normalizeHexColor(ev?.hexColor) ||
    normalizeHexColor(ev?.color) ||
    null;

  return {
    id: ev?.id || null,
    title: (ev?.title && String(ev.title).trim()) || "(No title)",
    description,
    startTime,
    endTime,
    allDay,
    location: ev?.location ? String(ev.location).trim() : null,
    calendarId: ev?.calendar_id || null,
    color,
  };
}

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

      const [result, calendarResult] = await Promise.all([
        listEvents(integration.nylas_grant_id, {
          calendarId,
          limit,
          start,
          end,
        }),
        getCalendar(integration.nylas_grant_id, calendarId).catch((err) => {
          console.warn("[api/integrations/calendar/events] calendar color lookup failed:", err?.message || err);
          return null;
        }),
      ]);
      const calendarColor = extractCalendarHexColor(calendarResult);
      const raw = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
      const events = raw
        .map((ev) => normalizeCalendarEvent(ev, { calendarColor }))
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
