/**
 * Strategic Account OS — native PowerPoint export (PptxGenJS).
 *
 * Produces a 6-slide "Strategic Account Plan" deck on a 16:9 canvas
 * styled to match the premium "Editorial Print" aesthetic of our PDF
 * dossier (see js/account-plan-export-templates.js for the visual
 * reference). The deck always opens with a geometric GPC-branded cover
 * page, followed by five content slides that render against a clean
 * white master.
 *
 * Deck order:
 *   0. Cover                          — geometric brand artwork + title
 *   1. Executive Summary              — Pursuit Thesis + Momentum KPI
 *   2. Psychology & Strategic Tensions — slider tracks + tension badges
 *   3. The Battlefield                — Competitive narrative + Blindspots
 *   4. Strategic Entry Points         — 2 target profiles on one slide
 *   5. Execution Roadmap              — 30/60/90 table + Strategic Signals
 *
 * Theming (Task 1 + Task 3):
 *   • Light slide master (white background, navy logo top-right,
 *     subtle footer rule + "Great Plains Communications | Strategic
 *     Account Plan" running text + manual N/total page number).
 *   • All content slides apply that master, inheriting the running
 *     chrome automatically — no per-slide footer rebuild.
 *   • Cover slide does NOT use the master; it carries its own dark
 *     geometric background and the white logo variant.
 *
 * Typography & overflow:
 *   • TYPO scale — body 11pt, slide headers 24pt, sub-headers 14pt.
 *   • Panel content uses inch-based vertical stacking (kicker → headline
 *     → body) so headers never collide with body copy.
 *   • breakLine:true, valign:'top', autoFit:false on all narrative blocks.
 *   • Slide 4 (Target Profiles) uses a locked 5%/42% | 53%/42% column
 *     grid with pptxgenjs rich-text runs per profile field.
 */

import {
    GPC_BRAND,
    GPC_LOGO_NAVY,
    GPC_LOGO_WHITE,
    formatGpcFooterDate,
} from './account-plan-export-brand.js';
import { normalizePlan } from './account-plan-data.js';
import { TACTICAL_UX_LABELS, formatClientCommitmentsLabel } from './account-plan-sections.js';
import { hasMeaningfulText, sanitizeStringArray } from './account-plan-export-templates.js';
import { normalizePresentationHighlight } from './account-plan-presentation-ai.js';
import { MOMENTUM_LABELS } from './account-plan-presentation-types.js';
import { PSYCHOLOGY_SLIDERS } from './account-plan-sections.js';

// ---------------------------------------------------------------------------
// SLIDE GEOMETRY (16:9 — 13.333" × 7.5")
// ---------------------------------------------------------------------------
// All numbers below are in inches. The slide master locks down the header
// runner, the body band, and the footer band; per-slide renderers carve
// the body into sub-rectangles using these constants so spacing stays
// consistent across every content slide.
// ---------------------------------------------------------------------------
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN_X = 0.55;

// Header band — small running label, large slide-specific title, accent rule.
const HEADER_RUNNER_Y = 0.30;
const HEADER_TITLE_Y = 0.55;
const HEADER_DIVIDER_Y = 1.00;

// Footer band — master draws the rule + brand text; per-slide chrome
// renders the manual "N / total" page number on the right.
const FOOTER_RULE_Y = 7.05;
const FOOTER_TEXT_Y = 7.18;

// Content body — every content slide gets the same 5.85" × 12.233" canvas.
const BODY_TOP = 1.15;
const BODY_BOTTOM = FOOTER_RULE_Y - 0.05;
const BODY_H = BODY_BOTTOM - BODY_TOP;          // 5.85
const BODY_W = SLIDE_W - MARGIN_X * 2;          // 12.233
const GAP = 0.22;

// Logo (top-right of every content slide). Sized to roughly match the
// `.ap-export-gpc-logo--content` width on the PDF dossier (96px @ 96dpi
// ≈ 1.0"). Kept slightly larger here because the PPTX viewing distance
// is typically further than a printed PDF.
const LOGO_W = 1.30;
const LOGO_H = 0.50;
const LOGO_X = SLIDE_W - MARGIN_X - LOGO_W;
const LOGO_Y = 0.30;

// ---------------------------------------------------------------------------
// THEME (Task 3 — light editorial palette)
// ---------------------------------------------------------------------------
// pptxgenjs strips a leading "#" off color strings; we store hex without
// it so the values can pass straight into fill / line / color options.
// The hex values mirror the PDF dossier light palette to keep the two
// exports visually consistent for the same account.
// ---------------------------------------------------------------------------
const THEME = Object.freeze({
    bg: 'FFFFFF',           // pure white master background
    panelFill: 'F8FAFC',    // ultra-light slate-50 panel surface
    primary: '0F172A',      // dark slate-900 (primary text)
    secondary: '475569',    // slate-600 (subtitle / kicker text)
    softMuted: '94A3B8',    // slate-400 (very low-emphasis text)
    panelBorder: 'E2E8F0',  // slate-200 (panel + table cell borders)
    trackBg: 'E2E8F0',      // slider track background per Task 3
    accent: stripHash(GPC_BRAND.teal),       // GPC teal — primary brand accent
    accentAlt: stripHash(GPC_BRAND.lime),    // GPC lime — secondary brand accent
    accentDark: stripHash(GPC_BRAND.navyDeep), // navy-deep — used for cover/headers
    coverBg: stripHash(GPC_BRAND.navyDark),  // cover slide background
    hazard: 'B45309',       // amber-700 — restrained warning hue for inverse-high sliders
    font: 'Arial',
});

// Strict typographic scale — every content slide honors these sizes so
// PowerPoint never inflates body copy past the bounding box.
const TYPO = Object.freeze({
    body: 11,
    header: 24,
    subheader: 14,
    kicker: 9,
});

/** Hex color with leading "#" for rich-text runs. */
function themeHex(key) {
    return `#${THEME[key]}`;
}

/** Shared options for narrative body copy inside rigid bounding boxes. */
const BODY_TEXT_BASE = Object.freeze({
    fontSize: TYPO.body,
    fontFace: THEME.font,
    color: THEME.primary,
    valign: 'top',
    align: 'left',
    breakLine: true,
    margin: 0,
    autoFit: false,
});

// Panel interior rhythm (inches) — kicker, headline, and body must share
// one coordinate system. Mixing inch headers with percent body Y caused
// headline/body overlap in PowerPoint.
const PANEL_PAD_X = 0.25;
const PANEL_KICKER_Y_OFF = 0.18;
const PANEL_HEADLINE_Y_OFF = 0.38;
const PANEL_HEADLINE_H = 0.48;
const PANEL_BODY_GAP = 0.10;
const PANEL_BOTTOM_PAD = 0.18;

/**
 * Compute stacked Y positions for kicker → headline → body inside a panel.
 *
 * @param {number} panelX
 * @param {number} panelY
 * @param {number} panelW
 * @param {number} panelH
 */
