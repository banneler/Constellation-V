/**
 * Strategic Account OS — native PowerPoint export (PptxGenJS).
 * Renders the AI highlight-reel deck as editable 16:9 slides.
 */

import { GPC_BRAND, GPC_LOGO_NAVY, formatGpcFooterDate } from './account-plan-export-brand.js';
import { normalizePlan } from './account-plan-data.js';
import { normalizePresentationHighlight } from './account-plan-presentation-ai.js';
import { MOMENTUM_LABELS } from './account-plan-presentation-types.js';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN_X = 0.5;
const FOOTER_H = 0.34;
const GAP = 0.12;

const THEME = Object.freeze({
    bg: 'F8FAFC',
    white: 'FFFFFF',
    border: 'E2E8F0',
    navy: '0F172A',
    slate: '334155',
    muted: '64748B',
    blue: '2563EB',
    panelFill: 'F8FAFC',
    font: 'Arial',
});

/** @type {string | null} */
let _logoDataUrl = null;

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight | null} [presentationHighlight]
 * @returns {Promise<{ bytes: Uint8Array, filename: string }>}
 */
export async function generateExecPresentationPptx(plan, account, presentationHighlight = null) {
    const PptxGenJS = getPptxGen();
    const accountName = account?.name ? String(account.name) : 'Account';
    const highlight = presentationHighlight ?? normalizePresentationHighlight(null, {
        accountName,
        generatedAt: new Date().toISOString(),
        model: null,
        plan,
    });

    const ctx = resolvePptxPlanContext(plan);
    const logoData = await loadLogoDataUrl();
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = GPC_BRAND.companyName;
    pptx.subject = `${accountName} Strategic Brief`;
    pptx.title = `${accountName} — Exec Readout`;

    buildSituationSlide(pptx, accountName, highlight, ctx, logoData);
    buildBattlefieldSlide(pptx, accountName, highlight, logoData);
    buildExecutionSlide(pptx, accountName, highlight, logoData);

    const arrayBuffer = await pptx.write({ outputType: 'arraybuffer' });
    return {
        bytes: new Uint8Array(arrayBuffer),
        filename: buildPptxFilename(account),
    };
}

/**
 * @param {unknown} plan
 */
function resolvePptxPlanContext(plan) {
    const normalized = normalizePlan(plan);
    const momentum = normalized.current_draft.sections.relationship_momentum;
    const score = clampScale(
        momentum && typeof momentum === 'object' ? momentum.score : undefined,
        3
    );
    return { score };
}

/**
 * @param {typeof PptxGenJS} pptx
 * @param {string} accountName
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {{ score: number }} ctx
 * @param {string | null} logoData
 */
function buildSituationSlide(pptx, accountName, highlight, ctx, logoData) {
    const slide = pptx.addSlide();
    const situation = highlight.slides.situation;
    addSlideBackground(slide);
    addSlideChrome(slide, {
        pageNumber: 1,
        kicker: 'The Situation',
        accountName,
        titleSuffix: 'Strategic Brief',
        hook: situation.headline,
        logoData,
    });

    const contentTop = 1.52;
    const contentH = SLIDE_H - contentTop - FOOTER_H - 0.12;
    const contentW = SLIDE_W - MARGIN_X * 2;
    const leftW = contentW * (1.22 / 2);
    const rightW = contentW - leftW - GAP;
    const rightX = MARGIN_X + leftW + GAP;

    addPanel(slide, MARGIN_X, contentTop, leftW, contentH);
    addPanelTitle(slide, situation.pursuit_thesis.headline, MARGIN_X + 0.14, contentTop + 0.12, leftW - 0.28, {
        fontSize: 11,
        bold: true,
        color: THEME.navy,
    });
    addBulletList(
        slide,
        situation.pursuit_thesis.bullets,
        MARGIN_X + 0.16,
        contentTop + 0.48,
        leftW - 0.32,
        contentH - 0.58,
        { fontSize: 11, lineSpacing: 18 }
    );

    const momentumH = contentH * 0.36;
    const psychH = contentH - momentumH - GAP;
    const psychY = contentTop + momentumH + GAP;

    addPanel(slide, rightX, contentTop, rightW, momentumH);
    addPanelTitle(slide, 'Relationship Momentum', rightX + 0.12, contentTop + 0.1, rightW - 0.24, {
        fontSize: 9,
        color: THEME.muted,
        uppercase: true,
    });
    slide.addText(String(ctx.score), {
        x: rightX,
        y: contentTop + 0.38,
        w: rightW,
        h: 0.55,
        align: 'center',
        fontSize: 32,
        bold: true,
        color: THEME.blue,
        fontFace: THEME.font,
        margin: 0,
    });
    slide.addText(MOMENTUM_LABELS[ctx.score - 1].toUpperCase(), {
        x: rightX,
        y: contentTop + 0.88,
        w: rightW,
        h: 0.2,
        align: 'center',
        fontSize: 8,
        bold: true,
        color: THEME.muted,
        fontFace: THEME.font,
        charSpacing: 1,
        margin: 0,
    });
    if (situation.momentum.insight) {
        slide.addShape(pptx.shapes.LINE, {
            x: rightX + 0.18,
            y: contentTop + momentumH - 0.72,
            w: rightW - 0.36,
            h: 0,
            line: { color: THEME.border, width: 0.75 },
        });
        slide.addText(situation.momentum.insight, {
            x: rightX + 0.14,
            y: contentTop + momentumH - 0.62,
            w: rightW - 0.28,
            h: 0.52,
            fontSize: 8.5,
            color: THEME.muted,
            fontFace: THEME.font,
            valign: 'top',
            margin: 0,
        });
    }

    addPanel(slide, rightX, psychY, rightW, psychH);
    addPanelTitle(slide, situation.psychology.headline, rightX + 0.12, psychY + 0.1, rightW - 0.24, {
        fontSize: 11,
        bold: true,
        color: THEME.navy,
    });
    addPsychCallouts(slide, situation.psychology.callouts, rightX + 0.12, psychY + 0.42, rightW - 0.24, psychH - 0.52);
}

