/**
 * Strategic Account OS — native PowerPoint export (PptxGenJS).
 *
 * Produces a 5-slide "Strategic Deal Review" deck on a strict 16:9 dark
 * canvas, using explicit `x / y / w / h` geometry on every `addText`,
 * `addShape`, and `addTable` call. There is intentionally NO reliance on
 * pptxgenjs auto-sizing — the slide master is a rigid coordinate grid so
 * verbose AI synthesis output wraps gracefully inside its designated
 * cell rather than reflowing into a neighbour panel.
 *
 * Slide ordering (Task 2):
 *   1. Executive Summary             — Pursuit Thesis (60%) + Momentum KPI (35%)
 *   2. Psychology & Strategic Tensions — 5 horizontal track bars + tension badges
 *   3. The Battlefield               — Competitive narrative + The Blindspots
 *   4. Strategic Entry Points        — Up to 2 target profiles per slide
 *   5. Execution Roadmap             — 30/60/90 table + Strategic Signals
 *
 * Data sourcing strategy: every slide renderer prefers the AI-synthesized
 * `presentationHighlight` payload (richer, prose-tightened), and falls
 * back to the raw normalized plan sections so reps can still export a
 * coherent deck before the AI engine has run. The fallback chains are
 * documented at each call site.
 *
 * See PRD: account-plan-presentation-types.js for the highlight schema.
 */

import { GPC_BRAND, formatGpcFooterDate } from './account-plan-export-brand.js';
import { normalizePlan } from './account-plan-data.js';
import { normalizePresentationHighlight } from './account-plan-presentation-ai.js';
import { MOMENTUM_LABELS } from './account-plan-presentation-types.js';
import { PSYCHOLOGY_SLIDERS } from './account-plan-sections.js';

// ---------------------------------------------------------------------------
// SLIDE GEOMETRY (16:9 — 13.333" × 7.5")
// ---------------------------------------------------------------------------
// All `x / y / w / h` numbers below are in inches. We define a rigid header
// band, a content body band, and a footer band; every slide renderer then
// carves its body region into sub-rectangles using these constants so the
// math stays consistent across slides.
// ---------------------------------------------------------------------------
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN_X = 0.55;

// Header band: small running label + large slide-specific title + accent rule.
const HEADER_RUNNER_Y = 0.30;
const HEADER_TITLE_Y = 0.55;
const HEADER_DIVIDER_Y = 1.00;

// Footer band: page number + confidentiality kicker.
const FOOTER_TOP = 7.05;

// Content body — every slide gets the same 5.95" tall × 12.233" wide canvas.
const BODY_TOP = 1.15;
const BODY_BOTTOM = FOOTER_TOP - 0.05;
const BODY_H = BODY_BOTTOM - BODY_TOP; // 5.85
const BODY_W = SLIDE_W - MARGIN_X * 2; // 12.233

// Inter-column / inter-row gap. Used throughout so spacing stays uniform.
const GAP = 0.22;

// ---------------------------------------------------------------------------
// THEME (Task 1 — dark slate, Arial sans, blue accent)
// ---------------------------------------------------------------------------
// pptxgenjs strips the leading "#" off color strings; we store hex without
// it so values can be passed straight to fill/line/color options.
// ---------------------------------------------------------------------------
const THEME = Object.freeze({
    bg: '0F172A',          // slate-900 — solid dark background per spec
    primary: 'F8FAFC',     // slate-50 — primary text
    secondary: '94A3B8',   // slate-400 — secondary/subtitle text
    accent: '3B82F6',      // blue-500 — KPI accent + dividers
    accentSoft: '1E3A8A',  // blue-900 — soft accent fill (table headers)
    panelFill: '1E293B',   // slate-800 — panel/card surface
    panelBorder: '334155', // slate-700 — panel borders + track outline
    trackBg: '1E293B',     // slider track background
    warn: 'F59E0B',        // amber — used for "low" indicator on inverse sliders
    success: '22C55E',     // green — used for "high" on direct sliders
    font: 'Arial',
});

// Tension badges cycle this palette so adjacent badges look distinct and
// the bottom of slide 2 reads as a visual "rainbow" of contradictions.
// Order chosen so common selections (Cloud / Control, Cost / Agility) land
// on contrasting hues — never two adjacent blues.
const TENSION_BADGE_PALETTE = Object.freeze([
    '3B82F6', // blue
    '14B8A6', // teal
    'F59E0B', // amber
    'EC4899', // pink
    'A855F7', // purple
    '22C55E', // green
    '06B6D4', // cyan
    'EF4444', // red
]);

const MAX_PROFILES_PER_SLIDE = 2; // Task 2.4 — per spec, mirrors PDF dossier.
const MAX_BLINDSPOTS = 8;          // Defensive cap so the list never spills.
const MAX_SIGNALS = 5;             // Bottom-half of slide 5 has limited height.
const MAX_PLAN_BULLETS = 4;        // Per 30/60/90 column; the table is fixed.

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight | null} [presentationHighlight]
 * @returns {Promise<{ bytes: Uint8Array, filename: string }>}
 */