function panelContentLayout(panelX, panelY, panelW, panelH) {
    const innerX = panelX + PANEL_PAD_X;
    const innerW = panelW - PANEL_PAD_X * 2;
    const kickerY = panelY + PANEL_KICKER_Y_OFF;
    const headlineY = panelY + PANEL_HEADLINE_Y_OFF;
    const bodyY = headlineY + PANEL_HEADLINE_H + PANEL_BODY_GAP;
    const bodyH = panelY + panelH - bodyY - PANEL_BOTTOM_PAD;
    return {
        innerX,
        innerW,
        kickerY,
        headlineY,
        bodyY,
        bodyH: Math.max(bodyH, 0.45),
    };
}

// Tension badges (Task 3 — "retain GPC brand blue/green"). We cycle the
// brand teal, brand lime, and brand navy-deep so each row reads as an
// intentional on-brand spectrum rather than a rainbow. Text color is
// flipped depending on contrast against the fill.
const TENSION_BADGE_PALETTE = Object.freeze([
    { fill: stripHash(GPC_BRAND.teal),     text: 'FFFFFF' },
    { fill: stripHash(GPC_BRAND.lime),     text: '0F172A' },
    { fill: stripHash(GPC_BRAND.navyDeep), text: 'FFFFFF' },
]);

const MAX_PROFILES_PER_SLIDE = 2; // Mirrors the PDF dossier target-profile layout.
const MAX_BLINDSPOTS = 8;
const MAX_SIGNALS = 5;
const MAX_PLAN_BULLETS = 4;

// Document title — strictly "Strategic Account Plan" per the new brief.
// Centralised so every chrome surface (cover, header runner, footer,
// PowerPoint metadata) reads the same way.
const DOC_TITLE = 'Strategic Account Plan';

// Slide master title. The string is the lookup key passed to
// `pptx.addSlide({ masterName })` for every content slide.
const MASTER_NAME = 'GPC_CONTENT';

/**
 * pptxgenjs accepts color strings without the leading "#". We strip it
 * defensively when consuming the brand constants (which DO include "#").
 *
 * @param {string} hex
 */
function stripHash(hex) {
    return String(hex || '').replace(/^#/, '').toUpperCase();
}

/** @type {Record<string, string>} */
const _logoDataUrlCache = {};

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
    // If it's absent we synthesize a "fallback highlight" off the raw plan
    // so every code path below can assume the highlight shape exists.
    const highlight = presentationHighlight ?? normalizePresentationHighlight(null, {
        accountName,
        generatedAt: new Date().toISOString(),
        model: null,
        plan,
    });

    // Raw normalized plan — used as a secondary source for fields the AI
    // schema does not synthesize verbatim (psychology slider integers,
    // strategic_tensions pill array, blindspots checklist, raw entry
    // point profiles with human_context).
    const ctx = resolvePptxPlanContext(plan);

    // Logos — load both variants in parallel. Both are optional: if the
    // fetch fails we render the deck without imagery rather than hard-
    // failing the export.
    const [navyLogo, whiteLogo] = await Promise.all([
        loadLogoDataUrl(GPC_LOGO_NAVY),
        loadLogoDataUrl(GPC_LOGO_WHITE),
    ]);

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';                            // 13.333 × 7.5 inches.
    pptx.author = GPC_BRAND.companyName;
    pptx.company = GPC_BRAND.companyName;
    pptx.subject = `${accountName} — ${DOC_TITLE}`;
    pptx.title = `${accountName} — ${DOC_TITLE}`;

    // Define the master FIRST so every subsequent addSlide({ masterName })
    // call inherits it. We pass the per-deck running header text into
    // the master closure so the account name shows on every content slide
    // without requiring per-slide redefinition.
    defineContentMaster(pptx, accountName, navyLogo);

    // -----------------------------------------------------------------
    // SLIDE 0 — Cover (no master; custom dark canvas)
    // -----------------------------------------------------------------
    buildCoverSlide(pptx, accountName, whiteLogo);

    // -----------------------------------------------------------------
    // Content slides — Smart Drop omits empty psychology/tensions slide.
    // -----------------------------------------------------------------
    /** @type {Array<(pageNum: number, totalSlides: number) => void>} */
    const contentSlideBuilders = [
        (pageNum, totalSlides) => buildExecutiveSummarySlide(pptx, highlight, ctx, pageNum, totalSlides),
    ];
    if (!isPsychologyTensionsSlideEmpty(ctx)) {
        contentSlideBuilders.push(
            (pageNum, totalSlides) => buildPsychologyTensionsSlide(pptx, ctx, pageNum, totalSlides)
        );
    }
    contentSlideBuilders.push(
        (pageNum, totalSlides) => buildBattlefieldSlide(pptx, highlight, ctx, pageNum, totalSlides),
        (pageNum, totalSlides) => buildEntryPointsSlide(pptx, ctx, highlight, pageNum, totalSlides),
        (pageNum, totalSlides) => buildExecutionRoadmapSlide(pptx, highlight, ctx, pageNum, totalSlides),
    );

    const contentSlideCount = contentSlideBuilders.length;
    let pageNum = 1;
    contentSlideBuilders.forEach((buildSlide) => {
        buildSlide(pageNum++, contentSlideCount);
    });

    const arrayBuffer = await pptx.write({ outputType: 'arraybuffer' });
    return {
        bytes: new Uint8Array(arrayBuffer),
        filename: buildPptxFilename(account),
    };
}

// ---------------------------------------------------------------------------
// Task 1 — Slide master (defineSlideMaster)
// ---------------------------------------------------------------------------
// Every content slide gets:
//   • White background
//   • Top-right navy logo (or blank if the asset failed to load)
//   • Top-left running header — "[ACCOUNT NAME] · STRATEGIC ACCOUNT PLAN"
//   • Footer hairline + footer text "Great Plains Communications |
//     Strategic Account Plan"
//
// We intentionally do NOT use pptxgenjs's built-in `slideNumber` config
// because it would auto-number the cover as slide 1 and force the first
// content slide to read "2". Instead each content-slide builder calls
// addContentSlideChrome() which manually injects "N / total" on the
// right side of the footer band. This keeps the master visually
// complete while honouring the cover-excluded numbering convention used
// in the PDF dossier.
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {string} accountName
 * @param {string | null} navyLogo
 */