/**
 * @param {typeof PptxGenJS} pptx
 * @param {string} accountName
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {string | null} logoData
 */
function buildBattlefieldSlide(pptx, accountName, highlight, logoData) {
    const slide = pptx.addSlide();
    const battlefield = highlight.slides.battlefield;
    addSlideBackground(slide);
    addSlideChrome(slide, {
        pageNumber: 2,
        kicker: 'The Battlefield',
        accountName,
        hook: battlefield.headline,
        logoData,
    });

    const contentTop = 1.52;
    const contentH = SLIDE_H - contentTop - FOOTER_H - 0.12;
    const contentW = SLIDE_W - MARGIN_X * 2;
    const ratioSum = 0.92 + 0.88 + 1.2;
    const col1W = (contentW - GAP * 2) * (0.92 / ratioSum);
    const col2W = (contentW - GAP * 2) * (0.88 / ratioSum);
    const col3W = contentW - col1W - col2W - GAP * 2;
    const col2X = MARGIN_X + col1W + GAP;
    const col3X = col2X + col2W + GAP;

    addPanel(slide, MARGIN_X, contentTop, col1W, contentH);
    addPanelTitle(slide, battlefield.competitive.headline, MARGIN_X + 0.12, contentTop + 0.1, col1W - 0.24, {
        fontSize: 11,
        bold: true,
        color: THEME.navy,
    });
    addBulletList(
        slide,
        battlefield.competitive.bullets,
        MARGIN_X + 0.14,
        contentTop + 0.46,
        col1W - 0.28,
        contentH - 0.56,
        { fontSize: 10.5, lineSpacing: 17 }
    );

    addPanel(slide, col2X, contentTop, col2W, contentH);
    addPanelTitle(slide, 'Influence Board', col2X + 0.12, contentTop + 0.1, col2W - 0.24, {
        fontSize: 9,
        color: THEME.muted,
        uppercase: true,
    });
    addInfluenceHook(
        slide,
        'Executive Leadership',
        battlefield.influence.executive_hook,
        col2X + 0.12,
        contentTop + 0.48,
        col2W - 0.24,
        (contentH - 0.58) * 0.48
    );
    addInfluenceHook(
        slide,
        'Mid-Level Champions',
        battlefield.influence.champions_hook,
        col2X + 0.12,
        contentTop + 0.48 + (contentH - 0.58) * 0.52,
        col2W - 0.24,
        (contentH - 0.58) * 0.48
    );

    addPanel(slide, col3X, contentTop, col3W, contentH);
    addPanelTitle(slide, 'Entry Points', col3X + 0.12, contentTop + 0.1, col3W - 0.24, {
        fontSize: 9,
        color: THEME.muted,
        uppercase: true,
    });
    const entries = battlefield.entry_points.slice(0, 2);
    const entryGap = 0.1;
    const entryH = entries.length > 0
        ? (contentH - 0.52 - entryGap * (entries.length - 1)) / entries.length
        : 0;
    entries.forEach((entry, index) => {
        const y = contentTop + 0.42 + index * (entryH + entryGap);
        addEntryPointCard(slide, entry, col3X + 0.1, y, col3W - 0.2, entryH);
    });
}

