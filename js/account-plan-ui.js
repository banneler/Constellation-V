/**
 * Strategic Account OS — UI controller (canvas forms, rail, versioning, autosave).
 */

import { PLAN_SECTIONS, PSYCHOLOGY_SLIDERS } from './account-plan-sections.js';
import {
    createEmptyPlan,
    deepClonePlan,
    normalizePlan,
    savePlanDraft,
} from './account-plan-data.js';
import { createAccountPlanAutosave } from './account-plan-autosave.js';
import { exportAccountPlanPdf } from './account-plan-export.js';

const STORAGE_KEY = 'accounts_view_mode';
const MOMENTUM_LABELS = Object.freeze(['Stalled', 'Cooling', 'Neutral', 'Warming', 'Champion']);

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

let _canvasEventsBound = false;
let _versionPopoverBound = false;
let _popoverOpen = false;

/**
 * @param {{
 *   getSelectedAccountId?: () => number | null,
 *   getSelectedAccount?: () => object | null,
 *   getAccountPlan?: () => { rowId?: string, plan?: object, updated_at?: string } | null,
 *   isFormDirty?: () => boolean,
 *   clearFormDirty?: () => void,
 *   setAccountViewModeInState?: (mode: 'tactical' | 'strategic') => void,
 *   onConfirmDiscardUnsaved?: (onConfirm: () => void) => void,
 *   onConfirmRestore?: (message: string, onConfirm: () => void) => void,
 *   onPlanUpdated?: (plan: object, meta?: { updated_at?: string }) => void,
 *   onToast?: (message: string, type?: string) => void,
 *   supabase?: object,
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

    localStorage.setItem(STORAGE_KEY, _activeMode);
    _options.setAccountViewModeInState?.(_activeMode);

    if (_activeMode === 'strategic') {
        syncAccountPlanContext(_options.getAccountPlan?.() ?? null);
        renderStrategicShell(_options.getSelectedAccount?.() ?? null, _planBaseline);
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

    const canvas = document.getElementById('strategic-document-canvas');
    const titleEl = document.getElementById('strategic-account-title');

    if (titleEl) {
        titleEl.textContent = account?.name
            ? `${account.name} — Strategic Plan`
            : 'Strategic Account Plan';
    }

    if (canvas) {
        canvas.innerHTML = `<div class="strategic-document-inner">${buildCanvasHtml(_liveSections)}</div>`;
        initAutoExpandTextareas(canvas);
        initPsychologySliders(canvas);
        bindCanvasFormEvents(canvas);
    }

    renderRail(_liveSections);
    renderVersionTimeline(_planBaseline);
    updateVersionTriggerLabel(_planBaseline);
    updateToggleDisabled();
}

/**
 * @param {Record<string, unknown>} sections
 */