export async function generateExecPresentationPptx(plan, account, presentationHighlight = null) {
    const PptxGenJS = getPptxGen();
    const accountName = account?.name ? String(account.name) : 'Account';

    // The AI-synthesized highlight is preferred (slot-shaped + length-tightened).
    // If it's absent, we synthesize a "fallback highlight" off the raw plan so
    // every code path below can assume the highlight shape exists.
    const highlight = presentationHighlight ?? normalizePresentationHighlight(null, {
        accountName,
        generatedAt: new Date().toISOString(),
        model: null,
        plan,
    });

    // Raw, normalized plan — used as a secondary source for fields the AI
    // schema does not synthesize verbatim (psychology slider integers,
    // strategic_tensions pill array, blindspots checklist, raw entry
    // point profiles with human_context).
    const ctx = resolvePptxPlanContext(plan);

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';   // pptxgenjs preset for 16:9 / 13.333×7.5.
    pptx.author = GPC_BRAND.companyName;
    pptx.subject = `${accountName} Strategic Deal Review`;
    pptx.title = `${accountName} — Strategic Deal Review`;

    // Pre-compute how many slides we are going to emit so the page-number
    // chrome ("3 / 6") can render the correct denominator on each slide.
    // Slides 1, 2, 3, 5 are always single-slide. Slide 4 (Entry Points)
    // paginates when there are more than 2 profiles.
    const entryProfiles = collectEntryProfiles(ctx, highlight);
    const profileSlideCount = Math.max(1, Math.ceil(entryProfiles.length / MAX_PROFILES_PER_SLIDE) || 1);
    const totalSlides = 4 + profileSlideCount;

    let pageNum = 1;
    buildExecutiveSummarySlide(pptx, accountName, highlight, ctx, pageNum++, totalSlides);
    buildPsychologyTensionsSlide(pptx, accountName, ctx, pageNum++, totalSlides);
    buildBattlefieldSlide(pptx, accountName, highlight, ctx, pageNum++, totalSlides);

    // Slide 4 may emit multiple slides; bump pageNum for each.
    for (let i = 0; i < profileSlideCount; i += 1) {
        const profilesForSlide = entryProfiles.slice(
            i * MAX_PROFILES_PER_SLIDE,
            (i + 1) * MAX_PROFILES_PER_SLIDE
        );
        buildEntryPointsSlide(
            pptx,
            accountName,
            profilesForSlide,
            { index: i + 1, total: profileSlideCount },
            pageNum++,
            totalSlides
        );
    }

    buildExecutionRoadmapSlide(pptx, accountName, highlight, ctx, pageNum++, totalSlides);

    const arrayBuffer = await pptx.write({ outputType: 'arraybuffer' });
    return {
        bytes: new Uint8Array(arrayBuffer),
        filename: buildPptxFilename(account),
    };
}

// ---------------------------------------------------------------------------
// Plan context resolution
// ---------------------------------------------------------------------------

/**
 * Normalize the plan once and return the slim subset of raw data each
 * slide renderer will need. Keeping this in one place means we do not
 * re-run `normalizePlan` per slide (which is expensive on large plans).
 *
 * @param {unknown} plan
 */
function resolvePptxPlanContext(plan) {
    const normalized = normalizePlan(plan);
    const sections = normalized.current_draft.sections;

    const momentum = isPlainObject(sections.relationship_momentum)
        ? sections.relationship_momentum
        : {};
    const score = clampScale(momentum.score, 3);

    const psychology = isPlainObject(sections.psychology) ? sections.psychology : {};
    const tensions = isPlainObject(sections.strategic_tensions) ? sections.strategic_tensions : {};
    const competitive = isPlainObject(sections.competitive_landscape) ? sections.competitive_landscape : {};
    const pursuit = isPlainObject(sections.pursuit_thesis) ? sections.pursuit_thesis : {};
    const blindspots = isPlainObject(sections.critical_unknowns) ? sections.critical_unknowns : {};
    const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};

    return {
        score,
        momentumNarrative: String(momentum.narrative ?? '').trim(),
        psychology,
        tensionPills: Array.isArray(tensions.selected_pills)
            ? tensions.selected_pills.map((p) => String(p ?? '').trim()).filter(Boolean)
            : [],
        tensionNarrative: String(tensions.narrative ?? '').trim(),
        competitive,
        pursuit,
        // Task 3 (data) — "The Blindspots". The data layer guarantees this
        // is a string[] under sections.critical_unknowns.blindspots after
        // normalizePlan runs. We cap defensively for slide overflow.
        blindspots: Array.isArray(blindspots.blindspots)
            ? blindspots.blindspots
                .map((b) => String(b ?? '').trim())
                .filter(Boolean)
                .slice(0, MAX_BLINDSPOTS)
            : [],
        plan306090: {
            days_30: String(plan306090.days_30 ?? '').trim(),
            days_60: String(plan306090.days_60 ?? '').trim(),
            days_90: String(plan306090.days_90 ?? '').trim(),
        },
        rawEntryPoints: Array.isArray(sections.entry_points) ? sections.entry_points : [],
    };
}

