// js/hud.js – Jarvis AR HUD – wireframes + hero macro + rainbow + micro-pills

/** Rainbow Array: color per section (Yellow, Blue, Green, Orange, Red, Purple). */
const jarvisRainbow = ['#FBBF24', '#0EA5E9', '#22C55E', '#F97316', '#EF4444', '#A855F7'];

/**
 * Hierarchical telemetry: page -> [ { container, macro, nodes } ].
 * Derived from JARVIS_TELEMETRY_REPORT.md for wireframe overlay and node hover pills.
 */
const jarvisData = {
    'command-center.html': [
        { container: '.ai-briefing-card', macro: 'Executive Summary & Priority Intelligence. Synthesizing cross-functional data via AI to identify high-probability engagement opportunities.', nodes: [{ anchor: '#ai-briefing-refresh-btn', text: 'Regenerate briefing with current pipeline and task data.' }] },
        { container: '#my-tasks-card', macro: 'Task Management & Quick-Add. Centralize follow-ups and link tasks to contacts or accounts for full traceability.', nodes: [{ anchor: '#my-tasks-hamburger', text: 'Expand quick-add form to create a new task.' }, { anchor: '#quick-add-task-form button[type="submit"]', text: 'Submit to add task and link to contact or account.' }, { anchor: '.mark-task-complete-btn', text: 'Mark this task complete.' }, { anchor: '.edit-task-btn', text: 'Edit this task.' }, { anchor: '.delete-task-btn', text: 'Delete this task.' }] },
        { container: '.section-card:has(#sequence-steps-list)', macro: 'Sequence Pipeline. Due and upcoming outreach steps at a glance for prioritization.', nodes: [{ anchor: '#sequence-toggle-due', text: 'View steps due now.' }, { anchor: '#sequence-toggle-upcoming', text: 'View upcoming sequence steps.' }, { anchor: '.complete-step-btn', text: 'Activate or complete this sequence step (email, call, LinkedIn, etc.).' }, { anchor: '.revisit-step-btn', text: 'Revisit the last step for this contact.' }] },
        { container: '.dashboard-column-right .section-card', macro: 'Activity History. Track historical footprint and sync key interactions to Salesforce.', nodes: [{ anchor: '.btn-log-sf', text: 'Log this activity to Salesforce.' }] }
    ],
    'deals.html': [
        { container: '.deals-metrics-container', macro: 'Pipeline Metrics. Commit, best case, funnel, ARPU, and closed-won at a glance.', nodes: [] },
        { container: '.section-card:has(#list-view-container)', macro: 'Deal Pipeline. Filter by committed, stage, and close month; edit in list or drag on board.', plateTop: '40%', nodes: [
            { anchor: '.deals-filters', text: 'Filter by committed, stage, or close month; use Reset to clear all.' },
            { anchor: '.deals-filter-toggle', text: 'Toggle visibility of closed-lost deals for months other than current.' },
            { anchor: '#kanban-board-view .kanban-card', text: 'Drag card to another column to update stage.' }
        ] },
        { container: '.deals-charts-section', macro: 'Deal Insights. Stage distribution, 30/60/90 funnel, and pipeline by product.', nodes: [] }
    ],
    'contacts.html': [
        { container: '.contact-picker-panel', macro: 'Contact Directory. Search, sort, and leverage toolbar for add, import, or export.', nodes: [{ anchor: '#sort-first-last-btn', text: 'Sort by first name.' }, { anchor: '#sort-last-first-btn', text: 'Sort by last name.' }, { anchor: '#add-contact-btn', text: 'Add new contact.' }, { anchor: '#import-contact-screenshot-btn', text: 'Import contact from screenshot.' }, { anchor: '#bulk-import-contacts-btn', text: 'Bulk import from CSV.' }, { anchor: '#bulk-export-contacts-btn', text: 'Export contacts to CSV.' }, { anchor: '#take-picture-btn', text: 'Capture image (e.g. signature).' }] },
        { container: '.contact-details-form-card', macro: 'Contact Record. Edit fields and link to ZoomInfo or Salesforce for enrichment.', nodes: [{ anchor: '#zoominfo-contact-btn', text: 'Look up contact in ZoomInfo.' }, { anchor: 'form#contact-form button[type="submit"]', text: 'Save contact changes.' }, { anchor: '#delete-contact-btn', text: 'Delete this contact.' }] },
        { container: '.sequence-status-card', macro: 'Sequence Enrollment. Assign sequences or complete and remove for pipeline optimization.', nodes: [{ anchor: '#assign-sequence-select', text: 'Enroll contact in a sequence.' }, { anchor: '#complete-sequence-btn', text: 'Mark sequence complete.' }, { anchor: '#remove-from-sequence-btn', text: 'Remove contact from sequence.' }] },
        { container: '.ai-assistant-card', macro: 'AI Compose & Activity Insight. Generate outreach and synthesize recent activity into actionable insights.', nodes: [{ anchor: '#ai-activity-insight-btn', text: 'Synthesize recent activity into insight.' }, { anchor: '#ai-clear-insight-btn', text: 'Clear insight view.' }, { anchor: '#open-email-client-btn', text: 'Open draft in email client.' }, { anchor: '#ai-regenerate-email-btn', text: 'Regenerate email draft.' }, { anchor: '#ai-new-email-btn', text: 'Start new email draft.' }] },
        { container: '.contact-activities-card', macro: 'Contact Activity Log. Log activities and create linked tasks for full audit trail.', nodes: [{ anchor: '#log-activity-btn', text: 'Log an activity.' }, { anchor: '#add-task-contact-btn', text: 'Add task for this contact.' }, { anchor: '.btn-log-sf', text: 'Log this activity to Salesforce.' }] },
        { container: '.logged-emails-card', macro: 'Logged Emails. Historical email thread for this contact.', nodes: [] }
    ],
    'accounts.html': [
        { container: '.account-picker-panel', macro: 'Account Directory. Search and filter by hot, deals, customer, or prospect for targeted views.', nodes: [{ anchor: '.account-filter-icon[data-filter="all"]', text: 'Show all accounts.' }, { anchor: '.account-filter-icon[data-filter="hot"]', text: 'Show hot accounts.' }, { anchor: '.account-filter-icon[data-filter="with_deals"]', text: 'Show accounts with open deals.' }, { anchor: '.account-filter-icon[data-filter="customer"]', text: 'Show customers.' }, { anchor: '.account-filter-icon[data-filter="prospect"]', text: 'Show prospects.' }, { anchor: '#add-account-btn', text: 'Add new account.' }, { anchor: '#bulk-import-accounts-btn', text: 'Bulk import from CSV.' }, { anchor: '#bulk-export-accounts-btn', text: 'Export accounts to CSV.' }] },
        { container: '.account-details-form-card', macro: 'Account Record. Edit fields, link to ZoomInfo and Salesforce, or generate AI briefing.', nodes: [{ anchor: '#zoominfo-account-btn', text: 'Open account in ZoomInfo.' }, { anchor: '#salesforce-account-btn', text: 'Open account in Salesforce.' }, { anchor: '#ai-briefing-btn', text: 'Generate AI account briefing.' }, { anchor: '#sf-locator-edit-btn', text: 'Edit Salesforce ID.' }, { anchor: '#zoominfo-locator-edit-btn', text: 'Edit ZoomInfo company ID.' }, { anchor: 'form#account-form button[type="submit"]', text: 'Save account changes.' }, { anchor: '#delete-account-btn', text: 'Delete this account.' }, { anchor: '#account-is-customer', text: 'Toggle customer status.' }] },
        { container: '.account-deals-card', macro: 'Account Deals. Current pipeline for this account.', nodes: [{ anchor: '#add-deal-btn', text: 'Create new deal for this account.' }] },
        { container: '.account-contacts-card', macro: 'Account Contacts. List or org chart view of associated contacts.', nodes: [{ anchor: '#contact-list-btn', text: 'View contacts as list.' }, { anchor: '#contact-org-chart-btn', text: 'View contacts as org chart.' }, { anchor: '#org-chart-maximize-btn', text: 'Expand org chart in modal.' }] },
        { container: '.account-activities-card', macro: 'Account Activity. Related activities and Salesforce sync.', nodes: [{ anchor: '#add-task-account-btn', text: 'Add task for this account.' }, { anchor: '.btn-log-sf', text: 'Log this activity to Salesforce.' }] }
    ],
    'irr.html': [
        { container: '.section-card:has(#global-results-container)', macro: 'Strategic Capital Allocation Engine. Modeling multi-site internal rates of return to validate project viability against global hurdle rates.', nodes: [{ anchor: '#new-project-btn', text: 'Start new project (resets current).' }, { anchor: '#load-project-btn', text: 'Load saved project.' }, { anchor: '#save-project-btn', text: 'Persist project to secure database.' }, { anchor: '#add-site-btn', text: 'Add site to project.' }, { anchor: '#print-report-btn', text: 'Print report.' }, { anchor: '#export-csv-btn', text: 'Export to CSV.' }, { anchor: '#global-target-irr', text: 'Set global target IRR to drive GO/NO GO logic.' }, { anchor: '#tab-scroll-left', text: 'Scroll site tabs left.' }, { anchor: '#tab-scroll-right', text: 'Scroll site tabs right.' }, { anchor: '.delete-site-btn', text: 'Remove this site from project.' }] },
        { container: '#cashflow-flip-card', macro: 'Cash Flow Projection. Per-site timeline and construction/billing start; flip for advanced settings.', nodes: [{ anchor: '#flip-to-settings-btn', text: 'Open advanced timeline settings.' }, { anchor: '#flip-to-chart-btn', text: 'Return to chart view.' }, { anchor: '#save-settings-flip-btn', text: 'Save timeline and view chart.' }] },
        { container: '#stress-flip-card', macro: 'Sensitivity Analysis. Stress CapEx and MRR (±20%) or view annual cash flow table.', nodes: [{ anchor: '#flip-to-annual-table-btn', text: 'View annual cash flow table.' }, { anchor: '#flip-to-stress-btn', text: 'Return to stress test.' }, { anchor: '#stress-capex', text: 'CapEx stress slider (±20%).' }, { anchor: '#stress-mrr', text: 'MRR stress slider (±20%).' }, { anchor: '#stress-reset-btn', text: 'Reset stress to baseline.' }] }
    ],
    'campaigns.html': [
        { container: '.campaign-picker-panel', macro: 'Campaign Library. Active and past campaigns for selection and execution.', nodes: [] },
        { container: '#campaign-tools-card', macro: 'Campaign Builder. Create or manage campaigns; flip to manage email templates.', nodes: [{ anchor: '#campaign-tools-flip-btn', text: 'Flip to manage templates.' }, { anchor: '#create-campaign-confirm-yes', text: 'Confirm and create campaign.' }, { anchor: '#create-campaign-confirm-cancel', text: 'Cancel campaign creation.' }, { anchor: '#template-form-save-btn', text: 'Save template.' }, { anchor: '#template-form-cancel-btn', text: 'Cancel template edit.' }, { anchor: '#template-delete-yes-btn', text: 'Confirm template deletion.' }, { anchor: '#template-delete-cancel-btn', text: 'Cancel template deletion.' }] },
        { container: '.campaign-details-card', macro: 'Campaign Details. Summary and email preview; flip to view template.', nodes: [{ anchor: '#campaign-details-back-btn', text: 'Back to details from email preview.' }, { anchor: '#show-email-details-btn', text: 'View email template.' }, { anchor: '#delete-campaign-details-btn', text: 'Delete this campaign.' }] },
        { container: '.campaign-engine-card', macro: 'Campaign Execution. Call blitz or guided email flow through contact list.', nodes: [{ anchor: '#log-call-btn', text: 'Log call and advance.' }, { anchor: '#skip-call-btn', text: 'Skip and advance.' }, { anchor: '#open-email-client-btn', text: 'Open in email client and advance.' }, { anchor: '#skip-email-btn', text: 'Skip email and advance.' }, { anchor: '#export-txt-btn', text: 'Download email template as .txt.' }, { anchor: '#export-csv-btn', text: 'Download contacts as .csv.' }] }
    ],
    'marketing-hub.html': [
        { container: '#auth-container', macro: 'Marketing Hub Access. Authenticate to manage templates, sequences, and social posts.', nodes: [{ anchor: '#auth-submit-btn', text: 'Submit credentials.' }, { anchor: '#auth-toggle-link', text: 'Switch to sign up.' }, { anchor: '#forgot-password-link', text: 'Password recovery.' }] },
        { container: '#abm-center-view', macro: 'ABM Command Center. Due, upcoming, and completed ABM tasks.', nodes: [] },
        { container: '#templates-sequences-view', macro: 'Templates & Sequences. Create, import, or select item for details.', nodes: [{ anchor: '#create-new-item-btn', text: 'Create new template or sequence.' }, { anchor: '#import-item-btn', text: 'Import from CSV.' }, { anchor: '#download-sequence-template-btn', text: 'Download sequence template.' }, { anchor: '#delete-selected-item-btn', text: 'Delete selected item.' }] },
        { container: '#dynamic-details-panel', macro: 'Item Details. Inline view for selected template or sequence.', nodes: [] },
        { container: '#create-post-form-container', macro: 'Social Post. Create shared post for Social Hub.', nodes: [{ anchor: '#submit-post-btn', text: 'Publish post to Social Hub.' }] },
        { container: '.user-menu', macro: 'User Menu. Theme and session.', nodes: [{ anchor: '#theme-toggle-btn', text: 'Toggle theme.' }, { anchor: '#logout-btn', text: 'Sign out.' }] }
    ],
    'admin.html': [
        { container: '#user-management-view', macro: 'User Management. User table and bulk data reassignment.', nodes: [{ anchor: '#reassign-from-user', text: 'Source user for reassignment.' }, { anchor: '#reassign-to-user', text: 'Target user for reassignment.' }, { anchor: '#reassign-btn', text: 'Execute bulk reassignment.' }] },
        { container: '#content-management-view', macro: 'Content Management. Shared email templates and marketing sequences.', nodes: [{ anchor: '#view-templates-btn', text: 'View email templates.' }, { anchor: '#view-sequences-btn', text: 'View marketing sequences.' }] },
        { container: '#analytics-view', macro: 'Analytics. Rep and date filters; charts and activity log.', nodes: [{ anchor: '#analytics-rep-filter', text: 'Filter by rep.' }, { anchor: '#analytics-date-filter', text: 'Filter by date range.' }, { anchor: '#view-combined-btn', text: 'Combined chart view.' }, { anchor: '#view-individual-btn', text: 'Individual chart view.' }, { anchor: '.chart-toggle-btn', text: 'Toggle chart vs table for metric.' }] },
        { container: '#script-logs-view', macro: 'Script Logs. Run history for automated data scripts.', nodes: [] },
        { container: '#settings-view', macro: 'System Settings. Deal stages and activity types.', nodes: [{ anchor: '#new-deal-stage-name', text: 'New deal stage name.' }, { anchor: '#add-deal-stage-btn', text: 'Add deal stage.' }, { anchor: '#new-activity-type-name', text: 'New activity type name.' }, { anchor: '#add-activity-type-btn', text: 'Add activity type.' }] }
    ],
    'proposals.html': [
        {
            container: '#proposals-properties-section',
            macro: 'Proposal Properties. RFP name, business, rep, dates; save/load project and compile proposal.',
            nodes: [
                { anchor: '#save-project-btn', text: 'Save project (.spec).' },
                { anchor: '#load-project-label', text: 'Load project from file.' },
                { anchor: '#generate-btn', text: 'Compile proposal: click once to enable (state change), then click again to generate.' }
            ]
        },
        {
            container: '#cover-letter-section',
            macro: 'Cover Letter. Personalize body; use snippets, track readiness, and keep proposal notes.',
            nodes: [
                { anchor: '#cover-letter-section .rounded-xl:has(#cover-snippets)', text: 'Click to add: inserts snippet at cursor in cover letter.' },
                { anchor: '#proposal-readiness-checklist', text: 'Proposal Readiness: track RFP, cover, pricing, and ready state.' },
                { anchor: '#discovery-scratchpad', text: 'Proposal Notes: scratchpad for sites, contacts, quick math.' }
            ]
        },
        {
            container: '#proposals-elements-section',
            macro: 'Proposal Elements. Include/exclude sections; drag to reorder for output order.',
            nodes: [
                { anchor: '#module-list', text: 'Drag to reorder; order defines proposal output.' }
            ]
        }
    ]
};

