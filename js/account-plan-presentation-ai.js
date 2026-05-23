/**
 * AI-synthesized presentation highlight reel for exec deck export.
 */

import { normalizePlan } from './account-plan-data.js';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @returns {Promise<import('./account-plan-presentation-types.js').PresentationHighlight>}
 */
export async function fetchPresentationHighlight(supabase, plan, account) {
    const normalized = normalizePlan(plan);
    const accountName = account?.name ? String(account.name) : 'Account';

    const { data, error } = await supabase.functions.invoke('generate-presentation-highlight', {
        body: {
            plan: normalized,
            accountName,
        },
    });

    if (error) {
        throw new Error(error.message || 'Presentation synthesis failed.');
    }
    if (data?.error) {
        throw new Error(String(data.error));
    }

    return normalizePresentationHighlight(data?.highlight, {
        accountName,
        generatedAt: data?.generated_at ?? new Date().toISOString(),
        model: data?.model ?? null,
        plan,
    });
}

/**
 * @param {unknown} raw
 * @param {{ accountName: string, generatedAt: string, model: string | null, plan: unknown }} meta
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
                    headline: pickText(psychology.headline, 'Enterprise Gravity'),
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
    const momentum = isPlainObject(sections.relationship_momentum) ? sections.relationship_momentum : {};
    const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};

    return {
        sections,
        momentumNarrative: String(momentum.narrative ?? '').trim(),
        plan306090,
        timelineNotes: getExportSignals(sections).slice(0, 3),
    };
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
    const pain = isPlainObject(sections.pain_signals) ? sections.pain_signals : {};
    const selected = Array.isArray(pain.selected) ? pain.selected : [];
    const pills = selected.map((pill) => String(pill ?? '').trim()).filter(Boolean);
    const notes = String(pain.notes ?? '').trim();
    const bullets = [...pills];
    if (notes) bullets.push(truncatePresentationText(notes, 90));
    return bullets.slice(0, 3);
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackCriticalUnknownBullets(sections) {
    const unknowns = isPlainObject(sections.critical_unknowns) ? sections.critical_unknowns : {};
    const pills = Array.isArray(unknowns.executive_language_pills)
        ? unknowns.executive_language_pills
        : [];
    const lines = extractBulletLines(unknowns.unknowns);
    const bullets = [
        ...lines,
        ...pills.map((pill) => String(pill ?? '').trim()).filter(Boolean),
        String(unknowns.executive_language_notes ?? '').trim(),
    ]
        .map((line) => String(line).trim())
        .filter(Boolean)
        .slice(0, 3);
    return bullets;
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackPursuitBullets(sections) {
    const thesis = isPlainObject(sections.pursuit_thesis) ? sections.pursuit_thesis : {};
    return [
        thesis.core,
        thesis.why_account_matters,
        thesis.cost_of_standing_still,
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
    return [
        competitive.incumbents,
        pills.length ? `Positioning: ${pills.join(', ')}` : '',
        competitive.narrative,
    ]
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
        .slice(0, 4);
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackWhiteSpaceHook(sections) {
    const rows = Array.isArray(sections.white_space) ? sections.white_space.filter(isPlainObject) : [];
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

    if (!top) {
        return { headline: 'Top White Space', opportunity: '' };
    }

    return {
        headline: String(top.row.area ?? 'Top White Space').trim() || 'Top White Space',
        opportunity: truncatePresentationText(String(top.row.opportunity ?? '').trim(), 120),
    };
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
function fallbackEntrenchmentMoat(sections) {
    const entrenchment = isPlainObject(sections.entrenchment) ? sections.entrenchment : {};
    const pills = Array.isArray(entrenchment.moat_pills) ? entrenchment.moat_pills : [];
    const pillText = pills.map((pill) => String(pill ?? '').trim()).filter(Boolean).join(', ');
    const narrative = String(entrenchment.difficult_to_remove ?? '').trim();
    const combined = [pillText, narrative].filter(Boolean).join(' — ');
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
    return {
        headline: pickText(raw.headline, defaultHeadline),
        bullets: pickBullets(raw.bullets, 3, fallbackBullets),
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

    if (fromAi.length > 0) return fromAi.slice(0, 2);

    const points = Array.isArray(sections.entry_points) ? sections.entry_points : [];
    return points
        .filter((p) => isPlainObject(p) && String(p.contact_name ?? '').trim())
        .slice(0, 2)
        .map((p) => ({
            name: String(p.contact_name).trim(),
            headline: String(p.why_they_matter ?? p.likely_pressure ?? 'Key influencer').trim().slice(0, 80),
            hook: String(p.next_move ?? p.narrative_openings ?? '').trim().slice(0, 100),
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
