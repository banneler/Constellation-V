/**
 * Strategic Account OS — native PowerPoint export (PptxGenJS).
 *
 * Produces a multi-slide "Strategic Account Plan" deck on a 16:9 canvas
 * styled to match the premium "Editorial Print" aesthetic of our PDF
 * dossier (see js/account-plan-export-templates.js for the visual
 * reference). The deck opens with a geometric GPC-branded cover page,
 * followed by content slides that render against a clean white master.
 *
 * Deck order:
 *   0. Cover
 *   1. Account Snapshot
 *   2. Executive Summary (The Big Play)
 *   3. How They Buy & Competing Priorities (Smart Drop)
 *   4. White Space & Expansion (Smart Drop)
 *   5. Influence Mapping (Smart Drop)
 *   6+. Strategic Entry Points (paginated)
 *   N. The Battlefield
 *   N+1. Execution Roadmap
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
 *   • Slide 4+ (Target Profiles) paginates like the dossier PDF: slim
 *     triple columns, roomier double columns, continuation subheader only.
 */

import {
    GPC_BRAND,
    GPC_LOGO_NAVY,
    GPC_LOGO_WHITE,
    formatGpcFooterDate,
} from './account-plan-export-brand.js';
import { normalizePlan, getWhiteSpaceRows } from './account-plan-data.js';
import {
    getEntryPointLayoutMode,
    planEntryPointPageRanges,
} from './account-plan-entry-point-layout.js';
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

const MAX_BLINDSPOTS = 8;
const MAX_SIGNALS = 8;
const MAX_PLAN_BULLETS = 3;
const MAX_WHITE_SPACE_ROWS = 4;

/** Gap between entry-point card and floating next-move callout below it. */
const ENTRY_NEXT_MOVE_FLOAT_GAP = 0.14;
/** Main profile card uses this share of the column band; remainder goes to next-move callout. */
const ENTRY_CARD_HEIGHT_RATIO = 0.80;

