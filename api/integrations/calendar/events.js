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
  buildEventLabelColorMap,
  mergeEventLabelColorMap,
  normalizeCalendarEvent,
  assertTimelineBusinessHours,
  deterministicColorFromKey,
} = require("../../_lib/calendar-event-normalize");

function looksLikeHolidayCalendar(cal) {
  const n = String(cal?.name || "").toLowerCase();
  return /\bholidays?\b|\bweather\b|\bbirthdays?\b/.test(n);
}

/**
 * Calendar ids to query for GET events.
 * - Explicit `calendarId` → that calendar only
 * - Omitted / `all` → all non-holiday calendars (owned + subscribed), writable first.
 *   Secondary calendars (and read_only subscribed ones) must be included;
 *   only holiday/weather/birthday junk is skipped.
 *   Note: Google UI "Work"/"Stuff" named Labels are NOT calendars — they are
 *   per-event colors (eventLabelId); see calendar-event-normalize.js.
 */
function resolveListCalendarIds(calendarIdParam, calendarsResult, colorByCalendarId) {
  const raw = Array.isArray(calendarsResult?.data)
    ? calendarsResult.data
    : Array.isArray(calendarsResult)
      ? calendarsResult
      : [];
  if (calendarIdParam && calendarIdParam !== "all") {
    return [String(calendarIdParam)];
  }
  const usable = raw.filter((c) => c?.id && !looksLikeHolidayCalendar(c));
  // Writable first, then read-only subscribed labels (still colored in Google).
  usable.sort((a, b) => {
    const ar = Boolean(a.read_only ?? a.readOnly);
    const br = Boolean(b.read_only ?? b.readOnly);
    if (ar !== br) return ar ? 1 : -1;
    const ap = Boolean(a.is_primary ?? a.isPrimary);
    const bp = Boolean(b.is_primary ?? b.isPrimary);
    if (ap !== bp) return ap ? -1 : 1;
    return 0;
  });
  const ids = usable.map((c) => String(c.id));
  if (ids.length) return ids;
  if (colorByCalendarId?.has?.("primary")) return ["primary"];
  if (raw[0]?.id) return [String(raw[0].id)];
  return ["primary"];
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH") {
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
      const calendarIdParam = url.searchParams.get("calendarId");
      const limitRaw = Number(url.searchParams.get("limit") || 15);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 15;
      const nowSec = Math.floor(Date.now() / 1000);
      const start = parseUnixSeconds(url.searchParams.get("start")) ?? nowSec;
      const end =
        parseUnixSeconds(url.searchParams.get("end")) ?? nowSec + 7 * 24 * 60 * 60;

      const calendarsResult = await listCalendars(integration.nylas_grant_id, { limit: 50 }).catch(
        (err) => {
          console.warn("[api/integrations/calendar/events] list calendars failed:", err?.message || err);
          return null;
        }
      );
      // fillMissing:false — prefer real provider hex; we'll enrich + fill after getCalendar.
      const colorByCalendarId = buildCalendarColorMap(calendarsResult, { fillMissing: false });
      // Google named event Labels (Work/Stuff) — usually empty via Nylas today.
      const labelColorById = buildEventLabelColorMap(calendarsResult);
      const calendarIds = resolveListCalendarIds(calendarIdParam, calendarsResult, colorByCalendarId);

      // getCalendar for EVERY listed id whose hex is missing + primary (for labels).
      const idsNeedingColor = new Set(
        calendarIds.filter((id) => !colorByCalendarId.has(String(id))).map(String)
      );
      // Always refresh primary detail — labelProperties would live here if Nylas passthrough.
      idsNeedingColor.add("primary");
      const colorLookups = await Promise.all(
        [...idsNeedingColor].map((calId) =>
          getCalendar(integration.nylas_grant_id, calId)
            .then((payload) => ({ calId, payload }))
            .catch((err) => {
              console.warn(
                "[api/integrations/calendar/events] calendar color lookup failed:",
                calId,
                err?.message || err
              );
              return { calId, payload: null };
            })
        )
      );
      for (const { calId, payload } of colorLookups) {
        if (!payload) continue;
        mergeEventLabelColorMap(labelColorById, payload);
        const hex = extractCalendarHexColor(payload);
        if (hex) {
          colorByCalendarId.set(String(calId), hex);
          const cal = payload?.data || payload || {};
          if (cal.is_primary || cal.isPrimary || calId === "primary") {
            colorByCalendarId.set("primary", hex);
            if (cal.id != null) colorByCalendarId.set(String(cal.id), hex);
          }
        }
      }

      // Stable distinct colors for any calendar still missing hex (sandbox nulls).
      for (const calId of calendarIds) {
        const key = String(calId);
        if (!colorByCalendarId.has(key)) {
          const fallback = deterministicColorFromKey(key);
          if (fallback) colorByCalendarId.set(key, fallback);
        }
      }
      if (!colorByCalendarId.has("primary")) {
        const primaryFromList = Array.isArray(calendarsResult?.data)
          ? calendarsResult.data.find((c) => c?.is_primary || c?.isPrimary)
          : null;
        const primaryKey = primaryFromList?.id != null ? String(primaryFromList.id) : null;
        if (primaryKey && colorByCalendarId.has(primaryKey)) {
          colorByCalendarId.set("primary", colorByCalendarId.get(primaryKey));
        }
      }

      const calendarColor =
        colorByCalendarId.get("primary") ||
        colorByCalendarId.get(String(calendarIds[0] || "")) ||
        null;

      // Per-calendar list (Nylas requires calendar_id). Merge + dedupe by event id.
      const perCalLimit = Math.min(
        100,
        Math.max(limit, Math.ceil((limit * 2) / Math.max(1, calendarIds.length)) + 5)
      );
      const listResults = await Promise.all(
        calendarIds.map((calId) =>
          listEvents(integration.nylas_grant_id, {
            calendarId: calId,
            limit: perCalLimit,
            start,
            end,
          }).catch((err) => {
            console.warn(
              "[api/integrations/calendar/events] list events failed for",
              calId,
              err?.message || err
            );
            return null;
          })
        )
      );

      const calListRaw = Array.isArray(calendarsResult?.data)
        ? calendarsResult.data
        : Array.isArray(calendarsResult)
          ? calendarsResult
          : [];
      const nameByCalendarId = new Map();
      for (const cal of calListRaw) {
        if (cal?.id == null) continue;
        const name = (cal.name && String(cal.name).trim()) || null;
        if (name) nameByCalendarId.set(String(cal.id), name);
      }

      const seen = new Set();
      const events = [];
      for (let i = 0; i < listResults.length; i++) {
        const result = listResults[i];
        const calId = calendarIds[i];
        const raw = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
        // Calendar fallback only — per-event color_id / eventLabelId win in normalize.
        const fallbackColor = colorByCalendarId.get(String(calId)) || null;
        const calName = nameByCalendarId.get(String(calId)) || null;
        for (const ev of raw) {
          const id = ev?.id != null ? String(ev.id) : null;
          if (id && seen.has(id)) continue;
          if (id) seen.add(id);
          // Prefer event.calendar_id; fall back to the calendar we queried.
          if (!ev.calendar_id && !ev.calendarId && calId) {
            ev.calendar_id = calId;
          }
          if (!ev.calendar_name && !ev.calendarName && calName) {
            ev.calendar_name = calName;
          }
          const normalized = normalizeCalendarEvent(ev, {
            calendarColor: fallbackColor,
            colorByCalendarId,
            labelColorById,
          });
          if (normalized.startTime == null) continue;
          // Guarantee the queried calendar's hex when map lookup missed a id variant.
          if (!normalized.color && fallbackColor) {
            normalized.color = fallbackColor;
            if (!normalized.colorSource) normalized.colorSource = "calendar";
          }
          events.push(normalized);
        }
      }

      events.sort((a, b) => a.startTime - b.startTime);
      const sliced = events.slice(0, limit);
      const calendarColors = Object.fromEntries(colorByCalendarId.entries());
      const eventLabels = Object.fromEntries(
        [...labelColorById.entries()].map(([id, v]) => [
          id,
          { color: v?.color || null, name: v?.name || null },
        ])
      );
      const calendars = calendarIds.map((id) => ({
        id: String(id),
        name: nameByCalendarId.get(String(id)) || String(id),
        color: colorByCalendarId.get(String(id)) || null,
      }));

      return sendJson(res, 200, {
        ok: true,
        provider: integration.provider,
        calendarColor,
        calendarIds,
        calendarColors,
        eventLabels,
        // Google UI named Labels (Work/Stuff) need eventLabelId + label hex.
        // Nylas exposes legacy color_id (1–11) only — not custom Label names/colors.
        eventColorNote:
          "Google named event Labels (Work/Stuff) use eventLabelId + labelProperties; Nylas returns legacy color_id (1–11) only. Without color_id, events inherit the calendar color.",
        calendars,
        events: sliced,
      });
    }

    const body = await readJsonBody(req);
    if (!body.title && !body.description && req.method === "POST") {
      return sendJson(res, 400, { error: "Event title or description is required." });
    }

    const startTime = body.startTime != null ? Number(body.startTime) : null;
    const endTime = body.endTime != null ? Number(body.endTime) : null;
    if (startTime != null && endTime != null) {
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
        return sendJson(res, 400, { error: "End time must be after start time." });
      }
      // Command Center sends timezoneOffsetMin and/or localStart/localEnd for 7–6 enforcement.
      assertTimelineBusinessHours(
        startTime,
        endTime,
        body.timezoneOffsetMin,
        body.localStart,
        body.localEnd
      );
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      const eventId = body.eventId || body.id;
      if (!eventId) {
        return sendJson(res, 400, { error: "Event id is required to update." });
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
