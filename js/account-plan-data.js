/**
 * Strategic Account OS — data layer (JSONB plan document, milestones, Supabase I/O).
 */

import {
    STRATEGIC_TENSION_GROUPS,
    PAIN_SIGNAL_PILLS,
    CRITICAL_UNKNOWN_LANGUAGE_PILLS,
    ENTRENCHMENT_MOAT_PILLS,
} from './account-plan-sections.js';

export const PLAN_SCHEMA_VERSION = 2;
export const HISTORY_CAP = 50;
export const MILESTONE_INTERVAL_MS = 24 * 60 * 60 * 1000;

const DEFAULT_PSYCHOLOGY = Object.freeze({
    bureaucracy_level: 3,
    risk_appetite: 3,
    technical_sophistication: 3,
    vendor_loyalty: 3,
    decision_velocity: 3,
    organizational_gravity: '',
    consensus_requirement: '',
    procurement_friction: '',
    innovation_friction: '',
    narrative: '',
});

/** @type {readonly string[]} */
export const INFLUENCE_CONTACT_FIELD_KEYS = Object.freeze([
    'influence_level',
    'political_influence',
    'relationship_temperature',
    'strategic_priorities',
    'personality_style',
]);

const POLITICAL_SIGNAL_VALUES = new Set(['', 'High', 'Medium', 'Low', 'Positive', 'Neutral', 'Negative']);
const MOMENTUM_SHIFT_VALUES = new Set(['', 'Positive', 'Neutral', 'Negative']);
const INTERACTION_LOG_SOURCES = new Set(['signal', 'manual', 'activity']);

/** @type {readonly string[]} */
export const ENTRY_POINT_FIELD_KEYS = Object.freeze([
    // contact_id is the *durable* link back to the influence board (Task 2 —
    // "Influence Pipeline"). contact_name is kept for display + back-compat with
    // legacy plans that pre-date the auto-stubbing flow; both are written when an
    // entry point is auto-created from a drag/drop on the influence board.
    'contact_id',
    'contact_name',
    'why_they_matter',
    'likely_pressure',
    'trust_level',
    'responsiveness',
    'political_influence',
    'best_themes',
    'narrative_openings',
    'human_context',
    'mutual_connections',
    'tired_of_hearing',
    'next_move',
    'comm_style',
    'compound_potential',
    'what_failure_looks_like',
]);

export const MAX_ENTRY_POINTS = 5;

/**
 * @returns {Record<string, string>}
 */
export function createEmptyEntryPoint() {
    return Object.fromEntries(ENTRY_POINT_FIELD_KEYS.map((key) => [key, '']));
}

/**
 * @returns {Record<string, string>}
 */
export function createEmptyAccessPath() {
    return {
        current: '',
        desired: '',
        bridge: '',
        strategy: '',
    };
}

/**
 * @returns {Record<string, string>}
 */
export function createEmptyInfluenceContact(id = '') {
    return {
        id: String(id),
        notes: '',
        influence_level: '',
        political_influence: '',
        relationship_temperature: '',
        strategic_priorities: '',
        personality_style: '',
    };
}

/**
 * @returns {Record<string, string>}
 */
export function createEmptyWhiteSpaceRow() {
    return {
        area: '',
        opportunity: '',
        operational_importance: '',
        executive_visibility: '',
        confidence: '',
        value_notes: '',
    };
}

/**
 * @returns {Record<string, string>}
 */
export function createEmptyInteractionLogEntry() {
    return {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        source: 'signal',
        contact_id: null,
        interaction: '',
        key_insight: '',
        text: '',
        political_signal: '',
        relationship_energy: '',
        trust_earned: '',
        momentum_shift: '',
        next_move: '',
        activity_id: null,
    };
}

/**
 * @returns {import('./account-plan-data.js').AccountPlanDocument}
 */