/** Score-indexed fill + label colors for the momentum KPI gauge. */
const MOMENTUM_SCORE_STYLES = Object.freeze([
    { fill: '64748B', text: 'FFFFFF' },
    { fill: 'B45309', text: 'FFFFFF' },
    { fill: stripHash(GPC_BRAND.teal), text: 'FFFFFF' },
    { fill: stripHash(GPC_BRAND.lime), text: '0F172A' },
    { fill: stripHash(GPC_BRAND.navyDeep), text: 'FFFFFF' },
]);

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
        (pageNum, totalSlides) => buildAccountSnapshotSlide(pptx, highlight, ctx, account, pageNum, totalSlides),
        (pageNum, totalSlides) => buildExecutiveSummarySlide(pptx, highlight, ctx, pageNum, totalSlides),
    ];
    if (!isPsychologyTensionsSlideEmpty(ctx)) {
        contentSlideBuilders.push(
            (pageNum, totalSlides) => buildPsychologyTensionsSlide(pptx, ctx, pageNum, totalSlides)
        );
    }
    if (!isWhiteSpaceSlideEmpty(ctx, highlight)) {
        contentSlideBuilders.push(
            (pageNum, totalSlides) => buildWhiteSpaceSlide(pptx, highlight, ctx, pageNum, totalSlides)
        );
    }
    if (!isInfluenceSlideEmpty(ctx, highlight)) {
        contentSlideBuilders.push(
            (pageNum, totalSlides) => buildInfluenceMappingSlide(pptx, highlight, ctx, pageNum, totalSlides)
        );
    }
    buildEntryPointsSlideBuilders(pptx, ctx, highlight).forEach((builder) => {
        contentSlideBuilders.push(builder);
    });
    contentSlideBuilders.push(
        (pageNum, totalSlides) => buildBattlefieldSlide(pptx, highlight, ctx, pageNum, totalSlides),
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
// Matches the GPC Large Deal Review title slide: navy field + three diagonal
// wedges (navyDeep / teal / lime) on the right, plus a subtle top-left
// corner accent. Same gradient logic as .ap-export-gpc-cover-art in the PDF.
// ---------------------------------------------------------------------------

/**
 * Custom polygon on the cover slide (pptxgenjs custGeom, normalized 0–1 points).
 *
 * @param {import('pptxgenjs').Slide} slide
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {Array<{ x: number, y: number }>} points
 * @param {string} fillColor
 */
function addCoverPolygon(slide, x, y, w, h, points, fillColor) {
    slide.addShape('custGeom', {
        x,
        y,
        w,
        h,
        fill: { color: fillColor },
        line: { width: 0 },
        points,
    });
}

/**
 * Diagonal wedge artwork for the cover — mirrors the demo title slide geometry.
 * @param {import('pptxgenjs').Slide} slide
 */
function addCoverGeometricArt(slide) {
    // (1) Main teal wedge — bleeds left of the art band (~46% slide) like the demo.
    addCoverPolygon(slide, SLIDE_W * 0.46, 0, SLIDE_W * 0.54, SLIDE_H, [
        { x: 0, y: 0.14 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0.22, y: 0.84 },
    ], THEME.accent);

    // (2) Navy-deep upper wedge — dark slab behind the logo (155° band).
    addCoverPolygon(slide, SLIDE_W * 0.56, 0, SLIDE_W * 0.44, SLIDE_H * 0.54, [
        { x: 0.08, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0.42, y: 0.52 },
    ], THEME.accentDark);

    // (3) Lime bottom-right accent (125° band).
    addCoverPolygon(slide, SLIDE_W * 0.60, SLIDE_H * 0.48, SLIDE_W * 0.40, SLIDE_H * 0.52, [
        { x: 0, y: 0.06 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0.10, y: 1 },
    ], THEME.accentAlt);

    // (4) Subtle top-left L-corner accent from the demo template.
    const cornerX = 0.42;
    const cornerY = 0.38;
    const cornerLen = 0.95;
    slide.addShape('line', {
        x: cornerX,
        y: cornerY,
        w: cornerLen,
        h: 0,
        line: { color: 'FFFFFF', width: 1.25, transparency: 18 },
    });
    slide.addShape('line', {
        x: cornerX,
        y: cornerY,
        w: 0,
        h: cornerLen,
        line: { color: 'FFFFFF', width: 1.25, transparency: 18 },
    });
}

/**
 * @param {PptxGenJS} pptx
 * @param {string} accountName
 * @param {string | null} whiteLogo
 */
function buildCoverSlide(pptx, accountName, whiteLogo) {
    const slide = pptx.addSlide();
    slide.background = { color: THEME.coverBg };

    addCoverGeometricArt(slide);
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

    const momentum = resolveMomentumFromInteractionLog(sections);
    const score = momentum.score;

    const psychology = isPlainObject(sections.psychology) ? sections.psychology : {};
    const tensions = isPlainObject(sections.strategic_tensions) ? sections.strategic_tensions : {};
    const competitive = isPlainObject(sections.competitive_landscape) ? sections.competitive_landscape : {};
    const pursuit = isPlainObject(sections.pursuit_thesis) ? sections.pursuit_thesis : {};
    const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};
    const snapshot = isPlainObject(sections.account_snapshot) ? sections.account_snapshot : {};
    const whiteSpace = isPlainObject(sections.white_space) ? sections.white_space : {};
    const influence = isPlainObject(sections.influence_mapping) ? sections.influence_mapping : {};

    return {
        score,
        momentumNarrative: momentum.narrative,
        psychology,
        snapshot,
        whiteSpace,
        whiteSpaceRows: getWhiteSpaceRows(whiteSpace),
        influence,
        accessPath: isPlainObject(influence.access_path) ? influence.access_path : {},
        exportSignals: extractExportSignals(sections),
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
        landAndExpand: isPlainObject(sections.land_and_expand) ? sections.land_and_expand : {},
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
                score: clampScale(entry.momentum_score, 3),
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
 * Signals-only export rows from interaction_log (no CRM activities).
 * @param {Record<string, unknown>} sections
 * @returns {{ dateLabel: string, headline: string }[]}
 */
function extractExportSignals(sections) {
    const log = Array.isArray(sections.interaction_log) ? sections.interaction_log : [];
    /** @type {Map<string, { dateLabel: string, headline: string, dateMs: number }>} */
    const byId = new Map();

    log.forEach((entry) => {
        if (!isPlainObject(entry)) return;
        const source = entry.source != null ? String(entry.source).toLowerCase() : '';
        if (source === 'activity' || source === 'crm') return;
        const text = String(entry.text ?? entry.interaction ?? entry.key_insight ?? '').trim();
        if (!text) return;
        const id = entry.id != null ? String(entry.id) : crypto.randomUUID();
        const dateMs = new Date(String(entry.date ?? '')).getTime();
        const ms = Number.isNaN(dateMs) ? 0 : dateMs;
        const existing = byId.get(id);
        if (!existing || ms >= existing.dateMs) {
            byId.set(id, {
                dateLabel: formatShortDateLabel(entry.date),
                headline: truncate(text, 140),
                dateMs: ms,
            });
        }
    });

    return [...byId.values()]
        .sort((a, b) => b.dateMs - a.dateMs)
        .map(({ dateLabel, headline }) => ({ dateLabel, headline }));
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatShortDateLabel(value) {
    const date = new Date(String(value ?? ''));
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 */
function isWhiteSpaceSlideEmpty(ctx, highlight) {
    const hook = highlight.slides.battlefield?.white_space;
    if (hook && (String(hook.headline ?? '').trim() || String(hook.opportunity ?? '').trim())) {
        return false;
    }
    const wedgeParts = [
        ctx.whiteSpace.initial_entry,
        ctx.whiteSpace.trust_creation,
        ctx.whiteSpace.expansion_path,
    ].map((v) => String(v ?? '').trim()).filter(Boolean);
    if (wedgeParts.length > 0) return false;
    return !ctx.whiteSpaceRows.some((row) => (
        String(row.area ?? '').trim() || String(row.opportunity ?? '').trim()
    ));
}

/**
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 */
function isInfluenceSlideEmpty(ctx, highlight) {
    const hooks = highlight.slides.battlefield?.influence;
    if (hooks && (
        String(hooks.executive_hook ?? '').trim()
        || String(hooks.champions_hook ?? '').trim()
        || String(hooks.access_path_hook ?? '').trim()
    )) {
        return false;
    }
    const influence = ctx.influence;
    const prose = [
        influence.political_dynamics,
        influence.invisible_org_chart,
        ctx.accessPath.strategy,
        ctx.accessPath.desired,
        ctx.accessPath.bridge,
        ctx.accessPath.current,
    ].map((v) => String(v ?? '').trim()).filter(Boolean);
    if (prose.length > 0) return false;
    const tiers = ['executive', 'mid_level', 'technical'];
    return !tiers.some((tier) => Array.isArray(influence[tier]) && influence[tier].length > 0);
}

/**
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @returns {string[]}
 */
function resolvePainSignalBullets(ctx, highlight) {
    const aiBullets = Array.isArray(highlight.slides.situation?.pain_signals?.bullets)
        ? highlight.slides.situation.pain_signals.bullets
            .map((b) => String(b ?? '').trim())
            .filter(Boolean)
        : [];
    if (aiBullets.length > 0) return aiBullets.slice(0, 4);

    const selected = Array.isArray(ctx.pursuit.operational_pain_selected)
        ? ctx.pursuit.operational_pain_selected.map((p) => String(p ?? '').trim()).filter(Boolean)
        : [];
    const notes = String(ctx.pursuit.operational_pain_notes ?? '').trim();
    const bullets = [...selected];
    if (notes) bullets.push(truncate(notes, 120));
    return bullets.slice(0, 4);
}

/**
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @returns {string}
 */
function resolveEntrenchmentMoat(ctx, highlight) {
    const aiMoat = String(highlight.slides.execution?.entrenchment_moat ?? '').trim();
    if (aiMoat) return truncate(aiMoat, 240);

    const moatPills = Array.isArray(ctx.competitive.moat_pills)
        ? ctx.competitive.moat_pills.map((p) => String(p ?? '').trim()).filter(Boolean)
        : [];
    const compound = String(ctx.competitive.compound_relationships ?? '').trim();
    const narrative = String(ctx.competitive.difficult_to_remove ?? '').trim();
    const combined = [moatPills.join(', '), compound, narrative].filter(Boolean).join(' — ');
    return truncate(combined, 240);
}

/**
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @returns {{ label: string, value: string }[]}
 */
function resolveExpansionWedgeParts(ctx) {
    const land = ctx.landAndExpand || {};
    const parts = [
        {
            label: 'Initial Entry',
            value: String(ctx.whiteSpace.initial_entry ?? land.initial_entry ?? '').trim(),
        },
        {
            label: 'Trust Creation',
            value: String(ctx.whiteSpace.trust_creation ?? land.trust_creation ?? '').trim(),
        },
        {
            label: 'Expansion Path',
            value: String(ctx.whiteSpace.expansion_path ?? land.expansion_path ?? '').trim(),
        },
    ].filter((part) => part.value);

    if (parts.length > 0) return parts;

    const valueNotes = ctx.whiteSpaceRows
        .map((row) => String(row.value_notes ?? '').trim())
        .filter(Boolean)
        .slice(0, 2);
    if (valueNotes.length > 0) {
        return [{ label: 'Expansion Wedge', value: valueNotes.join(' ') }];
    }

    const expansionPotential = String(ctx.snapshot.expansion_potential ?? '').trim();
    if (expansionPotential) {
        return [{ label: 'Expansion Potential', value: expansionPotential }];
    }

    return [];
}

/**
 * Prefer richer raw plan copy over short AI hooks when the plan has more detail.
 * @param {string} aiCopy
 * @param {string} rawCopy
 * @param {number} [maxLen]
 */
function pickInfluenceColumnCopy(aiCopy, rawCopy, maxLen = 420) {
    const ai = String(aiCopy ?? '').trim();
    const raw = String(rawCopy ?? '').trim();
    const genericChampions = /^Mid-level champions can compound operational trust\.?$/i;

    if (raw && (!ai || raw.length > ai.length + 24)) {
        return truncate(raw, maxLen);
    }
    if (ai && !genericChampions.test(ai)) {
        return truncate(ai, maxLen);
    }
    if (raw) return truncate(raw, maxLen);
    return truncate(ai, maxLen);
}

/**
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 */
function resolveChampionsInfluenceCopy(ctx, highlight) {
    const champions = Array.isArray(highlight.slides.battlefield?.influence?.champions)
        ? highlight.slides.battlefield.influence.champions
            .filter((item) => item && String(item.hook ?? '').trim())
        : [];

    if (champions.length > 0) {
        return champions
            .slice(0, 4)
            .map((item) => `${String(item.name ?? 'Champion').trim()}: ${String(item.hook).trim()}`)
            .join('\n\n');
    }

    const ai = String(highlight.slides.battlefield?.influence?.champions_hook ?? '').trim();
    const midLevel = Array.isArray(ctx.influence.mid_level) ? ctx.influence.mid_level : [];
    const rawNotes = midLevel
        .map((entry) => {
            if (!isPlainObject(entry)) return '';
            return [
                entry.notes,
                entry.strategic_priorities,
                entry.personality_style,
            ]
                .map((v) => String(v ?? '').trim())
                .filter(Boolean)
                .join(' — ');
        })
        .filter(Boolean)
        .join(' ');

    return pickInfluenceColumnCopy(ai, rawNotes, 420);
}

/**
 * Build rich-text runs for the Mid-Level Champions column (name + hook per person).
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @returns {import('pptxgenjs').TextProps[]}
 */
function buildChampionsColumnRuns(ctx, highlight) {
    const champions = Array.isArray(highlight.slides.battlefield?.influence?.champions)
        ? highlight.slides.battlefield.influence.champions
            .filter((item) => item && String(item.hook ?? '').trim())
            .slice(0, 4)
        : [];

    if (champions.length > 0) {
        const runs = [];
        champions.forEach((item, index) => {
            runs.push({
                text: `${String(item.name ?? 'Champion').trim()}\n`,
                options: {
                    bold: true,
                    fontSize: TYPO.body,
                    color: themeHex('primary'),
                    fontFace: THEME.font,
                },
            });
            runs.push({
                text: index < champions.length - 1
                    ? `${String(item.hook).trim()}\n\n`
                    : String(item.hook).trim(),
                options: {
                    fontSize: TYPO.body,
                    color: themeHex('secondary'),
                    fontFace: THEME.font,
                },
            });
        });
        return runs;
    }

    const fallback = resolveChampionsInfluenceCopy(ctx, highlight);
    return [{
        text: fallback || 'Not captured yet.',
        options: {
            fontSize: TYPO.body,
            color: fallback ? themeHex('secondary') : themeHex('softMuted'),
            fontFace: THEME.font,
            italic: !fallback,
        },
    }];
}

/**
 * @param {string[]} bullets
 * @returns {string[]}
 */
function cleanCompetitiveBullets(bullets) {
    const clean = (bullets || []).map((b) => String(b ?? '').trim()).filter(Boolean);
    const seen = new Set();
    return clean.filter((line) => {
        const key = line.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        // Drop standalone pill echo lines when the narrative already covers positioning/moat.
        if (/^positioning:\s/i.test(line) && clean.some((other) => other !== line && other.length > line.length + 40)) {
            return false;
        }
        if (/^moat:\s/i.test(line) && clean.some((other) => /moat|contract|dependency|switching cost/i.test(other) && other !== line)) {
            return false;
        }
        return true;
    });
}

/**
 * @param {Record<string, unknown>} snapshot
 * @returns {{ label: string, value: string }[]}
 */
function getFilledSnapshotStats(snapshot) {
    const defs = [
        { key: 'relationship_status', label: 'Relationship Status' },
        { key: 'ai_cloud_maturity', label: 'AI / Cloud Maturity' },
        { key: 'strategic_patience', label: 'Strategic Patience' },
        { key: 'existing_providers', label: 'Existing Providers' },
        { key: 'expansion_potential', label: 'Expansion Potential' },
    ];
    return defs
        .map(({ key, label }) => ({
            label,
            value: String(snapshot[key] ?? '').trim(),
        }))
        .filter((item) => item.value);
}

const SNAPSHOT_COMPACT_STAT_KEYS = Object.freeze([
    'relationship_status',
    'ai_cloud_maturity',
    'strategic_patience',
]);

const SNAPSHOT_NARRATIVE_STAT_KEYS = Object.freeze([
    'existing_providers',
    'expansion_potential',
]);

/**
 * @param {Record<string, unknown>} snapshot
 * @param {readonly string[]} keys
 * @returns {{ label: string, value: string }[]}
 */
function getSnapshotStatsByKeys(snapshot, keys) {
    const labelMap = {
        relationship_status: 'Relationship Status',
        ai_cloud_maturity: 'AI / Cloud Maturity',
        strategic_patience: 'Strategic Patience',
        existing_providers: 'Existing Providers',
        expansion_potential: 'Expansion Potential',
    };
    return keys
        .map((key) => ({
            label: labelMap[key] || key,
            value: String(snapshot[key] ?? '').trim(),
        }))
        .filter((item) => item.value);
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
// Slide 1 — Account Snapshot
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {{ name?: string, industry?: string, is_customer?: boolean } | null} account
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildAccountSnapshotSlide(pptx, highlight, ctx, account, pageNum, totalSlides) {
    const slide = addContentSlide(pptx);
    addContentSlideChrome(slide, 'Account Snapshot', pageNum, totalSlides);

    const accountContext = highlight.slides.situation?.account_context ?? {};
    const tier = String(accountContext.tier ?? ctx.snapshot.tier ?? '').trim();
    const priority = String(accountContext.priority ?? ctx.snapshot.pursuit_priority ?? '').trim();
    const executiveNarrative = truncate(
        String(highlight.slides.situation?.executive_narrative ?? '').trim()
            || String(ctx.pursuit.executive_narrative ?? '').trim(),
        240
    );
    const compactStats = getSnapshotStatsByKeys(ctx.snapshot, SNAPSHOT_COMPACT_STAT_KEYS);
    const narrativeStats = getSnapshotStatsByKeys(ctx.snapshot, SNAPSHOT_NARRATIVE_STAT_KEYS);

    const leftW = BODY_W * 0.62;
    const rightW = BODY_W * 0.33;
    const rightX = MARGIN_X + leftW + (BODY_W - leftW - rightW);

    addPanel(slide, MARGIN_X, BODY_TOP, leftW, BODY_H);
    const leftLayout = panelContentLayout(MARGIN_X, BODY_TOP, leftW, BODY_H);
    addKicker(slide, (account?.name || highlight.account_name || 'Account').toUpperCase(), leftLayout.innerX, leftLayout.kickerY, leftLayout.innerW);

    const chipParts = [
        account?.industry ? String(account.industry).trim() : '',
        account?.is_customer === true ? 'Customer' : account?.is_customer === false ? 'Prospect' : '',
    ].filter(Boolean);
    if (chipParts.length > 0) {
        slide.addText(chipParts.join('  ·  '), {
            x: leftLayout.innerX,
            y: leftLayout.headlineY,
            w: leftLayout.innerW,
            h: 0.28,
            fontSize: TYPO.body,
            color: THEME.secondary,
            fontFace: THEME.font,
            valign: 'top',
            breakLine: true,
            margin: 0,
            autoFit: false,
        });
    }

    let bodyY = leftLayout.bodyY;
    if (compactStats.length > 0) {
        const statH = 0.72;
        const colW = leftLayout.innerW / compactStats.length;
        compactStats.forEach((stat, index) => {
            const cellX = leftLayout.innerX + colW * index;
            slide.addText(stat.label.toUpperCase(), {
                x: cellX,
                y: bodyY,
                w: colW - 0.08,
                h: 0.18,
                fontSize: TYPO.kicker,
                bold: true,
                color: THEME.accent,
                fontFace: THEME.font,
                charSpacing: 1,
                valign: 'top',
                breakLine: true,
                margin: 0,
                autoFit: false,
            });
            slide.addText(stat.value, {
                x: cellX,
                y: bodyY + 0.20,
                w: colW - 0.08,
                h: statH - 0.24,
                fontSize: TYPO.body,
                color: THEME.primary,
                fontFace: THEME.font,
                valign: 'top',
                breakLine: true,
                margin: 0,
                autoFit: false,
            });
        });
        bodyY += statH + 0.08;
    }

    narrativeStats.forEach((stat) => {
        addKicker(slide, stat.label.toUpperCase(), leftLayout.innerX, bodyY, leftLayout.innerW);
        const blockH = stat.label === 'Expansion Potential' ? 0.72 : 0.62;
        slide.addText(stat.value, {
            x: leftLayout.innerX,
            y: bodyY + 0.20,
            w: leftLayout.innerW,
            h: blockH,
            fontSize: 10,
            color: THEME.secondary,
            fontFace: THEME.font,
            valign: 'top',
            breakLine: true,
            margin: 0,
            autoFit: false,
            lineSpacing: 14,
        });
        bodyY += blockH + 0.28;
    });

    if (executiveNarrative) {
        addKicker(slide, 'EXECUTIVE NARRATIVE', leftLayout.innerX, bodyY, leftLayout.innerW);
        slide.addText(executiveNarrative, {
            x: leftLayout.innerX,
            y: bodyY + 0.22,
            w: leftLayout.innerW,
            h: BODY_TOP + BODY_H - (bodyY + 0.22) - PANEL_BOTTOM_PAD,
            fontSize: 10,
            color: THEME.secondary,
            fontFace: THEME.font,
            valign: 'top',
            breakLine: true,
            margin: 0,
            autoFit: false,
            lineSpacing: 14,
        });
    } else if (compactStats.length === 0 && narrativeStats.length === 0) {
        slide.addText('Capture tier, priority, and strategic context in the Account Snapshot section.', {
            x: leftLayout.innerX,
            y: bodyY,
            w: leftLayout.innerW,
            h: 1.0,
            ...BODY_TEXT_BASE,
            italic: true,
            color: THEME.softMuted,
        });
    }

    renderPursuitContextPanel(slide, rightX, BODY_TOP, rightW, BODY_H, tier, priority);
}

// ---------------------------------------------------------------------------
// Slide 2 — Executive Summary (The Big Play)
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
    addContentSlideChrome(slide, TACTICAL_UX_LABELS.pursuitThesis, pageNum, totalSlides);

    const leftW = BODY_W * 0.60;
    const rightW = BODY_W * 0.35;
    const gutter = BODY_W - leftW - rightW;
    const rightX = MARGIN_X + leftW + gutter;
    const painBullets = resolvePainSignalBullets(ctx, highlight);
    const hasPain = painBullets.length > 0;

    const pursuitHeadline = String(highlight.slides.situation?.pursuit_thesis?.headline ?? '').trim()
        || 'Why This Account Matters Now';
    const pursuitProse = resolvePursuitThesisProse(highlight, ctx);
    const actionForcing = ctx.actionForcingEvent;

    addPanel(slide, MARGIN_X, BODY_TOP, leftW, BODY_H);
    const leftLayout = panelContentLayout(MARGIN_X, BODY_TOP, leftW, BODY_H);
    addKicker(slide, TACTICAL_UX_LABELS.pursuitThesis.toUpperCase(), leftLayout.innerX, leftLayout.kickerY, leftLayout.innerW);
    addHeadline(slide, pursuitHeadline, leftLayout.innerX, leftLayout.headlineY, leftLayout.innerW, PANEL_HEADLINE_H);

    const proseY = leftLayout.bodyY;
    let proseH = leftLayout.bodyH;
    if (actionForcing) proseH *= 0.58;
    else if (hasPain) proseH *= 0.58;
    else proseH *= 0.88;

    slide.addText(pursuitProse || 'No big play captured yet.', {
        x: leftLayout.innerX,
        y: proseY,
        w: leftLayout.innerW,
        h: proseH,
        ...BODY_TEXT_BASE,
        lineSpacing: 16,
    });

    let nextY = proseY + proseH + 0.06;
    if (actionForcing) {
        const actionH = hasPain ? leftLayout.bodyH * 0.22 : leftLayout.bodyH * 0.30;
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
            y: nextY,
            w: leftLayout.innerW,
            h: actionH,
            valign: 'top',
            breakLine: true,
            margin: 0,
            autoFit: false,
        });
        nextY += actionH + 0.06;
    }

    if (hasPain) {
        addKicker(slide, 'PAIN SIGNALS', leftLayout.innerX, nextY, leftLayout.innerW);
        addNativeBulletList(slide, painBullets, {
            x: leftLayout.innerX,
            y: nextY + 0.22,
            w: leftLayout.innerW,
            h: BODY_TOP + BODY_H - (nextY + 0.22) - PANEL_BOTTOM_PAD,
            fontSize: TYPO.body,
            lineSpacing: 14,
            color: THEME.primary,
            bulletColor: THEME.accent,
        });
    }

    const momentumNarrative = ctx.momentumNarrative
        || String(highlight.slides.situation?.momentum?.insight ?? '').trim();
    renderMomentumKpiPanel(slide, rightX, BODY_TOP, rightW, BODY_H, ctx.score, momentumNarrative);
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
// White Space & Account Expansion
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildWhiteSpaceSlide(pptx, highlight, ctx, pageNum, totalSlides) {
    const slide = addContentSlide(pptx);
    addContentSlideChrome(slide, 'White Space & Account Expansion', pageNum, totalSlides);

    const halfH = (BODY_H - GAP) / 2;
    const topY = BODY_TOP;
    const bottomY = BODY_TOP + halfH + GAP;

    const wedgeParts = resolveExpansionWedgeParts(ctx);
    const wedgeSummary = String(highlight.slides.battlefield?.white_space?.wedge_summary ?? '').trim();

    addPanel(slide, MARGIN_X, topY, BODY_W, halfH);
    addKicker(slide, 'EXPANSION WEDGE', MARGIN_X + 0.30, topY + 0.18, BODY_W - 0.6);
    if (wedgeSummary || wedgeParts.length > 0) {
        const runs = [];
        if (wedgeSummary) {
            runs.push({
                text: `${wedgeSummary}\n\n`,
                options: {
                    fontSize: TYPO.body,
                    color: themeHex('primary'),
                    fontFace: THEME.font,
                    bold: true,
                },
            });
        }
        wedgeParts.forEach((part, index) => {
            runs.push({
                text: `${part.label}:\n`,
                options: {
                    bold: true,
                    fontSize: TYPO.body,
                    color: themeHex('accent'),
                    fontFace: THEME.font,
                },
            });
            runs.push({
                text: index < wedgeParts.length - 1
                    ? `${String(part.value).trim()}\n\n`
                    : String(part.value).trim(),
                options: {
                    fontSize: TYPO.body,
                    color: themeHex('secondary'),
                    fontFace: THEME.font,
                },
            });
        });
        slide.addText(runs, {
            x: MARGIN_X + 0.30,
            y: topY + 0.55,
            w: BODY_W - 0.60,
            h: halfH - 0.75,
            valign: 'top',
            breakLine: true,
            margin: 0,
            autoFit: false,
        });
    } else {
        slide.addText('Document the expansion wedge in the White Space section.', {
            x: MARGIN_X + 0.30,
            y: topY + 0.55,
            w: BODY_W - 0.60,
            h: halfH - 0.75,
            ...BODY_TEXT_BASE,
            italic: true,
            color: THEME.softMuted,
        });
    }

    const hook = highlight.slides.battlefield?.white_space;
    const hookHeadline = String(hook?.headline ?? 'Top White Space').trim();
    const hookOpportunity = String(hook?.opportunity ?? '').trim();
    const rankedRows = ctx.whiteSpaceRows
        .filter((row) => String(row.area ?? '').trim() || String(row.opportunity ?? '').trim())
        .slice(0, MAX_WHITE_SPACE_ROWS);

    addPanel(slide, MARGIN_X, bottomY, BODY_W, halfH);
    addKicker(slide, 'PRIORITY OPPORTUNITIES', MARGIN_X + 0.30, bottomY + 0.18, BODY_W - 0.6);
    addHeadline(slide, hookHeadline, MARGIN_X + 0.30, bottomY + 0.38, BODY_W - 0.60, 0.34);

    if (rankedRows.length > 0) {
        const tableX = MARGIN_X + 0.25;
        const tableY = bottomY + 0.78;
        const tableW = BODY_W - 0.50;
        const tableH = halfH - 1.00;
        const headerRow = [
            { text: 'AREA', options: { bold: true, color: 'FFFFFF', fill: { color: THEME.accent }, align: 'left', fontSize: 9, fontFace: THEME.font } },
            { text: 'OPPORTUNITY', options: { bold: true, color: 'FFFFFF', fill: { color: THEME.accent }, align: 'left', fontSize: 9, fontFace: THEME.font } },
            { text: 'IMPORTANCE', options: { bold: true, color: 'FFFFFF', fill: { color: THEME.accent }, align: 'center', fontSize: 9, fontFace: THEME.font } },
        ];
        const bodyRows = rankedRows.map((row) => ([
            { text: truncate(String(row.area ?? '—'), 40), options: { fontSize: 10, color: THEME.primary, fontFace: THEME.font } },
            { text: truncate(String(row.opportunity ?? '—'), 120), options: { fontSize: 10, color: THEME.secondary, fontFace: THEME.font } },
            { text: truncate(String(row.operational_importance ?? '—'), 18), options: { fontSize: 10, color: THEME.primary, fontFace: THEME.font, align: 'center' } },
        ]));
        slide.addTable([headerRow, ...bodyRows], {
            x: tableX,
            y: tableY,
            w: tableW,
            h: tableH,
            colW: [tableW * 0.22, tableW * 0.58, tableW * 0.20],
            border: { type: 'solid', color: THEME.panelBorder, pt: 0.75 },
            fontFace: THEME.font,
            autoPage: false,
        });
    } else if (hookOpportunity) {
        slide.addText(hookOpportunity, {
            x: MARGIN_X + 0.30,
            y: bottomY + 0.78,
            w: BODY_W - 0.60,
            h: halfH - 0.95,
            ...BODY_TEXT_BASE,
            lineSpacing: 16,
        });
    }
}

// ---------------------------------------------------------------------------
// Influence Mapping
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildInfluenceMappingSlide(pptx, highlight, ctx, pageNum, totalSlides) {
    const slide = addContentSlide(pptx);
    addContentSlideChrome(slide, 'Influence Mapping', pageNum, totalSlides);

    const hooks = highlight.slides.battlefield?.influence ?? {};
    const accessPathRaw = [
        ctx.accessPath.strategy,
        ctx.accessPath.desired,
        ctx.accessPath.bridge,
        ctx.accessPath.current,
    ].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
    const columns = [
        {
            title: 'Executive Leadership',
            copy: pickInfluenceColumnCopy(
                hooks.executive_hook,
                String(ctx.influence.political_dynamics ?? ctx.influence.invisible_org_chart ?? '').trim()
            ),
        },
        {
            title: 'Mid-Level Champions',
            runs: buildChampionsColumnRuns(ctx, highlight),
            isRuns: true,
        },
        {
            title: 'Access Path',
            copy: pickInfluenceColumnCopy(hooks.access_path_hook, accessPathRaw),
        },
    ];

    const colW = (BODY_W - GAP * 2) / 3;
    columns.forEach((column, index) => {
        const x = MARGIN_X + index * (colW + GAP);
        addPanel(slide, x, BODY_TOP, colW, BODY_H);
        const layout = panelContentLayout(x, BODY_TOP, colW, BODY_H);
        addKicker(slide, column.title.toUpperCase(), layout.innerX, layout.kickerY, layout.innerW);
        if (column.isRuns && Array.isArray(column.runs)) {
            slide.addText(column.runs, {
                x: layout.innerX,
                y: layout.bodyY,
                w: layout.innerW,
                h: layout.bodyH,
                valign: 'top',
                breakLine: true,
                margin: 0,
                autoFit: false,
                lineSpacing: 16,
            });
        } else {
            slide.addText(column.copy || 'Not captured yet.', {
                x: layout.innerX,
                y: layout.bodyY,
                w: layout.innerW,
                h: layout.bodyH,
                ...BODY_TEXT_BASE,
                italic: !column.copy,
                color: column.copy ? THEME.secondary : THEME.softMuted,
                lineSpacing: 16,
            });
        }
    });
}

// ---------------------------------------------------------------------------
// The Battlefield
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
    const moatText = resolveEntrenchmentMoat(ctx, highlight);
    const hasMoat = Boolean(moatText);
    const moatBandH = hasMoat ? 1.35 : 0;
    const mainH = hasMoat ? BODY_H - moatBandH - GAP : BODY_H;
    const moatY = BODY_TOP + mainH + GAP;

    const aiBullets = Array.isArray(highlight.slides.battlefield?.competitive?.bullets)
        ? highlight.slides.battlefield.competitive.bullets
            .map((b) => String(b ?? '').trim())
            .filter(Boolean)
        : [];
    const competitiveBullets = cleanCompetitiveBullets(aiBullets.length > 0
        ? aiBullets
        : [
            String(ctx.competitive.incumbents ?? '').trim(),
            String(ctx.competitive.narrative ?? '').trim(),
            Array.isArray(ctx.competitive.moat_pills) && ctx.competitive.moat_pills.length
                ? `Moat: ${ctx.competitive.moat_pills.map((p) => String(p ?? '').trim()).filter(Boolean).join(', ')}`
                : '',
            String(ctx.competitive.difficult_to_remove ?? '').trim(),
        ].filter(Boolean));

    const competitiveHeadline = String(highlight.slides.battlefield?.competitive?.headline ?? '').trim()
        || 'Competitive Landscape';

    if (hasBlindspots) {
        const colW = (BODY_W - GAP) / 2;
        const leftX = MARGIN_X;
        const rightX = MARGIN_X + colW + GAP;

        addPanel(slide, leftX, BODY_TOP, colW, mainH);
        const leftLayout = panelContentLayout(leftX, BODY_TOP, colW, mainH);
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

        addPanel(slide, rightX, BODY_TOP, colW, mainH);
        const rightLayout = panelContentLayout(rightX, BODY_TOP, colW, mainH);
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
    } else {
        addPanel(slide, MARGIN_X, BODY_TOP, BODY_W, mainH);
        const fullLayout = panelContentLayout(MARGIN_X, BODY_TOP, BODY_W, mainH);
        addKicker(slide, 'COMPETITIVE LANDSCAPE', fullLayout.innerX, fullLayout.kickerY, fullLayout.innerW);
        addHeadline(slide, competitiveHeadline, fullLayout.innerX, fullLayout.headlineY, fullLayout.innerW, PANEL_HEADLINE_H);
        addNativeBulletList(slide, competitiveBullets, {
            x: fullLayout.innerX,
            y: fullLayout.bodyY,
            w: fullLayout.innerW,
            h: fullLayout.bodyH,
            fontSize: TYPO.body,
            lineSpacing: 16,
            color: THEME.primary,
            bulletColor: THEME.accent,
            emptyText: 'No competitive landscape captured yet.',
        });
    }

    if (hasMoat) {
        addPanel(slide, MARGIN_X, moatY, BODY_W, moatBandH);
        addKicker(slide, TACTICAL_UX_LABELS.incumbentGrip.toUpperCase(), MARGIN_X + 0.30, moatY + 0.12, BODY_W - 0.60);
        slide.addText(moatText, {
            x: MARGIN_X + 0.30,
            y: moatY + 0.34,
            w: BODY_W - 0.60,
            h: moatBandH - 0.42,
            fontSize: 10,
            color: THEME.secondary,
            fontFace: THEME.font,
            valign: 'top',
            breakLine: true,
            margin: 0,
            autoFit: false,
            lineSpacing: 14,
        });
    }
}

// ---------------------------------------------------------------------------
// Slide 4+ — Strategic Entry Points (paginated)
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @returns {Array<(pageNum: number, totalSlides: number) => void>}
 */
function buildEntryPointsSlideBuilders(pptx, ctx, highlight) {
    const rawPoints = ctx.rawEntryPoints
        .filter(isPlainObject)
        .filter((point) => String(point.contact_name ?? '').trim());

    if (rawPoints.length === 0) {
        return [(pageNum, totalSlides) => {
            buildEntryPointsSlidePage(
                pptx,
                ctx,
                highlight,
                [],
                { start: 0, count: 0 },
                false,
                pageNum,
                totalSlides
            );
        }];
    }

    return planEntryPointPageRanges(rawPoints.length).map((range, pageIndex) => (
        (pageNum, totalSlides) => {
            buildEntryPointsSlidePage(
                pptx,
                ctx,
                highlight,
                rawPoints,
                range,
                pageIndex > 0,
                pageNum,
                totalSlides
            );
        }
    ));
}

/**
 * @param {PptxGenJS} pptx
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {Record<string, unknown>[]} rawPoints
 * @param {{ start: number, count: number }} range
 * @param {boolean} continued
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildEntryPointsSlidePage(pptx, ctx, highlight, rawPoints, range, continued, pageNum, totalSlides) {
    const slide = addContentSlide(pptx);
    addContentSlideChrome(slide, 'Strategic Entry Points', pageNum, totalSlides, continued);

    if (rawPoints.length === 0 || range.count === 0) {
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

    const pagePoints = rawPoints.slice(range.start, range.start + range.count);
    const layoutMode = getEntryPointLayoutMode(pagePoints.length);
    const columns = getEntryPointColumnRects(pagePoints.length);

    columns.forEach((col, index) => {
        const point = pagePoints[index];
        if (!isPlainObject(point)) return;
        const profile = mapEntryPointToProfile(point, range.start + index, highlight);
        renderEntryProfileColumn(slide, profile, col.x, col.y, col.w, col.h, layoutMode);
    });
}

/**
 * Inch-based column rects aligned to the content body band.
 * @param {number} profileCount
 * @returns {{ x: number, y: number, w: number, h: number }[]}
 */
function getEntryPointColumnRects(profileCount) {
    const top = BODY_TOP;
    const height = BODY_H;

    if (profileCount === 1) {
        return [{ x: MARGIN_X, y: top, w: BODY_W, h: height }];
    }
    if (profileCount === 2) {
        const colW = (BODY_W - GAP) / 2;
        return [
            { x: MARGIN_X, y: top, w: colW, h: height },
            { x: MARGIN_X + colW + GAP, y: top, w: colW, h: height },
        ];
    }
    if (profileCount === 3) {
        const colW = (BODY_W - GAP * 2) / 3;
        return [0, 1, 2].map((index) => ({
            x: MARGIN_X + index * (colW + GAP),
            y: top,
            w: colW,
            h: height,
        }));
    }
    return [{ x: MARGIN_X, y: top, w: BODY_W, h: height }];
}

/**
 * @param {'slim' | 'roomy' | 'default'} layoutMode
 * @returns {{ name: number, kicker: number, body: number, bodyLineSpacing: number }}
 */
function getEntryPointTypography(layoutMode) {
    if (layoutMode === 'slim') {
        return { name: 11, kicker: 8, body: 9, bodyLineSpacing: 13 };
    }
    if (layoutMode === 'roomy') {
        return { name: TYPO.subheader, kicker: TYPO.kicker, body: TYPO.body, bodyLineSpacing: 16 };
    }
    return { name: TYPO.subheader, kicker: TYPO.kicker, body: TYPO.body, bodyLineSpacing: 16 };
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
    const rawWhy = String(point.why_they_matter ?? '').trim();
    const rawNext = String(point.next_move ?? '').trim();
    const aiHeadline = aiMatch ? String(aiMatch.headline ?? '').trim() : '';
    const aiHook = aiMatch ? String(aiMatch.hook ?? '').trim() : '';
    const badgeParts = [
        point.trust_level ? `Trust: ${point.trust_level}` : '',
        point.political_influence ? `Influence: ${point.political_influence}` : '',
    ].filter(Boolean);
    const rawBadges = badgeParts.join(' · ');
    return {
        name,
        trust: String(point.trust_level ?? '').trim(),
        influence: String(point.political_influence ?? '').trim(),
        why_they_matter: aiHeadline && aiHeadline.length > rawWhy.length + 12 ? aiHeadline : rawWhy,
        operational_pain: String(point.operational_pain ?? '').trim(),
        conversation_wedge: String(point.conversation_wedge ?? '').trim(),
        next_move: aiHook && aiHook.length > rawNext.length + 8 ? aiHook : rawNext,
        human_context: String(point.human_context ?? '').trim(),
        badges: (aiMatch ? String(aiMatch.badges ?? '').trim() : '') || rawBadges,
    };
}

/**
 * @param {{ trust?: string, influence?: string, badges?: string }} profile
 */
function resolveEntryTrustInfluence(profile) {
    let trust = String(profile.trust ?? '').trim();
    let influence = String(profile.influence ?? '').trim();
    if (!trust && !influence && profile.badges) {
        const trustMatch = String(profile.badges).match(/trust:\s*([^·]+)/i);
        const influenceMatch = String(profile.badges).match(/influence:\s*([^·]+)/i);
        trust = trustMatch ? trustMatch[1].trim() : '';
        influence = influenceMatch ? influenceMatch[1].trim() : '';
    }
    return { trust, influence };
}

/**
 * @param {string} trust
 */
function resolveTrustBadgeStyle(trust) {
    const value = String(trust ?? '').trim().toLowerCase();
    if (value === 'trusted') return { fill: THEME.accent, text: 'FFFFFF' };
    if (value === 'warm') return { fill: THEME.accentAlt, text: THEME.primary };
    if (value === 'cold') return { fill: '94A3B8', text: 'FFFFFF' };
    return { fill: THEME.trackBg, text: THEME.secondary };
}

/**
 * @param {string} influence
 */
function resolveInfluenceBadgeStyle(influence) {
    const value = String(influence ?? '').trim().toLowerCase();
    if (value === 'high') return { fill: THEME.accentDark, text: 'FFFFFF' };
    if (value === 'medium') return { fill: THEME.accent, text: 'FFFFFF' };
    return { fill: THEME.trackBg, text: THEME.secondary };
}

/**
 * @param {import('pptxgenjs').Slide} slide
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {string} label
 * @param {string} value
 * @param {{ fill: string, text: string }} style
 * @param {number} fontSize
 */
function renderEntryMetricPill(slide, x, y, w, label, value, style, fontSize = TYPO.kicker) {
    slide.addShape('roundRect', {
        x,
        y,
        w,
        h: 0.22,
        fill: { color: style.fill },
        line: { color: style.fill, width: 0.5 },
        rectRadius: 0.05,
    });
    slide.addText(`${label}: ${value}`.toUpperCase(), {
        x,
        y,
        w,
        h: 0.22,
        align: 'center',
        valign: 'middle',
        fontSize,
        bold: true,
        color: style.text,
        fontFace: THEME.font,
        charSpacing: 0.8,
        breakLine: true,
        margin: 0,
        autoFit: false,
    });
}

/**
 * @param {import('pptxgenjs').Slide} slide
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} nextMove
 * @param {{ body: number }} type
 */
function renderEntryNextMoveCallout(slide, x, y, w, h, nextMove, type) {
    slide.addShape('roundRect', {
        x,
        y,
        w,
        h,
        fill: { color: 'E6F4F1' },
        line: { color: THEME.accent, width: 0.75 },
        rectRadius: 0.08,
    });
    slide.addText([
        {
            text: 'Next Move\n',
            options: {
                bold: true,
                fontSize: type.body,
                color: themeHex('accent'),
                fontFace: THEME.font,
            },
        },
        {
            text: nextMove,
            options: {
                fontSize: type.body,
                color: themeHex('primary'),
                fontFace: THEME.font,
            },
        },
    ], {
        x: x + 0.10,
        y: y + 0.08,
        w: w - 0.20,
        h: h - 0.12,
        valign: 'top',
        breakLine: true,
        margin: 0,
        autoFit: false,
        lineSpacing: 14,
    });
}

/**
 * Branded target-profile card — navy header, trust/influence pills; next move floats below the panel.
 *
 * @param {import('pptxgenjs').Slide} slide
 * @param {ReturnType<typeof mapEntryPointToProfile>} profile
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {'slim' | 'roomy' | 'default'} [layoutMode='default']
 */
function renderEntryProfileColumn(slide, profile, x, y, w, h, layoutMode = 'default') {
    const type = getEntryPointTypography(layoutMode);
    const { trust, influence } = resolveEntryTrustInfluence(profile);
    const hasMetrics = Boolean(trust || influence);
    const nextMove = String(profile.next_move ?? '').trim();
    let cardH = h;
    let calloutH = 0;
    let calloutY = y;

    if (nextMove) {
        const usableH = h - ENTRY_NEXT_MOVE_FLOAT_GAP;
        cardH = usableH * ENTRY_CARD_HEIGHT_RATIO;
        calloutH = usableH - cardH;
        calloutY = y + cardH + ENTRY_NEXT_MOVE_FLOAT_GAP;
    }

    addPanel(slide, x, y, w, cardH);

    const headerH = layoutMode === 'slim' ? 0.50 : 0.56;
    slide.addShape('rect', {
        x,
        y,
        w,
        h: headerH,
        fill: { color: THEME.accentDark },
        line: { color: THEME.accentDark, width: 0 },
    });
    slide.addShape('rect', {
        x,
        y,
        w: 0.07,
        h: headerH,
        fill: { color: THEME.accent },
        line: { color: THEME.accent, width: 0 },
    });

    const innerX = x + PANEL_PAD_X;
    const innerW = w - PANEL_PAD_X * 2;
    slide.addText(profile.name || 'Unnamed Contact', {
        x: innerX,
        y: y + 0.08,
        w: innerW,
        h: headerH - 0.12,
        fontSize: type.name,
        bold: true,
        color: 'FFFFFF',
        fontFace: THEME.font,
        valign: 'middle',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });

    let bodyY = y + headerH + 0.18;
    if (hasMetrics) {
        const pillGap = 0.08;
        const pillW = (innerW - pillGap) / 2;
        if (trust) {
            renderEntryMetricPill(
                slide,
                innerX,
                bodyY,
                pillW,
                'Trust',
                trust,
                resolveTrustBadgeStyle(trust),
                type.kicker
            );
        }
        if (influence) {
            renderEntryMetricPill(
                slide,
                innerX + (trust ? pillW + pillGap : 0),
                bodyY,
                trust ? pillW : innerW,
                'Influence',
                influence,
                resolveInfluenceBadgeStyle(influence),
                type.kicker
            );
        }
        bodyY += 0.38;
    }

    const bodyH = y + cardH - bodyY - PANEL_BOTTOM_PAD;
    slide.addText(buildEntryProfileRichRuns(profile, type, layoutMode, true), {
        x: innerX,
        y: bodyY,
        w: innerW,
        h: Math.max(bodyH, 0.45),
        valign: 'top',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });

    if (nextMove) {
        renderEntryNextMoveCallout(
            slide,
            innerX,
            calloutY,
            innerW,
            calloutH,
            nextMove,
            type
        );
    }
}

/**
 * Build pptxgenjs rich-text runs for one target profile column.
 *
 * @param {ReturnType<typeof mapEntryPointToProfile>} profile
 * @param {{ name: number, kicker: number, body: number, bodyLineSpacing: number }} [type]
 * @param {'slim' | 'roomy' | 'default'} layoutMode
 * @param {boolean} [omitNextMove=false]
 * @returns {import('pptxgenjs').TextProps[]}
 */
function buildEntryProfileRichRuns(
    profile,
    type = getEntryPointTypography('default'),
    layoutMode = 'default',
    omitNextMove = false
) {
    const slimFields = [
        { label: 'Why They Matter', value: profile.why_they_matter },
        { label: 'Operational Pain', value: profile.operational_pain },
        { label: 'Next Move', value: profile.next_move },
    ];
    const fullFields = [
        ...slimFields,
        { label: 'Conversation Wedge', value: profile.conversation_wedge },
        { label: TACTICAL_UX_LABELS.humanContext, value: profile.human_context },
    ];
    let sections = (layoutMode === 'slim' ? slimFields : fullFields)
        .filter((section) => String(section.value ?? '').trim());
    if (omitNextMove) {
        sections = sections.filter((section) => section.label !== 'Next Move');
    }

    if (sections.length === 0) {
        sections.push({ label: 'Profile', value: '' });
    }

    const runs = [];
    sections.forEach((section, index) => {
        const body = String(section.value ?? '').trim() || '—';
        runs.push({
            text: `${section.label}:\n`,
            options: {
                bold: true,
                fontSize: type.body,
                color: themeHex('accent'),
                fontFace: THEME.font,
            },
        });
        runs.push({
            text: index < sections.length - 1 ? `${body}\n\n` : body,
            options: {
                fontSize: type.body,
                color: themeHex('secondary'),
                fontFace: THEME.font,
                italic: body === '—',
            },
        });
    });
    return runs;
}

// ---------------------------------------------------------------------------
// Execution Roadmap
// ---------------------------------------------------------------------------
// Three fixed bands (plan table → give/get → signals) so PptxGenJS table
// overflow never collides with client commitments.
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

    const commitments = ctx.plan306090.client_commitments;
    const hasCommitments = commitments.length > 0;
    const commitmentCount = Math.min(commitments.length, 4);

    // Three non-overlapping bands — never stack commitments below the table
    // inside one panel; PptxGenJS tables ignore height and bleed into Y space.
    const signalsH = 1.62;
    const commitmentH = hasCommitments ? 0.50 + commitmentCount * 0.24 : 0;
    const bandGaps = hasCommitments ? GAP * 2 : GAP;
    const planH = BODY_H - signalsH - commitmentH - bandGaps;

    const planY = BODY_TOP;
    const commitY = planY + planH + GAP;
    const signalsY = hasCommitments ? commitY + commitmentH + GAP : planY + planH + GAP;

    addPanel(slide, MARGIN_X, planY, BODY_W, planH);
    addKicker(slide, '30 / 60 / 90 PLAN', MARGIN_X + 0.30, planY + 0.18, BODY_W - 0.6);

    const horizons = [
        { period: 'NEXT 30 DAYS', block: highlight.slides.execution?.plan_30, fallback: ctx.plan306090.days_30 },
        { period: 'DAY 31–60',    block: highlight.slides.execution?.plan_60, fallback: ctx.plan306090.days_60 },
        { period: 'DAY 61–90',    block: highlight.slides.execution?.plan_90, fallback: ctx.plan306090.days_90 },
    ];
    const cellRows = horizons.map((h) => composePlanCellLines(h.block, h.fallback));

    const tableX = MARGIN_X + 0.25;
    const tableY = planY + 0.58;
    const tableW = BODY_W - 0.50;
    const tableH = planH - 0.68;
    const colW = tableW / 3;

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

    const bodyRow = cellRows.map((lines) => ({
        text: lines.length > 0
            ? lines.map((line, idx) => ({
                text: line,
                options: {
                    bullet: { code: '2022' },
                    breakLine: idx < lines.length - 1,
                    color: THEME.primary,
                    fontFace: THEME.font,
                    fontSize: 10,
                },
            }))
            : [{
                text: 'No actions captured yet.',
                options: { italic: true, color: THEME.softMuted, fontFace: THEME.font, fontSize: 10 },
            }],
        options: {
            fill: { color: THEME.panelFill },
            valign: 'top',
            margin: 5,
        },
    }));

    slide.addTable([headerRow, bodyRow], {
        x: tableX,
        y: tableY,
        w: tableW,
        h: tableH,
        colW: [colW, colW, colW],
        rowH: [0.34, tableH - 0.34],
        border: { type: 'solid', color: THEME.panelBorder, pt: 0.75 },
        fontFace: THEME.font,
        autoPage: false,
    });

    if (hasCommitments) {
        addPanel(slide, MARGIN_X, commitY, BODY_W, commitmentH);
        addKicker(slide, formatClientCommitmentsLabel().toUpperCase(), MARGIN_X + 0.30, commitY + 0.12, BODY_W - 0.60);
        addNativeBulletList(slide, commitments.slice(0, 4), {
            x: MARGIN_X + 0.35,
            y: commitY + 0.34,
            w: BODY_W - 0.70,
            h: commitmentH - 0.40,
            fontSize: 10,
            lineSpacing: 14,
            color: THEME.primary,
            bullet: true,
            fallbackItems: ['No client commitments documented.'],
        });
    }

    addPanel(slide, MARGIN_X, signalsY, BODY_W, signalsH);
    addKicker(slide, 'STRATEGIC SIGNALS', MARGIN_X + 0.30, signalsY + 0.16, BODY_W - 0.6);

    const signals = Array.isArray(highlight.slides.execution?.signals)
        ? highlight.slides.execution.signals
            .filter((s) => s && String(s.headline ?? '').trim())
            .slice(0, MAX_SIGNALS)
        : [];

    const resolvedSignals = signals.length > 0
        ? signals
        : ctx.exportSignals.slice(0, MAX_SIGNALS).map((entry) => ({
            date_label: entry.dateLabel,
            headline: entry.headline,
        }));

    if (resolvedSignals.length === 0) {
        slide.addText('No recent strategic signals — log one from the Interaction Log to surface it here.', {
            x: MARGIN_X + 0.30,
            y: signalsY + 0.48,
            w: BODY_W - 0.60,
            h: signalsH - 0.58,
            ...BODY_TEXT_BASE,
            italic: true,
            color: THEME.softMuted,
        });
        return;
    }

    const signalsX = MARGIN_X + 0.30;
    const signalsW = BODY_W - 0.60;
    const signalsContentY = signalsY + 0.46;
    const signalsContentH = signalsY + signalsH - signalsContentY - 0.16;

    const runs = resolvedSignals.slice(0, 3).map((signal, idx) => {
        const dateLabel = String(signal.date_label ?? '').trim();
        const headline = String(signal.headline ?? '').trim();
        const line = dateLabel ? `${dateLabel.toUpperCase()}  ${headline}` : headline;
        return {
            text: line,
            options: {
                bullet: { code: '2022', color: THEME.accent },
                breakLine: idx < Math.min(resolvedSignals.length, 3) - 1,
                color: THEME.primary,
                fontSize: TYPO.body,
                fontFace: THEME.font,
            },
        };
    });

    slide.addText(runs, {
        x: signalsX,
        y: signalsContentY,
        w: signalsW,
        h: signalsContentH,
        valign: 'top',
        breakLine: true,
        lineSpacing: 15,
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
function addContentSlideChrome(slide, slideTitle, pageNum, totalSlides, continued = false) {
    // Slide-specific title — never append "(continued)" here; that lives in
    // the subheader kicker below, mirroring the dossier PDF running head.
    slide.addText(slideTitle, {
        x: '4%',
        y: '7%',
        w: '78%',
        h: continued ? '4%' : '6%',
        fontSize: TYPO.header,
        bold: true,
        color: THEME.primary,
        fontFace: THEME.font,
        valign: 'top',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });

    if (continued) {
        slide.addText('(continued)', {
            x: '4%',
            y: '11.5%',
            w: '78%',
            h: '3%',
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
    }

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
 * @param {number} score
 */
function resolveMomentumStyle(score) {
    const idx = Math.min(5, Math.max(1, score)) - 1;
    return MOMENTUM_SCORE_STYLES[idx];
}

/**
 * Branded stat chip for tier / priority on the Account Snapshot slide.
 *
 * @param {import('pptxgenjs').Slide} slide
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} label
 * @param {string} value
 * @param {string} fillColor
 * @param {string} textColor
 */
function renderPursuitStatChip(slide, x, y, w, h, label, value, fillColor, textColor) {
    slide.addShape('roundRect', {
        x,
        y,
        w,
        h,
        fill: { color: fillColor },
        line: { color: fillColor, width: 0.5 },
        rectRadius: 0.08,
    });
    slide.addText(label, {
        x: x + 0.12,
        y: y + 0.14,
        w: w - 0.24,
        h: 0.18,
        fontSize: TYPO.kicker,
        bold: true,
        color: textColor,
        fontFace: THEME.font,
        charSpacing: 1.5,
        align: 'center',
        valign: 'top',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });
    slide.addText(value.toUpperCase(), {
        x: x + 0.12,
        y: y + 0.36,
        w: w - 0.24,
        h: h - 0.48,
        fontSize: 22,
        bold: true,
        color: textColor,
        fontFace: THEME.font,
        align: 'center',
        valign: 'middle',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });
}

/**
 * Pursuit Context side panel — stacked branded stat chips for tier + priority.
 *
 * @param {import('pptxgenjs').Slide} slide
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} tier
 * @param {string} priority
 */
function renderPursuitContextPanel(slide, x, y, w, h, tier, priority) {
    addPanel(slide, x, y, w, h);
    const innerX = x + PANEL_PAD_X;
    const innerW = w - PANEL_PAD_X * 2;
    addKicker(slide, 'PURSUIT CONTEXT', innerX, y + PANEL_KICKER_Y_OFF, innerW);

    if (!tier && !priority) {
        slide.addText('Set Strategic Tier and Pursuit Priority in the plan canvas.', {
            x: innerX,
            y: y + 0.70,
            w: innerW,
            h: 1.0,
            ...BODY_TEXT_BASE,
            italic: true,
            color: THEME.softMuted,
            align: 'center',
        });
        return;
    }

    const cardH = 1.35;
    const cardGap = 0.28;
    const cardCount = (tier ? 1 : 0) + (priority ? 1 : 0);
    const totalCardsH = cardCount * cardH + (cardCount > 1 ? cardGap : 0);
    let cardY = y + Math.max(0.42, (h - totalCardsH) / 2);

    if (tier) {
        renderPursuitStatChip(
            slide,
            innerX,
            cardY,
            innerW,
            cardH,
            'STRATEGIC TIER',
            tier,
            THEME.accentDark,
            'FFFFFF'
        );
        cardY += cardH + cardGap;
    }

    if (priority) {
        const highPriority = /^high$/i.test(priority);
        renderPursuitStatChip(
            slide,
            innerX,
            cardY,
            innerW,
            cardH,
            'PURSUIT PRIORITY',
            priority,
            highPriority ? THEME.accentAlt : THEME.accent,
            highPriority ? THEME.primary : 'FFFFFF'
        );
    }
}

/**
 * Relationship Momentum KPI — score hero, status badge, 5-segment gauge, insight.
 *
 * @param {import('pptxgenjs').Slide} slide
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} score
 * @param {string} narrative
 */
function renderMomentumKpiPanel(slide, x, y, w, h, score, narrative) {
    addPanel(slide, x, y, w, h);
    const innerX = x + PANEL_PAD_X;
    const innerW = w - PANEL_PAD_X * 2;
    addKicker(slide, 'RELATIONSHIP MOMENTUM', innerX, y + PANEL_KICKER_Y_OFF, innerW);

    const style = resolveMomentumStyle(score);
    const label = MOMENTUM_LABELS[score - 1] || 'Neutral';
    const narrativeText = narrative ? truncate(narrative, 280) : '';

    const scoreH = 0.78;
    const badgeGap = 0.08;
    const badgeH = 0.30;
    const gaugeGap = 0.14;
    const trackH = 0.12;
    const scaleH = 0.17;
    const narrativeBlockH = narrativeText ? 0.82 : 0;
    const blockH = scoreH + badgeGap + badgeH + gaugeGap + trackH + scaleH + narrativeBlockH;

    const contentTop = y + 0.42;
    const contentBottom = y + h - PANEL_BOTTOM_PAD;
    const blockY = contentTop + Math.max(0, (contentBottom - contentTop - blockH) / 2);

    slide.addText(String(score), {
        x,
        y: blockY,
        w,
        h: scoreH,
        align: 'center',
        valign: 'middle',
        fontSize: 54,
        bold: true,
        color: style.fill,
        fontFace: THEME.font,
        breakLine: true,
        margin: 0,
        autoFit: false,
    });

    const badgeW = Math.min(innerW, 1.85);
    const badgeX = x + (w - badgeW) / 2;
    const badgeY = blockY + scoreH + badgeGap;
    slide.addShape('roundRect', {
        x: badgeX,
        y: badgeY,
        w: badgeW,
        h: badgeH,
        fill: { color: style.fill },
        line: { color: style.fill, width: 0.5 },
        rectRadius: 0.06,
    });
    slide.addText(label.toUpperCase(), {
        x: badgeX,
        y: badgeY,
        w: badgeW,
        h: badgeH,
        align: 'center',
        valign: 'middle',
        fontSize: TYPO.kicker,
        bold: true,
        color: style.text,
        fontFace: THEME.font,
        charSpacing: 2,
        breakLine: true,
        margin: 0,
        autoFit: false,
    });

    const trackW = innerW - 0.10;
    const trackX = innerX + 0.05;
    const trackY = badgeY + badgeH + gaugeGap;
    slide.addShape('rect', {
        x: trackX,
        y: trackY,
        w: trackW,
        h: trackH,
        fill: { color: THEME.trackBg },
        line: { color: THEME.panelBorder, width: 0.5 },
    });
    slide.addShape('rect', {
        x: trackX,
        y: trackY,
        w: trackW * (score / 5),
        h: trackH,
        fill: { color: style.fill },
        line: { color: style.fill, width: 0.5 },
    });
    for (let tick = 1; tick <= 4; tick += 1) {
        const tickX = trackX + trackW * (tick / 5);
        slide.addShape('line', {
            x: tickX,
            y: trackY + 0.02,
            w: 0,
            h: trackH - 0.04,
            line: { color: 'FFFFFF', width: 0.5 },
        });
    }
    const markerX = trackX + trackW * (score / 5) - 0.06;
    slide.addShape('ellipse', {
        x: Math.max(trackX - 0.02, markerX),
        y: trackY - 0.03,
        w: 0.12,
        h: 0.18,
        fill: { color: THEME.primary },
        line: { color: THEME.primary, width: 0.5 },
    });
    slide.addText('Stalled', {
        x: trackX,
        y: trackY + trackH + 0.03,
        w: trackW / 2,
        h: scaleH,
        fontSize: TYPO.kicker,
        color: THEME.softMuted,
        fontFace: THEME.font,
        align: 'left',
        valign: 'top',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });
    slide.addText('Champion', {
        x: trackX + trackW / 2,
        y: trackY + trackH + 0.03,
        w: trackW / 2,
        h: scaleH,
        fontSize: TYPO.kicker,
        color: THEME.softMuted,
        fontFace: THEME.font,
        align: 'right',
        valign: 'top',
        breakLine: true,
        margin: 0,
        autoFit: false,
    });

    if (narrativeText) {
        const ruleY = trackY + trackH + scaleH + 0.06;
        slide.addShape('line', {
            x: innerX + 0.08,
            y: ruleY,
            w: innerW - 0.16,
            h: 0,
            line: { color: THEME.accent, width: 0.75 },
        });
        slide.addText(narrativeText, {
            x: innerX,
            y: ruleY + 0.08,
            w: innerW,
            h: blockY + blockH - (ruleY + 0.08),
            ...BODY_TEXT_BASE,
            color: THEME.secondary,
            lineSpacing: 15,
            align: 'center',
        });
    }
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
