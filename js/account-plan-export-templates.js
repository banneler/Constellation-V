/**
 * Strategic Account OS — off-screen PDF render templates (Snapdom capture).
 */

import { PLAN_SECTIONS, PSYCHOLOGY_SLIDERS, PLAN_306090_HORIZONS } from './account-plan-sections.js';
import { normalizePlan } from './account-plan-data.js';
import {
    GPC_BRAND,
    GPC_LOGO_NAVY,
    GPC_LOGO_WHITE,
    formatGpcFooterDate,
} from './account-plan-export-brand.js';

export const DOSSIER_WIDTH_PX = 816;
export const DOSSIER_HEIGHT_PX = 1056;
export const EXEC_WIDTH_PX = 1056;
export const EXEC_HEIGHT_PX = 594;

const MOMENTUM_LABELS = ['Stalled', 'Cooling', 'Neutral', 'Warming', 'Champion'];

/** Top psychology metrics highlighted on the exec readout slide. */
const EXEC_PSYCHOLOGY_IDS = ['bureaucracy_level', 'technical_sophistication', 'decision_velocity'];

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @returns {{ sectionBlocks: HTMLElement[], meta: { accountName: string, dateLabel: string } }}
 */
export function buildDossierTemplate(plan, account) {
    const normalized = normalizePlan(plan);
    const sections = normalized.current_draft.sections;
    const accountName = account?.name ? String(account.name) : 'Account';
    const dateLabel = formatExportDate(new Date());

    const sectionBlocks = PLAN_SECTIONS
        .filter((section) => section.exportDossier !== false)
        .flatMap((section) => buildDossierSectionUnits(section, sections))
        .filter(Boolean);

    return {
        sectionBlocks,
        meta: { accountName, dateLabel },
    };
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {string} pageTitle
 * @param {HTMLElement} bodyEl
 */
function createDossierPageUnit(section, pageTitle, bodyEl) {
    const block = document.createElement('section');
    block.className = 'ap-export-dossier-section ap-export-page-unit';
    block.dataset.sectionId = section.id;
    block.dataset.pageTitle = pageTitle;
    block.appendChild(bodyEl);
    return block;
}

/**
 * @param {string} title
 * @param {string} text
 * @param {'default' | 'accent' | 'metric'} [variant]
 * @param {string} [descriptor]
 */
function createExportPanel(title, text, variant = 'default', descriptor = '') {
    const panel = document.createElement('div');
    panel.className = `ap-export-panel ap-export-panel--${variant}`;

    const heading = document.createElement('div');
    heading.className = 'ap-export-panel-header';
    const descriptorHtml = descriptor
        ? `<p class="ap-export-panel-descriptor">${escapeHtml(descriptor)}</p>`
        : '';
    heading.innerHTML = `<h3>${escapeHtml(title)}</h3>${descriptorHtml}`;

    const body = document.createElement('div');
    body.className = 'ap-export-panel-body';
    const paragraph = document.createElement('p');
    paragraph.textContent = String(text ?? '').trim() || '—';
    body.appendChild(paragraph);

    panel.appendChild(heading);
    panel.appendChild(body);
    return panel;
}

/**
 * @param {string} className
 */
function createExportPanelStack(className = 'ap-export-panel-stack') {
    const stack = document.createElement('div');
    stack.className = className;
    return stack;
}

/**
 * @param {string} label
 * @param {string} value
 */
function createExportAttrBadge(label, value) {
    const badge = document.createElement('span');
    badge.className = 'ap-export-attr-badge';
    badge.textContent = `${label}: ${value}`;
    return badge;
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} size
 * @returns {T[][]}
 */
function chunkArray(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} sections
 * @returns {HTMLElement[]}
 */
function buildDossierSectionUnits(section, sections) {
    if (section.type === 'composite_textarea') {
        const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
        return (section.fields || []).map((field, index) => {
            const value = String(data[field.key] ?? '').trim();
            const heading = field.label || field.hint || field.key;
            const descriptor = field.label && field.hint ? String(field.hint) : '';
            const stack = createExportPanelStack();
            stack.appendChild(createExportPanel(
                heading,
                value,
                index === 0 ? 'accent' : 'default',
                descriptor
            ));
            const pageTitle = index === 0 ? section.title : `${section.title} — ${heading}`;
            return createDossierPageUnit(section, pageTitle, stack);
        });
    }

    if (section.type === 'pills_and_narrative') {
        const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
        const pillField = section.pillField || 'selected_pills';
        const pills = Array.isArray(data[pillField]) ? data[pillField] : [];
        const units = [];

        if (pills.length > 0) {
            const stack = createExportPanelStack();
            stack.appendChild(createExportPanel(
                section.pillMode === 'either_or' ? 'Tension Choices' : 'Positioning',
                pills.join(', '),
                'accent'
            ));
            units.push(createDossierPageUnit(section, section.title, stack));
        }

        (section.textFields || []).forEach((field, index) => {
            const value = String(data[field.key] ?? '').trim();
            const heading = field.label || field.hint || field.key;
            const stack = createExportPanelStack();
            stack.appendChild(createExportPanel(heading, value));
            const pageTitle = pills.length === 0 && index === 0
                ? section.title
                : `${section.title} — ${heading}`;
            units.push(createDossierPageUnit(section, pageTitle, stack));
        });

        return units;
    }

    if (section.type === 'influence_board') {
        const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
        return [
            ['Executive', formatInfluenceEntriesForExport(data.executive)],
            ['Mid-Level', formatInfluenceEntriesForExport(data.mid_level)],
            ['Invisible Org Chart', String(data.invisible_org_chart ?? '').trim()],
        ].map(([label, value], index) => {
            const stack = createExportPanelStack();
            stack.appendChild(createExportPanel(label, value || '—', index === 0 ? 'accent' : 'default'));
            const pageTitle = index === 0 ? section.title : `${section.title} — ${label}`;
            return createDossierPageUnit(section, pageTitle, stack);
        });
    }

    if (section.type === 'entry_point_carousel') {
        const points = Array.isArray(sections.entry_points) ? sections.entry_points : [];
        const units = [];

        points.forEach((rawPoint) => {
            if (!isPlainObject(rawPoint)) return;
            const contactName = String(rawPoint.contact_name ?? '').trim();
            if (!contactName) return;

            const attrDefs = [
                ['Trust', rawPoint.trust_level],
                ['Responsiveness', rawPoint.responsiveness],
                ['Influence', rawPoint.political_influence],
                ['Comm Style', rawPoint.comm_style],
                ['Compound', rawPoint.compound_potential],
            ].filter(([, val]) => String(val ?? '').trim());

            const narrativeFields = [
                ['Why They Matter', rawPoint.why_they_matter],
                ['Likely Pressure', rawPoint.likely_pressure],
                ['What Failure Looks Like', rawPoint.what_failure_looks_like],
                ['Best Themes', rawPoint.best_themes],
                ['Narrative Openings', rawPoint.narrative_openings],
                ['Tired of Hearing', rawPoint.tired_of_hearing],
                ['Next Move', rawPoint.next_move],
                ['Human Context', rawPoint.human_context],
                ['Mutual Connections', rawPoint.mutual_connections],
            ].filter(([, val]) => String(val ?? '').trim());

            const fieldChunks = chunkArray(narrativeFields, 3);
            if (fieldChunks.length === 0) fieldChunks.push([]);

            fieldChunks.forEach((chunk, chunkIndex) => {
                const stack = createExportPanelStack('ap-export-panel-stack ap-export-entry-point-stack');

                if (chunkIndex === 0 && attrDefs.length > 0) {
                    const attrRow = document.createElement('div');
                    attrRow.className = 'ap-export-attr-badge-row';
                    attrDefs.forEach(([label, val]) => {
                        attrRow.appendChild(createExportAttrBadge(label, String(val).trim()));
                    });
                    stack.appendChild(attrRow);
                }

                chunk.forEach(([label, val]) => {
                    stack.appendChild(createExportPanel(label, String(val)));
                });

                if (chunk.length === 0 && chunkIndex === 0 && attrDefs.length === 0) {
                    stack.appendChild(createExportPanel('Details', 'No narrative details captured.'));
                }

                const pageTitle = chunkIndex === 0
                    ? `${section.title} — ${contactName}`
                    : `${contactName} — Narrative (continued)`;
                units.push(createDossierPageUnit(section, pageTitle, stack));
            });
        });

        if (!units.length) {
            const stack = createExportPanelStack();
            stack.appendChild(createExportPanel('Entry Points', 'No entry points defined.'));
            units.push(createDossierPageUnit(section, section.title, stack));
        }

        return units;
    }

    if (section.type === 'textarea') {
        const stack = createExportPanelStack();
        stack.appendChild(createExportPanel(section.title, String(sections[section.id] ?? '').trim()));
        return [createDossierPageUnit(section, section.title, stack)];
    }

    if (section.type === 'psychology_grid') {
        const psychology = isPlainObject(sections.psychology) ? sections.psychology : {};
        const sliders = section.sliders || PSYCHOLOGY_SLIDERS;
        return chunkArray(sliders, 3).map((chunk, index) => {
            const stack = createExportPanelStack('ap-export-panel-stack ap-export-panel-stack--psych');
            chunk.forEach((slider) => {
                const value = clampScale(psychology[slider.id], 3);
                const panel = document.createElement('div');
                panel.className = 'ap-export-panel ap-export-panel--metric';
                panel.appendChild(buildPsychologyBar(slider, value));
                stack.appendChild(panel);
            });
            const pageTitle = index === 0 ? section.title : `${section.title} (continued)`;
            return createDossierPageUnit(section, pageTitle, stack);
        });
    }

    if (section.type === 'momentum') {
        const momentum = isPlainObject(sections.relationship_momentum) ? sections.relationship_momentum : {};
        const score = clampScale(momentum.score, 3);
        const stack = createExportPanelStack();
        const metricPanel = document.createElement('div');
        metricPanel.className = 'ap-export-panel ap-export-panel--metric';
        metricPanel.innerHTML = `
            <div class="ap-export-momentum-score-row">
                <span class="ap-export-momentum-score">${score}</span>
                <span class="ap-export-momentum-label">${escapeHtml(MOMENTUM_LABELS[score - 1])}</span>
            </div>`;
        stack.appendChild(metricPanel);
        stack.appendChild(createExportPanel('Momentum Narrative', String(momentum.narrative ?? '').trim()));
        return [createDossierPageUnit(section, section.title, stack)];
    }

    if (section.type === 'triple_textarea') {
        const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};
        return PLAN_306090_HORIZONS.map((horizon, index) => {
            const value = String(plan306090[horizon.key] ?? '').trim();
            const stack = createExportPanelStack();
            stack.appendChild(createExportPanel(horizon.title, value, 'accent'));
            const pageTitle = index === 0 ? section.title : `${section.title} — ${horizon.title}`;
            return createDossierPageUnit(section, pageTitle, stack);
        });
    }

    const stack = createExportPanelStack();
    stack.appendChild(createExportPanel(section.title, ''));
    return [createDossierPageUnit(section, section.title, stack)];
}

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @returns {HTMLElement}
 */
