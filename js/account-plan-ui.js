/**
 * Strategic Account OS — UI controller (canvas forms, rail, versioning, autosave).
 */

import {
    PLAN_SECTIONS,
    PSYCHOLOGY_SLIDERS,
    PLAN_306090_HORIZONS,
    MAX_ENTRY_POINTS,
    ENTRY_POINT_TRUST_LEVELS,
    ENTRY_POINT_LEVEL_OPTIONS,
    ENTRY_POINT_COMM_STYLES,
    ACCOUNT_SNAPSHOT_TIER_OPTIONS,
    ACCOUNT_SNAPSHOT_LEVEL_OPTIONS,
    CRITICAL_UNKNOWN_LANGUAGE_PILLS,
    INFLUENCE_LEVEL_OPTIONS,
    INFLUENCE_RELATIONSHIP_TEMPERATURE_OPTIONS,
    INFLUENCE_PERSONALITY_STYLE_OPTIONS,
    WHITE_SPACE_AREAS,
    WHITE_SPACE_CONFIDENCE_OPTIONS,
    PSYCHOLOGY_GRAVITY_PILLS,
    STRATEGIC_TENSION_GROUPS,
    TENSION_GHOST_SECTIONS,
    TENSION_LINKAGE_PROMPTS,
    buildTensionLinkagePromptText,
    INSIGHT_DENSITY_SECTIONS,
    INSIGHT_DENSITY_SOFT_LIMIT,
    TACTICAL_UX_LABELS,
    SAOS_CORE_HIDDEN_SECTION_IDS,
} from './account-plan-sections.js';
import { formatPlanHorizonRailPreviewHtml } from './account-plan-rich-text.js';
import {
    createEmptyPlan,
    createEmptyEntryPoint,
    createEmptyWhiteSpaceRow,
    createEmptyInteractionLogEntry,
    deepClonePlan,
    normalizePlan,
    savePlanDraft,
    getWhiteSpaceRows,
    ENTRY_POINT_FIELD_KEYS,
    INFLUENCE_CONTACT_FIELD_KEYS,
} from './account-plan-data.js';
import { createAccountPlanAutosave } from './account-plan-autosave.js';
import {
    generateAccountPlanPdf,
    openAccountPlanPdfPreview,
    closeAccountPlanPdfPreview,
    downloadFileBytes,
} from './account-plan-export.js';
import { fetchPresentationHighlight } from './account-plan-presentation-ai.js';
import { generateExecPresentationPptx } from './account-plan-presentation-pptx.js';

const STORAGE_KEY = 'accounts_view_mode';
const MOMENTUM_LABELS = Object.freeze(['Stalled', 'Cooling', 'Neutral', 'Warming', 'Champion']);
const INTERACTION_POLITICAL_SIGNAL_OPTIONS = Object.freeze(['', 'High', 'Medium', 'Low', 'Positive', 'Neutral', 'Negative']);
const INTERACTION_MOMENTUM_SHIFT_OPTIONS = Object.freeze(['', 'Positive', 'Neutral', 'Negative']);

/** @type {Record<string, unknown>} */
let _options = {};

/** @type {'tactical' | 'strategic'} */
let _activeMode = 'tactical';

/** @type {ReturnType<typeof createAccountPlanAutosave> | null} */
let _autosave = null;

/** @type {object | null} */
let _supabase = null;

/** @type {string | null} */
let _planRowId = null;

/** @type {import('./account-plan-data.js').AccountPlanDocument | null} */
let _planBaseline = null;

/** @type {Record<string, unknown> | null} */
let _liveSections = null;
let _entryPointActiveIndex = 0;

let _canvasEventsBound = false;
let _versionPopoverBound = false;
let _popoverOpen = false;
let _showCrmActivities = true;

// TomSelect instance bound to #interaction-form-contact. Tracked at module
// scope because refreshInteractionLogSection() blows away the form's HTML on
// every save, so we have to destroy the previous instance before re-init.
// Kept here (not inside the function) to avoid leaking detached instances on
// each re-render and to mirror how accounts.js owns its tomSelectIndustry.
/** @type {{ destroy?: () => void } | null} */
let _interactionContactTomSelect = null;

/**
 * @param {{
 *   getSelectedAccountId?: () => number | null,
 *   getSelectedAccount?: () => object | null,
 *   getSelectedAccountDetails?: () => { contacts?: object[] } | null,
 *   getAccountPlan?: () => { rowId?: string, plan?: object, updated_at?: string } | null,
 *   isFormDirty?: () => boolean,
 *   clearFormDirty?: () => void,
 *   setAccountViewModeInState?: (mode: 'tactical' | 'strategic') => void,
 *   onConfirmDiscardUnsaved?: (onConfirm: () => void) => void,
 *   onConfirmRestore?: (message: string, onConfirm: () => void) => void,
 *   onPlanUpdated?: (plan: object, meta?: { updated_at?: string }) => void,
 *   onToast?: (message: string, type?: string) => void,
 *   supabase?: object,
 *   getAccountsList?: () => { id: number, name: string }[],
 *   switchStrategicAccount?: (accountId: number) => void | Promise<void>,
 * }} [options]
 */
export function initStrategicMode(options = {}) {
    _options = options;
    _supabase = options.supabase ?? null;

    if (_supabase && !_autosave) {
        _autosave = createAccountPlanAutosave(_supabase, {
            onStatusChange: (status, detail = {}) => {
                updateAutosaveStatusUi(status, detail);
                if (status === 'saved' && detail.plan) {
                    _planBaseline = deepClonePlan(detail.plan);
                    _liveSections = deepClonePlan(_planBaseline).current_draft.sections;
                    _autosave.setAutosaveBaseline(_planRowId, _planBaseline);
                    _options.onPlanUpdated?.(_planBaseline, { updated_at: detail.updated_at });
                    renderVersionTimeline(_planBaseline);
                    updateVersionTriggerLabel(_planBaseline);
                }
            },
        });
    }

    bindVersionPopoverControls();
    bindRailControls();
    bindPlanPdfPreviewModal();
    initStrategicAccountSwitcher();

    const toggleBtn = document.getElementById('account-mode-toggle');
    if (toggleBtn && !toggleBtn.dataset.strategicBound) {
        toggleBtn.dataset.strategicBound = '1';
        toggleBtn.addEventListener('click', () => {
            requestAccountViewMode(_activeMode === 'strategic' ? 'tactical' : 'strategic');
        });
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    const hasAccount = !!_options.getSelectedAccountId?.();
    const initialMode = saved === 'strategic' && hasAccount ? 'strategic' : 'tactical';

    setAccountViewMode(initialMode, { skipDirtyCheck: true });
}

/**
 * @param {{ rowId?: string, plan?: object } | null} accountPlan
 */
export function syncAccountPlanContext(accountPlan) {
    _planRowId = accountPlan?.rowId ?? null;
    _planBaseline = accountPlan?.plan ? deepClonePlan(accountPlan.plan) : null;
    _liveSections = _planBaseline
        ? deepClonePlan(_planBaseline).current_draft.sections
        : null;
    _autosave?.setAutosaveBaseline(_planRowId, _planBaseline);
}

export function cancelPlanAutosave() {
    _autosave?.cancelAutosave();
}

/** Flush pending strategic plan edits before switching accounts in Strategic mode. */
export async function flushPlanAutosave() {
    if (!_autosave || !_planRowId || !_planBaseline || !_liveSections) return null;
    return _autosave.flushAutosave({
        planRowId: _planRowId,
        plan: _planBaseline,
        draftSections: deepClonePlan({ current_draft: { sections: _liveSections } }).current_draft.sections,
    });
}

/**
 * @param {'tactical' | 'strategic'} mode
 * @param {{ skipDirtyCheck?: boolean }} [options]
 */
export function setAccountViewMode(mode, options = {}) {
    let normalized = mode === 'strategic' ? 'strategic' : 'tactical';

    if (
        !options.skipDirtyCheck
        && normalized === 'strategic'
        && _options.isFormDirty?.()
    ) {
        _options.onConfirmDiscardUnsaved?.(() => {
            _options.clearFormDirty?.();
            setAccountViewMode('strategic', { skipDirtyCheck: true });
        });
        return;
    }

    if (normalized === 'strategic' && !_options.getSelectedAccountId?.()) {
        normalized = 'tactical';
    }

    if (normalized === 'tactical' && _activeMode === 'strategic') {
        cancelPlanAutosave();
        closeVersionPopover();
    }

    _activeMode = normalized;

    const accountsEl = document.getElementById('accounts');
    const body = document.body;
    const workspace = document.getElementById('strategic-workspace');

    if (_activeMode === 'strategic') {
        accountsEl?.classList.add('strategic-mode-active');
        body?.classList.add('strategic-mode-active');
        workspace?.setAttribute('aria-hidden', 'false');
    } else {
        accountsEl?.classList.remove('strategic-mode-active');
        body?.classList.remove('strategic-mode-active');
        workspace?.setAttribute('aria-hidden', 'true');
    }

    moveHeaderControls(_activeMode);
    updateToggleUi(_activeMode);
    updateAutosaveVisibility(_activeMode);
    updateToggleDisabled();
    updateVersionTriggerVisibility(_activeMode);
    updateAccountPickerForMode(_activeMode);

    localStorage.setItem(STORAGE_KEY, _activeMode);
    _options.setAccountViewModeInState?.(_activeMode);

    if (_activeMode === 'strategic') {
        syncAccountPlanContext(_options.getAccountPlan?.() ?? null);
        renderStrategicShell(_options.getSelectedAccount?.() ?? null, _planBaseline);
    }
}

/**
 * Strategic mode: hide the left account picker (Path handles section nav;
 * account switching happens via the mode toggle back to tactical). Show the
 * horizontal Path above the canvas.
 *
 * @param {'tactical' | 'strategic'} mode
 */
function updateAccountPickerForMode(mode) {
    const isStrategic = mode === 'strategic';

    const pathEl = document.getElementById('strategic-path');
    if (pathEl instanceof HTMLElement) {
        pathEl.classList.toggle('hidden', !isStrategic);
    }

    if (isStrategic) {
        loadSaosViewMode();
        applySaosViewModeToCanvas();
        renderStrategicViewMode();
        renderStrategicPath();
        initStrategicPathNavigation();
        initStrategicViewModeNavigation();
    } else {
        teardownStrategicPathNavigation();
    }
}

/**
 * @returns {import('./account-plan-sections.js').PlanSectionDef[]}
 */
function getCanvasPlanSections() {
    if (_saosViewMode === 'core') {
        return PLAN_SECTIONS.filter((section) => !SAOS_CORE_HIDDEN_SECTION_IDS.includes(section.id));
    }
    return PLAN_SECTIONS;
}

function loadSaosViewMode() {
    try {
        const stored = localStorage.getItem(SAOS_VIEW_MODE_STORAGE_KEY);
        _saosViewMode = stored === 'deep' ? 'deep' : 'core';
    } catch {
        _saosViewMode = 'core';
    }
}

/**
 * @param {SaosViewMode} mode
 */
function setSaosViewMode(mode) {
    _saosViewMode = mode === 'deep' ? 'deep' : 'core';
    try {
        localStorage.setItem(SAOS_VIEW_MODE_STORAGE_KEY, _saosViewMode);
    } catch {
        /* ignore quota / private mode */
    }
    applySaosViewModeToCanvas();
    renderStrategicViewMode();
    renderStrategicPath();
    paintCanvas();
}

function applySaosViewModeToCanvas() {
    const canvas = document.getElementById('strategic-document-canvas');
    if (!(canvas instanceof HTMLElement)) return;
    canvas.classList.toggle('saos-mode-core', _saosViewMode === 'core');
    canvas.classList.toggle('saos-mode-deep', _saosViewMode === 'deep');
}

function renderStrategicViewModeToggleHtml() {
    const isCore = _saosViewMode === 'core';
    return `
        <div class="saos-view-mode" role="group" aria-label="Plan view mode">
            <span class="saos-view-mode-label">View Mode:</span>
            <button
                type="button"
                class="saos-view-mode-option${isCore ? ' saos-view-mode-option--active' : ''}"
                data-view-mode="core"
                aria-pressed="${isCore ? 'true' : 'false'}"
            >Core</button>
            <span class="saos-view-mode-sep" aria-hidden="true">|</span>
            <button
                type="button"
                class="saos-view-mode-option${!isCore ? ' saos-view-mode-option--active' : ''}"
                data-view-mode="deep"
                aria-pressed="${!isCore ? 'true' : 'false'}"
            >Deep Dive</button>
        </div>`;
}

/** Core/Deep Dive toggle beside the Strategic Plan header. */
function renderStrategicViewMode() {
    const host = document.getElementById('strategic-view-mode-host');
    if (!host) return;
    host.innerHTML = renderStrategicViewModeToggleHtml();
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {number} indexInRow
 */
function buildStrategicPathItemHtml(section, indexInRow) {
    return `<li class="strategic-path-item" style="--path-index:${indexInRow}">`
        + `<button type="button" class="strategic-path-step" data-section-id="${section.id}"`
        + ` aria-current="false">`
        + `<span class="strategic-path-step-label">${escapeHtml(section.title)}</span>`
        + `</button></li>`;
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef[]} sections
 */
function buildStrategicPathRowTrackHtml(sections) {
    return `<ol class="strategic-path-row-track">${
        sections.map((section, index) => buildStrategicPathItemHtml(section, index)).join('')
    }</ol>`;
}

/**
 * Populate the horizontal Path with one step per visible plan section.
 */
function renderStrategicPath() {
    const track = document.getElementById('strategic-path-track');
    if (!track) return;

    const sections = getCanvasPlanSections();
    const isCore = _saosViewMode === 'core';
    track.classList.toggle('strategic-path-track--core', isCore);
    track.classList.toggle('strategic-path-track--deep', !isCore);

    if (isCore) {
        track.innerHTML = `<li class="strategic-path-row">${buildStrategicPathRowTrackHtml(sections)}</li>`;
    } else {
        const midpoint = Math.ceil(sections.length / 2);
        const row1 = sections.slice(0, midpoint);
        const row2 = sections.slice(midpoint);
        track.innerHTML = `<li class="strategic-path-row">${buildStrategicPathRowTrackHtml(row1)}</li>`
            + `<li class="strategic-path-row">${buildStrategicPathRowTrackHtml(row2)}</li>`;
    }

    syncStrategicPathActive();
}

let _strategicPathNavBound = false;
let _strategicViewModeNavBound = false;
/** @type {((event: Event) => void) | null} */
let _strategicPathScrollHandler = null;
/** Suppress scroll-spy flicker while a Path click smooth-scrolls. */
let _pathScrollLockUntil = 0;
let _strategicAccountSwitcherBound = false;

/**
 * In-strategic account switcher — reps stay in flow without dropping to Tactical
 * mode and hunting the hidden account picker.
 */
function initStrategicAccountSwitcher() {
    if (_strategicAccountSwitcherBound) return;
    const trigger = document.getElementById('strategic-account-switcher-trigger');
    const menu = document.getElementById('strategic-account-switcher-menu');
    if (!trigger || !menu) return;

    _strategicAccountSwitcherBound = true;

    trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = !menu.classList.contains('hidden');
        menu.classList.toggle('hidden', isOpen);
        trigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        if (!isOpen) {
            renderStrategicAccountSwitcherMenu();
        }
    });

    menu.addEventListener('click', async (event) => {
        const btn = event.target instanceof Element ? event.target.closest('[data-strategic-account-id]') : null;
        if (!(btn instanceof HTMLButtonElement)) return;
        const accountId = Number(btn.dataset.strategicAccountId);
        if (!accountId) return;
        menu.classList.add('hidden');
        trigger.setAttribute('aria-expanded', 'false');
        if (typeof _options.switchStrategicAccount === 'function') {
            await _options.switchStrategicAccount(accountId);
        }
    });

    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;
        if (event.target.closest('#strategic-account-switcher-trigger, #strategic-account-switcher-menu')) return;
        menu.classList.add('hidden');
        trigger.setAttribute('aria-expanded', 'false');
    });
}

function renderStrategicAccountSwitcherMenu() {
    const menu = document.getElementById('strategic-account-switcher-menu');
    if (!menu) return;

    const accounts = _options.getAccountsList?.() ?? [];
    const activeId = _options.getSelectedAccountId?.();

    menu.innerHTML = accounts.map((account) => {
        const isActive = Number(account.id) === Number(activeId);
        return `<button type="button" class="strategic-account-switcher-item${isActive ? ' strategic-account-switcher-item--active' : ''}" data-strategic-account-id="${account.id}" role="option" aria-selected="${isActive ? 'true' : 'false'}">${escapeHtml(account.name || 'Account')}</button>`;
    }).join('') || '<p class="strategic-account-switcher-empty">No accounts available.</p>';
}

/**
 * One-time delegated click + scroll-spy on the canvas scroll container.
 */
function initStrategicViewModeNavigation() {
    const header = document.querySelector('.strategic-workspace-header');
    if (!header || _strategicViewModeNavBound) return;
    _strategicViewModeNavBound = true;
    header.addEventListener('click', onStrategicViewModeClick);
}

function initStrategicPathNavigation() {
    const path = document.getElementById('strategic-path');
    const canvas = document.getElementById('strategic-document-canvas');
    if (!path || !canvas) return;

    if (!_strategicPathNavBound) {
        _strategicPathNavBound = true;
        path.addEventListener('click', onStrategicPathClick);
    }

    teardownStrategicPathScrollSpy();
    _strategicPathScrollHandler = () => {
        if (Date.now() < _pathScrollLockUntil) return;
        syncStrategicPathActive();
    };
    canvas.addEventListener('scroll', _strategicPathScrollHandler, { passive: true });

    requestAnimationFrame(() => syncStrategicPathActive());
}

function teardownStrategicPathScrollSpy() {
    const canvas = document.getElementById('strategic-document-canvas');
    if (canvas && _strategicPathScrollHandler) {
        canvas.removeEventListener('scroll', _strategicPathScrollHandler);
        _strategicPathScrollHandler = null;
    }
}

function teardownStrategicPathNavigation() {
    teardownStrategicPathScrollSpy();
}

/**
 * @param {Event} event
 */
function onStrategicViewModeClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const modeBtn = target.closest('[data-view-mode]');
    if (!(modeBtn instanceof HTMLButtonElement)) return;

    event.preventDefault();
    const mode = modeBtn.dataset.viewMode === 'deep' ? 'deep' : 'core';
    if (mode !== _saosViewMode) {
        setSaosViewMode(mode);
    }
}

function onStrategicPathClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const btn = target.closest('.strategic-path-step');
    if (!(btn instanceof HTMLButtonElement)) return;

    const sectionId = btn.dataset.sectionId;
    if (!sectionId) return;

    scrollStrategicSectionIntoView(sectionId);
    setStrategicPathActive(sectionId);
    _pathScrollLockUntil = Date.now() + 900;
}

/**
 * @param {string} sectionId
 */
function scrollStrategicSectionIntoView(sectionId) {
    const canvas = document.getElementById('strategic-document-canvas');
    const sectionEl = document.getElementById(`strategic-section-${sectionId}`);
    if (!canvas || !sectionEl) return;

    const canvasTop = canvas.getBoundingClientRect().top;
    const sectionTop = sectionEl.getBoundingClientRect().top;
    const delta = sectionTop - canvasTop - 12;

    canvas.scrollTo({ top: canvas.scrollTop + delta, behavior: 'smooth' });
}

/**
 * Highlight the Path step for the section nearest the top of the canvas viewport.
 */
function syncStrategicPathActive() {
    const canvas = document.getElementById('strategic-document-canvas');
    if (!canvas) return;

    const visibleIds = new Set(getCanvasPlanSections().map((section) => section.id));
    const sections = canvas.querySelectorAll('.strategic-section[id]');
    if (!sections.length) return;

    const canvasRect = canvas.getBoundingClientRect();
    const anchorY = canvasRect.top + 64;

    let activeId = null;
    sections.forEach((section) => {
        const sectionKey = section.id.replace(/^strategic-section-/, '');
        if (!visibleIds.has(sectionKey)) return;
        if (section.getBoundingClientRect().top <= anchorY) {
            activeId = sectionKey;
        }
    });

    if (!activeId) {
        const firstVisible = getCanvasPlanSections()[0];
        activeId = firstVisible?.id || null;
    }

    if (activeId) {
        setStrategicPathActive(activeId);
    }
}

/**
 * @param {string} sectionId
 */