/**
 * Current page key from pathname (e.g. command-center.html). Returns null if not in jarvisData.
 */
function getCurrentPageKey() {
    const path = window.location.pathname || "";
    const filename = path.split("/").pop() || "";
    if (jarvisData[filename]) return filename;
    return null;
}

/**
 * Build the HUD HTML. Three sibling layers (no nesting) so stacking context is independent.
 */
function buildHUDHTML() {
    return `
<div id="hud-backdrop-blur" class="hud-backdrop-blur" aria-hidden="true"></div>

<div id="hud-wireframes-layer" class="hud-wireframes-layer" aria-hidden="true">
    <div class="hud-wireframes"></div>
</div>

<div id="hud-controls-layer" class="hud-controls-layer" aria-hidden="true">
    <button type="button" class="hud-close-btn" title="Close" aria-label="Close"><i class="fa-solid fa-times"></i></button>
    <div class="hud-pill" aria-hidden="true"><span class="hud-pill-text"></span></div>
</div>`;
}

let hudBackdropBlur = null;
let hudWireframesLayer = null;
let hudControlsLayer = null;

/** Cleanup refs from last openHUD (wireframes, listeners) so closeHUD can tear down. */
let hudOpenState = {
    wireframeEls: [],
    scrollResizeHandler: null,
    nodeCleanups: [],
    updateAllWireframeRects: null
};