export function buildExecReadoutTemplate(plan, account) {
    const normalized = normalizePlan(plan);
    const sections = normalized.current_draft.sections;
    const psychology = isPlainObject(sections.psychology) ? sections.psychology : {};
    const momentum = isPlainObject(sections.relationship_momentum) ? sections.relationship_momentum : {};
    const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};
    const score = clampScale(momentum.score, 3);

    const accountName = account?.name ? String(account.name) : 'Account';
    const dateLabel = formatExportDate(new Date());
    const pursuitThesis = summarizePursuitThesis(sections.pursuit_thesis);
    const competitive = summarizeCompetitiveLandscape(sections.competitive_landscape);

    const root = document.createElement('div');
    root.className = 'ap-export-exec-readout ap-export-exec-readout--gpc';
    root.style.width = `${EXEC_WIDTH_PX}px`;
    root.style.minHeight = `${EXEC_HEIGHT_PX}px`;

    const psychCards = EXEC_PSYCHOLOGY_IDS.map((id) => {
        const def = PSYCHOLOGY_SLIDERS.find((s) => s.id === id);
        if (!def) return '';
        const value = clampScale(psychology[id], 3);
        const pct = ((value - 1) / 4) * 100;
        return `
            <div class="ap-export-exec-psych-card">
                <div class="ap-export-exec-psych-label">${escapeHtml(def.label)}</div>
                <div class="ap-export-exec-psych-value">${value}<span>/5</span></div>
                <div class="ap-export-exec-psych-track"><div class="ap-export-exec-psych-fill" style="width:${pct}%"></div></div>
            </div>`;
    }).join('');

    const planBullets = [
        ['30', plan306090.days_30],
        ['60', plan306090.days_60],
        ['90', plan306090.days_90],
    ].map(([days, text]) => {
        const line = String(text ?? '').trim() || 'Not defined';
        return `<li><strong>${days}d</strong> ${escapeHtml(truncate(line, 140))}</li>`;
    }).join('');

    const footerDate = formatGpcFooterDate(new Date());

    root.innerHTML = `
        <div class="ap-export-exec-gpc-bg" aria-hidden="true">
            <div class="ap-export-exec-gpc-art"></div>
        </div>
        <img class="ap-export-gpc-logo ap-export-gpc-logo--exec" src="${GPC_LOGO_WHITE}" alt="Great Plains Communications" crossorigin="anonymous" />
        <div class="ap-export-exec-gpc-shell">
            <div class="ap-export-exec-gpc-intro">
                <p class="ap-export-exec-kicker">Strategic Account Exec Readout</p>
                <h1 class="ap-export-exec-title">${escapeHtml(accountName)}</h1>
                <p class="ap-export-exec-gpc-date">${escapeHtml(dateLabel)}</p>
            </div>
            <div class="ap-export-exec-grid">
                <div class="ap-export-exec-panel ap-export-exec-panel-thesis">
                    <h2>Pursuit Thesis</h2>
                    <p>${escapeHtml(truncate(pursuitThesis, 420))}</p>
                </div>
                <div class="ap-export-exec-panel ap-export-exec-panel-momentum">
                    <h2>Relationship Momentum</h2>
                    <div class="ap-export-exec-momentum-score">${score}</div>
                    <div class="ap-export-exec-momentum-label">${escapeHtml(MOMENTUM_LABELS[score - 1])}</div>
                </div>
                <div class="ap-export-exec-panel ap-export-exec-panel-psych">
                    <h2>Account Psychology</h2>
                    <div class="ap-export-exec-psych-grid">${psychCards}</div>
                </div>
                <div class="ap-export-exec-panel ap-export-exec-panel-plan">
                    <h2>30 / 60 / 90</h2>
                    <ul class="ap-export-exec-plan-list">${planBullets}</ul>
                </div>
                ${competitive ? `
                <div class="ap-export-exec-panel ap-export-exec-panel-competitive">
                    <h2>Competitive Landscape</h2>
                    <p>${escapeHtml(truncate(competitive, 260))}</p>
                </div>` : ''}
            </div>
        </div>
        <div class="ap-export-exec-gpc-footer">
            <div class="ap-export-gpc-footer-accent ap-export-gpc-footer-accent--exec" aria-hidden="true"></div>
            <span class="ap-export-gpc-footer-left">1 / ${escapeHtml(GPC_BRAND.companyName)}</span>
            <span class="ap-export-gpc-footer-right">${escapeHtml(footerDate)}</span>
        </div>`;

    return root;
}