/**
 * @param {typeof PptxGenJS} pptx
 * @param {string} accountName
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight} highlight
 * @param {string | null} logoData
 */
function buildExecutionSlide(pptx, accountName, highlight, logoData) {
    const slide = pptx.addSlide();
    const execution = highlight.slides.execution;
    addSlideBackground(slide);
    addSlideChrome(slide, {
        pageNumber: 3,
        kicker: 'The Execution',
        accountName,
        hook: execution.headline,
        logoData,
    });

    const contentTop = 1.52;
    const contentH = SLIDE_H - contentTop - FOOTER_H - 0.12;
    const contentW = SLIDE_W - MARGIN_X * 2;
    const planW = contentW * (1.38 / 2);
    const signalsW = contentW - planW - GAP;
    const signalsX = MARGIN_X + planW + GAP;

    addPanel(slide, MARGIN_X, contentTop, planW, contentH);
    addPanelTitle(slide, '30 / 60 / 90', MARGIN_X + 0.12, contentTop + 0.1, planW - 0.24, {
        fontSize: 9,
        color: THEME.muted,
        uppercase: true,
    });

    const horizons = [
        { block: execution.plan_30, fallback: 'Next 30 Days' },
        { block: execution.plan_60, fallback: 'Day 31–60' },
        { block: execution.plan_90, fallback: 'Day 61–90' },
    ];
    const colGap = 0.1;
    const colW = (planW - 0.24 - colGap * 2) / 3;
    horizons.forEach((horizon, index) => {
        const { period, action } = parseHorizonHeadline(horizon.block.headline, horizon.fallback);
        const x = MARGIN_X + 0.12 + index * (colW + colGap);
        const y = contentTop + 0.42;
        const h = contentH - 0.52;

        if (index > 0) {
            slide.addShape(pptx.shapes.LINE, {
                x: x - colGap / 2,
                y: y + 0.05,
                w: 0,
                h: h - 0.1,
                line: { color: THEME.border, width: 0.75 },
            });
        }

        slide.addText(period.toUpperCase(), {
            x,
            y,
            w: colW,
            h: 0.18,
            fontSize: 7.5,
            bold: true,
            color: THEME.blue,
            fontFace: THEME.font,
            charSpacing: 0.8,
            margin: 0,
        });
        slide.addText(action, {
            x,
            y: y + 0.2,
            w: colW,
            h: 0.55,
            fontSize: 10,
            bold: true,
            color: THEME.navy,
            fontFace: THEME.font,
            valign: 'top',
            margin: 0,
        });
        addBulletList(slide, horizon.block.bullets, x, y + 0.78, colW, h - 0.86, {
            fontSize: 8.5,
            lineSpacing: 14,
        });
    });

    addPanel(slide, signalsX, contentTop, signalsW, contentH);
    addPanelTitle(slide, 'Strategic Signals', signalsX + 0.12, contentTop + 0.1, signalsW - 0.24, {
        fontSize: 9,
        color: THEME.muted,
        uppercase: true,
    });
    execution.signals.slice(0, 3).forEach((signal, index) => {
        const y = contentTop + 0.44 + index * 0.95;
        slide.addText(String(signal.date_label || '').toUpperCase(), {
            x: signalsX + 0.12,
            y,
            w: signalsW - 0.24,
            h: 0.16,
            fontSize: 7.5,
            bold: true,
            color: THEME.muted,
            fontFace: THEME.font,
            charSpacing: 0.6,
            margin: 0,
        });
        slide.addText(signal.headline, {
            x: signalsX + 0.12,
            y: y + 0.16,
            w: signalsW - 0.24,
            h: 0.62,
            fontSize: 10,
            bold: true,
            color: THEME.navy,
            fontFace: THEME.font,
            valign: 'top',
            margin: 0,
        });
    });
}

/**
 * @param {import('pptxgenjs').Slide} slide
 */
function addSlideBackground(slide) {
    slide.background = { color: THEME.bg };
}

/**
 * @param {import('pptxgenjs').Slide} slide
 * @param {{
 *   pageNumber: number,
 *   kicker: string,
 *   accountName: string,
 *   titleSuffix?: string,
 *   hook?: string,
 *   logoData: string | null,
 * }} chrome
 */