function setStrategicPathActive(sectionId) {
    const track = document.getElementById('strategic-path-track');
    if (!track) return;

    track.querySelectorAll('.strategic-path-step').forEach((btn) => {
        if (!(btn instanceof HTMLButtonElement)) return;
        const isActive = btn.dataset.sectionId === sectionId;
        btn.classList.toggle('strategic-path-step--active', isActive);
        btn.setAttribute('aria-current', isActive ? 'step' : 'false');
    });

    const activeBtn = track.querySelector('.strategic-path-step--active');
    if (activeBtn instanceof HTMLElement) {
        activeBtn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
}

function requestAccountViewMode(mode) {
    if (mode === 'strategic') {
        if (!_options.getSelectedAccountId?.()) return;
        if (_options.isFormDirty?.()) {
            _options.onConfirmDiscardUnsaved?.(() => {
                _options.clearFormDirty?.();
                setAccountViewMode('strategic', { skipDirtyCheck: true });
            });
            return;
        }
    }
    setAccountViewMode(mode, { skipDirtyCheck: true });
}

function moveHeaderControls(mode) {
    const controls = document.getElementById('account-mode-controls');
    const versionTrigger = document.getElementById('plan-version-trigger');
    const tacticalHost = document.getElementById('tactical-header-actions');
    const strategicHost = document.getElementById('strategic-header-actions');
    const aiBriefing = document.getElementById('ai-briefing-btn');

    if (mode === 'strategic') {
        if (versionTrigger && strategicHost) {
            strategicHost.insertBefore(versionTrigger, strategicHost.firstChild);
        }
        if (controls && strategicHost) {
            strategicHost.appendChild(controls);
        }
        return;
    }

    if (controls && tacticalHost) {
        if (aiBriefing && tacticalHost.contains(aiBriefing)) {
            tacticalHost.insertBefore(controls, aiBriefing);
        } else {
            tacticalHost.appendChild(controls);
        }
    }
}

function updateToggleUi(mode) {
    const toggle = document.getElementById('account-mode-toggle');
    if (!toggle) return;
    const isStrategic = mode === 'strategic';
    toggle.setAttribute('aria-pressed', isStrategic ? 'true' : 'false');
    toggle.title = isStrategic ? 'Return to Tactical view' : 'Open Strategic Account OS';
    toggle.classList.toggle('account-mode-toggle-active', isStrategic);
}

function updateAutosaveVisibility(mode) {
    const autosave = document.getElementById('strategic-autosave-status');
    if (!autosave) return;
    autosave.classList.toggle('hidden', mode !== 'strategic');
    if (mode !== 'strategic') {
        autosave.textContent = '';
        autosave.dataset.status = 'idle';
    }
}

function updateVersionTriggerVisibility(mode) {
    const trigger = document.getElementById('plan-version-trigger');
    if (!trigger) return;
    trigger.classList.toggle('hidden', mode !== 'strategic');
    if (mode !== 'strategic') closeVersionPopover();
}

/**
 * @param {'idle' | 'pending' | 'saving' | 'saved' | 'error'} status
 * @param {{ error?: string, updated_at?: string }} [detail]
 */
function updateAutosaveStatusUi(status, detail = {}) {
    const chip = document.getElementById('strategic-autosave-status');
    if (!chip || _activeMode !== 'strategic') return;

    chip.dataset.status = status;
    const labels = {
        idle: '',
        pending: 'Unsaved changes…',
        saving: 'Saving…',
        saved: 'Saved',
        error: detail.error ? `Error: ${detail.error}` : 'Save failed',
    };
    chip.textContent = labels[status] || '';
    chip.classList.toggle('hidden', status === 'idle' && !chip.textContent);
}

export function updateStrategicModeControls() {
    syncAccountPlanContext(_options.getAccountPlan?.() ?? null);
    updateToggleDisabled();
    if (_activeMode === 'strategic') {
        renderStrategicShell(
            _options.getSelectedAccount?.() ?? null,
            _planBaseline
        );
    }
}

function updateToggleDisabled() {
    const toggle = document.getElementById('account-mode-toggle');
    if (!toggle) return;
    toggle.disabled = !_options.getSelectedAccountId?.();
}

/**
 * @param {object | null} account
 * @param {import('./account-plan-data.js').AccountPlanDocument | null} plan
 */
export function renderStrategicShell(account, plan) {
    const normalizedPlan = plan ? normalizePlan(plan) : createEmptyPlan();
    _planBaseline = deepClonePlan(normalizedPlan);
    _liveSections = deepClonePlan(_planBaseline).current_draft.sections;
    _entryPointActiveIndex = 0;

    const canvas = document.getElementById('strategic-document-canvas');
    const titleEl = document.getElementById('strategic-account-title');

    if (titleEl) {
        titleEl.textContent = account?.name
            ? `${account.name} — Strategic Plan`
            : 'Strategic Account Plan';
    }

    if (canvas) {
        loadSaosViewMode();
        applySaosViewModeToCanvas();
        paintCanvas();
        bindCanvasFormEvents(canvas);
    }

    renderRail(_liveSections);
    renderVersionTimeline(_planBaseline);
    updateVersionTriggerLabel(_planBaseline);
    updateToggleDisabled();
    renderStrategicViewMode();
    renderStrategicPath();
    renderStrategicAccountSwitcherMenu();
    requestAnimationFrame(() => syncStrategicPathActive());
}

/**
 * @param {{ description?: string, tips?: string[] }} section
 */
function buildSectionContextHtml(section) {
    const hasDescription = Boolean(section.description);
    const hasTips = Array.isArray(section.tips) && section.tips.length > 0;
    if (!hasDescription && !hasTips) {
        return '';
    }

    const descriptionHtml = hasDescription
        ? `<p>${escapeHtml(section.description)}</p>`
        : '';
    const tipsHtml = hasTips
        ? `<ul>${section.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>`
        : '';

    return `<div class="strategic-section-context">${descriptionHtml}${tipsHtml}</div>`;
}

/**
 * @param {{ description?: string, tips?: string[], contextMode?: string }} section
 * @returns {{ leadHtml: string, blockHtml: string }}
 */
function buildSectionHeaderContext(section) {
    const mode = section.contextMode
        || (Array.isArray(section.tips) && section.tips.length ? 'block' : section.description ? 'lead' : 'none');

    if (mode === 'block') {
        return { leadHtml: '', blockHtml: buildSectionContextHtml(section) };
    }

    if (mode === 'lead' && section.description) {
        return {
            leadHtml: `<p class="strategic-section-lead">${escapeHtml(section.description)}</p>`,
            blockHtml: '',
        };
    }

    return { leadHtml: '', blockHtml: '' };
}

/**
 * @param {string | undefined} hint
 */
function buildFieldHintHtml(hint) {
    if (!hint) return '';
    return `<div class="strategic-field-context"><p>${escapeHtml(hint)}</p></div>`;
}

/**
 * @param {string} sectionId
 * @param {{ key: string, label?: string, hint?: string }} field
 * @param {unknown} rawValue
 */
/**
 * Build the rapid-fire "Blindspots" list UI (Task 3). The data shape is
 * a flat string[] under sections.critical_unknowns.blindspots — see the
 * Task 3 commentary in account-plan-data.js for the rename rationale.
 *
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} data
 */
function buildBlindspotsListHtml(section, data) {
    const obj = isPlainObject(data) ? data : {};
    const items = Array.isArray(obj.blindspots) ? obj.blindspots : [];
    const inputId = `blindspots-input-${section.id}`;

    // Each row is keyed by its index so the surrounding canvas re-render
    // (refreshBlindspotsSection) can rebuild the list cheaply. We use
    // <button type="button"> for remove so the Enter-key handler on
    // the input doesn't accidentally trigger a row removal.
    const rowsHtml = items.length > 0
        ? items.map((entry, index) => {
            const text = String(entry ?? '').trim();
            if (!text) return '';
            return `
                <li class="blindspots-item" data-blindspots-index="${index}">
                    <span class="blindspots-item-bullet" aria-hidden="true">▢</span>
                    <span class="blindspots-item-text">${escapeHtml(text)}</span>
                    <button
                        type="button"
                        class="blindspots-item-remove"
                        data-blindspots-remove="${index}"
                        aria-label="Remove blindspot: ${escapeHtml(text)}"
                    >×</button>
                </li>`;
        }).join('')
        : `<li class="blindspots-empty">Add the open questions you must answer on your next discovery call.</li>`;

    return `
        <div class="blindspots-list-wrap" data-blindspots-host>
            <ul class="blindspots-list" role="list">${rowsHtml}</ul>
            <div class="blindspots-add-row">
                <label class="sr-only" for="${inputId}">Add a blindspot</label>
                <input
                    type="text"
                    id="${inputId}"
                    class="strategic-field blindspots-add-input"
                    data-blindspots-input
                    placeholder="One question per line — e.g. Who actually signs the SOW?"
                    autocomplete="off"
                />
                <button
                    type="button"
                    class="blindspots-add-btn"
                    data-blindspots-add
                >Add</button>
            </div>
        </div>`;
}

function buildCompositeFieldHtml(sectionId, field, rawValue) {
    const rawString = String(rawValue ?? '');
    const value = escapeHtml(rawString);
    const hintHtml = buildFieldHintHtml(field.hint);
    const fieldId = `strategic-field-${sectionId}-${field.key}`;
    const nestedMeta = Boolean(field.label && field.hint);

    // Task 3 — Insight Density: only certain narrative sections (Pursuit
    // Thesis, Competitive Landscape) earn the soft cap nudge. Everywhere else
    // — gravity, narrative_openings, etc. — long-form writing is appropriate.
    const isInsightField = INSIGHT_DENSITY_SECTIONS.includes(sectionId);
    const len = rawString.length;
    const isDense = isInsightField && len > INSIGHT_DENSITY_SOFT_LIMIT;

    const textareaClassNames = [
        'strategic-field',
        'strategic-textarea',
        isInsightField ? 'strategic-insight-textarea' : '',
        isDense ? 'strategic-insight-textarea--dense' : '',
    ].filter(Boolean).join(' ');

    const insightAttrs = isInsightField
        ? ` data-insight-soft-limit="${INSIGHT_DENSITY_SOFT_LIMIT}"`
        : '';

    const textareaHtml = `
        <textarea
            id="${fieldId}"
            class="${textareaClassNames}"
            data-field="${sectionId}.${field.key}"
            rows="3"${insightAttrs}
        >${value}</textarea>`;

    // The counter is purposely *only* visible when dense (via CSS class). We
    // still render it always so the DOM is stable between renders — toggling
    // the dense class is cheaper than inserting/removing the element.
    const counterClass = `strategic-insight-counter${isDense ? ' strategic-insight-counter--dense' : ''}`;
    const insightCounter = isInsightField
        ? `<span class="${counterClass}" data-insight-counter aria-hidden="true">${len} / ${INSIGHT_DENSITY_SOFT_LIMIT}</span>`
        : '';

    const wrappedTextarea = isInsightField
        ? `<div class="strategic-insight-wrap">${textareaHtml}${insightCounter}</div>`
        : textareaHtml;

    if (field.label && !field.hint) {
        return `
            <div class="strategic-composite-field">
                <label for="${fieldId}">${escapeHtml(field.label)}</label>
                <div class="strategic-composite-field-body">
                    ${wrappedTextarea}
                </div>
            </div>`;
    }

    if (nestedMeta) {
        return `
            <div class="strategic-composite-field strategic-composite-field--with-hint strategic-composite-field--nested-meta">
                <div class="strategic-composite-field-body">
                    <div class="strategic-composite-field-aside">
                        <div class="strategic-composite-field-meta">
                            <label for="${fieldId}">${escapeHtml(field.label)}</label>
                            ${hintHtml}
                        </div>
                    </div>
                    ${wrappedTextarea}
                </div>
            </div>`;
    }

    return `
        <div class="strategic-composite-field strategic-composite-field--with-hint">
            <div class="strategic-composite-field-body">
                <div class="strategic-composite-field-aside">${hintHtml}</div>
                ${wrappedTextarea}
            </div>
        </div>`;
}

/**
 * @param {string} sectionId
 * @param {string} headingId
 * @param {string} title
 * @param {{ leadHtml?: string, blockHtml?: string }} headerContext
 * @param {string} bodyHtml
 * @param {string} [extraClass]
 */
function wrapStrategicSection(sectionId, headingId, title, headerContext, bodyHtml, extraClass = '') {
    const leadHtml = headerContext.leadHtml || '';
    const blockHtml = headerContext.blockHtml || '';
    const classNames = ['strategic-section', 'strategic-section-card', extraClass].filter(Boolean).join(' ');
    return `
        <section id="${sectionId}" class="${classNames}" aria-labelledby="${headingId}">
            <h4 id="${headingId}" class="strategic-section-title">${escapeHtml(title)}</h4>
            ${leadHtml}
            ${blockHtml}
            ${bodyHtml}
        </section>`;
}

function paintCanvas() {
    const canvas = document.getElementById('strategic-document-canvas');
    if (!canvas || !_liveSections) return;

    const points = Array.isArray(_liveSections.entry_points) ? _liveSections.entry_points : [];
    _entryPointActiveIndex = Math.min(_entryPointActiveIndex, Math.max(0, points.length - 1));

    canvas.innerHTML = `<div class="strategic-document-inner">${buildCanvasHtml(_liveSections, _entryPointActiveIndex)}</div>`;
    initAutoExpandTextareas(canvas);
    initPsychologySliders(canvas);
    initInteractionLogControls(canvas);

    if (_activeMode === 'strategic') {
        requestAnimationFrame(() => syncStrategicPathActive());
    }
}

// ---------------------------------------------------------------------------
// Task 1 — Strategic Ghosting (cross-section state awareness)
// ---------------------------------------------------------------------------
// Why this exists: reps default to brain-dumping 30/60/90 actions without
// referencing the strategic contradictions they just selected one section up.
// We render a non-editable "ghost" of the chosen tensions inside the plan
// sections so the rep cannot *visually* escape them while drafting actions.
//
// Critical: this is a passive READ. The ghost must never write back to
// strategic_tensions or re-trigger a full canvas paint — that would create a
// pill-toggle -> repaint -> focus-loss -> autosave loop. We only mutate the
// innerHTML of the ghost host node, which carries no event listeners.
// ---------------------------------------------------------------------------

/**
 * Resolve each currently selected strategic_tensions pill back to its
 * either_or group so the ghost can show "<chosen> over <alternative>" — that
 * phrasing is what forces the rep to remember a decision was made.
 *
 * @param {string} pill
 * @returns {{ chosen: string, alternative: string } | null}
 */
function resolveTensionGhostPair(pill) {
    if (typeof pill !== 'string' || !pill.trim()) return null;
    for (const group of STRATEGIC_TENSION_GROUPS) {
        const options = group.options;
        const idx = options.indexOf(pill);
        if (idx >= 0) {
            return { chosen: pill, alternative: options[idx === 0 ? 1 : 0] };
        }
    }
    return { chosen: pill, alternative: '' };
}

/**
 * Inner HTML for the ghost reminder (everything inside the <aside> wrapper).
 * Split out so refresh can swap the body without touching the host element
 * itself.
 *
 * The optional `hostSectionId` parameter is used to look up an opt-in
 * "tension linkage" prompt (Task 4). When the host section is registered
 * in TENSION_LINKAGE_PROMPTS we append a directive question that forces
 * the rep to wire their selected tensions THROUGH the strategy below —
 * e.g. "How does our Land & Expand strategy resolve your identified
 * tension: Cloud?". Without this nudge reps habitually default to
 * generic "build trust, expand footprint" prose that ignores the
 * tension they just picked one section above.
 *
 * @param {unknown} tensions
 * @param {string} [hostSectionId]
 * @returns {string}
 */
function buildStrategicTensionGhostInner(tensions, hostSectionId = '') {
    const rawPills = isPlainObject(tensions) && Array.isArray(tensions.selected_pills)
        ? tensions.selected_pills
        : [];

    // Defensive filtering — even though the autosave sanitizer (Task 4) cleans
    // strategic_tensions before persisting, an in-memory pill toggle can leave a
    // transient empty string in the array between toggles. We never want to
    // render an empty ghost pill.
    const pairs = rawPills
        .map(resolveTensionGhostPair)
        .filter((pair) => pair && pair.chosen);

    if (pairs.length === 0) {
        return `
            <p class="strategic-ghost-headline strategic-ghost-headline--empty">
                No competing priorities captured yet — open the ${escapeHtml(TACTICAL_UX_LABELS.competingPriorities)}
                section above so this plan is anchored to the deal's physics.
            </p>`;
    }

    const headline = pairs.length === 1
        ? `Reminder: this account is balancing <strong>${escapeHtml(pairs[0].chosen)}</strong>${pairs[0].alternative ? ` over <em>${escapeHtml(pairs[0].alternative)}</em>` : ''}.`
        : `Reminder: this account is balancing the following tensions — every action below should reinforce these choices, not contradict them.`;

    const pillsHtml = pairs.map((pair) => {
        const altSuffix = pair.alternative
            ? `<span class="strategic-ghost-pill-alt"> over ${escapeHtml(pair.alternative)}</span>`
            : '';
        return `<span class="strategic-ghost-pill"><strong>${escapeHtml(pair.chosen)}</strong>${altSuffix}</span>`;
    }).join('');

    // Task 4 — accountability prompt. Centralized in
    // buildTensionLinkagePromptText so AI/export layers can reuse the
    // exact phrasing later if they want to surface this prompt in a
    // slide deck. We render it as a follow-on paragraph inside the same
    // <aside> so the existing refresh path keeps it in sync.
    const linkageSectionLabel = hostSectionId
        ? (TENSION_LINKAGE_PROMPTS && TENSION_LINKAGE_PROMPTS[hostSectionId]) || ''
        : '';
    const linkagePromptText = linkageSectionLabel
        ? buildTensionLinkagePromptText(linkageSectionLabel, pairs.map((p) => p.chosen))
        : '';
    const linkagePromptHtml = linkagePromptText
        ? `<p class="strategic-ghost-linkage-prompt" data-tension-linkage-host="${escapeHtml(hostSectionId)}">${escapeHtml(linkagePromptText)}</p>`
        : '';

    return `
        <p class="strategic-ghost-headline">${headline}</p>
        <div class="strategic-ghost-pills">${pillsHtml}</div>
        ${linkagePromptHtml}`;
}

/**
 * Full ghost reminder block (aside + inner). Called from buildCanvasHtml at
 * paint time. The data-tension-ghost-host attribute lets refresh target the
 * right hosts when pills change.
 *
 * @param {unknown} tensions
 * @param {string} hostSectionId
 * @returns {string}
 */
function buildStrategicTensionGhostHtml(tensions, hostSectionId) {
    return `
        <aside
            class="strategic-ghost-reminder"
            data-tension-ghost-host="${escapeHtml(hostSectionId)}"
            aria-live="polite"
            aria-label="Strategic tensions reminder"
        >${buildStrategicTensionGhostInner(tensions, hostSectionId)}</aside>`;
}

/**
 * Cheap incremental refresh — replaces only the inner HTML of every ghost
 * host, leaving the rest of the canvas (including the focused field) intact.
 * Safe to call from inside a pill click handler.
 */
function refreshStrategicTensionGhosts() {
    if (!_liveSections) return;
    const tensions = _liveSections.strategic_tensions;
    document.querySelectorAll('[data-tension-ghost-host]').forEach((host) => {
        if (!(host instanceof HTMLElement)) return;
        // Forward the section ID so the linkage prompt (Task 4) keeps
        // its phrasing in sync as the host changes (e.g. if we add more
        // linkage-enabled sections in the future).
        const hostSectionId = host.dataset.tensionGhostHost || '';
        host.innerHTML = buildStrategicTensionGhostInner(tensions, hostSectionId);
    });
}

// ---------------------------------------------------------------------------
// Task 2 — Influence Pipeline (zero-friction linkage)
// ---------------------------------------------------------------------------
// Why this exists: typing a contact's name twice (once on the influence board,
// once in the entry-point carousel) is exactly the kind of busywork that makes
// reps disengage from the plan. We auto-stub a Target Profile when they
// promote a contact to Executive or Mid-Level. We deliberately do NOT auto-
// delete when they later demote — narrative work (Best Themes, Why They
// Matter) is expensive and shouldn't disappear because a rep is reorganizing
// the org chart. Instead we flag the profile so the rep can decide whether to
// keep, edit, or delete it manually.
// ---------------------------------------------------------------------------

/**
 * Buckets that earn an auto-stubbed entry point. Technical contacts rarely
 * become primary entry points, and stubbing one creates more clutter than
 * value.
 */
const INFLUENCE_AUTO_STUB_BUCKETS = Object.freeze(['executive', 'mid_level']);

/**
 * Lookup helper used by the carousel to decide whether a profile is still in
 * sync with the influence board.
 *
 * @param {string} contactId
 * @returns {boolean}
 */
function isContactCurrentlyMappedToInfluence(contactId) {
    if (!_liveSections || !contactId) return false;
    const mapping = _liveSections.influence_mapping;
    if (!isPlainObject(mapping)) return false;
    const id = String(contactId);
    return INFLUENCE_AUTO_STUB_BUCKETS.some((bucket) => {
        const list = normalizeInfluenceEntries(mapping[bucket]);
        return list.some((entry) => String(entry.id) === id);
    });
}

/**
 * Create a new entry point shell for a contact if one doesn't already exist.
 * Returns true if a stub was inserted (so the caller knows whether to refresh
 * the carousel).
 *
 * @param {string} contactId
 * @param {string} contactName
 * @returns {boolean}
 */
function ensureEntryPointForContact(contactId, contactName) {
    if (!_liveSections || !contactId) return false;

    const id = String(contactId);
    const points = Array.isArray(_liveSections.entry_points)
        ? [..._liveSections.entry_points]
        : [];

    const alreadyExists = points.some((point) => (
        isPlainObject(point) && String(point.contact_id ?? '') === id
    ));
    if (alreadyExists) return false;

    if (points.length >= MAX_ENTRY_POINTS) {
        // Surface a toast — silently dropping the stub would be confusing
        // ("I dragged the contact, why didn't anything happen?"). MAX_ENTRY_POINTS
        // is intentionally low (5) because the AI/PPTX engines summarize a
        // *focused* roster, not a dump of every contact.
        _options.onToast?.(
            `Entry-point roster is full (max ${MAX_ENTRY_POINTS}). Remove one before promoting another contact.`,
            'error'
        );
        return false;
    }

    const stub = {
        ...createEmptyEntryPoint(),
        contact_id: id,
        contact_name: String(contactName || '').trim(),
    };
    points.push(stub);
    _liveSections.entry_points = points;
    return true;
}

/**
 * Full re-render of the entry-point carousel (used after auto-stub + after
 * influence demotion so the "Unmapped" badge appears/disappears).
 *
 * This rebuilds the DOM inside the section but does NOT call paintCanvas —
 * that preserves focus and slider positions elsewhere on the page.
 */
function refreshEntryPointsSection() {
    const sectionEl = document.getElementById('strategic-section-entry_points');
    const sectionDef = PLAN_SECTIONS.find((section) => section.id === 'entry_points');
    if (!sectionEl || !sectionDef || !_liveSections) return;

    const headingId = `strategic-heading-${sectionDef.id}`;
    const headerContext = buildSectionHeaderContext(sectionDef);
    const points = Array.isArray(_liveSections.entry_points) ? _liveSections.entry_points : [];
    _entryPointActiveIndex = Math.min(_entryPointActiveIndex, Math.max(0, points.length - 1));
    const bodyHtml = buildEntryPointCarouselHtml(sectionDef, points, _entryPointActiveIndex);

    sectionEl.innerHTML = `
        <h4 id="${headingId}" class="strategic-section-title">${escapeHtml(sectionDef.title)}</h4>
        ${headerContext.leadHtml}
        ${headerContext.blockHtml}
        ${bodyHtml}`;

    initAutoExpandTextareas(sectionEl);
}

// ---------------------------------------------------------------------------
// Task 3 — Insight Density nudge
// ---------------------------------------------------------------------------
// Why this exists: a 700-character Pursuit Thesis is not a thesis — it's a
// summary the rep should have done themselves. The AI engine downstream
// performs poorly when forced to re-synthesize prose; the PPTX engine
// truncates mid-sentence. A soft border-color nudge at 400 characters trains
// the rep to do the synthesis up front.
// ---------------------------------------------------------------------------

/**
 * Toggle the "dense" visual state on a textarea and update its tiny counter
 * label. Called from the canvas input listener on every keystroke.
 *
 * @param {HTMLTextAreaElement} textarea
 */
function updateInsightDensityState(textarea) {
    if (!textarea.classList.contains('strategic-insight-textarea')) return;
    const limit = Number(textarea.dataset.insightSoftLimit) || INSIGHT_DENSITY_SOFT_LIMIT;
    const len = textarea.value.length;
    const dense = len > limit;
    textarea.classList.toggle('strategic-insight-textarea--dense', dense);
    const wrap = textarea.parentElement;
    const counter = wrap?.querySelector('[data-insight-counter]');
    if (counter instanceof HTMLElement) {
        counter.textContent = `${len} / ${limit}`;
        counter.classList.toggle('strategic-insight-counter--dense', dense);
    }
}

// All Active Coaching Workspace styling (ghost reminder, Insight Density
// nudge, Unmapped tab flag) lives in css/saos-strategic.css — the project's
// plain-CSS override layer loaded after output.css. This keeps the cascade
// predictable (active tab beats unmapped, no !important needed) and matches
// the convention for new SAOS visuals.

const ENTRY_POINT_OTHER_LABEL = 'Other / External';

/**
 * @returns {object[]}
 */
function getAccountContacts() {
    const details = _options.getSelectedAccountDetails?.();
    return Array.isArray(details?.contacts) ? details.contacts : [];
}

/**
 * @param {unknown} value
 * @returns {{ id: string, notes: string }[]}
 */
function normalizeInfluenceEntries(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry) => {
            if (entry == null) return null;
            if (typeof entry === 'string' || typeof entry === 'number') {
                const empty = { id: String(entry), notes: '' };
                INFLUENCE_CONTACT_FIELD_KEYS.forEach((key) => {
                    empty[key] = '';
                });
                return empty;
            }
            if (isPlainObject(entry) && entry.id != null) {
                const normalized = {
                    id: String(entry.id),
                    notes: entry.notes != null ? String(entry.notes) : '',
                };
                INFLUENCE_CONTACT_FIELD_KEYS.forEach((key) => {
                    normalized[key] = entry[key] != null ? String(entry[key]) : '';
                });
                return normalized;
            }
            return null;
        })
        .filter(Boolean);
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} data
 */
function buildCompositeTextareaHtml(section, data) {
    const obj = isPlainObject(data) ? data : {};
    const fields = section.fields || [];
    return `<div class="strategic-composite-grid">${fields.map((field) => {
        const fieldHtml = buildCompositeFieldHtml(section.id, field, obj[field.key]);
        // The executive_narrative box pairs with a row of hint pills
        // (Growth / Resiliency / Modernization / …). The pills are
        // anchored to that specific subfield, so the special case is
        // unchanged post-Task-2 — only the surrounding `thesis` field
        // changed identity.
        if (section.id === 'pursuit_thesis' && field.key === 'executive_narrative') {
            return `${fieldHtml}${buildExecutiveNarrativeHintPillsHtml()}`;
        }
        return fieldHtml;
    }).join('')}</div>`;
}