/**
 * Resolve container element; fallback for :has() when unsupported (deals/irr).
 */
function resolveContainer(selector) {
    try {
        const el = document.querySelector(selector);
        if (el) return el;
    } catch (_) {}
    if (selector === ".section-card:has(#list-view-container)") {
        const anchor = document.getElementById("list-view-container");
        return anchor ? anchor.closest(".section-card") : null;
    }
    if (selector === ".section-card:has(#global-results-container)") {
        const anchor = document.getElementById("global-results-container");
        return anchor ? anchor.closest(".section-card") : null;
    }
    if (selector === ".section-card:has(#sequence-steps-list)") {
        const anchor = document.getElementById("sequence-steps-list");
        return anchor ? anchor.closest(".section-card") : null;
    }
    if (selector === ".deals-charts-section") {
        const anchor = document.getElementById("deals-by-stage-chart");
        return anchor ? anchor.closest(".section-card") : document.querySelector(".deals-charts-section");
    }
    return null;
}

/**
 * Update position/size of all current wireframes from live DOM (used on scroll/resize and when
 * deals view changes so wireframes match the active layout).
 */
function updateAllWireframeRects() {
    const pageKey = hudOpenState.pageKey || getCurrentPageKey();
    const pageEntries = hudOpenState.pageEntries;
    if (!pageEntries || !hudOpenState.wireframeEls.length) return;
    const isDealsBoard = pageKey === "deals.html" && (() => {
        const board = document.getElementById("kanban-board-view");
        return board && !board.classList.contains("hidden");
    })();
    for (const wf of hudOpenState.wireframeEls) {
        const container = wf.dataset.container;
        if (!container) continue;
        const entry = pageEntries.find((e) => e.container === container);
        const el = resolveContainer(container);
        if (!el) continue;
        let rect = el.getBoundingClientRect();
            if (pageKey === "deals.html" && !isDealsBoard && entry && entry.container === ".section-card:has(#list-view-container)") {
            const chartsEl = document.querySelector(".deals-charts-section");
            if (chartsEl && chartsEl.offsetParent !== null) {
                const chartsTop = chartsEl.getBoundingClientRect().top;
                if (chartsTop > rect.top) {
                    const clampedHeight = Math.min(rect.height, Math.max(2, chartsTop - rect.top));
                    rect = { top: rect.top, left: rect.left, width: rect.width, height: clampedHeight };
                }
            }
        }
        const w = Math.max(rect.width || 0, 2);
        const h = Math.max(rect.height || 0, 2);
        wf.style.top = `${rect.top}px`;
        wf.style.left = `${rect.left}px`;
        wf.style.width = `${w}px`;
        wf.style.height = `${h}px`;
    }
}