function addSlideChrome(slide, chrome) {
    const titleText = chrome.titleSuffix
        ? [
            { text: chrome.accountName, options: { color: THEME.navy, bold: true } },
            { text: ' ', options: {} },
            { text: chrome.titleSuffix, options: { color: THEME.blue, bold: true } },
        ]
        : [{ text: chrome.accountName, options: { color: THEME.navy, bold: true } }];

    slide.addText(chrome.kicker.toUpperCase(), {
        x: MARGIN_X,
        y: 0.38,
        w: 9.5,
        h: 0.2,
        fontSize: 8,
        bold: true,
        color: THEME.blue,
        fontFace: THEME.font,
        charSpacing: 1.2,
        margin: 0,
    });
    slide.addText(titleText, {
        x: MARGIN_X,
        y: 0.58,
        w: 9.8,
        h: 0.38,
        fontSize: 18,
        fontFace: THEME.font,
        margin: 0,
    });
    if (chrome.hook) {
        slide.addText(chrome.hook, {
            x: MARGIN_X,
            y: 0.98,
            w: 10.2,
            h: 0.48,
            fontSize: 13,
            bold: true,
            color: THEME.navy,
            fontFace: THEME.font,
            valign: 'top',
            margin: 0,
        });
    }

    if (chrome.logoData) {
        slide.addImage({
            data: chrome.logoData,
            x: SLIDE_W - MARGIN_X - 1.15,
            y: 0.34,
            w: 1.15,
            h: 0.42,
        });
    }

    slide.addShape('rect', {
        x: 0,
        y: SLIDE_H - FOOTER_H,
        w: SLIDE_W,
        h: FOOTER_H,
        fill: { color: THEME.white },
        line: { color: THEME.border, width: 0.75 },
    });
    slide.addText(`${chrome.pageNumber} / ${GPC_BRAND.companyName}`, {
        x: MARGIN_X,
        y: SLIDE_H - FOOTER_H + 0.08,
        w: 5,
        h: 0.2,
        fontSize: 8,
        color: THEME.muted,
        fontFace: THEME.font,
        margin: 0,
    });
    slide.addText(formatGpcFooterDate(new Date()), {
        x: SLIDE_W - MARGIN_X - 1.2,
        y: SLIDE_H - FOOTER_H + 0.08,
        w: 1.2,
        h: 0.2,
        fontSize: 8,
        color: THEME.muted,
        fontFace: THEME.font,
        align: 'right',
        margin: 0,
    });
}

/**
 * @param {import('pptxgenjs').Slide} slide
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 */
function addPanel(slide, x, y, w, h) {
    slide.addShape('roundRect', {
        x,
        y,
        w,
        h,
        fill: { color: THEME.white },
        line: { color: THEME.border, width: 0.75 },
        rectRadius: 0.06,
    });
}

/**
 * @param {import('pptxgenjs').Slide} slide
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {{ fontSize?: number, bold?: boolean, color?: string, uppercase?: boolean }} [opts]
 */
function addPanelTitle(slide, text, x, y, w, opts = {}) {
    slide.addText(opts.uppercase ? text.toUpperCase() : text, {
        x,
        y,
        w,
        h: 0.28,
        fontSize: opts.fontSize ?? 10,
        bold: opts.bold ?? true,
        color: opts.color ?? THEME.muted,
        fontFace: THEME.font,
        valign: 'top',
        margin: 0,
    });
}

/**
 * @param {import('pptxgenjs').Slide} slide
 * @param {string[]} bullets
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {{ fontSize?: number, lineSpacing?: number }} [opts]
 */
function addBulletList(slide, bullets, x, y, w, h, opts = {}) {
    const items = bullets.filter(Boolean);
    if (items.length === 0) return;

    slide.addText(
        items.map((bullet, index) => ({
            text: bullet,
            options: {
                bullet: { code: '2022', color: THEME.blue },
                breakLine: index < items.length - 1,
                fontSize: opts.fontSize ?? 10,
                color: THEME.slate,
                fontFace: THEME.font,
            },
        })),
        {
            x,
            y,
            w,
            h,
            valign: 'top',
            lineSpacing: opts.lineSpacing ?? 16,
            margin: 0,
        }
    );
}

/**
 * @param {import('pptxgenjs').Slide} slide
 * @param {Array<{ label: string, insight: string }>} callouts
 */