function defineContentMaster(pptx, accountName, navyLogo) {
    const objects = [];

    // 1. Top-left running header. The PDF dossier uses an identical
    //    three-part crumb but PPTX has tighter visual real-estate, so
    //    we collapse it to a two-part runner: "<ACCOUNT> · STRATEGIC
    //    ACCOUNT PLAN". Stored with explicit charSpacing so the
    //    typography matches the dossier running-head feel.
    objects.push({
        text: {
            text: `${accountName.toUpperCase()} · ${DOC_TITLE.toUpperCase()}`,
            options: {
                x: MARGIN_X,
                y: HEADER_RUNNER_Y,
                w: BODY_W - LOGO_W - 0.20,    // leave room so the logo never collides
                h: 0.20,
                fontSize: 9,
                bold: true,
                color: THEME.secondary,
                fontFace: THEME.font,
                charSpacing: 2,
                align: 'left',
                valign: 'middle',
                margin: 0,
                autoFit: false,
            },
        },
    });

    // 2. Top-right navy logo. Optional — if the asset failed to load we
    //    quietly skip it rather than hard-failing the export.
    if (navyLogo) {
        objects.push({
            image: {
                x: LOGO_X,
                y: LOGO_Y,
                w: LOGO_W,
                h: LOGO_H,
                data: navyLogo,
                sizing: { type: 'contain', w: LOGO_W, h: LOGO_H },
            },
        });
    }

    // 3. Subtle footer hairline — slate-200, full body-width, 0.75pt.
    //    Sits 0.13" above the footer text so the rule visually
    //    anchors the running brand line.
    objects.push({
        line: {
            x: MARGIN_X,
            y: FOOTER_RULE_Y,
            w: BODY_W,
            h: 0,
            line: { color: THEME.panelBorder, width: 0.75 },
        },
    });

    // 4. Footer running brand text on the left. Uppercase + tracked so
    //    it reads as a tasteful editorial colophon rather than a
    //    sentence. Right-aligned page number is injected per-slide
    //    (see addContentSlideChrome) to honour cover-excluded numbering.
    objects.push({
        text: {
            text: `${GPC_BRAND.companyName.toUpperCase()} | ${DOC_TITLE.toUpperCase()}`,
            options: {
                x: MARGIN_X,
                y: FOOTER_TEXT_Y,
                w: BODY_W * 0.7,
                h: 0.22,
                fontSize: 8,
                bold: true,
                color: THEME.secondary,
                fontFace: THEME.font,
                charSpacing: 1.5,
                align: 'left',
                valign: 'middle',
                margin: 0,
                autoFit: false,
            },
        },
    });

    pptx.defineSlideMaster({
        title: MASTER_NAME,
        background: { color: THEME.bg },
        objects,
    });
}

// ---------------------------------------------------------------------------
// Task 2 — Geometric cover slide
// ---------------------------------------------------------------------------
// Replicates the visual language of buildGpcCoverPage() in the PDF
// templates (overlapping navyDeep / teal / lime blocks against a navyDark
// field), translated into native pptxgenjs shapes. The cover does NOT
// use the master so it can carry its own dark canvas + white logo.
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {string} accountName
 * @param {string | null} whiteLogo
 */
function buildCoverSlide(pptx, accountName, whiteLogo) {
    const slide = pptx.addSlide();
    slide.background = { color: THEME.coverBg };

    // -----------------------------------------------------------------
    // GEOMETRIC ARTWORK (drawn back-to-front so the lime accent sits
    // on top of the teal wedge which sits on top of the navy-deep slab).
    // -----------------------------------------------------------------

    // (a) Navy-deep right slab — occupies the right ~44% of the canvas
    //     and visually frames the white logo + holds the geometric
    //     accents that follow.
    slide.addShape('rect', {
        x: 7.50,
        y: 0,
        w: SLIDE_W - 7.50,        // 5.833"
        h: SLIDE_H,
        fill: { color: THEME.accentDark },
        line: { width: 0 },
    });

    // (b) Teal diagonal wedge — a right triangle whose hypotenuse cuts
    //     from the top-left (5.5, 0) down to the bottom-right (10.0,
    //     7.5). With rtTriangle's default geometry (right angle at
    //     bottom-left, hypotenuse from top-left to bottom-right) we get
    //     a slanted teal slab that overlaps the navy-dark field on the
    //     left half AND the navy-deep slab on the right.
    slide.addShape('rtTriangle', {
        x: 5.50,
        y: 0,
        w: 4.50,
        h: SLIDE_H,
        fill: { color: THEME.accent },
        line: { width: 0 },
    });

    // (c) Lime accent block — small bottom-right corner square that
    //     punctuates the composition with the brand secondary. Sized
    //     to sit cleanly inside the navy-deep slab without crossing
    //     the slide's right edge.
    slide.addShape('rect', {
        x: 11.20,
        y: 5.40,
        w: 2.133,
        h: 2.10,
        fill: { color: THEME.accentAlt },
        line: { width: 0 },
    });

    // -----------------------------------------------------------------
    // WHITE LOGO — top-right corner, inset into the navy-deep slab.
    // -----------------------------------------------------------------
    if (whiteLogo) {
        slide.addImage({
            data: whiteLogo,
            x: 9.60,
            y: 0.45,
            w: 2.30,
            h: 0.75,
            sizing: { type: 'contain', w: 2.30, h: 0.75 },
        });
    }

    // -----------------------------------------------------------------
    // LEFT-SIDE TITLE BLOCK — premium editorial stack: accent bar (shape
    // first for z-index) then vertically centred account name.
    // -----------------------------------------------------------------
    const titleX = 0.75;
    const titleW = 6.25;
    const titleCenterY = SLIDE_H / 2;

    // Slim brand accent — shape before text (z-order).
    slide.addShape('rect', {
        x: titleX,
        y: titleCenterY - 0.95,
        w: 1.85,
        h: 0.12,
        fill: { color: THEME.accent },
        line: { width: 0 },
    });

    slide.addText(accountName, {
        x: titleX,
        y: titleCenterY - 0.75,
        w: titleW,
        h: 1.35,
        fontSize: 44,
        bold: true,
        color: 'FFFFFF',
        fontFace: THEME.font,
        align: 'left',
        valign: 'middle',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });

    slide.addText(DOC_TITLE.toUpperCase(), {
        x: titleX,
        y: titleCenterY + 0.72,
        w: titleW,
        h: 0.45,
        fontSize: TYPO.subheader,
        bold: true,
        color: THEME.accentAlt,
        fontFace: THEME.font,
        charSpacing: 3,
        align: 'left',
        valign: 'top',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });

    slide.addText(formatGpcFooterDate(new Date()), {
        x: titleX,
        y: titleCenterY + 1.22,
        w: titleW,
        h: 0.30,
        fontSize: TYPO.body,
        color: 'CBD5E1',
        fontFace: THEME.font,
        align: 'left',
        valign: 'top',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });

    slide.addText(GPC_BRAND.companyName.toUpperCase(), {
        x: titleX,
        y: SLIDE_H - 0.55,
        w: titleW,
        h: 0.25,
        fontSize: TYPO.kicker,
        bold: true,
        color: 'CBD5E1',
        fontFace: THEME.font,
        charSpacing: 2.5,
        align: 'left',
        valign: 'middle',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });
}

// ---------------------------------------------------------------------------
// Plan context resolution
// ---------------------------------------------------------------------------

/**
 * Normalize the plan once and return the slim subset of raw data each
 * slide renderer needs. Keeping this in one place means we don't re-run
 * normalizePlan per slide (which is expensive on large plans).
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
        blindspots: extractBlindspotsFromSections(sections),
        actionForcingEvent: String(pursuit.action_forcing_event ?? '').trim(),
        plan306090: {
            days_30: String(plan306090.days_30 ?? '').trim(),
            days_60: String(plan306090.days_60 ?? '').trim(),
            days_90: String(plan306090.days_90 ?? '').trim(),
            client_commitments: Array.isArray(plan306090.client_commitments)
                ? plan306090.client_commitments
                    .map((c) => String(c ?? '').trim())
                    .filter(Boolean)
                : [],
        },
        rawEntryPoints: Array.isArray(sections.entry_points) ? sections.entry_points : [],
    };
}

/**
 * Pull the consolidated blindspots string[] from normalized plan sections.
 * Accepts the post-migration `{ blindspots: string[] }` object, a direct
 * array on `critical_unknowns`, and the legacy `unknowns` rich-text blob.
 *
 * @param {Record<string, unknown>} sections
 * @returns {string[]}
 */