/**
 * Position the micro-pill next to the target element; keep inside viewport.
 */
function positionPill(pillEl, targetRect) {
    if (!pillEl || !targetRect) return;
    const gap = 8;
    const padding = 12;
    const maxW = 320;
    const pillRect = pillEl.getBoundingClientRect();
    const pw = Math.min(pillRect.width || maxW, maxW);
    const ph = pillRect.height || 48;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = targetRect.right + gap;
    if (left + pw + padding > vw) left = targetRect.left - pw - gap;
    left = Math.max(padding, Math.min(left, vw - pw - padding));

    let top = targetRect.top;
    if (top + ph + padding > vh) top = vh - ph - padding;
    top = Math.max(padding, Math.min(top, vh - ph - padding));

    pillEl.style.left = `${left}px`;
    pillEl.style.top = `${top}px`;
}

/**
 * Open the HUD: draw wireframes, macro labels, and attach node hover → micro-pill.
 */
export function openHUD() {
    if (!hudBackdropBlur || !hudControlsLayer) return;

    const pageKey = getCurrentPageKey();
    const pageEntries = pageKey ? jarvisData[pageKey] : null;
    const wireframesWrap = hudWireframesLayer?.querySelector(".hud-wireframes");
    const pillEl = hudControlsLayer.querySelector(".hud-pill");
    const pillText = pillEl && pillEl.querySelector(".hud-pill-text");

    if (!wireframesWrap || !pillEl) return;

    pillEl.classList.remove("visible");
    pillEl.setAttribute("aria-hidden", "true");

    const isDealsBoardView = () => {
        const board = document.getElementById("kanban-board-view");
        return board && !board.classList.contains("hidden");
    };

    let globalNodeIndex = 0;
    if (pageEntries && pageEntries.length > 0) {
        pageEntries.forEach((entry, index) => {
            if (pageKey === "deals.html" && isDealsBoardView() && entry.container === ".deals-charts-section") return;
            const el = resolveContainer(entry.container);
            if (!el) return;

            const sectionColor = jarvisRainbow[index % jarvisRainbow.length];
            let rect = el.getBoundingClientRect();
            if (pageKey === "deals.html" && entry.container === ".section-card:has(#list-view-container)") {
                const chartsEl = document.querySelector(".deals-charts-section");
                if (chartsEl && chartsEl.offsetParent !== null) {
                    const chartsTop = chartsEl.getBoundingClientRect().top;
                    if (chartsTop > rect.top) {
                        const clampedHeight = Math.min(rect.height, Math.max(2, chartsTop - rect.top));
                        rect = { top: rect.top, left: rect.left, width: rect.width, height: clampedHeight };
                    }
                }
            }
            const w = Math.max(rect.width || 0, 2);
            const h = Math.max(rect.height || 0, 2);
            const wf = document.createElement("div");
            wf.className = "hud-wireframe";
            wf.style.top = `${rect.top}px`;
            wf.style.left = `${rect.left}px`;
            wf.style.width = `${w}px`;
            wf.style.height = `${h}px`;
            wf.style.border = `2px solid ${sectionColor}`;
            wf.style.boxShadow = `0 0 15px ${sectionColor}4D`;
            wf.dataset.container = entry.container;

            const plateTop = entry.plateTop != null ? entry.plateTop : "10%";
            const [titlePart, ...descParts] = entry.macro.split(".");
            const title = (titlePart || "").trim();
            const description = descParts.join(".").trim();
            wf.innerHTML = `
                <div class="hud-text-plate" style="border-left: 4px solid ${sectionColor}; top: ${plateTop}">
                    <div class="hud-hero-title" style="color: ${sectionColor}">${title ? title.toUpperCase() : ""}</div>
                    <div class="hud-hero-desc">${description}</div>
                </div>
            `;

            wireframesWrap.appendChild(wf);
            hudOpenState.wireframeEls.push(wf);

            for (const node of entry.nodes || []) {
                let targets;
                try {
                    targets = document.querySelectorAll(node.anchor);
                } catch (_) {
                    targets = [];
                }
                const text = node.text || "";
                for (const target of targets) {
                    target.classList.add("hud-action-node");
                    target.style.setProperty("--hud-pulse-delay", `${(globalNodeIndex % 8) * 0.22}s`);
                    globalNodeIndex++;
                    const isInputLike = target.matches && target.matches("input, select, textarea");
                    const onEnter = () => {
                        if (pillText) pillText.textContent = text;
                        pillEl.style.borderColor = sectionColor;
                        pillEl.style.boxShadow = `0 0 12px ${sectionColor}4D`;
                        const r = target.getBoundingClientRect();
                        positionPill(pillEl, r);
                        pillEl.classList.add("visible");
                        pillEl.setAttribute("aria-hidden", "false");
                        target.classList.add("hud-target-highlight");
                        if (isInputLike) target.classList.add("hud-node-lock");
                    };
                    const onLeave = () => {
                        pillEl.classList.remove("visible");
                        pillEl.setAttribute("aria-hidden", "true");
                        target.classList.remove("hud-target-highlight");
                        if (isInputLike) target.classList.remove("hud-node-lock");
                    };
                    target.addEventListener("mouseenter", onEnter);
                    target.addEventListener("mouseleave", onLeave);
                    hudOpenState.nodeCleanups.push({ target, onEnter, onLeave });
                }
            }
        });
    }

    hudOpenState.updateAllWireframeRects = updateAllWireframeRects;
    const onScrollOrResize = () => {
        updateAllWireframeRects();
    };
    const throttled = (fn, ms) => {
        let t = 0;
        return () => {
            const n = Date.now();
            if (n - t >= ms) { t = n; fn(); }
        };
    };
    const bound = throttled(onScrollOrResize, 80);
    window.addEventListener("scroll", bound, true);
    window.addEventListener("resize", bound);
    hudOpenState.scrollResizeHandler = bound;

    hudOpenState.pageKey = pageKey;
    hudOpenState.pageEntries = pageEntries;

    hudBackdropBlur.classList.add("active");
    hudBackdropBlur.setAttribute("aria-hidden", "false");
    if (hudWireframesLayer) {
        hudWireframesLayer.classList.add("active");
        hudWireframesLayer.setAttribute("aria-hidden", "false");
    }
    hudControlsLayer.classList.add("active");
    hudControlsLayer.setAttribute("aria-hidden", "false");
    document.querySelector(".hud-trigger-fab")?.classList.add("hud-trigger-fab-hidden");
    // Defer rect update so overlay is laid out and containers have correct dimensions
    requestAnimationFrame(() => {
        updateAllWireframeRects();
    });
}

