/**
 * Strategic Account OS — PDF export engine (Snapdom + pdf-lib).
 */

import {
    buildDossierTemplate,
    buildExecReadoutTemplate,
    DOSSIER_HEIGHT_PX,
    DOSSIER_WIDTH_PX,
    ensureExportTemplateStyles,
    EXEC_HEIGHT_PX,
    EXEC_WIDTH_PX,
} from './account-plan-export-templates.js';

const LETTER_WIDTH_PT = 612;
const LETTER_HEIGHT_PT = 792;
const EXEC_PAGE_WIDTH_PT = 841.89;
const EXEC_PAGE_HEIGHT_PT = EXEC_PAGE_WIDTH_PT * (9 / 16);

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @param {'dossier' | 'exec' | 'exec_readout'} type
 */
export async function exportAccountPlanPdf(plan, account, type) {
    if (typeof snapdom !== 'function') {
        throw new Error('Snapdom is not loaded.');
    }
    if (!window.PDFLib) {
        throw new Error('pdf-lib is not loaded.');
    }

    const normalizedType = type === 'exec' || type === 'exec_readout' ? 'exec' : 'dossier';
    const exportRoot = document.getElementById('account-plan-export-root');
    if (!exportRoot) {
        throw new Error('Export root element not found.');
    }

    ensureExportTemplateStyles();
    exportRoot.innerHTML = '';

    try {
        if (normalizedType === 'dossier') {
            await exportDossierPdf(plan, account, exportRoot);
        } else {
            await exportExecReadoutPdf(plan, account, exportRoot);
        }
    } finally {
        exportRoot.innerHTML = '';
    }
}

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @param {HTMLElement} exportRoot
 */
async function exportDossierPdf(plan, account, exportRoot) {
    const { sectionBlocks, meta } = buildDossierTemplate(plan, account);
    const pageCanvases = await capturePaginatedDossier(sectionBlocks, meta, exportRoot);
    const pdfBytes = await canvasesToPdf(pageCanvases, {
        pageWidthPt: LETTER_WIDTH_PT,
        pageHeightPt: LETTER_HEIGHT_PT,
    });
    downloadPdfBytes(pdfBytes, buildFilename(account, 'Dossier'));
}

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @param {HTMLElement} exportRoot
 */
async function exportExecReadoutPdf(plan, account, exportRoot) {
    const template = buildExecReadoutTemplate(plan, account);
    exportRoot.appendChild(template);
    await waitForDomSettle();

    const pngDataUrl = await captureElementToPng(template);
    const pdfBytes = await pngToPdf(pngDataUrl, {
        pageWidthPt: EXEC_PAGE_WIDTH_PT,
        pageHeightPt: EXEC_PAGE_HEIGHT_PT,
    });
    downloadPdfBytes(pdfBytes, buildFilename(account, 'Exec_Readout'));
}

/**
 * @param {HTMLElement[]} sectionBlocks
 * @param {{ accountName: string, dateLabel: string }} meta
 * @param {HTMLElement} exportRoot
 */
async function capturePaginatedDossier(sectionBlocks, meta, exportRoot) {
    const canvases = [];
    let remaining = sectionBlocks.map((block) => block.cloneNode(true));
    let isFirstPage = true;

    while (remaining.length > 0) {
        let fitCount = 0;

        for (let i = 1; i <= remaining.length; i += 1) {
            const fits = measureDossierPage(remaining.slice(0, i), meta, isFirstPage, exportRoot);
            if (!fits) break;
            fitCount = i;
        }

        if (fitCount === 0) fitCount = 1;

        const pageBlocks = remaining.slice(0, fitCount);
        const pageEl = buildDossierPageElement(pageBlocks, meta, isFirstPage);
        exportRoot.appendChild(pageEl);
        await waitForDomSettle();

        const pngDataUrl = await captureElementToPng(pageEl);
        canvases.push(pngDataUrl);

        exportRoot.removeChild(pageEl);
        remaining = remaining.slice(fitCount);
        isFirstPage = false;
    }

    return canvases;
}

