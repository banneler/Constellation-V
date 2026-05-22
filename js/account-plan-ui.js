/**
 * Strategic Account OS — UI controller (canvas forms, rail, versioning, autosave).
 */

import { PLAN_SECTIONS, PSYCHOLOGY_SLIDERS, PLAN_306090_HORIZONS } from './account-plan-sections.js';
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
 * @param {string} headingId
 * @param {string} title
 * @param {{ leadHtml?: string, blockHtml?: string }} headerContext
 * @param {string} bodyHtml
 * @param {string} [extraClass]
 */
function wrapStrategicSection(sectionId, headingId, title, headerContext, bodyHtml, extraClass = '') {
    const leadHtml = headerContext.leadHtml || '';
    const blockHtml = headerContext.blockHtml || '';
    const classNames = ['strategic-section', extraClass].filter(Boolean).join(' ');
    return `
        <section id="${sectionId}" class="${classNames}" aria-labelledby="${headingId}">
            <h4 id="${headingId}" class="strategic-section-title">${escapeHtml(title)}</h4>
            ${leadHtml}
            ${blockHtml}
            ${bodyHtml}
        </section>`;
}

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
                return { id: String(entry), notes: '' };
            }
            if (isPlainObject(entry) && entry.id != null) {
                return {
                    id: String(entry.id),
                    notes: entry.notes != null ? String(entry.notes) : '',
                };
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
        const value = escapeHtml(String(obj[field.key] ?? ''));
        const hintHtml = buildFieldHintHtml(field.hint);
        const labelHtml = field.label
            ? `<label for="strategic-field-${section.id}-${field.key}">${escapeHtml(field.label)}</label>`
            : '';
        const withHint = Boolean(field.hint);

        return `
            <div class="strategic-composite-field${withHint ? ' strategic-composite-field--with-hint' : ''}">
                ${labelHtml}
                <div class="strategic-composite-field-body">
                    ${hintHtml}
                    <textarea
                        id="strategic-field-${section.id}-${field.key}"
                        class="strategic-field strategic-textarea"
                        data-field="${section.id}.${field.key}"
                        rows="3"
                    >${value}</textarea>
                </div>
            </div>`;
    }).join('')}</div>`;
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

    const renderField = (field) => {
        const value = escapeHtml(String(obj[field.key] ?? ''));
        const hintHtml = buildFieldHintHtml(field.hint);
        const labelHtml = field.label
            ? `<label for="strategic-field-${section.id}-${field.key}">${escapeHtml(field.label)}</label>`
            : '';
        const withHint = Boolean(field.hint);

        return `
            <div class="strategic-composite-field${withHint ? ' strategic-composite-field--with-hint' : ''}">
                ${labelHtml}
                <div class="strategic-composite-field-body">
                    ${hintHtml}
                    <textarea
                        id="strategic-field-${section.id}-${field.key}"
                        class="strategic-field strategic-textarea"
                        data-field="${section.id}.${field.key}"
                        rows="3"
                    >${value}</textarea>
                </div>
            </div>`;
    };

    const textFields = section.textFields || [];
    if (pillField === 'positioning_pills') {
        const [firstField, secondField] = textFields;
        return `${firstField ? renderField(firstField) : ''}${pillsBlock}${secondField ? renderField(secondField) : ''}`;
    }

    return `${pillsBlock}${textFields.map(renderField).join('')}`;
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

    return `<div class="plan-306090-grid">${horizons.map((horizon) => {
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
}

/**
 * @param {object | null | undefined} contact
 * @param {{ id: string, notes: string }} entry
 * @param {string} bucket
 */
function buildInfluenceContactCard(contact, entry, bucket) {
    const name = contact
        ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
        : 'Unknown contact';
    const title = contact?.title || contact?.job_title || '';
    const notes = escapeHtml(entry.notes || '');
    const contactId = escapeHtml(String(entry.id));

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
                    <div class="influence-contact-hint">Click for influence notes</div>
                </div>
                <div class="deal-card-back influence-contact-card-back">
                    <label class="influence-contact-notes-label" for="influence-notes-${contactId}">Influence notes</label>
                    <textarea
                        id="influence-notes-${contactId}"
                        class="strategic-field strategic-textarea influence-card-notes"
                        data-contact-id="${contactId}"
                        rows="5"
                    >${notes}</textarea>
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
        : { executive: [], mid_level: [], invisible_org_chart: '' };
    const contacts = getAccountContacts();
    const contactById = new Map(contacts.map((contact) => [String(contact.id), contact]));

    const executiveEntries = normalizeInfluenceEntries(mapping.executive);
    const midLevelEntries = normalizeInfluenceEntries(mapping.mid_level);
    const assignedIds = new Set([
        ...executiveEntries.map((entry) => String(entry.id)),
        ...midLevelEntries.map((entry) => String(entry.id)),
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

    return `
        <div class="influence-board">
            ${renderBucket('bench', 'Unassigned Contacts', benchEntries)}
            ${renderBucket('executive', 'Executive', executiveEntries)}
            ${renderBucket('mid_level', 'Mid-Level', midLevelEntries)}
        </div>
        <div class="strategic-composite-field influence-invisible-field strategic-composite-field--with-hint">
            <div class="strategic-composite-field-body">
                ${buildFieldHintHtml(columnHints.invisible_org_chart)}
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
        : { executive: [], mid_level: [], invisible_org_chart: '' };

    const id = String(contactId);
    let entry = null;

    ['executive', 'mid_level'].forEach((bucket) => {
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
    }

    if (targetBucket === 'executive' || targetBucket === 'mid_level') {
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
 * @param {string} notes
 */
function updateInfluenceContactNotes(contactId, notes) {
    if (!_liveSections || !contactId) return;

    const mapping = isPlainObject(_liveSections.influence_mapping)
        ? { ..._liveSections.influence_mapping }
        : { executive: [], mid_level: [], invisible_org_chart: '' };

    const id = String(contactId);
    ['executive', 'mid_level'].forEach((bucket) => {
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
 * @param {HTMLElement} button
 */
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
    queueAutosave();
}

/**
 * @param {Record<string, unknown>} sections
 */
function buildCanvasHtml(sections) {
    return PLAN_SECTIONS.map((section) => {
        const headingId = `strategic-heading-${section.id}`;
        const sectionId = `strategic-section-${section.id}`;
        const headerContext = buildSectionHeaderContext(section);

        if (section.type === 'composite_textarea') {
            const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
            return wrapStrategicSection(
                sectionId,
                headingId,
                section.title,
                headerContext,
                buildCompositeTextareaHtml(section, data)
            );
        }

        if (section.type === 'pills_and_narrative') {
            const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
            return wrapStrategicSection(
                sectionId,
                headingId,
                section.title,
                headerContext,
                buildPillsAndNarrativeHtml(section, data)
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
                <div class="psychology-grid">${sliders}</div>`);
        }

        if (section.type === 'momentum') {
            const momentum = isPlainObject(sections.relationship_momentum) ? sections.relationship_momentum : {};
            const score = clampScale(momentum.score, 3);
            const narrative = escapeHtml(String(momentum.narrative ?? ''));
            return wrapStrategicSection(sectionId, headingId, section.title, headerContext, `
                <div class="momentum-field">
                    <div class="momentum-slider-row">
                        <label for="momentum-score">Momentum</label>
                        <span class="momentum-score-label" data-momentum-label>${MOMENTUM_LABELS[score - 1]}</span>
                    </div>
                    <div class="momentum-slider-wrap" style="${momentumSliderStyle(score)}">
                        <input
                            type="range"
                            class="momentum-slider"
                            id="momentum-score"
                            min="1"
                            max="5"
                            step="1"
                            value="${score}"
                            data-field="relationship_momentum.score"
                            aria-valuemin="1"
                            aria-valuemax="5"
                            aria-valuenow="${score}"
                        />
                    </div>
                    <div class="momentum-slider-scale">
                        <span>${escapeHtml(MOMENTUM_LABELS[0])}</span>
                        <span>${escapeHtml(MOMENTUM_LABELS[4])}</span>
                    </div>
                    <textarea
                        class="strategic-field strategic-textarea"
                        data-field="relationship_momentum.narrative"
                        rows="3"
                    >${narrative}</textarea>
                </div>`);
        }

        if (section.type === 'triple_textarea') {
            const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};
            return wrapStrategicSection(
                sectionId,
                headingId,
                section.title,
                headerContext,
                buildPlan306090Html(section, plan306090),
                'strategic-section--plan306090'
            );
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

let _draggedInfluenceContactId = null;

function bindCanvasFormEvents(canvas) {
    if (_canvasEventsBound) return;
    _canvasEventsBound = true;

    canvas.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches('.strategic-field, .psychology-slider, .momentum-slider, .influence-card-notes')) return;

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
        if (!target.matches('.strategic-field, .psychology-slider, .momentum-slider, .influence-card-notes')) return;
        applyFieldToLiveSections(target);
        updateRailSummaries(_liveSections || {});
        queueAutosave();
    });

    canvas.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const pill = target.closest('.strategic-pill');
        if (pill instanceof HTMLElement) {
            event.preventDefault();
            toggleStrategicPill(pill);
            return;
        }

        const card = target.closest('.influence-contact-card.deal-card-flippable');
        if (card instanceof HTMLElement && !target.closest('.influence-card-notes, textarea, label')) {
            card.classList.toggle('deal-card-flipped');
        }
    });

    canvas.addEventListener('dragstart', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('.influence-card-notes, textarea')) {
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
        refreshInfluenceBoardSection();
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
 * @param {HTMLElement} el
 */
function applyFieldToLiveSections(el) {
    if (el.classList.contains('influence-card-notes')) {
        updateInfluenceContactNotes(el.dataset.contactId || '', el.value);
        return;
    }

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

    root.querySelectorAll('.momentum-slider-wrap').forEach((wrap) => {
        const input = wrap.querySelector('.momentum-slider');
        if (!(input instanceof HTMLInputElement)) return;
        wrap.setAttribute('style', momentumSliderStyle(input.value));
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