function buildExecutiveNarrativeHintPillsHtml() {
    const pillsHtml = CRITICAL_UNKNOWN_LANGUAGE_PILLS.map((pill) => (
        `<button type="button" class="strategic-hint-pill" data-hint-pill-target="pursuit_thesis.executive_narrative" data-hint-pill-value="${escapeHtml(pill)}">${escapeHtml(pill)}</button>`
    )).join('');

    return `
        <div class="strategic-hint-pills-group" aria-label="Executive language hints">
            <span class="strategic-hint-pills-label">Language hints</span>
            <div class="strategic-hint-pills-wrap">${pillsHtml}</div>
        </div>`;
}

/**
 * Render the read-only "Firmographics (CRM)" block at the top of the Account
 * Snapshot. Visual goals (separate from data semantics):
 *   - Make it unmistakably *sourced from CRM* — that's why the small "CRM"
 *     badge sits beside the heading. Reps habitually try to edit this block
 *     and the badge plus the inline note steer them to Tactical view instead.
 *   - Use a card-grid with icon affordances so the section scans as
 *     "structured facts" (vs the editable judgments below it which use pills
 *     and free-text). The icons are decorative, hence aria-hidden.
 *   - Render Customer Status as a colored pill instead of bare text so the
 *     single most consequential field on this block reads at a glance.
 *
 * Empty values render as a muted em-dash in italic — visually quieter so the
 * rep's eye is drawn to the populated rows.
 *
 * @param {object | null | undefined} account
 */
function buildAccountSnapshotCrmHtml(account) {
    const acct = isPlainObject(account) ? account : {};

    /**
     * Each row is data + an icon hint. Icon classes come from the Font Awesome
     * 6 set that accounts.html already loads — no new dependency.
     * @type {Array<{ label: string, value: unknown, icon: string }>}
     */
    const rows = [
        { label: 'Account Name', value: acct.name, icon: 'fas fa-id-badge' },
        { label: 'Industry', value: acct.industry, icon: 'fas fa-industry' },
        { label: 'Employees', value: acct.employee_count, icon: 'fas fa-users' },
        { label: 'Sites', value: acct.quantity_of_sites, icon: 'fas fa-map-pin' },
        { label: 'Address', value: acct.address, icon: 'fas fa-location-dot' },
    ];

    const items = rows.map(({ label, value, icon }) => {
        const hasValue = value != null && String(value).trim() !== '';
        const display = hasValue ? String(value) : '—';
        const valueClass = hasValue
            ? 'account-snapshot-crm-value'
            : 'account-snapshot-crm-value account-snapshot-crm-value--empty';
        return `
            <div class="account-snapshot-crm-card">
                <span class="account-snapshot-crm-icon" aria-hidden="true"><i class="${icon}"></i></span>
                <div class="account-snapshot-crm-card-body">
                    <span class="account-snapshot-crm-label">${escapeHtml(label)}</span>
                    <span class="${valueClass}" title="${escapeHtml(display)}">${escapeHtml(display)}</span>
                </div>
            </div>`;
    }).join('');

    // Customer Status is rendered as its own colored pill so it pops over the
    // plain-text firmographics rows. Three visual states keep the cardinality
    // honest: customer (active, success accent), prospect (neutral accent),
    // unknown (dashed muted — signals "not set in CRM yet"). Inner pill icon
    // is state-specific so the colorblind / dense-eye glance still parses.
    let statusModifier = 'account-snapshot-crm-status--unknown';
    let statusLabel = 'Unknown';
    let statusIcon = 'fas fa-circle-question';
    if (acct.is_customer === true) {
        statusModifier = 'account-snapshot-crm-status--customer';
        statusLabel = 'Customer';
        statusIcon = 'fas fa-circle-check';
    } else if (acct.is_customer === false) {
        statusModifier = 'account-snapshot-crm-status--prospect';
        statusLabel = 'Prospect';
        statusIcon = 'fas fa-seedling';
    }

    const statusCard = `
        <div class="account-snapshot-crm-card account-snapshot-crm-card--status">
            <span class="account-snapshot-crm-icon" aria-hidden="true"><i class="fas fa-handshake"></i></span>
            <div class="account-snapshot-crm-card-body">
                <span class="account-snapshot-crm-label">Customer Status</span>
                <span class="account-snapshot-crm-status ${statusModifier}">
                    <i class="${statusIcon}" aria-hidden="true"></i>
                    <span>${escapeHtml(statusLabel)}</span>
                </span>
            </div>
        </div>`;

    return `
        <div class="account-snapshot-crm">
            <div class="account-snapshot-crm-header">
                <h5 class="account-snapshot-subheading account-snapshot-crm-title">
                    <i class="fas fa-database account-snapshot-crm-title-icon" aria-hidden="true"></i>
                    Firmographics
                </h5>
                <span class="account-snapshot-crm-source" title="Sourced from CRM — edit in Tactical view">
                    <i class="fas fa-link" aria-hidden="true"></i>
                    CRM
                </span>
            </div>
            <p class="account-snapshot-crm-note">Read-only — edit in Tactical view.</p>
            <div class="account-snapshot-crm-grid">${items}${statusCard}</div>
        </div>`;
}

/**
 * @param {string} sectionId
 * @param {string} fieldKey
 * @param {string} label
 * @param {readonly string[]} options
 * @param {string} value
 */
function buildSnapshotPillField(sectionId, fieldKey, label, options, value) {
    const pillOptions = options.filter((option) => option !== '');
    const pillsHtml = pillOptions.map((option) => {
        const active = value === option ? ' account-snapshot-pill--active' : '';
        const pressed = value === option ? 'true' : 'false';
        return `
            <button
                type="button"
                class="account-snapshot-pill${active}"
                data-field="${sectionId}.${fieldKey}"
                data-pill-value="${escapeHtml(option)}"
                aria-pressed="${pressed}"
            >${escapeHtml(option)}</button>`;
    }).join('');

    return `
        <div class="account-snapshot-field">
            <span class="account-snapshot-field-label">${escapeHtml(label)}</span>
            <div class="account-snapshot-pills-wrap" role="group" aria-label="${escapeHtml(label)}">
                ${pillsHtml}
            </div>
        </div>`;
}

/**
 * @param {string} sectionId
 * @param {string} fieldKey
 * @param {string} label
 * @param {string} value
 */
function buildSnapshotTextareaField(sectionId, fieldKey, label, value) {
    const fieldId = `strategic-field-${sectionId}-${fieldKey}`;
    return `
        <div class="account-snapshot-field account-snapshot-field--wide">
            <label for="${fieldId}">${escapeHtml(label)}</label>
            <textarea
                id="${fieldId}"
                class="strategic-field strategic-textarea"
                data-field="${sectionId}.${fieldKey}"
                rows="3"
            >${escapeHtml(value)}</textarea>
        </div>`;
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} data
 * @param {object | null | undefined} account
 */
function buildAccountSnapshotHtml(section, data, account) {
    const snapshot = isPlainObject(data) ? data : {};
    const tier = String(snapshot.tier ?? '');
    const relationshipStatus = String(snapshot.relationship_status ?? '');
    const aiCloudMaturity = String(snapshot.ai_cloud_maturity ?? '');
    const strategicPatience = String(snapshot.strategic_patience ?? '');
    const pursuitPriority = String(snapshot.pursuit_priority ?? '');
    const existingProviders = String(snapshot.existing_providers ?? '');
    const expansionPotential = String(snapshot.expansion_potential ?? '');

    const planFields = `
        <div class="account-snapshot-plan">
            <h5 class="account-snapshot-subheading">Strategic Judgments</h5>
            <div class="account-snapshot-plan-grid">
                ${buildSnapshotPillField(section.id, 'tier', 'Strategic Tier', ACCOUNT_SNAPSHOT_TIER_OPTIONS, tier)}
                ${buildSnapshotPillField(section.id, 'relationship_status', 'Relationship Status', ACCOUNT_SNAPSHOT_LEVEL_OPTIONS, relationshipStatus)}
                ${buildSnapshotPillField(section.id, 'ai_cloud_maturity', 'AI / Cloud Maturity', ACCOUNT_SNAPSHOT_LEVEL_OPTIONS, aiCloudMaturity)}
                ${buildSnapshotPillField(section.id, 'strategic_patience', 'Strategic Patience', ACCOUNT_SNAPSHOT_LEVEL_OPTIONS, strategicPatience)}
                ${buildSnapshotPillField(section.id, 'pursuit_priority', 'Pursuit Priority', ACCOUNT_SNAPSHOT_LEVEL_OPTIONS, pursuitPriority)}
                ${buildSnapshotTextareaField(section.id, 'existing_providers', 'Existing Providers', existingProviders)}
                ${buildSnapshotTextareaField(section.id, 'expansion_potential', 'Expansion Potential', expansionPotential)}
            </div>
        </div>`;

    return `${buildAccountSnapshotCrmHtml(account)}${planFields}`;
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} data
 */
function buildPillsAndNarrativeHtml(section, data) {
    const obj = isPlainObject(data) ? data : {};
    const pillField = section.pillField || 'selected_pills';
    const selected = Array.isArray(obj[pillField]) ? obj[pillField] : [];

    const pillsInnerHtml = section.pillMode === 'either_or' && Array.isArray(section.pillGroups)
        ? section.pillGroups.map((group) => {
            const buttons = group.options.map((option, index) => {
                const active = selected.includes(option) ? ' strategic-pill-active' : '';
                const divider = index > 0 ? '<span class="strategic-pill-divider">or</span>' : '';
                return `${divider}<button type="button" class="strategic-pill${active}" data-pill-section="${section.id}" data-pill-field="${pillField}" data-pill-group="${escapeHtml(group.id)}" data-pill-value="${escapeHtml(option)}">${escapeHtml(option)}</button>`;
            }).join('');
            return `
                <div class="strategic-pill-group" data-pill-group="${escapeHtml(group.id)}" role="group" aria-label="${escapeHtml(group.options.join(' or '))}">
                    ${buttons}
                </div>`;
        }).join('')
        : (section.pills || []).map((pill) => {
            const active = selected.includes(pill) ? ' strategic-pill-active' : '';
            return `<button type="button" class="strategic-pill${active}" data-pill-section="${section.id}" data-pill-field="${pillField}" data-pill-value="${escapeHtml(pill)}">${escapeHtml(pill)}</button>`;
        }).join('');

    const pillsWrapClass = section.pillMode === 'either_or'
        ? 'strategic-pills-wrap strategic-pills-wrap--either-or'
        : 'strategic-pills-wrap';

    const pillsBlock = `
        <div class="strategic-pills-group">
            ${section.pillHint ? buildFieldHintHtml(section.pillHint) : ''}
            <div class="${pillsWrapClass}" role="group" aria-label="${escapeHtml(section.title)} options">
                ${pillsInnerHtml}
            </div>
        </div>`;

    const renderField = (field) => buildCompositeFieldHtml(section.id, field, obj[field.key]);

    const textFields = section.textFields || [];
    const textHtml = textFields.map(renderField).join('');

    if (pillField === 'positioning_pills') {
        const [firstField, secondField] = textFields;
        return `${firstField ? renderField(firstField) : ''}${pillsBlock}${secondField ? renderField(secondField) : ''}`;
    }

    if (section.pillNarrativeLayout === 'split') {
        return `
            <div class="strategic-pills-narrative-split">
                ${pillsBlock}
                <div class="strategic-pills-narrative-split-text">
                    ${textHtml}
                </div>
            </div>`;
    }

    return `${pillsBlock}${textHtml}`;
}

/**
 * The Big Play + operational pain watchlist — pain pills sit directly under
 * Action-Forcing Event so reps wire symptoms to urgency (Challenger teaching).
 */
function buildPursuitWithPainHtml(section, data) {
    const obj = isPlainObject(data) ? data : {};
    const fields = section.fields || [];
    let html = '<div class="strategic-composite-grid">';

    fields.forEach((field) => {
        html += buildCompositeFieldHtml(section.id, field, obj[field.key]);
        if (field.key === 'action_forcing_event') {
            html += buildOperationalPainWatchlistHtml(section, obj);
        }
        if (section.id === 'pursuit_thesis' && field.key === 'executive_narrative') {
            html += buildExecutiveNarrativeHintPillsHtml();
        }
    });

    html += '</div>';
    return html;
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} obj
 */
function buildOperationalPainWatchlistHtml(section, obj) {
    const pills = section.operationalPainPills || [];
    const selected = Array.isArray(obj.operational_pain_selected) ? obj.operational_pain_selected : [];
    const notes = escapeHtml(String(obj.operational_pain_notes ?? ''));

    const pillsHtml = pills.map((pill) => {
        const active = selected.includes(pill) ? ' strategic-pill-active' : '';
        return `<button type="button" class="strategic-pill${active}" data-pill-section="pursuit_thesis" data-pill-field="operational_pain_selected" data-pill-value="${escapeHtml(pill)}">${escapeHtml(pill)}</button>`;
    }).join('');

    return `
        <div class="strategic-composite-field strategic-operational-pain-block">
            <div class="strategic-composite-field-meta">
                <span class="strategic-composite-field-label">Operational Pain Watchlist</span>
                ${buildFieldHintHtml(section.operationalPainNotesHint || 'Select the operational symptoms that make the Action-Forcing Event credible.')}
            </div>
            <div class="strategic-pills-wrap" role="group" aria-label="Operational pain watchlist">
                ${pillsHtml}
            </div>
            <textarea
                class="strategic-field strategic-textarea"
                data-field="pursuit_thesis.operational_pain_notes"
                rows="2"
                placeholder="Context on selected pain signals…"
            >${notes}</textarea>
        </div>`;
}

/**
 * The Battlefield — competitive positioning with incumbent moat directly below.
 */
function buildBattlefieldHtml(section, data) {
    const obj = isPlainObject(data) ? data : {};
    const positioningBlock = buildPillsAndNarrativeHtml(section, obj);
    const moatPills = section.moatPills || [];
    const moatSelected = Array.isArray(obj.moat_pills) ? obj.moat_pills : [];
    const moatPillsHtml = moatPills.map((pill) => {
        const active = moatSelected.includes(pill) ? ' strategic-pill-active' : '';
        return `<button type="button" class="strategic-pill${active}" data-pill-section="competitive_landscape" data-pill-field="moat_pills" data-pill-value="${escapeHtml(pill)}">${escapeHtml(pill)}</button>`;
    }).join('');

    const compound = buildCompositeFieldHtml('competitive_landscape', { key: 'compound_relationships', hint: section.textFields?.find((f) => f.key === 'compound_relationships')?.hint }, obj.compound_relationships);
    const difficult = buildCompositeFieldHtml('competitive_landscape', { key: 'difficult_to_remove', hint: section.textFields?.find((f) => f.key === 'difficult_to_remove')?.hint }, obj.difficult_to_remove);

    return `
        ${positioningBlock}
        <div class="battlefield-moat-block">
            <h5 class="battlefield-moat-heading">${escapeHtml(TACTICAL_UX_LABELS.incumbentGrip)}</h5>
            <div class="strategic-pills-wrap" role="group" aria-label="Incumbent moat pills">
                ${moatPillsHtml}
            </div>
            ${compound}
            ${difficult}
        </div>`;
}

/**
 * Account Expansion — land wedge narrative then white-space matrix.
 *
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} data
 * @param {Record<string, unknown>} sections
 */
function buildAccountExpansionHtml(section, data, sections) {
    const obj = isPlainObject(data) ? data : {};
    const ghostHtml = TENSION_GHOST_SECTIONS.includes(section.id)
        ? buildStrategicTensionGhostHtml(sections.strategic_tensions, section.id)
        : '';
    const wedgeHtml = (section.wedgeFields || []).map((field) => (
        buildCompositeFieldHtml(section.id, field, obj[field.key])
    )).join('');
    const rows = getWhiteSpaceRows(obj);

    return `
        ${ghostHtml}
        <div class="account-expansion-wedge strategic-composite-grid">${wedgeHtml}</div>
        ${buildWhiteSpaceMatrixHtml(rows)}`;
}

function ensureAccountExpansionShape() {
    if (!_liveSections) return;
    if (!isPlainObject(_liveSections.white_space)) {
        _liveSections.white_space = {
            initial_entry: '',
            trust_creation: '',
            expansion_path: '',
            rows: getWhiteSpaceRows(_liveSections.white_space),
        };
    } else if (!Array.isArray(_liveSections.white_space.rows)) {
        _liveSections.white_space.rows = getWhiteSpaceRows(_liveSections.white_space);
    }
}

function buildInfluenceContactPill(contact, entry) {
    const name = contact
        ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
        : 'Unknown contact';
    const contactId = escapeHtml(String(entry.id));

    return `
        <span
            class="influence-contact-pill"
            draggable="true"
            data-contact-id="${contactId}"
            data-influence-bucket="bench"
            title="${escapeHtml(name || 'Contact')}"
        >${escapeHtml(name || 'Contact')}</span>`;
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} data
 */
function buildPlan306090Html(section, data) {
    const planData = isPlainObject(data) ? data : {};
    const horizons = section.horizons || PLAN_306090_HORIZONS;

    const horizonsHtml = `<div class="plan-306090-grid">${horizons.map((horizon) => {
        const value = escapeHtml(String(planData[horizon.key] ?? ''));
        const fieldId = `plan-${horizon.key}`;
        return `
            <div class="plan-306090-row">
                <div class="plan-306090-row-meta">
                    <span class="plan-306090-badge" aria-hidden="true">${escapeHtml(horizon.badge)}</span>
                    <div class="plan-306090-column-heading">
                        <h5 class="plan-306090-column-title">${escapeHtml(horizon.title)}</h5>
                        <p class="plan-306090-column-hint">${escapeHtml(horizon.hint)}</p>
                    </div>
                </div>
                <textarea
                    id="${fieldId}"
                    class="strategic-field strategic-textarea plan-306090-textarea"
                    data-field="plan_30_60_90.${horizon.key}"
                    rows="5"
                    placeholder="List key actions, owners, and outcomes…"
                >${value}</textarea>
            </div>`;
    }).join('')}</div>`;

    return `${horizonsHtml}${buildClientCommitmentsHtml(planData)}`;
}

/**
 * Give/Get checklist under the 30/60/90 horizons — what the customer owes
 * us this month to keep the deal moving.
 *
 * @param {Record<string, unknown>} planData
 */
function buildClientCommitmentsHtml(planData) {
    const items = Array.isArray(planData.client_commitments) ? planData.client_commitments : [];
    const inputId = 'client-commitments-input-plan_30_60_90';

    const rowsHtml = items.length > 0
        ? items.map((entry, index) => {
            const text = String(entry ?? '').trim();
            if (!text) return '';
            return `
                <li class="blindspots-item client-commitments-item" data-client-commitments-index="${index}">
                    <span class="blindspots-item-bullet" aria-hidden="true">▢</span>
                    <span class="blindspots-item-text">${escapeHtml(text)}</span>
                    <button
                        type="button"
                        class="blindspots-item-remove"
                        data-client-commitments-remove="${index}"
                        aria-label="Remove commitment: ${escapeHtml(text)}"
                    >×</button>
                </li>`;
        }).join('')
        : `<li class="blindspots-empty">What does the customer owe us this month to keep the deal moving?</li>`;

    return `
        <div class="plan-306090-commitments" data-client-commitments-host>
            <h4 class="plan-306090-commitments-title">
                <span class="plan-306090-commitments-title-main">${escapeHtml(TACTICAL_UX_LABELS.clientCommitments)}</span><span class="plan-306090-commitments-title-qualifier">${escapeHtml(TACTICAL_UX_LABELS.clientCommitmentsQualifier)}</span>
            </h4>
            <ul class="blindspots-list client-commitments-list" role="list">${rowsHtml}</ul>
            <div class="blindspots-add-row">
                <label class="sr-only" for="${inputId}">Add a client commitment</label>
                <input
                    type="text"
                    id="${inputId}"
                    class="strategic-field blindspots-add-input"
                    data-client-commitments-input
                    placeholder="What does the customer owe us this month to keep the deal moving?"
                    autocomplete="off"
                />
                <button type="button" class="blindspots-add-btn" data-client-commitments-add>Add</button>
            </div>
        </div>`;
}

/**
 * @param {string} index
 * @param {string} fieldKey
 * @param {readonly string[]} options
 * @param {string} label
 * @param {string} value
 */
function buildEntryPointPills(index, fieldKey, options, label, value) {
    const fieldPath = `entry_points.${index}.${fieldKey}`;
    const pillOptions = options.filter((option) => option !== '');
    const pillsHtml = pillOptions.map((option) => {
        const active = value === option ? ' entry-point-pill--active' : '';
        const pressed = value === option ? 'true' : 'false';
        return `
            <button
                type="button"
                class="entry-point-pill${active}"
                data-field="${fieldPath}"
                data-pill-value="${escapeHtml(option)}"
                aria-pressed="${pressed}"
            >${escapeHtml(option)}</button>`;
    }).join('');

    return `
        <div class="entry-point-field entry-point-field--pills">
            <span class="entry-point-field-label">${escapeHtml(label)}</span>
            <div class="entry-point-pills-wrap" role="group" aria-label="${escapeHtml(label)}">${pillsHtml}</div>
        </div>`;
}

/**
 * @param {string} index
 * @param {string} fieldKey
 * @param {string} label
 * @param {string} value
 * @param {string} [placeholder]
 */
function buildEntryPointTextarea(index, fieldKey, label, value, placeholder = '') {
    const fieldId = `entry-point-${index}-${fieldKey}`;
    return `
        <div class="entry-point-field entry-point-field--textarea">
            <label for="${fieldId}">${escapeHtml(label)}</label>
            <textarea
                id="${fieldId}"
                class="strategic-field strategic-textarea entry-point-textarea"
                data-field="entry_points.${index}.${fieldKey}"
                rows="3"
                placeholder="${escapeHtml(placeholder)}"
            >${escapeHtml(value)}</textarea>
        </div>`;
}

/**
 * Read-only contact-name header for an entry point card.
 *
 * Was a <select> dropdown; removed because contact selection now happens
 * exclusively upstream — either at "+ Add Point" creation time, or
 * automatically when a contact is dragged into Executive/Mid-Level on the
 * influence board (ensureEntryPointForContact in the Influence Pipeline).
 * Showing a dropdown inside the card invited reps to re-pick the same
 * contact, and accidentally orphaned profile data when a misclick reassigned
 * the entry point to a different person.
 *
 * Data shape unchanged: contact_name still lives on the entry point object
 * and is read by exports and downstream renderers. We just stop letting the
 * card itself edit it. To rename or reassign, the rep removes the entry
 * point (Out of Play on the influence board) and remaps the correct
 * contact — that path is the only one that also keeps contact_id in sync.
 *
 * The `contacts` and `index` parameters are kept on the signature so call
 * sites need no refactor. The hidden input keeps contact_name bound to
 * autosave's existing entry_points.${index}.contact_name path, so saved
 * data round-trips without loss even if we ever bring an editor back.
 *
 * @param {string} index
 * @param {string} value
 * @param {object[]} _contacts
 */
function buildEntryPointContactSelect(index, value, _contacts) {
    const fieldId = `entry-point-${index}-contact_name`;
    const hasName = typeof value === 'string' && value.trim() !== '';
    const displayName = hasName ? value : 'Unassigned';
    const displayClass = hasName
        ? 'entry-point-contact-name'
        : 'entry-point-contact-name entry-point-contact-name--unassigned';

    return `
        <div class="entry-point-contact-row entry-point-contact-row--inline">
            <span class="entry-point-contact-label">Contact</span>
            <span class="${displayClass}" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
            <input
                type="hidden"
                id="${fieldId}"
                data-field="entry_points.${index}.contact_name"
                value="${escapeHtml(typeof value === 'string' ? value : '')}"
            />
        </div>`;
}

/**
 * @param {Record<string, string>} point
 * @param {number} index
 * @param {object[]} contacts
 * @param {boolean} isActive
 */
