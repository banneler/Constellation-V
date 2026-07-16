/**
 * AI-synthesized presentation highlight reel for exec deck export.
 */

import { normalizePlan, getWhiteSpaceRows } from './account-plan-data.js';
import { TACTICAL_UX_LABELS } from './account-plan-sections.js';
import { callAiApi } from './ai-memory.js';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @returns {Promise<import('./account-plan-presentation-types.js').PresentationHighlight>}
 */
/**
 * @param {import('@supabase/supabase-js').FunctionsError | null} error
 * @param {unknown} data
 */
function presentationInvokeErrorMessage(error, data) {
    if (data && typeof data === 'object' && data !== null && 'error' in data) {
        const apiErr = /** @type {{ error?: unknown }} */ (data).error;
        if (apiErr != null && String(apiErr).trim()) {
            return String(apiErr).trim();
        }
    }

    const ctx = error && typeof error === 'object' && 'context' in error
        ? /** @type {{ context?: unknown }} */ (error).context
        : null;
    if (ctx && typeof ctx === 'object' && ctx !== null) {
        const body = /** @type {{ body?: unknown }} */ (ctx).body;
        if (typeof body === 'string' && body.trim()) {
            try {
                const parsed = JSON.parse(body);
                if (parsed?.error) return String(parsed.error);
            } catch {
                return body.trim().slice(0, 280);
            }
        }
    }

    return error?.message || 'Presentation synthesis failed.';
}

export async function fetchPresentationHighlight(supabase, plan, account) {
    const normalized = normalizePlan(plan);
    const accountName = account?.name ? String(account.name) : 'Account';

    const data = await callAiApi(supabase, 'generate-presentation-highlight', {
        plan: normalized,
        accountName,
    });
    if (data?.error) {
        throw new Error(String(data.error));
    }

    return normalizePresentationHighlight(data?.highlight, {
        accountName,
        generatedAt: data?.generated_at ?? new Date().toISOString(),
        model: data?.model ?? null,
        personalContextId: data?.personal_context_id ?? null,
        plan,
    });
}

/**
 * @param {unknown} raw
 * @param {{ accountName: string, generatedAt: string, model: string | null, personalContextId?: string | null, plan: unknown }} meta
 * @returns {import('./account-plan-presentation-types.js').PresentationHighlight}
 */
