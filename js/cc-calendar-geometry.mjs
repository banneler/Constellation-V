/**
 * Command Center day-timeline geometry helpers (pure, unit-tested).
 *
 * Track window is 7:00–18:00 local (660 minutes). Timed event height is
 * duration / 660 of the track. Nylas/Google `end_time` is exclusive unix seconds.
 */

export const TIMELINE_START_MIN = 7 * 60;
export const TIMELINE_END_MIN = 18 * 60;
export const TIMELINE_SPAN_MIN = TIMELINE_END_MIN - TIMELINE_START_MIN;

/** Normalize API timestamps to unix seconds (accepts seconds, ms, or ISO). */
export function toUnixSeconds(value) {
    if (value == null || value === "") return null;
    if (typeof value === "string" && value.includes("T")) {
        const ms = Date.parse(value);
        return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n >= 1e12 ? Math.floor(n / 1000) : Math.floor(n);
}

/** Local minutes-from-midnight for a Date (includes fractional seconds). */
export function localMinutesFromDate(d) {
    if (!d || Number.isNaN(d.getTime())) return null;
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/**
 * Resolve timed start/end minutes for an event on a local day.
 * Uses startTime/endTime unix seconds; end is exclusive (duration = end − start).
 * @returns {{ startMin: number, endMin: number, durationMin: number } | null}
 */
export function timedEventLocalMinutes(ev, dayKey, { dayKeyFromDate } = {}) {
    if (!ev || ev.allDay || ev.startTime == null) return null;
    const startSec = toUnixSeconds(ev.startTime);
    if (startSec == null) return null;
    const start = new Date(startSec * 1000);
    if (Number.isNaN(start.getTime())) return null;
    if (typeof dayKeyFromDate === "function" && dayKey && dayKeyFromDate(start) !== dayKey) {
        return null;
    }
    const endSec = toUnixSeconds(ev.endTime) ?? startSec + 3600;
    const end = new Date(endSec * 1000);
    let startMin = localMinutesFromDate(start);
    if (startMin == null) return null;
    let endMin = Number.isNaN(end.getTime())
        ? startMin + 60
        : typeof dayKeyFromDate === "function" && dayKey && dayKeyFromDate(end) !== dayKey
          ? 24 * 60
          : localMinutesFromDate(end);
    if (endMin == null || endMin <= startMin) endMin = startMin + 15;
    return {
        startMin,
        endMin,
        durationMin: endMin - startMin,
    };
}

/** Clamp a timed interval into the 7am–6pm track (minutes). */
export function clampToTimeline(startMin, endMin) {
    const clampedStart = Math.max(TIMELINE_START_MIN, Math.min(TIMELINE_END_MIN, startMin));
    const clampedEnd = Math.max(TIMELINE_START_MIN, Math.min(TIMELINE_END_MIN, endMin));
    if (clampedEnd <= TIMELINE_START_MIN || clampedStart >= TIMELINE_END_MIN) {
        return null;
    }
    return {
        clampedStart,
        clampedEnd,
        durationMin: clampedEnd - clampedStart,
        topPct: ((clampedStart - TIMELINE_START_MIN) / TIMELINE_SPAN_MIN) * 100,
        heightPct: Math.max(2.2, ((clampedEnd - clampedStart) / TIMELINE_SPAN_MIN) * 100),
    };
}

/**
 * Pack intersecting half-open intervals [startMin, endMin) into columns.
 * @param {{ id: string|number, startMin: number, endMin: number }[]} items
 * @returns {Map<string|number, { columnIndex: number, columnCount: number }>}
 */
export function packOverlapColumns(items) {
    const sorted = [...(items || [])].sort((a, b) => {
        if (a.startMin !== b.startMin) return a.startMin - b.startMin;
        if (a.endMin !== b.endMin) return a.endMin - b.endMin;
        return String(a.id).localeCompare(String(b.id));
    });

    const clusters = [];
    let current = [];
    let clusterEnd = -Infinity;
    for (const item of sorted) {
        if (current.length && item.startMin >= clusterEnd) {
            clusters.push(current);
            current = [];
            clusterEnd = -Infinity;
        }
        current.push(item);
        clusterEnd = Math.max(clusterEnd, item.endMin);
    }
    if (current.length) clusters.push(current);

    const layout = new Map();
    for (const cluster of clusters) {
        const colEnds = [];
        const placed = [];
        for (const item of cluster) {
            let col = colEnds.findIndex((end) => end <= item.startMin);
            if (col === -1) {
                col = colEnds.length;
                colEnds.push(item.endMin);
            } else {
                colEnds[col] = item.endMin;
            }
            placed.push({ item, col });
        }
        const columnCount = Math.max(1, colEnds.length);
        for (const { item, col } of placed) {
            layout.set(item.id, { columnIndex: col, columnCount });
        }
    }
    return layout;
}

/**
 * Horizontal placement inside the track (percent of content width after gutters).
 * @returns {{ leftFrac: number, widthFrac: number }}
 */
export function columnPlacement(columnIndex, columnCount, { gapFrac = 0.04 } = {}) {
    const n = Math.max(1, Math.round(Number(columnCount) || 1));
    const i = Math.max(0, Math.min(n - 1, Math.round(Number(columnIndex) || 0)));
    const slot = 1 / n;
    const gap = Math.min(0.2, Math.max(0, Number(gapFrac) || 0)) * slot;
    return {
        leftFrac: i * slot + gap / 2,
        widthFrac: Math.max(0.08, slot - gap),
    };
}

/** Safe `#RRGGBB` from API `color`, or null. */
export function normalizeEventColor(value) {
    if (value == null) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const withHash = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(withHash)) return withHash.toUpperCase();
    if (/^#[0-9A-Fa-f]{3}$/.test(withHash)) {
        const r = withHash[1];
        const g = withHash[2];
        const b = withHash[3];
        return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    return null;
}

/** Google Calendar event color_id ("1"…"11") → `#RRGGBB`. */
export const GOOGLE_EVENT_COLOR_IDS = Object.freeze({
    1: "#A4BDFC",
    2: "#7AE7BF",
    3: "#DBADFF",
    4: "#FF887C",
    5: "#FBD75B",
    6: "#FFB878",
    7: "#46D6DB",
    8: "#E1E1E1",
    9: "#5484ED",
    10: "#51B749",
    11: "#DC2127",
});

/** Google Calendar list colorId ("1"…"24") → background hex. */
export const GOOGLE_CALENDAR_COLOR_IDS = Object.freeze({
    1: "#AC725E",
    2: "#D06B64",
    3: "#F83A22",
    4: "#FA573C",
    5: "#FF7537",
    6: "#FFAD46",
    7: "#42D692",
    8: "#16A765",
    9: "#7BD148",
    10: "#B3DC6C",
    11: "#FBE983",
    12: "#FAD165",
    13: "#92E1C0",
    14: "#9FE1E7",
    15: "#9FC6E7",
    16: "#4986E7",
    17: "#9A9CFF",
    18: "#B99AFF",
    19: "#C2C2C2",
    20: "#CABDBF",
    21: "#CCA6AC",
    22: "#F691B2",
    23: "#CD74E6",
    24: "#A47AE2",
});

const FALLBACK_CALENDAR_PALETTE = Object.freeze([
    "#039BE5",
    "#D50000",
    "#F4511E",
    "#F6BF26",
    "#0B8043",
    "#33B679",
    "#8E24AA",
    "#E67C73",
    "#3F51B5",
    "#7986CB",
    "#E4C441",
    "#616161",
]);

export function colorFromGoogleColorId(colorId) {
    if (colorId == null || colorId === "") return null;
    const key = String(colorId).trim();
    // Prefer event palette (1–11); fall back to 24-swatch calendar palette.
    return (
        GOOGLE_EVENT_COLOR_IDS[key] ||
        GOOGLE_EVENT_COLOR_IDS[Number(key)] ||
        GOOGLE_CALENDAR_COLOR_IDS[key] ||
        GOOGLE_CALENDAR_COLOR_IDS[Number(key)] ||
        null
    );
}

export function colorFromGoogleCalendarColorId(colorId) {
    if (colorId == null || colorId === "") return null;
    const key = String(colorId).trim();
    return GOOGLE_CALENDAR_COLOR_IDS[key] || GOOGLE_CALENDAR_COLOR_IDS[Number(key)] || null;
}

/** Stable distinct hex from calendar id/name when provider hex is missing. */
export function deterministicColorFromKey(key) {
    const s = String(key || "").trim();
    if (!s) return null;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    // Force unsigned — JS `%` of a negative imul result indexes as undefined.
    const idx = (h >>> 0) % FALLBACK_CALENDAR_PALETTE.length;
    return FALLBACK_CALENDAR_PALETTE[idx];
}
