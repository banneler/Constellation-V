/**
 * Shared Nylas → UI calendar event normalization.
 *
 * Timed events use Nylas `when.timespan` unix seconds. Google/Nylas end_time is
 * exclusive (2:00–2:45 → start=S, end=S+2700 → duration 45 minutes).
 */

function parseUnixSeconds(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string" && value.includes("T")) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
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

/**
 * Build calendar_id → `#RRGGBB` from a Nylas calendars list payload/array.
 * Also indexes `"primary"` to the primary calendar's color when present.
 */
function buildCalendarColorMap(calendarsPayload) {
  const raw = Array.isArray(calendarsPayload?.data)
    ? calendarsPayload.data
    : Array.isArray(calendarsPayload)
      ? calendarsPayload
      : [];
  const map = new Map();
  let primaryColor = null;
  for (const cal of raw) {
    const id = cal?.id != null ? String(cal.id) : null;
    const color = extractCalendarHexColor(cal);
    if (id && color) map.set(id, color);
    if ((cal?.is_primary || cal?.isPrimary) && color) {
      primaryColor = color;
      map.set("primary", color);
    }
  }
  if (primaryColor && !map.has("primary")) map.set("primary", primaryColor);
  return map;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse Nylas v3 `when` (timespan / time / date / datespan) into unix seconds.
 * Prefers `start_time`/`end_time` (exclusive end); falls back to camelCase / ISO.
 */
function parseEventWhen(whenInput) {
  const when = whenInput || {};
  let startTime = null;
  let endTime = null;
  let allDay = false;

  const startRaw = when.start_time ?? when.startTime ?? when.start;
  const endRaw = when.end_time ?? when.endTime ?? when.end;

  if (startRaw != null && when.start_date == null && when.date == null) {
    // Timed timespan (or ISO start/end). end_time is exclusive.
    startTime = parseUnixSeconds(startRaw);
    endTime = parseUnixSeconds(endRaw);
    if (endTime == null && when.duration != null && startTime != null) {
      const dur = Number(when.duration);
      if (Number.isFinite(dur) && dur > 0) {
        // duration in seconds if large; otherwise treat as minutes.
        endTime = startTime + (dur >= 1000 ? Math.floor(dur) : Math.floor(dur * 60));
      }
    }
  } else if (when.time != null) {
    // Point-in-time → default 60m block for the day timeline.
    startTime = parseUnixSeconds(when.time);
    endTime = startTime != null ? startTime + 3600 : null;
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

  return { startTime, endTime, allDay };
}

/**
 * Normalize a Nylas event for Command Center.
 * @param {object} ev
 * @param {{ calendarColor?: string|null, colorByCalendarId?: Map<string,string> }} [opts]
 */
function normalizeCalendarEvent(ev, { calendarColor, colorByCalendarId } = {}) {
  const { startTime, endTime, allDay } = parseEventWhen(ev?.when);

  const rawDesc = ev?.text_description || ev?.description || "";
  const description = stripHtml(rawDesc).slice(0, 160) || null;
  const calendarId = ev?.calendar_id || ev?.calendarId || null;

  // Prefer this event's calendar label color; then request calendar; then event hex.
  const color =
    normalizeHexColor(calendarId && colorByCalendarId?.get?.(String(calendarId))) ||
    normalizeHexColor(calendarColor) ||
    normalizeHexColor(colorByCalendarId?.get?.("primary")) ||
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
    calendarId,
    color,
  };
}

module.exports = {
  parseUnixSeconds,
  normalizeHexColor,
  extractCalendarHexColor,
  buildCalendarColorMap,
  parseEventWhen,
  normalizeCalendarEvent,
};