function extractBlindspotsFromSections(sections) {
    const unknowns = sections.critical_unknowns;

    if (Array.isArray(unknowns)) {
        return unknowns
            .map((b) => String(b ?? '').trim())
            .filter(Boolean)
            .slice(0, MAX_BLINDSPOTS);
    }

    if (Array.isArray(sections.blindspots)) {
        return sections.blindspots
            .map((b) => String(b ?? '').trim())
            .filter(Boolean)
            .slice(0, MAX_BLINDSPOTS);
    }

    const unknownsObj = isPlainObject(unknowns) ? unknowns : {};
    if (Array.isArray(unknownsObj.blindspots)) {
        return unknownsObj.blindspots
            .map((b) => String(b ?? '').trim())
            .filter(Boolean)
            .slice(0, MAX_BLINDSPOTS);
    }

    const legacyText = String(unknownsObj.unknowns ?? '').trim();
    if (legacyText) {
        return legacyText
            .split(/\r?\n+/)
            .map((line) => line.replace(/^[\s]*(?:[-*\u2022]\s+|\d+[.)]\s+)/, '').trim())
            .filter(Boolean)
            .slice(0, MAX_BLINDSPOTS);
    }

    return [];
}

/**
 * Resolve blindspots for the Battlefield slide — plan data first, then the
 * AI-synthesized critical_unknowns bullets from the presentation payload.
 *
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @returns {string[]}
 */
function resolveBattlefieldBlindspots(ctx, highlight) {
    if (ctx.blindspots.length > 0) return ctx.blindspots;

    const aiBlock = highlight?.slides?.situation?.critical_unknowns;
    const aiBullets = Array.isArray(aiBlock?.bullets) ? aiBlock.bullets : [];
    if (aiBullets.length > 0) {
        return aiBullets
            .map((b) => String(b ?? '').trim())
            .filter(Boolean)
            .slice(0, MAX_BLINDSPOTS);
    }

    const aiBlindspots = Array.isArray(aiBlock?.blindspots) ? aiBlock.blindspots : [];
    return aiBlindspots
        .map((b) => String(b ?? '').trim())
        .filter(Boolean)
        .slice(0, MAX_BLINDSPOTS);
}

// ---------------------------------------------------------------------------
// Slide 1 — Executive Summary
// ---------------------------------------------------------------------------
// Geometry:
//   • Left column  (Pursuit Thesis prose) — 60% of BODY_W
//   • Right column (Momentum KPI)         — 35% of BODY_W
//   • Remaining 5% is the inter-column gutter — intentionally wider
//     than the standard GAP so the KPI panel reads as a discrete object.
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildExecutiveSummarySlide(pptx, highlight, ctx, pageNum, totalSlides) {
    const slide = addContentSlide(pptx);
    addContentSlideChrome(slide, 'Executive Summary', pageNum, totalSlides);

    const leftW = BODY_W * 0.60;
    const rightW = BODY_W * 0.35;
    const gutter = BODY_W - leftW - rightW;
    const rightX = MARGIN_X + leftW + gutter; // panel anchor (inch-based)

    // -----------------------------------------------------------------
    // LEFT COLUMN — Pursuit Thesis prose
    // -----------------------------------------------------------------
    const pursuitHeadline = String(highlight.slides.situation?.pursuit_thesis?.headline ?? '').trim()
        || TACTICAL_UX_LABELS.pursuitThesis;
    const pursuitProse = resolvePursuitThesisProse(highlight, ctx);
    const actionForcing = ctx.actionForcingEvent;

    addPanel(slide, MARGIN_X, BODY_TOP, leftW, BODY_H);
    const leftLayout = panelContentLayout(MARGIN_X, BODY_TOP, leftW, BODY_H);
    addKicker(slide, TACTICAL_UX_LABELS.pursuitThesis.toUpperCase(), leftLayout.innerX, leftLayout.kickerY, leftLayout.innerW);
    addHeadline(slide, pursuitHeadline, leftLayout.innerX, leftLayout.headlineY, leftLayout.innerW, PANEL_HEADLINE_H);

    const proseY = leftLayout.bodyY;
    const proseH = actionForcing
        ? leftLayout.bodyH * 0.72
        : leftLayout.bodyH;

    slide.addText(pursuitProse || 'No big play captured yet.', {
        x: leftLayout.innerX,
        y: proseY,
        w: leftLayout.innerW,
        h: proseH,
        ...BODY_TEXT_BASE,
        lineSpacing: 16,
    });

    if (actionForcing) {
        slide.addText([
            {
                text: `${TACTICAL_UX_LABELS.actionForcingEvent}:\n`,
                options: {
                    bold: true,
                    fontSize: TYPO.body,
                    color: themeHex('accent'),
                    fontFace: THEME.font,
                },
            },
            {
                text: actionForcing,
                options: {
                    fontSize: TYPO.body,
                    color: themeHex('secondary'),
                    fontFace: THEME.font,
                },
            },
        ], {
            x: leftLayout.innerX,
            y: proseY + proseH + 0.06,
            w: leftLayout.innerW,
            h: leftLayout.bodyH - proseH - 0.10,
            valign: 'top',
            breakLine: true,
            margin: 0,
            autoFit: false,
        });
    }

    // -----------------------------------------------------------------
    // RIGHT COLUMN — Momentum KPI
    // -----------------------------------------------------------------
    addPanel(slide, rightX, BODY_TOP, rightW, BODY_H);
    const rightInnerX = rightX + PANEL_PAD_X;
    const rightInnerW = rightW - PANEL_PAD_X * 2;
    addKicker(slide, 'RELATIONSHIP MOMENTUM', rightInnerX, BODY_TOP + PANEL_KICKER_Y_OFF, rightInnerW);

    const kpiScoreY = BODY_TOP + 0.55;
    const kpiScoreH = 1.55;
    slide.addText(String(ctx.score), {
        x: rightX,
        y: kpiScoreY,
        w: rightW,
        h: kpiScoreH,
        align: 'center',
        valign: 'middle',
        fontSize: 72,
        bold: true,
        color: THEME.accent,
        fontFace: THEME.font,
        breakLine: true,
        margin: 0,
        autoFit: false,
    });
    slide.addText(MOMENTUM_LABELS[ctx.score - 1].toUpperCase(), {
        x: rightInnerX,
        y: kpiScoreY + kpiScoreH + 0.04,
        w: rightInnerW,
        h: 0.30,
        align: 'center',
        fontSize: TYPO.subheader,
        bold: true,
        color: THEME.primary,
        fontFace: THEME.font,
        charSpacing: 2,
        valign: 'top',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });

    const ruleY = kpiScoreY + kpiScoreH + 0.48;
    slide.addShape('line', {
        x: rightX + 0.50,
        y: ruleY,
        w: rightW - 1.00,
        h: 0,
        line: { color: THEME.accent, width: 0.75 },
    });

    const narrative = ctx.momentumNarrative
        || String(highlight.slides.situation?.momentum?.insight ?? '').trim();
    if (narrative) {
        slide.addText(truncate(narrative, 320), {
            x: rightInnerX,
            y: ruleY + 0.14,
            w: rightInnerW,
            h: BODY_TOP + BODY_H - (ruleY + 0.14) - PANEL_BOTTOM_PAD,
            ...BODY_TEXT_BASE,
            color: THEME.secondary,
            lineSpacing: 16,
        });
    }
}