export function normalizePresentationHighlight(raw, meta) {
    const slidesRaw = isPlainObject(raw) && isPlainObject(raw.slides) ? raw.slides : {};
    const situation = isPlainObject(slidesRaw.situation) ? slidesRaw.situation : {};
    const battlefield = isPlainObject(slidesRaw.battlefield) ? slidesRaw.battlefield : {};
    const execution = isPlainObject(slidesRaw.execution) ? slidesRaw.execution : {};

    const pursuit = isPlainObject(situation.pursuit_thesis) ? situation.pursuit_thesis : {};
    const accountContextRaw = isPlainObject(situation.account_context) ? situation.account_context : {};
    const painSignalsRaw = isPlainObject(situation.pain_signals) ? situation.pain_signals : {};
    const criticalUnknownsRaw = isPlainObject(situation.critical_unknowns) ? situation.critical_unknowns : {};
    const momentum = isPlainObject(situation.momentum) ? situation.momentum : {};
    const psychology = isPlainObject(situation.psychology) ? situation.psychology : {};
    const competitive = isPlainObject(battlefield.competitive) ? battlefield.competitive : {};
    const whiteSpaceRaw = isPlainObject(battlefield.white_space) ? battlefield.white_space : {};
    const influence = isPlainObject(battlefield.influence) ? battlefield.influence : {};

    const ctx = resolvePlanContext(meta.plan);
    const fallbackAccountContext = fallbackAccountContextFromSnapshot(ctx.sections);
    const fallbackSubheadline = buildAccountContextLabel(fallbackAccountContext);

    return {
        generated_at: meta.generatedAt,
        model: meta.model,
        personal_context_id: meta.personalContextId ?? null,
        account_name: meta.accountName,
        slides: {
            situation: {
                headline: pickText(situation.headline, `${meta.accountName}: Strategic Pursuit Brief`),
                subheadline: pickText(situation.subheadline, fallbackSubheadline),
                account_context: {
                    tier: pickText(accountContextRaw.tier, fallbackAccountContext.tier),
                    priority: pickText(accountContextRaw.priority, fallbackAccountContext.priority),
                },
                pursuit_thesis: {
                    headline: pickText(pursuit.headline, 'Why This Account Matters Now'),
                    bullets: pickBullets(pursuit.bullets, 4, fallbackPursuitBullets(ctx.sections)),
                },
                executive_narrative: pickText(
                    situation.executive_narrative,
                    fallbackExecutiveNarrative(ctx.sections)
                ),
                pain_signals: normalizeSignalBlock(
                    painSignalsRaw,
                    'Pain Signals',
                    fallbackPainSignalBullets(ctx.sections)
                ),
                critical_unknowns: normalizeSignalBlock(
                    criticalUnknownsRaw,
                    'Critical Unknowns',
                    fallbackCriticalUnknownBullets(ctx.sections)
                ),
                momentum: {
                    insight: pickText(
                        momentum.insight,
                        ctx.momentumNarrative || 'Relationship momentum is developing — validate executive access path.'
                    ),
                },
                psychology: {
                    headline: pickText(psychology.headline, TACTICAL_UX_LABELS.psychologySection),
                    callouts: pickCallouts(
                        psychology.callouts,
                        3,
                        fallbackPsychologyCallouts(ctx.sections)
                    ),
                },
            },
            battlefield: {
                headline: pickText(battlefield.headline, 'Competitive & Political Battlefield'),
                competitive: {
                    headline: pickText(competitive.headline, 'Competitive Landscape'),
                    bullets: pickBullets(
                        competitive.bullets,
                        4,
                        fallbackCompetitiveBullets(ctx.sections)
                    ),
                },
                white_space: {
                    headline: pickText(whiteSpaceRaw.headline, fallbackWhiteSpaceHook(ctx.sections).headline),
                    opportunity: pickText(
                        whiteSpaceRaw.opportunity,
                        fallbackWhiteSpaceHook(ctx.sections).opportunity
                    ),
                    wedge_summary: pickText(
                        whiteSpaceRaw.wedge_summary,
                        fallbackWedgeSummary(ctx.sections)
                    ),
                },
                influence: {
                    executive_hook: pickText(
                        influence.executive_hook,
                        fallbackInfluenceHook(ctx.sections, 'executive')
                    ),
                    champions_hook: pickText(
                        influence.champions_hook,
                        fallbackInfluenceHook(ctx.sections, 'mid_level')
                    ),
                    access_path_hook: pickText(
                        influence.access_path_hook,
                        fallbackAccessPathHook(ctx.sections)
                    ),
                    champions: pickChampions(influence.champions, ctx.sections),
                },
                entry_points: pickEntryPoints(battlefield.entry_points, ctx.sections),
            },
            execution: {
                headline: pickText(execution.headline, '90-Day Pursuit Cadence'),
                plan_30: normalizePlanHorizon(execution.plan_30, 'Next 30 Days', ctx.plan306090.days_30),
                plan_60: normalizePlanHorizon(execution.plan_60, 'Day 31–60', ctx.plan306090.days_60),
                plan_90: normalizePlanHorizon(execution.plan_90, 'Day 61–90', ctx.plan306090.days_90),
                entrenchment_moat: pickText(
                    execution.entrenchment_moat,
                    fallbackEntrenchmentMoat(ctx.sections)
                ),
                signals: pickSignals(execution.signals, ctx.timelineNotes),
            },
        },
    };
}

/**
 * @param {unknown} plan
 */
function resolvePlanContext(plan) {
    const normalized = normalizePlan(plan);
    const sections = normalized.current_draft.sections;
    const momentum = resolveMomentumFromInteractionLog(sections);
    const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};

    return {
        sections,
        momentumNarrative: momentum.narrative,
        plan306090,
        timelineNotes: getExportSignals(sections).slice(0, 3),
    };
}

/**
 * Latest scored entry from interaction_log — replaces legacy relationship_momentum.
 * @param {Record<string, unknown>} sections
 * @returns {{ score: number, narrative: string }}
 */
