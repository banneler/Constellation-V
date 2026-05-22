/**
 * Strategic Account OS — off-screen PDF render templates (Snapdom capture).
 */

import { PLAN_SECTIONS, PSYCHOLOGY_SLIDERS } from './account-plan-sections.js';
import { normalizePlan } from './account-plan-data.js';

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
        .map((section) => buildDossierSectionBlock(section, sections))
        .filter(Boolean);

    return {
        sectionBlocks,
        meta: { accountName, dateLabel },
    };
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} sections
 */
function buildDossierSectionBlock(section, sections) {
    const block = document.createElement('section');
    block.className = 'ap-export-dossier-section';
    block.dataset.sectionId = section.id;

    const title = document.createElement('h2');
    title.className = 'ap-export-dossier-section-title';
    title.textContent = section.title;
    block.appendChild(title);

    if (section.type === 'composite_textarea') {
        const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
        const body = document.createElement('div');
        body.className = 'ap-export-dossier-body ap-export-composite-body';
        (section.fields || []).forEach((field) => {
            const value = String(data[field.key] ?? '').trim() || '—';
            const block = document.createElement('div');
            block.className = 'ap-export-composite-block';
            block.innerHTML = `
                <h3>${escapeHtml(field.label)}</h3>
                <p>${escapeHtml(value)}</p>`;
            body.appendChild(block);
        });
        block.appendChild(body);
        return block;
    }

    if (section.type === 'pills_and_narrative') {
        const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
        const pillField = section.pillField || 'selected_pills';
        const pills = Array.isArray(data[pillField]) ? data[pillField] : [];
        const wrap = document.createElement('div');
        wrap.className = 'ap-export-dossier-body ap-export-composite-body';

        if (pills.length > 0) {
            const pillBlock = document.createElement('div');
            pillBlock.className = 'ap-export-composite-block';
            pillBlock.innerHTML = `
                <h3>Selected</h3>
                <p>${escapeHtml(pills.join(', '))}</p>`;
            wrap.appendChild(pillBlock);
        }

        (section.textFields || []).forEach((field) => {
            const value = String(data[field.key] ?? '').trim() || '—';
            const fieldBlock = document.createElement('div');
            fieldBlock.className = 'ap-export-composite-block';
            fieldBlock.innerHTML = `
                <h3>${escapeHtml(field.label)}</h3>
                <p>${escapeHtml(value)}</p>`;
            wrap.appendChild(fieldBlock);
        });

        block.appendChild(wrap);
        return block;
    }

    if (section.type === 'influence_board') {
        const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
        const wrap = document.createElement('div');
        wrap.className = 'ap-export-dossier-body ap-export-composite-body';

        [
            ['Executive', data.executive],
            ['Mid-Level', data.mid_level],
        ].forEach(([label, entries]) => {
            const list = formatInfluenceEntriesForExport(entries);
            const fieldBlock = document.createElement('div');
            fieldBlock.className = 'ap-export-composite-block';
            fieldBlock.innerHTML = `
                <h3>${escapeHtml(label)}</h3>
                <p>${escapeHtml(list || '—')}</p>`;
            wrap.appendChild(fieldBlock);
        });

        const invisibleBlock = document.createElement('div');
        invisibleBlock.className = 'ap-export-composite-block';
        invisibleBlock.innerHTML = `
            <h3>Invisible Org Chart</h3>
            <p>${escapeHtml(String(data.invisible_org_chart ?? '').trim() || '—')}</p>`;
        wrap.appendChild(invisibleBlock);

        block.appendChild(wrap);
        return block;
    }

    if (section.type === 'textarea') {
        const body = document.createElement('div');
        body.className = 'ap-export-dossier-body';
        body.textContent = String(sections[section.id] ?? '').trim() || '—';
        block.appendChild(body);
        return block;
    }

    if (section.type === 'psychology_grid') {
        const psychology = isPlainObject(sections.psychology) ? sections.psychology : {};
        const grid = document.createElement('div');
        grid.className = 'ap-export-psych-grid';
        (section.sliders || PSYCHOLOGY_SLIDERS).forEach((slider) => {
            const value = clampScale(psychology[slider.id], 3);
            grid.appendChild(buildPsychologyBar(slider, value));
        });
        block.appendChild(grid);
        return block;
    }

    if (section.type === 'momentum') {
        const momentum = isPlainObject(sections.relationship_momentum) ? sections.relationship_momentum : {};
        const score = clampScale(momentum.score, 3);
        const wrap = document.createElement('div');
        wrap.className = 'ap-export-momentum-block';
        wrap.innerHTML = `
            <div class="ap-export-momentum-score-row">
                <span class="ap-export-momentum-score">${score}</span>
                <span class="ap-export-momentum-label">${escapeHtml(MOMENTUM_LABELS[score - 1])}</span>
            </div>
            <div class="ap-export-dossier-body">${escapeHtml(String(momentum.narrative ?? '').trim() || '—')}</div>`;
        block.appendChild(wrap);
        return block;
    }

    if (section.type === 'triple_textarea') {
        const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};
        const grid = document.createElement('div');
        grid.className = 'ap-export-plan-grid';
        [
            ['30 Days', plan306090.days_30],
            ['60 Days', plan306090.days_60],
            ['90 Days', plan306090.days_90],
        ].forEach(([label, value]) => {
            const cell = document.createElement('div');
            cell.className = 'ap-export-plan-cell';
            cell.innerHTML = `
                <h3>${escapeHtml(label)}</h3>
                <p>${escapeHtml(String(value ?? '').trim() || '—')}</p>`;
            grid.appendChild(cell);
        });
        block.appendChild(grid);
        return block;
    }

    return block;
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
    root.className = 'ap-export-exec-readout';
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

    root.innerHTML = `
        <div class="ap-export-exec-header">
            <div>
                <p class="ap-export-exec-kicker">Strategic Account Exec Readout</p>
                <h1 class="ap-export-exec-title">${escapeHtml(accountName)}</h1>
            </div>
            <div class="ap-export-exec-meta">${escapeHtml(dateLabel)}</div>
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
        </div>`;

    return root;
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
    const hue = getBarHue(slider.id, value, slider.colorScale);
    row.innerHTML = `
        <div class="ap-export-psych-row-header">
            <span class="ap-export-psych-row-label">${escapeHtml(slider.label)}</span>
            <span class="ap-export-psych-row-value">${value} / 5</span>
        </div>
        <div class="ap-export-psych-track">
            <div class="ap-export-psych-fill" style="width:${pct}%;background:hsl(${hue} 62% 46%)"></div>
        </div>
        <div class="ap-export-psych-scale">
            <span>${escapeHtml(slider.lowLabel)}</span>
            <span>${escapeHtml(slider.highLabel)}</span>
        </div>`;
    return row;
}