/**
 * Resolve the Pursuit Thesis prose body for slide 1.
 *
 * Preference order:
 *   1. AI-synthesized bullets (already length-tightened) — joined with
 *      blank lines so they read as paragraph breaks.
 *   2. Raw consolidated `pursuit_thesis.thesis` (post-Task-2 schema).
 *   3. Legacy split `core` + `cost_of_standing_still` joined so older
 *      plans still surface something readable.
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

    const legacyParts = [ctx.pursuit.core, ctx.pursuit.cost_of_standing_still]
        .map((v) => String(v ?? '').trim())
        .filter(Boolean);
    return legacyParts.join('\n\n');
}

/**
 * Psychology is "empty" when every slider is still at default (3) and no
 * gravity narrative fields were authored.
 *
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 */
function isPsychologyDataEmpty(ctx) {
    const psych = ctx.psychology;
    const slidersDefault = PSYCHOLOGY_SLIDERS.every(
        (slider) => clampScale(psych[slider.id], 3) === 3
    );
    if (!slidersDefault) return false;

    const gravityFilled = [
        'organizational_gravity',
        'consensus_requirement',
        'procurement_friction',
        'innovation_friction',
        'narrative',
    ].some((key) => hasMeaningfulText(psych[key]));

    return !gravityFilled;
}

/**
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 */
function isStrategicTensionsDataEmpty(ctx) {
    if (sanitizeStringArray(ctx.tensionPills).length > 0) return false;
    return !hasMeaningfulText(ctx.tensionNarrative);
}

/**
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 */
function isPsychologyTensionsSlideEmpty(ctx) {
    return isPsychologyDataEmpty(ctx) && isStrategicTensionsDataEmpty(ctx);
}