function addPsychCallouts(slide, callouts, x, y, w, h) {
    const items = callouts.filter((item) => item?.insight);
    if (items.length === 0) return;

    const rowH = h / items.length;
    items.forEach((callout, index) => {
        const rowY = y + index * rowH;
        slide.addShape('rect', {
            x,
            y: rowY + 0.04,
            w: 0.04,
            h: rowH - 0.12,
            fill: { color: THEME.blue },
            line: { width: 0 },
        });
        slide.addText(callout.label.toUpperCase(), {
            x: x + 0.1,
            y: rowY,
            w,
            h: 0.16,
            fontSize: 7,
            bold: true,
            color: THEME.muted,
            fontFace: THEME.font,
            charSpacing: 0.6,
            margin: 0,
        });
        slide.addText(callout.insight, {
            x: x + 0.1,
            y: rowY + 0.16,
            w,
            h: rowH - 0.22,
            fontSize: 9,
            color: THEME.slate,
            fontFace: THEME.font,
            valign: 'top',
            margin: 0,
        });
    });
}

/**
 * @param {import('pptxgenjs').Slide} slide
 */
function addInfluenceHook(slide, label, copy, x, y, w, h) {
    slide.addText(label.toUpperCase(), {
        x,
        y,
        w,
        h: 0.16,
        fontSize: 7.5,
        bold: true,
        color: THEME.muted,
        fontFace: THEME.font,
        charSpacing: 0.6,
        margin: 0,
    });
    slide.addText(copy, {
        x,
        y: y + 0.18,
        w,
        h: h - 0.18,
        fontSize: 10,
        bold: true,
        color: THEME.navy,
        fontFace: THEME.font,
        valign: 'top',
        margin: 0,
    });
}

/**
 * @param {import('pptxgenjs').Slide} slide
 * @param {{ name: string, headline: string, hook: string, badges: string }} entry
 */
function addEntryPointCard(slide, entry, x, y, w, h) {
    slide.addShape('roundRect', {
        x,
        y,
        w,
        h,
        fill: { color: THEME.panelFill },
        line: { color: THEME.border, width: 0.75 },
        rectRadius: 0.05,
    });
    slide.addText(entry.name, {
        x: x + 0.1,
        y: y + 0.08,
        w: w - 0.2,
        h: 0.18,
        fontSize: 10,
        bold: true,
        color: THEME.navy,
        fontFace: THEME.font,
        margin: 0,
    });
    slide.addText(entry.headline, {
        x: x + 0.1,
        y: y + 0.26,
        w: w - 0.2,
        h: 0.22,
        fontSize: 9,
        bold: true,
        color: THEME.blue,
        fontFace: THEME.font,
        valign: 'top',
        margin: 0,
    });
    slide.addText(entry.hook, {
        x: x + 0.1,
        y: y + 0.48,
        w: w - 0.2,
        h: h - 0.72,
        fontSize: 8.5,
        color: THEME.slate,
        fontFace: THEME.font,
        valign: 'top',
        margin: 0,
    });
    if (entry.badges) {
        slide.addText(entry.badges.toUpperCase(), {
            x: x + 0.1,
            y: y + h - 0.22,
            w: w - 0.2,
            h: 0.14,
            fontSize: 6.5,
            color: THEME.muted,
            fontFace: THEME.font,
            charSpacing: 0.4,
            margin: 0,
        });
    }
}

/**
 * @param {string} headline
 * @param {string} fallbackPeriod
 */
function parseHorizonHeadline(headline, fallbackPeriod) {
    const text = String(headline ?? '').trim() || fallbackPeriod;
    const colonMatch = text.match(/^([^:]{1,48}):\s*(.+)$/);
    if (colonMatch) {
        return { period: colonMatch[1].trim(), action: colonMatch[2].trim() };
    }
    return { period: fallbackPeriod, action: text };
}

/**
 * @param {{ name?: string } | null} account
 */
function buildPptxFilename(account) {
    const safeName = String(account?.name || 'Account').replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
    return `${safeName}_Strategic_Exec_Readout.pptx`;
}

function getPptxGen() {
    if (typeof PptxGenJS === 'undefined') {
        throw new Error('PptxGenJS is not loaded.');
    }
    return PptxGenJS;
}

async function loadLogoDataUrl() {
    if (_logoDataUrl) return _logoDataUrl;
    try {
        const response = await fetch(GPC_LOGO_NAVY);
        if (!response.ok) return null;
        const blob = await response.blob();
        _logoDataUrl = await blobToDataUrl(blob);
        return _logoDataUrl;
    } catch {
        return null;
    }
}

/**
 * @param {Blob} blob
 */
function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * @param {unknown} value
 * @param {number} defaultValue
 */
function clampScale(value, defaultValue) {
    const num = Number(value);
    if (!Number.isFinite(num)) return defaultValue;
    return Math.min(5, Math.max(1, Math.round(num)));
}