function buildEntryPointCardHtml(point, index, contacts, isActive) {
    const data = isPlainObject(point) ? point : createEmptyEntryPoint();
    const hiddenClass = isActive ? '' : ' hidden';

    return `
        <div
            class="entry-point-card${hiddenClass}"
            data-entry-index="${index}"
            role="tabpanel"
            aria-hidden="${isActive ? 'false' : 'true'}"
        >
            <div class="entry-point-card-header">
                ${buildEntryPointContactSelect(String(index), String(data.contact_name ?? ''), contacts)}
            </div>
            <div class="entry-point-row-panel entry-point-row-panel--profile">
                <h5 class="entry-point-row-panel-title">Relationship Profile</h5>
                <div class="entry-point-grid entry-point-grid--attributes">
                    ${buildEntryPointPills(String(index), 'trust_level', ENTRY_POINT_TRUST_LEVELS, 'Trust Level', String(data.trust_level ?? ''))}
                    ${buildEntryPointPills(String(index), 'responsiveness', ENTRY_POINT_LEVEL_OPTIONS, 'Responsiveness', String(data.responsiveness ?? ''))}
                    ${buildEntryPointPills(String(index), 'political_influence', ENTRY_POINT_LEVEL_OPTIONS, 'Political Influence', String(data.political_influence ?? ''))}
                    ${buildEntryPointPills(String(index), 'comm_style', ENTRY_POINT_COMM_STYLES, 'Comm Style', String(data.comm_style ?? ''))}
                    ${buildEntryPointPills(String(index), 'compound_potential', ENTRY_POINT_LEVEL_OPTIONS, 'Compound Potential', String(data.compound_potential ?? ''))}
                </div>
            </div>
            <div class="entry-point-row-panel entry-point-row-panel--why">
                <h5 class="entry-point-row-panel-title">Strategic Context</h5>
                <div class="entry-point-grid entry-point-grid--why">
                    ${buildEntryPointTextarea(String(index), 'why_they_matter', 'Why They Matter', String(data.why_they_matter ?? ''), 'Strategic relevance and decision weight.')}
                    ${buildEntryPointTextarea(String(index), 'operational_pain', 'Operational Pain', String(data.operational_pain ?? ''), 'What keeps them up at night AND what happens if this stalls — one tight paragraph.')}
                </div>
            </div>
            <div class="entry-point-row-panel entry-point-row-panel--how">
                <h5 class="entry-point-row-panel-title">Narrative &amp; Approach</h5>
                <div class="entry-point-grid entry-point-grid--how">
                    ${buildEntryPointTextarea(String(index), 'conversation_wedge', 'Conversation Wedge', String(data.conversation_wedge ?? ''), 'One sharp angle to open the conversation — the message they will actually lean into.')}
                    ${buildEntryPointTextarea(String(index), 'next_move', 'Next Move', String(data.next_move ?? ''), 'Concrete next action.')}
                    ${buildEntryPointTextarea(String(index), 'mutual_connections', 'Mutual Connections', String(data.mutual_connections ?? ''), 'Shared relationships or references.')}
                </div>
            </div>
            <div class="entry-point-row-panel entry-point-row-panel--human">
                <h5 class="entry-point-row-panel-title">${escapeHtml(TACTICAL_UX_LABELS.humanContext)}</h5>
                <div class="entry-point-grid entry-point-grid--human-context">
                    ${buildEntryPointTextarea(String(index), 'human_context', TACTICAL_UX_LABELS.humanContext, String(data.human_context ?? ''), 'Personal motivations and style cues — the off-the-record read that closes the loop.')}
                </div>
            </div>
        </div>`;
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {unknown} entryPoints
 * @param {number} activeIndex
 */
function buildEntryPointCarouselHtml(section, entryPoints, activeIndex) {
    const points = Array.isArray(entryPoints) && entryPoints.length > 0
        ? entryPoints
        : [createEmptyEntryPoint()];
    const contacts = getAccountContacts();
    const safeActive = Math.min(Math.max(0, activeIndex), points.length - 1);

    const tabs = points.map((point, index) => {
        const pointData = isPlainObject(point) ? point : createEmptyEntryPoint();
        // Tab label fallback: contact name → numeric fallback. Entry points
        // are about contacts now (opportunities live on White Space rows),
        // so contact_name is the canonical identifier for the tab. The
        // numeric fallback only fires for brand-new "+ Add Point" empties
        // before a contact has been mapped on the influence board.
        const contactLabel = String(pointData.contact_name ?? '').trim();
        const label = contactLabel || `Entry Point ${index + 1}`;
        const activeClass = index === safeActive ? ' entry-point-tab--active' : '';

        // Task 2 — "Unmapped" flag.
        // An entry point is considered unmapped when:
        //   (a) it has a contact_id (i.e. it was originally stubbed from the
        //       influence board, not hand-authored), AND
        //   (b) that contact is no longer in the executive/mid_level buckets.
        // We deliberately do NOT flag hand-authored entry points (no contact_id)
        // because the rep may have intentionally written them up before mapping
        // the contact on the influence board.
        const contactId = String(pointData.contact_id ?? '').trim();
        const isUnmapped = contactId && !isContactCurrentlyMappedToInfluence(contactId);
        const unmappedClass = isUnmapped ? ' entry-point-tab--unmapped' : '';
        const unmappedTitle = isUnmapped
            ? ' title="This contact is no longer in Executive or Mid-Level on the influence board — re-promote them or remove this profile."'
            : '';
        const unmappedDot = isUnmapped
            ? '<span class="entry-point-tab-unmapped-dot" aria-label="Unmapped from influence board"></span>'
            : '';

        return `
            <button
                type="button"
                class="entry-point-tab${activeClass}${unmappedClass}"
                data-entry-index="${index}"
                role="tab"
                aria-selected="${index === safeActive ? 'true' : 'false'}"${unmappedTitle}
            >${escapeHtml(label)}${unmappedDot}</button>`;
    }).join('');

    const addButton = points.length < MAX_ENTRY_POINTS
        ? `<button type="button" class="entry-point-tab entry-point-tab--add" data-entry-point-add aria-label="Add entry point">+ Add Point</button>`
        : '';

    const cards = points.map((point, index) => buildEntryPointCardHtml(
        isPlainObject(point) ? point : createEmptyEntryPoint(),
        index,
        contacts,
        index === safeActive
    )).join('');

    return `
        <div class="entry-point-carousel" data-entry-carousel>
            <div class="entry-point-tabs" role="tablist" aria-label="${escapeHtml(section.title)}">${tabs}${addButton}</div>
            <div class="entry-point-panels">${cards}</div>
        </div>`;
}

/**
 * Patch a single carousel tab's visible text in place using the current
 * `_liveSections` state. Used by applyFieldToLiveSections whenever an entry
 * point's auto-populated `contact_name` changes (e.g. after an influence
 * board re-mapping), so the user sees the tab relabel immediately without a
 * full paintCanvas() (which would steal caret focus / interrupt IME).
 *
 * Fallback chain mirrors the initial render in buildEntryPointCarouselHtml:
 *   contact_name  →  "Entry Point N"
 *
 * The unmapped-dot child is preserved so the amber Influence-Pipeline flag
 * does not get clobbered when only the text node is rewritten.
 *
 * @param {number} index
 */
function updateEntryPointTabLabel(index) {
    if (!Number.isFinite(index)) return;
    const section = document.getElementById('strategic-section-entry_points');
    if (!section) return;

    const tab = section.querySelector(`.entry-point-tab[data-entry-index="${index}"]`);
    if (!(tab instanceof HTMLElement)) return;

    const points = Array.isArray(_liveSections?.entry_points) ? _liveSections.entry_points : [];
    const pointData = isPlainObject(points[index]) ? points[index] : {};
    const contactName = String(pointData.contact_name ?? '').trim();
    const label = contactName || `Entry Point ${index + 1}`;

    const unmappedDot = tab.querySelector('.entry-point-tab-unmapped-dot');
    tab.textContent = label;
    if (unmappedDot) tab.appendChild(unmappedDot);
}

function switchEntryPointTab(index) {
    _entryPointActiveIndex = index;
    const section = document.getElementById('strategic-section-entry_points');
    if (!section) return;

    section.querySelectorAll('.entry-point-tab[data-entry-index]').forEach((tab) => {
        if (!(tab instanceof HTMLElement)) return;
        const tabIndex = Number(tab.dataset.entryIndex);
        const isActive = tabIndex === index;
        tab.classList.toggle('entry-point-tab--active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    section.querySelectorAll('.entry-point-card').forEach((card) => {
        if (!(card instanceof HTMLElement)) return;
        const cardIndex = Number(card.dataset.entryIndex);
        const isActive = cardIndex === index;
        card.classList.toggle('hidden', !isActive);
        card.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
}

function addEntryPoint() {
    if (!_liveSections) return;
    const points = Array.isArray(_liveSections.entry_points)
        ? [..._liveSections.entry_points]
        : [createEmptyEntryPoint()];
    if (points.length >= MAX_ENTRY_POINTS) return;

    points.push(createEmptyEntryPoint());
    _liveSections.entry_points = points;
    _entryPointActiveIndex = points.length - 1;
    paintCanvas();
    queueAutosave();
}

/**
 * @param {string} contactId
 * @param {string} fieldKey
 * @param {readonly string[]} options
 * @param {string} label
 * @param {string} value
 */
function buildInfluenceContactFieldPills(contactId, fieldKey, options, label, value) {
    const pillOptions = options.filter((option) => option !== '');
    const pillsHtml = pillOptions.map((option) => {
        const active = value === option ? ' influence-field-pill--active' : '';
        const pressed = value === option ? 'true' : 'false';
        return `
            <button
                type="button"
                class="influence-field-pill${active}"
                data-influence-contact-id="${escapeHtml(contactId)}"
                data-influence-field="${escapeHtml(fieldKey)}"
                data-influence-pill-value="${escapeHtml(option)}"
                aria-pressed="${pressed}"
            >${escapeHtml(option)}</button>`;
    }).join('');

    return `
        <div class="influence-card-field influence-card-field--pills">
            <span class="influence-card-field-label">${escapeHtml(label)}</span>
            <div class="influence-field-pills-wrap" role="group" aria-label="${escapeHtml(label)}">${pillsHtml}</div>
        </div>`;
}

/**
 * @param {object | null | undefined} contact
 * @param {Record<string, string>} entry
 * @param {string} bucket
 */
function buildInfluenceContactCard(contact, entry, bucket) {
    const name = contact
        ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
        : 'Unknown contact';
    const title = contact?.title || contact?.job_title || '';
    const notes = escapeHtml(entry.notes || '');
    const contactId = escapeHtml(String(entry.id));
    const influenceLevel = String(entry.influence_level ?? '');
    const politicalInfluence = String(entry.political_influence ?? '');
    const relationshipTemp = String(entry.relationship_temperature ?? '');
    const personalityStyle = String(entry.personality_style ?? '');
    const strategicPriorities = escapeHtml(String(entry.strategic_priorities ?? ''));
    const isChampion = entry.is_champion === '1' || entry.is_champion === true;
    const isEconomicBuyer = entry.is_economic_buyer === '1' || entry.is_economic_buyer === true;

    const frontBadges = [influenceLevel, relationshipTemp].filter(Boolean).map((badge) => (
        `<span class="influence-contact-badge">${escapeHtml(badge)}</span>`
    )).join('');

    const meddpiccHtml = `
        <div class="influence-meddpicc-badges" role="group" aria-label="MEDDPICC roles">
            <button
                type="button"
                class="influence-meddpicc-badge${isChampion ? ' influence-meddpicc-badge--active' : ''}"
                data-influence-contact-id="${contactId}"
                data-influence-meddpicc="is_champion"
                aria-pressed="${isChampion ? 'true' : 'false'}"
            >Champion</button>
            <button
                type="button"
                class="influence-meddpicc-badge${isEconomicBuyer ? ' influence-meddpicc-badge--active' : ''}"
                data-influence-meddpicc="is_economic_buyer"
                data-influence-contact-id="${contactId}"
                aria-pressed="${isEconomicBuyer ? 'true' : 'false'}"
            >Economic Buyer</button>
        </div>`;

    return `
        <div
            class="influence-contact-card deal-card-flippable"
            draggable="true"
            data-contact-id="${contactId}"
            data-influence-bucket="${escapeHtml(bucket)}"
        >
            <div class="deal-card-flip-inner">
                <div class="deal-card-front influence-contact-card-front">
                    <div class="influence-contact-name">${escapeHtml(name || 'Contact')}</div>
                    ${title ? `<div class="influence-contact-title">${escapeHtml(title)}</div>` : ''}
                    ${meddpiccHtml}
                    ${frontBadges ? `<div class="influence-contact-badges">${frontBadges}</div>` : ''}
                    <div class="influence-contact-hint">Click for influence profile</div>
                </div>
                <div class="deal-card-back influence-contact-card-back">
                    <div class="influence-card-flip-strip" data-influence-flip-trigger role="button" tabindex="0" aria-label="Flip card to front">
                        <span class="influence-card-flip-strip-name">${escapeHtml(name || 'Contact')}</span>
                        <span class="influence-card-flip-strip-hint">Click to flip back</span>
                    </div>
                    <div class="influence-card-fields">
                        ${buildInfluenceContactFieldPills(String(entry.id), 'influence_level', INFLUENCE_LEVEL_OPTIONS, 'Influence Level', influenceLevel)}
                        ${buildInfluenceContactFieldPills(String(entry.id), 'political_influence', INFLUENCE_LEVEL_OPTIONS, 'Political Influence', politicalInfluence)}
                        ${buildInfluenceContactFieldPills(String(entry.id), 'relationship_temperature', INFLUENCE_RELATIONSHIP_TEMPERATURE_OPTIONS, 'Relationship Temperature', relationshipTemp)}
                        ${buildInfluenceContactFieldPills(String(entry.id), 'personality_style', INFLUENCE_PERSONALITY_STYLE_OPTIONS, 'Personality Style', personalityStyle)}
                        <div class="influence-card-field influence-card-field--textarea">
                            <label class="influence-contact-notes-label" for="influence-priorities-${contactId}">Strategic Priorities</label>
                            <textarea
                                id="influence-priorities-${contactId}"
                                class="strategic-field strategic-textarea influence-card-field-textarea"
                                data-influence-contact-id="${contactId}"
                                data-influence-field="strategic_priorities"
                                rows="2"
                            >${strategicPriorities}</textarea>
                        </div>
                        <div class="influence-card-field influence-card-field--textarea">
                            <label class="influence-contact-notes-label" for="influence-notes-${contactId}">Influence Notes</label>
                            <textarea
                                id="influence-notes-${contactId}"
                                class="strategic-field strategic-textarea influence-card-notes"
                                data-contact-id="${contactId}"
                                rows="3"
                            >${notes}</textarea>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} data
 */
function buildInfluenceBoardHtml(section, data) {
    const mapping = isPlainObject(data)
        ? data
        : { executive: [], mid_level: [], technical: [], invisible_org_chart: '', political_dynamics: '', access_path: {} };
    const contacts = getAccountContacts();
    const contactById = new Map(contacts.map((contact) => [String(contact.id), contact]));

    const executiveEntries = normalizeInfluenceEntries(mapping.executive);
    const midLevelEntries = normalizeInfluenceEntries(mapping.mid_level);
    const technicalEntries = normalizeInfluenceEntries(mapping.technical);
    const assignedIds = new Set([
        ...executiveEntries.map((entry) => String(entry.id)),
        ...midLevelEntries.map((entry) => String(entry.id)),
        ...technicalEntries.map((entry) => String(entry.id)),
    ]);

    const columnHints = section.columnHints || {};

    const renderBucket = (bucketKey, label, entries) => {
        const isBench = bucketKey === 'bench';
        const items = entries.map((entry) => {
            const contact = contactById.get(String(entry.id));
            return isBench
                ? buildInfluenceContactPill(contact, entry)
                : buildInfluenceContactCard(contact, entry, bucketKey);
        }).join('');
        const emptyHint = isBench
            ? 'No unassigned contacts'
            : 'Drop contacts here';
        const columnHint = columnHints[bucketKey]
            ? `<p class="influence-board-column-hint">${escapeHtml(columnHints[bucketKey])}</p>`
            : '';
        const dropzoneClass = isBench
            ? 'influence-board-dropzone influence-board-dropzone--bench'
            : 'influence-board-dropzone';

        return `
            <div class="influence-board-column${isBench ? ' influence-board-column--bench' : ''}">
                <h5 class="influence-board-column-title">${escapeHtml(label)}</h5>
                ${columnHint}
                <div class="${dropzoneClass}" data-influence-drop="${bucketKey}">
                    ${items || `<p class="influence-board-empty">${emptyHint}</p>`}
                </div>
            </div>`;
    };

    const unassigned = contacts.filter((contact) => !assignedIds.has(String(contact.id)));
    const benchEntries = unassigned.map((contact) => ({ id: String(contact.id), notes: '' }));

    const invisibleValue = escapeHtml(String(mapping.invisible_org_chart ?? ''));
    const politicalValue = escapeHtml(String(mapping.political_dynamics ?? ''));
    const accessPath = isPlainObject(mapping.access_path) ? mapping.access_path : {};

    const accessPathFields = [
        { key: 'current', label: 'Current Access' },
        { key: 'desired', label: 'Desired Access' },
        { key: 'bridge', label: 'Bridge Contacts' },
        { key: 'strategy', label: 'Access Strategy' },
    ].map(({ key, label }) => `
        <div class="influence-access-field">
            <label for="influence-access-${key}">${escapeHtml(label)}</label>
            <textarea
                id="influence-access-${key}"
                class="strategic-field strategic-textarea influence-access-textarea"
                data-field="influence_mapping.access_path.${key}"
                rows="2"
            >${escapeHtml(String(accessPath[key] ?? ''))}</textarea>
        </div>`).join('');

    return `
        <div class="influence-board">
            ${renderBucket('bench', 'Unassigned Contacts', benchEntries)}
            ${renderBucket('executive', 'Executive', executiveEntries)}
            ${renderBucket('mid_level', 'Mid-Level', midLevelEntries)}
            ${renderBucket('technical', 'Technical', technicalEntries)}
        </div>
        <div class="strategic-composite-field influence-political-field strategic-composite-field--with-hint strategic-composite-field--nested-meta">
            <div class="strategic-composite-field-body">
                <div class="strategic-composite-field-aside">
                    <div class="strategic-composite-field-meta">
                        <label for="strategic-field-influence-political">Political Dynamics</label>
                        ${buildFieldHintHtml(columnHints.political_dynamics)}
                    </div>
                </div>
                <textarea
                    id="strategic-field-influence-political"
                    class="strategic-field strategic-textarea influence-political-textarea"
                    data-field="influence_mapping.political_dynamics"
                    rows="4"
                >${politicalValue}</textarea>
            </div>
        </div>
        <div class="influence-access-path">
            <h5 class="influence-access-path-title">Access Path</h5>
            ${buildFieldHintHtml(columnHints.access_path)}
            <div class="influence-access-grid">${accessPathFields}</div>
        </div>
        <div class="strategic-composite-field influence-invisible-field strategic-composite-field--with-hint strategic-composite-field--nested-meta">
            <div class="strategic-composite-field-body">
                <div class="strategic-composite-field-aside">
                    <div class="strategic-composite-field-meta">
                        <label for="strategic-field-influence-invisible">Invisible Org Chart</label>
                        ${buildFieldHintHtml(columnHints.invisible_org_chart)}
                    </div>
                </div>
                <textarea
                    id="strategic-field-influence-invisible"
                    class="strategic-field strategic-textarea influence-invisible-textarea"
                    data-field="influence_mapping.invisible_org_chart"
                    rows="4"
                >${invisibleValue}</textarea>
            </div>
        </div>`;
}

/**
 * @param {string} contactId
 * @param {string} targetBucket
 */
function moveInfluenceContact(contactId, targetBucket) {
    if (!_liveSections) return;

    const mapping = isPlainObject(_liveSections.influence_mapping)
        ? { ..._liveSections.influence_mapping }
        : { executive: [], mid_level: [], technical: [], invisible_org_chart: '' };

    const id = String(contactId);
    let entry = null;

    ['executive', 'mid_level', 'technical'].forEach((bucket) => {
        const list = normalizeInfluenceEntries(mapping[bucket]);
        const index = list.findIndex((item) => String(item.id) === id);
        if (index >= 0) {
            entry = list[index];
            list.splice(index, 1);
            mapping[bucket] = list;
        }
    });

    if (!entry) {
        entry = { id, notes: '' };
        INFLUENCE_CONTACT_FIELD_KEYS.forEach((key) => {
            entry[key] = '';
        });
    }

    if (targetBucket === 'executive' || targetBucket === 'mid_level' || targetBucket === 'technical') {
        const list = normalizeInfluenceEntries(mapping[targetBucket]);
        if (!list.some((item) => String(item.id) === id)) {
            list.push(entry);
        }
        mapping[targetBucket] = list;
    }

    _liveSections.influence_mapping = mapping;
}

/**
 * @param {string} contactId
 * @param {string} fieldKey
 * @param {string} value
 */
function updateInfluenceContactField(contactId, fieldKey, value) {
    if (!_liveSections || !contactId || !fieldKey) return;

    const mapping = isPlainObject(_liveSections.influence_mapping)
        ? { ..._liveSections.influence_mapping }
        : { executive: [], mid_level: [], technical: [], invisible_org_chart: '' };

    const id = String(contactId);
    ['executive', 'mid_level', 'technical'].forEach((bucket) => {
        const list = normalizeInfluenceEntries(mapping[bucket]);
        const index = list.findIndex((item) => String(item.id) === id);
        if (index >= 0) {
            list[index] = { ...list[index], [fieldKey]: value };
            mapping[bucket] = list;
        }
    });

    _liveSections.influence_mapping = mapping;
}

/**
 * Toggle MEDDPICC role badges (Champion / Economic Buyer) on influence cards.
 *
 * @param {HTMLButtonElement} button
 */
function toggleMeddpiccBadge(button) {
    const contactId = button.dataset.influenceContactId;
    const fieldKey = button.dataset.influenceMeddpicc;
    if (!contactId || !fieldKey || !_liveSections) return;

    const mapping = isPlainObject(_liveSections.influence_mapping)
        ? { ..._liveSections.influence_mapping }
        : { executive: [], mid_level: [], technical: [] };

    ['executive', 'mid_level', 'technical'].forEach((bucket) => {
        const list = normalizeInfluenceEntries(mapping[bucket]);
        const index = list.findIndex((item) => String(item.id) === String(contactId));
        if (index < 0) return;

        if (fieldKey === 'is_economic_buyer') {
            list.forEach((item, i) => {
                list[i] = { ...item, is_economic_buyer: '' };
            });
        }

        const current = list[index][fieldKey] === '1';
        list[index] = { ...list[index], [fieldKey]: current ? '' : '1' };
        mapping[bucket] = list;
    });

    _liveSections.influence_mapping = mapping;
    refreshInfluenceBoardSection();
    updateRailSummaries(_liveSections);
    queueAutosave();
}

/** Show/hide the bureaucracy bypass trap when psychology sliders cross the threshold. */
function updatePsychologyBypassTrapVisibility() {
    if (!_liveSections) return;
    const psych = isPlainObject(_liveSections.psychology) ? _liveSections.psychology : {};
    const trap = document.querySelector('[data-psychology-bypass-trap]');
    if (!(trap instanceof HTMLElement)) return;
    const active = isBureaucracyBypassTrapActive(psych);
    trap.classList.toggle('hidden', !active);
    const textarea = trap.querySelector('.psychology-bypass-textarea');
    if (textarea instanceof HTMLTextAreaElement) {
        textarea.required = active;
    }
}

/**
 * @param {string} contactId
 * @param {string} notes
 */
function updateInfluenceContactNotes(contactId, notes) {
    if (!_liveSections || !contactId) return;

    const mapping = isPlainObject(_liveSections.influence_mapping)
        ? { ..._liveSections.influence_mapping }
        : { executive: [], mid_level: [], invisible_org_chart: '' };

    const id = String(contactId);
    ['executive', 'mid_level', 'technical'].forEach((bucket) => {
        const list = normalizeInfluenceEntries(mapping[bucket]);
        const index = list.findIndex((item) => String(item.id) === id);
        if (index >= 0) {
            list[index] = { ...list[index], notes };
            mapping[bucket] = list;
        }
    });

    _liveSections.influence_mapping = mapping;
}

function refreshInfluenceBoardSection() {
    const sectionEl = document.getElementById('strategic-section-influence_mapping');
    const sectionDef = PLAN_SECTIONS.find((section) => section.id === 'influence_mapping');
    if (!sectionEl || !sectionDef || !_liveSections) return;

    const headingId = `strategic-heading-${sectionDef.id}`;
    const headerContext = buildSectionHeaderContext(sectionDef);
    const bodyHtml = buildInfluenceBoardHtml(sectionDef, _liveSections.influence_mapping);

    sectionEl.innerHTML = `
        <h4 id="${headingId}" class="strategic-section-title">${escapeHtml(sectionDef.title)}</h4>
        ${headerContext.leadHtml}
        ${headerContext.blockHtml}
        ${bodyHtml}`;

    initAutoExpandTextareas(sectionEl);
}

/**
 * @param {Record<string, string>} row
 * @param {number} index
 */
function buildWhiteSpaceRowHtml(row, index) {
    const name = escapeHtml(String(row.name ?? ''));
    const area = String(row.area ?? '');
    const opportunity = escapeHtml(String(row.opportunity ?? ''));
    const operationalImportance = String(row.operational_importance ?? '');
    const executiveVisibility = String(row.executive_visibility ?? '');
    const confidence = String(row.confidence ?? '');
    const valueNotes = escapeHtml(String(row.value_notes ?? ''));
    const nameInputId = `white-space-${index}-name`;
    const fallbackLabel = `Opportunity ${index + 1}`;

    // Row header is a single editable name input (no redundant caption +
    // input pair). Placeholder doubles as the "Opportunity N" fallback when
    // the rep hasn't typed a custom name yet, mirroring the entry-point name
    // pattern.
    return `
        <div class="white-space-row" data-white-space-row="${index}">
            <div class="white-space-row-header">
                <input
                    type="text"
                    id="${nameInputId}"
                    class="strategic-field white-space-row-name-input"
                    data-white-space-index="${index}"
                    data-white-space-field="name"
                    data-white-space-name-input="${index}"
                    value="${name}"
                    placeholder="${escapeHtml(fallbackLabel)}"
                    maxlength="120"
                    autocomplete="off"
                    aria-label="${escapeHtml(fallbackLabel)} name"
                />
                <button type="button" class="white-space-row-remove" data-white-space-remove="${index}" aria-label="Remove row">Remove</button>
            </div>
            <div class="white-space-row-grid">
                ${buildWhiteSpacePillField(index, 'area', 'Area', WHITE_SPACE_AREAS, area)}
                ${buildWhiteSpacePillField(index, 'operational_importance', 'Operational Importance', ACCOUNT_SNAPSHOT_LEVEL_OPTIONS, operationalImportance)}
                ${buildWhiteSpacePillField(index, 'executive_visibility', 'Executive Visibility', ACCOUNT_SNAPSHOT_LEVEL_OPTIONS, executiveVisibility)}
                ${buildWhiteSpacePillField(index, 'confidence', 'Confidence', WHITE_SPACE_CONFIDENCE_OPTIONS, confidence)}
                <div class="white-space-field white-space-field--wide">
                    <label for="white-space-${index}-opportunity">Opportunity</label>
                    <textarea
                        id="white-space-${index}-opportunity"
                        class="strategic-field strategic-textarea white-space-textarea"
                        data-white-space-index="${index}"
                        data-white-space-field="opportunity"
                        rows="2"
                    >${opportunity}</textarea>
                </div>
                <div class="white-space-field white-space-field--wide">
                    <label for="white-space-${index}-value">Estimated Value / Sizing Notes</label>
                    <textarea
                        id="white-space-${index}-value"
                        class="strategic-field strategic-textarea white-space-textarea"
                        data-white-space-index="${index}"
                        data-white-space-field="value_notes"
                        rows="2"
                    >${valueNotes}</textarea>
                </div>
            </div>
        </div>`;
}

/**
 * Pill-group equivalent of the old <select> for a single White Space field.
 * Tap-don't-type rhythm: rep sees every option at once instead of fishing in
 * a dropdown that hides cardinality (especially helpful for the 9-area
 * vertical-by-vertical Area selector, which used to require a hover-scan).
 *
 * Storage shape kept identical to the old <select>: a hidden <input
 * data-white-space-field data-white-space-index> mirrors the selected value
 * so the existing syncWhiteSpaceFromCanvas reader keeps working without any
 * change. On pill click we dispatch an 'input' event from the hidden input
 * so the canvas-level input listener fires sync + autosave.
 *
 * Single-select with toggle-off: clicking the active pill clears the value
 * (parity with how the interaction-log pills behave).
 *
 * @param {number} index
 * @param {string} fieldKey
 * @param {string} label
 * @param {readonly string[]} options - first '' (if present) is treated as
 *   the "cleared" sentinel and dropped from the pill set.
 * @param {string} value
 */
function buildWhiteSpacePillField(index, fieldKey, label, options, value) {
    const fieldId = `white-space-${index}-${fieldKey}`;
    const visibleOptions = options.filter((option) => option !== '');
    const pillsHtml = visibleOptions.map((option) => {
        const active = value === option ? ' white-space-pill--active' : '';
        return `<button
            type="button"
            class="white-space-pill${active}"
            data-white-space-pill-target="${escapeHtml(fieldId)}"
            data-white-space-pill-value="${escapeHtml(option)}"
            aria-pressed="${value === option ? 'true' : 'false'}"
        >${escapeHtml(option)}</button>`;
    }).join('');

    return `
        <div class="white-space-field">
            <label for="${fieldId}">${escapeHtml(label)}</label>
            <input
                type="hidden"
                id="${fieldId}"
                data-white-space-index="${index}"
                data-white-space-field="${escapeHtml(fieldKey)}"
                value="${escapeHtml(value)}"
            />
            <div class="white-space-pills-wrap" role="group" aria-label="${escapeHtml(label)}">
                ${pillsHtml}
            </div>
        </div>`;
}

/**
 * Click handler for .white-space-pill buttons. Mirrors the active pill's
 * value into the matching hidden input (data-white-space-pill-target points
 * at the input id) and then triggers sync + autosave directly.
 *
 * We deliberately do NOT dispatch a synthetic 'input' event here — the
 * canvas-level input listener filters by class selector (.strategic-field,
 * .white-space-select, etc.) so it would early-return for a bare hidden
 * input. Calling syncWhiteSpaceFromCanvas() + queueAutosave() directly is
 * both simpler and avoids coupling pill behavior to that filter list.
 *
 * @param {HTMLButtonElement} pill
 */
function toggleWhiteSpacePill(pill) {
    const targetId = pill.dataset.whiteSpacePillTarget;
    const value = pill.dataset.whiteSpacePillValue ?? '';
    if (!targetId) return;

    const hiddenInput = document.getElementById(targetId);
    if (!(hiddenInput instanceof HTMLInputElement)) return;

    const wasActive = pill.classList.contains('white-space-pill--active');

    const group = pill.closest('.white-space-field');
    group?.querySelectorAll('.white-space-pill').forEach((sibling) => {
        if (!(sibling instanceof HTMLButtonElement)) return;
        sibling.classList.remove('white-space-pill--active');
        sibling.setAttribute('aria-pressed', 'false');
    });

    if (wasActive) {
        hiddenInput.value = '';
    } else {
        hiddenInput.value = value;
        pill.classList.add('white-space-pill--active');
        pill.setAttribute('aria-pressed', 'true');
    }

    syncWhiteSpaceFromCanvas();
    updateRailSummaries(_liveSections || {});
    queueAutosave();
}

/**
 * @param {unknown} rows
 */
function buildWhiteSpaceMatrixHtml(rows) {
    const list = Array.isArray(rows) && rows.length > 0
        ? rows.filter(isPlainObject).map((row) => ({
            name: row.name != null ? String(row.name) : '',
            area: row.area != null ? String(row.area) : '',
            opportunity: row.opportunity != null ? String(row.opportunity) : '',
            operational_importance: row.operational_importance != null ? String(row.operational_importance) : '',
            executive_visibility: row.executive_visibility != null ? String(row.executive_visibility) : '',
            confidence: row.confidence != null ? String(row.confidence) : '',
            value_notes: row.value_notes != null ? String(row.value_notes) : '',
        }))
        : [];

    const rowsHtml = list.length > 0
        ? list.map((row, index) => buildWhiteSpaceRowHtml(row, index)).join('')
        : '<p class="white-space-empty">No white space rows yet. Add an opportunity to begin mapping expansion areas.</p>';

    return `
        <div class="white-space-matrix" data-white-space-matrix>
            <div class="white-space-rows">${rowsHtml}</div>
            <button type="button" class="btn-secondary white-space-add-btn" data-white-space-add>
                + Add Opportunity Row
            </button>
        </div>`;
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} psychology
 */
function buildPsychologyGravityHtml(section, psychology) {
    const psych = isPlainObject(psychology) ? psychology : {};
    const gravityFields = section.gravityFields || [];

    return gravityFields.map((field) => {
        const value = String(psych[field.key] ?? '');
        if (field.key === 'narrative') {
            const fieldId = `psychology-gravity-${field.key}`;
            return `
                <div class="psychology-gravity-field psychology-gravity-field--narrative">
                    <label for="${fieldId}">${escapeHtml(field.label || field.key)}</label>
                    <textarea
                        id="${fieldId}"
                        class="strategic-field strategic-textarea"
                        data-field="psychology.${field.key}"
                        rows="3"
                    >${escapeHtml(value)}</textarea>
                </div>`;
        }

        const pillsHtml = PSYCHOLOGY_GRAVITY_PILLS.map((pill) => {
            const active = value === pill ? ' psychology-gravity-pill--active' : '';
            const pressed = value === pill ? 'true' : 'false';
            return `
                <button
                    type="button"
                    class="psychology-gravity-pill${active}"
                    data-field="psychology.${field.key}"
                    data-gravity-pill-value="${escapeHtml(pill)}"
                    aria-pressed="${pressed}"
                >${escapeHtml(pill)}</button>`;
        }).join('');

        return `
            <div class="psychology-gravity-field">
                <span class="psychology-gravity-label">${escapeHtml(field.label || field.key)}</span>
                <div class="psychology-gravity-pills-wrap" role="group" aria-label="${escapeHtml(field.label || field.key)}">
                    ${pillsHtml}
                </div>
            </div>`;
    }).join('');
}

function syncWhiteSpaceFromCanvas() {
    if (!_liveSections) return;
    ensureAccountExpansionShape();
    const matrix = document.querySelector('[data-white-space-matrix]');
    if (!matrix) return;

    /** @type {Record<string, string>[]} */
    const rows = [];
    matrix.querySelectorAll('[data-white-space-row]').forEach((rowEl) => {
        if (!(rowEl instanceof HTMLElement)) return;
        const row = { ...createEmptyWhiteSpaceRow() };
        rowEl.querySelectorAll('[data-white-space-field]').forEach((fieldEl) => {
            if (!(fieldEl instanceof HTMLInputElement || fieldEl instanceof HTMLTextAreaElement || fieldEl instanceof HTMLSelectElement)) return;
            const fieldKey = fieldEl.dataset.whiteSpaceField;
            if (!fieldKey) return;
            row[fieldKey] = fieldEl.value;
        });
        rows.push(row);
    });

    _liveSections.white_space.rows = rows.filter((row) => Object.values(row).some((value) => String(value).trim()));
}

function addWhiteSpaceRow() {
    if (!_liveSections) return;
    ensureAccountExpansionShape();
    syncWhiteSpaceFromCanvas();
    const rows = [...getWhiteSpaceRows(_liveSections.white_space)];
    rows.push(createEmptyWhiteSpaceRow());
    _liveSections.white_space.rows = rows;
    refreshWhiteSpaceSection();
    queueAutosave();
}

/**
 * @param {number} index
 */
function removeWhiteSpaceRow(index) {
    if (!_liveSections) return;
    ensureAccountExpansionShape();
    syncWhiteSpaceFromCanvas();
    const rows = [...getWhiteSpaceRows(_liveSections.white_space)];
    rows.splice(index, 1);
    _liveSections.white_space.rows = rows;
    refreshWhiteSpaceSection();
    queueAutosave();
}

function refreshWhiteSpaceSection() {
    const sectionEl = document.getElementById('strategic-section-white_space');
    const sectionDef = PLAN_SECTIONS.find((section) => section.id === 'white_space');
    if (!sectionEl || !sectionDef || !_liveSections) return;

    const headingId = `strategic-heading-${sectionDef.id}`;
    const headerContext = buildSectionHeaderContext(sectionDef);
    const bodyHtml = buildAccountExpansionHtml(sectionDef, _liveSections.white_space, _liveSections);

    sectionEl.innerHTML = `
        <h4 id="${headingId}" class="strategic-section-title">${escapeHtml(sectionDef.title)}</h4>
        ${headerContext.leadHtml}
        ${headerContext.blockHtml}
        ${bodyHtml}`;

    initAutoExpandTextareas(sectionEl);
}

function selectPsychologyGravityPill(button) {
    const field = button.dataset.field;
    const pillValue = button.dataset.gravityPillValue ?? '';
    if (!field || !_liveSections) return;

    const wasActive = button.classList.contains('psychology-gravity-pill--active');
    const newValue = wasActive ? '' : pillValue;
    const group = button.closest('.psychology-gravity-pills-wrap');

    group?.querySelectorAll('.psychology-gravity-pill').forEach((pillBtn) => {
        if (!(pillBtn instanceof HTMLElement)) return;
        const isSelected = !wasActive && pillBtn.dataset.gravityPillValue === pillValue;
        pillBtn.classList.toggle('psychology-gravity-pill--active', isSelected);
        pillBtn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    setNestedValue(_liveSections, field, newValue);
    updateRailSummaries(_liveSections);
    queueAutosave();
}

function selectInfluenceContactFieldPill(button) {
    const contactId = button.dataset.influenceContactId;
    const fieldKey = button.dataset.influenceField;
    const pillValue = button.dataset.influencePillValue ?? '';
    if (!contactId || !fieldKey) return;

    const wasActive = button.classList.contains('influence-field-pill--active');
    const newValue = wasActive ? '' : pillValue;
    const group = button.closest('.influence-field-pills-wrap');

    group?.querySelectorAll('.influence-field-pill').forEach((pillBtn) => {
        if (!(pillBtn instanceof HTMLElement)) return;
        const isSelected = !wasActive && pillBtn.dataset.influencePillValue === pillValue;
        pillBtn.classList.toggle('influence-field-pill--active', isSelected);
        pillBtn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    updateInfluenceContactField(contactId, fieldKey, newValue);
    updateRailSummaries(_liveSections || {});
    queueAutosave();
}

/**
 * @param {HTMLElement} button
 */
function selectEntryPointPill(button) {
    selectSingleValuePill(button, 'entry-point-pill', 'entry-point-pills-wrap');
}

/**
 * @param {HTMLElement} button
 * @param {string} pillClass
 * @param {string} wrapClass
 */
function selectSingleValuePill(button, pillClass, wrapClass) {
    const field = button.dataset.field;
    const pillValue = button.dataset.pillValue ?? '';
    if (!field || !_liveSections) return;

    const wasActive = button.classList.contains(`${pillClass}--active`);
    const newValue = wasActive ? '' : pillValue;
    const group = button.closest(`.${wrapClass}`);

    group?.querySelectorAll(`.${pillClass}`).forEach((pillBtn) => {
        if (!(pillBtn instanceof HTMLElement)) return;
        const isSelected = !wasActive && pillBtn.dataset.pillValue === pillValue;
        pillBtn.classList.toggle(`${pillClass}--active`, isSelected);
        pillBtn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    setNestedValue(_liveSections, field, newValue);
    updateRailSummaries(_liveSections);
    queueAutosave();
}

/**
 * @param {HTMLElement} button
 */
function selectAccountSnapshotPill(button) {
    selectSingleValuePill(button, 'account-snapshot-pill', 'account-snapshot-pills-wrap');
}

function toggleStrategicPill(button) {
    const sectionId = button.dataset.pillSection;
    const pillField = button.dataset.pillField;
    const pillValue = button.dataset.pillValue;
    const pillGroupId = button.dataset.pillGroup;
    if (!_liveSections || !sectionId || !pillField || !pillValue) return;

    const sectionDef = PLAN_SECTIONS.find((section) => section.id === sectionId);
    const sectionData = isPlainObject(_liveSections[sectionId])
        ? { ..._liveSections[sectionId] }
        : {};
    let selected = Array.isArray(sectionData[pillField])
        ? [...sectionData[pillField]]
        : [];

    if (sectionDef?.pillMode === 'either_or' && pillGroupId) {
        const group = sectionDef.pillGroups?.find((item) => item.id === pillGroupId);
        if (group) {
            selected = selected.filter((value) => !group.options.includes(value));
            const wasActive = button.classList.contains('strategic-pill-active');
            if (!wasActive) {
                selected.push(pillValue);
            }

            const groupEl = button.closest('.strategic-pill-group');
            groupEl?.querySelectorAll('.strategic-pill').forEach((pillBtn) => {
                if (!(pillBtn instanceof HTMLElement)) return;
                pillBtn.classList.toggle(
                    'strategic-pill-active',
                    selected.includes(pillBtn.dataset.pillValue || '')
                );
            });
        }
    } else {
        const index = selected.indexOf(pillValue);
        if (index >= 0) {
            selected.splice(index, 1);
            button.classList.remove('strategic-pill-active');
        } else {
            selected.push(pillValue);
            button.classList.add('strategic-pill-active');
        }
    }

    _liveSections[sectionId] = { ...sectionData, [pillField]: selected };
    updateRailSummaries(_liveSections);

    // Task 1 — keep the ghosted reminders in plan_30_60_90 / land_and_expand in
    // sync with the user's latest tension choice. This is the only pill section
    // that affects ghost content; we scope the refresh accordingly to avoid
    // wasted DOM work on unrelated pill toggles (pain signals, etc.).
    if (sectionId === 'strategic_tensions') {
        refreshStrategicTensionGhosts();
    }

    queueAutosave();
}

/**
 * @typedef {{ type: 'activity' | 'signal' | 'manual', date: Date, label: string, desc: string }} MomentumTimelineItem
 */

/**
 * @param {Record<string, unknown>} entry
 * @returns {string}
 */
function formatInteractionLogSummary(entry) {
    const text = String(entry.text ?? '').trim();
    const interaction = String(entry.interaction ?? '').trim();
    const insight = String(entry.key_insight ?? '').trim();
    if (interaction && insight) return `${interaction} — ${insight}`;
    if (interaction) return interaction;
    if (insight) return insight;
    return text;
}

/**
 * @param {string} source
 * @returns {string}
 */
function interactionLogSourceLabel(source) {
    if (source === 'activity') return 'CRM Activity';
    if (source === 'manual') return 'Interaction';
    return 'Strategic Signal';
}

/**
 * @returns {MomentumTimelineItem[]}
 */
function collectMomentumTimelineItems() {
    const log = Array.isArray(_liveSections?.interaction_log) ? _liveSections.interaction_log : [];
    const activities = _showCrmActivities
        ? (_options.getSelectedAccountDetails?.().activities || [])
        : [];

    const promotedActivityIds = new Set(
        log
            .filter((entry) => isPlainObject(entry) && entry.activity_id != null)
            .map((entry) => String(entry.activity_id))
    );

    /** @type {MomentumTimelineItem[]} */
    const items = [];

    log.forEach((entry) => {
        if (!isPlainObject(entry)) return;
        const date = new Date(String(entry.date ?? ''));
        if (Number.isNaN(date.getTime())) return;
        const summary = formatInteractionLogSummary(entry);
        if (!summary) return;
        const source = String(entry.source ?? 'signal');
        items.push({
            type: source === 'activity' ? 'activity' : source === 'manual' ? 'manual' : 'signal',
            date,
            label: interactionLogSourceLabel(source),
            desc: summary,
            momentumScore: entry.momentum_score != null ? clampScale(entry.momentum_score, 3) : null,
        });
    });

    if (_showCrmActivities) {
        activities.forEach((act) => {
            if (!isPlainObject(act)) return;
            if (act.id != null && promotedActivityIds.has(String(act.id))) return;
            const date = new Date(String(act.date ?? ''));
            if (Number.isNaN(date.getTime())) return;
            items.push({
                type: 'activity',
                date,
                label: String(act.type ?? 'Activity'),
                desc: truncateText(String(act.description ?? ''), 120),
            });
        });
    }

    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function buildMomentumTimelineDisplayHtml() {
    const items = collectMomentumTimelineItems();

    if (items.length === 0) {
        return '<p class="momentum-timeline-empty">No interaction log entries or CRM activities yet.</p>';
    }

    const rows = items.map((item) => {
        const sideClass = item.type === 'activity' ? 'timeline-item-right' : 'timeline-item-left';
        const typeClass = item.type === 'activity'
            ? 'timeline-item-activity'
            : item.type === 'manual'
                ? 'timeline-item-manual'
                : 'timeline-item-signal';
        const dateLabel = formatCommittedDate(item.date.toISOString());

        return `
            <div class="momentum-timeline-item ${sideClass} ${typeClass}">
                <div class="momentum-timeline-node" aria-hidden="true"></div>
                <article class="momentum-timeline-card">
                    <div class="momentum-timeline-card-head">
                        <span class="momentum-timeline-card-label">${escapeHtml(item.label)}</span>
                        ${item.momentumScore != null ? `<span class="momentum-timeline-card-score">${item.momentumScore} — ${escapeHtml(MOMENTUM_LABELS[item.momentumScore - 1])}</span>` : ''}
                        <time class="momentum-timeline-card-date" datetime="${escapeHtml(item.date.toISOString())}">${escapeHtml(dateLabel)}</time>
                    </div>
                    <p class="momentum-timeline-card-desc">${escapeHtml(item.desc)}</p>
                </article>
            </div>`;
    }).join('');

    return `
        <div class="momentum-timeline-tree">
            <div class="momentum-timeline-trunk" aria-hidden="true"></div>
            <div class="momentum-timeline-items">${rows}</div>
        </div>`;
}

function buildMomentumTrendlineHtml() {
    const log = Array.isArray(_liveSections?.interaction_log) ? _liveSections.interaction_log : [];
    const points = log
        .filter((entry) => isPlainObject(entry) && entry.momentum_score != null)
        .map((entry) => ({
            date: new Date(String(entry.date ?? '')),
            score: clampScale(entry.momentum_score, 3),
        }))
        .filter((point) => !Number.isNaN(point.date.getTime()))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (points.length === 0) {
        return '<p class="momentum-trendline-empty">Log strategic milestones to build a momentum trendline.</p>';
    }

    const bars = points.map((point) => {
        const height = ((point.score - 1) / 4) * 100;
        const label = formatCommittedDate(point.date.toISOString());
        return `<div class="momentum-trendline-bar" style="--trend-height:${height}%" title="${escapeHtml(label)} — ${MOMENTUM_LABELS[point.score - 1]}"><span class="momentum-trendline-score">${point.score}</span></div>`;
    }).join('');

    return `<div class="momentum-trendline" role="img" aria-label="Relationship momentum trendline">${bars}</div>`;
}

function buildMomentumTimelineHtml() {
    const toggleChecked = _showCrmActivities ? ' checked' : '';
    return `
        <div class="momentum-timeline-body">
            <div class="momentum-timeline-log">
                <textarea
                    id="momentum-signal-input"
                    class="strategic-field strategic-textarea momentum-signal-input"
                    rows="2"
                    placeholder="Describe the strategic milestone — access win, political shift, proof point…"
                ></textarea>
                <div class="momentum-milestone-score-row">
                    <label for="momentum-milestone-score">Momentum score <span class="required-mark">*</span></label>
                    <span class="momentum-milestone-score-label" data-milestone-score-label>${MOMENTUM_LABELS[2]}</span>
                    <div class="momentum-slider-wrap" style="${momentumSliderStyle(3)}">
                        <input
                            type="range"
                            class="momentum-milestone-score-input"
                            id="momentum-milestone-score"
                            min="1"
                            max="5"
                            step="1"
                            value="3"
                            aria-valuemin="1"
                            aria-valuemax="5"
                            aria-valuenow="3"
                        />
                    </div>
                </div>
                <button type="button" class="btn-secondary momentum-signal-log-btn" data-momentum-milestone-log>
                    Log Strategic Milestone
                </button>
            </div>
            <div class="momentum-trendline-host">${buildMomentumTrendlineHtml()}</div>
            <div class="momentum-timeline-controls">
                <label class="momentum-timeline-toggle">
                    <input type="checkbox" class="momentum-timeline-toggle-input" data-timeline-show-crm${toggleChecked} />
                    Show CRM activities
                </label>
            </div>
            <div class="momentum-timeline-display">${buildMomentumTimelineDisplayHtml()}</div>
        </div>`;
}

function refreshMomentumTimelineSection() {
    const sectionEl = document.getElementById('strategic-section-momentum_timeline');
    if (!sectionEl) return;

    const trendlineHost = sectionEl.querySelector('.momentum-trendline-host');
    if (trendlineHost) {
        trendlineHost.innerHTML = buildMomentumTrendlineHtml();
    }

    const display = sectionEl.querySelector('.momentum-timeline-display');
    if (display) {
        display.innerHTML = buildMomentumTimelineDisplayHtml();
    }
}

/**
 * @param {readonly string[]} options
 * @param {string} label
 * @param {string} fieldKey
 * @param {string} value
 */
function buildInteractionFormSelect(options, label, fieldKey, value) {
    const fieldId = `interaction-form-${fieldKey}`;
    const optionsHtml = options.map((option) => {
        const selected = value === option ? ' selected' : '';
        const optionLabel = option === '' ? 'Select…' : option;
        return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(optionLabel)}</option>`;
    }).join('');

    return `
        <div class="interaction-log-field">
            <label for="${fieldId}">${escapeHtml(label)}</label>
            <select id="${fieldId}" class="strategic-field interaction-log-select" data-interaction-field="${fieldKey}">
                ${optionsHtml}
            </select>
        </div>`;
}

/**
 * Pill-style toggles for short categorical interaction-log fields (Political
 * Signal, Momentum Shift). Why pills instead of <select>:
 *   - The same one-tap interaction the rep already uses in strategic_tensions,
 *     keeping the section's "tap, don't type" rhythm.
 *   - Native <select> requires two clicks to set a value and forces the user
 *     to scan a dropdown they've memorized — pure friction for a 4-option set.
 *
 * Storage shape: pills write into a hidden <input data-interaction-field>, so
 * saveInteractionForm's existing reader keeps working unchanged. We avoid
 * the global .strategic-pill class on purpose — that handler writes pill
 * selections directly into _liveSections, which is wrong for ephemeral form
 * state.
 *
 * @param {readonly string[]} options - includes '' as the "cleared" sentinel
 *   which we intentionally drop from the rendered pill set (toggling an
 *   active pill is the way to clear).
 * @param {string} label
 * @param {string} fieldKey
 * @param {string} value
 */
function buildInteractionFormPills(options, label, fieldKey, value) {
    const fieldId = `interaction-form-${fieldKey}`;
    const visibleOptions = options.filter((option) => option !== '');
    const pillsHtml = visibleOptions.map((option) => {
        const active = value === option ? ' interaction-log-pill--active' : '';
        return `<button
            type="button"
            class="interaction-log-pill${active}"
            data-interaction-pill-field="${escapeHtml(fieldKey)}"
            data-interaction-pill-value="${escapeHtml(option)}"
            aria-pressed="${value === option ? 'true' : 'false'}"
        >${escapeHtml(option)}</button>`;
    }).join('');

    return `
        <div class="interaction-log-field">
            <label for="${fieldId}">${escapeHtml(label)}</label>
            <input
                type="hidden"
                id="${fieldId}"
                data-interaction-field="${escapeHtml(fieldKey)}"
                value="${escapeHtml(value)}"
            />
            <div class="interaction-log-pills-wrap" role="group" aria-label="${escapeHtml(label)}">
                ${pillsHtml}
            </div>
        </div>`;
}

/**
 * @param {string} label
 * @param {string} fieldKey
 * @param {string} value
 * @param {number} [rows]
 */
function buildInteractionFormTextarea(label, fieldKey, value, rows = 3) {
    const fieldId = `interaction-form-${fieldKey}`;
    return `
        <div class="interaction-log-field interaction-log-field--wide">
            <label for="${fieldId}">${escapeHtml(label)}</label>
            <textarea
                id="${fieldId}"
                class="strategic-field strategic-textarea interaction-log-textarea"
                data-interaction-field="${fieldKey}"
                rows="${rows}"
            >${escapeHtml(value)}</textarea>
        </div>`;
}

function buildInteractionLogFormHtml() {
    const contacts = getAccountContacts();
    const contactOptions = ['<option value="">No contact</option>'].concat(
        contacts.map((contact) => {
            const id = escapeHtml(String(contact.id));
            const name = escapeHtml(`${contact.first_name || ''} ${contact.last_name || ''}`.trim() || `Contact ${contact.id}`);
            return `<option value="${id}">${name}</option>`;
        })
    ).join('');

    const today = new Date().toISOString().slice(0, 10);

    return `
        <div class="interaction-log-form" data-interaction-form>
            <h5 class="interaction-log-form-title">Add Interaction</h5>
            <div class="interaction-log-form-grid">
                <div class="interaction-log-field">
                    <label for="interaction-form-date">Date</label>
                    <input
                        type="date"
                        id="interaction-form-date"
                        class="strategic-field interaction-log-input"
                        data-interaction-field="date"
                        value="${today}"
                    />
                </div>
                <div class="interaction-log-field">
                    <label for="interaction-form-contact">Contact</label>
                    <select id="interaction-form-contact" class="strategic-field interaction-log-select" data-interaction-field="contact_id">
                        ${contactOptions}
                    </select>
                </div>
                ${buildInteractionFormPills(INTERACTION_POLITICAL_SIGNAL_OPTIONS, 'Political Signal', 'political_signal', '')}
                ${buildInteractionFormPills(INTERACTION_MOMENTUM_SHIFT_OPTIONS, 'Momentum Shift', 'momentum_shift', '')}
                ${buildInteractionFormTextarea('Interaction', 'interaction', '', 2)}
                ${buildInteractionFormTextarea('Key Insight', 'key_insight', '', 2)}
                ${buildInteractionFormTextarea('Relationship Energy', 'relationship_energy', '', 2)}
                ${buildInteractionFormTextarea('Trust Earned', 'trust_earned', '', 2)}
                ${buildInteractionFormTextarea('Next Move', 'next_move', '', 2)}
            </div>
            <button type="button" class="btn-secondary interaction-log-save-btn" data-interaction-save>
                Save Interaction
            </button>
        </div>`;
}

// buildInteractionLogEntryHtml() previously rendered a single past entry as
// an <article> card stacked above the form. Removed when the Interaction Log
// section was reduced to its input form only (Relationship Timeline below is
// now the single canonical chronologic view). formatInteractionLogSummary +
// interactionLogSourceLabel are kept because the timeline tree still consumes
// them via collectMomentumTimelineItems().

/**
 * Render the Interaction Log section body.
 *
 * Historical context: this used to render a chronological list of every
 * logged entry directly above the form. That duplicated the Relationship
 * Timeline section (id: momentum_timeline) which renders the same entries
 * — plus CRM activities — as a vertical timeline tree. Carrying both means
 * the rep sees the entries twice on a single document and scrolls past
 * dozens of strategic-signal lines to reach the form. We keep the entries
 * in state (still picked up by collectMomentumTimelineItems()) and drop
 * the duplicate list here. The input form is the only thing that belongs
 * in this section now; the timeline below is the canonical chronologic view.
 *
 * The `log` parameter is intentionally kept for caller signature
 * compatibility (renderCanvas + refreshInteractionLogSection both pass it),
 * but is no longer read.
 *
 * @param {unknown} _log
 */
function buildInteractionLogHtml(_log) {
    return `
        <div class="interaction-log-section">
            ${buildInteractionLogFormHtml()}
        </div>`;
}

function refreshInteractionLogSection() {
    const sectionEl = document.getElementById('strategic-section-interaction_log');
    const sectionDef = PLAN_SECTIONS.find((section) => section.id === 'interaction_log');
    if (!sectionEl || !sectionDef || !_liveSections) return;

    const headingId = `strategic-heading-${sectionDef.id}`;
    const headerContext = buildSectionHeaderContext(sectionDef);
    const bodyHtml = buildInteractionLogHtml(_liveSections.interaction_log);

    sectionEl.innerHTML = `
        <h4 id="${headingId}" class="strategic-section-title">${escapeHtml(sectionDef.title)}</h4>
        ${headerContext.leadHtml}
        ${headerContext.blockHtml}
        ${bodyHtml}`;

    initAutoExpandTextareas(sectionEl);
    initInteractionLogControls(sectionEl);
}

/**
 * Wire the post-render behaviors for the Interaction Log form:
 *   1) Replace the contact <select> with a TomSelect instance so the rep gets
 *      type-ahead + clear button parity with the rest of the app.
 *   2) Toggle .interaction-log-pill buttons (single-select per field) and
 *      mirror their value into the matching hidden <input data-interaction-
 *      field>, which is what saveInteractionForm already reads.
 *
 * Called from both paintCanvas (initial render) and refreshInteractionLog
 * Section (post-save / data refresh). Idempotent — we always destroy any
 * prior TomSelect before re-binding.
 *
 * @param {ParentNode} root
 */
function initInteractionLogControls(root) {
    const contactSelect = root.querySelector('#interaction-form-contact');

    // Destroy the previous instance no matter what — even if the new render
    // didn't include the form (e.g. an unrelated section refreshed the canvas).
    // Skipping this leaks DOM under the old select element and breaks the next
    // bind because TomSelect refuses to re-wrap a select it already owns.
    if (_interactionContactTomSelect && typeof _interactionContactTomSelect.destroy === 'function') {
        try { _interactionContactTomSelect.destroy(); } catch (_err) { /* noop */ }
        _interactionContactTomSelect = null;
    }

    if (contactSelect instanceof HTMLSelectElement && typeof window.TomSelect === 'function') {
        try {
            _interactionContactTomSelect = new window.TomSelect(contactSelect, {
                // No create — contacts must come from the account's contact list,
                // never typed freely. Search by name (the visible option text).
                create: false,
                allowEmptyOption: true,
                placeholder: 'No contact',
                searchField: ['text'],
                dropdownParent: 'body',
            });
        } catch (_err) {
            _interactionContactTomSelect = null;
        }
    }

    // Pill click handling for political_signal / momentum_shift. We bind on
    // each pill button rather than the form root to avoid duplicate handlers
    // when the canvas-level click delegate also runs (pills use a distinct
    // class so the global .strategic-pill handler ignores them).
    const pills = root.querySelectorAll('.interaction-log-pill');
    pills.forEach((pill) => {
        if (!(pill instanceof HTMLButtonElement)) return;
        pill.addEventListener('click', (event) => {
            event.preventDefault();
            toggleInteractionLogPill(pill);
        });
    });
}

/**
 * Single-select toggle: clicking a pill activates it (and clears any sibling
 * in the same field group); clicking the already-active pill clears the field.
 * Writes the resulting value into the hidden <input data-interaction-field>
 * so saveInteractionForm reads it transparently.
 *
 * @param {HTMLButtonElement} pill
 */
function toggleInteractionLogPill(pill) {
    const fieldKey = pill.dataset.interactionPillField;
    const value = pill.dataset.interactionPillValue ?? '';
    if (!fieldKey) return;

    const wasActive = pill.classList.contains('interaction-log-pill--active');

    const group = pill.closest('.interaction-log-field');
    group?.querySelectorAll('.interaction-log-pill').forEach((sibling) => {
        if (!(sibling instanceof HTMLButtonElement)) return;
        sibling.classList.remove('interaction-log-pill--active');
        sibling.setAttribute('aria-pressed', 'false');
    });

    const hiddenInput = group?.querySelector(`input[data-interaction-field="${fieldKey}"]`);
    if (hiddenInput instanceof HTMLInputElement) {
        if (wasActive) {
            hiddenInput.value = '';
        } else {
            hiddenInput.value = value;
            pill.classList.add('interaction-log-pill--active');
            pill.setAttribute('aria-pressed', 'true');
        }
    }
}

function appendInteractionLogEntry(entry) {
    if (!_liveSections) return;
    const log = Array.isArray(_liveSections.interaction_log)
        ? [..._liveSections.interaction_log]
        : [];
    log.unshift(entry);
    _liveSections.interaction_log = log;
}

function logStrategicMilestone() {
    if (!_liveSections) return;

    const textarea = document.getElementById('momentum-signal-input');
    const scoreInput = document.getElementById('momentum-milestone-score');
    if (!(textarea instanceof HTMLTextAreaElement) || !(scoreInput instanceof HTMLInputElement)) return;

    const text = textarea.value.trim();
    const score = clampScale(scoreInput.value, 3);
    if (!text) {
        _options.onToast?.('Describe the strategic milestone before logging.', 'error');
        return;
    }

    appendInteractionLogEntry({
        ...createEmptyInteractionLogEntry(),
        source: 'signal',
        date: new Date().toISOString(),
        text,
        momentum_score: score,
    });

    textarea.value = '';
    scoreInput.value = '3';
    autoExpandTextarea(textarea);
    refreshMomentumTimelineSection();
    refreshInteractionLogSection();
    updateRailSummaries(_liveSections);
    queueAutosave();
}

function logInteractionSignal() {
    logStrategicMilestone();
}

function saveInteractionForm() {
    if (!_liveSections) return;

    const form = document.querySelector('[data-interaction-form]');
    if (!form) return;

    /** @type {Record<string, string>} */
    const values = {};
    form.querySelectorAll('[data-interaction-field]').forEach((el) => {
        if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
        const key = el.dataset.interactionField;
        if (!key) return;
        values[key] = el.value;
    });

    const interaction = String(values.interaction ?? '').trim();
    const keyInsight = String(values.key_insight ?? '').trim();
    const relationshipEnergy = String(values.relationship_energy ?? '').trim();
    const trustEarned = String(values.trust_earned ?? '').trim();
    const nextMove = String(values.next_move ?? '').trim();

    if (!interaction && !keyInsight && !relationshipEnergy && !trustEarned && !nextMove) {
        _options.onToast?.('Add at least one interaction field before saving.', 'error');
        return;
    }

    const dateValue = String(values.date ?? '').trim();
    const isoDate = dateValue ? new Date(`${dateValue}T12:00:00`).toISOString() : new Date().toISOString();

    appendInteractionLogEntry({
        ...createEmptyInteractionLogEntry(),
        source: 'manual',
        date: isoDate,
        contact_id: values.contact_id ? String(values.contact_id) : null,
        interaction,
        key_insight: keyInsight,
        political_signal: INTERACTION_POLITICAL_SIGNAL_OPTIONS.includes(values.political_signal)
            ? values.political_signal
            : '',
        relationship_energy: relationshipEnergy,
        trust_earned: trustEarned,
        momentum_shift: INTERACTION_MOMENTUM_SHIFT_OPTIONS.includes(values.momentum_shift)
            ? values.momentum_shift
            : '',
        next_move: nextMove,
    });

    refreshInteractionLogSection();
    refreshMomentumTimelineSection();
    updateRailSummaries(_liveSections);
    queueAutosave();
    _options.onToast?.('Interaction saved.', 'success');
}

/**
 * @param {object} activity
 * @returns {boolean}
 */
export function promoteActivityToInteractionLog(activity) {
    if (!_liveSections || !isPlainObject(activity)) {
        _options.onToast?.('Open Strategic mode with a loaded plan first.', 'error');
        return false;
    }

    const log = Array.isArray(_liveSections.interaction_log)
        ? [..._liveSections.interaction_log]
        : [];
    const activityId = activity.id != null ? String(activity.id) : null;
    if (activityId && log.some((entry) => isPlainObject(entry) && String(entry.activity_id) === activityId)) {
        _options.onToast?.('Activity already promoted to the interaction log.', 'error');
        return false;
    }

    const description = String(activity.description ?? '').trim();
    const type = String(activity.type ?? 'Activity');
    const contactId = activity.contact_id != null ? String(activity.contact_id) : null;

    appendInteractionLogEntry({
        ...createEmptyInteractionLogEntry(),
        source: 'activity',
        date: activity.date != null ? String(activity.date) : new Date().toISOString(),
        contact_id: contactId,
        interaction: description ? `${type}: ${description}` : type,
        text: description,
        activity_id: activityId,
    });

    refreshInteractionLogSection();
    refreshMomentumTimelineSection();
    updateRailSummaries(_liveSections);
    queueAutosave();
    _options.onToast?.('Activity promoted to interaction log.', 'success');
    return true;
}

/**
 * @param {Record<string, unknown>} sections
 * @param {number} [entryPointActiveIndex]
 */
function buildCanvasHtml(sections, entryPointActiveIndex = 0) {
    return getCanvasPlanSections().map((section) => {
        const headingId = `strategic-heading-${section.id}`;
        const sectionId = `strategic-section-${section.id}`;
        const headerContext = buildSectionHeaderContext(section);

        if (section.type === 'composite_textarea') {
            const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
            // Task 1 — Strategic Ghosting: land_and_expand is a composite_textarea
            // section that needs the tension ghost prepended. The check is by
            // sectionId so future sections can opt in via TENSION_GHOST_SECTIONS
            // without touching this branch.
            const ghostHtml = TENSION_GHOST_SECTIONS.includes(section.id)
                ? buildStrategicTensionGhostHtml(sections.strategic_tensions, section.id)
                : '';
            return wrapStrategicSection(
                sectionId,
                headingId,
                section.title,
                headerContext,
                `${ghostHtml}${buildCompositeTextareaHtml(section, data)}`
            );
        }

        if (section.type === 'pursuit_with_pain') {
            const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
            return wrapStrategicSection(
                sectionId,
                headingId,
                section.title,
                headerContext,
                buildPursuitWithPainHtml(section, data),
                'strategic-section--pursuit-thesis'
            );
        }

        if (section.type === 'account_snapshot') {
            const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
            const account = _options.getSelectedAccount?.() ?? null;
            return wrapStrategicSection(
                sectionId,
                headingId,
                section.title,
                headerContext,
                buildAccountSnapshotHtml(section, data, account),
                'strategic-section--account-snapshot'
            );
        }

        if (section.type === 'battlefield') {
            const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
            return wrapStrategicSection(
                sectionId,
                headingId,
                section.title,
                headerContext,
                buildBattlefieldHtml(section, data),
                'strategic-section--battlefield'
            );
        }

        if (section.type === 'account_expansion') {
            const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
            return wrapStrategicSection(
                sectionId,
                headingId,
                section.title,
                headerContext,
                buildAccountExpansionHtml(section, data, sections),
                'strategic-section--account-expansion'
            );
        }

        if (section.type === 'blindspots_list') {
            const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
            return wrapStrategicSection(
                sectionId,
                headingId,
                section.title,
                headerContext,
                buildBlindspotsListHtml(section, data),
                'strategic-section--blindspots'
            );
        }

        if (section.type === 'pills_and_narrative') {
            const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
            const extraClass = section.pillNarrativeLayout === 'split'
                ? 'strategic-section--tensions-split'
                : section.id === 'strategic_tensions'
                    ? 'strategic-section--strategic-tensions'
                    : '';
            return wrapStrategicSection(
                sectionId,
                headingId,
                section.title,
                headerContext,
                buildPillsAndNarrativeHtml(section, data),
                extraClass
            );
        }

        if (section.type === 'influence_board') {
            const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
            return wrapStrategicSection(
                sectionId,
                headingId,
                section.title,
                headerContext,
                buildInfluenceBoardHtml(section, data),
                'strategic-section--influence'
            );
        }

        if (section.type === 'psychology_grid') {
            const psychology = isPlainObject(sections.psychology) ? sections.psychology : {};
            const bypassRequired = isBureaucracyBypassTrapActive(psychology);
            const sliders = (section.sliders || PSYCHOLOGY_SLIDERS).map((slider) => {
                const value = clampScale(psychology[slider.id], 3);
                const hintHtml = slider.hint
                    ? `<p class="psychology-slider-hint">${escapeHtml(slider.hint)}</p>`
                    : '';
                return `
                    <div class="psychology-slider-row" data-metric-id="${slider.id}">
                        <div class="psychology-slider-header">
                            <label class="psychology-slider-label" for="psychology-${slider.id}">${escapeHtml(slider.label)}</label>
                            <span class="psychology-slider-value" data-psych-value="${slider.id}">${value}</span>
                        </div>
                        ${hintHtml}
                        <div class="psychology-slider-wrap" data-color-scale="${slider.colorScale || 'direct'}" style="${psychologySliderStyle(slider.id, value, slider.colorScale)}">
                            <input
                                type="range"
                                class="psychology-slider"
                                id="psychology-${slider.id}"
                                min="1"
                                max="5"
                                step="1"
                                value="${value}"
                                data-field="psychology.${slider.id}"
                                aria-valuemin="1"
                                aria-valuemax="5"
                                aria-valuenow="${value}"
                            />
                        </div>
                        <div class="psychology-slider-scale">
                            <span>${escapeHtml(slider.lowLabel)}</span>
                            <span>${escapeHtml(slider.highLabel)}</span>
                        </div>
                    </div>`;
            }).join('');

            return wrapStrategicSection(sectionId, headingId, section.title, headerContext, `
                <div class="psychology-grid">${sliders}</div>
                <div class="psychology-gravity-section">
                    <h5 class="psychology-gravity-heading">Enterprise Gravity</h5>
                    <div class="psychology-gravity-grid">${buildPsychologyGravityHtml(section, psychology)}</div>
                </div>
                <div class="psychology-bypass-trap${bypassRequired ? '' : ' hidden'}" data-psychology-bypass-trap>
                    <label for="psychology-bureaucracy-bypass">Bureaucracy Bypass Strategy <span class="required-mark">*</span></label>
                    ${buildFieldHintHtml('Conservative buyers inside heavy process will stall — spell out how you circumvent the bureaucracy without triggering procurement antibodies.')}
                    <textarea
                        id="psychology-bureaucracy-bypass"
                        class="strategic-field strategic-textarea psychology-bypass-textarea"
                        data-field="psychology.bureaucracy_bypass_strategy"
                        rows="3"
                        ${bypassRequired ? 'required' : ''}
                    >${escapeHtml(String(psychology.bureaucracy_bypass_strategy ?? ''))}</textarea>
                </div>`);
        }

        if (section.type === 'timeline_view') {
            return wrapStrategicSection(
                sectionId,
                headingId,
                section.title,
                headerContext,
                buildMomentumTimelineHtml(),
                'strategic-section--timeline'
            );
        }

        if (section.type === 'triple_textarea') {
            const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};
            // Task 1 — Strategic Ghosting on the 30/60/90 plan. This is the
            // single most important place to enforce the linkage: the reason
            // ghost reminders exist at all.
            const ghostHtml = TENSION_GHOST_SECTIONS.includes(section.id)
                ? buildStrategicTensionGhostHtml(sections.strategic_tensions, section.id)
                : '';
            return wrapStrategicSection(
                sectionId,
                headingId,
                section.title,
                headerContext,
                `${ghostHtml}${buildPlan306090Html(section, plan306090)}`,
                'strategic-section--plan306090'
            );
        }

        if (section.type === 'entry_point_carousel') {
            const entryPoints = sections.entry_points;
            return wrapStrategicSection(
                sectionId,
                headingId,
                section.title,
                headerContext,
                buildEntryPointCarouselHtml(section, entryPoints, entryPointActiveIndex),
                'strategic-section--entry-points'
            );
        }

        return '';
    }).join('');
}

/**
 * "So What?" trap — conservative risk + heavy bureaucracy requires explicit bypass plan.
 *
 * @param {Record<string, unknown>} psychology
 */
function isBureaucracyBypassTrapActive(psychology) {
    const risk = clampScale(psychology.risk_appetite, 3);
    const bureaucracy = clampScale(psychology.bureaucracy_level, 3);
    return risk <= 2 && bureaucracy >= 4;
}

/**
 * MEDDPICC gate — plan cannot reach 100% completeness without an Economic Buyer.
 *
 * @param {Record<string, unknown>} sections
 */
function hasDesignatedEconomicBuyer(sections) {
    const mapping = isPlainObject(sections.influence_mapping) ? sections.influence_mapping : {};
    return ['executive', 'mid_level', 'technical'].some((tier) => {
        const list = Array.isArray(mapping[tier]) ? mapping[tier] : [];
        return list.some((entry) => isPlainObject(entry) && (entry.is_economic_buyer === '1' || entry.is_economic_buyer === true));
    });
}

/**
 * @param {Record<string, unknown>} sections
 */
function resolveLatestMomentumFromLog(sections) {
    const log = Array.isArray(sections.interaction_log) ? sections.interaction_log : [];
    for (const entry of log) {
        if (!isPlainObject(entry) || entry.momentum_score == null) continue;
        const score = clampScale(entry.momentum_score, 3);
        const text = String(entry.text ?? entry.interaction ?? '').trim();
        return { score, narrative: text };
    }
    return { score: 3, narrative: '' };
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} sections
 */
function isSectionFilled(section, sections) {
    const data = sections[section.id];

    if (section.type === 'pursuit_with_pain') {
        const obj = isPlainObject(data) ? data : {};
        const fields = section.fields || [];
        const textFilled = fields.some((field) => String(obj[field.key] ?? '').trim());
        const painPills = Array.isArray(obj.operational_pain_selected) ? obj.operational_pain_selected : [];
        const painNotes = String(obj.operational_pain_notes ?? '').trim();
        return textFilled || painPills.length > 0 || Boolean(painNotes);
    }

    if (section.type === 'battlefield') {
        const obj = isPlainObject(data) ? data : {};
        const positioning = Array.isArray(obj.positioning_pills) ? obj.positioning_pills : [];
        const moat = Array.isArray(obj.moat_pills) ? obj.moat_pills : [];
        return positioning.length > 0
            || moat.length > 0
            || String(obj.incumbents ?? '').trim()
            || String(obj.narrative ?? '').trim()
            || String(obj.compound_relationships ?? '').trim()
            || String(obj.difficult_to_remove ?? '').trim();
    }

    if (section.type === 'account_expansion') {
        const obj = isPlainObject(data) ? data : {};
        const wedgeFilled = (section.wedgeFields || []).some(
            (field) => String(obj[field.key] ?? '').trim()
        );
        return wedgeFilled || getWhiteSpaceRows(obj).length > 0;
    }

    if (section.type === 'account_snapshot') {
        const snap = isPlainObject(data) ? data : {};
        return (section.fields || []).some((field) => String(snap[field.key] ?? '').trim());
    }

    if (section.type === 'composite_textarea') {
        const obj = isPlainObject(data) ? data : {};
        const fields = section.fields || [];
        return fields.some((field) => String(obj[field.key] ?? '').trim());
    }

    if (section.type === 'triple_textarea') {
        const obj = isPlainObject(data) ? data : {};
        const horizons = section.horizons || [];
        const horizonFilled = horizons.some((field) => String(obj[field.key] ?? '').trim());
        const commitments = Array.isArray(obj.client_commitments) ? obj.client_commitments : [];
        const commitmentsFilled = commitments.some((entry) => String(entry ?? '').trim());
        return horizonFilled || commitmentsFilled;
    }

    if (section.type === 'blindspots_list') {
        const obj = isPlainObject(data) ? data : {};
        const items = Array.isArray(obj.blindspots) ? obj.blindspots : [];
        return items.some((entry) => String(entry ?? '').trim());
    }

    if (
        section.type === 'pills_and_narrative'
    ) {
        const obj = isPlainObject(data) ? data : {};
        const pillField = section.pillField || 'selected_pills';
        const pills = Array.isArray(obj[pillField]) ? obj[pillField] : [];
        const textFilled = (section.textFields || []).some(
            (field) => String(obj[field.key] ?? '').trim()
        );
        if (section.type === 'pills_and_narrative' && section.id === 'strategic_tensions') {
            return pills.length > 0 || textFilled;
        }
        return pills.length > 0 || textFilled;
    }

    if (section.type === 'influence_board') {
        const mapping = isPlainObject(data) ? data : {};
        const hasContacts = ['executive', 'mid_level', 'technical'].some(
            (key) => Array.isArray(mapping[key]) && mapping[key].length > 0
        );
        const accessPath = isPlainObject(mapping.access_path) ? mapping.access_path : {};
        const hasText = [
            mapping.invisible_org_chart,
            mapping.political_dynamics,
            accessPath.current,
            accessPath.desired,
            accessPath.bridge,
            accessPath.strategy,
        ].some((value) => String(value ?? '').trim());
        return hasContacts || hasText;
    }

    if (section.type === 'psychology_grid') {
        const psych = isPlainObject(data) ? data : {};
        const gravityFilled = (section.gravityFields || []).some(
            (field) => String(psych[field.key] ?? '').trim()
        );
        const sliderMoved = PSYCHOLOGY_SLIDERS.some((slider) => {
            const value = parseInt(String(psych[slider.id] ?? ''), 10);
            return !Number.isNaN(value) && value !== 3;
        });
        const bypassOk = !isBureaucracyBypassTrapActive(psych)
            || String(psych.bureaucracy_bypass_strategy ?? '').trim();
        return (gravityFilled || sliderMoved || String(psych.narrative ?? '').trim()) && bypassOk;
    }

    if (section.type === 'timeline_view') {
        const log = Array.isArray(sections.interaction_log) ? sections.interaction_log : [];
        const activities = _options.getSelectedAccountDetails?.()?.activities || [];
        return log.some((entry) => isPlainObject(entry) && formatInteractionLogSummary(entry))
            || activities.length > 0;
    }

    if (section.type === 'entry_point_carousel') {
        const points = Array.isArray(data) ? data : [];
        return points.some((point) => {
            if (!isPlainObject(point)) return false;
            return ENTRY_POINT_FIELD_KEYS.some((key) => String(point[key] ?? '').trim());
        });
    }

    return false;
}

/**
 * @param {Record<string, unknown>} sections
 */
function computePlanCompleteness(sections) {
    const visibleSections = getCanvasPlanSections();
    const total = visibleSections.length;
    if (total === 0) return { filled: 0, total: 0, percent: 0 };

    const filled = visibleSections.filter((section) => isSectionFilled(section, sections)).length;
    let percent = Math.round((filled / total) * 100);
    // MEDDPICC gate: without an Economic Buyer the plan is structurally incomplete.
    if (!hasDesignatedEconomicBuyer(sections)) {
        percent = Math.min(percent, 99);
    }
    return { filled, total, percent };
}

/**
 * @param {Record<string, unknown>} sections
 */
function renderRail(sections) {
    const rail = document.getElementById('strategic-rail');
    if (!rail) return;

    const latestMomentum = resolveLatestMomentumFromLog(sections);
    const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};
    const score = latestMomentum.score;
    const narrativePreview = latestMomentum.narrative
        ? truncateText(latestMomentum.narrative, 120)
        : 'No narrative yet.';
    const completeness = computePlanCompleteness(sections);

    rail.innerHTML = `
        <div class="section-card strategic-rail-card" id="rail-completeness-card">
            <div class="section-card-header">
                <h2 class="section-title">Plan Completeness</h2>
            </div>
            <div class="strategic-rail-body px-5 pb-5">
                <div class="rail-completeness-header">
                    <span class="rail-completeness-percent" data-rail-completeness-percent>${completeness.percent}%</span>
                    <span class="rail-completeness-count" data-rail-completeness-count>${completeness.filled} / ${completeness.total} sections</span>
                </div>
                <div class="rail-completeness-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${completeness.percent}" data-rail-completeness-bar>
                    <div class="rail-completeness-bar-fill" data-rail-completeness-fill style="width: ${completeness.percent}%"></div>
                </div>
            </div>
        </div>
        <div class="section-card strategic-rail-card" id="rail-momentum-card">
            <div class="section-card-header">
                <h2 class="section-title">Relationship Momentum</h2>
            </div>
            <div class="strategic-rail-body px-5 pb-5">
                <div class="rail-momentum-score">
                    <span class="rail-score-badge" data-rail-momentum-score>${score}</span>
                    <span class="rail-score-label" data-rail-momentum-label>${MOMENTUM_LABELS[score - 1]}</span>
                </div>
                <p class="rail-summary-text" data-rail-momentum-narrative>${escapeHtml(narrativePreview)}</p>
            </div>
        </div>
        <div class="section-card strategic-rail-card" id="rail-plan-card">
            <div class="section-card-header">
                <h2 class="section-title">Next 30 Days</h2>
            </div>
            <div class="strategic-rail-body px-5 pb-5">
                <div class="rail-plan-preview" data-rail-plan-30>${formatPlanHorizonRailPreviewHtml(plan306090.days_30)}</div>
            </div>
        </div>
        <div class="section-card strategic-rail-card">
            <div class="section-card-header">
                <h2 class="section-title">Export</h2>
            </div>
            <div class="strategic-rail-body px-5 pb-5 flex flex-col gap-2">
                <button type="button" id="plan-export-dossier-btn" class="btn-secondary plan-export-btn w-full">
                    <i class="fas fa-file-pdf" aria-hidden="true"></i> Export Plan Summary (PDF)
                </button>
                <button type="button" id="plan-export-exec-btn" class="btn-secondary plan-export-btn w-full">
                    <i class="fas fa-file-powerpoint" aria-hidden="true"></i> Export Summary Presentation (PowerPoint)
                </button>
            </div>
        </div>
        <div class="section-card strategic-rail-card">
            <div class="section-card-header">
                <h2 class="section-title">Versioning</h2>
            </div>
            <div class="strategic-rail-body px-5 pb-5">
                <button type="button" id="plan-force-commit-btn" class="btn-primary plan-force-commit-btn w-full">
                    <i class="fas fa-bookmark" aria-hidden="true"></i> Force Commit Milestone
                </button>
                <p class="rail-help-text text-xs text-[var(--text-muted)] mt-3">Creates a manual snapshot before your next edit. Auto milestones occur every 24 hours.</p>
            </div>
        </div>`;

    const forceBtn = document.getElementById('plan-force-commit-btn');
    if (forceBtn instanceof HTMLButtonElement) {
        forceBtn.disabled = !_planRowId;
    }
    const dossierBtn = document.getElementById('plan-export-dossier-btn');
    const execBtn = document.getElementById('plan-export-exec-btn');
    if (dossierBtn instanceof HTMLButtonElement) dossierBtn.disabled = !_planRowId;
    if (execBtn instanceof HTMLButtonElement) execBtn.disabled = !_planRowId;
}