/**
 * Compose the slide-4 profile list. The AI presentation engine emits a
 * tighter 2-field shape per profile (name + hook) but does NOT carry
 * `human_context` — which slide 4 needs per the Task 2.4 spec — so we
 * source the raw entry points directly. AI badges are still useful as
 * a tag row, so we look them up by contact name when available.
 *
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 */
function collectEntryProfiles(ctx, highlight) {
    const aiByName = new Map();
    (highlight.slides.battlefield.entry_points || []).forEach((entry) => {
        if (entry && entry.name) {
            aiByName.set(String(entry.name).trim().toLowerCase(), entry);
        }
    });

    return ctx.rawEntryPoints
        .filter(isPlainObject)
        .map((point) => {
            const name = String(point.contact_name ?? '').trim();
            if (!name) return null;
            const aiMatch = aiByName.get(name.toLowerCase());
            return {
                name,
                operational_pain: String(point.operational_pain ?? '').trim(),
                conversation_wedge: String(point.conversation_wedge ?? '').trim(),
                human_context: String(point.human_context ?? '').trim(),
                badges: aiMatch ? String(aiMatch.badges ?? '').trim() : '',
            };
        })
        .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Slide 1 — Executive Summary
// ---------------------------------------------------------------------------
// Geometry:
//   • Left column  (Pursuit Thesis) — 60% of BODY_W
//   • Right column (Momentum KPI)  — 35% of BODY_W
//   • The remaining 5% is the inter-column gutter, intentionally larger
//     than the standard GAP because the right-hand KPI needs visual
//     isolation from the left-hand prose.
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {string} accountName
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildExecutiveSummarySlide(pptx, accountName, highlight, ctx, pageNum, totalSlides) {
    const slide = pptx.addSlide();
    addSlideBackground(slide);
    addSlideChrome(slide, {
        accountName,
        slideTitle: 'Executive Summary',
        pageNum,
        totalSlides,
    });

    // Column math.
    const leftW = BODY_W * 0.60;                            // 7.34"
    const rightW = BODY_W * 0.35;                           // 4.28"
    const gutter = BODY_W - leftW - rightW;                 // 5% of BODY_W
    const rightX = MARGIN_X + leftW + gutter;

    // -----------------------------------------------------------------
    // LEFT COLUMN — Pursuit Thesis prose
    // -----------------------------------------------------------------
    // Section kicker (small uppercase label) → headline → body prose.
    // The body uses fontSize 16 + lineSpacing 24 per Task 2.1 spec; that
    // pairs to a ~24/16 = 1.5x leading which is consultancy-deck
    // standard for executive-readable prose.
    // -----------------------------------------------------------------
    const pursuitHeadline = String(highlight.slides.situation?.pursuit_thesis?.headline ?? '').trim()
        || 'Pursuit Thesis';
    const pursuitProse = resolvePursuitThesisProse(highlight, ctx);

    addPanel(slide, MARGIN_X, BODY_TOP, leftW, BODY_H);
    addKicker(slide, 'PURSUIT THESIS', MARGIN_X + 0.25, BODY_TOP + 0.20, leftW - 0.5);
    addHeadline(slide, pursuitHeadline, MARGIN_X + 0.25, BODY_TOP + 0.42, leftW - 0.5, 0.55);

    // The prose textbox is the largest single rectangle on the deck —
    // we hold it to the panel interior with a 0.25" inset on all sides
    // and explicitly set valign:'top' so short answers do not center.
    slide.addText(pursuitProse || 'No pursuit thesis captured yet.', {
        x: MARGIN_X + 0.25,
        y: BODY_TOP + 1.05,
        w: leftW - 0.5,
        h: BODY_H - 1.25,
        fontSize: 16,
        lineSpacing: 24,    // Task 2.1 — explicit per spec.
        color: THEME.primary,
        fontFace: THEME.font,
        valign: 'top',
        align: 'left',
        margin: 0,
        breakLine: true,    // Task 3 — defensive; prose hard-wraps inside the box.
        autoFit: false,     // Never let pptxgenjs shrink the typography on us.
    });

    // -----------------------------------------------------------------
    // RIGHT COLUMN — Momentum KPI
    // -----------------------------------------------------------------
    // Layout inside the right panel:
    //   • Kicker  (top)
    //   • Score   (giant 72pt centered) — Task 2.1 explicit
    //   • Qualitative label ("Champion", "Cooling", …) below
    //   • Optional narrative paragraph at the bottom
    // -----------------------------------------------------------------
    addPanel(slide, rightX, BODY_TOP, rightW, BODY_H);
    addKicker(slide, 'RELATIONSHIP MOMENTUM', rightX + 0.25, BODY_TOP + 0.20, rightW - 0.5);

    const kpiScoreY = BODY_TOP + 0.75;
    const kpiScoreH = 1.85;
    slide.addText(String(ctx.score), {
        x: rightX,
        y: kpiScoreY,
        w: rightW,
        h: kpiScoreH,
        align: 'center',
        valign: 'middle',
        fontSize: 72,                // Task 2.1 — explicit per spec.
        bold: true,
        color: THEME.accent,         // #3b82f6 per spec.
        fontFace: THEME.font,
        margin: 0,
        autoFit: false,
    });
    slide.addText(MOMENTUM_LABELS[ctx.score - 1].toUpperCase(), {
        x: rightX + 0.25,
        y: kpiScoreY + kpiScoreH + 0.05,
        w: rightW - 0.5,
        h: 0.32,
        align: 'center',
        fontSize: 13,
        bold: true,
        color: THEME.primary,
        fontFace: THEME.font,
        charSpacing: 2,
        margin: 0,
        autoFit: false,
    });

    // Accent divider between the KPI and the optional narrative.
    slide.addShape('line', {
        x: rightX + 0.50,
        y: kpiScoreY + kpiScoreH + 0.55,
        w: rightW - 1.00,
        h: 0,
        line: { color: THEME.accent, width: 0.75 },
    });

    // Narrative block — short paragraph that explains the score.
    const narrative = ctx.momentumNarrative
        || String(highlight.slides.situation?.momentum?.insight ?? '').trim();
    if (narrative) {
        slide.addText(truncate(narrative, 320), {
            x: rightX + 0.25,
            y: kpiScoreY + kpiScoreH + 0.70,
            w: rightW - 0.5,
            h: BODY_H - (kpiScoreY + kpiScoreH + 0.70 - BODY_TOP) - 0.25,
            fontSize: 11,
            lineSpacing: 17,
            color: THEME.secondary,
            fontFace: THEME.font,
            valign: 'top',
            align: 'left',
            margin: 0,
            breakLine: true,
            autoFit: false,
        });
    }
}

/**
 * Resolve the Pursuit Thesis prose body for slide 1. We prefer the AI's
 * synthesized bullet stream (joined with line breaks) because it has
 * already been length-tightened, and fall back to the raw consolidated
 * `pursuit_thesis.thesis` field (post-Task-2 schema) and finally to a
 * concatenation of legacy split fields so half-migrated plans still
 * surface something readable.
 *
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 */
function resolvePursuitThesisProse(highlight, ctx) {
    const aiBullets = Array.isArray(highlight.slides.situation?.pursuit_thesis?.bullets)
        ? highlight.slides.situation.pursuit_thesis.bullets.map((b) => String(b ?? '').trim()).filter(Boolean)
        : [];
    if (aiBullets.length > 0) {
        return aiBullets.join('\n\n');
    }

    const rawThesis = String(ctx.pursuit.thesis ?? '').trim();
    if (rawThesis) return rawThesis;

    // Legacy fallback — half-migrated plans may still hold split fields.
    const legacyParts = [ctx.pursuit.core, ctx.pursuit.cost_of_standing_still]
        .map((v) => String(v ?? '').trim())
        .filter(Boolean);
    return legacyParts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Slide 2 — Psychology & Strategic Tensions
// ---------------------------------------------------------------------------
// Top half (BODY_H * 0.50): Account Psychology — 5 horizontal track bars
// Bottom half (BODY_H * 0.50): Strategic Tensions — colored badges
// A faint divider line sits at the half-mark to reinforce the structural split.
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {string} accountName
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildPsychologyTensionsSlide(pptx, accountName, ctx, pageNum, totalSlides) {
    const slide = pptx.addSlide();
    addSlideBackground(slide);
    addSlideChrome(slide, {
        accountName,
        slideTitle: 'Psychology & Strategic Tensions',
        pageNum,
        totalSlides,
    });

    const halfH = (BODY_H - GAP) / 2;
    const topY = BODY_TOP;
    const bottomY = BODY_TOP + halfH + GAP;

    // -----------------------------------------------------------------
    // TOP HALF — Psychology track bars
    // -----------------------------------------------------------------
    addPanel(slide, MARGIN_X, topY, BODY_W, halfH);
    addKicker(slide, 'ACCOUNT PSYCHOLOGY', MARGIN_X + 0.30, topY + 0.18, BODY_W - 0.6);

    // Track grid math. PSYCHOLOGY_SLIDERS has 5 entries → 5 rows.
    // We carve the panel interior (less top kicker band ~0.6") into 5
    // equal row strips.
    const trackTop = topY + 0.65;
    const trackArea = halfH - 0.85;
    const rowH = trackArea / PSYCHOLOGY_SLIDERS.length;

    // Per-row sub-geometry (relative to MARGIN_X / BODY_W):
    //   labelW = 2.6"  (slider name, primary text)
    //   trackX = labelEnd + 0.20
    //   trackW spans to the value indicator column (right-most 0.55")
    //   valueW = 0.55" (right-aligned bold accent integer)
    const labelW = 2.60;
    const valueW = 0.55;
    const trackPadL = 0.30;
    const trackPadR = 0.30;
    const labelX = MARGIN_X + 0.30;
    const trackX = labelX + labelW + 0.20;
    const valueX = MARGIN_X + BODY_W - 0.30 - valueW;
    const trackW = valueX - trackX - trackPadR;
    const trackBarH = 0.18;

    PSYCHOLOGY_SLIDERS.forEach((slider, index) => {
        const rowY = trackTop + index * rowH;
        const value = clampScale(ctx.psychology[slider.id], 3);

        // Slider label — slider.label is e.g. "Bureaucracy Level".
        slide.addText(slider.label, {
            x: labelX,
            y: rowY,
            w: labelW,
            h: rowH,
            fontSize: 11,
            bold: true,
            color: THEME.primary,
            fontFace: THEME.font,
            valign: 'middle',
            margin: 0,
            autoFit: false,
        });

        // Track background — full-length dark rectangle. Vertically
        // centered inside the row strip.
        const trackY = rowY + (rowH - trackBarH) / 2;
        slide.addShape('rect', {
            x: trackX,
            y: trackY,
            w: trackW,
            h: trackBarH,
            fill: { color: THEME.trackBg },
            line: { color: THEME.panelBorder, width: 0.75 },
        });

        // Track fill — width proportional to value/5. Color is the
        // accent blue by default; on 'inverse' sliders (bureaucracy)
        // a value of 5 is bad, so we shade red instead to give the
        // exec a visual hazard cue without extra prose.
        const fillW = trackW * (value / 5);
        const fillColor = slider.colorScale === 'inverse' && value >= 4
            ? 'EF4444'                          // red-500 — high bureaucracy is hazardous
            : slider.colorScale === 'direct' && value >= 4
                ? THEME.success                 // green — bold/healthy
                : THEME.accent;                 // default accent
        slide.addShape('rect', {
            x: trackX,
            y: trackY,
            w: fillW,
            h: trackBarH,
            fill: { color: fillColor },
            line: { color: fillColor, width: 0.5 },
        });

        // 1–5 tick separators — 4 thin vertical lines dividing the track
        // into 5 equal segments. Reinforces the 1-5 scale visually.
        for (let tick = 1; tick <= 4; tick += 1) {
            const tickX = trackX + trackW * (tick / 5);
            slide.addShape('line', {
                x: tickX,
                y: trackY + 0.02,
                w: 0,
                h: trackBarH - 0.04,
                line: { color: THEME.bg, width: 0.5 },
            });
        }

        // Low / high scale captions under the track (tiny, secondary).
        slide.addText(slider.lowLabel, {
            x: trackX,
            y: trackY + trackBarH + 0.02,
            w: trackW / 2,
            h: 0.16,
            fontSize: 7,
            color: THEME.secondary,
            fontFace: THEME.font,
            align: 'left',
            margin: 0,
            autoFit: false,
        });
        slide.addText(slider.highLabel, {
            x: trackX + trackW / 2,
            y: trackY + trackBarH + 0.02,
            w: trackW / 2,
            h: 0.16,
            fontSize: 7,
            color: THEME.secondary,
            fontFace: THEME.font,
            align: 'right',
            margin: 0,
            autoFit: false,
        });

        // Value indicator — bold integer on the right, accent-colored.
        slide.addText(`${value} / 5`, {
            x: valueX,
            y: rowY,
            w: valueW,
            h: rowH,
            fontSize: 14,
            bold: true,
            color: THEME.accent,
            fontFace: THEME.font,
            align: 'right',
            valign: 'middle',
            margin: 0,
            autoFit: false,
        });
    });

    // -----------------------------------------------------------------
    // BOTTOM HALF — Strategic Tensions badges
    // -----------------------------------------------------------------
    addPanel(slide, MARGIN_X, bottomY, BODY_W, halfH);
    addKicker(slide, 'STRATEGIC TENSIONS', MARGIN_X + 0.30, bottomY + 0.18, BODY_W - 0.6);

    if (ctx.tensionPills.length === 0) {
        slide.addText('No strategic tensions captured yet — open the Strategic Tensions section in the plan canvas.', {
            x: MARGIN_X + 0.30,
            y: bottomY + 0.70,
            w: BODY_W - 0.60,
            h: 0.5,
            fontSize: 12,
            italic: true,
            color: THEME.secondary,
            fontFace: THEME.font,
            valign: 'top',
            margin: 0,
            autoFit: false,
        });
        return;
    }

    // Badge grid math. Each badge is a fixed-width rounded rectangle;
    // we lay them out in a CSS-flex-like wrap row. 4 badges per row
    // gives a comfortable badge width on the 12.233" body.
    const badgesPerRow = 4;
    const badgeGap = 0.20;
    const badgeRowGap = 0.18;
    const badgeAreaW = BODY_W - 0.60;
    const badgeW = (badgeAreaW - badgeGap * (badgesPerRow - 1)) / badgesPerRow;
    const badgeH = 0.55;
    const badgeStartY = bottomY + 0.65;

    ctx.tensionPills.slice(0, badgesPerRow * 4).forEach((pill, index) => {
        const row = Math.floor(index / badgesPerRow);
        const col = index % badgesPerRow;
        const bx = MARGIN_X + 0.30 + col * (badgeW + badgeGap);
        const by = badgeStartY + row * (badgeH + badgeRowGap);
        const fillColor = TENSION_BADGE_PALETTE[index % TENSION_BADGE_PALETTE.length];
        slide.addShape('roundRect', {
            x: bx,
            y: by,
            w: badgeW,
            h: badgeH,
            fill: { color: fillColor },
            line: { color: fillColor, width: 0 },
            rectRadius: 0.10,
        });
        slide.addText(pill, {
            x: bx + 0.12,
            y: by,
            w: badgeW - 0.24,
            h: badgeH,
            fontSize: 12,
            bold: true,
            color: THEME.primary,
            fontFace: THEME.font,
            align: 'center',
            valign: 'middle',
            margin: 0,
            autoFit: false,
        });
    });

    // Optional narrative beneath the badges if the rep wrote one.
    if (ctx.tensionNarrative) {
        // Compute how many badge rows are visible so the narrative slots
        // beneath them rather than colliding.
        const usedRows = Math.min(4, Math.ceil(ctx.tensionPills.length / badgesPerRow));
        const narrativeY = badgeStartY + usedRows * (badgeH + badgeRowGap) + 0.05;
        const narrativeMaxH = bottomY + halfH - narrativeY - 0.25;
        if (narrativeMaxH > 0.3) {
            slide.addText(truncate(ctx.tensionNarrative, 260), {
                x: MARGIN_X + 0.30,
                y: narrativeY,
                w: BODY_W - 0.60,
                h: narrativeMaxH,
                fontSize: 10,
                italic: true,
                color: THEME.secondary,
                fontFace: THEME.font,
                valign: 'top',
                margin: 0,
                breakLine: true,
                autoFit: false,
            });
        }
    }
}

// ---------------------------------------------------------------------------
// Slide 3 — The Battlefield
// ---------------------------------------------------------------------------
// Two equal-width columns:
//   • LEFT  — Competitive landscape narrative (prose + AI bullets)
//   • RIGHT — The Blindspots (native bulleted list)
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {string} accountName
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildBattlefieldSlide(pptx, accountName, highlight, ctx, pageNum, totalSlides) {
    const slide = pptx.addSlide();
    addSlideBackground(slide);
    addSlideChrome(slide, {
        accountName,
        slideTitle: 'The Battlefield',
        pageNum,
        totalSlides,
    });

    // Two equal columns split BODY_W minus a single GAP.
    const colW = (BODY_W - GAP) / 2;
    const leftX = MARGIN_X;
    const rightX = MARGIN_X + colW + GAP;

    // -----------------------------------------------------------------
    // LEFT — Competitive Landscape narrative
    // -----------------------------------------------------------------
    addPanel(slide, leftX, BODY_TOP, colW, BODY_H);
    addKicker(slide, 'COMPETITIVE LANDSCAPE', leftX + 0.25, BODY_TOP + 0.20, colW - 0.5);

    const competitiveHeadline = String(highlight.slides.battlefield?.competitive?.headline ?? '').trim()
        || 'Competitive Landscape';
    addHeadline(slide, competitiveHeadline, leftX + 0.25, BODY_TOP + 0.42, colW - 0.5, 0.55);

    // Prefer the AI's tightened bullets; fall back to raw narrative +
    // incumbents prose so unmigrated plans still render meaningful copy.
    const aiBullets = Array.isArray(highlight.slides.battlefield?.competitive?.bullets)
        ? highlight.slides.battlefield.competitive.bullets
            .map((b) => String(b ?? '').trim())
            .filter(Boolean)
        : [];
    const competitiveBullets = aiBullets.length > 0
        ? aiBullets
        : [
            String(ctx.competitive.incumbents ?? '').trim(),
            String(ctx.competitive.narrative ?? '').trim(),
        ].filter(Boolean);

    addNativeBulletList(slide, competitiveBullets, {
        x: leftX + 0.25,
        y: BODY_TOP + 1.05,
        w: colW - 0.5,
        h: BODY_H - 1.25,
        fontSize: 12,
        lineSpacing: 20,
        color: THEME.primary,
        bulletColor: THEME.accent,
        emptyText: 'No competitive landscape captured yet.',
    });

    // -----------------------------------------------------------------
    // RIGHT — The Blindspots
    // -----------------------------------------------------------------
    addPanel(slide, rightX, BODY_TOP, colW, BODY_H);
    addKicker(slide, 'THE BLINDSPOTS', rightX + 0.25, BODY_TOP + 0.20, colW - 0.5);
    addHeadline(slide, 'Questions we must answer next', rightX + 0.25, BODY_TOP + 0.42, colW - 0.5, 0.55);

    addNativeBulletList(slide, ctx.blindspots, {
        x: rightX + 0.25,
        y: BODY_TOP + 1.05,
        w: colW - 0.5,
        h: BODY_H - 1.25,
        fontSize: 13,           // slightly larger — punchy checklist feel
        lineSpacing: 22,
        color: THEME.primary,
        bulletColor: THEME.accent,
        emptyText: 'No discovery questions captured yet.',
    });
}

// ---------------------------------------------------------------------------
// Slide 4 — Strategic Entry Points (paginated, max 2 profiles/slide)
// ---------------------------------------------------------------------------
// Each profile takes half the body width when 2 are present, or full
// width when only one fits. Each profile card has a fixed sub-grid:
//   • Header strip — contact name, big and bold
//   • 3 row blocks — Operational Pain · Conversation Wedge · Human Context
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {string} accountName
 * @param {ReturnType<typeof collectEntryProfiles>} profiles
 * @param {{ index: number, total: number }} pagination
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildEntryPointsSlide(pptx, accountName, profiles, pagination, pageNum, totalSlides) {
    const slide = pptx.addSlide();
    addSlideBackground(slide);

    // If there are multiple pagination pages, suffix the title with
    // "(1 of 2)" so the audience knows there are sibling slides.
    const titleSuffix = pagination.total > 1 ? ` (${pagination.index} of ${pagination.total})` : '';
    addSlideChrome(slide, {
        accountName,
        slideTitle: `Strategic Entry Points${titleSuffix}`,
        pageNum,
        totalSlides,
    });

    if (profiles.length === 0) {
        slide.addText('No target profiles captured yet — open the Strategic Entry Points carousel in the plan canvas.', {
            x: MARGIN_X,
            y: BODY_TOP + 1.0,
            w: BODY_W,
            h: 0.6,
            fontSize: 14,
            italic: true,
            color: THEME.secondary,
            fontFace: THEME.font,
            align: 'center',
            valign: 'top',
            margin: 0,
            autoFit: false,
        });
        return;
    }

    // Column math — single column when only one profile, otherwise
    // split into two equal halves.
    const cardW = profiles.length === 1 ? BODY_W : (BODY_W - GAP) / 2;
    profiles.forEach((profile, index) => {
        const cardX = MARGIN_X + index * (cardW + GAP);
        renderEntryProfileCard(slide, profile, cardX, BODY_TOP, cardW, BODY_H);
    });
}

/**
 * Render a single Strategic Entry Point profile card. Sub-geometry:
 *   • Header strip  — top 0.85" of the card (name + tag/badge row)
 *   • Field grid    — remaining height divided into 3 equal blocks
 *                     for operational_pain / conversation_wedge /
 *                     human_context, each with its own kicker label
 *                     and body textarea.
 *
 * @param {import('pptxgenjs').Slide} slide
 * @param {ReturnType<typeof collectEntryProfiles>[number]} profile
 */
function renderEntryProfileCard(slide, profile, x, y, w, h) {
    addPanel(slide, x, y, w, h);

    // Header strip — bold contact name + optional badge row.
    const headerH = profile.badges ? 0.85 : 0.65;
    const innerPadX = 0.30;
    const innerW = w - innerPadX * 2;

    slide.addText(profile.name || 'Unnamed Contact', {
        x: x + innerPadX,
        y: y + 0.20,
        w: innerW,
        h: 0.45,
        fontSize: 18,
        bold: true,
        color: THEME.primary,
        fontFace: THEME.font,
        valign: 'middle',
        margin: 0,
        autoFit: false,
    });
    if (profile.badges) {
        slide.addText(profile.badges.toUpperCase(), {
            x: x + innerPadX,
            y: y + 0.62,
            w: innerW,
            h: 0.20,
            fontSize: 8.5,
            bold: true,
            color: THEME.secondary,
            fontFace: THEME.font,
            charSpacing: 1.5,
            valign: 'middle',
            margin: 0,
            autoFit: false,
        });
    }

    // Divider under the header strip — accent thin line.
    slide.addShape('line', {
        x: x + innerPadX,
        y: y + headerH,
        w: innerW,
        h: 0,
        line: { color: THEME.accent, width: 0.75 },
    });

    // Field grid — 3 equal-height blocks for the consolidated entry
    // point data fields (operational_pain, conversation_wedge,
    // human_context). Each block is internally split into a kicker
    // label (0.30") and a body textarea (remaining).
    const gridTop = y + headerH + 0.12;
    const gridH = h - headerH - 0.30;
    const blocks = [
        { label: 'OPERATIONAL PAIN', value: profile.operational_pain },
        { label: 'CONVERSATION WEDGE', value: profile.conversation_wedge },
        { label: 'HUMAN CONTEXT', value: profile.human_context },
    ];
    const blockH = gridH / blocks.length;
    blocks.forEach((block, index) => {
        const blockY = gridTop + index * blockH;

        // Kicker label (small uppercase secondary).
        slide.addText(block.label, {
            x: x + innerPadX,
            y: blockY,
            w: innerW,
            h: 0.22,
            fontSize: 8.5,
            bold: true,
            color: THEME.secondary,
            fontFace: THEME.font,
            charSpacing: 1.5,
            valign: 'middle',
            margin: 0,
            autoFit: false,
        });

        // Body textarea — primary color, valign:'top', conservative
        // fontSize so long answers wrap inside the block height.
        slide.addText(block.value || '—', {
            x: x + innerPadX,
            y: blockY + 0.24,
            w: innerW,
            h: blockH - 0.32,
            fontSize: 11,
            lineSpacing: 16,
            color: block.value ? THEME.primary : THEME.secondary,
            italic: !block.value,
            fontFace: THEME.font,
            valign: 'top',
            margin: 0,
            breakLine: true,
            autoFit: false,
        });
    });
}

// ---------------------------------------------------------------------------
// Slide 5 — Execution Roadmap
// ---------------------------------------------------------------------------
// Top half (60%): 30/60/90 plan rendered via addTable.
// Bottom half (40%): Strategic Signals as a bulleted list with date prefixes.
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {string} accountName
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildExecutionRoadmapSlide(pptx, accountName, highlight, ctx, pageNum, totalSlides) {
    const slide = pptx.addSlide();
    addSlideBackground(slide);
    addSlideChrome(slide, {
        accountName,
        slideTitle: 'Execution Roadmap',
        pageNum,
        totalSlides,
    });

    // Row split — give the table the larger half because each cell
    // needs space for multiple bullets.
    const topH = BODY_H * 0.58 - GAP / 2;
    const bottomH = BODY_H * 0.42 - GAP / 2;
    const topY = BODY_TOP;
    const bottomY = BODY_TOP + topH + GAP;

    // -----------------------------------------------------------------
    // TOP — 30 / 60 / 90 plan table
    // -----------------------------------------------------------------
    addPanel(slide, MARGIN_X, topY, BODY_W, topH);
    addKicker(slide, '30 / 60 / 90 PLAN', MARGIN_X + 0.30, topY + 0.18, BODY_W - 0.6);

    const horizons = [
        { period: 'NEXT 30 DAYS', block: highlight.slides.execution?.plan_30, fallback: ctx.plan306090.days_30 },
        { period: 'DAY 31–60',    block: highlight.slides.execution?.plan_60, fallback: ctx.plan306090.days_60 },
        { period: 'DAY 61–90',    block: highlight.slides.execution?.plan_90, fallback: ctx.plan306090.days_90 },
    ];

    // Compose cell text. Prefer AI bullets, fall back to splitting the
    // raw plan_30/60/90 text on newlines so older plans still produce
    // a 3-column table without an empty column.
    const cellRows = horizons.map((h) => composePlanCellLines(h.block, h.fallback));

    // Table geometry — 3 equal columns within the panel interior, with
    // a single header row (period) above the body row (bullets).
    const tableX = MARGIN_X + 0.25;
    const tableY = topY + 0.65;
    const tableW = BODY_W - 0.50;
    const tableH = topH - 0.85;
    const colW = tableW / 3;

    // Header row — uppercase period labels with accent fill.
    const headerRow = horizons.map((h) => ({
        text: h.period,
        options: {
            bold: true,
            color: THEME.primary,
            fill: { color: THEME.accent },
            align: 'center',
            valign: 'middle',
            fontSize: 11,
            fontFace: THEME.font,
            charSpacing: 1.5,
        },
    }));

    // Body row — each cell holds a small bulleted prose block. We pass
    // arrays of text-runs so each bullet break renders correctly inside
    // the cell without spilling.
    const bodyRow = cellRows.map((lines) => ({
        text: lines.length > 0
            ? lines.map((line, idx) => ({
                text: line,
                options: {
                    bullet: { code: '2022' },
                    breakLine: idx < lines.length - 1,
                    color: THEME.primary,
                    fontFace: THEME.font,
                    fontSize: 11,
                },
            }))
            : [{
                text: 'No actions captured yet.',
                options: { italic: true, color: THEME.secondary, fontFace: THEME.font, fontSize: 10 },
            }],
        options: {
            fill: { color: THEME.panelFill },
            valign: 'top',
            margin: 6,
        },
    }));

    slide.addTable([headerRow, bodyRow], {
        x: tableX,
        y: tableY,
        w: tableW,
        h: tableH,
        colW: [colW, colW, colW],
        rowH: [0.40, tableH - 0.40],
        border: { type: 'solid', color: THEME.panelBorder, pt: 0.75 },
        fontFace: THEME.font,
        autoPage: false,                  // Task 3 — never spill onto extra slides.
    });

    // -----------------------------------------------------------------
    // BOTTOM — Strategic Signals
    // -----------------------------------------------------------------
    addPanel(slide, MARGIN_X, bottomY, BODY_W, bottomH);
    addKicker(slide, 'STRATEGIC SIGNALS', MARGIN_X + 0.30, bottomY + 0.18, BODY_W - 0.6);

    const signals = Array.isArray(highlight.slides.execution?.signals)
        ? highlight.slides.execution.signals
            .filter((s) => s && String(s.headline ?? '').trim())
            .slice(0, MAX_SIGNALS)
        : [];

    if (signals.length === 0) {
        slide.addText('No recent strategic signals — log one from the Interaction Log to surface it here.', {
            x: MARGIN_X + 0.30,
            y: bottomY + 0.70,
            w: BODY_W - 0.60,
            h: 0.4,
            fontSize: 11,
            italic: true,
            color: THEME.secondary,
            fontFace: THEME.font,
            valign: 'top',
            margin: 0,
            autoFit: false,
        });
        return;
    }

    // Build a single bulleted text block where each bullet is composed
    // of two text-runs: a date kicker (accent bold) followed by the
    // signal headline (primary). This stays inside the bottom panel
    // height because we calibrate fontSize against MAX_SIGNALS.
    const runs = [];
    signals.forEach((signal, idx) => {
        const dateLabel = String(signal.date_label ?? '').trim();
        if (dateLabel) {
            runs.push({
                text: `${dateLabel.toUpperCase()}  `,
                options: {
                    bullet: { code: '2022' },
                    bold: true,
                    color: THEME.accent,
                    fontSize: 11,
                    fontFace: THEME.font,
                },
            });
            runs.push({
                text: String(signal.headline ?? '').trim(),
                options: {
                    breakLine: idx < signals.length - 1,
                    color: THEME.primary,
                    fontSize: 12,
                    fontFace: THEME.font,
                },
            });
        } else {
            runs.push({
                text: String(signal.headline ?? '').trim(),
                options: {
                    bullet: { code: '2022' },
                    breakLine: idx < signals.length - 1,
                    color: THEME.primary,
                    fontSize: 12,
                    fontFace: THEME.font,
                },
            });
        }
    });

    slide.addText(runs, {
        x: MARGIN_X + 0.30,
        y: bottomY + 0.65,
        w: BODY_W - 0.60,
        h: bottomH - 0.85,
        valign: 'top',
        lineSpacing: 22,
        margin: 0,
        autoFit: false,
    });
}

/**
 * Compose the cell-line array for one 30/60/90 column.
 *
 * @param {{ bullets?: string[] } | undefined | null} aiBlock
 * @param {string} rawText
 * @returns {string[]}
 */
function composePlanCellLines(aiBlock, rawText) {
    const aiBullets = Array.isArray(aiBlock?.bullets)
        ? aiBlock.bullets.map((b) => String(b ?? '').trim()).filter(Boolean)
        : [];
    if (aiBullets.length > 0) return aiBullets.slice(0, MAX_PLAN_BULLETS);

    // Split raw 30/60/90 prose on newlines OR markdown bullet prefixes.
    return String(rawText ?? '')
        .split(/\r?\n+/)
        .map((line) => line.replace(/^[\s]*(?:[-*•]\s+|\d+[.)]\s+)/, '').trim())
        .filter(Boolean)
        .slice(0, MAX_PLAN_BULLETS);
}

// ---------------------------------------------------------------------------
// Shared slide chrome (header + footer)
// ---------------------------------------------------------------------------

/**
 * Solid dark background per Task 1.
 *
 * @param {import('pptxgenjs').Slide} slide
 */
function addSlideBackground(slide) {
    slide.background = { color: THEME.bg };
}

/**
 * Header (small runner, large slide title, accent rule) + footer
 * (running label per Task 1 + page number). Applied to every slide so
 * the deck reads as one master-themed document.
 *
 * @param {import('pptxgenjs').Slide} slide
 * @param {{ accountName: string, slideTitle: string, pageNum: number, totalSlides: number }} chrome
 */
function addSlideChrome(slide, chrome) {
    // Small uppercase runner — "[ACCOUNT] | STRATEGIC DEAL REVIEW".
    // This is the unified "running header" per Task 1; it appears on
    // every slide and stays in the secondary color so it never
    // competes with the slide title below it.
    slide.addText(`${chrome.accountName.toUpperCase()} | STRATEGIC DEAL REVIEW`, {
        x: MARGIN_X,
        y: HEADER_RUNNER_Y,
        w: BODY_W,
        h: 0.20,
        fontSize: 9,
        bold: true,
        color: THEME.secondary,
        fontFace: THEME.font,
        charSpacing: 2,
        align: 'left',
        margin: 0,
        autoFit: false,
    });

    // Slide-specific title — large primary text.
    slide.addText(chrome.slideTitle, {
        x: MARGIN_X,
        y: HEADER_TITLE_Y,
        w: BODY_W,
        h: 0.40,
        fontSize: 24,
        bold: true,
        color: THEME.primary,
        fontFace: THEME.font,
        valign: 'middle',
        margin: 0,
        autoFit: false,
    });

    // Accent divider directly below the title — visual seam between
    // header band and body content.
    slide.addShape('line', {
        x: MARGIN_X,
        y: HEADER_DIVIDER_Y,
        w: BODY_W,
        h: 0,
        line: { color: THEME.accent, width: 1.25 },
    });

    // Footer — confidentiality kicker on the left, page number on
    // the right. Right-aligned date kept off the footer because the
    // top-of-slide running label already carries account context.
    slide.addText(`CONFIDENTIAL · ${formatGpcFooterDate(new Date()).toUpperCase()}`, {
        x: MARGIN_X,
        y: FOOTER_TOP + 0.10,
        w: BODY_W / 2,
        h: 0.22,
        fontSize: 8,
        color: THEME.secondary,
        fontFace: THEME.font,
        charSpacing: 1.2,
        align: 'left',
        margin: 0,
        autoFit: false,
    });
    slide.addText(`${chrome.pageNum} / ${chrome.totalSlides}`, {
        x: MARGIN_X + BODY_W / 2,
        y: FOOTER_TOP + 0.10,
        w: BODY_W / 2,
        h: 0.22,
        fontSize: 8,
        color: THEME.secondary,
        fontFace: THEME.font,
        align: 'right',
        margin: 0,
        autoFit: false,
    });
}

/**
 * Rounded-rect panel used as the surface for every content card on the
 * dark deck. Keeping every panel in one helper guarantees consistent
 * fill / border / radius across slides.
 *
 * @param {import('pptxgenjs').Slide} slide
 */
function addPanel(slide, x, y, w, h) {
    slide.addShape('roundRect', {
        x,
        y,
        w,
        h,
        fill: { color: THEME.panelFill },
        line: { color: THEME.panelBorder, width: 0.75 },
        rectRadius: 0.10,
    });
}

/**
 * Small uppercase "kicker" label used above headlines / panels for
 * sectioning. Single helper so every kicker shares spacing + font.
 *
 * @param {import('pptxgenjs').Slide} slide
 */
function addKicker(slide, text, x, y, w) {
    slide.addText(text, {
        x,
        y,
        w,
        h: 0.22,
        fontSize: 9,
        bold: true,
        color: THEME.accent,
        fontFace: THEME.font,
        charSpacing: 2,
        margin: 0,
        autoFit: false,
    });
}

/**
 * Headline used directly under a kicker.
 *
 * @param {import('pptxgenjs').Slide} slide
 */
function addHeadline(slide, text, x, y, w, h) {
    slide.addText(text, {
        x,
        y,
        w,
        h,
        fontSize: 16,
        bold: true,
        color: THEME.primary,
        fontFace: THEME.font,
        valign: 'top',
        margin: 0,
        breakLine: true,
        autoFit: false,
    });
}

/**
 * Render a native PptxGenJS bullet list inside a rigid bounding box.
 * Used on slides 3 (Blindspots, Competitive bullets) where we want the
 * native PowerPoint bullet styling rather than the inline-glyph approach
 * (·) we use elsewhere. Task 2.3 explicitly requires `bullet: true` for
 * the Blindspots list.
 *
 * @param {import('pptxgenjs').Slide} slide
 * @param {string[]} items
 * @param {{ x: number, y: number, w: number, h: number, fontSize?: number, lineSpacing?: number, color?: string, bulletColor?: string, emptyText?: string }} opts
 */
function addNativeBulletList(slide, items, opts) {
    const clean = (items || []).map((i) => String(i ?? '').trim()).filter(Boolean);
    if (clean.length === 0) {
        slide.addText(opts.emptyText || '—', {
            x: opts.x,
            y: opts.y,
            w: opts.w,
            h: opts.h,
            fontSize: opts.fontSize ?? 11,
            italic: true,
            color: THEME.secondary,
            fontFace: THEME.font,
            valign: 'top',
            margin: 0,
            autoFit: false,
        });
        return;
    }

    slide.addText(
        clean.map((line, idx) => ({
            text: line,
            options: {
                bullet: { code: '2022', color: opts.bulletColor ?? THEME.accent },
                breakLine: idx < clean.length - 1,    // Task 3 — explicit per spec.
                color: opts.color ?? THEME.primary,
                fontSize: opts.fontSize ?? 12,
                fontFace: THEME.font,
            },
        })),
        {
            x: opts.x,
            y: opts.y,
            w: opts.w,
            h: opts.h,
            valign: 'top',
            lineSpacing: opts.lineSpacing ?? 20,
            margin: 0,
            autoFit: false,
        }
    );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * @param {{ name?: string } | null} account
 */
function buildPptxFilename(account) {
    const safeName = String(account?.name || 'Account').replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
    return `${safeName}_Strategic_Deal_Review.pptx`;
}

function getPptxGen() {
    if (typeof PptxGenJS === 'undefined') {
        throw new Error('PptxGenJS is not loaded.');
    }
    return PptxGenJS;
}

/**
 * Clamp a 1–5 slider value to the valid integer range, defaulting to 3
 * (the system "neutral" anchor) for malformed inputs. Used for both
 * relationship momentum and psychology sliders.
 *
 * @param {unknown} value
 * @param {number} fallback
 */
function clampScale(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(5, Math.max(1, Math.round(num)));
}

/**
 * @param {unknown} value
 */
function isPlainObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Trim a free-text string to a max length, appending an ellipsis when
 * it had to be cut. Defensive against verbose AI output landing inside
 * a fixed-height box.
 *
 * @param {string} text
 * @param {number} max
 */
function truncate(text, max) {
    const trimmed = String(text ?? '').trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}