function resolveMomentumFromInteractionLog(sections) {
    const log = Array.isArray(sections.interaction_log) ? sections.interaction_log : [];
    /** @type {{ score: number, narrative: string, dateMs: number } | null} */
    let latest = null;

    log.forEach((entry) => {
        if (!isPlainObject(entry)) return;
        if (entry.momentum_score == null || entry.momentum_score === '') return;
        const dateMs = new Date(String(entry.date ?? '')).getTime();
        const ms = Number.isNaN(dateMs) ? 0 : dateMs;
        if (!latest || ms >= latest.dateMs) {
            latest = {
                score: clampPresentationScale(entry.momentum_score, 3),
                narrative: String(entry.text ?? entry.interaction ?? entry.key_insight ?? '').trim(),
                dateMs: ms,
            };
        }
    });

    return latest
        ? { score: latest.score, narrative: latest.narrative }
        : { score: 3, narrative: '' };
}

/**
 * @param {number | string | null | undefined} value
 * @param {number} fallback
 */
function clampPresentationScale(value, fallback) {
    const n = parseInt(String(value), 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(5, Math.max(1, n));
}

/**
 * User-logged strategic signals only — excludes CRM activity rows.
 * Per docs/saos/DECISIONS.md #1: never include source: activity in presentation signals.
 * @param {Record<string, unknown>} sections
 */
function getExportSignals(sections) {
    /** @type {Map<string, Record<string, unknown>>} */
    const byId = new Map();

    const addEntry = (entry) => {
        const text = String(entry.text ?? '').trim();
        if (!text) return;
        const id = entry.id != null ? String(entry.id) : crypto.randomUUID();
        const dateMs = new Date(String(entry.date ?? '')).getTime();
        const existing = byId.get(id);
        if (!existing || dateMs >= new Date(String(existing.date ?? '')).getTime()) {
            byId.set(id, { ...entry, id, text, dateMs: Number.isNaN(dateMs) ? 0 : dateMs });
        }
    };

    const momentumNotes = Array.isArray(sections.momentum_notes) ? sections.momentum_notes : [];
    momentumNotes.forEach((note) => {
        if (!isPlainObject(note)) return;
        const source = note.source != null ? String(note.source).toLowerCase() : '';
        const type = note.type != null ? String(note.type).toLowerCase() : '';
        if (source === 'activity' || source === 'crm' || type === 'activity') return;
        addEntry({
            id: note.id,
            date: note.date,
            text: note.text,
        });
    });

    const interactionLog = Array.isArray(sections.interaction_log) ? sections.interaction_log : [];
    interactionLog.forEach((entry) => {
        if (!isPlainObject(entry)) return;
        const source = entry.source != null ? String(entry.source).toLowerCase() : '';
        if (source === 'activity' || source === 'crm') return;
        addEntry({
            id: entry.id,
            date: entry.date,
            text: entry.text ?? entry.interaction ?? entry.key_insight,
        });
    });

    return [...byId.values()].sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0));
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackAccountContextFromSnapshot(sections) {
    const snapshot = isPlainObject(sections.account_snapshot) ? sections.account_snapshot : {};
    return {
        tier: String(snapshot.tier ?? '').trim(),
        priority: String(snapshot.pursuit_priority ?? '').trim(),
    };
}

/**
 * @param {{ tier: string, priority: string }} accountContext
 */