function bindPlanPdfPreviewModal() {
    const modal = document.getElementById('plan-pdf-preview-modal');
    if (!modal || modal.dataset.previewBound) return;
    modal.dataset.previewBound = '1';

    const closeBtn = document.getElementById('plan-pdf-preview-close-btn');
    const downloadBtn = document.getElementById('plan-pdf-preview-download-btn');

    closeBtn?.addEventListener('click', () => closeAccountPlanPdfPreview());

    downloadBtn?.addEventListener('click', () => {
        const filename = modal.dataset.previewFilename || 'Strategic_Account_Plan.pdf';
        const url = modal.dataset.previewUrl;
        if (!url) return;

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
    });

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeAccountPlanPdfPreview();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (modal.classList.contains('hidden')) return;
        closeAccountPlanPdfPreview();
    });
}

function bindRailControls() {
    const rail = document.getElementById('strategic-rail');
    if (!rail || rail.dataset.railBound) return;
    rail.dataset.railBound = '1';
    rail.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('#plan-force-commit-btn')) {
            handleForceCommit();
            return;
        }
        if (target.closest('#plan-export-dossier-btn')) {
            handleExportPdf('dossier');
            return;
        }
        if (target.closest('#plan-export-exec-btn')) {
            handleExportPdf('exec');
        }
    });
}