/**
 * GPC title-slide cover for the dossier PDF.
 * @param {{ accountName: string, dateLabel: string }} meta
 * @returns {HTMLElement}
 */
export function buildGpcCoverPage(meta) {
    const page = document.createElement('div');
    page.className = 'ap-export-gpc-cover';
    page.style.width = `${DOSSIER_WIDTH_PX}px`;
    page.style.height = `${DOSSIER_HEIGHT_PX}px`;
    page.innerHTML = `
        <div class="ap-export-gpc-cover-bg" aria-hidden="true">
            <div class="ap-export-gpc-cover-art"></div>
        </div>
        <img class="ap-export-gpc-logo ap-export-gpc-logo--cover" src="${GPC_LOGO_WHITE}" alt="Great Plains Communications" crossorigin="anonymous" />
        <div class="ap-export-gpc-cover-body">
            <div class="ap-export-gpc-cover-title-frame">
                <h1 class="ap-export-gpc-cover-title">${escapeHtml(meta.accountName)}</h1>
            </div>
            <p class="ap-export-gpc-cover-subtitle">Strategic Account Dossier</p>
            <p class="ap-export-gpc-cover-date">${escapeHtml(meta.dateLabel)}</p>
        </div>`;
    return page;
}

/**
 * GPC content slide for dossier interior pages.
 * @param {HTMLElement[]} blocks
 * @param {{ accountName: string, dateLabel: string }} meta
 * @param {{ pageNumber: number, totalPages: number }} pageInfo
 * @returns {HTMLElement}
 */
