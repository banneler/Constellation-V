/**
 * Strategic Account OS — PDF export engine (Snapdom + pdf-lib).
 */

// Cache-bust query forces browsers to re-fetch the templates module instead
// of serving the pre-cd9c20d cached copy that throws
// `SyntaxError: Unexpected identifier 'contain'` at module load (the bug
// where a CSS comment in the templates module used backticks that closed
// the surrounding template literal). Bump the version any time we need
// to force every client to drop a stale templates module.
import {
    buildDossierTemplate,
    buildGpcCoverPage,
    buildDossierContentPage,
    buildDossierSectionTitleHtml,
    ensureExportTemplateStyles,
    unwrapDossierSectionGroup,
} from './account-plan-export-templates.js?v=2026-05-27-5';

const LETTER_WIDTH_PT = 612;
const LETTER_HEIGHT_PT = 792;

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
            return { bytes, filename: buildFilename(account, 'Strategic_Account_Plan_Summary') };
        }

        throw new Error('Exec presentation export uses PowerPoint. Call generateExecPresentationPptx instead.');
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
 * @param {HTMLElement[]} sectionBlocks
 * @param {{ accountName: string, dateLabel: string }} meta
 * @param {HTMLElement} exportRoot
 * @returns {HTMLElement[][]}
 */