function buildAccountContextLabel(accountContext) {
    return [accountContext.tier, accountContext.priority].filter(Boolean).join(' · ');
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackExecutiveNarrative(sections) {
    const thesis = isPlainObject(sections.pursuit_thesis) ? sections.pursuit_thesis : {};
    return truncatePresentationText(String(thesis.executive_narrative ?? '').trim(), 140);
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackPainSignalBullets(sections) {
    const thesis = isPlainObject(sections.pursuit_thesis) ? sections.pursuit_thesis : {};
    const selected = Array.isArray(thesis.operational_pain_selected)
        ? thesis.operational_pain_selected
        : [];
    const pills = selected.map((pill) => String(pill ?? '').trim()).filter(Boolean);
    const notes = String(thesis.operational_pain_notes ?? '').trim();

    if (pills.length > 0 || notes) {
        const bullets = [...pills];
        if (notes) bullets.push(truncatePresentationText(notes, 90));
        return bullets.slice(0, 3);
    }

    const legacyPain = isPlainObject(sections.pain_signals) ? sections.pain_signals : {};
    const legacySelected = Array.isArray(legacyPain.selected) ? legacyPain.selected : [];
    const legacyPills = legacySelected.map((pill) => String(pill ?? '').trim()).filter(Boolean);
    const legacyNotes = String(legacyPain.notes ?? '').trim();
    const bullets = [...legacyPills];
    if (legacyNotes) bullets.push(truncatePresentationText(legacyNotes, 90));
    return bullets.slice(0, 3);
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackCriticalUnknownBullets(sections) {
    const unknowns = isPlainObject(sections.critical_unknowns) ? sections.critical_unknowns : {};
    // Post-Task-3 the section stores `blindspots: string[]`. The
    // legacy `unknowns` rich-text blob (and the now-deprecated
    // executive_language_* fields) are still consulted as a fallback so
    // a half-migrated plan continues to render bullets — see
    // normalizeCriticalUnknowns in account-plan-data.js for the
    // equivalent migration path on the data layer.
    if (Array.isArray(unknowns)) {
        return unknowns
            .map((entry) => String(entry ?? '').trim())
            .filter(Boolean)
            .slice(0, 8);
    }
    const arr = Array.isArray(unknowns.blindspots) ? unknowns.blindspots : null;
    if (arr && arr.length > 0) {
        return arr
            .map((entry) => String(entry ?? '').trim())
            .filter(Boolean)
            .slice(0, 8);
    }
    const lines = extractBulletLines(unknowns.unknowns);
    return [
        ...lines,
        String(unknowns.executive_language_notes ?? '').trim(),
    ]
        .map((line) => String(line).trim())
        .filter(Boolean)
        .slice(0, 8);
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackPursuitBullets(sections) {
    const thesis = isPlainObject(sections.pursuit_thesis) ? sections.pursuit_thesis : {};
    // Post-Task-2 the single `thesis` field replaces legacy `core` +
    // `cost_of_standing_still`. We coalesce in that order so a
    // half-migrated payload still surfaces SOMETHING in the bullets.
    const merged = String(thesis.thesis ?? '').trim()
        || [thesis.core, thesis.cost_of_standing_still]
            .map((v) => String(v ?? '').trim())
            .filter(Boolean)
            .join(' — ');
    return [
        merged,
        thesis.why_account_matters,
        thesis.timing,
    ]
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
        .slice(0, 4);
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackCompetitiveBullets(sections) {
    const competitive = isPlainObject(sections.competitive_landscape) ? sections.competitive_landscape : {};
    const pills = Array.isArray(competitive.positioning_pills) ? competitive.positioning_pills : [];
    const moatPills = Array.isArray(competitive.moat_pills) ? competitive.moat_pills : [];
    return [
        competitive.incumbents,
        pills.length ? `Positioning: ${pills.join(', ')}` : '',
        competitive.narrative,
        moatPills.length ? `Moat: ${moatPills.join(', ')}` : '',
        competitive.difficult_to_remove,
    ]
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
        .slice(0, 4);
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackWhiteSpaceHook(sections) {
    const expansion = isPlainObject(sections.white_space) ? sections.white_space : {};
    const wedgeText = [
        expansion.initial_entry,
        expansion.trust_creation,
        expansion.expansion_path,
    ]
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
        .join(' — ');

    const rows = getWhiteSpaceRows(expansion);
    const ranked = [...rows]
        .map((row) => ({
            row,
            score: scoreWhiteSpaceRow(row),
        }))
        .sort((a, b) => b.score - a.score);

    const top = ranked.find((item) => {
        const opportunity = String(item.row.opportunity ?? '').trim();
        const area = String(item.row.area ?? '').trim();
        return opportunity || area;
    });

    if (top) {
        return {
            headline: String(top.row.area ?? 'Top White Space').trim() || 'Top White Space',
            opportunity: truncatePresentationText(String(top.row.opportunity ?? '').trim(), 120),
        };
    }

    if (wedgeText) {
        return {
            headline: 'Account Expansion',
            opportunity: truncatePresentationText(wedgeText, 120),
        };
    }

    return { headline: 'Top White Space', opportunity: '' };
}

/**
 * @param {Record<string, unknown>} row
 */
function scoreWhiteSpaceRow(row) {
    const importance = String(row.operational_importance ?? '').toLowerCase();
    const visibility = String(row.executive_visibility ?? '').toLowerCase();
    const scoreMap = { high: 3, medium: 2, low: 1 };
    return (scoreMap[importance] || 0) * 2 + (scoreMap[visibility] || 0);
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackWedgeSummary(sections) {
    const expansion = isPlainObject(sections.land_and_expand) ? sections.land_and_expand : {};
    const whiteSpace = isPlainObject(sections.white_space) ? sections.white_space : {};
    const parts = [
        expansion.initial_entry,
        expansion.trust_creation,
        expansion.expansion_path,
        whiteSpace.initial_entry,
        whiteSpace.trust_creation,
        whiteSpace.expansion_path,
    ]
        .map((v) => String(v ?? '').trim())
        .filter(Boolean);

    if (parts.length > 0) {
        return truncatePresentationText(parts.join(' '), 220);
    }

    const valueNotes = getWhiteSpaceRows(whiteSpace)
        .map((row) => String(row.value_notes ?? '').trim())
        .filter(Boolean)
        .slice(0, 2);
    if (valueNotes.length > 0) {
        return truncatePresentationText(valueNotes.join(' '), 220);
    }

    const snapshot = isPlainObject(sections.account_snapshot) ? sections.account_snapshot : {};
    return truncatePresentationText(String(snapshot.expansion_potential ?? '').trim(), 220);
}

const GENERIC_CHAMPION_HOOK = /^Operational champion\.?\s*Wedge for day-to-day credibility and expansion\.?$/i;

/**
 * @param {unknown} raw
 * @param {Record<string, unknown>} sections
 */
function pickChampions(raw, sections) {
    const fromAi = Array.isArray(raw)
        ? raw
            .filter((item) => isPlainObject(item))
            .map((item) => ({
                name: pickText(item.name, 'Champion'),
                hook: pickText(item.hook, ''),
            }))
            .filter((item) => item.hook && !GENERIC_CHAMPION_HOOK.test(item.hook))
        : [];

    if (fromAi.length > 0) return fromAi.slice(0, 4);

    const influence = isPlainObject(sections.influence_mapping) ? sections.influence_mapping : {};
    const midLevel = Array.isArray(influence.mid_level) ? influence.mid_level : [];
    const parsed = midLevel
        .map((entry) => parseChampionFromInfluenceEntry(entry))
        .filter((item) => item.hook);

    if (parsed.length > 0) return parsed.slice(0, 4);

    const entryPoints = Array.isArray(sections.entry_points) ? sections.entry_points : [];
    return entryPoints
        .filter((point) => isPlainObject(point) && String(point.contact_name ?? '').trim())
        .slice(0, 4)
        .map((point) => ({
            name: String(point.contact_name).trim(),
            hook: truncatePresentationText(
                String(point.why_they_matter ?? point.next_move ?? '').trim(),
                90
            ),
        }))
        .filter((item) => item.hook);
}

/**
 * @param {unknown} entry
 */
function parseChampionFromInfluenceEntry(entry) {
    if (!isPlainObject(entry)) {
        return { name: 'Champion', hook: '' };
    }

    const notes = String(entry.notes ?? entry.strategic_priorities ?? '').trim();
    if (!notes) {
        return { name: 'Champion', hook: '' };
    }

    const split = notes.match(/^(.+?)\s*[—–-]\s*(.+)$/);
    if (split) {
        const hook = split[2].trim();
        return {
            name: split[1].trim(),
            hook: GENERIC_CHAMPION_HOOK.test(hook) ? '' : hook,
        };
    }

    return {
        name: 'Champion',
        hook: GENERIC_CHAMPION_HOOK.test(notes) ? '' : notes,
    };
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackEntrenchmentMoat(sections) {
    const competitive = isPlainObject(sections.competitive_landscape) ? sections.competitive_landscape : {};
    const pills = Array.isArray(competitive.moat_pills) ? competitive.moat_pills : [];
    const pillText = pills.map((pill) => String(pill ?? '').trim()).filter(Boolean).join(', ');
    const narrative = String(competitive.difficult_to_remove ?? '').trim()
        || String(competitive.compound_relationships ?? '').trim();

    if (pillText || narrative) {
        const combined = [pillText, narrative].filter(Boolean).join(' — ');
        return truncatePresentationText(combined, 140);
    }

    const legacy = isPlainObject(sections.entrenchment) ? sections.entrenchment : {};
    const legacyPills = Array.isArray(legacy.moat_pills) ? legacy.moat_pills : [];
    const legacyPillText = legacyPills.map((pill) => String(pill ?? '').trim()).filter(Boolean).join(', ');
    const legacyNarrative = String(legacy.difficult_to_remove ?? '').trim();
    const combined = [legacyPillText, legacyNarrative].filter(Boolean).join(' — ');
    return truncatePresentationText(combined, 140);
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackPsychologyCallouts(sections) {
    const psychology = isPlainObject(sections.psychology) ? sections.psychology : {};
    return [
        { label: 'Organizational Gravity', insight: psychology.organizational_gravity },
        { label: 'Consensus Requirement', insight: psychology.consensus_requirement },
        { label: 'Procurement Friction', insight: psychology.procurement_friction },
        { label: 'Innovation Friction', insight: psychology.innovation_friction },
        { label: 'Gravity Narrative', insight: psychology.narrative },
    ]
        .map((item) => ({
            label: item.label,
            insight: String(item.insight ?? '').trim(),
        }))
        .filter((item) => item.insight)
        .slice(0, 3);
}

/**
 * @param {Record<string, unknown>} sections
 * @param {'executive' | 'mid_level'} tier
 */
function fallbackInfluenceHook(sections, tier) {
    const influence = isPlainObject(sections.influence_mapping) ? sections.influence_mapping : {};
    const tierText = tier === 'executive'
        ? String(influence.political_dynamics ?? influence.invisible_org_chart ?? '').trim()
        : '';

    if (tierText) {
        return truncatePresentationText(tierText, tier === 'executive' ? 120 : 100);
    }

    return tier === 'executive'
        ? 'Executive access path is the gating factor'
        : 'Mid-level champions can compound operational trust';
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackAccessPathHook(sections) {
    const influence = isPlainObject(sections.influence_mapping) ? sections.influence_mapping : {};
    const accessPath = isPlainObject(influence.access_path) ? influence.access_path : {};
    const parts = [
        accessPath.strategy,
        accessPath.desired,
        accessPath.bridge,
        accessPath.current,
    ]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean);

    if (parts.length > 0) {
        return truncatePresentationText(parts[0], 120);
    }

    return 'Define the executive access path and bridge contacts';
}

/**
 * @param {Record<string, unknown>} raw
 * @param {string} defaultHeadline
 * @param {string[]} fallbackBullets
 */
function normalizeSignalBlock(raw, defaultHeadline, fallbackBullets) {
    const block = isPlainObject(raw) ? raw : {};
    // AI payloads may emit either `bullets` or the consolidated `blindspots`
    // array from sections.critical_unknowns — accept both so the PPTX engine
    // can render The Blindspots on the Battlefield slide.
    const bulletSource = Array.isArray(block.bullets)
        ? block.bullets
        : Array.isArray(block.blindspots)
            ? block.blindspots
            : [];
    return {
        headline: pickText(block.headline, defaultHeadline),
        bullets: pickBullets(bulletSource, 8, fallbackBullets),
    };
}

/**
 * @param {unknown} value
 * @param {string} fallback
 */
function pickText(value, fallback) {
    const text = String(value ?? '').trim();
    return text || fallback;
}

/**
 * @param {unknown} raw
 * @param {number} max
 * @param {string[]} [fallback]
 */
function pickBullets(raw, max, fallback = []) {
    const list = Array.isArray(raw)
        ? raw.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [];
    const merged = list.length > 0 ? list : fallback;
    return merged.slice(0, max);
}

/**
 * @param {unknown} raw
 * @param {number} max
 * @param {Array<{ label: string, insight: string }>} [fallback]
 */
function pickCallouts(raw, max, fallback = []) {
    if (!Array.isArray(raw)) {
        return fallback.slice(0, max);
    }
    const parsed = raw
        .filter((item) => isPlainObject(item))
        .map((item) => ({
            label: pickText(item.label, 'Dynamic'),
            insight: pickText(item.insight, '—'),
        }))
        .filter((item) => item.insight !== '—');
    const merged = parsed.length > 0 ? parsed : fallback;
    return merged.slice(0, max);
}

/**
 * @param {unknown} raw
 * @param {Record<string, unknown>} sections
 */
function pickEntryPoints(raw, sections) {
    const fromAi = Array.isArray(raw)
        ? raw.filter((item) => isPlainObject(item)).map((item) => ({
            name: pickText(item.name, 'Contact'),
            headline: pickText(item.headline, 'Strategic entry point'),
            hook: pickText(item.hook, ''),
            badges: pickText(item.badges, ''),
        })).filter((item) => item.hook)
        : [];

    if (fromAi.length > 0) return fromAi.slice(0, 6);

    const points = Array.isArray(sections.entry_points) ? sections.entry_points : [];
    return points
        .filter((p) => isPlainObject(p) && String(p.contact_name ?? '').trim())
        .slice(0, 2)
        .map((p) => ({
            name: String(p.contact_name).trim(),
            // Headline prefers the structured `why_they_matter` field;
            // post-Task-1 we also fall back to the merged
            // `operational_pain` (and the legacy `likely_pressure` for
            // un-migrated payloads).
            headline: String(p.why_they_matter ?? p.operational_pain ?? p.likely_pressure ?? 'Key influencer').trim().slice(0, 80),
            // Hook prefers the explicit `next_move`. The legacy
            // `narrative_openings` and the new merged `conversation_wedge`
            // are consulted as fallbacks.
            hook: String(p.next_move ?? p.conversation_wedge ?? p.narrative_openings ?? '').trim().slice(0, 100),
            badges: [
                p.trust_level ? `Trust: ${p.trust_level}` : '',
                p.political_influence ? `Influence: ${p.political_influence}` : '',
            ].filter(Boolean).join(' · '),
        }));
}

/**
 * @param {unknown} raw
 * @param {unknown} fallbackText
 * @param {string} defaultHeadline
 */
function normalizePlanHorizon(raw, defaultHeadline, fallbackText) {
    const block = isPlainObject(raw) ? raw : {};
    const fallbackBullets = extractBulletLines(fallbackText).slice(0, 3);
    return {
        headline: pickText(block.headline, defaultHeadline),
        bullets: pickBullets(block.bullets, 3, fallbackBullets.length ? fallbackBullets : ['Define next strategic move']),
    };
}

/**
 * @param {unknown} raw
 * @param {unknown[]} timelineNotes
 */
function pickSignals(raw, timelineNotes) {
    const fromAi = Array.isArray(raw)
        ? raw.filter((item) => isPlainObject(item)).map((item) => ({
            date_label: pickText(item.date_label, ''),
            headline: pickText(item.headline, ''),
        })).filter((item) => item.headline)
        : [];

    if (fromAi.length > 0) return fromAi.slice(0, 3);

    return timelineNotes.map((note) => {
        const date = new Date(String(note.date ?? ''));
        const dateLabel = Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return {
            date_label: dateLabel,
            headline: String(note.text ?? '').trim().slice(0, 90),
        };
    });
}

/**
 * @param {unknown} text
 */
function extractBulletLines(text) {
    return String(text ?? '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^[\u2022\u2023\u2043\u2219*\-–—]\s+|^\d+[.)]\s+/, ''));
}

/**
 * @param {string} text
 * @param {number} max
 */
function truncatePresentationText(text, max) {
    const trimmed = String(text ?? '').trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1)}…`;
}

/**
 * @param {unknown} value
 */
function isPlainObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}