// ---------------------------------------------------------------------------
// Slide 2 — Psychology & Strategic Tensions
// ---------------------------------------------------------------------------
// Top half (BODY_H * 0.50): Account Psychology — 5 horizontal track bars
// Bottom half (BODY_H * 0.50): Strategic Tensions — colored badges
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildPsychologyTensionsSlide(pptx, ctx, pageNum, totalSlides) {
    const slide = addContentSlide(pptx);
    addContentSlideChrome(slide, `${TACTICAL_UX_LABELS.psychologySection} & ${TACTICAL_UX_LABELS.competingPriorities}`, pageNum, totalSlides);

    const halfH = (BODY_H - GAP) / 2;
    const topY = BODY_TOP;
    const bottomY = BODY_TOP + halfH + GAP;

    // -----------------------------------------------------------------
    // TOP HALF — Psychology track bars
    // -----------------------------------------------------------------
    addPanel(slide, MARGIN_X, topY, BODY_W, halfH);
    addKicker(slide, TACTICAL_UX_LABELS.psychologySection.toUpperCase(), MARGIN_X + 0.30, topY + 0.18, BODY_W - 0.6);

    const trackTop = topY + 0.65;
    const trackArea = halfH - 0.85;
    const rowH = trackArea / PSYCHOLOGY_SLIDERS.length;

    const labelW = 2.60;
    const valueW = 0.55;
    const trackPadR = 0.30;
    const labelX = MARGIN_X + 0.30;
    const trackX = labelX + labelW + 0.20;
    const valueX = MARGIN_X + BODY_W - 0.30 - valueW;
    const trackW = valueX - trackX - trackPadR;
    const trackBarH = 0.18;

    PSYCHOLOGY_SLIDERS.forEach((slider, index) => {
        const rowY = trackTop + index * rowH;
        const value = clampScale(ctx.psychology[slider.id], 3);

        slide.addText(slider.label, {
            x: labelX,
            y: rowY,
            w: labelW,
            h: rowH,
            fontSize: TYPO.body,
            bold: true,
            color: THEME.primary,
            fontFace: THEME.font,
            valign: 'middle',
            breakLine: true,
            margin: 0,
            autoFit: false,
        });

        // Track background — light gray (#E2E8F0) per Task 3 spec.
        const trackY = rowY + (rowH - trackBarH) / 2;
        slide.addShape('rect', {
            x: trackX,
            y: trackY,
            w: trackW,
            h: trackBarH,
            fill: { color: THEME.trackBg },
            line: { color: THEME.panelBorder, width: 0.5 },
        });

        // Fill — bold brand color per Task 3 spec. Inverse-scale sliders
        // (bureaucracy) shade amber at 4+ to give the exec a hazard cue
        // without extra prose; direct-scale "healthy" values pop in
        // brand lime; everything else holds the primary brand teal.
        const fillW = trackW * (value / 5);
        const fillColor = slider.colorScale === 'inverse' && value >= 4
            ? THEME.hazard
            : slider.colorScale === 'direct' && value >= 4
                ? THEME.accentAlt
                : THEME.accent;
        slide.addShape('rect', {
            x: trackX,
            y: trackY,
            w: fillW,
            h: trackBarH,
            fill: { color: fillColor },
            line: { color: fillColor, width: 0.5 },
        });

        // 1-5 tick separators — 4 thin white-ish vertical lines that
        // divide the track into 5 equal segments. Reinforces the 1-5
        // scale visually without adding labels.
        for (let tick = 1; tick <= 4; tick += 1) {
            const tickX = trackX + trackW * (tick / 5);
            slide.addShape('line', {
                x: tickX,
                y: trackY + 0.02,
                w: 0,
                h: trackBarH - 0.04,
                line: { color: 'FFFFFF', width: 0.5 },
            });
        }

        // Low / high scale captions beneath the track.
        slide.addText(slider.lowLabel, {
            x: trackX,
            y: trackY + trackBarH + 0.02,
            w: trackW / 2,
            h: 0.16,
            fontSize: TYPO.kicker,
            color: THEME.softMuted,
            fontFace: THEME.font,
            align: 'left',
            valign: 'top',
            breakLine: true,
            margin: 0,
            autoFit: false,
        });
        slide.addText(slider.highLabel, {
            x: trackX + trackW / 2,
            y: trackY + trackBarH + 0.02,
            w: trackW / 2,
            h: 0.16,
            fontSize: TYPO.kicker,
            color: THEME.softMuted,
            fontFace: THEME.font,
            align: 'right',
            valign: 'top',
            breakLine: true,
            margin: 0,
            autoFit: false,
        });

        // Right-side value indicator.
        slide.addText(`${value} / 5`, {
            x: valueX,
            y: rowY,
            w: valueW,
            h: rowH,
            fontSize: TYPO.subheader,
            bold: true,
            color: THEME.accent,
            fontFace: THEME.font,
            align: 'right',
            valign: 'middle',
            breakLine: true,
            margin: 0,
            autoFit: false,
        });
    });

    // -----------------------------------------------------------------
    // BOTTOM HALF — Strategic Tensions badges
    // -----------------------------------------------------------------
    addPanel(slide, MARGIN_X, bottomY, BODY_W, halfH);
    addKicker(slide, TACTICAL_UX_LABELS.competingPriorities.toUpperCase(), MARGIN_X + 0.30, bottomY + 0.18, BODY_W - 0.6);

    if (ctx.tensionPills.length === 0) {
        slide.addText(`No competing priorities captured yet — open the ${TACTICAL_UX_LABELS.competingPriorities} section in the plan canvas.`, {
            x: '4%',
            y: '58%',
            w: '92%',
            h: '8%',
            ...BODY_TEXT_BASE,
            italic: true,
            color: THEME.softMuted,
        });
        return;
    }

    // 4 badges per row, wrap to additional rows for up to 16 tensions
    // (a generous upper bound — the canvas caps at 9 either-or groups
    // in practice).
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
        const palette = TENSION_BADGE_PALETTE[index % TENSION_BADGE_PALETTE.length];
        slide.addShape('roundRect', {
            x: bx,
            y: by,
            w: badgeW,
            h: badgeH,
            fill: { color: palette.fill },
            line: { color: palette.fill, width: 0 },
            rectRadius: 0.10,
        });
        slide.addText(pill, {
            x: bx + 0.12,
            y: by,
            w: badgeW - 0.24,
            h: badgeH,
            fontSize: TYPO.body,
            bold: true,
            color: palette.text,
            fontFace: THEME.font,
            align: 'center',
            valign: 'middle',
            breakLine: true,
            margin: 0,
            autoFit: false,
        });
    });

    if (ctx.tensionNarrative) {
        const usedRows = Math.min(4, Math.ceil(ctx.tensionPills.length / badgesPerRow));
        const narrativeY = badgeStartY + usedRows * (badgeH + badgeRowGap) + 0.05;
        const narrativeMaxH = bottomY + halfH - narrativeY - 0.25;
        if (narrativeMaxH > 0.3) {
            slide.addText(truncate(ctx.tensionNarrative, 260), {
                x: MARGIN_X + 0.30,
                y: narrativeY,
                w: BODY_W - 0.60,
                h: narrativeMaxH,
                ...BODY_TEXT_BASE,
                italic: true,
                color: THEME.secondary,
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
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildBattlefieldSlide(pptx, highlight, ctx, pageNum, totalSlides) {
    const slide = addContentSlide(pptx);
    addContentSlideChrome(slide, 'The Battlefield', pageNum, totalSlides);

    const blindspotItems = resolveBattlefieldBlindspots(ctx, highlight);
    const hasBlindspots = blindspotItems.length > 0;

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

    const competitiveHeadline = String(highlight.slides.battlefield?.competitive?.headline ?? '').trim()
        || 'Competitive Landscape';

    if (hasBlindspots) {
        const colW = (BODY_W - GAP) / 2;
        const leftX = MARGIN_X;
        const rightX = MARGIN_X + colW + GAP;

        addPanel(slide, leftX, BODY_TOP, colW, BODY_H);
        const leftLayout = panelContentLayout(leftX, BODY_TOP, colW, BODY_H);
        addKicker(slide, 'COMPETITIVE LANDSCAPE', leftLayout.innerX, leftLayout.kickerY, leftLayout.innerW);
        addHeadline(slide, competitiveHeadline, leftLayout.innerX, leftLayout.headlineY, leftLayout.innerW, PANEL_HEADLINE_H);
        addNativeBulletList(slide, competitiveBullets, {
            x: leftLayout.innerX,
            y: leftLayout.bodyY,
            w: leftLayout.innerW,
            h: leftLayout.bodyH,
            fontSize: TYPO.body,
            lineSpacing: 16,
            color: THEME.primary,
            bulletColor: THEME.accent,
            emptyText: 'No competitive landscape captured yet.',
        });

        addPanel(slide, rightX, BODY_TOP, colW, BODY_H);
        const rightLayout = panelContentLayout(rightX, BODY_TOP, colW, BODY_H);
        addKicker(slide, 'THE BLINDSPOTS', rightLayout.innerX, rightLayout.kickerY, rightLayout.innerW);
        addHeadline(slide, 'Questions we must answer next', rightLayout.innerX, rightLayout.headlineY, rightLayout.innerW, PANEL_HEADLINE_H);
        addNativeBulletList(slide, blindspotItems, {
            x: rightLayout.innerX,
            y: rightLayout.bodyY,
            w: rightLayout.innerW,
            h: rightLayout.bodyH,
            fontSize: TYPO.body,
            lineSpacing: 16,
            color: THEME.primary,
            bullet: true,
        });
        return;
    }

    // No blindspots — expand competitive narrative to full slide width.
    addPanel(slide, MARGIN_X, BODY_TOP, BODY_W, BODY_H);
    const fullLayout = panelContentLayout(MARGIN_X, BODY_TOP, BODY_W, BODY_H);
    addKicker(slide, 'COMPETITIVE LANDSCAPE', fullLayout.innerX, fullLayout.kickerY, fullLayout.innerW);
    addHeadline(slide, competitiveHeadline, fullLayout.innerX, fullLayout.headlineY, fullLayout.innerW, PANEL_HEADLINE_H);
    addNativeBulletList(slide, competitiveBullets, {
        x: '5%',
        y: fullLayout.bodyY,
        w: '90%',
        h: fullLayout.bodyH,
        fontSize: TYPO.body,
        lineSpacing: 16,
        color: THEME.primary,
        bulletColor: THEME.accent,
        emptyText: 'No competitive landscape captured yet.',
    });
}

// ---------------------------------------------------------------------------
// Slide 4 — Strategic Entry Points (single 2-up slide)
// ---------------------------------------------------------------------------

/**
 * Strategic Entry Points — exactly ONE slide with two percent columns.
 * entry_points[0] → left (5%), entry_points[1] → right (53%). Additional
 * profiles are ignored for the exec readout (no addSlide pagination).
 *
 * @param {PptxGenJS} pptx
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildEntryPointsSlide(pptx, ctx, highlight, pageNum, totalSlides) {
    const slide = addContentSlide(pptx);
    addContentSlideChrome(slide, 'Strategic Entry Points', pageNum, totalSlides);

    const rawPoints = ctx.rawEntryPoints.filter(isPlainObject);
    if (rawPoints.length === 0) {
        slide.addText('No target profiles captured yet — open the Strategic Entry Points carousel in the plan canvas.', {
            x: '5%',
            y: '28%',
            w: '90%',
            h: '12%',
            ...BODY_TEXT_BASE,
            italic: true,
            color: THEME.softMuted,
            align: 'center',
        });
        return;
    }

    // Hard-bind both columns on this single slide object — never loop addSlide.
    const columns = [
        { x: '5%', w: '42%', point: rawPoints[0] },
        { x: '53%', w: '42%', point: rawPoints[1] },
    ];

    columns.forEach((col, index) => {
        if (!isPlainObject(col.point)) return;
        const profile = mapEntryPointToProfile(col.point, index, highlight);
        renderEntryProfileColumnPercent(slide, profile, col.x, col.w);
    });
}

/**
 * @param {Record<string, unknown>} point
 * @param {number} index
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 */
function mapEntryPointToProfile(point, index, highlight) {
    const name = String(point.contact_name ?? '').trim() || `Contact ${index + 1}`;
    const aiByName = new Map();
    (highlight.slides.battlefield.entry_points || []).forEach((entry) => {
        if (entry && entry.name) {
            aiByName.set(String(entry.name).trim().toLowerCase(), entry);
        }
    });
    const aiMatch = aiByName.get(name.toLowerCase());
    return {
        name,
        operational_pain: String(point.operational_pain ?? '').trim(),
        conversation_wedge: String(point.conversation_wedge ?? '').trim(),
        human_context: String(point.human_context ?? '').trim(),
        badges: aiMatch ? String(aiMatch.badges ?? '').trim() : '',
    };
}

/**
 * Render one Target Profile column using percent geometry (slide 4 spec).
 *
 * @param {import('pptxgenjs').Slide} slide
 * @param {ReturnType<typeof mapEntryPointToProfile>} profile
 * @param {string} colX
 * @param {string} colW
 */
function renderEntryProfileColumnPercent(slide, profile, colX, colW) {
    addPanel(slide, colX, '14%', colW, '78%');

    let bodyY = '20%';
    slide.addText(profile.name || 'Unnamed Contact', {
        x: colX,
        y: '15%',
        w: colW,
        h: '5%',
        fontSize: TYPO.subheader,
        bold: true,
        color: THEME.primary,
        fontFace: THEME.font,
        valign: 'top',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });

    if (profile.badges) {
        slide.addText(profile.badges.toUpperCase(), {
            x: colX,
            y: '19%',
            w: colW,
            h: '4%',
            fontSize: TYPO.kicker,
            bold: true,
            color: THEME.secondary,
            fontFace: THEME.font,
            charSpacing: 1.5,
            valign: 'top',
            breakLine: true,
            margin: 0,
            autoFit: false,
        });
        bodyY = '24%';
    }

    slide.addText(buildEntryProfileRichRuns(profile), {
        x: colX,
        y: bodyY,
        w: colW,
        h: '68%',
        valign: 'top',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });
}

/**
 * Build pptxgenjs rich-text runs for one target profile column.
 *
 * @param {ReturnType<typeof mapEntryPointToProfile>} profile
 * @returns {import('pptxgenjs').TextProps[]}
 */
function buildEntryProfileRichRuns(profile) {
    const sections = [
        { label: 'Operational Pain', value: profile.operational_pain },
        { label: 'Conversation Wedge', value: profile.conversation_wedge },
        { label: TACTICAL_UX_LABELS.humanContext, value: profile.human_context },
    ];

    const runs = [];
    sections.forEach((section, index) => {
        const body = String(section.value ?? '').trim() || '—';
        runs.push({
            text: `${section.label}:\n`,
            options: {
                bold: true,
                fontSize: TYPO.body,
                color: themeHex('accent'),
                fontFace: THEME.font,
            },
        });
        runs.push({
            text: index < sections.length - 1 ? `${body}\n\n` : body,
            options: {
                fontSize: TYPO.body,
                color: themeHex('secondary'),
                fontFace: THEME.font,
                italic: body === '—',
            },
        });
    });
    return runs;
}

// ---------------------------------------------------------------------------
// Slide 5 — Execution Roadmap
// ---------------------------------------------------------------------------
// Top half (58%): 30/60/90 plan rendered via addTable.
// Bottom half (42%): Strategic Signals as a bulleted list with date prefixes.
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildExecutionRoadmapSlide(pptx, highlight, ctx, pageNum, totalSlides) {
    const slide = addContentSlide(pptx);
    addContentSlideChrome(slide, 'Execution Roadmap', pageNum, totalSlides);

    const topH = BODY_H * 0.58 - GAP / 2;
    const bottomH = BODY_H * 0.42 - GAP / 2;
    const topY = BODY_TOP;
    const bottomY = BODY_TOP + topH + GAP;

    // TOP — 30/60/90 plan table.
    addPanel(slide, MARGIN_X, topY, BODY_W, topH);
    addKicker(slide, '30 / 60 / 90 PLAN', MARGIN_X + 0.30, topY + 0.18, BODY_W - 0.6);

    const horizons = [
        { period: 'NEXT 30 DAYS', block: highlight.slides.execution?.plan_30, fallback: ctx.plan306090.days_30 },
        { period: 'DAY 31–60',    block: highlight.slides.execution?.plan_60, fallback: ctx.plan306090.days_60 },
        { period: 'DAY 61–90',    block: highlight.slides.execution?.plan_90, fallback: ctx.plan306090.days_90 },
    ];
    const cellRows = horizons.map((h) => composePlanCellLines(h.block, h.fallback));

    const commitments = ctx.plan306090.client_commitments;
    const hasCommitments = commitments.length > 0;
    const tableX = MARGIN_X + 0.25;
    const tableY = topY + 0.65;
    const tableW = BODY_W - 0.50;
    const tableH = hasCommitments ? topH - 1.55 : topH - 0.85;
    const colW = tableW / 3;

    // Header row — uppercase period labels with accent fill (brand teal).
    const headerRow = horizons.map((h) => ({
        text: h.period,
        options: {
            bold: true,
            color: 'FFFFFF',
            fill: { color: THEME.accent },
            align: 'center',
            valign: 'middle',
            fontSize: 11,
            fontFace: THEME.font,
            charSpacing: 1.5,
        },
    }));

    // Body row — each cell holds a small bulleted prose block.
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
                options: { italic: true, color: THEME.softMuted, fontFace: THEME.font, fontSize: 10 },
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
        autoPage: false,
    });

    if (hasCommitments) {
        const giveGetY = tableY + tableH + 0.12;
        slide.addText(formatClientCommitmentsLabel().toUpperCase(), {
            x: MARGIN_X + 0.30,
            y: giveGetY,
            w: BODY_W - 0.60,
            h: 0.22,
            fontSize: TYPO.kicker,
            bold: true,
            color: THEME.accent,
            fontFace: THEME.font,
            valign: 'top',
            breakLine: true,
            margin: 0,
            autoFit: false,
        });
        addNativeBulletList(slide, commitments, {
            x: MARGIN_X + 0.30,
            y: giveGetY + 0.26,
            w: BODY_W - 0.60,
            h: topY + topH - (giveGetY + 0.26) - 0.12,
            fontSize: TYPO.body,
            lineSpacing: 16,
            color: THEME.primary,
            bullet: true,
            fallbackItems: ['No client commitments documented.'],
        });
    }

    // BOTTOM — Strategic Signals.
    addPanel(slide, MARGIN_X, bottomY, BODY_W, bottomH);
    addKicker(slide, 'STRATEGIC SIGNALS', MARGIN_X + 0.30, bottomY + 0.18, BODY_W - 0.6);

    const signals = Array.isArray(highlight.slides.execution?.signals)
        ? highlight.slides.execution.signals
            .filter((s) => s && String(s.headline ?? '').trim())
            .slice(0, MAX_SIGNALS)
        : [];

    if (signals.length === 0) {
        slide.addText('No recent strategic signals — log one from the Interaction Log to surface it here.', {
            x: '4%',
            y: '72%',
            w: '92%',
            h: '10%',
            ...BODY_TEXT_BASE,
            italic: true,
            color: THEME.softMuted,
        });
        return;
    }

    const signalsX = MARGIN_X + 0.30;
    const signalsW = BODY_W - 0.60;
    const signalsY = bottomY + 0.55;
    const signalsH = bottomY + bottomH - signalsY - 0.22;

    const runs = signals.map((signal, idx) => {
        const dateLabel = String(signal.date_label ?? '').trim();
        const headline = String(signal.headline ?? '').trim();
        const line = dateLabel ? `${dateLabel.toUpperCase()}  ${headline}` : headline;
        return {
            text: line,
            options: {
                bullet: { code: '2022', color: THEME.accent },
                breakLine: idx < signals.length - 1,
                color: THEME.primary,
                fontSize: TYPO.body,
                fontFace: THEME.font,
            },
        };
    });

    slide.addText(runs, {
        x: signalsX,
        y: signalsY,
        w: signalsW,
        h: signalsH,
        valign: 'top',
        breakLine: true,
        lineSpacing: 16,
        margin: [0, 0, 0, 0.12],
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

    return String(rawText ?? '')
        .split(/\r?\n+/)
        .map((line) => line.replace(/^[\s]*(?:[-*•]\s+|\d+[.)]\s+)/, '').trim())
        .filter(Boolean)
        .slice(0, MAX_PLAN_BULLETS);
}

// ---------------------------------------------------------------------------
// Per-slide chrome (title + accent rule + page number)
// ---------------------------------------------------------------------------

/**
 * Add a content slide bound to the master. Convenience wrapper around
 * `pptx.addSlide` so every content slide consistently attaches the
 * master and inherits the bg / logo / footer chrome.
 *
 * @param {PptxGenJS} pptx
 */
function addContentSlide(pptx) {
    return pptx.addSlide({ masterName: MASTER_NAME });
}

/**
 * Per-slide chrome — the slide-specific title, accent rule, and
 * manually-injected page number. The master already drew the background,
 * logo, footer rule, and running brand text; we layer the dynamic bits
 * here so they re-render per slide.
 *
 * @param {import('pptxgenjs').Slide} slide
 * @param {string} slideTitle
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function addContentSlideChrome(slide, slideTitle, pageNum, totalSlides) {
    // Slide-specific title.
    slide.addText(slideTitle, {
        x: '4%',
        y: '7%',
        w: '78%',
        h: '6%',
        fontSize: TYPO.header,
        bold: true,
        color: THEME.primary,
        fontFace: THEME.font,
        valign: 'top',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });

    // Accent rule under the title — brand teal, slightly thicker than
    // the footer hairline so the eye reads it as a "section open" cue.
    slide.addShape('line', {
        x: MARGIN_X,
        y: HEADER_DIVIDER_Y,
        w: BODY_W,
        h: 0,
        line: { color: THEME.accent, width: 1.25 },
    });

    // Manual page-number on the right side of the footer band. The
    // master draws the hairline and the brand text; this draws the
    // "N / total" stamp without involving pptxgenjs's slideNumber
    // placeholder (which would include the cover slide in the count).
    slide.addText(`${pageNum} / ${totalSlides}`, {
        x: '50%',
        y: '96%',
        w: '46%',
        h: '3%',
        fontSize: TYPO.kicker,
        bold: true,
        color: THEME.secondary,
        fontFace: THEME.font,
        align: 'right',
        valign: 'middle',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });
}

/**
 * Rounded-rect panel used as the surface for every content card on the
 * light deck. Keeping every panel in one helper guarantees consistent
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
 * Small uppercase "kicker" label above headlines / panels.
 *
 * @param {import('pptxgenjs').Slide} slide
 */
function addKicker(slide, text, x, y, w) {
    slide.addText(text, {
        x,
        y,
        w,
        h: '3%',
        fontSize: TYPO.kicker,
        bold: true,
        color: THEME.accent,
        fontFace: THEME.font,
        charSpacing: 2,
        valign: 'top',
        breakLine: true,
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
        h: typeof h === 'number' ? h : PANEL_HEADLINE_H,
        fontSize: TYPO.subheader,
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
 * Used on slide 3 (Blindspots, Competitive bullets) where we want the
 * native PowerPoint bullet styling rather than the inline-glyph approach
 * (·) we use elsewhere.
 *
 * @param {import('pptxgenjs').Slide} slide
 * @param {string[]} items
 * @param {{ x: number | string, y: number | string, w: number | string, h: number | string, fontSize?: number, lineSpacing?: number, color?: string, bullet?: boolean, bulletColor?: string, emptyText?: string, fallbackItems?: string[] }} opts
 */
function addNativeBulletList(slide, items, opts) {
    const clean = (items || []).map((i) => String(i ?? '').trim()).filter(Boolean);
    const lines = clean.length > 0
        ? clean
        : (opts.fallbackItems || []).map((i) => String(i ?? '').trim()).filter(Boolean);

    if (lines.length === 0) {
        slide.addText(opts.emptyText || '—', {
            x: opts.x,
            y: opts.y,
            w: opts.w,
            h: opts.h,
            fontSize: opts.fontSize ?? TYPO.body,
            italic: true,
            color: THEME.softMuted,
            fontFace: THEME.font,
            valign: 'top',
            breakLine: true,
            margin: 0,
            autoFit: false,
        });
        return;
    }

    const bulletOpt = opts.bullet === true
        ? true
        : { code: '2022', color: opts.bulletColor ?? THEME.accent };

    slide.addText(
        lines.map((line, idx) => ({
            text: line,
            options: {
                bullet: bulletOpt,
                breakLine: idx < lines.length - 1,
                color: opts.color ?? THEME.primary,
                fontSize: opts.fontSize ?? TYPO.body,
                fontFace: THEME.font,
            },
        })),
        {
            x: opts.x,
            y: opts.y,
            w: opts.w,
            h: opts.h,
            valign: 'top',
            breakLine: true,
            lineSpacing: opts.lineSpacing ?? 16,
            margin: 0,
            autoFit: false,
        }
    );
}

// ---------------------------------------------------------------------------
// Asset loading
// ---------------------------------------------------------------------------
// Logos are referenced by path in the PDF templates because the HTML
// renderer can fetch them directly. PPTX needs base64 data URLs, so we
// fetch + convert here. Results are cached at module scope so back-to-
// back exports don't re-download.
// ---------------------------------------------------------------------------

/**
 * @param {string} path
 * @returns {Promise<string | null>}
 */
async function loadLogoDataUrl(path) {
    if (!path) return null;
    if (_logoDataUrlCache[path]) return _logoDataUrlCache[path];
    try {
        const response = await fetch(path);
        if (!response.ok) return null;
        const blob = await response.blob();
        const url = await blobToDataUrl(blob);
        _logoDataUrlCache[path] = url;
        return url;
    } catch {
        return null;
    }
}

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * @param {{ name?: string } | null} account
 */
function buildPptxFilename(account) {
    const safeName = String(account?.name || 'Account').replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
    return `${safeName}_Strategic_Account_Plan.pptx`;
}

function getPptxGen() {
    if (typeof PptxGenJS === 'undefined') {
        throw new Error('PptxGenJS is not loaded.');
    }
    return PptxGenJS;
}

/**
 * Clamp a 1-5 slider value to the valid integer range, defaulting to 3
 * for malformed inputs. Used for both relationship momentum and
 * psychology sliders.
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
 * it had to be cut.
 *
 * @param {string} text
 * @param {number} max
 */
function truncate(text, max) {
    const trimmed = String(text ?? '').trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}