export function buildDossierContentPage(blocks, meta, pageInfo) {
    const pageTitle = getContentPageTitle(blocks);
    const footerDate = formatGpcFooterDate(new Date());

    const page = document.createElement('div');
    page.className = 'ap-export-dossier-page ap-export-dossier-page--content';
    page.style.width = `${DOSSIER_WIDTH_PX}px`;
    page.style.height = `${DOSSIER_HEIGHT_PX}px`;

    const header = document.createElement('div');
    header.className = 'ap-export-gpc-page-header';
    header.innerHTML = `
        <img class="ap-export-gpc-logo ap-export-gpc-logo--content" src="${GPC_LOGO_NAVY}" alt="" crossorigin="anonymous" />
        <h1 class="ap-export-gpc-page-title">${escapeHtml(pageTitle)}</h1>
        <p class="ap-export-gpc-page-subtitle">${escapeHtml(meta.accountName)}</p>
        <div class="ap-export-gpc-page-rule"></div>`;
    page.appendChild(header);

    const content = document.createElement('div');
    content.className = 'ap-export-dossier-content';
    blocks.forEach((block) => {
        if (blocks.length === 1) {
            block.querySelector('.ap-export-dossier-section-title')?.remove();
        }
        content.appendChild(block);
    });
    page.appendChild(content);

    const footer = document.createElement('div');
    footer.className = 'ap-export-gpc-page-footer';
    footer.innerHTML = `
        <div class="ap-export-gpc-footer-accent" aria-hidden="true"></div>
        <span class="ap-export-gpc-footer-left">${pageInfo.pageNumber} / ${escapeHtml(GPC_BRAND.companyName)}</span>
        <span class="ap-export-gpc-footer-right">${escapeHtml(footerDate)}</span>`;
    page.appendChild(footer);

    return page;
}

