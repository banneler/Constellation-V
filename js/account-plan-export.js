/**
 * Strategic Account OS — PDF export engine (Snapdom + pdf-lib).
 */

import {
    buildDossierTemplate,
    buildExecReadoutTemplate,
    buildGpcCoverPage,
    buildDossierContentPage,
    ensureExportTemplateStyles,
} from './account-plan-export-templates.js';

const LETTER_WIDTH_PT = 612;
const LETTER_HEIGHT_PT = 792;
const EXEC_PAGE_WIDTH_PT = 841.89;
const EXEC_PAGE_HEIGHT_PT = EXEC_PAGE_WIDTH_PT * (9 / 16);

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @param {'dossier' | 'exec' | 'exec_readout'} type
 * @returns {Promise<{ bytes: Uint8Array, filename: string }>}
 */
export async function generateAccountPlanPdf(plan, account, type) {
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
            const bytes = await buildDossierPdfBytes(plan, account, exportRoot);
            return { bytes, filename: buildFilename(account, 'Dossier') };
        }

        const bytes = await buildExecReadoutPdfBytes(plan, account, exportRoot);
        return { bytes, filename: buildFilename(account, 'Exec_Readout') };
    } finally {
        exportRoot.innerHTML = '';
    }
}

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @param {'dossier' | 'exec' | 'exec_readout'} type
 */
export async function exportAccountPlanPdf(plan, account, type) {
    const { bytes, filename } = await generateAccountPlanPdf(plan, account, type);
    downloadPdfBytes(bytes, filename);
}

/**
 * @param {Uint8Array} bytes
 * @param {string} [filename]
 */