/**
 * @param {'dossier' | 'exec'} type
 */
function getPlanExportGeneratingCopy(type) {
    if (type === 'exec') {
        return {
            title: 'Generating Presentation',
            subtitle: 'Synthesizing AI highlight reel…',
        };
    }
    return {
        title: 'Generating Plan Summary',
        subtitle: 'Assembling your Strategic Account Plan Summary…',
    };
}

function setPlanExportGeneratingSubtitle(text) {
    const subtitleEl = document.getElementById('plan-export-generating-subtitle');
    if (subtitleEl) subtitleEl.textContent = text;
}

function showPlanExportGeneratingOverlay(type) {
    const overlay = document.getElementById('plan-export-generating-overlay');
    const titleEl = document.getElementById('plan-export-generating-title');
    const subtitleEl = document.getElementById('plan-export-generating-subtitle');
    if (!overlay) return;

    const copy = getPlanExportGeneratingCopy(type);
    if (titleEl) titleEl.textContent = copy.title;
    if (subtitleEl) subtitleEl.textContent = copy.subtitle;

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-busy', 'true');
}

function hidePlanExportGeneratingOverlay() {
    const overlay = document.getElementById('plan-export-generating-overlay');
    if (!overlay) return;

    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.removeAttribute('aria-busy');
}