export function createEmptyPlan() {
    const now = new Date().toISOString();
    return {
        schema_version: PLAN_SCHEMA_VERSION,
        current_draft: {
            updated_at: now,
            last_milestone_at: null,
            sections: {
                account_snapshot: {
                    tier: '',
                    relationship_status: '',
                    ai_cloud_maturity: '',
                    strategic_patience: '',
                    pursuit_priority: '',
                    existing_providers: '',
                    expansion_potential: '',
                },
                pursuit_thesis: {
                    core: '',
                    why_account_matters: '',
                    cost_of_standing_still: '',
                    timing: '',
                    executive_narrative: '',
                },
                strategic_tensions: {
                    selected_pills: [],
                    narrative: '',
                },
                pain_signals: {
                    selected: [],
                    notes: '',
                },
                critical_unknowns: {
                    unknowns: '',
                    executive_language_pills: [],
                    executive_language_notes: '',
                },
                influence_mapping: {
                    executive: [],
                    mid_level: [],
                    technical: [],
                    invisible_org_chart: '',
                    political_dynamics: '',
                    access_path: createEmptyAccessPath(),
                },
                white_space: [],
                competitive_landscape: {
                    incumbents: '',
                    positioning_pills: [],
                    narrative: '',
                },
                entrenchment: {
                    compound_relationships: '',
                    moat_pills: [],
                    difficult_to_remove: '',
                },
                land_and_expand: {
                    initial_entry: '',
                    trust_creation: '',
                    expansion_path: '',
                },
                entry_points: [createEmptyEntryPoint()],
                relationship_momentum: {
                    score: 3,
                    narrative: '',
                },
                momentum_notes: [],
                interaction_log: [],
                plan_30_60_90: {
                    days_30: '',
                    days_60: '',
                    days_90: '',
                },
                psychology: { ...DEFAULT_PSYCHOLOGY },
            },
        },
        history: [],
    };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {Record<string, unknown>} sections
 */
function migrateLegacySectionText(sections, newKey, legacyKeys) {
    const raw = sections[newKey];
    if (typeof raw === 'string' && raw.trim()) {
        return raw.trim();
    }
    for (const key of legacyKeys) {
        if (sections[key] != null && String(sections[key]).trim()) {
            return String(sections[key]).trim();
        }
    }
    return '';
}

/**
 * @param {unknown} entry
 * @returns {ReturnType<typeof createEmptyInfluenceContact> | null}
 */
function normalizeInfluenceContactEntry(entry) {
    if (entry == null) return null;
    const empty = createEmptyInfluenceContact();
    if (typeof entry === 'string' || typeof entry === 'number') {
        return { ...empty, id: String(entry) };
    }
    if (isPlainObject(entry) && entry.id != null) {
        const normalized = {
            ...empty,
            id: String(entry.id),
            notes: entry.notes != null ? String(entry.notes) : '',
        };
        INFLUENCE_CONTACT_FIELD_KEYS.forEach((key) => {
            normalized[key] = entry[key] != null ? String(entry[key]) : '';
        });
        return normalized;
    }
    return null;
}

/**
 * @param {unknown[]} value
 * @returns {ReturnType<typeof createEmptyInfluenceContact>[]}
 */
function normalizeInfluenceContactList(value) {
    if (!Array.isArray(value)) return [];
    return value.map(normalizeInfluenceContactEntry).filter(Boolean);
}

/**
 * @param {unknown} raw
 * @param {Record<string, unknown>} sections
 */
function normalizePursuitThesis(raw, sections) {
    const empty = createEmptyPlan().current_draft.sections.pursuit_thesis;
    if (typeof raw === 'string') {
        const legacy = raw.trim() || migrateLegacySectionText(sections, 'pursuit_thesis', ['executive_summary']);
        return legacy ? { ...empty, core: legacy } : empty;
    }
    if (!isPlainObject(raw)) {
        const legacy = migrateLegacySectionText(sections, 'pursuit_thesis', ['executive_summary']);
        return legacy ? { ...empty, core: legacy } : empty;
    }
    return {
        core: raw.core != null ? String(raw.core) : '',
        why_account_matters: raw.why_account_matters != null ? String(raw.why_account_matters) : '',
        cost_of_standing_still: raw.cost_of_standing_still != null ? String(raw.cost_of_standing_still) : '',
        timing: raw.timing != null ? String(raw.timing) : '',
        executive_narrative: raw.executive_narrative != null ? String(raw.executive_narrative) : '',
    };
}

/**
 * @param {string[]} selected
 * @param {readonly { id: string, options: readonly string[] }[]} groups
 */
function enforceEitherOrPills(selected, groups) {
    const result = [];
    groups.forEach((group) => {
        const match = selected.find((value) => group.options.includes(value));
        if (match) result.push(match);
    });
    return result;
}

/**
 * @param {unknown} raw
 * @param {Record<string, unknown>} sections
 */
function normalizeStrategicTensions(raw, sections) {
    const empty = { selected_pills: [], narrative: '' };
    const validOptions = new Set(STRATEGIC_TENSION_GROUPS.flatMap((group) => group.options));

    let narrative = '';
    let selected = [];

    if (typeof raw === 'string') {
        narrative = raw.trim() || migrateLegacySectionText(sections, 'strategic_tensions', ['situation_assessment', 'risks_and_mitigations']);
    } else if (isPlainObject(raw)) {
        narrative = raw.narrative != null ? String(raw.narrative) : '';
        selected = Array.isArray(raw.selected_pills) ? raw.selected_pills.map(String) : [];
    } else {
        narrative = migrateLegacySectionText(sections, 'strategic_tensions', ['situation_assessment', 'risks_and_mitigations']);
    }

    selected = selected.filter((value) => validOptions.has(value));
    selected = enforceEitherOrPills(selected, STRATEGIC_TENSION_GROUPS);

    return {
        ...empty,
        selected_pills: selected,
        narrative,
    };
}

/**
 * @param {unknown} raw
 * @param {Record<string, unknown>} sections
 * @param {string} sectionKey
 * @param {string[]} legacyKeys
 */
function normalizePillsAndNarrative(raw, sections, sectionKey, legacyKeys) {
    const empty = { selected_pills: [], narrative: '' };
    if (typeof raw === 'string') {
        const legacy = raw.trim() || migrateLegacySectionText(sections, sectionKey, legacyKeys);
        return legacy ? { ...empty, narrative: legacy } : empty;
    }
    if (!isPlainObject(raw)) {
        const legacy = migrateLegacySectionText(sections, sectionKey, legacyKeys);
        return legacy ? { ...empty, narrative: legacy } : empty;
    }
    const pillField = Array.isArray(raw.positioning_pills) ? 'positioning_pills' : 'selected_pills';
    const pills = Array.isArray(raw[pillField])
        ? raw[pillField].map((pill) => String(pill)).filter(Boolean)
        : [];
    return {
        selected_pills: pillField === 'selected_pills' ? pills : (Array.isArray(raw.selected_pills) ? raw.selected_pills.map(String) : []),
        positioning_pills: pillField === 'positioning_pills' ? pills : (Array.isArray(raw.positioning_pills) ? raw.positioning_pills.map(String) : []),
        narrative: raw.narrative != null ? String(raw.narrative) : '',
    };
}

/**
 * @param {unknown} raw
 * @param {Record<string, unknown>} sections
 */
function normalizeCompetitiveLandscape(raw, sections) {
    const empty = { incumbents: '', positioning_pills: [], narrative: '' };
    if (typeof raw === 'string') {
        const legacy = raw.trim() || migrateLegacySectionText(sections, 'competitive_landscape', ['competitive_landscape']);
        return legacy ? { ...empty, incumbents: legacy } : empty;
    }
    if (!isPlainObject(raw)) {
        const legacy = migrateLegacySectionText(sections, 'competitive_landscape', ['competitive_landscape']);
        return legacy ? { ...empty, incumbents: legacy } : empty;
    }
    return {
        incumbents: raw.incumbents != null ? String(raw.incumbents) : '',
        positioning_pills: Array.isArray(raw.positioning_pills)
            ? raw.positioning_pills.map((pill) => String(pill)).filter(Boolean)
            : [],
        narrative: raw.narrative != null ? String(raw.narrative) : '',
    };
}

/**
 * @param {unknown} raw
 * @param {Record<string, unknown>} sections
 */
function normalizeInfluenceMapping(raw, sections) {
    const empty = createEmptyPlan().current_draft.sections.influence_mapping;
    if (typeof raw === 'string') {
        const legacy = raw.trim() || migrateLegacySectionText(sections, 'influence_mapping', ['stakeholder_map']);
        return legacy ? { ...empty, invisible_org_chart: legacy } : empty;
    }
    if (!isPlainObject(raw)) {
        const legacy = migrateLegacySectionText(sections, 'influence_mapping', ['stakeholder_map']);
        return legacy ? { ...empty, invisible_org_chart: legacy } : empty;
    }
    const accessPathRaw = isPlainObject(raw.access_path) ? raw.access_path : {};
    return {
        executive: normalizeInfluenceContactList(raw.executive),
        mid_level: normalizeInfluenceContactList(raw.mid_level),
        technical: normalizeInfluenceContactList(raw.technical),
        invisible_org_chart: raw.invisible_org_chart != null ? String(raw.invisible_org_chart) : '',
        political_dynamics: raw.political_dynamics != null ? String(raw.political_dynamics) : '',
        access_path: {
            current: accessPathRaw.current != null ? String(accessPathRaw.current) : '',
            desired: accessPathRaw.desired != null ? String(accessPathRaw.desired) : '',
            bridge: accessPathRaw.bridge != null ? String(accessPathRaw.bridge) : '',
            strategy: accessPathRaw.strategy != null ? String(accessPathRaw.strategy) : '',
        },
    };
}

/**
 * @param {unknown} raw
 * @param {Record<string, unknown>} sections
 */
function normalizeLandAndExpand(raw, sections) {
    const empty = { initial_entry: '', trust_creation: '', expansion_path: '' };
    if (typeof raw === 'string') {
        const legacy = raw.trim() || migrateLegacySectionText(sections, 'land_and_expand', ['growth_opportunities']);
        return legacy ? { ...empty, initial_entry: legacy } : empty;
    }
    if (!isPlainObject(raw)) {
        const legacy = migrateLegacySectionText(sections, 'land_and_expand', ['growth_opportunities']);
        return legacy ? { ...empty, initial_entry: legacy } : empty;
    }
    return {
        initial_entry: raw.initial_entry != null ? String(raw.initial_entry) : '',
        trust_creation: raw.trust_creation != null ? String(raw.trust_creation) : '',
        expansion_path: raw.expansion_path != null ? String(raw.expansion_path) : '',
    };
}

/**
 * @param {unknown} raw
 * @returns {Record<string, string>}
 */
function normalizeEntryPoint(raw) {
    const empty = createEmptyEntryPoint();
    if (!isPlainObject(raw)) return empty;
    ENTRY_POINT_FIELD_KEYS.forEach((key) => {
        empty[key] = raw[key] != null ? String(raw[key]) : '';
    });
    return empty;
}

/**
 * @param {unknown} raw
 * @returns {Record<string, string>[]}
 */
function normalizeEntryPoints(raw) {
    if (!Array.isArray(raw) || raw.length === 0) {
        return [createEmptyEntryPoint()];
    }
    return raw.slice(0, MAX_ENTRY_POINTS).map(normalizeEntryPoint);
}

/**
 * @param {unknown} raw
 * @returns {{ id: string, date: string, text: string }[]}
 */
function normalizeMomentumNotes(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter(isPlainObject)
        .map((note) => ({
            id: note.id != null ? String(note.id) : crypto.randomUUID(),
            date: note.date != null ? String(note.date) : new Date().toISOString(),
            text: note.text != null ? String(note.text) : '',
        }))
        .filter((note) => note.text.trim());
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof createEmptyPlan>['current_draft']['sections']['account_snapshot']}
 */
function normalizeAccountSnapshot(raw) {
    const empty = createEmptyPlan().current_draft.sections.account_snapshot;
    if (!isPlainObject(raw)) return empty;
    return {
        tier: raw.tier != null ? String(raw.tier) : '',
        relationship_status: raw.relationship_status != null ? String(raw.relationship_status) : '',
        ai_cloud_maturity: raw.ai_cloud_maturity != null ? String(raw.ai_cloud_maturity) : '',
        strategic_patience: raw.strategic_patience != null ? String(raw.strategic_patience) : '',
        pursuit_priority: raw.pursuit_priority != null ? String(raw.pursuit_priority) : '',
        existing_providers: raw.existing_providers != null ? String(raw.existing_providers) : '',
        expansion_potential: raw.expansion_potential != null ? String(raw.expansion_potential) : '',
    };
}

/**
 * @param {unknown} raw
 * @param {readonly string[]} validPills
 */
function normalizePillSelection(raw, validPills) {
    const valid = new Set(validPills);
    if (!Array.isArray(raw)) return [];
    return raw.map(String).filter((pill) => valid.has(pill));
}

/**
 * @param {unknown} raw
 */
function normalizePainSignals(raw) {
    const empty = createEmptyPlan().current_draft.sections.pain_signals;
    if (!isPlainObject(raw)) return empty;
    return {
        selected: normalizePillSelection(raw.selected, PAIN_SIGNAL_PILLS),
        notes: raw.notes != null ? String(raw.notes) : '',
    };
}

/**
 * @param {unknown} raw
 */
function normalizeCriticalUnknowns(raw) {
    const empty = createEmptyPlan().current_draft.sections.critical_unknowns;
    if (!isPlainObject(raw)) return empty;
    return {
        unknowns: raw.unknowns != null ? String(raw.unknowns) : '',
        executive_language_pills: normalizePillSelection(raw.executive_language_pills, CRITICAL_UNKNOWN_LANGUAGE_PILLS),
        executive_language_notes: raw.executive_language_notes != null ? String(raw.executive_language_notes) : '',
    };
}

/**
 * @param {unknown} raw
 */
function normalizeEntrenchment(raw) {
    const empty = createEmptyPlan().current_draft.sections.entrenchment;
    if (!isPlainObject(raw)) return empty;
    return {
        compound_relationships: raw.compound_relationships != null ? String(raw.compound_relationships) : '',
        moat_pills: normalizePillSelection(raw.moat_pills, ENTRENCHMENT_MOAT_PILLS),
        difficult_to_remove: raw.difficult_to_remove != null ? String(raw.difficult_to_remove) : '',
    };
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof createEmptyWhiteSpaceRow>[]}
 */
function normalizeWhiteSpace(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter(isPlainObject)
        .map((row) => ({
            area: row.area != null ? String(row.area) : '',
            opportunity: row.opportunity != null ? String(row.opportunity) : '',
            operational_importance: row.operational_importance != null ? String(row.operational_importance) : '',
            executive_visibility: row.executive_visibility != null ? String(row.executive_visibility) : '',
            confidence: row.confidence != null ? String(row.confidence) : '',
            value_notes: row.value_notes != null ? String(row.value_notes) : '',
        }))
        .filter((row) => Object.values(row).some((value) => String(value).trim()));
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof createEmptyInteractionLogEntry>[]}
 */
function normalizeInteractionLogEntry(raw) {
    const empty = createEmptyInteractionLogEntry();
    if (!isPlainObject(raw)) return empty;
    const source = INTERACTION_LOG_SOURCES.has(String(raw.source)) ? String(raw.source) : 'signal';
    const politicalSignal = POLITICAL_SIGNAL_VALUES.has(String(raw.political_signal ?? ''))
        ? String(raw.political_signal)
        : '';
    const momentumShift = MOMENTUM_SHIFT_VALUES.has(String(raw.momentum_shift ?? ''))
        ? String(raw.momentum_shift)
        : '';
    return {
        id: raw.id != null ? String(raw.id) : crypto.randomUUID(),
        date: raw.date != null ? String(raw.date) : new Date().toISOString(),
        source,
        contact_id: raw.contact_id != null && raw.contact_id !== '' ? String(raw.contact_id) : null,
        interaction: raw.interaction != null ? String(raw.interaction) : '',
        key_insight: raw.key_insight != null ? String(raw.key_insight) : '',
        text: raw.text != null ? String(raw.text) : '',
        political_signal: politicalSignal,
        relationship_energy: raw.relationship_energy != null ? String(raw.relationship_energy) : '',
        trust_earned: raw.trust_earned != null ? String(raw.trust_earned) : '',
        momentum_shift: momentumShift,
        next_move: raw.next_move != null ? String(raw.next_move) : '',
        activity_id: raw.activity_id != null && raw.activity_id !== '' ? String(raw.activity_id) : null,
    };
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof createEmptyInteractionLogEntry>[]}
 */
function normalizeInteractionLog(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(isPlainObject).map(normalizeInteractionLogEntry);
}

/**
 * @param {ReturnType<typeof normalizeMomentumNotes>} momentumNotes
 * @param {ReturnType<typeof normalizeInteractionLog>} interactionLog
 */
function migrateMomentumNotesToInteractionLog(momentumNotes, interactionLog) {
    const existingIds = new Set(interactionLog.map((entry) => entry.id));
    const migrated = [...interactionLog];
    momentumNotes.forEach((note) => {
        if (existingIds.has(note.id)) return;
        migrated.push({
            id: note.id,
            date: note.date,
            source: 'signal',
            contact_id: null,
            interaction: '',
            key_insight: '',
            text: note.text,
            political_signal: '',
            relationship_energy: '',
            trust_earned: '',
            momentum_shift: '',
            next_move: '',
            activity_id: null,
        });
    });
    return migrated;
}

/**
 * @param {unknown} raw
 */
function normalizePsychology(raw) {
    const empty = { ...DEFAULT_PSYCHOLOGY };
    if (!isPlainObject(raw)) return empty;
    return {
        bureaucracy_level: clampScale(raw.bureaucracy_level, DEFAULT_PSYCHOLOGY.bureaucracy_level),
        risk_appetite: clampScale(raw.risk_appetite, DEFAULT_PSYCHOLOGY.risk_appetite),
        technical_sophistication: clampScale(raw.technical_sophistication, DEFAULT_PSYCHOLOGY.technical_sophistication),
        vendor_loyalty: clampScale(raw.vendor_loyalty, DEFAULT_PSYCHOLOGY.vendor_loyalty),
        decision_velocity: clampScale(raw.decision_velocity, DEFAULT_PSYCHOLOGY.decision_velocity),
        organizational_gravity: raw.organizational_gravity != null ? String(raw.organizational_gravity) : '',
        consensus_requirement: raw.consensus_requirement != null ? String(raw.consensus_requirement) : '',
        procurement_friction: raw.procurement_friction != null ? String(raw.procurement_friction) : '',
        innovation_friction: raw.innovation_friction != null ? String(raw.innovation_friction) : '',
        narrative: raw.narrative != null ? String(raw.narrative) : '',
    };
}

/**
 * @param {unknown} plan
 * @returns {import('./account-plan-data.js').AccountPlanDocument}
 */
export function normalizePlan(plan) {
    const empty = createEmptyPlan();
    if (!isPlainObject(plan)) {
        return empty;
    }

    const draft = isPlainObject(plan.current_draft) ? plan.current_draft : {};
    const sections = isPlainObject(draft.sections) ? draft.sections : {};
    const momentum = isPlainObject(sections.relationship_momentum) ? sections.relationship_momentum : {};
    const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};
    const momentumNotes = normalizeMomentumNotes(sections.momentum_notes);
    const interactionLogRaw = normalizeInteractionLog(sections.interaction_log);
    const interactionLog = migrateMomentumNotesToInteractionLog(momentumNotes, interactionLogRaw);

    return {
        schema_version: PLAN_SCHEMA_VERSION,
        current_draft: {
            updated_at: typeof draft.updated_at === 'string' ? draft.updated_at : empty.current_draft.updated_at,
            last_milestone_at: draft.last_milestone_at != null ? String(draft.last_milestone_at) : null,
            sections: {
                account_snapshot: normalizeAccountSnapshot(sections.account_snapshot),
                pursuit_thesis: normalizePursuitThesis(sections.pursuit_thesis, sections),
                strategic_tensions: normalizeStrategicTensions(sections.strategic_tensions, sections),
                pain_signals: normalizePainSignals(sections.pain_signals),
                critical_unknowns: normalizeCriticalUnknowns(sections.critical_unknowns),
                influence_mapping: normalizeInfluenceMapping(sections.influence_mapping, sections),
                white_space: normalizeWhiteSpace(sections.white_space),
                competitive_landscape: normalizeCompetitiveLandscape(sections.competitive_landscape, sections),
                entrenchment: normalizeEntrenchment(sections.entrenchment),
                land_and_expand: normalizeLandAndExpand(sections.land_and_expand, sections),
                entry_points: normalizeEntryPoints(sections.entry_points),
                relationship_momentum: {
                    score: clampScale(momentum.score, 3),
                    narrative: momentum.narrative != null ? String(momentum.narrative) : '',
                },
                momentum_notes: momentumNotes,
                interaction_log: interactionLog,
                plan_30_60_90: {
                    days_30: plan306090.days_30 != null ? String(plan306090.days_30) : '',
                    days_60: plan306090.days_60 != null ? String(plan306090.days_60) : '',
                    days_90: plan306090.days_90 != null ? String(plan306090.days_90) : '',
                },
                psychology: normalizePsychology(sections.psychology),
            },
        },
        history: Array.isArray(plan.history)
            ? plan.history.filter(isPlainObject).map(normalizeHistoryEntry).slice(-HISTORY_CAP)
            : [],
    };
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
 * @param {Record<string, unknown>} entry
 */
function normalizeHistoryEntry(entry) {
    return {
        id: entry.id != null ? String(entry.id) : crypto.randomUUID(),
        committed_at: entry.committed_at != null ? String(entry.committed_at) : new Date().toISOString(),
        reason: entry.reason === 'manual_force_commit' ? 'manual_force_commit' : 'auto_milestone',
        label: entry.label != null ? String(entry.label) : 'Snapshot',
        snapshot: isPlainObject(entry.snapshot)
            ? normalizePlan({ schema_version: PLAN_SCHEMA_VERSION, current_draft: entry.snapshot, history: [] }).current_draft
            : createEmptyPlan().current_draft,
    };
}

/**
 * @param {unknown} value
 * @returns {import('./account-plan-data.js').AccountPlanDocument}
 */
export function deepClonePlan(value) {
    if (typeof structuredClone === 'function') {
        return normalizePlan(structuredClone(value));
    }
    return normalizePlan(JSON.parse(JSON.stringify(value)));
}

/**
 * @param {import('./account-plan-data.js').AccountPlanDocument} plan
 * @param {Date} [now]
 */
export function shouldCreateMilestone(plan, now = new Date()) {
    if (!plan || !isPlainObject(plan.current_draft)) return false;

    const lastAt = resolveLastMilestoneAt(plan);
    if (!lastAt) return false;

    const lastMs = Date.parse(lastAt);
    if (Number.isNaN(lastMs)) return false;

    return now.getTime() - lastMs >= MILESTONE_INTERVAL_MS;
}

/**
 * @param {import('./account-plan-data.js').AccountPlanDocument} plan
 */
function resolveLastMilestoneAt(plan) {
    const draft = plan.current_draft;
    if (draft && draft.last_milestone_at) {
        return draft.last_milestone_at;
    }
    const history = Array.isArray(plan.history) ? plan.history : [];
    if (history.length === 0) return null;
    const last = history[history.length - 1];
    return last && last.committed_at ? last.committed_at : null;
}

/**
 * @param {Date} date
 * @param {'auto_milestone' | 'manual_force_commit'} reason
 */
function buildMilestoneLabel(date, reason) {
    const formatted = date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
    if (reason === 'manual_force_commit') {
        return `${formatted} — Manual commit`;
    }
    return `${formatted} — Auto milestone`;
}

/**
 * Push a deep copy of current_draft into history and refresh last_milestone_at.
 * Mutates and returns the same plan object.
 *
 * @param {import('./account-plan-data.js').AccountPlanDocument} plan
 * @param {'auto_milestone' | 'manual_force_commit'} reason
 * @param {Date} [now]
 */
export function commitMilestone(plan, reason, now = new Date()) {
    if (!plan || !isPlainObject(plan.current_draft)) {
        throw new Error('commitMilestone: invalid plan');
    }

    const committedAt = now.toISOString();
    const snapshot = deepClonePlan(plan).current_draft;

    const entry = {
        id: crypto.randomUUID(),
        committed_at: committedAt,
        reason: reason === 'manual_force_commit' ? 'manual_force_commit' : 'auto_milestone',
        label: buildMilestoneLabel(now, reason === 'manual_force_commit' ? 'manual_force_commit' : 'auto_milestone'),
        snapshot,
    };

    if (!Array.isArray(plan.history)) {
        plan.history = [];
    }
    plan.history.push(entry);
    if (plan.history.length > HISTORY_CAP) {
        plan.history = plan.history.slice(-HISTORY_CAP);
    }

    plan.current_draft.last_milestone_at = committedAt;
    return plan;
}

/**
 * @param {object} supabase
 * @param {number | string} accountId
 * @param {string | null} [createdBy]
 * @returns {Promise<{ ok: boolean, row?: { id: string, account_id: number, plan: import('./account-plan-data.js').AccountPlanDocument, created_at: string, updated_at: string, created_by: string | null }, error?: string }>}
 */
export async function fetchPlanForAccount(supabase, accountId, createdBy = null) {
    if (!supabase || accountId == null) {
        return { ok: false, error: 'Missing supabase client or accountId.' };
    }

    const accountIdNum = Number(accountId);
    if (Number.isNaN(accountIdNum)) {
        return { ok: false, error: 'Invalid accountId.' };
    }

    try {
        const { data: existing, error: selectError } = await supabase
            .from('account_plans')
            .select('id, account_id, plan, created_at, updated_at, created_by')
            .eq('account_id', accountIdNum)
            .maybeSingle();

        if (selectError) {
            console.error('[account-plan-data] fetch select error:', selectError);
            return { ok: false, error: selectError.message || 'Failed to load account plan.' };
        }

        if (existing) {
            return {
                ok: true,
                row: {
                    ...existing,
                    plan: normalizePlan(existing.plan),
                },
            };
        }

        const defaultPlan = createEmptyPlan();
        const insertPayload = {
            account_id: accountIdNum,
            plan: defaultPlan,
        };
        if (createdBy) {
            insertPayload.created_by = createdBy;
        }

        const { data: inserted, error: insertError } = await supabase
            .from('account_plans')
            .insert([insertPayload])
            .select('id, account_id, plan, created_at, updated_at, created_by')
            .single();

        if (insertError) {
            if (insertError.code === '23505') {
                const { data: raced, error: raceSelectError } = await supabase
                    .from('account_plans')
                    .select('id, account_id, plan, created_at, updated_at, created_by')
                    .eq('account_id', accountIdNum)
                    .maybeSingle();
                if (!raceSelectError && raced) {
                    return {
                        ok: true,
                        row: { ...raced, plan: normalizePlan(raced.plan) },
                    };
                }
            }
            console.error('[account-plan-data] fetch insert error:', insertError);
            return { ok: false, error: insertError.message || 'Failed to create account plan.' };
        }

        return {
            ok: true,
            row: {
                ...inserted,
                plan: normalizePlan(inserted.plan),
            },
        };
    } catch (err) {
        console.error('[account-plan-data] fetchPlanForAccount exception:', err);
        return { ok: false, error: err && err.message ? err.message : 'Unexpected error loading account plan.' };
    }
}

/**
 * @param {object} supabase
 * @param {string} planRowId
 * @param {import('./account-plan-data.js').AccountPlanDocument} plan
 * @returns {Promise<{ ok: boolean, updated_at?: string, error?: string }>}
 */
export async function savePlanDraft(supabase, planRowId, plan) {
    if (!supabase || !planRowId) {
        return { ok: false, error: 'Missing supabase client or planRowId.' };
    }
    if (!plan || !isPlainObject(plan.current_draft)) {
        return { ok: false, error: 'Invalid plan payload.' };
    }

    const normalized = normalizePlan(plan);

    try {
        const { data, error } = await supabase
            .from('account_plans')
            .update({ plan: normalized })
            .eq('id', planRowId)
            .select('updated_at')
            .single();

        if (error) {
            console.error('[account-plan-data] savePlanDraft error:', error);
            return { ok: false, error: error.message || 'Failed to save account plan.' };
        }

        return { ok: true, updated_at: data && data.updated_at ? data.updated_at : undefined };
    } catch (err) {
        console.error('[account-plan-data] savePlanDraft exception:', err);
        return { ok: false, error: err && err.message ? err.message : 'Unexpected error saving account plan.' };
    }
}

// ---------------------------------------------------------------------------
// Strict pre-persistence sanitization (Task 4 — "Hardening for the AI/PPTX
// Engines"). normalizePlan() is permissive and migration-friendly; this
// function is an *explicit*, narrow validator that runs right before the
// autosave debounce fires.
//
// Why a separate pass: the downstream AI presentation engine and the PPTX
// builder both assume scalar shapes (integer 1..5 sliders, string-only pill
// arrays). Loose types (NaN sliders, null pills, stray empty strings) leak in
// from legacy data and pill toggles that ran during slow renders — they
// silently corrupt prompts and break presentation parsing. We catch them here
// instead of trusting the network round-trip.
// ---------------------------------------------------------------------------

const PSYCHOLOGY_SLIDER_KEYS = Object.freeze([
    'bureaucracy_level',
    'risk_appetite',
    'technical_sophistication',
    'vendor_loyalty',
    'decision_velocity',
]);

/**
 * Coerce psychology slider fields to integers in [1, 5]. Mutates and returns the
 * provided psychology object so we can stay zero-alloc when nothing is wrong.
 *
 * @param {Record<string, unknown> | null | undefined} psychology
 * @returns {Record<string, unknown>}
 */
function sanitizePsychologySliders(psychology) {
    if (!isPlainObject(psychology)) return { ...DEFAULT_PSYCHOLOGY };
    const cleaned = { ...psychology };
    PSYCHOLOGY_SLIDER_KEYS.forEach((key) => {
        // parseInt handles "3", 3, "3.7", and rejects "" / null gracefully.
        const parsed = parseInt(String(cleaned[key]), 10);
        const fallback = DEFAULT_PSYCHOLOGY[key];
        if (Number.isNaN(parsed)) {
            cleaned[key] = fallback;
            return;
        }
        cleaned[key] = Math.min(5, Math.max(1, parsed));
    });
    return cleaned;
}

/**
 * Strip null/undefined/empty/whitespace-only values from a pill array. Order is
 * preserved because the strategic_tensions UI is order-sensitive (it dictates
 * the read-out order in exports).
 *
 * @param {unknown} pills
 * @returns {string[]}
 */
function stripEmptyPills(pills) {
    if (!Array.isArray(pills)) return [];
    return pills
        .map((pill) => (pill == null ? '' : String(pill).trim()))
        .filter((pill) => pill.length > 0);
}

/**
 * Last-mile sanitization invoked by the autosave engine right before a write
 * hits Supabase. This is intentionally cheap (shallow clone + spot fixes) so it
 * can run on every debounce flush without measurable latency.
 *
 * @param {Record<string, unknown> | null | undefined} draftSections
 * @returns {Record<string, unknown>}
 */
export function sanitizeDraftSectionsForPersistence(draftSections) {
    if (!isPlainObject(draftSections)) return {};
    const next = { ...draftSections };

    // psychology — guarantee scalar integers for the AI engine's structured prompt.
    if ('psychology' in next || isPlainObject(next.psychology)) {
        next.psychology = sanitizePsychologySliders(next.psychology);
    }

    // strategic_tensions — drop empty pills BEFORE the JSONB write. These tend
    // to creep in from rapid pill toggling (an interim state where the user
    // briefly deselects but reselects — race conditions can persist '' in the
    // either_or group).
    if (isPlainObject(next.strategic_tensions)) {
        next.strategic_tensions = {
            ...next.strategic_tensions,
            selected_pills: stripEmptyPills(next.strategic_tensions.selected_pills),
        };
    }

    return next;
}

/**
 * Merge live section edits into a plan copy, optionally committing a milestone first.
 *
 * @param {import('./account-plan-data.js').AccountPlanDocument} plan
 * @param {Record<string, unknown>} draftSections
 * @param {{ forceCommit?: boolean, now?: Date }} [options]
 * @returns {import('./account-plan-data.js').AccountPlanDocument}
 */
export function applyDraftToPlan(plan, draftSections, options = {}) {
    const now = options.now instanceof Date ? options.now : new Date();
    const next = deepClonePlan(plan);
    const forceCommit = !!options.forceCommit;

    if (forceCommit || shouldCreateMilestone(next, now)) {
        commitMilestone(
            next,
            forceCommit ? 'manual_force_commit' : 'auto_milestone',
            now
        );
    }

    const mergedSections = {
        ...next.current_draft.sections,
        ...(isPlainObject(draftSections) ? draftSections : {}),
    };

    next.current_draft = {
        ...next.current_draft,
        sections: mergedSections,
        updated_at: now.toISOString(),
    };

    return next;
}