/**
 * @param {HTMLElement[]} blocks
 * @param {{ accountName: string, dateLabel: string }} meta
 * @param {boolean} includeHeader
 */
function buildDossierPageElement(blocks, meta, includeHeader) {
    const page = document.createElement('div');
    page.className = 'ap-export-dossier-page';

    if (includeHeader) {
        const header = document.createElement('div');
        header.className = 'ap-export-dossier-page-header';
        header.innerHTML = `
            <p class="ap-export-dossier-kicker">Strategic Account Dossier</p>
            <h1 class="ap-export-dossier-title">${escapeHtml(meta.accountName)}</h1>
            <p class="ap-export-dossier-date">${escapeHtml(meta.dateLabel)}</p>`;
        page.appendChild(header);
    }

    const content = document.createElement('div');
    content.className = 'ap-export-dossier-content';
    if (!includeHeader) {
        content.style.top = '48px';
    }
    blocks.forEach((block) => content.appendChild(block));
    page.appendChild(content);

    return page;
}

/**
 * @param {HTMLElement[]} blocks
 * @param {{ accountName: string, dateLabel: string }} meta
 * @param {boolean} includeHeader
 * @param {HTMLElement} exportRoot
 */
function measureDossierPage(blocks, meta, includeHeader, exportRoot) {
    const pageEl = buildDossierPageElement(
        blocks.map((b) => b.cloneNode(true)),
        meta,
        includeHeader
    );
    exportRoot.appendChild(pageEl);
    const content = pageEl.querySelector('.ap-export-dossier-content');
    const fits = content ? content.scrollHeight <= content.clientHeight : true;
    exportRoot.removeChild(pageEl);
    return fits;
}

/**
 * @param {HTMLElement} element
 */
async function captureElementToPng(element) {
    const result = await snapdom(element, { scale: 2, backgroundColor: '#ffffff' });
    const canvas = await result.toCanvas();
    return canvas.toDataURL('image/png');
}

/**
 * @param {string[]} pngDataUrls
 * @param {{ pageWidthPt: number, pageHeightPt: number }} dimensions
 */
async function canvasesToPdf(pngDataUrls, dimensions) {
    const { PDFDocument } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();

    for (const dataUrl of pngDataUrls) {
        await appendPngPage(pdfDoc, dataUrl, dimensions.pageWidthPt, dimensions.pageHeightPt);
    }

    return pdfDoc.save();
}

/**
 * @param {string} pngDataUrl
 * @param {{ pageWidthPt: number, pageHeightPt: number }} dimensions
 */
async function pngToPdf(pngDataUrl, dimensions) {
    const { PDFDocument } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    await appendPngPage(pdfDoc, pngDataUrl, dimensions.pageWidthPt, dimensions.pageHeightPt);
    return pdfDoc.save();
}

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {string} pngDataUrl
 * @param {number} pageWidthPt
 * @param {number} pageHeightPt
 */
async function appendPngPage(pdfDoc, pngDataUrl, pageWidthPt, pageHeightPt) {
    const pngBytes = dataUrlToUint8Array(pngDataUrl);
    const pngImage = await pdfDoc.embedPng(pngBytes);
    const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
    page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidthPt,
        height: pageHeightPt,
    });
}

/**
 * @param {string} dataUrl
 */
function dataUrlToUint8Array(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * @param {{ name?: string } | null} account
 * @param {string} typeLabel
 */
function buildFilename(account, typeLabel) {
    const safeName = String(account?.name || 'Account').replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
    return `${safeName}_Strategic_${typeLabel}.pdf`;
}

/**
 * @param {Uint8Array} bytes
 * @param {string} filename
 */
function downloadPdfBytes(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function waitForDomSettle() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });
}

/**
 * @param {string} text
 */
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
