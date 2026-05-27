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
 *   4. Strategic Entry Points         — up to 2 target profiles / slide
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
 * Geometry (Task 4):
 *   • Strict named coordinate constants (BODY_TOP, BODY_W, GAP, …).
 *   • Every addText / addShape / addTable call has explicit
 *     x / y / w / h. autoFit:false is always passed so PowerPoint
 *     never silently shrinks typography.
 */

import {
    GPC_BRAND,
    GPC_LOGO_NAVY,
    GPC_LOGO_WHITE,
    formatGpcFooterDate,
} from './account-plan-export-brand.js';
import { normalizePlan } from './account-plan-data.js';
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

    // Plan how many content slides will be emitted up front. Slide 4
    // (Strategic Entry Points) paginates when there are more than two
    // profiles, so totalSlides is dynamic; we need the total before we
    // start emitting in order to render "1 / N" page numbers correctly.
    const entryProfiles = collectEntryProfiles(ctx, highlight);
    const profileSlideCount = Math.max(1, Math.ceil(entryProfiles.length / MAX_PROFILES_PER_SLIDE) || 1);
    const contentSlideCount = 4 + profileSlideCount;

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
    // SLIDES 1–5 — content (all attach to MASTER_NAME)
    // -----------------------------------------------------------------
    let pageNum = 1;
    buildExecutiveSummarySlide(pptx, highlight, ctx, pageNum++, contentSlideCount);
    buildPsychologyTensionsSlide(pptx, ctx, pageNum++, contentSlideCount);
    buildBattlefieldSlide(pptx, highlight, ctx, pageNum++, contentSlideCount);

    // Slide 4 may emit multiple physical slides. Each gets its own page
    // number and the title suffix "(M of N)" so the audience tracks the
    // pagination.
    for (let i = 0; i < profileSlideCount; i += 1) {
        const profilesForSlide = entryProfiles.slice(
            i * MAX_PROFILES_PER_SLIDE,
            (i + 1) * MAX_PROFILES_PER_SLIDE
        );
        buildEntryPointsSlide(
            pptx,
            profilesForSlide,
            { index: i + 1, total: profileSlideCount },
            pageNum++,
            contentSlideCount
        );
    }

    buildExecutionRoadmapSlide(pptx, highlight, ctx, pageNum++, contentSlideCount);

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
    // LEFT-SIDE TITLE BLOCK — sits centred vertically against the
    // navyDark field. The white-bordered frame mirrors the PDF cover's
    // `.ap-export-gpc-cover-title-frame` motif.
    // -----------------------------------------------------------------

    // White-border title frame (transparent fill so the navyDark shows through).
    const titleFrameX = 0.75;
    const titleFrameY = 2.40;
    const titleFrameW = 6.50;
    const titleFrameH = 1.80;
    slide.addShape('rect', {
        x: titleFrameX,
        y: titleFrameY,
        w: titleFrameW,
        h: titleFrameH,
        fill: { type: 'solid', color: THEME.coverBg },  // matches background so border reads as outline
        line: { color: 'FFFFFF', width: 2.5 },
    });

    // Massive account name inside the frame.
    slide.addText(accountName, {
        x: titleFrameX + 0.30,
        y: titleFrameY + 0.10,
        w: titleFrameW - 0.60,
        h: titleFrameH - 0.20,
        fontSize: 36,
        bold: true,
        color: 'FFFFFF',
        fontFace: THEME.font,
        align: 'left',
        valign: 'middle',
        margin: 0,
        autoFit: false,
    });

    // Subtitle — lime, uppercase, tracked. Matches the PDF cover
    // subtitle colour (GPC lime).
    slide.addText(DOC_TITLE.toUpperCase(), {
        x: titleFrameX,
        y: titleFrameY + titleFrameH + 0.20,
        w: titleFrameW,
        h: 0.50,
        fontSize: 22,
        bold: true,
        color: THEME.accentAlt,
        fontFace: THEME.font,
        charSpacing: 3,
        align: 'left',
        valign: 'top',
        margin: 0,
        autoFit: false,
    });

    // Date stamp under the subtitle — soft white so it reads as
    // colophon rather than body copy.
    slide.addText(formatGpcFooterDate(new Date()), {
        x: titleFrameX,
        y: titleFrameY + titleFrameH + 0.80,
        w: titleFrameW,
        h: 0.32,
        fontSize: 13,
        color: 'CBD5E1',   // slate-300, ~82% white equivalent
        fontFace: THEME.font,
        align: 'left',
        valign: 'top',
        margin: 0,
        autoFit: false,
    });

    // Bottom-left brand strap — small uppercase company name. Anchors
    // the cover's lower edge with the same brand voice as the master
    // footer used on content slides.
    slide.addText(GPC_BRAND.companyName.toUpperCase(), {
        x: titleFrameX,
        y: SLIDE_H - 0.55,
        w: titleFrameW,
        h: 0.25,
        fontSize: 9,
        bold: true,
        color: 'CBD5E1',
        fontFace: THEME.font,
        charSpacing: 2.5,
        align: 'left',
        valign: 'middle',
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
        // The data layer guarantees this is a string[] under
        // sections.critical_unknowns.blindspots after normalizePlan runs.
        // We cap defensively for slide overflow.
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
 * Compose the slide-4 profile list. The AI engine emits a tight 2-field
 * shape per profile (name + hook) but does NOT carry `human_context`
 * (which slide 4 needs per spec), so we source from raw entry points.
 * AI badges remain useful as a tag row, so we look them up by contact
 * name when available.
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
    const rightX = MARGIN_X + leftW + gutter;

    // -----------------------------------------------------------------
    // LEFT COLUMN — Pursuit Thesis prose
    // -----------------------------------------------------------------
    const pursuitHeadline = String(highlight.slides.situation?.pursuit_thesis?.headline ?? '').trim()
        || 'Pursuit Thesis';
    const pursuitProse = resolvePursuitThesisProse(highlight, ctx);

    addPanel(slide, MARGIN_X, BODY_TOP, leftW, BODY_H);
    addKicker(slide, 'PURSUIT THESIS', MARGIN_X + 0.25, BODY_TOP + 0.20, leftW - 0.5);
    addHeadline(slide, pursuitHeadline, MARGIN_X + 0.25, BODY_TOP + 0.42, leftW - 0.5, 0.55);

    slide.addText(pursuitProse || 'No pursuit thesis captured yet.', {
        x: MARGIN_X + 0.25,
        y: BODY_TOP + 1.05,
        w: leftW - 0.5,
        h: BODY_H - 1.25,
        fontSize: 16,           // Task 2 spec — 16pt body copy.
        lineSpacing: 24,        // Task 2 spec — 24pt leading.
        color: THEME.primary,
        fontFace: THEME.font,
        valign: 'top',
        align: 'left',
        margin: 0,
        breakLine: true,
        autoFit: false,
    });

    // -----------------------------------------------------------------
    // RIGHT COLUMN — Momentum KPI
    // -----------------------------------------------------------------
    addPanel(slide, rightX, BODY_TOP, rightW, BODY_H);
    addKicker(slide, 'RELATIONSHIP MOMENTUM', rightX + 0.25, BODY_TOP + 0.20, rightW - 0.5);

    // KPI score — 72pt accent. Centered horizontally and vertically
    // inside its allocated cell (1.85" tall).
    const kpiScoreY = BODY_TOP + 0.75;
    const kpiScoreH = 1.85;
    slide.addText(String(ctx.score), {
        x: rightX,
        y: kpiScoreY,
        w: rightW,
        h: kpiScoreH,
        align: 'center',
        valign: 'middle',
        fontSize: 72,           // Task 2 spec.
        bold: true,
        color: THEME.accent,    // GPC teal (brand blue/green per Task 3).
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

    // Accent rule between the KPI block and the optional narrative.
    slide.addShape('line', {
        x: rightX + 0.50,
        y: kpiScoreY + kpiScoreH + 0.55,
        w: rightW - 1.00,
        h: 0,
        line: { color: THEME.accent, width: 0.75 },
    });

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
    addContentSlideChrome(slide, 'Psychology & Strategic Tensions', pageNum, totalSlides);

    const halfH = (BODY_H - GAP) / 2;
    const topY = BODY_TOP;
    const bottomY = BODY_TOP + halfH + GAP;

    // -----------------------------------------------------------------
    // TOP HALF — Psychology track bars
    // -----------------------------------------------------------------
    addPanel(slide, MARGIN_X, topY, BODY_W, halfH);
    addKicker(slide, 'ACCOUNT PSYCHOLOGY', MARGIN_X + 0.30, topY + 0.18, BODY_W - 0.6);

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
            fontSize: 11,
            bold: true,
            color: THEME.primary,
            fontFace: THEME.font,
            valign: 'middle',
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
            fontSize: 7,
            color: THEME.softMuted,
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
            color: THEME.softMuted,
            fontFace: THEME.font,
            align: 'right',
            margin: 0,
            autoFit: false,
        });

        // Right-side value indicator.
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
            color: THEME.softMuted,
            fontFace: THEME.font,
            valign: 'top',
            margin: 0,
            autoFit: false,
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
            fontSize: 12,
            bold: true,
            color: palette.text,
            fontFace: THEME.font,
            align: 'center',
            valign: 'middle',
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
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {ReturnType<typeof resolvePptxPlanContext>} ctx
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildBattlefieldSlide(pptx, highlight, ctx, pageNum, totalSlides) {
    const slide = addContentSlide(pptx);
    addContentSlideChrome(slide, 'The Battlefield', pageNum, totalSlides);

    const colW = (BODY_W - GAP) / 2;
    const leftX = MARGIN_X;
    const rightX = MARGIN_X + colW + GAP;

    // LEFT — Competitive Landscape narrative.
    addPanel(slide, leftX, BODY_TOP, colW, BODY_H);
    addKicker(slide, 'COMPETITIVE LANDSCAPE', leftX + 0.25, BODY_TOP + 0.20, colW - 0.5);

    const competitiveHeadline = String(highlight.slides.battlefield?.competitive?.headline ?? '').trim()
        || 'Competitive Landscape';
    addHeadline(slide, competitiveHeadline, leftX + 0.25, BODY_TOP + 0.42, colW - 0.5, 0.55);

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

    // RIGHT — The Blindspots.
    addPanel(slide, rightX, BODY_TOP, colW, BODY_H);
    addKicker(slide, 'THE BLINDSPOTS', rightX + 0.25, BODY_TOP + 0.20, colW - 0.5);
    addHeadline(slide, 'Questions we must answer next', rightX + 0.25, BODY_TOP + 0.42, colW - 0.5, 0.55);

    addNativeBulletList(slide, ctx.blindspots, {
        x: rightX + 0.25,
        y: BODY_TOP + 1.05,
        w: colW - 0.5,
        h: BODY_H - 1.25,
        fontSize: 13,
        lineSpacing: 22,
        color: THEME.primary,
        bulletColor: THEME.accent,
        emptyText: 'No discovery questions captured yet.',
    });
}

// ---------------------------------------------------------------------------
// Slide 4 — Strategic Entry Points (paginated, max 2 profiles/slide)
// ---------------------------------------------------------------------------

/**
 * @param {PptxGenJS} pptx
 * @param {ReturnType<typeof collectEntryProfiles>} profiles
 * @param {{ index: number, total: number }} pagination
 * @param {number} pageNum
 * @param {number} totalSlides
 */
function buildEntryPointsSlide(pptx, profiles, pagination, pageNum, totalSlides) {
    const slide = addContentSlide(pptx);

    const titleSuffix = pagination.total > 1 ? ` (${pagination.index} of ${pagination.total})` : '';
    addContentSlideChrome(slide, `Strategic Entry Points${titleSuffix}`, pageNum, totalSlides);

    if (profiles.length === 0) {
        slide.addText('No target profiles captured yet — open the Strategic Entry Points carousel in the plan canvas.', {
            x: MARGIN_X,
            y: BODY_TOP + 1.0,
            w: BODY_W,
            h: 0.6,
            fontSize: 14,
            italic: true,
            color: THEME.softMuted,
            fontFace: THEME.font,
            align: 'center',
            valign: 'top',
            margin: 0,
            autoFit: false,
        });
        return;
    }

    const cardW = profiles.length === 1 ? BODY_W : (BODY_W - GAP) / 2;
    profiles.forEach((profile, index) => {
        const cardX = MARGIN_X + index * (cardW + GAP);
        renderEntryProfileCard(slide, profile, cardX, BODY_TOP, cardW, BODY_H);
    });
}

/**
 * Render a single Strategic Entry Point profile card.
 *
 * Sub-geometry:
 *   • Header strip   — top portion of the card (name + AI badge row)
 *   • Field grid     — remaining height divided into 3 equal blocks
 *                      for operational_pain / conversation_wedge /
 *                      human_context, each with its own kicker label
 *                      and body textarea.
 *
 * @param {import('pptxgenjs').Slide} slide
 * @param {ReturnType<typeof collectEntryProfiles>[number]} profile
 */
function renderEntryProfileCard(slide, profile, x, y, w, h) {
    addPanel(slide, x, y, w, h);

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

    // Accent rule beneath the header strip — brand teal.
    slide.addShape('line', {
        x: x + innerPadX,
        y: y + headerH,
        w: innerW,
        h: 0,
        line: { color: THEME.accent, width: 0.75 },
    });

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

        slide.addText(block.label, {
            x: x + innerPadX,
            y: blockY,
            w: innerW,
            h: 0.22,
            fontSize: 8.5,
            bold: true,
            color: THEME.accent,
            fontFace: THEME.font,
            charSpacing: 1.5,
            valign: 'middle',
            margin: 0,
            autoFit: false,
        });

        slide.addText(block.value || '—', {
            x: x + innerPadX,
            y: blockY + 0.24,
            w: innerW,
            h: blockH - 0.32,
            fontSize: 11,
            lineSpacing: 16,
            color: block.value ? THEME.primary : THEME.softMuted,
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

    const tableX = MARGIN_X + 0.25;
    const tableY = topY + 0.65;
    const tableW = BODY_W - 0.50;
    const tableH = topH - 0.85;
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
            x: MARGIN_X + 0.30,
            y: bottomY + 0.70,
            w: BODY_W - 0.60,
            h: 0.4,
            fontSize: 11,
            italic: true,
            color: THEME.softMuted,
            fontFace: THEME.font,
            valign: 'top',
            margin: 0,
            autoFit: false,
        });
        return;
    }

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
        x: MARGIN_X,
        y: HEADER_TITLE_Y,
        w: BODY_W - LOGO_W - 0.20,    // never collide with the logo
        h: 0.40,
        fontSize: 24,
        bold: true,
        color: THEME.primary,
        fontFace: THEME.font,
        valign: 'middle',
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
        x: MARGIN_X + BODY_W / 2,
        y: FOOTER_TEXT_Y,
        w: BODY_W / 2,
        h: 0.22,
        fontSize: 8,
        bold: true,
        color: THEME.secondary,
        fontFace: THEME.font,
        align: 'right',
        valign: 'middle',
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
 * Used on slide 3 (Blindspots, Competitive bullets) where we want the
 * native PowerPoint bullet styling rather than the inline-glyph approach
 * (·) we use elsewhere.
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
            color: THEME.softMuted,
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
                breakLine: idx < clean.length - 1,
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
