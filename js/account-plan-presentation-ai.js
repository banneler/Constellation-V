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
    const momentum = isPlainObject(situation.momentum) ? situation.momentum : {};
    const psychology = isPlainObject(situation.psychology) ? situation.psychology : {};
    const competitive = isPlainObject(battlefield.competitive) ? battlefield.competitive : {};
    const influence = isPlainObject(battlefield.influence) ? battlefield.influence : {};

    const ctx = resolvePlanContext(meta.plan);

    return {
        generated_at: meta.generatedAt,
        model: meta.model,
        account_name: meta.accountName,
        slides: {
            situation: {
                headline: pickText(situation.headline, `${meta.accountName}: Strategic Pursuit Brief`),
                subheadline: pickText(situation.subheadline, ''),
                pursuit_thesis: {
                    headline: pickText(pursuit.headline, 'Why This Account Matters Now'),
                    bullets: pickBullets(pursuit.bullets, 4, fallbackPursuitBullets(ctx.sections)),
                },
                momentum: {
                    insight: pickText(
                        momentum.insight,
                        ctx.momentumNarrative || 'Relationship momentum is developing — validate executive access path.'
                    ),
                },
                psychology: {
                    headline: pickText(psychology.headline, 'Enterprise Gravity'),
                    callouts: pickCallouts(psychology.callouts, 3),
                },
            },
            battlefield: {
                headline: pickText(battlefield.headline, 'Competitive & Political Battlefield'),
                competitive: {
                    headline: pickText(competitive.headline, 'Competitive Landscape'),
                    bullets: pickBullets(competitive.bullets, 4, ['Map incumbent entrenchment', 'Define narrative differentiation']),
                },
                influence: {
                    executive_hook: pickText(influence.executive_hook, 'Executive access path is the gating factor'),
                    champions_hook: pickText(influence.champions_hook, 'Mid-level champions can compound operational trust'),
                },
                entry_points: pickEntryPoints(battlefield.entry_points, ctx.sections),
            },
            execution: {
                headline: pickText(execution.headline, '90-Day Pursuit Cadence'),
                plan_30: normalizePlanHorizon(execution.plan_30, 'Next 30 Days', ctx.plan306090.days_30),
                plan_60: normalizePlanHorizon(execution.plan_60, 'Day 31–60', ctx.plan306090.days_60),
                plan_90: normalizePlanHorizon(execution.plan_90, 'Day 61–90', ctx.plan306090.days_90),
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
    const notes = Array.isArray(sections.momentum_notes) ? sections.momentum_notes : [];

    return {
        sections,
        momentumNarrative: String(momentum.narrative ?? '').trim(),
        plan306090,
        timelineNotes: notes
            .filter((n) => isPlainObject(n) && String(n.text ?? '').trim())
            .sort((a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime())
            .slice(0, 3),
    };
}

/**
 * @param {Record<string, unknown>} sections
 */
function fallbackPursuitBullets(sections) {
    const thesis = isPlainObject(sections.pursuit_thesis) ? sections.pursuit_thesis : {};
    return [
        thesis.core,
        thesis.cost_of_standing_still,
        thesis.timing,
    ]
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
        .slice(0, 3);
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
 */
function pickCallouts(raw, max) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((item) => isPlainObject(item))
        .map((item) => ({
            label: pickText(item.label, 'Dynamic'),
            insight: pickText(item.insight, '—'),
        }))
        .filter((item) => item.insight !== '—')
        .slice(0, max);
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
            hook: String(p.most_strategic_next_move ?? p.useful_narrative_openings ?? '').trim().slice(0, 100),
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
 * @param {unknown} value
 */
function isPlainObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}