/**
 * @param {HTMLElement[]} blocks
 */
function getContentPageTitle(blocks) {
    if (blocks.length === 1 && blocks[0] instanceof HTMLElement && blocks[0].dataset.pageTitle) {
        return blocks[0].dataset.pageTitle.trim();
    }
    if (blocks.length === 1) {
        const titleEl = blocks[0].querySelector('.ap-export-dossier-section-title');
        if (titleEl?.textContent) return titleEl.textContent.trim();
    }
    return 'Strategic Account Dossier';
}

/**
 * @param {unknown} value
 */
function summarizePursuitThesis(value) {
    if (typeof value === 'string') {
        return value.trim() || 'No pursuit thesis captured yet.';
    }
    if (!isPlainObject(value)) return 'No pursuit thesis captured yet.';

    const parts = [
        value.core ? `Core Thesis: ${String(value.core).trim()}` : '',
        value.cost_of_standing_still ? `Cost of Standing Still: ${String(value.cost_of_standing_still).trim()}` : '',
        value.timing ? `Strategic Timing: ${String(value.timing).trim()}` : '',
    ].filter(Boolean);

    return parts.join('\n\n') || 'No pursuit thesis captured yet.';
}

/**
 * @param {unknown} value
 */
function summarizeCompetitiveLandscape(value) {
    if (typeof value === 'string') {
        return value.trim();
    }
    if (!isPlainObject(value)) return '';

    const pills = Array.isArray(value.positioning_pills) ? value.positioning_pills.join(', ') : '';
    const parts = [
        value.incumbents ? String(value.incumbents).trim() : '',
        pills ? `Positioning: ${pills}` : '',
        value.narrative ? String(value.narrative).trim() : '',
    ].filter(Boolean);

    return parts.join('\n\n');
}

/**
 * @param {unknown} entries
 */
function formatInfluenceEntriesForExport(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return '';

    return entries.map((entry) => {
        if (entry == null) return '';
        if (typeof entry === 'string' || typeof entry === 'number') {
            return `Contact ${entry}`;
        }
        if (isPlainObject(entry)) {
            const label = entry.id != null ? `Contact ${entry.id}` : 'Contact';
            const notes = entry.notes ? `: ${String(entry.notes).trim()}` : '';
            return `${label}${notes}`;
        }
        return '';
    }).filter(Boolean).join('; ');
}

/**
 * @param {import('./account-plan-sections.js').PsychologySliderDef} slider
 * @param {number} value
 */
function buildPsychologyBar(slider, value) {
    const row = document.createElement('div');
    row.className = 'ap-export-psych-row';
    const pct = ((value - 1) / 4) * 100;
    row.innerHTML = `
        <div class="ap-export-psych-row-header">
            <span class="ap-export-psych-row-label">${escapeHtml(slider.label)}</span>
            <span class="ap-export-psych-row-value">${value} / 5</span>
        </div>
        <div class="ap-export-psych-track">
            <div class="ap-export-psych-fill" style="width:${pct}%;background:${GPC_BRAND.teal}"></div>
        </div>
        <div class="ap-export-psych-scale">
            <span>${escapeHtml(slider.lowLabel)}</span>
            <span>${escapeHtml(slider.highLabel)}</span>
        </div>`;
    return row;
}

/**
 * @param {Date} date
 */