/**
 * @param {'dossier' | 'exec'} type
 */
async function handleExportPdf(type) {
    if (!_planRowId || !_planBaseline) {
        _options.onToast?.('No account plan loaded.', 'error');
        return;
    }

    const accountBase = _options.getSelectedAccount?.() ?? null;
    const accountDetails = _options.getSelectedAccountDetails?.();
    const account = accountBase
        ? { ...accountBase, contacts: accountDetails?.contacts ?? [] }
        : null;
    syncLiveSectionsFromCanvas();
    const planForExport = deepClonePlan(_planBaseline);
    if (_liveSections) {
        planForExport.current_draft.sections = deepClonePlan({
            current_draft: { sections: _liveSections },
        }).current_draft.sections;
    }

    showPlanExportGeneratingOverlay(type);

    const dossierBtn = document.getElementById('plan-export-dossier-btn');
    const execBtn = document.getElementById('plan-export-exec-btn');
    [dossierBtn, execBtn].forEach((btn) => {
        if (btn instanceof HTMLButtonElement) btn.disabled = true;
    });

    try {
        /** @type {import('./account-plan-presentation-types.js').PresentationHighlight | null} */
        let presentationHighlight = null;

        if (type === 'exec' && _supabase) {
            setPlanExportGeneratingSubtitle('Synthesizing highlight reel with Gemini…');
            try {
                presentationHighlight = await fetchPresentationHighlight(_supabase, planForExport, account);
            } catch (err) {
                console.warn('[account-plan-ui] AI presentation synthesis failed:', err);
                _options.onToast?.(
                    err?.message
                        ? `AI highlight skipped: ${err.message}`
                        : 'AI highlight skipped — deck built from plan content.',
                    'warning'
                );
            }
        } else if (type === 'exec' && !_supabase) {
            _options.onToast?.('Sign in to enable AI highlight reel synthesis.', 'error');
        }

        if (type === 'exec') {
            setPlanExportGeneratingSubtitle('Building PowerPoint deck…');
            const { bytes, filename } = await generateExecPresentationPptx(
                planForExport,
                account,
                presentationHighlight
            );
            downloadFileBytes(
                bytes,
                filename,
                'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            );
            _options.onToast?.('Presentation downloaded.', 'success');
            return;
        }

        const { bytes, filename } = await generateAccountPlanPdf(planForExport, account, type);
        openAccountPlanPdfPreview(bytes, filename);
    } catch (err) {
        console.error('[account-plan-ui] PDF export failed:', err);
        _options.onToast?.(err?.message || 'PDF export failed.', 'error');
    } finally {
        hidePlanExportGeneratingOverlay();
        if (dossierBtn instanceof HTMLButtonElement) dossierBtn.disabled = !_planRowId;
        if (execBtn instanceof HTMLButtonElement) execBtn.disabled = !_planRowId;
    }
}

function updateRailSummaries(sections) {
    const latestMomentum = resolveLatestMomentumFromLog(sections);
    const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};
    const score = latestMomentum.score;
    const narrative = latestMomentum.narrative;

    const scoreEl = document.querySelector('[data-rail-momentum-score]');
    const labelEl = document.querySelector('[data-rail-momentum-label]');
    const narrativeEl = document.querySelector('[data-rail-momentum-narrative]');
    if (scoreEl) scoreEl.textContent = String(score);
    if (labelEl) labelEl.textContent = MOMENTUM_LABELS[score - 1];
    if (narrativeEl) {
        narrativeEl.textContent = narrative
            ? truncateText(narrative, 120)
            : 'No narrative yet.';
    }

    const plan30 = document.querySelector('[data-rail-plan-30]');
    if (plan30) plan30.innerHTML = formatPlanHorizonRailPreviewHtml(plan306090.days_30);

    const momentumLabel = document.querySelector('[data-momentum-label]');
    if (momentumLabel) momentumLabel.textContent = MOMENTUM_LABELS[score - 1];

    const completeness = computePlanCompleteness(sections);
    const percentEl = document.querySelector('[data-rail-completeness-percent]');
    const countEl = document.querySelector('[data-rail-completeness-count]');
    const barEl = document.querySelector('[data-rail-completeness-bar]');
    const fillEl = document.querySelector('[data-rail-completeness-fill]');
    if (percentEl) percentEl.textContent = `${completeness.percent}%`;
    if (countEl) countEl.textContent = `${completeness.filled} / ${completeness.total} sections`;
    if (barEl) barEl.setAttribute('aria-valuenow', String(completeness.percent));
    if (fillEl) fillEl.style.width = `${completeness.percent}%`;
}

let _draggedInfluenceContactId = null;

/** @typedef {'core' | 'deep'} SaosViewMode */

const SAOS_VIEW_MODE_STORAGE_KEY = 'saos-view-mode';

/** @type {SaosViewMode} */
let _saosViewMode = 'core';

/**
 * Push a new blindspot string into the live plan, persist, and re-render
 * just the section. Trimmed empties and exact-match duplicates are
 * silently dropped because a strict checklist UI must NOT accumulate
 * noise — the whole point of the refactor is to keep the list short.
 *
 * @param {string} text
 */
function addBlindspotEntry(text) {
    if (!_liveSections) return;
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    const current = isPlainObject(_liveSections.critical_unknowns)
        ? _liveSections.critical_unknowns
        : { blindspots: [] };
    const existing = Array.isArray(current.blindspots) ? current.blindspots : [];
    if (existing.some((entry) => String(entry ?? '').trim() === trimmed)) {
        // Silent dedupe — the rep typed the same question twice. Toasting
        // would be noisy; the input clearing below is signal enough.
        return;
    }
    _liveSections.critical_unknowns = {
        blindspots: [...existing, trimmed],
    };
    refreshBlindspotsSection();
    updateRailSummaries(_liveSections);
    queueAutosave();
}

/**
 * Remove a blindspot at the given index. Used by the per-row "×" remove
 * button. Out-of-range indices are ignored defensively because the
 * caller is reading dataset attributes off potentially-stale DOM.
 *
 * @param {number} index
 */
function removeBlindspotEntry(index) {
    if (!_liveSections || !Number.isFinite(index)) return;
    const current = isPlainObject(_liveSections.critical_unknowns)
        ? _liveSections.critical_unknowns
        : { blindspots: [] };
    const existing = Array.isArray(current.blindspots) ? [...current.blindspots] : [];
    if (index < 0 || index >= existing.length) return;
    existing.splice(index, 1);
    _liveSections.critical_unknowns = { blindspots: existing };
    refreshBlindspotsSection();
    updateRailSummaries(_liveSections);
    queueAutosave();
}

/**
 * Re-render just the Blindspots section in place. We intentionally do
 * NOT call paintCanvas() — that would steal caret focus from any other
 * field the rep is editing. The Blindspots input is not stateful
 * between renders (it's an ephemeral add buffer) so a hard innerHTML
 * swap is safe here.
 */
/**
 * @param {string} text
 */
function addClientCommitmentEntry(text) {
    if (!_liveSections) return;
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    const current = isPlainObject(_liveSections.plan_30_60_90)
        ? _liveSections.plan_30_60_90
        : { client_commitments: [] };
    const existing = Array.isArray(current.client_commitments) ? current.client_commitments : [];
    if (existing.some((entry) => String(entry ?? '').trim() === trimmed)) return;
    _liveSections.plan_30_60_90 = {
        ...current,
        client_commitments: [...existing, trimmed],
    };
    refreshPlan306090Section();
    updateRailSummaries(_liveSections);
    queueAutosave();
}

/**
 * @param {number} index
 */
function removeClientCommitmentEntry(index) {
    if (!_liveSections || !Number.isFinite(index)) return;
    const current = isPlainObject(_liveSections.plan_30_60_90)
        ? _liveSections.plan_30_60_90
        : { client_commitments: [] };
    const existing = Array.isArray(current.client_commitments) ? [...current.client_commitments] : [];
    if (index < 0 || index >= existing.length) return;
    existing.splice(index, 1);
    _liveSections.plan_30_60_90 = { ...current, client_commitments: existing };
    refreshPlan306090Section();
    updateRailSummaries(_liveSections);
    queueAutosave();
}

function refreshPlan306090Section() {
    const sectionEl = document.getElementById('strategic-section-plan_30_60_90');
    const sectionDef = PLAN_SECTIONS.find((section) => section.id === 'plan_30_60_90');
    if (!sectionEl || !sectionDef || !_liveSections) return;

    const headingId = `strategic-heading-${sectionDef.id}`;
    const headerContext = buildSectionHeaderContext(sectionDef);
    const plan306090 = isPlainObject(_liveSections.plan_30_60_90) ? _liveSections.plan_30_60_90 : {};
    const ghostHtml = TENSION_GHOST_SECTIONS.includes(sectionDef.id)
        ? buildStrategicTensionGhostHtml(_liveSections.strategic_tensions, sectionDef.id)
        : '';

    sectionEl.innerHTML = `
        <h4 id="${headingId}" class="strategic-section-title">${escapeHtml(sectionDef.title)}</h4>
        ${headerContext.leadHtml}
        ${headerContext.blockHtml}
        ${ghostHtml}${buildPlan306090Html(sectionDef, plan306090)}`;

    const input = sectionEl.querySelector('[data-client-commitments-input]');
    if (input instanceof HTMLInputElement) input.focus();
}

function refreshBlindspotsSection() {
    const sectionEl = document.getElementById('strategic-section-critical_unknowns');
    const sectionDef = PLAN_SECTIONS.find((section) => section.id === 'critical_unknowns');
    if (!sectionEl || !sectionDef || !_liveSections) return;

    const headingId = `strategic-heading-${sectionDef.id}`;
    const headerContext = buildSectionHeaderContext(sectionDef);
    const data = isPlainObject(_liveSections.critical_unknowns)
        ? _liveSections.critical_unknowns
        : { blindspots: [] };
    const bodyHtml = buildBlindspotsListHtml(sectionDef, data);

    sectionEl.innerHTML = `
        <h4 id="${headingId}" class="strategic-section-title">${escapeHtml(sectionDef.title)}</h4>
        ${headerContext.leadHtml}
        ${headerContext.blockHtml}
        ${bodyHtml}`;

    // Re-focus the input so the rep can keep typing successive
    // blindspots without re-clicking. This mirrors the "rapid-fire"
    // checklist feel called for in the Task 3 spec.
    const input = sectionEl.querySelector('[data-blindspots-input]');
    if (input instanceof HTMLInputElement) input.focus();
}