/**
 * @param {string} metricId
 * @param {number} value
 * @param {string} [colorScale]
 */
function getBarHue(metricId, value, colorScale = 'direct') {
    const t = (value - 1) / 4;
    if (colorScale === 'inverse' || metricId === 'bureaucracy_level') {
        return Math.round(120 - (t * 120));
    }
    if (metricId === 'technical_sophistication') {
        return Math.round(20 + (t * 100));
    }
    return Math.round(35 + (t * 85));
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
        .ap-export-dossier-page {
            width: ${DOSSIER_WIDTH_PX}px;
            height: ${DOSSIER_HEIGHT_PX}px;
            box-sizing: border-box;
            background: #ffffff;
            color: #1e293b;
            font-family: Helvetica, Arial, sans-serif;
            position: relative;
            overflow: hidden;
        }
        .ap-export-dossier-page-header {
            padding: 40px 48px 16px;
            border-bottom: 2px solid #e2e8f0;
        }
        .ap-export-dossier-kicker {
            margin: 0 0 4px;
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
        }
        .ap-export-dossier-title {
            margin: 0;
            font-size: 28px;
            line-height: 1.15;
            color: #0f172a;
        }
        .ap-export-dossier-date {
            margin: 6px 0 0;
            font-size: 12px;
            color: #64748b;
        }
        .ap-export-dossier-content {
            position: absolute;
            left: 48px;
            right: 48px;
            top: 120px;
            bottom: 48px;
            overflow: hidden;
        }
        .ap-export-dossier-section {
            margin-bottom: 22px;
        }
        .ap-export-dossier-section-title {
            margin: 0 0 8px;
            font-size: 14px;
            line-height: 1.3;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .ap-export-dossier-body {
            font-size: 12px;
            line-height: 1.55;
            color: #334155;
            white-space: pre-wrap;
        }
        .ap-export-psych-grid { display: flex; flex-direction: column; gap: 12px; }
        .ap-export-psych-row-header {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 4px;
            color: #334155;
        }
        .ap-export-psych-row-value { font-weight: 700; color: #0f172a; }
        .ap-export-psych-track {
            height: 8px;
            border-radius: 999px;
            background: #e2e8f0;
            overflow: hidden;
        }
        .ap-export-psych-fill { height: 100%; border-radius: 999px; }
        .ap-export-psych-scale {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #94a3b8;
            margin-top: 3px;
        }
        .ap-export-momentum-score-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }
        .ap-export-momentum-score {
            width: 32px;
            height: 32px;
            border-radius: 999px;
            background: #2563eb;
            color: #fff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 14px;
        }
        .ap-export-momentum-label { font-size: 12px; font-weight: 600; color: #0f172a; }
        .ap-export-plan-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
        }
        .ap-export-plan-cell {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px;
            background: #f8fafc;
        }
        .ap-export-plan-cell h3 {
            margin: 0 0 6px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #64748b;
        }
        .ap-export-plan-cell p {
            margin: 0;
            font-size: 11px;
            line-height: 1.45;
            color: #334155;
            white-space: pre-wrap;
        }
        .ap-export-composite-body {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .ap-export-composite-block h3 {
            margin: 0 0 4px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #64748b;
        }
        .ap-export-composite-block p {
            margin: 0;
            font-size: 12px;
            line-height: 1.55;
            color: #334155;
            white-space: pre-wrap;
        }
        .ap-export-exec-readout {
            box-sizing: border-box;
            background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%);
            color: #ffffff;
            font-family: Helvetica, Arial, sans-serif;
            padding: 36px 40px;
        }
        .ap-export-exec-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 24px;
            margin-bottom: 24px;
        }
        .ap-export-exec-kicker {
            margin: 0 0 6px;
            font-size: 11px;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            opacity: 0.75;
        }
        .ap-export-exec-title {
            margin: 0;
            font-size: 34px;
            line-height: 1.1;
            font-weight: 700;
        }
        .ap-export-exec-meta {
            font-size: 12px;
            opacity: 0.85;
            white-space: nowrap;
        }
        .ap-export-exec-grid {
            display: grid;
            grid-template-columns: 1.4fr 0.8fr;
            grid-template-rows: auto auto;
            gap: 14px;
        }
        .ap-export-exec-panel {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 14px;
            padding: 16px 18px;
            backdrop-filter: blur(4px);
        }
        .ap-export-exec-panel h2 {
            margin: 0 0 10px;
            font-size: 12px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            opacity: 0.85;
        }
        .ap-export-exec-panel p,
        .ap-export-exec-plan-list {
            margin: 0;
            font-size: 13px;
            line-height: 1.5;
        }
        .ap-export-exec-panel-thesis { grid-column: 1; grid-row: 1; }
        .ap-export-exec-panel-momentum { grid-column: 2; grid-row: 1; text-align: center; }
        .ap-export-exec-momentum-score {
            font-size: 48px;
            font-weight: 800;
            line-height: 1;
        }
        .ap-export-exec-momentum-label { font-size: 14px; opacity: 0.9; margin-top: 4px; }
        .ap-export-exec-panel-psych { grid-column: 1; grid-row: 2; }
        .ap-export-exec-panel-plan { grid-column: 2; grid-row: 2; }
        .ap-export-exec-panel-competitive { grid-column: 1 / -1; }
        .ap-export-exec-psych-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
        }
        .ap-export-exec-psych-card {
            background: rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 10px;
        }
        .ap-export-exec-psych-label { font-size: 10px; opacity: 0.85; margin-bottom: 4px; }
        .ap-export-exec-psych-value { font-size: 22px; font-weight: 700; line-height: 1; }
        .ap-export-exec-psych-value span { font-size: 12px; opacity: 0.75; margin-left: 2px; }
        .ap-export-exec-psych-track {
            margin-top: 8px;
            height: 6px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.2);
            overflow: hidden;
        }
        .ap-export-exec-psych-fill {
            height: 100%;
            border-radius: 999px;
            background: #93c5fd;
        }
        .ap-export-exec-plan-list {
            list-style: none;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .ap-export-exec-plan-list strong { margin-right: 6px; }
    `;
    document.head.appendChild(style);
}
