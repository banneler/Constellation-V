// js/command-center.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatDate,
    formatSimpleDate,
    addDays,
    themes,
    setupModalListeners,
    showModal,
    hideModal,
    showActionSuccessConfirm,
    updateActiveNavLink,
    setupUserMenuAndAuth,
    loadSVGs,
    setupGlobalSearch,
    checkAndSetNotifications,
    initializeAppState,
    getState,
    injectGlobalNavigation,
    logToSalesforce,
    showGlobalLoader,
    hideGlobalLoader,
    refreshHUDNodes,
    filterOutOwnershipOrphanedCrmRows,
    showToast,
    applyEmailMergeFields
} from './shared_constants.js';
import { AI_FUNCTION_IDS, callAiApi, mountAIFeedback } from './ai-memory.js';
import { createCalendarEvent, emailActionLabel, getIntegrationState, listCalendarEvents, listCalendars, sendEmail, updateCalendarEvent } from './integrations.js?v=113';
import {
    TIMELINE_START_MIN as GEO_TIMELINE_START_MIN,
    TIMELINE_END_MIN as GEO_TIMELINE_END_MIN,
    TIMELINE_SPAN_MIN as GEO_TIMELINE_SPAN_MIN,
    toUnixSeconds as geoToUnixSeconds,
    localMinutesFromDate as geoLocalMinutesFromDate,
    timedEventLocalMinutes,
    clampToTimeline,
    packOverlapColumns,
    columnPlacement,
    normalizeEventColor as geoNormalizeEventColor,
    colorFromGoogleColorId as geoColorFromGoogleColorId,
    DEFAULT_EVENT_COLOR,
    GOOGLE_EVENT_COLOR_IDS,
} from './cc-calendar-geometry.mjs?v=113';