function formatExportDate(date) {
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * @param {unknown} value
 */
function isPlainObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {number | string | null | undefined} value
 * @param {number} fallback
 */
function clampScale(value, fallback) {
    const n = parseInt(String(value), 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(5, Math.max(1, n));
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

/**
 * @param {string} text
 * @param {number} max
 */
function truncate(text, max) {
    const trimmed = String(text || '').trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1)}…`;
}

/**
 * Inject shared export styles once into the document head.
 */
export function ensureExportTemplateStyles() {
    if (document.getElementById('account-plan-export-styles')) return;

    const style = document.createElement('style');
    style.id = 'account-plan-export-styles';
    style.textContent = `
        /* --- GPC cover (title slide) --- */
        .ap-export-gpc-cover {
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
            background: ${GPC_BRAND.navyDark};
            color: ${GPC_BRAND.white};
            font-family: ${GPC_BRAND.fontHeading};
        }
        .ap-export-gpc-cover-bg {
            position: absolute;
            inset: 0;
            pointer-events: none;
        }
        .ap-export-gpc-cover-art {
            position: absolute;
            right: 0;
            top: 0;
            width: 48%;
            height: 100%;
            background:
                linear-gradient(155deg, ${GPC_BRAND.navyDeep} 0%, ${GPC_BRAND.navyDeep} 38%, transparent 38%),
                linear-gradient(140deg, transparent 20%, ${GPC_BRAND.teal} 20%, ${GPC_BRAND.teal} 62%, transparent 62%),
                linear-gradient(125deg, transparent 48%, ${GPC_BRAND.lime} 48%, ${GPC_BRAND.lime} 100%);
        }
        .ap-export-gpc-logo--cover {
            position: absolute;
            top: 36px;
            right: 40px;
            width: 168px;
            height: auto;
        }
        .ap-export-gpc-cover-body {
            position: absolute;
            left: 56px;
            right: 42%;
            top: 50%;
            transform: translateY(-50%);
        }
        .ap-export-gpc-cover-title-frame {
            border: 2px solid ${GPC_BRAND.white};
            padding: 18px 22px;
            margin-bottom: 18px;
        }
        .ap-export-gpc-cover-title {
            margin: 0;
            font-size: 34px;
            line-height: 1.15;
            font-weight: 700;
        }
        .ap-export-gpc-cover-subtitle {
            margin: 0 0 10px;
            font-size: 22px;
            line-height: 1.25;
            color: ${GPC_BRAND.lime};
            font-family: ${GPC_BRAND.fontBody};
        }
        .ap-export-gpc-cover-date {
            margin: 0;
            font-size: 14px;
            color: rgba(255,255,255,0.82);
            font-family: ${GPC_BRAND.fontBody};
        }

        /* --- GPC dossier content pages --- */
        .ap-export-dossier-page {
            width: ${DOSSIER_WIDTH_PX}px;
            height: ${DOSSIER_HEIGHT_PX}px;
            box-sizing: border-box;
            background: ${GPC_BRAND.white};
            color: ${GPC_BRAND.textDark};
            font-family: ${GPC_BRAND.fontBody};
            position: relative;
            overflow: hidden;
        }
        .ap-export-gpc-page-header {
            position: absolute;
            left: 48px;
            right: 48px;
            top: 34px;
        }
        .ap-export-gpc-logo--content {
            position: absolute;
            top: 0;
            right: 0;
            width: 120px;
            height: auto;
        }
        .ap-export-gpc-page-title {
            margin: 0 140px 6px 0;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 28px;
            line-height: 1.15;
            font-weight: 700;
            color: ${GPC_BRAND.textDark};
        }
        .ap-export-gpc-page-subtitle {
            margin: 0 140px 12px 0;
            font-size: 16px;
            line-height: 1.3;
            color: ${GPC_BRAND.lime};
            font-weight: 600;
        }
        .ap-export-gpc-page-rule {
            height: 2px;
            background: ${GPC_BRAND.gray};
        }
        .ap-export-dossier-content {
            position: absolute;
            left: 48px;
            right: 48px;
            top: 148px;
            bottom: 58px;
            overflow: hidden;
        }
        .ap-export-gpc-page-footer,
        .ap-export-exec-gpc-footer {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 42px;
            background: ${GPC_BRAND.navyDark};
            color: ${GPC_BRAND.white};
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 48px;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 11px;
            overflow: hidden;
        }
        .ap-export-gpc-footer-left,
        .ap-export-gpc-footer-right {
            position: relative;
            z-index: 2;
        }
        .ap-export-gpc-footer-accent {
            position: absolute;
            right: 0;
            bottom: 0;
            width: 120px;
            height: 42px;
            background:
                linear-gradient(135deg, transparent 35%, ${GPC_BRAND.teal} 35%, ${GPC_BRAND.teal} 68%, ${GPC_BRAND.lime} 68%);
        }
        .ap-export-gpc-footer-accent--exec {
            width: 160px;
            height: 42px;
        }

        /* --- Dossier section typography --- */
        .ap-export-dossier-section { margin-bottom: 18px; }
        .ap-export-dossier-section-title {
            margin: 0 0 8px;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 16px;
            line-height: 1.3;
            color: ${GPC_BRAND.navyDeep};
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .ap-export-dossier-body {
            font-size: 14px;
            line-height: 1.55;
            color: ${GPC_BRAND.textDark};
            white-space: pre-wrap;
        }
        .ap-export-psych-grid { display: flex; flex-direction: column; gap: 10px; }
        .ap-export-psych-row-header {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 4px;
            color: ${GPC_BRAND.textDark};
        }
        .ap-export-psych-row-value { font-weight: 700; color: ${GPC_BRAND.navyDeep}; }
        .ap-export-psych-track {
            height: 8px;
            border-radius: 999px;
            background: ${GPC_BRAND.gray};
            overflow: hidden;
        }
        .ap-export-psych-fill { height: 100%; border-radius: 999px; }
        .ap-export-psych-scale {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #64748b;
            margin-top: 3px;
        }
        .ap-export-momentum-score-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }
        .ap-export-momentum-score {
            width: 34px;
            height: 34px;
            border-radius: 999px;
            background: ${GPC_BRAND.teal};
            color: #fff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 14px;
        }
        .ap-export-momentum-label { font-size: 13px; font-weight: 600; color: ${GPC_BRAND.navyDeep}; }
        .ap-export-plan-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
        }
        .ap-export-plan-cell {
            border: 1px solid ${GPC_BRAND.gray};
            border-radius: 8px;
            padding: 10px;
            background: #f8fafc;
        }
        .ap-export-plan-cell h3 {
            margin: 0 0 6px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: ${GPC_BRAND.teal};
            font-family: ${GPC_BRAND.fontHeading};
        }
        .ap-export-plan-cell p {
            margin: 0;
            font-size: 12px;
            line-height: 1.45;
            color: ${GPC_BRAND.textDark};
            white-space: pre-wrap;
        }
        .ap-export-composite-body {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .ap-export-composite-block h3 {
            margin: 0 0 4px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: ${GPC_BRAND.teal};
            font-family: ${GPC_BRAND.fontHeading};
        }
        .ap-export-composite-block p {
            margin: 0;
            font-size: 14px;
            line-height: 1.55;
            color: ${GPC_BRAND.textDark};
            white-space: pre-wrap;
        }
        .ap-export-page-unit {
            margin: 0;
        }
        .ap-export-panel-stack {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .ap-export-panel-stack--psych {
            gap: 10px;
        }
        .ap-export-panel {
            border: 1px solid ${GPC_BRAND.gray};
            border-radius: 10px;
            overflow: hidden;
            background: #f8fafc;
        }
        .ap-export-panel--accent {
            border-color: color-mix(in srgb, ${GPC_BRAND.teal} 45%, ${GPC_BRAND.gray});
            background: color-mix(in srgb, ${GPC_BRAND.teal} 6%, #ffffff);
        }
        .ap-export-panel--metric {
            padding: 12px 14px;
            background: color-mix(in srgb, ${GPC_BRAND.navyDeep} 4%, #ffffff);
        }
        .ap-export-panel-header {
            padding: 8px 12px;
            border-bottom: 1px solid color-mix(in srgb, ${GPC_BRAND.gray} 80%, transparent);
            background: color-mix(in srgb, ${GPC_BRAND.navyDeep} 5%, #ffffff);
        }
        .ap-export-panel-header h3 {
            margin: 0;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 11px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: ${GPC_BRAND.teal};
        }
        .ap-export-panel-descriptor {
            margin: 0.35rem 0 0;
            font-size: 11px;
            line-height: 1.45;
            color: color-mix(in srgb, ${GPC_BRAND.textDark} 72%, ${GPC_BRAND.gray});
            font-style: italic;
        }
        .ap-export-panel-body {
            padding: 12px 14px;
        }
        .ap-export-panel-body p {
            margin: 0;
            font-size: 14px;
            line-height: 1.55;
            color: ${GPC_BRAND.textDark};
            white-space: pre-wrap;
        }
        .ap-export-attr-badge-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 4px;
        }
        .ap-export-attr-badge {
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 10px;
            font-weight: 600;
            color: ${GPC_BRAND.navyDeep};
            background: color-mix(in srgb, ${GPC_BRAND.lime} 22%, #ffffff);
            border: 1px solid color-mix(in srgb, ${GPC_BRAND.lime} 45%, ${GPC_BRAND.gray});
        }
        .ap-export-entry-point-stack .ap-export-panel + .ap-export-panel {
            margin-top: 0;
        }

        /* --- GPC exec readout (16:9) --- */
        .ap-export-exec-readout--gpc {
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
            background: ${GPC_BRAND.navyDark};
            color: ${GPC_BRAND.white};
            font-family: ${GPC_BRAND.fontBody};
            padding: 28px 36px 52px;
        }
        .ap-export-exec-gpc-bg {
            position: absolute;
            inset: 0;
            pointer-events: none;
        }
        .ap-export-exec-gpc-art {
            position: absolute;
            right: 0;
            top: 0;
            width: 42%;
            height: 100%;
            background:
                linear-gradient(155deg, ${GPC_BRAND.navyDeep} 0%, ${GPC_BRAND.navyDeep} 35%, transparent 35%),
                linear-gradient(140deg, transparent 18%, ${GPC_BRAND.teal} 18%, ${GPC_BRAND.teal} 58%, transparent 58%),
                linear-gradient(125deg, transparent 45%, ${GPC_BRAND.lime} 45%, ${GPC_BRAND.lime} 100%);
        }
        .ap-export-gpc-logo--exec {
            position: absolute;
            top: 22px;
            right: 28px;
            width: 140px;
            height: auto;
            z-index: 3;
        }
        .ap-export-exec-gpc-shell {
            position: relative;
            z-index: 2;
            display: grid;
            grid-template-columns: 0.95fr 1.55fr;
            gap: 20px;
            height: calc(100% - 8px);
        }
        .ap-export-exec-gpc-intro {
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding-right: 12px;
        }
        .ap-export-exec-kicker {
            margin: 0 0 8px;
            font-size: 14px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: ${GPC_BRAND.lime};
            font-family: ${GPC_BRAND.fontHeading};
            font-weight: 700;
        }
        .ap-export-exec-title {
            margin: 0 0 10px;
            font-size: 36px;
            line-height: 1.08;
            font-weight: 700;
            font-family: ${GPC_BRAND.fontHeading};
        }
        .ap-export-exec-gpc-date {
            margin: 0;
            font-size: 13px;
            opacity: 0.85;
        }
        .ap-export-exec-grid {
            display: grid;
            grid-template-columns: 1.35fr 0.85fr;
            grid-template-rows: auto auto;
            gap: 12px;
            align-content: start;
        }
        .ap-export-exec-panel {
            background: rgba(255, 255, 255, 0.96);
            border: 1px solid rgba(255, 255, 255, 0.25);
            border-radius: 10px;
            padding: 14px 16px;
            color: ${GPC_BRAND.textDark};
        }
        .ap-export-exec-panel h2 {
            margin: 0 0 8px;
            font-size: 11px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: ${GPC_BRAND.teal};
            font-family: ${GPC_BRAND.fontHeading};
        }
        .ap-export-exec-panel p,
        .ap-export-exec-plan-list {
            margin: 0;
            font-size: 12px;
            line-height: 1.45;
            color: ${GPC_BRAND.textDark};
        }
        .ap-export-exec-panel-thesis { grid-column: 1; grid-row: 1; }
        .ap-export-exec-panel-momentum { grid-column: 2; grid-row: 1; text-align: center; }
        .ap-export-exec-momentum-score {
            font-size: 42px;
            font-weight: 800;
            line-height: 1;
            color: ${GPC_BRAND.navyDeep};
        }
        .ap-export-exec-momentum-label {
            font-size: 13px;
            color: ${GPC_BRAND.teal};
            margin-top: 4px;
            font-weight: 600;
        }
        .ap-export-exec-panel-psych { grid-column: 1; grid-row: 2; }
        .ap-export-exec-panel-plan { grid-column: 2; grid-row: 2; }
        .ap-export-exec-panel-competitive { grid-column: 1 / -1; }
        .ap-export-exec-psych-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
        }
        .ap-export-exec-psych-card {
            background: #f4f7fa;
            border-radius: 8px;
            padding: 8px;
        }
        .ap-export-exec-psych-label {
            font-size: 10px;
            color: ${GPC_BRAND.navyDeep};
            margin-bottom: 4px;
            font-weight: 600;
        }
        .ap-export-exec-psych-value {
            font-size: 20px;
            font-weight: 700;
            line-height: 1;
            color: ${GPC_BRAND.navyDeep};
        }
        .ap-export-exec-psych-value span { font-size: 11px; opacity: 0.65; margin-left: 2px; }
        .ap-export-exec-psych-track {
            margin-top: 6px;
            height: 6px;
            border-radius: 999px;
            background: ${GPC_BRAND.gray};
            overflow: hidden;
        }
        .ap-export-exec-psych-fill {
            height: 100%;
            border-radius: 999px;
            background: ${GPC_BRAND.lime};
        }
        .ap-export-exec-plan-list {
            list-style: none;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .ap-export-exec-plan-list strong {
            margin-right: 6px;
            color: ${GPC_BRAND.teal};
        }
        .ap-export-exec-gpc-footer {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
        }
    `;
    document.head.appendChild(style);
}
