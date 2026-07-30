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
import { createCalendarEvent, emailActionLabel, getIntegrationState, listCalendarEvents, sendEmail } from './integrations.js';

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

    function eventLocalDate(ev) {
        if (ev?.startTime == null) return null;
        const d = new Date(Number(ev.startTime) * 1000);
        if (Number.isNaN(d.getTime())) return null;
        return d;
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
        if (ev?.startTime == null) return "";
        const d = new Date(Number(ev.startTime) * 1000);
        if (Number.isNaN(d.getTime())) return "";
        if (ev.allDay) return "All day";
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }

    /** Safe `#RRGGBB` from API `color`, or null (UI falls back to theme default). */
    function normalizeEventColor(value) {
        if (value == null) return null;
        const raw = String(value).trim();
        if (!raw) return null;
        const withHash = raw.startsWith("#") ? raw : `#${raw}`;
        if (/^#[0-9A-Fa-f]{6}$/.test(withHash)) return withHash;
        if (/^#[0-9A-Fa-f]{3}$/.test(withHash)) {
            const r = withHash[1];
            const g = withHash[2];
            const b = withHash[3];
            return `#${r}${r}${g}${g}${b}${b}`;
        }
        return null;
    }

    function eventColorStyleAttr(ev) {
        const color = normalizeEventColor(ev?.color);
        return color ? ` style="--cc-event-color: ${color}"` : "";
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
            <span class="cc-event-bullet" aria-hidden="true"${eventColorStyleAttr(ev)}></span>
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

    function localDateTimeToUnixSeconds(dateStr, timeStr) {
        if (!dateStr || !timeStr) return null;
        const d = new Date(`${dateStr}T${timeStr}:00`);
        if (Number.isNaN(d.getTime())) return null;
        return Math.floor(d.getTime() / 1000);
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

    function openAddCalendarEventForm() {
        if (!calendarIntegrationState?.orgEnabled) return;
        if (!calendarIntegrationState?.connected) {
            promptCalendarConnect();
            return;
        }

        const startDefault = new Date();
        startDefault.setMinutes(0, 0, 0);
        startDefault.setHours(startDefault.getHours() + 1);
        const endDefault = new Date(startDefault.getTime() + 60 * 60 * 1000);

        const bodyHtml = `
            <form id="cc-add-event-form" class="modal-form">
                <label for="cc-event-title">Title</label>
                <input type="text" id="cc-event-title" name="title" required placeholder="Event title" autocomplete="off">
                <label for="cc-event-date">Date</label>
                <input type="date" id="cc-event-date" name="date" required value="${toLocalDateInputValue(startDefault)}">
                <div class="modal-form-row">
                    <div>
                        <label for="cc-event-start">Start</label>
                        <input type="time" id="cc-event-start" name="start" required value="${toLocalTimeInputValue(startDefault)}">
                    </div>
                    <div>
                        <label for="cc-event-end">End</label>
                        <input type="time" id="cc-event-end" name="end" required value="${toLocalTimeInputValue(endDefault)}">
                    </div>
                </div>
                <label for="cc-event-desc">Description <span class="text-[var(--text-muted)] font-normal">(optional)</span></label>
                <textarea id="cc-event-desc" name="description" rows="3" placeholder="Notes for the invite"></textarea>
            </form>
        `;

        showModal(
            "Add Event",
            bodyHtml,
            async () => {
                const titleEl = document.getElementById("cc-event-title");
                const dateEl = document.getElementById("cc-event-date");
                const startEl = document.getElementById("cc-event-start");
                const endEl = document.getElementById("cc-event-end");
                const descEl = document.getElementById("cc-event-desc");
                const title = (titleEl?.value || "").trim();
                if (!title) {
                    showToast("Enter an event title.", "warning");
                    titleEl?.focus();
                    return false;
                }
                const startTime = localDateTimeToUnixSeconds(dateEl?.value, startEl?.value);
                let endTime = localDateTimeToUnixSeconds(dateEl?.value, endEl?.value);
                if (startTime == null || endTime == null) {
                    showToast("Enter a valid date and time.", "warning");
                    return false;
                }
                if (endTime <= startTime) {
                    endTime = startTime + 3600;
                }
                try {
                    const result = await createCalendarEvent(
                        supabase,
                        {
                            title,
                            description: (descEl?.value || "").trim() || undefined,
                            startTime,
                            endTime,
                        },
                        { onNotice: (msg, type) => showToast(msg, type) }
                    );
                    if (!result?.ok) return false;
                    await loadCalendarPanel();
                    if (ccMonthBackdrop && !ccMonthBackdrop.classList.contains("hidden")) {
                        await loadMonthCalendarEvents();
                    }
                    return true;
                } catch (error) {
                    showToast(error?.message || "Could not create calendar event.", "error");
                    return false;
                }
            },
            true,
            `<button id="modal-confirm-btn" class="btn-primary">Create</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
        );

        queueMicrotask(() => document.getElementById("cc-event-title")?.focus());
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

    function renderMonthDayPanel(dayKey) {
        if (!ccMonthDayHeading || !ccMonthDayList) return;
        if (!dayKey) {
            ccMonthDayHeading.textContent = "Select a day";
            ccMonthDayList.innerHTML = '<p class="cc-month-day-empty">Click a day to see events.</p>';
            return;
        }
        const [y, m, d] = dayKey.split("-").map(Number);
        const date = new Date(y, m - 1, d);
        ccMonthDayHeading.textContent = date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
        });
        const dayEvents = eventsForDayKey(dayKey);
        if (!dayEvents.length) {
            ccMonthDayList.innerHTML = '<p class="cc-month-day-empty">No events this day.</p>';
            return;
        }
        ccMonthDayList.innerHTML = dayEvents
            .map((ev) => {
                const desc = (ev.description || "").trim();
                const showDesc = desc && desc.length > 2 && desc !== ev.title;
                return `
                    <div class="cc-month-day-item"${eventColorStyleAttr(ev)}>
                        <span class="cc-event-bullet" aria-hidden="true"></span>
                        <div class="cc-month-day-item-main">
                            <div class="cc-month-day-item-when">${escapeHtml(formatCalendarEventTime(ev))}</div>
                            <div class="cc-month-day-item-title">${escapeHtml(ev.title || "(No title)")}</div>
                            ${showDesc ? `<div class="cc-month-day-item-desc">${escapeHtml(desc)}</div>` : ""}
                        </div>
                    </div>
                `;
            })
            .join("");
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
                        <span class="cc-event-bullet" aria-hidden="true"></span>
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
                          .map((ev) => `<span class="cc-month-dot"${eventColorStyleAttr(ev)}></span>`)
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
        renderMonthDayPanel(monthSelectedDayKey);
    }

    async function loadMonthCalendarEvents() {
        if (!ccMonthGrid || monthViewYear == null || monthViewMonth == null) return;
        monthEventsLoading = true;
        ccMonthGrid.innerHTML =
            '<p class="cc-month-day-empty col-span-7 self-center text-center">Loading events...</p>';
        try {
            const { start, end } = monthRangeUnix(monthViewYear, monthViewMonth);
            // Pad a few days either side so adjacent-month cells can show events
            const data = await listCalendarEvents(supabase, {
                start: start - 7 * 24 * 60 * 60,
                end: end + 7 * 24 * 60 * 60,
                limit: 100,
            });
            monthViewEvents = Array.isArray(data?.events) ? data.events : [];
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
        loadMonthCalendarEvents();
    }

    function closeMonthCalendarModal() {
        if (!ccMonthBackdrop) return;
        ccMonthBackdrop.classList.add("hidden");
        ccMonthBackdrop.setAttribute("aria-hidden", "true");
    }

    function setupCalendarPanelListeners() {
        ccCalendarAddBtn?.addEventListener("click", () => openAddCalendarEventForm());
        ccCalendarMonthBtn?.addEventListener("click", () => openMonthCalendarModal());
        ccMonthCloseBtn?.addEventListener("click", () => closeMonthCalendarModal());
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
        if (!ccCalendarList) return;
        ccCalendarList.innerHTML =
            '<p class="cc-calendar-empty text-sm text-[var(--text-medium)] px-4 py-4">Loading calendar...</p>';
        setCalendarActionsVisible(false);

        try {
            const integrationState = await getIntegrationState(supabase);
            calendarIntegrationState = integrationState;
            if (!integrationState.orgEnabled) {
                ccCalendarList.innerHTML =
                    '<p class="cc-calendar-empty text-sm text-[var(--text-medium)] px-4 py-4">Calendar preview is available when your organization enables email &amp; calendar integrations.</p>';
                return;
            }

            setCalendarActionsVisible(true);

            if (!integrationState.connected) {
                ccCalendarList.innerHTML =
                    '<p class="cc-calendar-empty text-sm text-[var(--text-medium)] px-4 py-4">Connect Google or Outlook in <a href="ai-admin.html?tab=integrations" class="cc-calendar-settings-link">User Settings</a> to see upcoming events.</p>';
                return;
            }

            const nowSec = Math.floor(Date.now() / 1000);
            const data = await listCalendarEvents(supabase, {
                start: nowSec,
                end: nowSec + 7 * 24 * 60 * 60,
                limit: 15,
            });
            const events = Array.isArray(data?.events) ? data.events : [];

            if (!events.length) {
                ccCalendarList.innerHTML =
                    '<p class="cc-calendar-empty text-sm text-[var(--text-medium)] px-4 py-4">No upcoming events</p>';
                return;
            }

            renderGroupedCalendarList(ccCalendarList, events);
        } catch (error) {
            console.warn("[command-center] calendar panel:", error);
            ccCalendarList.innerHTML =
                '<p class="cc-calendar-empty text-sm text-[var(--text-medium)] px-4 py-4">Couldn\'t load calendar events right now.</p>';
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