/**
 * Reload HUD wireframe positions/sizes from the current DOM. Call when layout changes (e.g. deals
 * list/board view toggle) so wireframes match the active view.
 */
export function reloadHUDWireframes() {
    if (!hudControlsLayer || !hudControlsLayer.classList.contains("active")) return;
    if (typeof hudOpenState.updateAllWireframeRects === "function") hudOpenState.updateAllWireframeRects();
}

/**
 * Re-attach HUD node listeners for the current page. Call when the DOM has changed (e.g. deals
 * page switched to Kanban and cards were just rendered) so new elements get the pulse and pill.
 */
export function refreshHUDNodes() {
    if (!hudControlsLayer || !hudControlsLayer.classList.contains("active")) return;
    const pageEntries = hudOpenState.pageEntries;
    if (!pageEntries || pageEntries.length === 0) return;

    document.querySelectorAll(".hud-target-highlight").forEach((el) => el.classList.remove("hud-target-highlight"));
    document.querySelectorAll(".hud-node-lock").forEach((el) => el.classList.remove("hud-node-lock"));
    document.querySelectorAll(".hud-action-node").forEach((el) => {
        el.classList.remove("hud-action-node");
        el.style.removeProperty("--hud-pulse-delay");
    });
    hudOpenState.nodeCleanups.forEach(({ target, onEnter, onLeave }) => {
        target.removeEventListener("mouseenter", onEnter);
        target.removeEventListener("mouseleave", onLeave);
    });
    hudOpenState.nodeCleanups.length = 0;

    const pillEl = hudControlsLayer.querySelector(".hud-pill");
    const pillText = pillEl && pillEl.querySelector(".hud-pill-text");
    if (!pillEl) return;

    let globalNodeIndex = 0;
    pageEntries.forEach((entry, index) => {
        const sectionColor = jarvisRainbow[index % jarvisRainbow.length];
        for (const node of entry.nodes || []) {
            let targets;
            try {
                targets = document.querySelectorAll(node.anchor);
            } catch (_) {
                targets = [];
            }
            const text = node.text || "";
            for (const target of targets) {
                target.classList.add("hud-action-node");
                target.style.setProperty("--hud-pulse-delay", `${(globalNodeIndex % 8) * 0.22}s`);
                globalNodeIndex++;
                const isInputLike = target.matches && target.matches("input, select, textarea");
                const onEnter = () => {
                    if (pillText) pillText.textContent = text;
                    pillEl.style.borderColor = sectionColor;
                    pillEl.style.boxShadow = `0 0 12px ${sectionColor}4D`;
                    const r = target.getBoundingClientRect();
                    positionPill(pillEl, r);
                    pillEl.classList.add("visible");
                    pillEl.setAttribute("aria-hidden", "false");
                    target.classList.add("hud-target-highlight");
                    if (isInputLike) target.classList.add("hud-node-lock");
                };
                const onLeave = () => {
                    pillEl.classList.remove("visible");
                    pillEl.setAttribute("aria-hidden", "true");
                    target.classList.remove("hud-target-highlight");
                    if (isInputLike) target.classList.remove("hud-node-lock");
                };
                target.addEventListener("mouseenter", onEnter);
                target.addEventListener("mouseleave", onLeave);
                hudOpenState.nodeCleanups.push({ target, onEnter, onLeave });
            }
        }
    });
}

