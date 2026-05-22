/**
 * Strategic Account OS — data layer (JSONB plan document, milestones, Supabase I/O).
 */

export const PLAN_SCHEMA_VERSION = 1;
export const HISTORY_CAP = 50;
export const MILESTONE_INTERVAL_MS = 24 * 60 * 60 * 1000;

const DEFAULT_PSYCHOLOGY = Object.freeze({
    bureaucracy_level: 3,
    risk_appetite: 3,
    technical_sophistication: 3,
    vendor_loyalty: 3,
    decision_velocity: 3,
});

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
                pursuit_thesis: {
                    core: '',
                    cost_of_standing_still: '',
                    timing: '',
                },
                strategic_tensions: {
                    selected_pills: [],
                    narrative: '',
                },
                influence_mapping: {
                    executive: [],
                    mid_level: [],
                    invisible_org_chart: '',
                },
                competitive_landscape: {
                    incumbents: '',
                    positioning_pills: [],
                    narrative: '',
                },
                land_and_expand: {
                    initial_entry: '',
                    trust_creation: '',
                    expansion_path: '',
                },
                relationship_momentum: {
                    score: 3,
                    narrative: '',
                },
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
 * @returns {{ id: string, notes: string } | null}
 */
function normalizeInfluenceContactEntry(entry) {
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
}

/**
 * @param {unknown[]} value
 * @returns {{ id: string, notes: string }[]}
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
    const empty = { core: '', cost_of_standing_still: '', timing: '' };
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
        cost_of_standing_still: raw.cost_of_standing_still != null ? String(raw.cost_of_standing_still) : '',
        timing: raw.timing != null ? String(raw.timing) : '',
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
    const empty = { executive: [], mid_level: [], invisible_org_chart: '' };
    if (typeof raw === 'string') {
        const legacy = raw.trim() || migrateLegacySectionText(sections, 'influence_mapping', ['stakeholder_map']);
        return legacy ? { ...empty, invisible_org_chart: legacy } : empty;
    }
    if (!isPlainObject(raw)) {
        const legacy = migrateLegacySectionText(sections, 'influence_mapping', ['stakeholder_map']);
        return legacy ? { ...empty, invisible_org_chart: legacy } : empty;
    }
    return {
        executive: normalizeInfluenceContactList(raw.executive),
        mid_level: normalizeInfluenceContactList(raw.mid_level),
        invisible_org_chart: raw.invisible_org_chart != null ? String(raw.invisible_org_chart) : '',
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
    const psychology = isPlainObject(sections.psychology) ? sections.psychology : {};

    return {
        schema_version: typeof plan.schema_version === 'number' ? plan.schema_version : PLAN_SCHEMA_VERSION,
        current_draft: {
            updated_at: typeof draft.updated_at === 'string' ? draft.updated_at : empty.current_draft.updated_at,
            last_milestone_at: draft.last_milestone_at != null ? String(draft.last_milestone_at) : null,
            sections: {
                pursuit_thesis: normalizePursuitThesis(sections.pursuit_thesis, sections),
                strategic_tensions: (() => {
                    const normalized = normalizePillsAndNarrative(
                        sections.strategic_tensions,
                        sections,
                        'strategic_tensions',
                        ['situation_assessment', 'risks_and_mitigations']
                    );
                    return {
                        selected_pills: normalized.selected_pills,
                        narrative: normalized.narrative,
                    };
                })(),
                influence_mapping: normalizeInfluenceMapping(sections.influence_mapping, sections),
                competitive_landscape: normalizeCompetitiveLandscape(sections.competitive_landscape, sections),
                land_and_expand: normalizeLandAndExpand(sections.land_and_expand, sections),
                relationship_momentum: {
                    score: clampScale(momentum.score, 3),
                    narrative: momentum.narrative != null ? String(momentum.narrative) : '',
                },
                plan_30_60_90: {
                    days_30: plan306090.days_30 != null ? String(plan306090.days_30) : '',
                    days_60: plan306090.days_60 != null ? String(plan306090.days_60) : '',
                    days_90: plan306090.days_90 != null ? String(plan306090.days_90) : '',
                },
                psychology: {
                    bureaucracy_level: clampScale(psychology.bureaucracy_level, DEFAULT_PSYCHOLOGY.bureaucracy_level),
                    risk_appetite: clampScale(psychology.risk_appetite, DEFAULT_PSYCHOLOGY.risk_appetite),
                    technical_sophistication: clampScale(psychology.technical_sophistication, DEFAULT_PSYCHOLOGY.technical_sophistication),
                    vendor_loyalty: clampScale(psychology.vendor_loyalty, DEFAULT_PSYCHOLOGY.vendor_loyalty),
                    decision_velocity: clampScale(psychology.decision_velocity, DEFAULT_PSYCHOLOGY.decision_velocity),
                },
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