function paginateDossierSections(sectionBlocks, meta, exportRoot) {
    const groups = [];
    let current = [];
    // Toggle via `window.__APP_PAGINATION_DEBUG__ = true` in the devtools
    // console before clicking Export to print per-measurement trace lines.
    // Lives behind a global so it can stay in production without spamming
    // the console for regular users.
    const debug = !!(typeof window !== 'undefined' && window.__APP_PAGINATION_DEBUG__);
    const trace = (msg, data) => {
        if (debug) console.log(`[paginator] ${msg}`, data || '');
    };

    trace(`received ${sectionBlocks.length} section block(s)`,
        sectionBlocks.map((b) => ({
            id: b.dataset?.sectionId || '(no-id)',
            isGroup: b.classList?.contains?.('ap-export-section-group') || false,
        }))
    );

    const flush = () => {
        if (current.length > 0) {
            trace(`flush: page ${groups.length + 1} = [${current.map((b) => b.dataset?.sectionId || '?').join(', ')}]`);
            groups.push(current.map((block) => block.cloneNode(true)));
            current = [];
        }
    };

    const pageFits = (blocks) => {
        if (blocks.length === 0) return true;
        return measureDossierContentPage(blocks, meta, exportRoot, debug);
    };

    sectionBlocks.forEach((block) => {
        const sectionId = block.dataset.sectionId || '';

        if (sectionId === 'psychology') {
            flush();
        }

        if (sectionId === 'entry_points') {
            const entryPages = buildEntryPointsPageGroups(block, meta, exportRoot);
            entryPages.forEach((pageBlocks) => {
                groups.push(pageBlocks.map((pageBlock) => pageBlock.cloneNode(true)));
            });
            return;
        }

        // Orphan-control wrapper: treat the entire group as a single
        // indivisible unit so its members travel together on one page. If the
        // combined group can't fit on its own page (rare with the configured
        // short editorial sections), gracefully unwrap and let normal
        // pagination flow handle each member individually.
        if (block.classList && block.classList.contains('ap-export-section-group')) {
            if (pageFits([...current, block])) {
                current.push(block);
                return;
            }
            flush();
            if (pageFits([block])) {
                current.push(block);
                return;
            }

            const unwrapped = unwrapDossierSectionGroup(block);
            unwrapped.forEach((memberBlock) => {
                if (pageFits([...current, memberBlock])) {
                    current.push(memberBlock);
                    return;
                }
                flush();
                if (pageFits([memberBlock])) {
                    current.push(memberBlock);
                    return;
                }
                const parts = splitDossierSectionBlock(memberBlock, meta, exportRoot);
                parts.forEach((part) => {
                    if (pageFits([...current, part])) {
                        current.push(part);
                    } else {
                        flush();
                        current.push(part);
                    }
                });
            });
            return;
        }

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
    trace(`done: produced ${groups.length} page group(s)`);
    return groups;
}

/**
 * Pack entry-point profiles using page measurement; merge trailing singleton pages when possible.
 * @param {HTMLElement} block
 * @param {{ accountName: string, dateLabel: string }} meta
 * @param {HTMLElement} exportRoot
 * @returns {HTMLElement[][]}
 */
function buildEntryPointsPageGroups(block, meta, exportRoot) {
    const sectionId = block.dataset.sectionId || 'entry_points';
    const sectionTitle = block.dataset.sectionTitle || 'Strategic Entry Points';
    const profiles = [...block.querySelectorAll('.ap-export-target-profiles-body > .ap-export-target-profile')];

    if (profiles.length === 0) {
        return [[block]];
    }

    /**
     * @param {number} count
     * @param {number} startIndex
     */
    const chunkFits = (count, startIndex) => {
        const slice = profiles.slice(startIndex, startIndex + count);
        const trialBlock = buildDossierSectionFragment(
            sectionId,
            sectionTitle,
            slice,
            startIndex > 0,
            'ap-export-target-profiles-body',
            true
        );
        return measureDossierContentPage([trialBlock], meta, exportRoot);
    };

    // Up to three profiles per page when measurement confirms they fit.
    // Condensed CSS (see `.ap-export-target-profiles-body--per-page-3` in
    // export templates) keeps cards readable; pagination falls back to 2 or 1
    // when copy is too long for a triple stack.
    const MAX_PROFILES_PER_PAGE = 3;
    /** @type {{ start: number, count: number }[]} */
    let pageRanges = [];
    let start = 0;
    while (start < profiles.length) {
        let maxFit = 1;
        const remaining = profiles.length - start;
        for (let tryCount = Math.min(remaining, MAX_PROFILES_PER_PAGE); tryCount >= 1; tryCount -= 1) {
            if (chunkFits(tryCount, start)) {
                maxFit = tryCount;
                break;
            }
        }
        pageRanges.push({ start, count: maxFit });
        start += maxFit;
    }

    pageRanges = rebalanceEntryPointPageRanges(pageRanges, profiles.length, chunkFits);

    return pageRanges.map(({ start: rangeStart, count }, pageIndex) => [
        buildDossierSectionFragment(
            sectionId,
            sectionTitle,
            profiles.slice(rangeStart, rangeStart + count),
            pageIndex > 0,
            'ap-export-target-profiles-body',
            true
        ),
    ]);
}

/**
 * Avoid a lone profile on the final page when merging or shifting can fix it.
 * @param {{ start: number, count: number }[]} pageRanges
 * @param {number} totalProfiles
 * @param {(count: number, startIndex: number) => boolean} chunkFits
 * @returns {{ start: number, count: number }[]}
 */
function rebalanceEntryPointPageRanges(pageRanges, totalProfiles, chunkFits) {
    if (pageRanges.length <= 1) return pageRanges;

    const MAX_PROFILES_PER_PAGE = 3;

    const last = pageRanges[pageRanges.length - 1];
    if (last.count !== 1) return pageRanges;

    const prev = pageRanges[pageRanges.length - 2];
    const mergedCount = prev.count + last.count;
    if (mergedCount <= MAX_PROFILES_PER_PAGE && chunkFits(mergedCount, prev.start)) {
        return [
            ...pageRanges.slice(0, -2),
            { start: prev.start, count: mergedCount },
        ];
    }

    if (prev.count > 1) {
        for (let shift = 1; shift < prev.count; shift += 1) {
            const newPrevCount = prev.count - shift;
            const newLastStart = prev.start + newPrevCount;
            const newLastCount = totalProfiles - newLastStart;
            if (
                newLastCount > 1
                && chunkFits(newPrevCount, prev.start)
                && chunkFits(newLastCount, newLastStart)
            ) {
                return [
                    ...pageRanges.slice(0, -2),
                    { start: prev.start, count: newPrevCount },
                    { start: newLastStart, count: newLastCount },
                ];
            }
        }
    }

    return pageRanges;
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
        ':scope .ap-export-target-profiles-body > .ap-export-target-profile'
    );
    if (entryGroups.length > 1 && block.dataset.sectionId !== 'entry_points') {
        return [...entryGroups].map((group, index) => (
            buildDossierSectionFragment(
                sectionId,
                sectionTitle,
                [group],
                index > 0,
                'ap-export-target-profiles-body'
            )
        ));
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
 * @param {boolean} [includeTitle]
 */
function buildDossierSectionFragment(sectionId, sectionTitle, units, continued, stackClass = 'ap-export-editorial-grid', includeTitle = true) {
    const block = document.createElement('section');
    block.className = 'ap-export-dossier-section';
    block.dataset.sectionId = sectionId;
    block.dataset.sectionTitle = sectionTitle;

    if (includeTitle) {
        const title = document.createElement('h2');
        title.className = 'ap-export-dossier-section-title';
        title.innerHTML = buildDossierSectionTitleHtml(sectionId, sectionTitle, continued);
        block.appendChild(title);
    }

    const isMetric = stackClass.includes('ap-export-panel-stack') || stackClass.includes('ap-export-psych-grid');
    const bodyWrap = document.createElement('div');
    bodyWrap.className = isMetric
        ? 'ap-export-dossier-body ap-export-dossier-body--metric'
        : 'ap-export-dossier-body ap-export-dossier-body--editorial';

    const container = document.createElement('div');
    container.className = stackClass;
    if (stackClass.includes('ap-export-target-profiles-body')) {
        if (units.length >= 3) {
            container.classList.add('ap-export-target-profiles-body--per-page-3');
        } else if (units.length === 2) {
            container.classList.add('ap-export-target-profiles-body--per-page-2');
        }
    }
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
/**
 * No measurement buffer — the paginator compares `scrollHeight` directly
 * against `clientHeight`. An earlier defensive 14px buffer (later 2px),
 * paired with `contain: paint` on the content box, ended up causing the
 * 50-page runaway export (every section measured "doesn't fit" against
 * the artificially tightened threshold). Both have been removed; if any
 * single page genuinely overruns by a pixel or two we accept that as
 * preferable to fragmenting the dossier across dozens of pages.
 */
const PAGINATION_SAFETY_BUFFER_PX = 0;

function measureDossierContentPage(blocks, meta, exportRoot, debug = false) {
    const pageEl = buildDossierContentPage(
        blocks.map((block) => block.cloneNode(true)),
        meta,
        { pageNumber: 2, totalPages: 2 }
    );
    exportRoot.appendChild(pageEl);
    const content = pageEl.querySelector('.ap-export-dossier-content');
    const scrollH = content ? content.scrollHeight : 0;
    const clientH = content ? content.clientHeight : 0;
    const fits = content
        ? scrollH <= (clientH - PAGINATION_SAFETY_BUFFER_PX)
        : true;
    if (debug) {
        const ids = blocks.map((b) => b.dataset?.sectionId || '?').join(', ');
        console.log(`[paginator]   measure [${ids}] -> scrollH=${scrollH} clientH=${clientH} fits=${fits}`);
    }
    exportRoot.removeChild(pageEl);
    return fits;
}

/**
 * @param {HTMLElement} element
 */
async function captureElementToPng(element) {
    const isDarkBg = element.classList.contains('ap-export-gpc-cover');
    // Scale 2 (~192 DPI in the 612×792pt PDF) keeps capture fast. Scale 3
    // looked sharper but ~2.25× the pixel count made each page noticeably
    // slower to snapdom + base64-encode + embed, which compounded the
    // perceived slowness when pagination was also producing extra pages.
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
    downloadFileBytes(bytes, filename, 'application/pdf');
}

/**
 * @param {Uint8Array} bytes
 * @param {string} filename
 * @param {string} [mimeType]
 */
export function downloadFileBytes(bytes, filename, mimeType = 'application/octet-stream') {
    const blob = new Blob([bytes], { type: mimeType });
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