/**
 * Close the HUD: remove wireframes, labels, node listeners, scroll/resize listeners, hide pill.
 */
export function closeHUD() {
    document.querySelectorAll(".hud-target-highlight").forEach((el) => el.classList.remove("hud-target-highlight"));
    document.querySelectorAll(".hud-node-lock").forEach((el) => el.classList.remove("hud-node-lock"));
    document.querySelectorAll(".hud-action-node").forEach((el) => {
        el.classList.remove("hud-action-node");
        el.style.removeProperty("--hud-pulse-delay");
    });

    hudOpenState.nodeCleanups.forEach(({ target, onEnter, onLeave }) => {
        target.removeEventListener("mouseenter", onEnter);
        target.removeEventListener("mouseleave", onLeave);
    });
    hudOpenState.nodeCleanups.length = 0;

    const handler = hudOpenState.scrollResizeHandler;
    if (handler) {
        window.removeEventListener("scroll", handler, true);
        window.removeEventListener("resize", handler);
        hudOpenState.scrollResizeHandler = null;
    }

    hudOpenState.wireframeEls.forEach((el) => el.remove());
    hudOpenState.wireframeEls.length = 0;
    hudOpenState.updateAllWireframeRects = null;

    const pillEl = hudControlsLayer?.querySelector(".hud-pill");
    if (pillEl) {
        pillEl.classList.remove("visible");
        pillEl.setAttribute("aria-hidden", "true");
    }

    if (hudBackdropBlur) {
        hudBackdropBlur.classList.remove("active");
        hudBackdropBlur.setAttribute("aria-hidden", "true");
    }
    if (hudWireframesLayer) {
        hudWireframesLayer.classList.remove("active");
        hudWireframesLayer.setAttribute("aria-hidden", "true");
    }
    if (hudControlsLayer) {
        hudControlsLayer.classList.remove("active");
        hudControlsLayer.setAttribute("aria-hidden", "true");
    }
    document.querySelector(".hud-trigger-fab")?.classList.remove("hud-trigger-fab-hidden");
}