export function openAccountPlanPdfPreview(bytes, filename = 'Strategic_Account_Plan.pdf') {
    closeAccountPlanPdfPreview();

    const modal = document.getElementById('plan-pdf-preview-modal');
    const iframe = document.getElementById('plan-pdf-preview-iframe');
    const titleEl = document.getElementById('plan-pdf-preview-title');
    const downloadBtn = document.getElementById('plan-pdf-preview-download-btn');
    if (!(modal instanceof HTMLElement) || !(iframe instanceof HTMLIFrameElement)) {
        downloadPdfBytes(bytes, filename);
        return;
    }

    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    modal.dataset.previewUrl = url;
    modal.dataset.previewFilename = filename;

    if (titleEl) {
        titleEl.textContent = filename.replace(/_/g, ' ').replace(/\.pdf$/i, '');
    }
    iframe.src = `${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
    if (downloadBtn instanceof HTMLButtonElement) {
        downloadBtn.dataset.filename = filename;
    }
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
}

/** Close the account plan PDF preview modal and revoke any blob URL. */
export function closeAccountPlanPdfPreview() {
    const modal = document.getElementById('plan-pdf-preview-modal');
    const iframe = document.getElementById('plan-pdf-preview-iframe');
    if (!(modal instanceof HTMLElement)) return;

    const url = modal.dataset.previewUrl;
    if (url) {
        URL.revokeObjectURL(url);
        delete modal.dataset.previewUrl;
    }
    delete modal.dataset.previewFilename;

    if (iframe instanceof HTMLIFrameElement) {
        iframe.src = '';
    }
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
}

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @param {HTMLElement} exportRoot
 */
async function buildDossierPdfBytes(plan, account, exportRoot) {
    const { sectionBlocks, meta } = buildDossierTemplate(plan, account);
    const pageBlockGroups = paginateDossierSections(sectionBlocks, meta, exportRoot);
    const totalPages = 1 + pageBlockGroups.length;
    const pageCanvases = [];

    const cover = buildGpcCoverPage(meta);
    exportRoot.appendChild(cover);
    await waitForDomSettle();
    await waitForImages(cover);
    pageCanvases.push(await captureElementToPng(cover));
    exportRoot.removeChild(cover);

    for (let i = 0; i < pageBlockGroups.length; i += 1) {
        const blocks = pageBlockGroups[i].map((block) => block.cloneNode(true));
        const pageEl = buildDossierContentPage(blocks, meta, {
            pageNumber: i + 2,
            totalPages,
        });
        exportRoot.appendChild(pageEl);
        await waitForDomSettle();
        await waitForImages(pageEl);

        pageCanvases.push(await captureElementToPng(pageEl));
        exportRoot.removeChild(pageEl);
    }

    return canvasesToPdf(pageCanvases, {
        pageWidthPt: LETTER_WIDTH_PT,
        pageHeightPt: LETTER_HEIGHT_PT,
    });
}

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @param {HTMLElement} exportRoot
 */
async function buildExecReadoutPdfBytes(plan, account, exportRoot) {
    const template = buildExecReadoutTemplate(plan, account);
    exportRoot.appendChild(template);
    await waitForDomSettle();
    await waitForImages(template);

    const pngDataUrl = await captureElementToPng(template);
    return pngToPdf(pngDataUrl, {
        pageWidthPt: EXEC_PAGE_WIDTH_PT,
        pageHeightPt: EXEC_PAGE_HEIGHT_PT,
    });
}

/**
 * @param {HTMLElement[]} sectionBlocks
 * @param {{ accountName: string, dateLabel: string }} meta
 * @param {HTMLElement} exportRoot
 * @returns {HTMLElement[][]}
 */
function paginateDossierSections(sectionBlocks, meta, exportRoot) {
    const groups = [];
    let current = [];

    const flush = () => {
        if (current.length > 0) {
            groups.push(current.map((block) => block.cloneNode(true)));
            current = [];
        }
    };

    const pageFits = (blocks) => {
        if (blocks.length === 0) return true;
        return measureDossierContentPage(blocks, meta, exportRoot);
    };

    sectionBlocks.forEach((block) => {
        if (pageFits([...current, block])) {
            current.push(block);
            return;
        }

        flush();

        if (pageFits([block])) {
            current.push(block);
            return;
        }

        const parts = splitDossierSectionBlock(block, meta, exportRoot);
        parts.forEach((part) => {
            if (pageFits([...current, part])) {
                current.push(part);
            } else {
                flush();
                current.push(part);
            }
        });
    });

    flush();
    return groups;
}

/**
 * @param {HTMLElement} entryBlock
 * @param {Element[]} whyUnits
 * @param {Element[]} howUnits
 */
function buildEntryPointSplitColumnsChunk(entryBlock, whyUnits, howUnits) {
    const chunkBlock = entryBlock.cloneNode(false);

    const nameEl = entryBlock.querySelector('.ap-export-entry-point-name');
    if (nameEl) chunkBlock.appendChild(nameEl.cloneNode(true));

    const metaEl = entryBlock.querySelector('.ap-export-entry-point-meta');
    if (metaEl) chunkBlock.appendChild(metaEl.cloneNode(true));

    const splitGrid = document.createElement('div');
    splitGrid.className = 'ap-export-editorial-grid ap-export-editorial-grid--entry-split';

    if (whyUnits.length > 0) {
        const whyColumn = document.createElement('div');
        whyColumn.className = 'ap-export-editorial-column';
        const whyTitle = document.createElement('h4');
        whyTitle.className = 'ap-export-editorial-column-title';
        whyTitle.textContent = 'Why';
        whyColumn.appendChild(whyTitle);
        whyUnits.forEach((unit) => whyColumn.appendChild(unit.cloneNode(true)));
        splitGrid.appendChild(whyColumn);
    }

    if (howUnits.length > 0) {
        const howColumn = document.createElement('div');
        howColumn.className = 'ap-export-editorial-column';
        const howTitle = document.createElement('h4');
        howTitle.className = 'ap-export-editorial-column-title';
        howTitle.textContent = 'How';
        howUnits.forEach((unit) => howColumn.appendChild(unit.cloneNode(true)));
        splitGrid.appendChild(howColumn);
    }

    chunkBlock.appendChild(splitGrid);
    return chunkBlock;
}

/**
 * Split an oversized section at panel / entry-point group boundaries.
 * @param {HTMLElement} block
 * @param {{ accountName: string, dateLabel: string }} meta
 * @param {HTMLElement} exportRoot
 * @returns {HTMLElement[]}
 */
function splitDossierSectionBlock(block, meta, exportRoot) {
    if (!(block instanceof HTMLElement)) return [block];

    const sectionTitle = block.querySelector('.ap-export-dossier-section-title')?.textContent?.trim()
        || 'Section';
    const sectionId = block.dataset.sectionId || '';

    const entryGroups = block.querySelectorAll(
        ':scope .ap-export-entry-points-body > .ap-export-entry-point-block'
    );
    if (entryGroups.length > 1) {
        return [...entryGroups].map((group, index) => (
            buildDossierSectionFragment(
                sectionId,
                sectionTitle,
                [group],
                index > 0,
                'ap-export-entry-points-body'
            )
        ));
    }

    const entryBlock = block.querySelector(':scope .ap-export-entry-points-body > .ap-export-entry-point-block');
    if (entryBlock) {
        const columns = [...entryBlock.querySelectorAll(':scope > .ap-export-editorial-grid--entry-split > .ap-export-editorial-column')];
        if (columns.length > 0) {
            const whyColumn = columns.find((col) => col.querySelector('.ap-export-editorial-column-title')?.textContent === 'Why');
            const howColumn = columns.find((col) => col.querySelector('.ap-export-editorial-column-title')?.textContent === 'How');
            const whyUnits = whyColumn
                ? [...whyColumn.querySelectorAll(':scope > .ap-export-editorial-cell')]
                : [];
            const howUnits = howColumn
                ? [...howColumn.querySelectorAll(':scope > .ap-export-editorial-cell')]
                : [];
            const allUnits = [...whyUnits, ...howUnits];

            if (allUnits.length > 1) {
                const entryPointsBodyClass = 'ap-export-entry-points-body';
                const chunks = [];
                let currentWhy = [];
                let currentHow = [];

                allUnits.forEach((unit) => {
                    const isWhy = whyUnits.includes(unit);
                    const trialWhy = isWhy ? [...currentWhy, unit] : [...currentWhy];
                    const trialHow = isWhy ? [...currentHow] : [...currentHow, unit];
                    const trialBlock = buildDossierSectionFragment(
                        sectionId,
                        sectionTitle,
                        [buildEntryPointSplitColumnsChunk(entryBlock, trialWhy, trialHow)],
                        chunks.length > 0,
                        entryPointsBodyClass
                    );

                    if ((currentWhy.length + currentHow.length) === 0 || pageFitsFragment(trialBlock, meta, exportRoot)) {
                        if (isWhy) currentWhy = trialWhy;
                        else currentHow = trialHow;
                    } else {
                        if (currentWhy.length + currentHow.length > 0) {
                            chunks.push(buildDossierSectionFragment(
                                sectionId,
                                sectionTitle,
                                [buildEntryPointSplitColumnsChunk(entryBlock, currentWhy, currentHow)],
                                chunks.length > 0,
                                entryPointsBodyClass
                            ));
                        }
                        if (isWhy) currentWhy = [unit];
                        else currentHow = [unit];
                    }
                });

                if (currentWhy.length + currentHow.length > 0) {
                    chunks.push(buildDossierSectionFragment(
                        sectionId,
                        sectionTitle,
                        [buildEntryPointSplitColumnsChunk(entryBlock, currentWhy, currentHow)],
                        chunks.length > 0,
                        entryPointsBodyClass
                    ));
                }

                if (chunks.length > 0) return chunks;
            }
        }
    }

    const stack = block.querySelector(':scope .ap-export-editorial-grid')
        || block.querySelector(':scope .ap-export-editorial-influence')
        || block.querySelector(':scope .ap-export-editorial-prose')
        || block.querySelector(':scope .ap-export-dossier-body--metric .ap-export-panel-stack')
        || block.querySelector(':scope .ap-export-psych-grid');
    if (!stack) return [block];

    const units = [...stack.children];
    if (units.length <= 1) return [block];

    const stackClass = stack.className;
    const chunks = [];
    let currentUnits = [];

    units.forEach((unit) => {
        const trialUnits = [...currentUnits, unit];
        const trial = buildDossierSectionFragment(sectionId, sectionTitle, trialUnits, chunks.length > 0, stackClass);
        if (currentUnits.length === 0 || pageFitsFragment(trial, meta, exportRoot)) {
            currentUnits = trialUnits;
        } else {
            if (currentUnits.length > 0) {
                chunks.push(buildDossierSectionFragment(
                    sectionId,
                    sectionTitle,
                    currentUnits,
                    chunks.length > 0,
                    stackClass
                ));
            }
            currentUnits = [unit];
        }
    });

    if (currentUnits.length > 0) {
        chunks.push(buildDossierSectionFragment(
            sectionId,
            sectionTitle,
            currentUnits,
            chunks.length > 0,
            stackClass
        ));
    }

    return chunks.length > 0 ? chunks : [block];
}

/**
 * @param {string} sectionId
 * @param {string} sectionTitle
 * @param {Element[]} units
 * @param {boolean} continued
 * @param {string} [stackClass]
 */
function buildDossierSectionFragment(sectionId, sectionTitle, units, continued, stackClass = 'ap-export-editorial-grid') {
    const block = document.createElement('section');
    block.className = 'ap-export-dossier-section';
    block.dataset.sectionId = sectionId;

    const title = document.createElement('h2');
    title.className = 'ap-export-dossier-section-title';
    title.textContent = continued ? `${sectionTitle} (continued)` : sectionTitle;
    block.appendChild(title);

    const isMetric = stackClass.includes('ap-export-panel-stack') || stackClass.includes('ap-export-psych-grid');
    const bodyWrap = document.createElement('div');
    bodyWrap.className = isMetric
        ? 'ap-export-dossier-body ap-export-dossier-body--metric'
        : 'ap-export-dossier-body ap-export-dossier-body--editorial';

    const container = document.createElement('div');
    container.className = stackClass;
    units.forEach((unit) => container.appendChild(unit.cloneNode(true)));
    bodyWrap.appendChild(container);
    block.appendChild(bodyWrap);
    return block;
}

/**
 * @param {HTMLElement} block
 * @param {{ accountName: string, dateLabel: string }} meta
 * @param {HTMLElement} exportRoot
 */
function pageFitsFragment(block, meta, exportRoot) {
    return measureDossierContentPage([block], meta, exportRoot);
}

/**
 * @param {HTMLElement[]} blocks
 * @param {{ accountName: string, dateLabel: string }} meta
 * @param {HTMLElement} exportRoot
 */
function measureDossierContentPage(blocks, meta, exportRoot) {
    const pageEl = buildDossierContentPage(
        blocks.map((block) => block.cloneNode(true)),
        meta,
        { pageNumber: 2, totalPages: 2 }
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
    const isDarkBg = element.classList.contains('ap-export-gpc-cover')
        || element.classList.contains('ap-export-exec-readout--gpc');
    const result = await snapdom(element, {
        scale: 2,
        backgroundColor: isDarkBg ? null : '#ffffff',
    });
    const canvas = await result.toCanvas();
    return canvas.toDataURL('image/png');
}

/**
 * @param {HTMLElement} root
 */
async function waitForImages(root) {
    const images = root.querySelectorAll('img');
    await Promise.all([...images].map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
        });
    }));
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
export function downloadPdfBytes(bytes, filename) {
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