document.addEventListener("DOMContentLoaded", async () => {
    injectGlobalNavigation();
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- STATE MANAGEMENT ---
    // The local state now primarily holds the data, while user/view state is managed globally.
    let state = {
        contacts: [],
        accounts: [],
        sequences: [],
        sequence_steps: [],
        activities: [],
        contact_sequences: [],
        tasks: [],
        deals: [],
        cognitoAlerts: [],
        nurtureAccounts: []
    };

    // --- DOM Element Selectors ---
    const logoutBtn = document.getElementById("logout-btn");
    const sequenceStepsList = document.getElementById("sequence-steps-list");
    const recentActivitiesList = document.getElementById("recent-activities-list");
    const ccCalendarCard = document.getElementById("cc-calendar-card");
    const ccCalendarList = document.getElementById("cc-calendar-list");
    const ccCalendarActions = document.getElementById("cc-calendar-actions");
    const ccCalendarAddBtn = document.getElementById("cc-calendar-add-btn");
    const ccCalendarMonthBtn = document.getElementById("cc-calendar-month-btn");
    const ccMonthBackdrop = document.getElementById("cc-month-calendar-backdrop");
    const ccMonthTitle = document.getElementById("cc-month-calendar-title");
    const ccMonthWeekdayRow = document.getElementById("cc-month-weekday-row");
    const ccMonthGrid = document.getElementById("cc-month-grid");
    const ccMonthDayHeading = document.getElementById("cc-month-day-heading");
    const ccMonthDayList = document.getElementById("cc-month-day-list");
    const ccMonthDayAddBtn = document.getElementById("cc-month-day-add-btn");
    const ccMonthPrevBtn = document.getElementById("cc-month-prev-btn");
    const ccMonthNextBtn = document.getElementById("cc-month-next-btn");
    const ccMonthCloseBtn = document.getElementById("cc-month-calendar-close");
    const myTasksList = document.getElementById("my-tasks-list");
    const sequenceToggleDue = document.getElementById("sequence-toggle-due");
    const sequenceToggleUpcoming = document.getElementById("sequence-toggle-upcoming");
    const myTasksHamburger = document.getElementById("my-tasks-hamburger");
    const aiBriefingContainer = document.getElementById("ai-briefing-container");
    const aiBriefingRefreshBtn = document.getElementById("ai-briefing-refresh-btn");

    // --- Utility ---
    function getStartOfLocalDayISO() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today.toISOString();
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    let calendarIntegrationState = null;
    let monthViewYear = null;
    let monthViewMonth = null; // 0-indexed
    let monthViewEvents = [];
    let monthSelectedDayKey = null;
    let monthEventsLoading = false;
    let cachedNylasCalendars = null;
    let cachedNylasCalendarsAt = 0;

    /** Day-panel timeline window (local minutes from midnight). */
    const TIMELINE_START_MIN = GEO_TIMELINE_START_MIN; // 7:00 AM
    const TIMELINE_END_MIN = GEO_TIMELINE_END_MIN; // 6:00 PM
    const TIMELINE_SPAN_MIN = GEO_TIMELINE_SPAN_MIN;
    const TIMELINE_HOUR_MIN = 60;

    /** Snap a minute offset to the start of its 1-hour block within the timeline. */
    function snapTimelineToHourStart(startMin) {
        const floored = Math.floor(startMin / TIMELINE_HOUR_MIN) * TIMELINE_HOUR_MIN;
        return Math.max(
            TIMELINE_START_MIN,
            Math.min(TIMELINE_END_MIN - TIMELINE_HOUR_MIN, floored)
        );
    }

    /** Map a Y position within the track to the hour-block start (minutes). */
    function hourStartFromTrackClientY(track, clientY) {
        const rect = track.getBoundingClientRect();
        if (!rect.height) return TIMELINE_START_MIN;
        const ratio = Math.max(0, Math.min(0.9999, (clientY - rect.top) / rect.height));
        return snapTimelineToHourStart(TIMELINE_START_MIN + ratio * TIMELINE_SPAN_MIN);
    }

    /** Normalize API timestamps to unix seconds (accepts seconds, ms, or ISO). */
    function toUnixSeconds(value) {
        return geoToUnixSeconds(value);
    }

    /** Local Date from event startTime (unix seconds). */
    function eventLocalDate(ev) {
        const sec = toUnixSeconds(ev?.startTime);
        if (sec == null) return null;
        const d = new Date(sec * 1000);
        if (Number.isNaN(d.getTime())) return null;
        return d;
    }

    /** Local minutes-from-midnight for a Date (browser local timezone; includes seconds). */
    function localMinutesFromDate(d) {
        return geoLocalMinutesFromDate(d);
    }

    /** Stable CSS percentage string (avoids float noise in inline styles). */
    function timelinePct(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return "0";
        return (Math.round(n * 10000) / 10000).toString();
    }

    function dayKeyFromDate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    function formatDayGroupLabel(date) {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (date.toDateString() === now.toDateString()) return "Today";
        if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
        return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }

    function formatCalendarEventTime(ev) {
        const d = eventLocalDate(ev);
        if (!d) return "";
        if (ev.allDay) return "All day";
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }

    /** Start–end label so short API durations are visible on the card (e.g. 2:00–2:45 PM). */
    function formatCalendarEventTimeRange(ev, startMin, endMin) {
        if (ev?.allDay) return "All day";
        const startLabel = formatMinutesLabel(startMin);
        if (endMin == null || !Number.isFinite(endMin) || endMin <= startMin) {
            return startLabel;
        }
        const endLabel = formatMinutesLabel(endMin);
        const startAmPm = startLabel.slice(-2);
        const endAmPm = endLabel.slice(-2);
        if (startAmPm === endAmPm) {
            return `${startLabel.slice(0, -3)}–${endLabel}`;
        }
        return `${startLabel}–${endLabel}`;
    }

    /** Pixel/percentage offset of local minutes within the 7am–6pm track. */
    function timelineOffsetRatio(startMin) {
        return (startMin - TIMELINE_START_MIN) / TIMELINE_SPAN_MIN;
    }

    /** Safe `#RRGGBB` from API `color`, or null (UI falls back to theme default). */
    function normalizeEventColor(value) {
        return geoNormalizeEventColor(value);
    }

    /**
     * Resolve paint hex for an event.
     * Per-event only: color_id / eventLabel / explicit event hex.
     * Calendar hex (Google peacock #039BE5, etc.) is ignored — unlabeled events
     * always paint Constellation brand blue.
     */
    function resolveEventColor(ev) {
        const meta = ev?.metadata && typeof ev.metadata === "object" ? ev.metadata : {};
        const colorId = ev?.colorId ?? ev?.color_id ?? meta.color_id ?? meta.colorId;
        const fromColorId = geoColorFromGoogleColorId(colorId);
        if (fromColorId) return fromColorId;

        const source = ev?.colorSource;
        if (source === "event_label" || source === "event_hex" || source === "color_id") {
            return normalizeEventColor(ev?.color) || DEFAULT_EVENT_COLOR;
        }
        // Ignore calendar / stale provider hex on ev.color when unlabeled.
        return DEFAULT_EVENT_COLOR;
    }

    /**
     * Inline --cc-event-color + solid paint so theme !important can't drop Google hex.
     * Always writes data-event-color for post-render forcePaint.
     */
    function eventColorStyleAttr(ev, { paintBackground = false, paintCard = false } = {}) {
        const color = resolveEventColor(ev);
        if (!color) return "";
        const parts = [`--cc-event-color: ${color}`];
        if (paintBackground) {
            parts.push(`background-color: ${color} !important`);
            parts.push(`border-color: ${color} !important`);
        }
        if (paintCard) {
            parts.push(`border-left: 3px solid ${color} !important`);
            parts.push(
                `background-color: color-mix(in srgb, ${color} 40%, var(--bg-light)) !important`
            );
            parts.push(
                `box-shadow: inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent) !important`
            );
        }
        return ` style="${parts.join("; ")}" data-event-color="${escapeHtml(color)}"`;
    }

    /**
     * Force hex onto rendered bullets/dots/cards after innerHTML — beats stylesheet
     * !important via setProperty priority and proves paint can't silently no-op.
     */
    function forcePaintEventColors(root) {
        const scope = root || document;
        const nodes = scope.querySelectorAll
            ? scope.querySelectorAll("[data-event-color]")
            : [];
        let painted = 0;
        nodes.forEach((el) => {
            const color = normalizeEventColor(el.getAttribute("data-event-color"));
            if (!color) return;
            el.style.setProperty("--cc-event-color", color);
            if (
                el.classList.contains("cc-event-bullet") ||
                el.classList.contains("cc-month-dot")
            ) {
                el.style.setProperty("background-color", color, "important");
                el.style.setProperty("border-color", color, "important");
            }
            if (el.classList.contains("cc-day-timeline-event")) {
                el.style.setProperty("border-left-color", color, "important");
                el.style.setProperty("border-left-width", "3px", "important");
                el.style.setProperty(
                    "background-color",
                    `color-mix(in srgb, ${color} 40%, var(--bg-light))`,
                    "important"
                );
                el.style.setProperty(
                    "box-shadow",
                    `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)`,
                    "important"
                );
            }
            painted += 1;
        });
        return painted;
    }

    /** Merge `calendarColors` / `calendars` from events API into the calendars cache. */
    function mergeCalendarColorsFromEvents(data) {
        const cals = Array.isArray(cachedNylasCalendars) ? [...cachedNylasCalendars] : [];
        let changed = false;

        const upsert = (id, hex, name) => {
            const color = normalizeEventColor(hex);
            if (!color || !id || id === "primary") return;
            const idx = cals.findIndex((c) => c && String(c.id) === String(id));
            if (idx >= 0) {
                const next = { ...cals[idx] };
                if (normalizeEventColor(next.color) !== color) {
                    next.color = color;
                    changed = true;
                }
                if (name && !next.name) {
                    next.name = name;
                    changed = true;
                }
                cals[idx] = next;
            } else {
                cals.push({
                    id: String(id),
                    name: name || String(id),
                    color,
                    isPrimary: false,
                    readOnly: false,
                });
                changed = true;
            }
        };

        if (Array.isArray(data?.calendars)) {
            for (const cal of data.calendars) {
                if (cal?.id != null) upsert(cal.id, cal.color, cal.name);
            }
        }
        const map = data?.calendarColors;
        if (map && typeof map === "object") {
            for (const [id, hex] of Object.entries(map)) {
                upsert(id, hex, null);
            }
        }
        if (changed) {
            cachedNylasCalendars = cals;
            cachedNylasCalendarsAt = Date.now();
        }
    }

    /** Paint API/calendar colors onto events missing `color` using the calendars cache. */
    function enrichEventsWithCalendarColors(events, data) {
        mergeCalendarColorsFromEvents(data);
        const list = Array.isArray(events) ? events : [];
        const enriched = list.map((ev) => {
            const resolved = resolveEventColor(ev);
            if (!resolved) return ev;
            if (normalizeEventColor(ev?.color) === resolved) return ev;
            return { ...ev, color: resolved };
        });
        const missing = enriched.filter((ev) => !normalizeEventColor(ev?.color));
        if (missing.length) {
            console.warn(
                `[command-center] ${missing.length} calendar event(s) still lack color after enrichment`,
                missing.map((ev) => ({
                    id: ev?.id,
                    title: ev?.title,
                    calendarId: ev?.calendarId,
                    calendarName: ev?.calendarName,
                }))
            );
        }
        return enriched;
    }

    function groupEventsByDay(events) {
        const groups = [];
        const indexByKey = new Map();
        for (const ev of events) {
            const d = eventLocalDate(ev);
            if (!d) continue;
            const key = dayKeyFromDate(d);
            let group = indexByKey.get(key);
            if (!group) {
                group = { key, date: d, label: formatDayGroupLabel(d), events: [] };
                indexByKey.set(key, group);
                groups.push(group);
            }
            group.events.push(ev);
        }
        return groups;
    }

    function renderCalendarEventItem(ev, { timeOnly = true } = {}) {
        const item = document.createElement("div");
        item.className = "cc-calendar-item";
        const whenLabel = timeOnly
            ? formatCalendarEventTime(ev)
            : (() => {
                const d = eventLocalDate(ev);
                if (!d) return "";
                if (ev.allDay) return `${formatDayGroupLabel(d)} · All day`;
                return `${formatDayGroupLabel(d)} · ${formatCalendarEventTime(ev)}`;
            })();
        const desc = (ev.description || "").trim();
        const showDesc = desc && desc.length > 2 && desc !== ev.title;
        item.innerHTML = `
            <span class="cc-event-bullet" aria-hidden="true"${eventColorStyleAttr(ev, { paintBackground: true })}></span>
            <div class="cc-calendar-item-when">${escapeHtml(whenLabel)}</div>
            <div class="cc-calendar-item-body">
                <div class="cc-calendar-item-title">${escapeHtml(ev.title || "(No title)")}</div>
                ${showDesc ? `<div class="cc-calendar-item-desc">${escapeHtml(desc)}</div>` : ""}
            </div>
        `;
        return item;
    }

    function renderGroupedCalendarList(container, events) {
        container.innerHTML = "";
        const groups = groupEventsByDay(events);
        if (!groups.length) {
            container.innerHTML =
                '<p class="cc-calendar-empty text-sm text-[var(--text-medium)] px-4 py-4">No upcoming events</p>';
            return;
        }
        for (const group of groups) {
            const section = document.createElement("section");
            section.className = "cc-calendar-day-group";
            section.setAttribute("aria-label", group.label);
            const header = document.createElement("div");
            header.className = "cc-calendar-day-header";
            header.textContent = group.label;
            section.appendChild(header);
            for (const ev of group.events) {
                section.appendChild(renderCalendarEventItem(ev, { timeOnly: true }));
            }
            container.appendChild(section);
        }
        forcePaintEventColors(container);
    }

    function setCalendarCardVisible(visible) {
        if (!ccCalendarCard) return;
        ccCalendarCard.classList.toggle("hidden", !visible);
        if (!visible) {
            setCalendarActionsVisible(false);
            closeMonthCalendarModal();
        }
    }

    function setCalendarActionsVisible(visible) {
        if (!ccCalendarActions) return;
        ccCalendarActions.classList.toggle("hidden", !visible);
    }

    function pad2(n) {
        return String(n).padStart(2, "0");
    }

    function toLocalDateInputValue(date = new Date()) {
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    }

    function toLocalTimeInputValue(date = new Date()) {
        return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    }

    function minutesToTimeInputValue(totalMinutes) {
        const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(totalMinutes)));
        return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
    }

    function timeInputValueToMinutes(timeStr) {
        if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null;
        const [h, m] = timeStr.split(":").map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        return h * 60 + m;
    }

    function formatHourLabel(hour24) {
        const h = ((hour24 % 24) + 24) % 24;
        if (h === 0) return "12 AM";
        if (h === 12) return "12 PM";
        if (h < 12) return `${h} AM`;
        return `${h - 12} PM`;
    }

    function formatMinutesLabel(totalMinutes) {
        const clamped = Math.max(0, Math.round(Number(totalMinutes) || 0));
        const h = Math.floor(clamped / 60);
        const m = clamped % 60;
        const base = formatHourLabel(h);
        if (m === 0) return base;
        const ampm = base.slice(-2);
        const hourPart = base.slice(0, -3);
        return `${hourPart}:${pad2(m)} ${ampm}`;
    }

    function localDateTimeToUnixSeconds(dateStr, timeStr) {
        if (!dateStr || !timeStr) return null;
        const d = new Date(`${dateStr}T${timeStr}:00`);
        if (Number.isNaN(d.getTime())) return null;
        return Math.floor(d.getTime() / 1000);
    }

    const EVENT_TIME_STEP_MIN = 15;
    const EVENT_DURATION_PRESETS = [15, 30, 45, 60];

    /** Clamp a start/end minute pair into 7:00–18:00 with at least 15 minutes. */
    function clampEventMinutesToDayWindow(startMin, endMin) {
        let s = Number(startMin);
        let e = Number(endMin);
        if (!Number.isFinite(s)) s = TIMELINE_START_MIN;
        if (!Number.isFinite(e)) e = s + 60;
        s = Math.max(TIMELINE_START_MIN, Math.min(s, TIMELINE_END_MIN - 15));
        e = Math.max(s + 15, Math.min(e, TIMELINE_END_MIN));
        return { startMin: s, endMin: e };
    }

    /** Snap a single minute value onto the step grid. */
    function snapMinutesToStep(totalMinutes, step = EVENT_TIME_STEP_MIN) {
        const n = Number(totalMinutes);
        if (!Number.isFinite(n)) return TIMELINE_START_MIN;
        return Math.round(n / step) * step;
    }

    /** Snap a start/end pair onto 15-minute steps inside the day window. */
    function snapEventMinutesToStep(startMin, endMin, step = EVENT_TIME_STEP_MIN) {
        let s = Number(startMin);
        let e = Number(endMin);
        if (!Number.isFinite(s)) s = TIMELINE_START_MIN;
        if (!Number.isFinite(e)) e = s + 60;
        const dur = Math.max(step, Math.round((e - s) / step) * step);
        s = snapMinutesToStep(s, step);
        return clampEventMinutesToDayWindow(s, s + dur);
    }

    /** 15-min minute values within [lo, hi], optionally injecting an off-grid selection. */
    function listEventTimeMinutes(selectedMin, { min, max, step = EVENT_TIME_STEP_MIN } = {}) {
        const lo = Number.isFinite(min) ? min : TIMELINE_START_MIN;
        const hi = Number.isFinite(max) ? max : TIMELINE_END_MIN;
        const selected =
            selectedMin != null && Number.isFinite(selectedMin) ? Math.round(selectedMin) : null;
        const mins = [];
        for (let m = lo; m <= hi; m += step) mins.push(m);
        if (selected != null && selected >= lo && selected <= hi && !mins.includes(selected)) {
            mins.push(selected);
            mins.sort((a, b) => a - b);
        }
        return mins;
    }

    /** iOS-style snap-scroll time wheel + hidden HH:MM input for form submit. */
    function buildTimeWheelHtml({
        inputId,
        name,
        label,
        selectedMin,
        min,
        max,
    }) {
        const mins = listEventTimeMinutes(selectedMin, { min, max });
        const value = minutesToTimeInputValue(selectedMin);
        const items = mins
            .map((m) => {
                const on = m === selectedMin;
                return `<button type="button" class="cc-event-time-wheel-item${on ? " is-selected" : ""}" role="option" data-min="${m}" aria-selected="${on ? "true" : "false"}">${escapeHtml(formatMinutesLabel(m))}</button>`;
            })
            .join("");
        return `
            <div class="cc-event-time-wheel-field">
                <span class="cc-event-time-wheel-label" id="${escapeHtml(inputId)}-label">${escapeHtml(label)}</span>
                <div class="cc-event-time-wheel" id="${escapeHtml(inputId)}-wheel">
                    <div class="cc-event-time-wheel-highlight" aria-hidden="true"></div>
                    <div class="cc-event-time-wheel-scroller" role="listbox" aria-labelledby="${escapeHtml(inputId)}-label" tabindex="0">
                        ${items}
                    </div>
                </div>
                <input type="hidden" id="${escapeHtml(inputId)}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" required>
            </div>
        `;
    }

    /**
     * Wire a snap-scroll time wheel.
     * User scrolls freely; value + onSettledChange fire once after settle
     * (scrollend + debounce). Programmatic setMinutes never emits onSettledChange.
     * @returns {{ getMinutes, setMinutes, isUserScrolling, whenSettled }}
     */
    function wireTimeWheel(wheelEl, hiddenInput, { onSettledChange } = {}) {
        const scroller = wheelEl?.querySelector(".cc-event-time-wheel-scroller");
        if (!wheelEl || !scroller || !hiddenInput) {
            return {
                getMinutes: () => timeInputValueToMinutes(hiddenInput?.value),
                setMinutes: () => {},
                isUserScrolling: () => false,
                whenSettled: (cb) => {
                    if (typeof cb === "function") cb();
                },
            };
        }

        const SETTLE_MS = 150;
        let isUserScrolling = false;
        let isProgrammatic = false;
        let settleTimer = null;
        let settleWaiters = [];
        let lastEmittedMin = timeInputValueToMinutes(hiddenInput.value);

        const itemHeight = () => {
            const item = scroller.querySelector(".cc-event-time-wheel-item");
            return item?.offsetHeight || 36;
        };

        const items = () => [...scroller.querySelectorAll(".cc-event-time-wheel-item")];

        const syncSelectedClass = (min) => {
            items().forEach((el) => {
                const on = Number(el.dataset.min) === min;
                el.classList.toggle("is-selected", on);
                el.setAttribute("aria-selected", on ? "true" : "false");
            });
        };

        const minutesFromScroll = () => {
            const h = itemHeight();
            if (!h) return timeInputValueToMinutes(hiddenInput.value);
            const list = items();
            if (!list.length) return timeInputValueToMinutes(hiddenInput.value);
            const idx = Math.max(0, Math.min(list.length - 1, Math.round(scroller.scrollTop / h)));
            const min = Number(list[idx].dataset.min);
            return Number.isFinite(min) ? min : timeInputValueToMinutes(hiddenInput.value);
        };

        const flushWaiters = () => {
            const waiters = settleWaiters.splice(0);
            for (const cb of waiters) {
                try {
                    cb();
                } catch (_) {
                    /* ignore */
                }
            }
        };

        const scrollToMinutes = (min, behavior = "auto") => {
            const list = items();
            const item = list.find((el) => Number(el.dataset.min) === min) || null;
            if (!item) {
                hiddenInput.value = minutesToTimeInputValue(min);
                syncSelectedClass(min);
                return;
            }
            const h = itemHeight();
            const idx = list.indexOf(item);
            const target = idx * h;
            // Avoid rAF thrash: only scroll when off the snap point.
            if (Math.abs(scroller.scrollTop - target) > 1.5) {
                isProgrammatic = true;
                scroller.scrollTo({ top: target, behavior });
            }
            hiddenInput.value = minutesToTimeInputValue(min);
            syncSelectedClass(min);
        };

        const finishSettle = () => {
            window.clearTimeout(settleTimer);
            settleTimer = null;
            const min = minutesFromScroll();
            const wasUser = isUserScrolling;
            if (min != null) {
                // Instant final snap only — never smooth here (smooth re-triggers scroll).
                scrollToMinutes(min, "auto");
                const changed = lastEmittedMin !== min;
                if (changed) lastEmittedMin = min;
                if (changed && wasUser) onSettledChange?.(min);
            }
            isUserScrolling = false;
            isProgrammatic = false;
            flushWaiters();
        };

        const scheduleSettle = () => {
            window.clearTimeout(settleTimer);
            settleTimer = window.setTimeout(finishSettle, SETTLE_MS);
        };

        scroller.addEventListener(
            "scroll",
            () => {
                if (!isProgrammatic) isUserScrolling = true;
                const min = minutesFromScroll();
                if (min != null) syncSelectedClass(min);
                scheduleSettle();
            },
            { passive: true }
        );

        scroller.addEventListener("scrollend", () => {
            finishSettle();
        });

        scroller.addEventListener(
            "pointerdown",
            () => {
                isUserScrolling = true;
            },
            { passive: true }
        );

        scroller.addEventListener("click", (e) => {
            const item = e.target.closest(".cc-event-time-wheel-item");
            if (!item || !scroller.contains(item)) return;
            const min = Number(item.dataset.min);
            if (!Number.isFinite(min)) return;
            isUserScrolling = true;
            scrollToMinutes(min, "smooth");
            scheduleSettle();
        });

        requestAnimationFrame(() => {
            const min = timeInputValueToMinutes(hiddenInput.value);
            if (min != null) {
                isProgrammatic = true;
                scrollToMinutes(min, "auto");
                lastEmittedMin = min;
                scheduleSettle();
            }
        });

        return {
            getMinutes: () => timeInputValueToMinutes(hiddenInput.value),
            setMinutes: (min, { behavior = "auto" } = {}) => {
                if (!Number.isFinite(min)) return;
                isProgrammatic = true;
                isUserScrolling = false;
                scrollToMinutes(min, behavior);
                lastEmittedMin = min;
                scheduleSettle();
            },
            isUserScrolling: () => isUserScrolling,
            whenSettled: (cb) => {
                if (typeof cb !== "function") return;
                if (!isUserScrolling && !isProgrammatic && settleTimer == null) {
                    cb();
                    return;
                }
                settleWaiters.push(cb);
            },
        };
    }

    function durationPillsHtml(durationMin) {
        return EVENT_DURATION_PRESETS.map((d) => {
            const selected = d === durationMin;
            return `<button type="button" class="cc-event-duration-pill${selected ? " cc-event-duration-pill--active" : ""}" data-duration-min="${d}" aria-pressed="${selected ? "true" : "false"}">${d} min</button>`;
        }).join("");
    }

    /** Validate HH:MM inputs are inside 7:00–18:00 and end > start. */
    function validateInAppEventTimes(startStr, endStr) {
        const startMin = timeInputValueToMinutes(startStr);
        const endMin = timeInputValueToMinutes(endStr);
        if (startMin == null || endMin == null) {
            return { ok: false, message: "Enter a valid date and time." };
        }
        if (startMin < TIMELINE_START_MIN || endMin > TIMELINE_END_MIN) {
            return {
                ok: false,
                message: "In-app events must stay within 7:00 AM–6:00 PM. Use Google or Outlook for earlier or later times.",
            };
        }
        if (endMin <= startMin) {
            return { ok: false, message: "End time must be after start time." };
        }
        return { ok: true, startMin, endMin };
    }

    function findMonthEventById(eventId) {
        if (eventId == null || eventId === "") return null;
        const id = String(eventId);
        return (monthViewEvents || []).find((ev) => ev?.id != null && String(ev.id) === id) || null;
    }

    async function ensureNylasCalendars({ force = false } = {}) {
        const CACHE_MS = 60_000;
        if (!force && cachedNylasCalendars && Date.now() - cachedNylasCalendarsAt < CACHE_MS) {
            return cachedNylasCalendars;
        }
        try {
            const data = await listCalendars(supabase, { limit: 50 });
            cachedNylasCalendars = Array.isArray(data?.calendars) ? data.calendars : [];
            cachedNylasCalendarsAt = Date.now();
            return cachedNylasCalendars;
        } catch (error) {
            console.warn("[command-center] list calendars:", error);
            if (cachedNylasCalendars) return cachedNylasCalendars;
            return [];
        }
    }

    /** Writable Nylas calendars/labels (skip read-only / holiday junk when possible). */
    function writableCalendars(calendars) {
        const list = Array.isArray(calendars) ? calendars : [];
        const looksLikeHoliday = (c) => {
            const n = String(c?.name || "").toLowerCase();
            return /\bholidays?\b|\bweather\b|\bbirthdays?\b/.test(n);
        };
        const writable = list.filter((c) => c?.id && !c.readOnly && !looksLikeHoliday(c));
        if (writable.length) return writable;
        const anyWritable = list.filter((c) => c?.id && !c.readOnly);
        if (anyWritable.length) return anyWritable;
        return list.filter((c) => c?.id && !looksLikeHoliday(c));
    }

    /** Friendly calendar name for the multi-calendar picker (not shown as chrome). */
    function calendarDisplayName(cal) {
        const name = (cal?.name && String(cal.name).trim()) || "Calendar";
        if (cal?.isPrimary && /@/.test(name)) return "Primary";
        if (/@/.test(name) && !/\s/.test(name)) {
            return name.split("@")[0] || name;
        }
        return name;
    }

    function defaultCalendarId(calendars) {
        const list = writableCalendars(calendars);
        return list.find((c) => c.isPrimary)?.id || list[0]?.id || "primary";
    }

    function calendarOptionsHtml(calendars, selectedId) {
        const list = writableCalendars(calendars);
        if (!list.length) {
            return `<option value="primary">Primary</option>`;
        }
        return list
            .map((c) => {
                const sel = c.id === selectedId ? " selected" : "";
                return `<option value="${escapeHtml(c.id)}"${sel}>${escapeHtml(calendarDisplayName(c))}</option>`;
            })
            .join("");
    }

    /**
     * Calendar field for create/edit.
     * One calendar (or edit — Nylas update is scoped to the event's calendar): hidden id only.
     * Multiple writable calendars on create: real Calendar picker. Never show "Label: primary".
     */
    function calendarFieldHtml(calendars, selectedId, swatchStyle, { forceHidden = false } = {}) {
        const list = writableCalendars(calendars);
        const selected =
            list.find((c) => c.id === selectedId) || list[0] || { id: selectedId || "primary", name: "Calendar" };
        const calId = selected.id || "primary";
        if (forceHidden || list.length <= 1) {
            return `<input type="hidden" id="cc-event-calendar" name="calendarId" value="${escapeHtml(calId)}">`;
        }
        return `
            <div class="cc-event-label-field">
                <label for="cc-event-calendar">Calendar</label>
                <div class="cc-event-calendar-row">
                    <span class="cc-event-calendar-swatch" id="cc-event-calendar-swatch"${swatchStyle} aria-hidden="true"></span>
                    <select id="cc-event-calendar" name="calendarId" required aria-label="Calendar">
                        ${calendarOptionsHtml(calendars, selectedId)}
                    </select>
                </div>
            </div>`;
    }

    /** Google legacy event colors (1–11). Empty = calendar default / clear override. */
    function eventColorPickerHtml(selectedColorId) {
        const selected =
            selectedColorId != null && selectedColorId !== ""
                ? String(selectedColorId).trim()
                : "";
        const defaultActive = !selected;
        const swatches = Object.entries(GOOGLE_EVENT_COLOR_IDS)
            .map(([id, hex]) => {
                const active = selected === String(id);
                return `<button type="button" class="cc-event-color-swatch${active ? " cc-event-color-swatch--active" : ""}" data-color-id="${escapeHtml(id)}" style="background-color: ${escapeHtml(hex)}" title="Color ${escapeHtml(id)}" aria-label="Event color ${escapeHtml(id)}" aria-pressed="${active ? "true" : "false"}"></button>`;
            })
            .join("");
        return `
            <div class="cc-event-color-field">
                <span class="cc-event-color-heading" id="cc-event-color-label">Color</span>
                <div class="cc-event-color-swatches" role="group" aria-labelledby="cc-event-color-label">
                    <button type="button" class="cc-event-color-swatch cc-event-color-swatch--default${defaultActive ? " cc-event-color-swatch--active" : ""}" data-color-id="" title="Calendar default" aria-label="Calendar default color" aria-pressed="${defaultActive ? "true" : "false"}"></button>
                    ${swatches}
                </div>
                <input type="hidden" id="cc-event-color-id" name="colorId" value="${escapeHtml(selected)}">
            </div>`;
    }

    /** Busy intervals in local minutes-from-midnight for a day key (timed events only). */
    function busyIntervalsForDay(dayKey, events) {
        const intervals = [];
        for (const ev of events || []) {
            if (ev?.allDay || ev?.startTime == null) continue;
            const start = eventLocalDate(ev);
            if (!start || dayKeyFromDate(start) !== dayKey) continue;
            const startSec = toUnixSeconds(ev.startTime);
            const endSec = toUnixSeconds(ev.endTime) ?? startSec + 3600;
            const end = new Date(endSec * 1000);
            let startMin = localMinutesFromDate(start);
            let endMin = Number.isNaN(end.getTime())
                ? startMin + 60
                : dayKeyFromDate(end) !== dayKey
                  ? TIMELINE_END_MIN
                  : localMinutesFromDate(end);
            if (endMin <= startMin) endMin = startMin + 15;
            startMin = Math.max(TIMELINE_START_MIN, startMin);
            endMin = Math.min(TIMELINE_END_MIN, endMin);
            if (endMin > startMin) intervals.push({ start: startMin, end: endMin });
        }
        intervals.sort((a, b) => a.start - b.start);
        const merged = [];
        for (const iv of intervals) {
            const last = merged[merged.length - 1];
            if (!last || iv.start > last.end) merged.push({ ...iv });
            else last.end = Math.max(last.end, iv.end);
        }
        return merged;
    }

    /**
     * Suggest free slots within 7am–6pm that fit `durationMinutes` without overlapping busy times.
     * @returns {{ startMin: number, endMin: number, label: string }[]}
     */
    function suggestAvailableSlots(dayKey, durationMinutes, events, { step = 30, max = 6 } = {}) {
        const duration = Math.max(15, Math.round(Number(durationMinutes) || 60));
        if (duration > TIMELINE_SPAN_MIN) return [];
        const busy = busyIntervalsForDay(dayKey, events);
        const free = [];
        let cursor = TIMELINE_START_MIN;
        for (const iv of busy) {
            if (iv.start > cursor) free.push({ start: cursor, end: iv.start });
            cursor = Math.max(cursor, iv.end);
        }
        if (cursor < TIMELINE_END_MIN) free.push({ start: cursor, end: TIMELINE_END_MIN });

        const suggestions = [];
        for (const gap of free) {
            let t = gap.start;
            if (t % step !== 0) t += step - (t % step);
            for (; t + duration <= gap.end; t += step) {
                suggestions.push({
                    startMin: t,
                    endMin: t + duration,
                    label: `${formatMinutesLabel(t)} – ${formatMinutesLabel(t + duration)}`,
                });
                if (suggestions.length >= max) return suggestions;
            }
        }
        return suggestions;
    }

    function monthRangeUnix(year, monthIndex) {
        const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
        const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
        return {
            start: Math.floor(start.getTime() / 1000),
            end: Math.floor(end.getTime() / 1000),
        };
    }

    function replacePlaceholders(template, contact, account) {
        return applyEmailMergeFields(template, contact, account);
    }

    function promptCalendarConnect() {
        showModal(
            "Connect calendar",
            `<p class="text-sm text-[var(--text-medium)]">Connect Google or Outlook in <a href="ai-admin.html?tab=integrations" class="cc-calendar-settings-link">User Settings</a> to add events and browse your month view.</p>`,
            null,
            false,
            `<button id="modal-ok-btn" class="btn-primary">OK</button><a href="ai-admin.html?tab=integrations" class="btn-secondary" style="display:inline-flex;align-items:center;">Open User Settings</a>`
        );
    }

    /**
     * Create or edit a calendar event (shared modal).
     * @param {{
     *   date?: string, start?: string, end?: string, calendarId?: string,
     *   title?: string, description?: string,
     *   mode?: 'create'|'edit', eventId?: string, excludeEventId?: string
     * }} [prefill]
     *   date = YYYY-MM-DD; start/end = HH:MM local (clamped to 7:00–18:00)
     */
    async function openAddCalendarEventForm(prefill = {}) {
        if (!calendarIntegrationState?.orgEnabled) return;
        if (!calendarIntegrationState?.connected) {
            promptCalendarConnect();
            return;
        }

        const isEdit = prefill.mode === "edit" && Boolean(prefill.eventId);

        const startDefault = new Date();
        startDefault.setMinutes(0, 0, 0);
        startDefault.setHours(startDefault.getHours() + 1);
        // Outside the day window → next business morning at 7:00.
        if (localMinutesFromDate(startDefault) >= TIMELINE_END_MIN - 15) {
            startDefault.setDate(startDefault.getDate() + 1);
            startDefault.setHours(7, 0, 0, 0);
        } else if (localMinutesFromDate(startDefault) < TIMELINE_START_MIN) {
            startDefault.setHours(7, 0, 0, 0);
        }
        const endDefault = new Date(startDefault.getTime() + 60 * 60 * 1000);

        let dateValue = prefill.date || toLocalDateInputValue(startDefault);
        let startValue = prefill.start || toLocalTimeInputValue(startDefault);
        let endValue = prefill.end || toLocalTimeInputValue(endDefault);
        if (prefill.start && !prefill.end) {
            const startMin = timeInputValueToMinutes(prefill.start) ?? 9 * 60;
            endValue = minutesToTimeInputValue(startMin + 60);
        }

        // In-app times always land inside the day timeline window on 15-min steps.
        let startMinClamped;
        let endMinClamped;
        {
            const snapped = snapEventMinutesToStep(
                timeInputValueToMinutes(startValue) ?? TIMELINE_START_MIN,
                timeInputValueToMinutes(endValue) ?? TIMELINE_START_MIN + 60
            );
            startMinClamped = snapped.startMin;
            endMinClamped = snapped.endMin;
            startValue = minutesToTimeInputValue(startMinClamped);
            endValue = minutesToTimeInputValue(endMinClamped);
        }
        const initialDurationMin = Math.max(EVENT_TIME_STEP_MIN, endMinClamped - startMinClamped);

        const calendars = await ensureNylasCalendars();
        const selectedCalId = prefill.calendarId || defaultCalendarId(calendars);
        const selectedCal = writableCalendars(calendars).find((c) => c.id === selectedCalId);
        const swatchColor = normalizeEventColor(selectedCal?.color);
        const swatchStyle = swatchColor
            ? ` style="background-color: ${swatchColor}"`
            : ` style="background-color: var(--primary-blue)"`;

        const titleValue = prefill.title != null ? String(prefill.title) : "";
        const descValue = prefill.description != null ? String(prefill.description) : "";
        // Edit: hide calendar chrome (update is scoped to the event's calendar).
        // Create with one calendar: hide too — "Label: primary" is noise.
        const calendarField = calendarFieldHtml(calendars, selectedCalId, swatchStyle, {
            forceHidden: isEdit,
        });
        // Google-only: Nylas writes legacy color_id (1–11); named Labels are unavailable.
        const showColorPicker = calendarIntegrationState?.provider === "google";
        const colorField = showColorPicker
            ? eventColorPickerHtml(prefill.colorId)
            : "";

        const bodyHtml = `
            <form id="cc-add-event-form" class="modal-form">
                <label for="cc-event-title">Title</label>
                <input type="text" id="cc-event-title" name="title" required placeholder="Event title" autocomplete="off" value="${escapeHtml(titleValue)}">
                ${calendarField}
                ${colorField}
                <label for="cc-event-date">Date</label>
                <input type="date" id="cc-event-date" name="date" required value="${escapeHtml(dateValue)}">
                <div class="cc-event-duration" id="cc-event-duration">
                    <div class="cc-event-duration-label">Duration</div>
                    <div class="cc-event-duration-pills" id="cc-event-duration-pills" role="group" aria-label="Duration">
                        ${durationPillsHtml(initialDurationMin)}
                    </div>
                </div>
                <div class="cc-event-time-wheels" id="cc-event-time-wheels">
                    ${buildTimeWheelHtml({
                        inputId: "cc-event-start",
                        name: "start",
                        label: "Start",
                        selectedMin: startMinClamped,
                        min: TIMELINE_START_MIN,
                        max: TIMELINE_END_MIN - EVENT_TIME_STEP_MIN,
                    })}
                    ${buildTimeWheelHtml({
                        inputId: "cc-event-end",
                        name: "end",
                        label: "End",
                        selectedMin: endMinClamped,
                        min: TIMELINE_START_MIN + EVENT_TIME_STEP_MIN,
                        max: TIMELINE_END_MIN,
                    })}
                </div>
                <p class="text-xs text-[var(--text-muted)]" style="margin:0.15rem 0 0.35rem">In-app times are limited to 7:00 AM–6:00 PM. Earlier or later events stay on Google/Outlook.</p>
                <div class="cc-event-suggestions" id="cc-event-suggestions">
                    <div class="cc-event-suggestions-label">Available times</div>
                    <div class="cc-event-suggestions-list" id="cc-event-suggestions-list"></div>
                </div>
                <label for="cc-event-desc">Description <span class="text-[var(--text-muted)] font-normal">(optional)</span></label>
                <textarea id="cc-event-desc" name="description" rows="3" placeholder="Notes for the invite">${escapeHtml(descValue)}</textarea>
            </form>
        `;

        showModal(
            isEdit ? "Edit Event" : "Add Event",
            bodyHtml,
            async () => {
                const titleEl = document.getElementById("cc-event-title");
                const dateEl = document.getElementById("cc-event-date");
                const startEl = document.getElementById("cc-event-start");
                const endEl = document.getElementById("cc-event-end");
                const descEl = document.getElementById("cc-event-desc");
                const calEl = document.getElementById("cc-event-calendar");
                const title = (titleEl?.value || "").trim();
                if (!title) {
                    showToast("Enter an event title.", "warning");
                    titleEl?.focus();
                    return false;
                }
                const timeCheck = validateInAppEventTimes(startEl?.value, endEl?.value);
                if (!timeCheck.ok) {
                    showToast(timeCheck.message, "warning");
                    document
                        .querySelector("#cc-event-start-wheel .cc-event-time-wheel-scroller")
                        ?.focus();
                    return false;
                }
                const startTime = localDateTimeToUnixSeconds(dateEl?.value, startEl?.value);
                const endTime = localDateTimeToUnixSeconds(dateEl?.value, endEl?.value);
                if (startTime == null || endTime == null) {
                    showToast("Enter a valid date and time.", "warning");
                    return false;
                }
                const calendarId = (calEl?.value || "").trim() || "primary";
                const colorEl = document.getElementById("cc-event-color-id");
                const payload = {
                    title,
                    description: (descEl?.value || "").trim() || "",
                    startTime,
                    endTime,
                    calendarId,
                    localStart: startEl.value,
                    localEnd: endEl.value,
                    // Server uses this to enforce 7am–6pm in the user's local zone.
                    timezoneOffsetMin: new Date().getTimezoneOffset(),
                };
                // Only when Google color picker is present — null clears override.
                if (colorEl) {
                    const raw = (colorEl.value || "").trim();
                    payload.colorId = raw || null;
                }
                try {
                    const result = isEdit
                        ? await updateCalendarEvent(
                              supabase,
                              { ...payload, id: prefill.eventId },
                              { onNotice: (msg, type) => showToast(msg, type) }
                          )
                        : await createCalendarEvent(
                              supabase,
                              payload,
                              { onNotice: (msg, type) => showToast(msg, type) }
                          );
                    if (!result?.ok) return false;
                    // Close modal immediately; refresh list/timeline in the background.
                    const refreshMonth =
                        ccMonthBackdrop && !ccMonthBackdrop.classList.contains("hidden");
                    void (async () => {
                        try {
                            await loadCalendarPanel();
                            if (refreshMonth) await loadMonthCalendarEvents();
                        } catch (refreshError) {
                            console.warn("[command-center] post-save calendar refresh:", refreshError);
                        }
                    })();
                    return true;
                } catch (error) {
                    showToast(
                        error?.message || (isEdit ? "Could not update calendar event." : "Could not create calendar event."),
                        "error"
                    );
                    return false;
                }
            },
            true,
            `<button id="modal-confirm-btn" class="btn-primary">${isEdit ? "Save" : "Create"}</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
        );

        queueMicrotask(() => {
            document.getElementById("cc-event-title")?.focus();
            wireAddEventFormExtras(calendars, {
                excludeEventId: prefill.excludeEventId || prefill.eventId || null,
            });
        });
    }

    /** Open edit modal for a timeline/month event (times clamped into 7–6 for in-app editing). */
    function openEditCalendarEventForm(ev) {
        if (!ev?.id) {
            showToast("This event can't be edited here.", "warning");
            return;
        }
        const start = eventLocalDate(ev);
        if (!start) {
            showToast("This event has no start time.", "warning");
            return;
        }
        const startSec = toUnixSeconds(ev.startTime);
        const endSec = toUnixSeconds(ev.endTime) ?? (startSec != null ? startSec + 3600 : null);
        const end = endSec != null ? new Date(endSec * 1000) : new Date(start.getTime() + 60 * 60 * 1000);
        const startMin = localMinutesFromDate(start);
        const endMin = Number.isNaN(end.getTime()) ? startMin + 60 : localMinutesFromDate(end);
        const clamped = clampEventMinutesToDayWindow(startMin, endMin);
        openAddCalendarEventForm({
            mode: "edit",
            eventId: String(ev.id),
            excludeEventId: String(ev.id),
            title: ev.title && ev.title !== "(No title)" ? ev.title : "",
            description: ev.description || "",
            date: dayKeyFromDate(start),
            start: minutesToTimeInputValue(clamped.startMin),
            end: minutesToTimeInputValue(clamped.endMin),
            calendarId: ev.calendarId || undefined,
            colorId: ev.colorId ?? ev.color_id ?? undefined,
        });
    }

    async function fetchEventsForDayKey(dayKey) {
        if (!dayKey) return [];
        const [y, mo] = dayKey.split("-").map(Number);
        if (
            monthViewYear === y &&
            monthViewMonth === mo - 1 &&
            Array.isArray(monthViewEvents)
        ) {
            return eventsForDayKey(dayKey);
        }
        try {
            const [, , dd] = dayKey.split("-").map(Number);
            const start = new Date(y, mo - 1, dd, 0, 0, 0, 0);
            const end = new Date(y, mo - 1, dd, 23, 59, 59, 999);
            const data = await listCalendarEvents(supabase, {
                start: Math.floor(start.getTime() / 1000),
                end: Math.floor(end.getTime() / 1000),
                limit: 50,
            });
            return enrichEventsWithCalendarColors(
                Array.isArray(data?.events) ? data.events : [],
                data
            );
        } catch (error) {
            console.warn("[command-center] day availability:", error);
            return eventsForDayKey(dayKey);
        }
    }

    function wireAddEventFormExtras(calendars, { excludeEventId = null } = {}) {
        const dateEl = document.getElementById("cc-event-date");
        const startEl = document.getElementById("cc-event-start");
        const endEl = document.getElementById("cc-event-end");
        const startWheelEl = document.getElementById("cc-event-start-wheel");
        const endWheelEl = document.getElementById("cc-event-end-wheel");
        const calEl = document.getElementById("cc-event-calendar");
        const swatchEl = document.getElementById("cc-event-calendar-swatch");
        const listEl = document.getElementById("cc-event-suggestions-list");
        const durationWrap = document.getElementById("cc-event-duration");
        if (!dateEl || !startEl || !endEl || !listEl || !startWheelEl || !endWheelEl) return;

        let suggestionEvents = [];
        let loadToken = 0;
        /** Blocks cross-wheel sync while a dependent update is in flight. */
        let linkLock = false;
        let selectedDurationMin = (() => {
            const s = timeInputValueToMinutes(startEl.value);
            const e = timeInputValueToMinutes(endEl.value);
            if (s != null && e != null && e > s) return e - s;
            return 60;
        })();

        const syncSwatch = () => {
            if (!swatchEl || !calEl || calEl.tagName !== "SELECT") return;
            const cal = writableCalendars(calendars).find((c) => c.id === calEl.value);
            const color = normalizeEventColor(cal?.color);
            swatchEl.style.backgroundColor = color || "var(--primary-blue)";
        };

        const syncDurationPills = () => {
            if (!durationWrap) return;
            durationWrap.querySelectorAll(".cc-event-duration-pill").forEach((btn) => {
                const min = Number(btn.dataset.durationMin);
                const active = min === selectedDurationMin;
                btn.classList.toggle("cc-event-duration-pill--active", active);
                btn.setAttribute("aria-pressed", active ? "true" : "false");
            });
        };

        let startWheel;
        let endWheel;

        function renderSuggestions() {
            const dayKey = dateEl.value;
            const startMin = timeInputValueToMinutes(startEl.value);
            const endMin = timeInputValueToMinutes(endEl.value);
            let duration = selectedDurationMin || 60;
            if (startMin != null && endMin != null && endMin > startMin) {
                duration = endMin - startMin;
            }
            const busyEvents = excludeEventId
                ? suggestionEvents.filter((ev) => String(ev?.id) !== String(excludeEventId))
                : suggestionEvents;
            const slots = dayKey
                ? suggestAvailableSlots(dayKey, duration, busyEvents)
                : [];
            if (!slots.length) {
                listEl.innerHTML =
                    '<p class="cc-event-suggestions-empty">No open slots in 7 AM–6 PM for this duration.</p>';
                return;
            }
            listEl.innerHTML = slots
                .map(
                    (s) =>
                        `<button type="button" class="cc-event-suggestion-btn" data-start-min="${s.startMin}" data-end-min="${s.endMin}">${escapeHtml(s.label)}</button>`
                )
                .join("");
        }

        /** Programmatic both-wheels set (pills / suggestions). Never fights mid-scroll. */
        const applyTimes = (startMin, endMin, { keepDuration = false, behavior = "auto" } = {}) => {
            const snapped = snapEventMinutesToStep(startMin, endMin);
            linkLock = true;
            startWheel?.setMinutes(snapped.startMin, { behavior });
            endWheel?.setMinutes(snapped.endMin, { behavior });
            if (!keepDuration) {
                selectedDurationMin = Math.max(
                    EVENT_TIME_STEP_MIN,
                    snapped.endMin - snapped.startMin
                );
            }
            syncDurationPills();
            renderSuggestions();
            // Release lock after both wheels settle (or immediately if idle).
            let pending = 2;
            const done = () => {
                pending -= 1;
                if (pending <= 0) linkLock = false;
            };
            startWheel?.whenSettled(done);
            endWheel?.whenSettled(done);
        };

        startWheel = wireTimeWheel(startWheelEl, startEl, {
            onSettledChange: (min) => {
                if (linkLock) return;
                // Wait until end isn't mid-user-scroll, then sync end once.
                const syncEndFromStart = () => {
                    if (linkLock) return;
                    if (endWheel?.isUserScrolling()) {
                        endWheel.whenSettled(syncEndFromStart);
                        return;
                    }
                    const dur = Math.max(EVENT_TIME_STEP_MIN, selectedDurationMin || 60);
                    let endMin = min + dur;
                    if (endMin > TIMELINE_END_MIN) {
                        endMin = TIMELINE_END_MIN;
                        selectedDurationMin = Math.max(EVENT_TIME_STEP_MIN, endMin - min);
                    }
                    linkLock = true;
                    endWheel?.setMinutes(endMin, { behavior: "smooth" });
                    endWheel?.whenSettled(() => {
                        linkLock = false;
                        syncDurationPills();
                        renderSuggestions();
                    });
                };
                syncEndFromStart();
            },
        });
        endWheel = wireTimeWheel(endWheelEl, endEl, {
            onSettledChange: (min) => {
                if (linkLock) return;
                // Prefer: dragging end → update duration/pills only; don't yank start.
                const syncDurationFromEnd = () => {
                    if (linkLock) return;
                    if (startWheel?.isUserScrolling()) {
                        startWheel.whenSettled(syncDurationFromEnd);
                        return;
                    }
                    const startMin = startWheel?.getMinutes() ?? TIMELINE_START_MIN;
                    let endMin = min;
                    if (endMin <= startMin) {
                        endMin = Math.min(startMin + EVENT_TIME_STEP_MIN, TIMELINE_END_MIN);
                        if (endMin !== min) {
                            linkLock = true;
                            endWheel?.setMinutes(endMin, { behavior: "auto" });
                            endWheel?.whenSettled(() => {
                                linkLock = false;
                            });
                        }
                    }
                    selectedDurationMin = Math.max(EVENT_TIME_STEP_MIN, endMin - startMin);
                    syncDurationPills();
                    renderSuggestions();
                };
                syncDurationFromEnd();
            },
        });

        const refreshBusyAndSuggestions = async () => {
            const token = ++loadToken;
            const dayKey = dateEl.value;
            listEl.innerHTML =
                '<p class="cc-event-suggestions-empty">Checking availability…</p>';
            const events = await fetchEventsForDayKey(dayKey);
            if (token !== loadToken) return;
            suggestionEvents = events;
            renderSuggestions();
        };

        if (calEl?.tagName === "SELECT") {
            calEl.addEventListener("change", syncSwatch);
        }
        const colorWrap = document.querySelector("#cc-add-event-form .cc-event-color-swatches");
        const colorInput = document.getElementById("cc-event-color-id");
        colorWrap?.addEventListener("click", (e) => {
            const btn = e.target.closest(".cc-event-color-swatch");
            if (!btn || !colorWrap.contains(btn) || !colorInput) return;
            const id = btn.getAttribute("data-color-id") ?? "";
            colorInput.value = id;
            colorWrap.querySelectorAll(".cc-event-color-swatch").forEach((el) => {
                const on = el === btn;
                el.classList.toggle("cc-event-color-swatch--active", on);
                el.setAttribute("aria-pressed", on ? "true" : "false");
            });
        });
        dateEl.addEventListener("change", () => {
            refreshBusyAndSuggestions();
        });
        durationWrap?.addEventListener("click", (e) => {
            const btn = e.target.closest(".cc-event-duration-pill");
            if (!btn || !durationWrap.contains(btn)) return;
            const dur = Number(btn.dataset.durationMin);
            if (!EVENT_DURATION_PRESETS.includes(dur)) return;
            selectedDurationMin = dur;
            const startMin = startWheel.getMinutes() ?? TIMELINE_START_MIN;
            applyTimes(startMin, startMin + dur, { keepDuration: true, behavior: "smooth" });
        });
        listEl.addEventListener("click", (e) => {
            const btn = e.target.closest(".cc-event-suggestion-btn");
            if (!btn) return;
            const sMin = Number(btn.dataset.startMin);
            const eMin = Number(btn.dataset.endMin);
            if (!Number.isFinite(sMin) || !Number.isFinite(eMin)) return;
            applyTimes(sMin, eMin, { behavior: "smooth" });
        });

        syncSwatch();
        syncDurationPills();
        refreshBusyAndSuggestions();
    }

    function renderMonthWeekdayRow() {
        if (!ccMonthWeekdayRow) return;
        const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        ccMonthWeekdayRow.innerHTML = labels
            .map((label) => `<div class="cc-month-weekday">${label}</div>`)
            .join("");
    }

    function eventsForDayKey(dayKey) {
        return monthViewEvents.filter((ev) => {
            const d = eventLocalDate(ev);
            return d && dayKeyFromDate(d) === dayKey;
        });
    }

    function setMonthDayAddVisible(visible) {
        if (!ccMonthDayAddBtn) return;
        ccMonthDayAddBtn.classList.toggle("hidden", !visible);
    }

    function openAddEventForSelectedDay(startMinPrefill = null) {
        if (!monthSelectedDayKey) {
            openAddCalendarEventForm();
            return;
        }
        const prefill = { date: monthSelectedDayKey };
        if (startMinPrefill != null && Number.isFinite(startMinPrefill)) {
            const hourStart = snapTimelineToHourStart(startMinPrefill);
            prefill.start = minutesToTimeInputValue(hourStart);
            // Prefill fills the highlighted hour block (existing 60-min default).
            prefill.end = minutesToTimeInputValue(
                Math.min(TIMELINE_END_MIN, hourStart + TIMELINE_HOUR_MIN)
            );
        }
        openAddCalendarEventForm(prefill);
    }

    function renderMonthDayPanel(dayKey) {
        if (!ccMonthDayHeading || !ccMonthDayList) return;
        if (!dayKey) {
            ccMonthDayHeading.textContent = "Select a day";
            ccMonthDayList.innerHTML = '<p class="cc-month-day-empty">Click a day to see events.</p>';
            setMonthDayAddVisible(false);
            return;
        }
        const [y, m, d] = dayKey.split("-").map(Number);
        const date = new Date(y, m - 1, d);
        ccMonthDayHeading.textContent = date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
        });
        setMonthDayAddVisible(Boolean(calendarIntegrationState?.connected));

        const dayEvents = eventsForDayKey(dayKey);
        const allDayEvents = dayEvents.filter((ev) => ev.allDay);
        const timedEvents = dayEvents.filter((ev) => !ev.allDay);

        const hourMarks = [];
        for (let h = 7; h <= 18; h++) {
            const topPct = timelineOffsetRatio(h * 60) * 100;
            // Only set top — width/position come from CSS (avoid zero-height boxes that paint edge artifacts).
            hourMarks.push(
                `<div class="cc-day-timeline-hour" style="top:${topPct}%;height:0">
                    <span class="cc-day-timeline-hour-label">${formatHourLabel(h)}</span>
                </div>`
            );
        }
        // Timed layout: parse exclusive end_time → minutes, clamp to 7–6 track,
        // pack overlapping intervals into side-by-side columns (not z-index stack).
        const layoutItems = [];
        const outsideTimed = [];
        timedEvents.forEach((ev, idx) => {
            const mins = timedEventLocalMinutes(ev, dayKey, { dayKeyFromDate });
            if (!mins) return;
            const { startMin, endMin, durationMin } = mins;
            if (endMin <= TIMELINE_START_MIN || startMin >= TIMELINE_END_MIN) {
                outsideTimed.push(ev);
                return;
            }
            const clamped = clampToTimeline(startMin, endMin);
            if (!clamped) {
                outsideTimed.push(ev);
                return;
            }
            layoutItems.push({
                id: ev.id != null ? String(ev.id) : `idx-${idx}`,
                ev,
                startMin,
                endMin,
                durationMin,
                ...clamped,
            });
        });
        const overlapLayout = packOverlapColumns(
            layoutItems.map((it) => ({
                id: it.id,
                startMin: it.clampedStart,
                endMin: it.clampedEnd,
            }))
        );

        const eventBlocks = layoutItems
            .map((it) => {
                const { ev, startMin, endMin, clampedStart, durationMin, topPct: rawTop, heightPct: rawHeight } =
                    it;
                const overflowBefore = startMin < TIMELINE_START_MIN;
                const overflowAfter = endMin > TIMELINE_END_MIN;
                const topPct = timelinePct(rawTop);
                const heightPct = timelinePct(rawHeight);
                const desc = (ev.description || "").trim();
                // Description only when the timed block is tall enough for a second line.
                const showDesc =
                    desc &&
                    desc.length > 2 &&
                    desc !== ev.title &&
                    durationMin >= 40;
                const classes = ["cc-day-timeline-event"];
                if (overflowBefore) classes.push("is-overflow-start");
                if (overflowAfter) classes.push("is-overflow-end");
                // Nylas/Google end_time is exclusive — label matches true duration
                // (e.g. 2:00–2:45 PM = 45 min → height 45/660 of the track).
                const whenLabel = formatCalendarEventTimeRange(ev, startMin, endMin);
                const color = resolveEventColor(ev);
                const pack = overlapLayout.get(it.id) || { columnIndex: 0, columnCount: 1 };
                const gutterL = "var(--cc-day-timeline-event-left,0.25rem)";
                const gutterR = "var(--cc-day-timeline-event-right,0.7rem)";
                let horizStyle;
                if (pack.columnCount <= 1) {
                    horizStyle = `left:${gutterL};right:${gutterR};width:auto;`;
                } else {
                    const { leftFrac, widthFrac } = columnPlacement(
                        pack.columnIndex,
                        pack.columnCount
                    );
                    const leftExpr = `calc(${gutterL} + (100% - ${gutterL} - ${gutterR}) * ${timelinePct(leftFrac * 100)} / 100)`;
                    const widthExpr = `calc((100% - ${gutterL} - ${gutterR}) * ${timelinePct(widthFrac * 100)} / 100)`;
                    horizStyle = `left:${leftExpr};width:${widthExpr};right:auto;`;
                }
                // Abspos inside .cc-day-timeline-canvas only. Explicit height% pins
                // duration 1:1 to the hour grid; columns sit side-by-side on conflicts.
                const eventIdAttr = ev.id != null ? ` data-event-id="${escapeHtml(String(ev.id))}"` : "";
                const colorAttr = color ? ` data-event-color="${escapeHtml(color)}"` : "";
                // Inline hex + !important so theme/CSS cache can't force primary blue.
                const colorInline = color
                    ? `--cc-event-color:${color};border-left:3px solid ${color} !important;background-color:color-mix(in srgb,${color} 40%,var(--bg-light)) !important;box-shadow:inset 0 0 0 1px color-mix(in srgb,${color} 45%,transparent) !important;`
                    : "";
                return `
                    <div class="${classes.join(" ")}" role="button" tabindex="0" aria-label="Edit ${escapeHtml(ev.title || "event")}"${eventIdAttr}${colorAttr} style="position:absolute;${horizStyle}top:${topPct}%;height:${heightPct}%;bottom:auto;max-height:${heightPct}%;min-height:0;margin:0;padding:0;z-index:3;pointer-events:auto;cursor:pointer;overflow:hidden;box-sizing:border-box;${colorInline}" title="${escapeHtml(ev.title || "(No title)")} — click to edit" data-duration-min="${Math.round(durationMin)}" data-start-min="${Math.round(clampedStart)}" data-col="${pack.columnIndex}" data-col-count="${pack.columnCount}">
                        <div class="cc-day-timeline-event-body" style="padding:8px 0.5rem 4px 0.55rem;box-sizing:border-box;min-height:100%;max-height:100%;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-start;pointer-events:none;">
                            <div class="cc-day-timeline-event-head">
                                <span class="cc-day-timeline-event-when">${escapeHtml(whenLabel)}${
                    overflowBefore || overflowAfter ? " · outside 7–6" : ""
                }</span>
                                <span class="cc-day-timeline-event-title">${escapeHtml(ev.title || "(No title)")}</span>
                            </div>
                            ${showDesc ? `<div class="cc-day-timeline-event-desc">${escapeHtml(desc)}</div>` : ""}
                        </div>
                    </div>
                `;
            })
            .join("");

        const stripEvents = [...allDayEvents, ...outsideTimed];
        const allDayHtml = stripEvents.length
            ? `<div class="cc-day-allday">
                ${stripEvents
                    .map((ev) => {
                        const label = ev.allDay ? "All day" : formatCalendarEventTime(ev);
                        return `<div class="cc-day-allday-item"${eventColorStyleAttr(ev)}>
                            <span class="cc-event-bullet" aria-hidden="true"${eventColorStyleAttr(ev, { paintBackground: true })}></span>
                            <span class="cc-day-allday-when">${escapeHtml(label)}</span>
                            <span class="cc-day-allday-title">${escapeHtml(ev.title || "(No title)")}</span>
                        </div>`;
                    })
                    .join("")}
               </div>`
            : "";

        // Plane grid: [labels | rule | track]. Events/hover only in in-flow canvas
        // (canvas-relative abspos — never backdrop/viewport containing block).
        ccMonthDayList.innerHTML = `
            ${allDayHtml}
            <div class="cc-day-timeline" data-day-key="${escapeHtml(dayKey)}">
                <div class="cc-day-timeline-plane">
                    <div class="cc-day-timeline-rail" aria-hidden="true">${hourMarks.join("")}</div>
                    <div class="cc-day-timeline-rule" aria-hidden="true"></div>
                    <div class="cc-day-timeline-track" id="cc-day-timeline-track" role="button" tabindex="0" aria-label="Click an hour to add an event">
                        <div class="cc-day-timeline-canvas">
                            <div class="cc-day-timeline-hover" aria-hidden="true" style="position:absolute;left:var(--cc-day-timeline-event-left,0.25rem);right:var(--cc-day-timeline-event-right,0.7rem);top:0;height:0;margin:0;pointer-events:none;z-index:2"></div>
                            ${eventBlocks || ""}
                            ${
                                !timedEvents.length
                                    ? '<span class="cc-day-timeline-empty-hint">Click a time to add</span>'
                                    : ""
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
        forcePaintEventColors(ccMonthDayList);
    }

    function renderMonthGrid() {
        if (!ccMonthGrid || monthViewYear == null || monthViewMonth == null) return;
        if (ccMonthTitle) {
            ccMonthTitle.textContent = new Date(monthViewYear, monthViewMonth, 1).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
            });
        }

        const firstOfMonth = new Date(monthViewYear, monthViewMonth, 1);
        const startOffset = firstOfMonth.getDay(); // Sun=0
        const gridStart = new Date(monthViewYear, monthViewMonth, 1 - startOffset);
        const todayKey = dayKeyFromDate(new Date());
        const eventsByDay = new Map();
        for (const ev of monthViewEvents) {
            const d = eventLocalDate(ev);
            if (!d) continue;
            const key = dayKeyFromDate(d);
            if (!eventsByDay.has(key)) eventsByDay.set(key, []);
            eventsByDay.get(key).push(ev);
        }

        const cells = [];
        for (let i = 0; i < 42; i++) {
            const cellDate = new Date(gridStart);
            cellDate.setDate(gridStart.getDate() + i);
            const key = dayKeyFromDate(cellDate);
            const inMonth = cellDate.getMonth() === monthViewMonth;
            const dayEvents = eventsByDay.get(key) || [];
            const classes = ["cc-month-cell"];
            if (!inMonth) classes.push("is-outside");
            if (key === todayKey) classes.push("is-today");
            if (key === monthSelectedDayKey) classes.push("is-selected");

            const maxTitles = 3;
            const titleHtml = dayEvents
                .slice(0, maxTitles)
                .map((ev) => {
                    const title = ev.title || "(No title)";
                    return `<div class="cc-month-cell-event" title="${escapeHtml(title)}"${eventColorStyleAttr(ev)}>
                        <span class="cc-event-bullet" aria-hidden="true"${eventColorStyleAttr(ev, { paintBackground: true })}></span>
                        <span class="cc-month-cell-event-title">${escapeHtml(title)}</span>
                    </div>`;
                })
                .join("");
            const moreCount = dayEvents.length - maxTitles;
            const moreHtml =
                moreCount > 0 ? `<div class="cc-month-cell-more">+${moreCount} more</div>` : "";
            const dotsHtml =
                dayEvents.length > 0
                    ? `<div class="cc-month-cell-dots" aria-hidden="true">${dayEvents
                          .slice(0, 4)
                          .map((ev) => `<span class="cc-month-dot"${eventColorStyleAttr(ev, { paintBackground: true })}></span>`)
                          .join("")}</div>`
                    : "";

            cells.push(`
                <button type="button" class="${classes.join(" ")}" data-day-key="${key}" aria-label="${escapeHtml(
                cellDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })
            )}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}` : ""}">
                    <span class="cc-month-cell-day">${cellDate.getDate()}</span>
                    <div class="cc-month-cell-events">${titleHtml}${moreHtml}</div>
                    ${dotsHtml}
                </button>
            `);
        }
        ccMonthGrid.innerHTML = cells.join("");
        forcePaintEventColors(ccMonthGrid);
        renderMonthDayPanel(monthSelectedDayKey);
    }

    async function loadMonthCalendarEvents() {
        if (!ccMonthGrid || monthViewYear == null || monthViewMonth == null) return;
        monthEventsLoading = true;
        ccMonthGrid.innerHTML =
            '<p class="cc-month-day-empty col-span-7 self-center text-center">Loading events...</p>';
        try {
            const { start, end } = monthRangeUnix(monthViewYear, monthViewMonth);
            // Pad a few days either side so adjacent-month cells can show events.
            // Prefetch calendars so hex_color can fill any event missing color.
            const [, data] = await Promise.all([
                ensureNylasCalendars(),
                listCalendarEvents(supabase, {
                    start: start - 7 * 24 * 60 * 60,
                    end: end + 7 * 24 * 60 * 60,
                    limit: 100,
                }),
            ]);
            monthViewEvents = enrichEventsWithCalendarColors(
                Array.isArray(data?.events) ? data.events : [],
                data
            );
            renderMonthGrid();
        } catch (error) {
            console.warn("[command-center] month calendar:", error);
            monthViewEvents = [];
            ccMonthGrid.innerHTML =
                '<p class="cc-month-day-empty col-span-7 self-center text-center">Couldn\'t load month events.</p>';
            showToast(error?.message || "Couldn't load month events.", "warning");
        } finally {
            monthEventsLoading = false;
        }
    }

    function openMonthCalendarModal() {
        if (!calendarIntegrationState?.orgEnabled) return;
        if (!calendarIntegrationState?.connected) {
            promptCalendarConnect();
            return;
        }
        if (!ccMonthBackdrop) return;

        const now = new Date();
        if (monthViewYear == null || monthViewMonth == null) {
            monthViewYear = now.getFullYear();
            monthViewMonth = now.getMonth();
        }
        if (!monthSelectedDayKey) {
            monthSelectedDayKey = dayKeyFromDate(now);
        }
        renderMonthWeekdayRow();
        ccMonthBackdrop.classList.remove("hidden");
        ccMonthBackdrop.setAttribute("aria-hidden", "false");
        ensureNylasCalendars();
        loadMonthCalendarEvents();
    }

    function closeMonthCalendarModal() {
        if (!ccMonthBackdrop) return;
        ccMonthBackdrop.classList.add("hidden");
        ccMonthBackdrop.setAttribute("aria-hidden", "true");
        setMonthDayAddVisible(false);
    }

    function setupCalendarPanelListeners() {
        ccCalendarAddBtn?.addEventListener("click", () => openAddCalendarEventForm());
        ccCalendarMonthBtn?.addEventListener("click", () => openMonthCalendarModal());
        ccMonthCloseBtn?.addEventListener("click", () => closeMonthCalendarModal());
        ccMonthDayAddBtn?.addEventListener("click", () => openAddEventForSelectedDay());
        ccMonthPrevBtn?.addEventListener("click", () => {
            if (monthViewMonth == null || monthViewYear == null || monthEventsLoading) return;
            monthViewMonth -= 1;
            if (monthViewMonth < 0) {
                monthViewMonth = 11;
                monthViewYear -= 1;
            }
            monthSelectedDayKey = `${monthViewYear}-${pad2(monthViewMonth + 1)}-01`;
            loadMonthCalendarEvents();
        });
        ccMonthNextBtn?.addEventListener("click", () => {
            if (monthViewMonth == null || monthViewYear == null || monthEventsLoading) return;
            monthViewMonth += 1;
            if (monthViewMonth > 11) {
                monthViewMonth = 0;
                monthViewYear += 1;
            }
            monthSelectedDayKey = `${monthViewYear}-${pad2(monthViewMonth + 1)}-01`;
            loadMonthCalendarEvents();
        });
        ccMonthGrid?.addEventListener("click", (e) => {
            const cell = e.target.closest(".cc-month-cell");
            if (!cell?.dataset?.dayKey) return;
            monthSelectedDayKey = cell.dataset.dayKey;
            ccMonthGrid.querySelectorAll(".cc-month-cell.is-selected").forEach((el) => {
                el.classList.remove("is-selected");
            });
            cell.classList.add("is-selected");
            renderMonthDayPanel(monthSelectedDayKey);
        });
        const getDayTimelineEls = () => {
            const timeline = ccMonthDayList?.querySelector?.(".cc-day-timeline");
            const plane = timeline?.querySelector?.(".cc-day-timeline-plane") || null;
            const track = timeline?.querySelector?.(".cc-day-timeline-track") || null;
            const canvas = track?.querySelector?.(".cc-day-timeline-canvas") || null;
            return { timeline, plane, track, canvas };
        };
        const pointerInTimeline = (plane, track, clientX, clientY) => {
            // Hit the plane (labels + track) so moving over the scale still updates hover.
            // Prefer plane over outer timeline so padding-block is outside the hit Y range.
            const hitEl = plane || track;
            if (!hitEl) return false;
            const rect = hitEl.getBoundingClientRect();
            return (
                clientX >= rect.left &&
                clientX <= rect.right &&
                clientY >= rect.top &&
                clientY <= rect.bottom
            );
        };
        const timelineEventFromPoint = (clientX, clientY, fallbackTarget) => {
            // Prefer event target; fall back to elementsFromPoint (canvas is none).
            const fromTarget = fallbackTarget?.closest?.(".cc-day-timeline-event");
            if (fromTarget) return fromTarget;
            try {
                const stack = document.elementsFromPoint?.(clientX, clientY) || [];
                for (const el of stack) {
                    const hit = el?.closest?.(".cc-day-timeline-event");
                    if (hit) return hit;
                }
            } catch {
                /* ignore */
            }
            return null;
        };
        const openEditFromTimelineEventEl = (eventEl) => {
            if (!eventEl) return false;
            const ev = findMonthEventById(eventEl.dataset.eventId);
            if (ev) {
                openEditCalendarEventForm(ev);
                return true;
            }
            showToast("Couldn't load that event for editing.", "warning");
            return true;
        };
        const handleTimelineAddClick = (e) => {
            // Clicking an existing event opens edit — do not trigger hover-to-add.
            const eventEl = timelineEventFromPoint(e.clientX, e.clientY, e.target);
            if (eventEl) {
                e.preventDefault();
                e.stopPropagation();
                openEditFromTimelineEventEl(eventEl);
                return;
            }
            const { plane, track } = getDayTimelineEls();
            if (!track) return;
            if (!pointerInTimeline(plane, track, e.clientX, e.clientY)) return;
            const rect = track.getBoundingClientRect();
            if (!rect.height) {
                openAddEventForSelectedDay();
                return;
            }
            openAddEventForSelectedDay(hourStartFromTrackClientY(track, e.clientY));
        };
        const handleTimelinePointerDown = (e) => {
            // Stop create-path handlers before click when the chip is under the pointer.
            const eventEl = timelineEventFromPoint(e.clientX, e.clientY, e.target);
            if (!eventEl) return;
            e.stopPropagation();
        };
        const setTimelineHoverBlock = (track, clientY) => {
            const hoverEl = track?.querySelector?.(".cc-day-timeline-hover");
            if (!hoverEl) return;
            const rect = track.getBoundingClientRect();
            if (!rect.height) return;
            // Canvas-relative abspos (same containing block + % math as events).
            // Visible via .is-active background + hour-band height — never opacity.
            hoverEl.style.position = "absolute";
            hoverEl.style.left = "var(--cc-day-timeline-event-left, 0.25rem)";
            hoverEl.style.right = "var(--cc-day-timeline-event-right, 0.7rem)";
            hoverEl.style.margin = "0";
            hoverEl.style.pointerEvents = "none";
            hoverEl.style.zIndex = "2";
            const hourStart = hourStartFromTrackClientY(track, clientY);
            hoverEl.style.top = `${timelineOffsetRatio(hourStart) * 100}%`;
            hoverEl.style.height = `${(TIMELINE_HOUR_MIN / TIMELINE_SPAN_MIN) * 100}%`;
            hoverEl.classList.add("is-active");
        };
        const clearTimelineHoverBlock = (root = ccMonthDayList) => {
            root?.querySelectorAll?.(".cc-day-timeline-hover").forEach((el) => {
                el.classList.remove("is-active");
                el.style.height = "0%";
                el.style.top = "0%";
            });
        };
        const onTimelinePointerMove = (e) => {
            const { plane, track } = getDayTimelineEls();
            if (!track) {
                clearTimelineHoverBlock();
                return;
            }
            if (!pointerInTimeline(plane, track, e.clientX, e.clientY)) {
                clearTimelineHoverBlock();
                return;
            }
            // Don't paint create-ghost over an existing event chip.
            if (timelineEventFromPoint(e.clientX, e.clientY, e.target)) {
                clearTimelineHoverBlock();
                return;
            }
            setTimelineHoverBlock(track, e.clientY);
        };
        ccMonthDayList?.addEventListener("pointerdown", handleTimelinePointerDown, true);
        ccMonthDayList?.addEventListener("click", handleTimelineAddClick);
        // Bounds-based hit test on the plane (rail is pointer-events: none).
        // pointermove + mousemove: some WebKit paths are flaky on pointer-only.
        ccMonthDayList?.addEventListener("pointermove", onTimelinePointerMove);
        ccMonthDayList?.addEventListener("mousemove", onTimelinePointerMove);
        ccMonthDayList?.addEventListener("pointerleave", () => clearTimelineHoverBlock());
        ccMonthDayList?.addEventListener("mouseleave", () => clearTimelineHoverBlock());
        ccMonthDayList?.addEventListener("keydown", (e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            const eventEl = e.target.closest?.(".cc-day-timeline-event");
            if (eventEl) {
                e.preventDefault();
                e.stopPropagation();
                openEditFromTimelineEventEl(eventEl);
                return;
            }
            if (!e.target.closest?.(".cc-day-timeline-track")) return;
            e.preventDefault();
            openAddEventForSelectedDay(9 * 60);
        });
        ccMonthBackdrop?.addEventListener("click", (e) => {
            if (e.target === ccMonthBackdrop) closeMonthCalendarModal();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key !== "Escape" || !ccMonthBackdrop || ccMonthBackdrop.classList.contains("hidden")) return;
            const sharedModal = document.getElementById("modal-backdrop");
            if (sharedModal && !sharedModal.classList.contains("hidden")) return;
            closeMonthCalendarModal();
        });
    }

    async function loadCalendarPanel() {
        if (!ccCalendarCard && !ccCalendarList) return;
        setCalendarActionsVisible(false);

        try {
            const integrationState = await getIntegrationState(supabase);
            calendarIntegrationState = integrationState;

            // Org integrations OFF → hide whole Upcoming Calendar (pre-calendar layout).
            if (!integrationState.orgEnabled) {
                setCalendarCardVisible(false);
                if (ccCalendarList) ccCalendarList.innerHTML = "";
                return;
            }

            setCalendarCardVisible(true);
            if (!ccCalendarList) return;

            ccCalendarList.innerHTML =
                '<p class="cc-calendar-empty text-sm text-[var(--text-medium)] px-4 py-4">Loading calendar...</p>';
            setCalendarActionsVisible(true);

            if (!integrationState.connected) {
                ccCalendarList.innerHTML =
                    '<p class="cc-calendar-empty text-sm text-[var(--text-medium)] px-4 py-4">Connect Google or Outlook in <a href="ai-admin.html?tab=integrations" class="cc-calendar-settings-link">User Settings</a> to see upcoming events.</p>';
                return;
            }

            const nowSec = Math.floor(Date.now() / 1000);
            const [, data] = await Promise.all([
                ensureNylasCalendars(),
                listCalendarEvents(supabase, {
                    start: nowSec,
                    end: nowSec + 7 * 24 * 60 * 60,
                    limit: 15,
                }),
            ]);
            const events = enrichEventsWithCalendarColors(
                Array.isArray(data?.events) ? data.events : [],
                data
            );

            if (!events.length) {
                ccCalendarList.innerHTML =
                    '<p class="cc-calendar-empty text-sm text-[var(--text-medium)] px-4 py-4">No upcoming events</p>';
                return;
            }

            renderGroupedCalendarList(ccCalendarList, events);
        } catch (error) {
            console.warn("[command-center] calendar panel:", error);
            // Only surface the card on error when org integrations are known-on.
            if (calendarIntegrationState?.orgEnabled) {
                setCalendarCardVisible(true);
                if (ccCalendarList) {
                    ccCalendarList.innerHTML =
                        '<p class="cc-calendar-empty text-sm text-[var(--text-medium)] px-4 py-4">Couldn\'t load calendar events right now.</p>';
                }
            } else {
                setCalendarCardVisible(false);
            }
            if (typeof showToast === "function") {
                showToast(error?.message || "Couldn't load calendar events.", "warning");
            }
        }
    }

    // --- DATA FETCHING ---
    async function loadAllData() {
        const appState = getState();
        if (!appState.currentUser?.id) return;

        if (myTasksList) myTasksList.innerHTML = '<p class="my-tasks-empty text-sm text-[var(--text-medium)] px-4 py-6">Loading tasks...</p>';
        
        const tableMap = {
            "contacts": "contacts", "accounts": "accounts", "sequences": "sequences",
            "activities": "activities", "contact_sequences": "contact_sequences",
            "deals": "deals", "tasks": "tasks", "cognito_alerts": "cognitoAlerts"
        };
        const userSpecificTables = Object.keys(tableMap);
        const publicTables = ["sequence_steps"];

        // Command center always shows only the current (or effective) user's data, never all users
        const userId = appState.effectiveUserId || appState.currentUser.id;
        const userPromises = userSpecificTables.map(table => supabase.from(table).select("*").eq("user_id", userId));

        const publicPromises = publicTables.map(table => supabase.from(table).select("*"));
        const allPromises = [...userPromises, ...publicPromises];
        const allTableNames = [...userSpecificTables, ...publicTables];

        try {
            const results = await Promise.allSettled(allPromises);
            results.forEach((result, index) => {
                const tableName = allTableNames[index];
                const stateKey = tableMap[tableName] || tableName;
                if (result.status === "fulfilled" && result.value && !result.value.error) {
                    state[stateKey] = result.value.data || [];
                } else {
                    console.error(`Error fetching ${tableName}:`, result.status === 'fulfilled' ? (result.value ? result.value.error.message : 'Unknown error') : result.reason);
                }
            });
            state.deals = filterOutOwnershipOrphanedCrmRows(state.deals, state.accounts, state.contacts);
            state.activities = filterOutOwnershipOrphanedCrmRows(state.activities, state.accounts, state.contacts);
            state.tasks = filterOutOwnershipOrphanedCrmRows(state.tasks, state.accounts, state.contacts);
        } catch (error) {
            console.error("Critical error in loadAllData:", error);
        } finally {
            hideGlobalLoader();
        }
        
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const activeAccountIds = new Set(
            state.activities
            .filter(act => act.date && new Date(act.date) > sixtyDaysAgo)
            .map(act => {
                if (act.account_id) return act.account_id;
                const contact = state.contacts.find(c => c.id === act.contact_id);
                return contact ? contact.account_id : null;
            })
            .filter(id => id)
        );
        state.nurtureAccounts = state.accounts.filter(account => !activeAccountIds.has(account.id));
        
        renderDashboard();
        populateQuickAddSelect();
    }

    function populateQuickAddSelect() {
        const contactSelect = document.getElementById('quick-add-contact');
        const accountSelect = document.getElementById('quick-add-account');
        if (!contactSelect || !accountSelect) return;
        const sortedContacts = [...state.contacts].sort((a, b) => {
            const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
            const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
            return nameA.localeCompare(nameB);
        });
        const sortedAccounts = [...state.accounts].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        const contactsOptions = sortedContacts.map(c => `<option value="${c.id}">${c.first_name} ${c.last_name}</option>`).join('');
        const accountsOptions = sortedAccounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        contactSelect.innerHTML = `<option value="">Link to Contact</option>${contactsOptions}`;
        accountSelect.innerHTML = `<option value="">Link to Account</option>${accountsOptions}`;
    }
        
    // --- Core Logic ---
    async function completeStep(csId, processedDescription = null) {
        const appState = getState();
        const cs = state.contact_sequences.find((c) => c.id === csId);
        if (!cs) return;

        const contact = state.contacts.find((c) => c.id === cs.contact_id);
        const currentStepInfo = state.sequence_steps.find(s => s.sequence_id === cs.sequence_id && s.step_number === cs.current_step_number);
        
        if (contact && currentStepInfo) {
            const { error: updateStepError } = await supabase
                .from('contact_sequence_steps')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('contact_sequence_id', cs.id)
                .eq('sequence_step_id', currentStepInfo.id);

            if (updateStepError) {
                console.error("Error updating contact_sequence_step:", updateStepError);
                alert("Could not update the specific task step. Please check the console for errors.");
                return;
            }
            
            const account = contact.account_id ? state.accounts.find(a => a.id === contact.account_id) : null;
            const rawDescription = currentStepInfo.subject || currentStepInfo.message || "Completed step";
            const finalDescription = replacePlaceholders(rawDescription, contact, account);
            const descriptionForLog = processedDescription || finalDescription;

            await supabase.from("activities").insert([{
                contact_id: contact.id,
                account_id: contact.account_id,
                date: new Date().toISOString(),
                type: `Sequence: ${currentStepInfo.type}`,
                description: descriptionForLog,
                user_id: appState.currentUser.id
            }]);
        }
        
        const allStepsInSequence = state.sequence_steps
            .filter(s => s.sequence_id === cs.sequence_id)
            .sort((a, b) => a.step_number - b.step_number);
        
        const nextStep = allStepsInSequence.find(s => s.step_number > cs.current_step_number);
        
        if (nextStep) {
            await supabase.from("contact_sequences").update({
                current_step_number: nextStep.step_number,
                last_completed_date: new Date().toISOString(),
                next_step_due_date: addDays(new Date(), nextStep.delay_days).toISOString()
            }).eq("id", cs.id);
        } else {
            await supabase.from("contact_sequences").update({ status: "Completed" }).eq("id", cs.id);
        }
        
        await loadAllData();
    }

    // --- AI Briefing Logic ---
    async function handleGenerateBriefing() {
        aiBriefingContainer.classList.remove('hidden');
        aiBriefingContainer.innerHTML = `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">Generating your daily briefing...</p>`;

        try {
            const briefingPayload = {
                tasks: state.tasks.filter(t => t.status === 'Pending'),
                sequenceSteps: state.contact_sequences.filter(cs => {
                    if (!cs.next_step_due_date || cs.status !== "Active") return false;
                    const dueDate = new Date(cs.next_step_due_date);
                    const startOfToday = new Date();
                    startOfToday.setHours(0, 0, 0, 0);
                    return dueDate.setHours(0, 0, 0, 0) <= startOfToday.getTime();
                }),
                deals: state.deals,
                cognitoAlerts: state.cognitoAlerts,
                nurtureAccounts: state.nurtureAccounts,
                activities: state.activities,
                contacts: state.contacts,
                accounts: state.accounts,
                sequences: state.sequences,
                sequence_steps: state.sequence_steps
            };
            const requestBody = { briefingPayload };
            const briefing = await callAiApi(supabase, 'get-daily-briefing', requestBody);
            renderAIBriefing(briefing);
            const appState = getState();
            const userId = appState.currentUser?.id;
            if (userId) {
                await mountAIFeedback(document.getElementById('daily-briefing-feedback-slot'), supabase, {
                    userId,
                    prompt: buildAIPromptRecord('get-daily-briefing', requestBody),
                    response: JSON.stringify(briefing, null, 2),
                    label: 'Was this daily briefing useful?',
                    functionId: AI_FUNCTION_IDS.DAILY_BRIEFING
                });
            }
        } catch (error) {
            console.error("Error generating AI briefing:", error);
            aiBriefingContainer.innerHTML = `<p class="error-text">Could not generate briefing. Please try again later.</p>`;
        }
    }
        
    function renderAIBriefing(briefing) {
        const cardsHtml = briefing.priorities.map(item => `
            <div class="ai-briefing-priority-card">
                <div class="priority-title">${item.title}</div>
                <div class="priority-reason">${item.reason}</div>
            </div>
        `).join('');
        aiBriefingContainer.innerHTML = `${cardsHtml || '<p class="text-xs text-[var(--text-medium)]">No priorities for today.</p>'}<div id="daily-briefing-feedback-slot"></div>`;
        aiBriefingContainer.classList.remove('hidden');
        sessionStorage.setItem('crm-briefing-generated', 'true');
        sessionStorage.setItem('crm-briefing-html', aiBriefingContainer.innerHTML);
    }

    function buildAIPromptRecord(functionId, payload) {
        return JSON.stringify({
            function_id: functionId,
            captured_at: new Date().toISOString(),
            payload
        }, null, 2);
    }

    // --- Sequence Steps View Mode ---
    let sequenceViewMode = 'due';

    // --- Render Function ---
    function renderDashboard() {
        if (!myTasksList || !sequenceStepsList || !recentActivitiesList) return;
        myTasksList.innerHTML = "";
        sequenceStepsList.innerHTML = "";
        recentActivitiesList.innerHTML = "";

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const salesSequenceTasks = [];
        const upcomingSalesTasks = [];
        
        const appState = getState();

        for (const cs of state.contact_sequences) {
            if (cs.status !== 'Active' || !cs.current_step_number) continue;
            const effectiveId = appState.effectiveUserId || appState.currentUser?.id;
            if (cs.user_id !== effectiveId) continue;

            const currentStep = state.sequence_steps.find(
                s => s.sequence_id === cs.sequence_id && s.step_number === cs.current_step_number
            );
            
            let shouldShowTask = false;
            if (currentStep) {
                const assignedTo = currentStep.assigned_to || 'Sales';
                if (assignedTo === 'Marketing') continue;
                // Show both Sales and Sales Manager steps (most default to Sales)
                shouldShowTask = assignedTo === 'Sales' || assignedTo === 'Sales Manager';
            }

            if (shouldShowTask) {
                const contact = state.contacts.find(c => c.id === cs.contact_id);
                const sequence = state.sequences.find(s => s.id === cs.sequence_id);
                if (contact && sequence) {
                    const taskObject = {
                        ...cs,
                        contact: contact,
                        account: contact.account_id ? state.accounts.find(a => a.id === contact.account_id) : null,
                        sequence: sequence,
                        step: currentStep
                    };
                    
                    if (cs.next_step_due_date && new Date(cs.next_step_due_date).setHours(0,0,0,0) <= startOfToday.getTime()) {
                        salesSequenceTasks.push(taskObject);
                    } else {
                        upcomingSalesTasks.push(taskObject);
                    }
                }
            }
        }
        
        const pendingTasks = state.tasks.filter(task => task.status === 'Pending').sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        if (pendingTasks.length > 0) {
            pendingTasks.forEach(task => {
                const taskDueDate = task.due_date ? new Date(task.due_date) : null;
                const isPastDue = taskDueDate && taskDueDate.setHours(0, 0, 0, 0) < startOfToday.getTime();
                let linkedEntity = 'N/A';
                if (task.contact_id) {
                    const contact = state.contacts.find(c => c.id === task.contact_id);
                    if (contact) linkedEntity = `<a href="contacts.html?contactId=${contact.id}" class="contact-name-link">${contact.first_name} ${contact.last_name}</a> (Contact)`;
                } else if (task.account_id) {
                    const account = state.accounts.find(a => a.id === task.account_id);
                    if (account) linkedEntity = `<a href="accounts.html?accountId=${account.id}" class="contact-name-link">${account.name}</a> (Account)`;
                }
                const actionsHtml = `
                    <button class="btn-primary btn-icon-only mark-task-complete-btn" data-task-id="${task.id}" title="Complete"><i class="fa-solid fa-square-check"></i></button>
                    <button class="btn-secondary btn-icon-only edit-task-btn" data-task-id="${task.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-danger btn-icon-only delete-task-btn" data-task-id="${task.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                `;
                const item = document.createElement("div");
                item.className = `task-item ${isPastDue ? 'past-due' : ''}`;
                item.innerHTML = `
                    <div class="task-left">
                        <div class="task-due">${formatSimpleDate(task.due_date)}</div>
                    </div>
                    <div class="task-content">
                        <div class="task-linked">${linkedEntity}</div>
                        <div class="task-description">${task.description}</div>
                    </div>
                    <div class="task-actions">${actionsHtml}</div>
                `;
                myTasksList.appendChild(item);
            });
        } else {
            myTasksList.innerHTML = '<p class="my-tasks-empty text-sm text-[var(--text-medium)] px-4 py-6">No pending tasks. Great job!</p>';
        }

        const myTasksCard = document.getElementById('my-tasks-card');
        const hamburgerBtn = document.getElementById('my-tasks-hamburger');
        if (myTasksCard && hamburgerBtn) {
            const taskCount = pendingTasks.length;
            const TASK_THRESHOLD = 3;
            if (taskCount > TASK_THRESHOLD) {
                myTasksCard.classList.add('quick-add-hidden');
            } else {
                myTasksCard.classList.remove('quick-add-hidden', 'hamburger-expanded');
                const icon = hamburgerBtn.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-plus';
                hamburgerBtn.setAttribute('title', 'Add task');
                hamburgerBtn.setAttribute('aria-label', 'Add task');
            }
        }

        salesSequenceTasks.sort((a, b) => new Date(a.next_step_due_date) - new Date(b.next_step_due_date));
        upcomingSalesTasks.sort((a, b) => new Date(a.next_step_due_date) - new Date(b.next_step_due_date));

        function renderSequenceStepsList() {
            sequenceStepsList.innerHTML = "";
            const tasks = sequenceViewMode === 'due' ? salesSequenceTasks : upcomingSalesTasks;

            if (tasks.length > 0) {
                tasks.forEach(task => {
                    const dueDate = new Date(task.next_step_due_date);
                    const isPastDue = sequenceViewMode === 'due' && dueDate < startOfToday;
                    const contactName = `${task.contact.first_name || ''} ${task.contact.last_name || ''}`.trim();
                    const description = task.step.subject || task.step.message || '';

                    const stepType = (task.step.type || '').toLowerCase();
                    const getStepIcon = () => {
                        if (stepType.includes('linkedin')) return { icon: 'fa-paper-plane', title: 'Go to LinkedIn' };
                        if (stepType.includes('email')) return { icon: 'fa-envelope', title: 'Send Email' };
                        if (stepType.includes('call')) return { icon: 'fa-phone', title: 'Complete' };
                        if (stepType.includes('gift')) return { icon: 'fa-gift', title: 'Complete' };
                        return { icon: 'fa-square-check', title: 'Complete' };
                    };
                    let btnHtml;
                    if (sequenceViewMode === 'due') {
                        const { icon, title } = getStepIcon();
                        if (stepType.includes('linkedin')) {
                            btnHtml = `<button class="btn-primary btn-icon-only send-linkedin-message-btn" data-cs-id="${task.id}" title="${title}"><i class="fa-solid ${icon}"></i></button>`;
                        } else if (stepType.includes('email') && task.contact.email) {
                            btnHtml = `<button class="btn-primary btn-icon-only send-email-btn" data-cs-id="${task.id}" title="${title}"><i class="fa-solid ${icon}"></i></button>`;
                        } else if (stepType.includes('call')) {
                            btnHtml = `<button class="btn-primary btn-icon-only log-call-btn" data-cs-id="${task.id}" title="Log a call"><i class="fa-solid ${icon}"></i></button>`;
                        } else {
                            btnHtml = `<button class="btn-primary btn-icon-only complete-step-btn" data-cs-id="${task.id}" title="${title}"><i class="fa-solid ${icon}"></i></button>`;
                        }
                    } else {
                        btnHtml = `<button class="btn-secondary btn-icon-only revisit-step-btn" data-cs-id="${task.id}" title="Revisit Last Step"><i class="fa-solid fa-rotate-left"></i></button>`;
                    }

                    const item = document.createElement("div");
                    item.className = `sequence-step-item ${isPastDue ? 'past-due' : ''}`;
                    item.innerHTML = `
                        <div class="sequence-step-left">
                            <div class="sequence-step-due">${formatSimpleDate(task.next_step_due_date)}</div>
                            <div class="sequence-step-actions">${btnHtml}</div>
                        </div>
                        <div class="sequence-step-content">
                            <div class="sequence-step-meta">${contactName} · ${task.step.type}</div>
                            <div class="sequence-step-description">${description}</div>
                            <div class="sequence-step-sequence">${task.sequence.name}</div>
                        </div>
                    `;
                    sequenceStepsList.appendChild(item);
                });
            } else {
                const emptyMsg = sequenceViewMode === 'due' ? 'No sequence steps due today.' : 'No upcoming sequence steps.';
                sequenceStepsList.innerHTML = `<p class="sequence-steps-empty text-sm text-[var(--text-medium)] px-4 py-6">${emptyMsg}</p>`;
            }
        }

        renderSequenceStepsList();

        const sortedActivities = state.activities
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 20);
        if (sortedActivities.length === 0) {
            recentActivitiesList.innerHTML = '<p class="recent-activities-empty text-sm text-[var(--text-medium)] px-4 py-6">No recent activities yet.</p>';
        } else {
            sortedActivities.forEach(act => {
                const contact = state.contacts.find(c => c.id === act.contact_id);
                const account = contact ? state.accounts.find(a => a.id === contact.account_id) : null;
                const accountName = account ? account.name : "N/A";
                const contactName = contact ? `${contact.first_name} ${contact.last_name}` : "N/A";
                const meta = `${accountName} · ${contactName}`;
                const typeLower = act.type.toLowerCase();
                let iconClass = "icon-default", icon = "fa-circle-info", iconPrefix;
                if (typeLower.includes("cognito") || typeLower.includes("intelligence")) { icon = "fa-magnifying-glass"; }
                else if (typeLower.includes("email")) { iconClass = "icon-email"; icon = "fa-envelope"; }
                else if (typeLower.includes("call")) { iconClass = "icon-call"; icon = "fa-phone"; }
                else if (typeLower.includes("meeting")) { iconClass = "icon-meeting"; icon = "fa-video"; }
                else if (typeLower.includes("linkedin")) { iconClass = "icon-linkedin"; icon = "fa-linkedin-in"; iconPrefix = "fa-brands"; }
                const item = document.createElement("div");
                item.className = "recent-activity-item";
                const logSfBtnHtml = act.logged_to_sf ? '' : `<button type="button" class="btn-log-sf" data-activity-id="${act.id}" title="Log to Salesforce"><i class="fa-brands fa-salesforce"></i> Log to SF</button>`;
                item.innerHTML = `
                    <div class="activity-icon-wrap ${iconClass}"><i class="${iconPrefix || "fas"} ${icon}"></i></div>
                    <div class="activity-body">
                        <div class="activity-meta">${meta}</div>
                        <div class="activity-description">${act.type}: ${act.description}</div>
                        <div class="activity-date">${formatDate(act.date)}</div>
                    </div>
                    <div class="activity-actions">${logSfBtnHtml}</div>
                `;
                recentActivitiesList.appendChild(item);
            });
        }
        if (typeof refreshHUDNodes === 'function') refreshHUDNodes();
    }

    function getActivityIconInfo(act) {
        const typeLower = (act.type || '').toLowerCase();
        if (typeLower.includes("cognito") || typeLower.includes("intelligence")) return { iconClass: "icon-default", icon: "fa-magnifying-glass", iconPrefix: "fas" };
        if (typeLower.includes("email")) return { iconClass: "icon-email", icon: "fa-envelope", iconPrefix: "fas" };
        if (typeLower.includes("call")) return { iconClass: "icon-call", icon: "fa-phone", iconPrefix: "fas" };
        if (typeLower.includes("meeting")) return { iconClass: "icon-meeting", icon: "fa-video", iconPrefix: "fas" };
        if (typeLower.includes("linkedin")) return { iconClass: "icon-linkedin", icon: "fa-linkedin-in", iconPrefix: "fa-brands" };
        return { iconClass: "icon-default", icon: "fa-circle-info", iconPrefix: "fas" };
    }

    function openLogCallModal(task) {
        const contact = task.contact;
        const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
        const phone = (contact.phone || '').trim();
        const telHref = phone ? `tel:${phone.replace(/\D/g, '')}` : '';
        const phoneDisplay = phone || 'No phone number';
        const phoneHtml = telHref
            ? `<a href="${telHref}" class="log-call-phone-link">${phoneDisplay}</a>`
            : `<span class="text-[var(--text-medium)]">${phoneDisplay}</span>`;

        const contactActivities = state.activities
            .filter(a => a.contact_id === contact.id)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 15);
        let activitiesHtml = '';
        contactActivities.forEach(act => {
            const account = act.account_id ? state.accounts.find(a => a.id === act.account_id) : null;
            const meta = account ? account.name : 'N/A';
            const { iconClass, icon, iconPrefix } = getActivityIconInfo(act);
            activitiesHtml += `
                <div class="recent-activity-item">
                    <div class="activity-icon-wrap ${iconClass}"><i class="${iconPrefix} ${icon}"></i></div>
                    <div class="activity-body">
                        <div class="activity-meta">${meta}</div>
                        <div class="activity-description">${act.type}: ${(act.description || '').replace(/</g, '&lt;')}</div>
                        <div class="activity-date">${formatDate(act.date)}</div>
                    </div>
                </div>`;
        });
        if (!activitiesHtml) activitiesHtml = '<p class="text-sm text-[var(--text-medium)] py-2">No recent activities for this contact.</p>';

        const bodyHtml = `
            <div class="log-call-modal-body">
                <p class="mb-3"><strong>${contactName.replace(/</g, '&lt;')}</strong></p>
                <p class="mb-3">${phoneHtml}</p>
                <label class="block text-sm font-medium mb-1">Call notes (optional)</label>
                <textarea id="modal-call-notes" class="w-full rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm bg-[var(--bg-light)] min-h-[80px] mb-3" placeholder="Notes from the call..."></textarea>
                <div class="log-call-recent-activities">
                    <div class="text-xs font-semibold text-[var(--text-medium)] mb-2">Recent activities</div>
                    <div class="log-call-activities-list max-h-[200px] overflow-y-auto space-y-2">${activitiesHtml}</div>
                </div>
            </div>`;

        showModal('Log a call', bodyHtml, async () => {
            const notes = (document.getElementById('modal-call-notes')?.value || '').trim();
            const description = notes || 'Call completed';
            await completeStep(task.id, description);
        }, true, `<button id="modal-confirm-btn" class="btn-primary">Log</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`, null, { closeOnBackdropClick: false, closeOnEscape: false });
    }

    // --- EVENT LISTENER SETUP ---
    function setupPageEventListeners() {
        setupModalListeners();
        setupCalendarPanelListeners();

        if (recentActivitiesList) {
            recentActivitiesList.addEventListener('click', async (e) => {
                const btn = e.target.closest('.btn-log-sf');
                if (!btn) return;
                const id = btn.getAttribute('data-activity-id');
                if (!id) return;
                const act = state.activities.find(a => String(a.id) === String(id));
                if (act) {
                    const account = act.account_id ? state.accounts.find(a => a.id === act.account_id) : null;
                    logToSalesforce({ subject: act.description, notes: act.description, type: act.type, created_at: act.date, sf_account_locator: account?.sf_account_locator });
                    showActionSuccessConfirm({
                        title: 'Log to Salesforce',
                        message: 'A new Salesforce task tab should have opened. Were you able to log the activity successfully?',
                        yesLabel: 'Yes, log complete',
                        noLabel: 'No, not yet',
                        onYes: async () => {
                            const { error } = await supabase.from('activities').update({ logged_to_sf: true }).eq('id', act.id);
                            if (!error) {
                                act.logged_to_sf = true;
                                btn.style.display = 'none';
                            }
                        },
                        onNo: () => {}
                    });
                }
            });
        }

        if (aiBriefingRefreshBtn) {
            aiBriefingRefreshBtn.addEventListener('click', handleGenerateBriefing);
        }

        if (sequenceToggleDue && sequenceToggleUpcoming) {
            sequenceToggleDue.addEventListener('click', () => {
                if (sequenceViewMode === 'due') return;
                sequenceViewMode = 'due';
                sequenceToggleDue.classList.add('active');
                sequenceToggleUpcoming.classList.remove('active');
                renderDashboard();
            });
            sequenceToggleUpcoming.addEventListener('click', () => {
                if (sequenceViewMode === 'upcoming') return;
                sequenceViewMode = 'upcoming';
                sequenceToggleUpcoming.classList.add('active');
                sequenceToggleDue.classList.remove('active');
                renderDashboard();
            });
        }
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                sessionStorage.removeItem('crm-briefing-generated');
                sessionStorage.removeItem('crm-briefing-html');
                await supabase.auth.signOut();
                window.location.href = "index.html";
            });
        }
        if (myTasksHamburger) {
            myTasksHamburger.addEventListener('click', () => {
                const card = document.getElementById('my-tasks-card');
                if (!card) return;
                const isExpanded = card.classList.toggle('hamburger-expanded');
                const icon = myTasksHamburger.querySelector('i');
                if (icon) {
                    icon.className = isExpanded ? 'fa-solid fa-times' : 'fa-solid fa-plus';
                }
                myTasksHamburger.setAttribute('title', isExpanded ? 'Close' : 'Add task');
                myTasksHamburger.setAttribute('aria-label', isExpanded ? 'Close' : 'Add task');
            });
        }
        const quickAddForm = document.getElementById('quick-add-task-form');
        if (quickAddForm) {
            quickAddForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const appState = getState();
                const description = document.getElementById('quick-add-description').value.trim();
                const dueDate = document.getElementById('quick-add-due-date').value;
                const contactId = document.getElementById('quick-add-contact').value;
                const accountId = document.getElementById('quick-add-account').value;
                if (!description) { alert('Description is required.'); return; }
                const taskData = { description, due_date: dueDate || null, user_id: appState.currentUser.id, status: 'Pending' };
                if (contactId) taskData.contact_id = Number(contactId);
                if (accountId) taskData.account_id = Number(accountId);
                const { error } = await supabase.from('tasks').insert(taskData);
                if (error) { alert('Error adding task: ' + error.message); }
                else {
                    quickAddForm.reset();
                    await loadAllData();
                }
            });
        }
        document.body.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            if (button.matches('.mark-task-complete-btn')) {
                const taskId = button.dataset.taskId;
                showModal('Confirm Completion', 'Mark this task as completed?', async () => {
                    await supabase.from('tasks').update({ status: 'Completed' }).eq('id', taskId);
                    await loadAllData();
                });
            } else if (button.matches('.delete-task-btn')) {
                const taskId = button.dataset.taskId;
                showModal('Confirm Deletion', 'Are you sure you want to delete this task?', async () => {
                    await supabase.from('tasks').delete().eq('id', taskId);
                    await loadAllData();
                });
            } else if (button.matches('.edit-task-btn')) {
                const taskId = button.dataset.taskId;
                const task = state.tasks.find(t => t.id == taskId);
                if (!task) { alert('Task not found.'); return; }
                const contactsOptions = state.contacts.map(c => `<option value="c-${c.id}" ${c.id === task.contact_id ? 'selected' : ''}>${c.first_name} ${c.last_name} (Contact)</option>`).join('');
                const accountsOptions = state.accounts.map(a => `<option value="a-${a.id}" ${a.id === task.account_id ? 'selected' : ''}>${a.name} (Account)</option>`).join('');
                showModal('Edit Task', `
                    <label>Description:</label><input type="text" id="modal-task-description" value="${task.description}" required>
                    <label>Due Date:</label><input type="date" id="modal-task-due-date" value="${task.due_date ? new Date(task.due_date).toISOString().substring(0, 10) : ''}">
                    <label>Link To:</label>
                    <select id="modal-task-linked-entity">
                        <option value="">-- None --</option>
                        <optgroup label="Contacts">${contactsOptions}</optgroup>
                        <optgroup label="Accounts">${accountsOptions}</optgroup>
                    </select>
                `, async () => {
                    const newDescription = document.getElementById('modal-task-description').value.trim();
                    const newDueDate = document.getElementById('modal-task-due-date').value;
                    const linkedEntityValue = document.getElementById('modal-task-linked-entity').value;
                    if (!newDescription) { alert('Task description is required.'); return; }
                    const updateData = { description: newDescription, due_date: newDueDate || null, contact_id: null, account_id: null };
                    if (linkedEntityValue.startsWith('c-')) { updateData.contact_id = Number(linkedEntityValue.substring(2)); }
                    else if (linkedEntityValue.startsWith('a-')) { updateData.account_id = Number(linkedEntityValue.substring(2)); }
                    await supabase.from('tasks').update(updateData).eq('id', taskId);
                    await loadAllData();
                });
            } else if (button.matches('.log-call-btn')) {
                const csId = Number(button.dataset.csId);
                const cs = state.contact_sequences.find(c => c.id === csId);
                if (!cs) return alert("Contact sequence not found.");
                const contact = state.contacts.find(c => c.id === cs.contact_id);
                if (!contact) return alert("Contact not found.");
                const sequence = state.sequences.find(s => s.id === cs.sequence_id);
                const currentStep = state.sequence_steps.find(s => s.sequence_id === cs.sequence_id && s.step_number === cs.current_step_number);
                if (!sequence || !currentStep) return alert("Sequence step not found.");
                const task = { id: cs.id, contact, sequence, step: currentStep };
                openLogCallModal(task);
            } else if (button.matches('.send-email-btn')) {
                const csId = Number(button.dataset.csId);
                const cs = state.contact_sequences.find(c => c.id === csId);
                if (!cs) return alert("Contact sequence not found.");
                const contact = state.contacts.find(c => c.id === cs.contact_id);
                if (!contact) return alert("Contact not found.");
                const account = contact.account_id ? state.accounts.find(a => a.id === contact.account_id) : null;
                const step = state.sequence_steps.find(s => s.sequence_id === cs.sequence_id && s.step_number === cs.current_step_number);
                if (!step) return alert("Sequence step not found.");
                const subject = replacePlaceholders(step.subject, contact, account);
                const message = replacePlaceholders(step.message, contact, account);
                const integrationState = await getIntegrationState(supabase);
                const confirmLabel = emailActionLabel(integrationState);
                showModal('Compose Email', `
                    <div class="form-group">
                        <label for="modal-email-subject">Subject:</label>
                        <input type="text" id="modal-email-subject" class="form-control" value="${subject.replace(/"/g, '&quot;')}">
                    </div>
                    <div class="form-group">
                        <label for="modal-email-body">Message:</label>
                        <textarea id="modal-email-body" class="form-control" rows="10">${message}</textarea>
                    </div>
                `, async () => {
                    const finalSubject = document.getElementById('modal-email-subject').value;
                    const finalMessage = document.getElementById('modal-email-body').value;
                    const result = await sendEmail(
                        supabase,
                        { to: contact.email, subject: finalSubject, body: finalMessage },
                        { onNotice: (msg, type) => showToast(msg, type) }
                    );
                    if (result?.mode === 'nylas') {
                        await completeStep(csId, `Email Sent: ${finalSubject}`);
                        hideModal();
                        return true;
                    }
                    showActionSuccessConfirm({
                        title: 'Email sent?',
                        message: 'Did your email client open and were you able to send the message successfully?',
                        onYes: async () => {
                            await completeStep(csId, `Email Sent: ${finalSubject}`);
                            hideModal();
                        },
                        onNo: () => {}
                    });
                    return false;
                },
                true,
                `<button id="modal-confirm-btn" class="btn-primary">${confirmLabel}</button>
                 <button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`,
                null,
                { closeOnBackdropClick: false, closeOnEscape: false }
                );
            } else if (button.matches('.send-linkedin-message-btn')) {
                const csId = Number(button.dataset.csId);
                const cs = state.contact_sequences.find(c => c.id === csId);
                if (!cs) return alert("Contact sequence not found.");

                const contact = state.contacts.find(c => c.id === cs.contact_id);
                if (!contact) return alert("Contact not found.");

                const account = contact.account_id ? state.accounts.find(a => a.id === contact.account_id) : null;
                const step = state.sequence_steps.find(s => s.sequence_id === cs.sequence_id && s.step_number === cs.current_step_number);
                if (!step) return alert("Sequence step not found.");

                const message = replacePlaceholders(step.message, contact, account);
                const linkedinUrl = contact.linkedin_profile_url || 'https://www.linkedin.com/feed/';

                showModal('Compose LinkedIn Message', `
                    <div class="form-group">
                        <p><strong>To:</strong> ${contact.first_name} ${contact.last_name}</p>
                        <p class="modal-sub-text">The message below will be copied to your clipboard. Paste it into the message box on LinkedIn.</p>
                    </div>
                    <div class="form-group">
                        <label for="modal-linkedin-body">Message:</label>
                        <textarea id="modal-linkedin-body" class="form-control" rows="10">${message}</textarea>
                    </div>
                `, async () => {
                    const finalMessage = document.getElementById('modal-linkedin-body').value;
                    try {
                        await navigator.clipboard.writeText(finalMessage);
                    } catch (err) {
                        console.error('Failed to copy text: ', err);
                        alert('Could not copy text to clipboard. Please copy it manually.');
                    }
                    window.open(linkedinUrl, "_blank");
                    showActionSuccessConfirm({
                        title: 'LinkedIn message',
                        message: 'Were you able to paste the message and send it on LinkedIn successfully?',
                        onYes: async () => {
                            await completeStep(csId, "LinkedIn Message Sent");
                            hideModal();
                        },
                        onNo: () => {}
                    });
                    return false;
                },
                true,
                `<button id="modal-confirm-btn" class="btn-primary">Copy Text & Open LinkedIn</button>
                 <button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`,
                null,
                { closeOnBackdropClick: false, closeOnEscape: false }
                );
            } else if (button.matches('.complete-step-btn')) {
                const csId = Number(button.dataset.csId);
                completeStep(csId);
            } else if (button.matches('.revisit-step-btn')) {
                const csId = Number(button.dataset.csId);
                const contactSequence = state.contact_sequences.find(cs => cs.id === csId);
                if (!contactSequence) return;
                
                const allStepsInSequence = state.sequence_steps
                    .filter(s => s.sequence_id === contactSequence.sequence_id)
                    .sort((a,b) => a.step_number - b.step_number);

                const currentStepIndex = allStepsInSequence.findIndex(s => s.step_number === contactSequence.current_step_number);
                
                if (currentStepIndex > 0) {
                    const previousStep = allStepsInSequence[currentStepIndex - 1];
                    showModal('Revisit Step', `Are you sure you want to go back to step ${previousStep.step_number}?`, async () => {
                        await supabase.from('contact_sequences').update({ current_step_number: previousStep.step_number, next_step_due_date: getStartOfLocalDayISO(), status: 'Active' }).eq('id', csId);
                        await loadAllData();
                    });
                } else {
                    alert("This is already the first step.");
                }
            }
        });
    }