/**
 * Remove the Deal Insights wireframe (used when deals page switches to Kanban view).
 */
export function removeDealInsightsWireframe() {
    if (!hudWireframesLayer) return;
    const wireframesWrap = hudWireframesLayer.querySelector(".hud-wireframes");
    if (!wireframesWrap) return;
    wireframesWrap.querySelectorAll(".hud-wireframe[data-container=\".deals-charts-section\"]").forEach((el) => {
        el.remove();
        const i = hudOpenState.wireframeEls.indexOf(el);
        if (i !== -1) hudOpenState.wireframeEls.splice(i, 1);
    });
}

/**
 * Add the Deal Insights wireframe (used when deals page switches back to list view).
 */
export function addDealInsightsWireframe() {
    if (!hudControlsLayer || !hudControlsLayer.classList.contains("active")) return;
    if (getCurrentPageKey() !== "deals.html") return;
    const board = document.getElementById("kanban-board-view");
    if (board && !board.classList.contains("hidden")) return;
    const entries = jarvisData["deals.html"];
    const entry = entries && entries.find((e) => e.container === ".deals-charts-section");
    if (!entry) return;
    const el = resolveContainer(entry.container);
    if (!el) return;
    const wireframesWrap = hudWireframesLayer?.querySelector(".hud-wireframes");
    if (!wireframesWrap) return;
    const index = entries.indexOf(entry);
    const sectionColor = jarvisRainbow[index % jarvisRainbow.length];
    const rect = el.getBoundingClientRect();
    const wf = document.createElement("div");
    wf.className = "hud-wireframe";
    wf.style.top = `${rect.top}px`;
    wf.style.left = `${rect.left}px`;
    wf.style.width = `${rect.width}px`;
    wf.style.height = `${rect.height}px`;
    wf.style.borderColor = sectionColor;
    wf.style.boxShadow = `0 0 15px ${sectionColor}4D`;
    wf.dataset.container = entry.container;
    const plateTop = entry.plateTop != null ? entry.plateTop : "10%";
    const [titlePart, ...descParts] = entry.macro.split(".");
    const title = (titlePart || "").trim();
    const description = descParts.join(".").trim();
    wf.innerHTML = `
        <div class="hud-text-plate" style="border-left: 4px solid ${sectionColor}; top: ${plateTop}">
            <div class="hud-hero-title" style="color: ${sectionColor}">${title ? title.toUpperCase() : ""}</div>
            <div class="hud-hero-desc">${description}</div>
        </div>
    `;
    wireframesWrap.appendChild(wf);
    hudOpenState.wireframeEls.push(wf);
}