function bindCanvasFormEvents(canvas) {
    if (_canvasEventsBound) return;
    _canvasEventsBound = true;

    canvas.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches('.strategic-field, .psychology-slider, .momentum-slider, .momentum-milestone-score-input, .influence-card-notes, .influence-card-field-textarea, .entry-point-select, .white-space-select, .white-space-textarea')) return;

        if (target instanceof HTMLTextAreaElement) {
            autoExpandTextarea(target);
            // Task 3 — Insight Density nudge. Cheap O(1) check on every
            // keystroke. updateInsightDensityState short-circuits unless the
            // textarea opted in via the strategic-insight-textarea class.
            updateInsightDensityState(target);
        }

        if (target instanceof HTMLInputElement && target.type === 'range') {
            handleRangeInput(target);
        }

        // Live carousel-tab relabel for entry-point contact_name is handled
        // inside applyFieldToLiveSections — the regex on
        // entry_points.N.contact_name fires the patch after _liveSections is
        // up to date. Done in-place rather than via paintCanvas() so the user
        // keeps caret position + IME composition state while typing.

        applyFieldToLiveSections(target);
        updateRailSummaries(_liveSections || {});
        queueAutosave();
    });

    canvas.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        if (target instanceof HTMLInputElement && target.matches('[data-timeline-show-crm]')) {
            _showCrmActivities = target.checked;
            refreshMomentumTimelineSection();
            return;
        }

        if (!target.matches('.strategic-field, .psychology-slider, .momentum-slider, .momentum-milestone-score-input, .influence-card-notes, .influence-card-field-textarea, .entry-point-select, .white-space-select, .white-space-textarea, .interaction-log-select, .interaction-log-input')) return;
        applyFieldToLiveSections(target);
        updateRailSummaries(_liveSections || {});
        queueAutosave();
    });

    // Task 3 — Enter key inside the Blindspots input fires the same
    // add-flow as clicking the Add button. We bind keydown (not keypress)
    // so the handler also fires inside IME composition modes — though we
    // skip composing events so Asian-language input doesn't eat half a
    // character.
    canvas.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target.matches('[data-blindspots-input]')) {
            if (event.isComposing) return;
            event.preventDefault();
            const value = target.value;
            target.value = '';
            addBlindspotEntry(value);
            return;
        }
        if (target.matches('[data-client-commitments-input]')) {
            if (event.isComposing) return;
            event.preventDefault();
            const value = target.value;
            target.value = '';
            addClientCommitmentEntry(value);
        }
    });

    canvas.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        // Task 3 — Blindspots Add / Remove buttons.
        const blindspotAdd = target.closest('[data-blindspots-add]');
        if (blindspotAdd instanceof HTMLElement) {
            event.preventDefault();
            const host = blindspotAdd.closest('[data-blindspots-host]');
            const input = host?.querySelector('[data-blindspots-input]');
            if (input instanceof HTMLInputElement) {
                const value = input.value;
                input.value = '';
                addBlindspotEntry(value);
            }
            return;
        }

        const blindspotRemove = target.closest('[data-blindspots-remove]');
        if (blindspotRemove instanceof HTMLElement) {
            event.preventDefault();
            removeBlindspotEntry(Number(blindspotRemove.dataset.blindspotsRemove));
            return;
        }

        const commitmentAdd = target.closest('[data-client-commitments-add]');
        if (commitmentAdd instanceof HTMLElement) {
            event.preventDefault();
            const host = commitmentAdd.closest('[data-client-commitments-host]');
            const input = host?.querySelector('[data-client-commitments-input]');
            if (input instanceof HTMLInputElement) {
                const value = input.value;
                input.value = '';
                addClientCommitmentEntry(value);
            }
            return;
        }

        const commitmentRemove = target.closest('[data-client-commitments-remove]');
        if (commitmentRemove instanceof HTMLElement) {
            event.preventDefault();
            removeClientCommitmentEntry(Number(commitmentRemove.dataset.clientCommitmentsRemove));
            return;
        }

        const entryPointPill = target.closest('.entry-point-pill');
        if (entryPointPill instanceof HTMLElement) {
            event.preventDefault();
            selectEntryPointPill(entryPointPill);
            return;
        }

        const snapshotPill = target.closest('.account-snapshot-pill');
        if (snapshotPill instanceof HTMLElement) {
            event.preventDefault();
            selectAccountSnapshotPill(snapshotPill);
            return;
        }

        const pill = target.closest('.strategic-pill');
        if (pill instanceof HTMLElement) {
            event.preventDefault();
            toggleStrategicPill(pill);
            return;
        }

        const hintPill = target.closest('.strategic-hint-pill');
        if (hintPill instanceof HTMLElement) {
            event.preventDefault();
            appendHintPillToField(hintPill);
            return;
        }

        const gravityPill = target.closest('.psychology-gravity-pill');
        if (gravityPill instanceof HTMLElement) {
            event.preventDefault();
            selectPsychologyGravityPill(gravityPill);
            return;
        }

        const influencePill = target.closest('.influence-field-pill');
        if (influencePill instanceof HTMLElement) {
            event.preventDefault();
            selectInfluenceContactFieldPill(influencePill);
            return;
        }

        const whiteSpacePill = target.closest('.white-space-pill');
        if (whiteSpacePill instanceof HTMLButtonElement) {
            event.preventDefault();
            toggleWhiteSpacePill(whiteSpacePill);
            return;
        }

        const whiteSpaceAdd = target.closest('[data-white-space-add]');
        if (whiteSpaceAdd) {
            event.preventDefault();
            addWhiteSpaceRow();
            return;
        }

        const whiteSpaceRemove = target.closest('[data-white-space-remove]');
        if (whiteSpaceRemove instanceof HTMLElement) {
            event.preventDefault();
            removeWhiteSpaceRow(Number(whiteSpaceRemove.dataset.whiteSpaceRemove));
            return;
        }

        const entryTab = target.closest('.entry-point-tab[data-entry-index]');
        if (entryTab instanceof HTMLElement) {
            event.preventDefault();
            switchEntryPointTab(Number(entryTab.dataset.entryIndex));
            return;
        }

        if (target.closest('[data-entry-point-add]')) {
            event.preventDefault();
            addEntryPoint();
            return;
        }

        if (target.closest('[data-momentum-milestone-log]')) {
            event.preventDefault();
            logStrategicMilestone();
            return;
        }

        const meddpiccBtn = target.closest('[data-influence-meddpicc]');
        if (meddpiccBtn instanceof HTMLButtonElement) {
            event.preventDefault();
            event.stopPropagation();
            toggleMeddpiccBadge(meddpiccBtn);
            return;
        }

        if (target.closest('[data-interaction-save]')) {
            event.preventDefault();
            saveInteractionForm();
            return;
        }

        const card = target.closest('.influence-contact-card.deal-card-flippable');
        if (card instanceof HTMLElement) {
            if (target.closest('.influence-meddpicc-badge, .influence-meddpicc-badges')) return;
            if (target.closest('.influence-card-notes, .influence-card-field-textarea, .influence-field-pill, .influence-card-fields, .influence-card-field')) return;
            if (target.closest('.influence-contact-notes-label')) return;
            card.classList.toggle('deal-card-flipped');
        }
    });

    canvas.addEventListener('dragstart', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('.influence-card-notes, .influence-card-field-textarea, .influence-field-pill, textarea, select, button')) {
            event.preventDefault();
            return;
        }
        const card = target.closest('.influence-contact-card[draggable="true"], .influence-contact-pill[draggable="true"]');
        if (!(card instanceof HTMLElement)) return;

        _draggedInfluenceContactId = card.dataset.contactId || null;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', _draggedInfluenceContactId || '');
        }
        card.classList.add('influence-contact-dragging');
    });

    canvas.addEventListener('dragend', (event) => {
        const target = event.target;
        if (target instanceof Element) {
            target.closest('.influence-contact-card, .influence-contact-pill')?.classList.remove('influence-contact-dragging');
        }
        canvas.querySelectorAll('.influence-contact-dragging').forEach((el) => {
            el.classList.remove('influence-contact-dragging');
        });
        _draggedInfluenceContactId = null;
    });

    canvas.addEventListener('dragover', (event) => {
        if (!event.target || !(event.target instanceof Element)) return;
        if (!event.target.closest('[data-influence-drop]')) return;
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    });

    canvas.addEventListener('drop', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const dropzone = target.closest('[data-influence-drop]');
        if (!(dropzone instanceof HTMLElement)) return;

        event.preventDefault();
        const contactId = _draggedInfluenceContactId || event.dataTransfer?.getData('text/plain');
        const bucket = dropzone.dataset.influenceDrop;
        if (!contactId || !bucket) return;

        moveInfluenceContact(contactId, bucket);

        // Task 2 — Influence Pipeline auto-stub.
        // When the rep promotes a contact to an Executive or Mid-Level bucket
        // we eagerly create the matching Entry Point shell so the strategic
        // narrative work can begin immediately (no name-retyping). We do this
        // BEFORE refreshing the influence board so the toast-on-cap path fires
        // before the user's gaze leaves the drop target.
        let stubbedNewEntryPoint = false;
        if (INFLUENCE_AUTO_STUB_BUCKETS.includes(bucket)) {
            const contact = getAccountContacts().find((c) => String(c.id) === String(contactId));
            const contactName = contact
                ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                : '';
            stubbedNewEntryPoint = ensureEntryPointForContact(contactId, contactName);
        }

        refreshInfluenceBoardSection();

        // ALWAYS refresh the carousel after a drop — even if we didn't create
        // a stub. A demotion (bench / technical) needs to flip the affected
        // tab to "Unmapped", and that decision lives in the render path.
        refreshEntryPointsSection();

        if (stubbedNewEntryPoint) {
            _options.onToast?.(
                'Entry-point shell created — open the carousel to draft the strategy.',
                'success'
            );
        }

        queueAutosave();
    });
}

/**
 * @param {HTMLElement} button
 */
function appendHintPillToField(button) {
    const fieldPath = button.dataset.hintPillTarget;
    const pillValue = button.dataset.hintPillValue;
    if (!fieldPath || !pillValue || !_liveSections) return;

    const fieldEl = document.querySelector(`#strategic-document-canvas [data-field="${fieldPath}"]`);
    if (!(fieldEl instanceof HTMLTextAreaElement)) return;

    const current = fieldEl.value.trim();
    const next = current ? `${current}, ${pillValue}` : pillValue;
    fieldEl.value = next;
    autoExpandTextarea(fieldEl);
    // Programmatic value mutation does NOT fire 'input' — re-run the Insight
    // Density check by hand so the counter and dense border stay accurate when
    // hint pills are appended to executive_narrative.
    updateInsightDensityState(fieldEl);
    setNestedValue(_liveSections, fieldPath, next);
    updateRailSummaries(_liveSections);
    queueAutosave();
}

/**
 * @param {HTMLInputElement} input
 */
function handleRangeInput(input) {
    const field = input.dataset.field || '';
    const value = clampScale(input.value, 3);
    input.value = String(value);
    input.setAttribute('aria-valuenow', String(value));

    if (field.startsWith('psychology.')) {
        const metricId = field.split('.')[1];
        const wrap = input.closest('.psychology-slider-wrap');
        const valueEl = input.closest('.psychology-slider-row')?.querySelector(`[data-psych-value="${metricId}"]`);
        const colorScale = wrap?.getAttribute('data-color-scale') || 'direct';
        if (wrap) {
            const style = psychologySliderStyle(metricId, value, colorScale);
            wrap.setAttribute('style', style);
        }
        if (valueEl) valueEl.textContent = String(value);
    }

    if (field === 'relationship_momentum.score' || input.classList.contains('momentum-slider')) {
        const wrap = input.closest('.momentum-slider-wrap');
        if (wrap) {
            wrap.setAttribute('style', momentumSliderStyle(value));
        }
        const labelEl = document.querySelector('[data-momentum-label]');
        if (labelEl) labelEl.textContent = MOMENTUM_LABELS[value - 1];
    }
}

/**
 * Pull the latest canvas field values into memory before export or save.
 */
function syncLiveSectionsFromCanvas() {
    if (!_liveSections) return;
    document.querySelectorAll('#strategic-document-canvas .strategic-field[data-field]').forEach((el) => {
        if (
            el instanceof HTMLInputElement
            || el instanceof HTMLTextAreaElement
            || el instanceof HTMLSelectElement
        ) {
            applyFieldToLiveSections(el);
        }
    });
}

/**
 * @param {HTMLElement} el
 */
function applyFieldToLiveSections(el) {
    if (el.classList.contains('influence-card-notes')) {
        updateInfluenceContactNotes(el.dataset.contactId || '', el.value);
        return;
    }

    if (el.classList.contains('influence-card-field-textarea')) {
        updateInfluenceContactField(
            el.dataset.influenceContactId || '',
            el.dataset.influenceField || '',
            el.value
        );
        return;
    }

    if (el.dataset.whiteSpaceField && el.dataset.whiteSpaceIndex != null) {
        syncWhiteSpaceFromCanvas();
        updateRailSummaries(_liveSections || {});
        return;
    }

    const path = el.dataset.field;
    if (!path || !_liveSections) return;

    let value;
    if (el instanceof HTMLInputElement && el.type === 'range') {
        value = clampScale(el.value, 3);
    } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
        value = el.value;
    } else {
        return;
    }

    setNestedValue(_liveSections, path, value);

    // Re-label the carousel tab whenever an entry point's contact_name
    // shifts (e.g. after an influence-board re-mapping). The fallback chain
    // (contact_name → "Entry Point N") is consistent with the initial
    // render in buildEntryPointCarouselHtml.
    const entryLabelMatch = path.match(/^entry_points\.(\d+)\.contact_name$/);
    if (entryLabelMatch) {
        updateEntryPointTabLabel(Number(entryLabelMatch[1]));
    }
}

function queueAutosave() {
    if (!_autosave || !_planRowId || !_planBaseline || !_liveSections) return;

    _autosave.scheduleAutosave({
        planRowId: _planRowId,
        plan: _planBaseline,
        draftSections: deepClonePlan({ current_draft: { sections: _liveSections } }).current_draft.sections,
    });
}

async function handleForceCommit() {
    if (!_autosave || !_planRowId || !_planBaseline || !_liveSections) {
        _options.onToast?.('No account plan loaded.', 'error');
        return;
    }

    const forceBtn = document.getElementById('plan-force-commit-btn');
    if (forceBtn instanceof HTMLButtonElement) forceBtn.disabled = true;

    try {
        const result = await _autosave.forceCommitAutosave({
            planRowId: _planRowId,
            plan: _planBaseline,
            draftSections: deepClonePlan({ current_draft: { sections: _liveSections } }).current_draft.sections,
            options: { forceCommit: true },
        });

        if (result?.plan) {
            _planBaseline = deepClonePlan(result.plan);
            _liveSections = deepClonePlan(_planBaseline).current_draft.sections;
            _options.onPlanUpdated?.(_planBaseline, { updated_at: result.updated_at });
            renderVersionTimeline(_planBaseline);
            updateVersionTriggerLabel(_planBaseline);
            refreshMomentumTimelineSection();
            _options.onToast?.('Milestone committed.', 'success');
        } else {
            _options.onToast?.('Failed to commit milestone.', 'error');
        }
    } finally {
        if (forceBtn instanceof HTMLButtonElement) forceBtn.disabled = false;
    }
}

function bindVersionPopoverControls() {
    if (_versionPopoverBound) return;
    _versionPopoverBound = true;

    const trigger = document.getElementById('plan-version-trigger');
    const popover = document.getElementById('plan-version-popover');
    const closeBtn = document.getElementById('plan-version-popover-close');

    trigger?.addEventListener('click', (event) => {
        event.stopPropagation();
        if (_popoverOpen) {
            closeVersionPopover();
        } else {
            openVersionPopover();
        }
    });

    closeBtn?.addEventListener('click', () => closeVersionPopover());

    document.addEventListener('click', (event) => {
        if (!_popoverOpen || !popover) return;
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (popover.contains(target) || trigger?.contains(target)) return;
        closeVersionPopover();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeVersionPopover();
    });
}

function openVersionPopover() {
    const popover = document.getElementById('plan-version-popover');
    const trigger = document.getElementById('plan-version-trigger');
    if (!popover || !trigger) return;

    renderVersionTimeline(_planBaseline);
    popover.classList.remove('hidden');
    _popoverOpen = true;
    trigger.setAttribute('aria-expanded', 'true');

    const triggerRect = trigger.getBoundingClientRect();
    popover.style.top = `${triggerRect.bottom + 8}px`;
    popover.style.right = `${Math.max(16, window.innerWidth - triggerRect.right)}px`;
}

function closeVersionPopover() {
    const popover = document.getElementById('plan-version-popover');
    popover?.classList.add('hidden');
    _popoverOpen = false;
    document.getElementById('plan-version-trigger')?.setAttribute('aria-expanded', 'false');
}

/**
 * @param {import('./account-plan-data.js').AccountPlanDocument | null} plan
 */
function renderVersionTimeline(plan) {
    const timeline = document.getElementById('plan-version-timeline');
    if (!timeline) return;

    const history = Array.isArray(plan?.history) ? [...plan.history].reverse() : [];

    if (history.length === 0) {
        timeline.innerHTML = '<p class="plan-version-empty">No milestones yet. Edits auto-save; milestones capture snapshots every 24 hours or on force commit.</p>';
        return;
    }

    timeline.innerHTML = history.map((entry) => {
        const reasonLabel = entry.reason === 'manual_force_commit' ? 'Manual commit' : 'Auto milestone';
        return `
            <div class="plan-version-item" data-version-id="${escapeHtml(entry.id)}">
                <div class="plan-version-dot" aria-hidden="true"></div>
                <div class="plan-version-content">
                    <div class="plan-version-meta">
                        <strong>${escapeHtml(entry.label || formatCommittedDate(entry.committed_at))}</strong>
                        <span class="plan-version-reason">${escapeHtml(reasonLabel)}</span>
                    </div>
                    <button type="button" class="plan-version-restore-btn" data-restore-id="${escapeHtml(entry.id)}">Restore</button>
                </div>
            </div>`;
    }).join('');

    timeline.querySelectorAll('.plan-version-restore-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const entryId = btn.getAttribute('data-restore-id');
            if (entryId) requestRestoreVersion(entryId);
        });
    });
}

function requestRestoreVersion(entryId) {
    if (!_planBaseline || !_planRowId || !_supabase) return;
    const entry = (_planBaseline.history || []).find((item) => item.id === entryId);
    if (!entry) return;

    _options.onConfirmRestore?.(
        'Replace the current draft with this snapshot? This saves immediately without creating a new milestone.',
        () => restoreVersionEntry(entry)
    );
}

async function restoreVersionEntry(entry) {
    if (!_planBaseline || !_planRowId || !_supabase) return;

    _autosave?.setAutosaveSuppressed(true);

    try {
        const next = deepClonePlan(_planBaseline);
        next.current_draft = deepClonePlan({
            current_draft: entry.snapshot,
            history: [],
        }).current_draft;
        next.current_draft.updated_at = new Date().toISOString();

        const result = await savePlanDraft(_supabase, _planRowId, next);
        if (!result.ok) {
            _options.onToast?.(result.error || 'Restore failed.', 'error');
            return;
        }

        _planBaseline = next;
        _liveSections = deepClonePlan(_planBaseline).current_draft.sections;
        _autosave?.setAutosaveBaseline(_planRowId, _planBaseline);
        _options.onPlanUpdated?.(_planBaseline, { updated_at: result.updated_at });

        renderStrategicShell(_options.getSelectedAccount?.() ?? null, _planBaseline);
        closeVersionPopover();
        _options.onToast?.('Snapshot restored.', 'success');
    } finally {
        _autosave?.setAutosaveSuppressed(false);
    }
}

/**
 * @param {import('./account-plan-data.js').AccountPlanDocument | null} plan
 */
function updateVersionTriggerLabel(plan) {
    const label = document.getElementById('plan-version-trigger-label');
    if (!label) return;

    const updatedAt = plan?.current_draft?.updated_at;
    label.textContent = updatedAt ? formatRelativeTime(updatedAt) : '';
}

/**
 * @param {ParentNode} root
 */
function initAutoExpandTextareas(root) {
    root.querySelectorAll('.strategic-textarea').forEach((el) => {
        if (el instanceof HTMLTextAreaElement) autoExpandTextarea(el);
    });
}

/**
 * @param {HTMLTextAreaElement} el
 */
function autoExpandTextarea(el) {
    el.style.height = 'auto';
    el.style.height = `${Math.max(72, el.scrollHeight)}px`;
}

/**
 * @param {ParentNode} root
 */
function initPsychologySliders(root) {
    root.querySelectorAll('.psychology-slider-wrap').forEach((wrap) => {
        const input = wrap.querySelector('.psychology-slider');
        if (!(input instanceof HTMLInputElement)) return;
        const field = input.dataset.field || '';
        const metricId = field.split('.')[1];
        const colorScale = wrap.getAttribute('data-color-scale') || 'direct';
        wrap.setAttribute('style', psychologySliderStyle(metricId, input.value, colorScale));
    });

    root.querySelectorAll('.momentum-slider-wrap').forEach((wrap) => {
        const input = wrap.querySelector('.momentum-slider');
        if (!(input instanceof HTMLInputElement)) return;
        wrap.setAttribute('style', momentumSliderStyle(input.value));
    });

    updatePsychologyBypassTrapVisibility();
}

/**
 * @param {string} metricId
 * @param {number | string} value
 * @param {string} [colorScale]
 */
function psychologySliderStyle(metricId, value, colorScale = 'direct') {
    const v = clampScale(value, 3);
    const hue = getPsychologyHue(metricId, v, colorScale);
    const fillPct = ((v - 1) / 4) * 100;
    return `--slider-value:${v};--slider-hue:${hue};--slider-fill:${fillPct}%`;
}

/**
 * @param {number | string} value
 */
function momentumSliderStyle(value) {
    const v = clampScale(value, 3);
    const t = (v - 1) / 4;
    const sat = Math.round(t * 70);
    const light = Math.round(95 - (t * 50));
    return `--momentum-sat:${sat};--momentum-light:${light}`;
}

/**
 * @param {string} metricId
 * @param {number} value
 * @param {string} colorScale
 */
function getPsychologyHue(metricId, value, colorScale) {
    const t = (value - 1) / 4;
    if (colorScale === 'inverse') {
        return Math.round(120 - (t * 120));
    }
    if (metricId === 'bureaucracy_level') {
        return Math.round(120 - (t * 120));
    }
    if (metricId === 'technical_sophistication') {
        return Math.round(20 + (t * 100));
    }
    return Math.round(35 + (t * 85));
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string} path
 * @param {unknown} value
 */
function setNestedValue(obj, path, value) {
    const parts = path.split('.');
    let cursor = obj;

    for (let i = 0; i < parts.length - 1; i += 1) {
        const key = parts[i];
        const nextPart = parts[i + 1];
        const nextIsIndex = /^\d+$/.test(nextPart);

        if (/^\d+$/.test(key)) {
            const index = Number(key);
            if (!Array.isArray(cursor)) return;
            if (cursor[index] == null || typeof cursor[index] !== 'object') {
                cursor[index] = {};
            }
            cursor = cursor[index];
            continue;
        }

        if (nextIsIndex) {
            if (!Array.isArray(cursor[key])) {
                cursor[key] = [];
            }
            cursor = cursor[key];
            continue;
        }

        if (!isPlainObject(cursor[key])) {
            cursor[key] = {};
        }
        cursor = cursor[key];
    }

    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last) && Array.isArray(cursor)) {
        cursor[Number(last)] = value;
    } else {
        cursor[last] = value;
    }
}

/**
 * @param {unknown} value
 */
function isPlainObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {number | string | null | undefined} value
 * @param {number} fallback
 */
function clampScale(value, fallback) {
    const n = parseInt(String(value), 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(5, Math.max(1, n));
}

/**
 * @param {string} text
 */
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {string} text
 * @param {number} max
 */
function truncateText(text, max) {
    const trimmed = String(text || '').trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1)}…`;
}

/**
 * @param {string} iso
 */
function formatCommittedDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Snapshot';
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/**
 * @param {string} iso
 */
function formatRelativeTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Edited just now';
    if (mins < 60) return `Edited ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Edited ${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `Edited ${days}d ago`;
}

export function getAccountViewMode() {
    return _activeMode;
}