function buildCanvasHtml(sections) {
    return PLAN_SECTIONS.map((section) => {
        const headingId = `strategic-heading-${section.id}`;
        const sectionId = `strategic-section-${section.id}`;

        if (section.type === 'textarea') {
            const value = escapeHtml(String(sections[section.id] ?? ''));
            return `
                <section id="${sectionId}" class="strategic-section" aria-labelledby="${headingId}">
                    <h4 id="${headingId}" class="strategic-section-title">${escapeHtml(section.title)}</h4>
                    <textarea
                        class="strategic-field strategic-textarea"
                        data-field="${section.id}"
                        rows="3"
                        placeholder="${escapeHtml(section.placeholder || '')}"
                    >${value}</textarea>
                </section>`;
        }

        if (section.type === 'psychology_grid') {
            const psychology = isPlainObject(sections.psychology) ? sections.psychology : {};
            const sliders = (section.sliders || PSYCHOLOGY_SLIDERS).map((slider) => {
                const value = clampScale(psychology[slider.id], 3);
                return `
                    <div class="psychology-slider-row" data-metric-id="${slider.id}">
                        <div class="psychology-slider-header">
                            <label class="psychology-slider-label" for="psychology-${slider.id}">${escapeHtml(slider.label)}</label>
                            <span class="psychology-slider-value" data-psych-value="${slider.id}">${value}</span>
                        </div>
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

            return `
                <section id="${sectionId}" class="strategic-section" aria-labelledby="${headingId}">
                    <h4 id="${headingId}" class="strategic-section-title">${escapeHtml(section.title)}</h4>
                    <div class="psychology-grid">${sliders}</div>
                </section>`;
        }

        if (section.type === 'momentum') {
            const momentum = isPlainObject(sections.relationship_momentum) ? sections.relationship_momentum : {};
            const score = clampScale(momentum.score, 3);
            const narrative = escapeHtml(String(momentum.narrative ?? ''));
            return `
                <section id="${sectionId}" class="strategic-section" aria-labelledby="${headingId}">
                    <h4 id="${headingId}" class="strategic-section-title">${escapeHtml(section.title)}</h4>
                    <div class="momentum-field">
                        <div class="momentum-slider-row">
                            <label for="momentum-score">Momentum</label>
                            <span class="momentum-score-label" data-momentum-label>${MOMENTUM_LABELS[score - 1]}</span>
                        </div>
                        <input
                            type="range"
                            class="momentum-slider psychology-slider"
                            id="momentum-score"
                            min="1"
                            max="5"
                            step="1"
                            value="${score}"
                            data-field="relationship_momentum.score"
                        />
                        <textarea
                            class="strategic-field strategic-textarea"
                            data-field="relationship_momentum.narrative"
                            rows="3"
                            placeholder="${escapeHtml(section.placeholder || '')}"
                        >${narrative}</textarea>
                    </div>
                </section>`;
        }

        if (section.type === 'triple_textarea') {
            const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};
            return `
                <section id="${sectionId}" class="strategic-section" aria-labelledby="${headingId}">
                    <h4 id="${headingId}" class="strategic-section-title">${escapeHtml(section.title)}</h4>
                    <div class="triple-textarea-grid">
                        <div>
                            <label for="plan-days-30">30 Days</label>
                            <textarea id="plan-days-30" class="strategic-field strategic-textarea" data-field="plan_30_60_90.days_30" rows="3">${escapeHtml(String(plan306090.days_30 ?? ''))}</textarea>
                        </div>
                        <div>
                            <label for="plan-days-60">60 Days</label>
                            <textarea id="plan-days-60" class="strategic-field strategic-textarea" data-field="plan_30_60_90.days_60" rows="3">${escapeHtml(String(plan306090.days_60 ?? ''))}</textarea>
                        </div>
                        <div>
                            <label for="plan-days-90">90 Days</label>
                            <textarea id="plan-days-90" class="strategic-field strategic-textarea" data-field="plan_30_60_90.days_90" rows="3">${escapeHtml(String(plan306090.days_90 ?? ''))}</textarea>
                        </div>
                    </div>
                </section>`;
        }

        return '';
    }).join('');
}

/**
 * @param {Record<string, unknown>} sections
 */
function renderRail(sections) {
    const rail = document.getElementById('strategic-rail');
    if (!rail) return;

    const momentum = isPlainObject(sections.relationship_momentum) ? sections.relationship_momentum : {};
    const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};
    const score = clampScale(momentum.score, 3);
    const narrative = String(momentum.narrative ?? '').trim();
    const narrativePreview = narrative ? truncateText(narrative, 120) : 'No narrative yet.';

    rail.innerHTML = `
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
                <h2 class="section-title">30 / 60 / 90</h2>
            </div>
            <div class="strategic-rail-body px-5 pb-5">
                <ul class="rail-plan-list">
                    <li><strong>30d</strong> <span data-rail-plan-30>${escapeHtml(truncateText(String(plan306090.days_30 ?? ''), 80) || '—')}</span></li>
                    <li><strong>60d</strong> <span data-rail-plan-60>${escapeHtml(truncateText(String(plan306090.days_60 ?? ''), 80) || '—')}</span></li>
                    <li><strong>90d</strong> <span data-rail-plan-90>${escapeHtml(truncateText(String(plan306090.days_90 ?? ''), 80) || '—')}</span></li>
                </ul>
            </div>
        </div>
        <div class="section-card strategic-rail-card">
            <div class="section-card-header">
                <h2 class="section-title">Export</h2>
            </div>
            <div class="strategic-rail-body px-5 pb-5 flex flex-col gap-2">
                <button type="button" id="plan-export-dossier-btn" class="btn-secondary plan-export-btn w-full">
                    <i class="fas fa-file-pdf" aria-hidden="true"></i> Export Dossier (PDF)
                </button>
                <button type="button" id="plan-export-exec-btn" class="btn-secondary plan-export-btn w-full">
                    <i class="fas fa-display" aria-hidden="true"></i> Export Exec Readout (PDF)
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
async function handleExportPdf(type) {
    if (!_planRowId || !_planBaseline) {
        _options.onToast?.('No account plan loaded.', 'error');
        return;
    }

    const account = _options.getSelectedAccount?.() ?? null;
    const planForExport = deepClonePlan(_planBaseline);
    if (_liveSections) {
        planForExport.current_draft.sections = deepClonePlan({
            current_draft: { sections: _liveSections },
        }).current_draft.sections;
    }

    const label = type === 'dossier' ? 'Dossier' : 'Exec Readout';
    _options.onToast?.(`Generating ${label} PDF…`, 'success');

    const dossierBtn = document.getElementById('plan-export-dossier-btn');
    const execBtn = document.getElementById('plan-export-exec-btn');
    [dossierBtn, execBtn].forEach((btn) => {
        if (btn instanceof HTMLButtonElement) btn.disabled = true;
    });

    try {
        await exportAccountPlanPdf(planForExport, account, type);
        _options.onToast?.(`${label} PDF downloaded.`, 'success');
    } catch (err) {
        console.error('[account-plan-ui] PDF export failed:', err);
        _options.onToast?.(err?.message || 'PDF export failed.', 'error');
    } finally {
        if (dossierBtn instanceof HTMLButtonElement) dossierBtn.disabled = !_planRowId;
        if (execBtn instanceof HTMLButtonElement) execBtn.disabled = !_planRowId;
    }
}

function updateRailSummaries(sections) {
    const momentum = isPlainObject(sections.relationship_momentum) ? sections.relationship_momentum : {};
    const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};
    const score = clampScale(momentum.score, 3);
    const narrative = String(momentum.narrative ?? '').trim();

    const scoreEl = document.querySelector('[data-rail-momentum-score]');
    const labelEl = document.querySelector('[data-rail-momentum-label]');
    const narrativeEl = document.querySelector('[data-rail-momentum-narrative]');
    if (scoreEl) scoreEl.textContent = String(score);
    if (labelEl) labelEl.textContent = MOMENTUM_LABELS[score - 1];
    if (narrativeEl) {
        narrativeEl.textContent = narrative ? truncateText(narrative, 120) : 'No narrative yet.';
    }

    const plan30 = document.querySelector('[data-rail-plan-30]');
    const plan60 = document.querySelector('[data-rail-plan-60]');
    const plan90 = document.querySelector('[data-rail-plan-90]');
    if (plan30) plan30.textContent = truncateText(String(plan306090.days_30 ?? ''), 80) || '—';
    if (plan60) plan60.textContent = truncateText(String(plan306090.days_60 ?? ''), 80) || '—';
    if (plan90) plan90.textContent = truncateText(String(plan306090.days_90 ?? ''), 80) || '—';

    const momentumLabel = document.querySelector('[data-momentum-label]');
    if (momentumLabel) momentumLabel.textContent = MOMENTUM_LABELS[score - 1];
}

function bindCanvasFormEvents(canvas) {
    if (_canvasEventsBound) return;
    _canvasEventsBound = true;

    canvas.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches('.strategic-field, .psychology-slider, .momentum-slider')) return;

        if (target instanceof HTMLTextAreaElement) {
            autoExpandTextarea(target);
        }

        if (target instanceof HTMLInputElement && target.type === 'range') {
            handleRangeInput(target);
        }

        applyFieldToLiveSections(target);
        updateRailSummaries(_liveSections || {});
        queueAutosave();
    });

    canvas.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches('.strategic-field, .psychology-slider, .momentum-slider')) return;
        applyFieldToLiveSections(target);
        updateRailSummaries(_liveSections || {});
        queueAutosave();
    });
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
}

/**
 * @param {HTMLElement} el
 */
function applyFieldToLiveSections(el) {
    const path = el.dataset.field;
    if (!path || !_liveSections) return;

    let value;
    if (el instanceof HTMLInputElement && el.type === 'range') {
        value = clampScale(el.value, 3);
    } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        value = el.value;
    } else {
        return;
    }

    setNestedValue(_liveSections, path, value);
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
        if (!isPlainObject(cursor[key])) {
            cursor[key] = {};
        }
        cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = value;
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