/**
 * Build the persistent HUD help trigger (glass circle, bottom-right). Call after overlay exists.
 */
function buildHUDTriggerButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hud-trigger-fab";
    btn.setAttribute("title", "Page Tips & Tricks");
    btn.setAttribute("aria-label", "Open page tips and tricks overlay");
    btn.innerHTML = "<i class=\"fa-solid fa-lightbulb\"></i>";
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        openHUD();
    });
    return btn;
}

/**
 * Initialize the HUD: inject overlay (wireframe layer + single micro-pill), floating trigger, close behavior.
 * Wireframes and node pills are created in openHUD(). Idempotent.
 */
export function initHUD() {
    if (document.getElementById("hud-backdrop-blur")) return;

    const html = buildHUDHTML();
    document.body.insertAdjacentHTML("beforeend", html);
    hudBackdropBlur = document.getElementById("hud-backdrop-blur");
    hudWireframesLayer = document.getElementById("hud-wireframes-layer");
    hudControlsLayer = document.getElementById("hud-controls-layer");
    if (!hudBackdropBlur || !hudControlsLayer) return;

    const closeBtn = hudControlsLayer.querySelector(".hud-close-btn");
    if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
            e.preventDefault();
            closeHUD();
        });
    }

    /* Close only via X button; clicking overlay background does not close */

    if (!document.querySelector(".hud-trigger-fab")) {
        document.body.appendChild(buildHUDTriggerButton());
    }
}