// --- App Initialization (UPDATED) ---
    async function initializePage() {
        await loadSVGs();
        updateActiveNavLink();
        
        // Use the new global state initializer from shared_constants.js
        const appState = await initializeAppState(supabase);
        
        if (appState.currentUser) {
            // Pass the whole appState object to setup the user menu
            await setupUserMenuAndAuth(supabase, appState, { skipImpersonation: true }); 
            
            // Setup other shared features
            await setupGlobalSearch(supabase);
            await checkAndSetNotifications(supabase);
            
            // Initial data load for the effective user (which is the current user by default)
            await loadAllData();
            // Calendar panel is independent of CRM tables; soft-fail if integrations unavailable
            loadCalendarPanel();
            
            // Setup event listeners (including Refresh button)
            setupPageEventListeners();

            // Auto-run briefing once per login (session)
            if (!sessionStorage.getItem('crm-briefing-generated')) {
                handleGenerateBriefing();
            } else {
                const savedHtml = sessionStorage.getItem('crm-briefing-html');
                if (savedHtml) {
                    aiBriefingContainer.innerHTML = savedHtml;
                    aiBriefingContainer.classList.remove('hidden');
                } else {
                    const placeholder = document.getElementById('ai-briefing-placeholder');
                    if (placeholder) placeholder.textContent = 'Refresh to generate a new briefing.';
                }
            }

            
        } else {
            hideGlobalLoader();
            window.location.href = "index.html";
        }
    }

    initializePage();
});
