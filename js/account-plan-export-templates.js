/**
 * Strategic Account OS — off-screen PDF render templates (Snapdom capture).
 */

import {
    PLAN_SECTIONS,
    PSYCHOLOGY_SLIDERS,
    PLAN_306090_HORIZONS,
    TACTICAL_UX_LABELS,
    formatClientCommitmentsLabel,
} from './account-plan-sections.js';
import {
    normalizePlan,
    getWhiteSpaceRows,
    INFLUENCE_CONTACT_FIELD_KEYS,
    ENTRY_POINT_FIELD_KEYS,
} from './account-plan-data.js';
import { formatContactLabel, resolveContactById } from './account-plan-contacts.js';
import { formatPlanHorizonRichHtml } from './account-plan-rich-text.js';
import {
    GPC_BRAND,
    GPC_LOGO_NAVY,
    GPC_LOGO_WHITE,
    formatGpcFooterDate,
} from './account-plan-export-brand.js';

export const PLAN_SUMMARY_DOCUMENT_TITLE = 'Strategic Account Plan Summary';

// ---------------------------------------------------------------------------
// Smart Drop — export presence (null / whitespace / empty arrays)
// ---------------------------------------------------------------------------

/**
 * @param {unknown} value
 */
export function hasMeaningfulText(value) {
    if (value == null) return false;
    if (Array.isArray(value)) {
        return value.some((entry) => hasMeaningfulText(entry));
    }
    if (typeof value === 'object') {
        return Object.values(value).some((entry) => hasMeaningfulText(entry));
    }
    return String(value).replace(/\s+/g, ' ').trim().length > 0;
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function sanitizeStringArray(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((entry) => String(entry ?? '').trim())
        .filter(Boolean);
}

/**
 * @param {unknown} value
 */
function isPlanHorizonTextEmpty(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return true;
    const stripped = raw
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return stripped.length === 0;
}

/**
 * True when a section has no rep-authored content — export engines should
 * omit the entire block (no title, no empty-state placeholder).
 *
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} sections
 * @param {unknown[]} [contacts]
 * @param {{ name?: string } | null} [account]
 */
export function isPlanSectionEmptyForExport(section, sections, contacts = [], account = null) {
    const data = sections[section.id];

    if (section.type === 'account_snapshot') {
        const snap = isPlainObject(data) ? data : {};
        const fields = section.fields || [];
        const snapFilled = fields.some((field) => hasMeaningfulText(snap[field.key]));
        const accountFilled = account && (
            hasMeaningfulText(account.name)
            || hasMeaningfulText(account.industry)
            || account.employee_count != null
            || account.quantity_of_sites != null
            || hasMeaningfulText(account.address)
        );
        return !snapFilled && !accountFilled;
    }

    if (section.type === 'composite_textarea') {
        const obj = isPlainObject(data) ? data : {};
        return !(section.fields || []).some((field) => hasMeaningfulText(obj[field.key]));
    }

    if (section.type === 'triple_textarea') {
        const obj = isPlainObject(data) ? data : {};
        const horizons = section.horizons || PLAN_306090_HORIZONS;
        const horizonFilled = horizons.some((field) => !isPlanHorizonTextEmpty(obj[field.key]));
        const commitmentsFilled = sanitizeStringArray(obj.client_commitments).length > 0;
        return !horizonFilled && !commitmentsFilled;
    }

    if (section.type === 'blindspots_list' || section.id === 'critical_unknowns') {
        const obj = isPlainObject(sections.critical_unknowns) ? sections.critical_unknowns : {};
        const items = sanitizeStringArray(obj.blindspots);
        if (items.length > 0) return false;
        const legacy = String(obj.unknowns ?? '')
            .split(/\r?\n+/)
            .map((line) => line.replace(/^[\s]*(?:[-*\u2022]\s+|\d+[.)]\s+)/, '').trim())
            .filter(Boolean);
        return legacy.length === 0;
    }

    if (section.type === 'pursuit_with_pain') {
        const obj = isPlainObject(data) ? data : {};
        const fieldsFilled = (section.fields || []).some(
            (field) => hasMeaningfulText(obj[field.key])
        );
        const painPills = sanitizeStringArray(obj.operational_pain_selected);
        const painNotes = hasMeaningfulText(obj.operational_pain_notes);
        return !fieldsFilled && painPills.length === 0 && !painNotes;
    }

    if (section.type === 'battlefield') {
        const obj = isPlainObject(data) ? data : {};
        const positioningPills = sanitizeStringArray(obj.positioning_pills);
        const moatPills = sanitizeStringArray(obj.moat_pills);
        const textFilled = (section.textFields || []).some(
            (field) => hasMeaningfulText(obj[field.key])
        );
        return positioningPills.length === 0 && moatPills.length === 0 && !textFilled;
    }

    if (section.type === 'account_expansion') {
        const obj = isPlainObject(data) ? data : {};
        const wedgeFilled = (section.wedgeFields || []).some(
            (field) => hasMeaningfulText(obj[field.key])
        );
        const rows = getWhiteSpaceRows(obj);
        const rowsFilled = rows.some((row) => Object.values(row).some((v) => hasMeaningfulText(v)));
        return !wedgeFilled && !rowsFilled;
    }

    if (section.type === 'pain_signals' || section.type === 'entrenchment') {
        const obj = isPlainObject(data) ? data : {};
        const pillField = section.pillField || 'selected_pills';
        const pills = sanitizeStringArray(obj[pillField]);
        const textFilled = (section.textFields || []).some(
            (field) => hasMeaningfulText(obj[field.key])
        );
        return pills.length === 0 && !textFilled;
    }

    if (section.type === 'pills_and_narrative') {
        const obj = isPlainObject(data) ? data : {};
        const pillField = section.pillField
            || (Array.isArray(obj.positioning_pills) ? 'positioning_pills' : 'selected_pills');
        const pills = sanitizeStringArray(obj[pillField]);
        const textFilled = (section.textFields || []).some(
            (field) => hasMeaningfulText(obj[field.key])
        );
        if (section.id === 'competitive_landscape') {
            return pills.length === 0 && !textFilled;
        }
        return pills.length === 0 && !textFilled;
    }

    if (section.type === 'white_space_matrix') {
        const rows = getWhiteSpaceRows(sections.white_space);
        return !rows.some((row) => Object.values(row).some((v) => hasMeaningfulText(v)));
    }

    if (section.type === 'influence_board') {
        const mapping = isPlainObject(data) ? data : {};
        const hasContacts = ['executive', 'mid_level', 'technical'].some(
            (key) => Array.isArray(mapping[key]) && mapping[key].length > 0
        );
        const accessPath = isPlainObject(mapping.access_path) ? mapping.access_path : {};
        const hasText = [
            mapping.invisible_org_chart,
            mapping.political_dynamics,
            accessPath.current,
            accessPath.desired,
            accessPath.bridge,
            accessPath.strategy,
        ].some((value) => hasMeaningfulText(value));
        return !hasContacts && !hasText;
    }

    if (section.type === 'entry_point_carousel') {
        const points = Array.isArray(sections.entry_points) ? sections.entry_points : [];
        return !points.some((point) => {
            if (!isPlainObject(point)) return false;
            return ENTRY_POINT_FIELD_KEYS.some((key) => hasMeaningfulText(point[key]));
        });
    }

    if (section.type === 'psychology_grid') {
        const psych = isPlainObject(sections.psychology) ? sections.psychology : {};
        const sliderMoved = PSYCHOLOGY_SLIDERS.some((slider) => {
            const value = Number(psych[slider.id]);
            return Number.isFinite(value) && Math.round(value) !== 3;
        });
        if (sliderMoved) return false;
        const gravityFilled = (section.gravityFields || []).some(
            (field) => hasMeaningfulText(psych[field.key])
        );
        if (gravityFilled) return false;
        return !hasMeaningfulText(psych.narrative);
    }

    if (section.type === 'momentum') {
        const momentum = resolveMomentumFromInteractionLog(sections);
        const scoreMoved = momentum.score !== 3;
        return !scoreMoved && !hasMeaningfulText(momentum.narrative);
    }

    if (section.type === 'timeline_view') {
        const notes = getExportMomentumNotes(sections);
        return notes.length === 0;
    }

    return !hasMeaningfulText(data);
}

/**
 * Short-form document label used in the per-page running header. Kept as a
 * literal string (instead of a substring of the long doc title) so the C-suite
 * crumb always reads exactly "Strategic Account Plan" — we no longer call
 * this artifact a "dossier" in any product-facing surface.
 */
const DOSSIER_RUNNING_DOC_LABEL = 'Strategic Account Plan';

export const DOSSIER_WIDTH_PX = 816;
export const DOSSIER_HEIGHT_PX = 1056;
export const EXEC_WIDTH_PX = 1056;
export const EXEC_HEIGHT_PX = 594;

const MOMENTUM_LABELS = ['Stalled', 'Cooling', 'Neutral', 'Warming', 'Champion'];

/** @type {Record<string, string>} */
const INFLUENCE_CONTACT_FIELD_LABELS = {
    influence_level: 'Influence Level',
    political_influence: 'Political Influence',
    relationship_temperature: 'Relationship Temperature',
    strategic_priorities: 'Strategic Priorities',
    personality_style: 'Personality Style',
};

/**
 * Section IDs that should travel together on the same printed page to avoid
 * Narrative order for the Strategic Account Plan Summary export. Data keys
 * stay stable — only the printed sequence changes from the canvas order.
 * @type {ReadonlyArray<string>}
 */
export const DOSSIER_EXPORT_SECTION_ORDER = Object.freeze([
    'account_snapshot',
    'psychology',
    'pursuit_thesis',
    'influence_mapping',
    'white_space',
    'entry_points',
    'competitive_landscape',
    'strategic_tensions',
    'critical_unknowns',
    'plan_30_60_90',
    'client_commitments',
    'momentum_timeline',
]);

/**
 * Fixed page buckets — each inner array is one logical spread. The paginator
 * never merges buckets or pulls sections across bucket boundaries; short
 * pages may leave whitespace rather than shuffling sections out of order.
 *
 * Cover is page 1; these buckets map to content pages 2–8 (entry points may
 * span additional continuation pages within their bucket).
 * @type {ReadonlyArray<ReadonlyArray<string>>}
 */
export const DOSSIER_PAGE_BUCKETS = Object.freeze([
    Object.freeze(['account_snapshot', 'psychology']),
    Object.freeze(['pursuit_thesis']),
    Object.freeze(['influence_mapping']),
    Object.freeze(['white_space']),
    Object.freeze(['entry_points']),
    Object.freeze(['competitive_landscape', 'strategic_tensions', 'critical_unknowns']),
    Object.freeze(['plan_30_60_90', 'client_commitments', 'momentum_timeline']),
]);

/** @type {Record<string, string>} */
const DOSSIER_SECTION_ICONS = {
    account_snapshot: 'fa-building',
    pursuit_thesis: 'fa-bullseye',
    critical_unknowns: 'fa-circle-question',
    strategic_tensions: 'fa-scale-balanced',
    influence_mapping: 'fa-sitemap',
    white_space: 'fa-route',
    competitive_landscape: 'fa-chess-knight',
    psychology: 'fa-brain',
    momentum_timeline: 'fa-bolt',
    plan_30_60_90: 'fa-calendar-check',
    client_commitments: 'fa-handshake',
    entry_points: 'fa-crosshairs',
};

/**
 * @param {string} sectionId
 * @param {string} title
 * @param {boolean} [continued]
 */
export function buildDossierSectionTitleHtml(sectionId, title, continued = false) {
    if (sectionId === 'client_commitments') {
        const iconClass = DOSSIER_SECTION_ICONS.client_commitments;
        const iconHtml = iconClass
            ? `<i class="fas ${iconClass} ap-export-section-icon" aria-hidden="true"></i> `
            : '';
        const main = escapeHtml(TACTICAL_UX_LABELS.clientCommitments);
        const qualifier = escapeHtml(TACTICAL_UX_LABELS.clientCommitmentsQualifier);
        const continuedSuffix = continued ? ' (continued)' : '';
        return `${iconHtml}${main} <span class="ap-export-section-title-qualifier">${qualifier}</span>${continued ? ' (continued)' : ''}`;
    }

    const iconClass = DOSSIER_SECTION_ICONS[sectionId];
    const label = continued ? `${title} (continued)` : title;
    if (iconClass) {
        return `<i class="fas ${iconClass} ap-export-section-icon" aria-hidden="true"></i> ${escapeHtml(label)}`;
    }
    return escapeHtml(label);
}

/**
 * @param {string} title
 * @param {string} sectionId
 */
function buildExecPanelHeading(title, sectionId) {
    const iconClass = DOSSIER_SECTION_ICONS[sectionId];
    const iconHtml = iconClass
        ? `<i class="fas ${iconClass} ap-exec-panel-icon" aria-hidden="true"></i>`
        : '';
    return `<h2 class="ap-exec-panel-heading">${iconHtml}${escapeHtml(title)}</h2>`;
}

/** @typedef {{ pageNumber: number, totalPages: number }} ExecSlidePageInfo */

const EXEC_SLIDE_COUNT = 3;

/**
 * @param {{ name?: string, contacts?: unknown[] } | null | undefined} account
 * @returns {unknown[]}
 */
function getExportContacts(account) {
    return Array.isArray(account?.contacts) ? account.contacts : [];
}

/**
 * @param {Record<string, unknown> | null} contact
 * @returns {string}
 */
function formatInfluenceContactLabel(contact) {
    if (!contact) return '';
    return formatContactLabel({
        ...contact,
        title: contact.title ?? contact.job_title ?? '',
    });
}

/**
 * @param {Record<string, unknown> | null} contact
 * @returns {{ name: string, title: string }}
 */
function formatInfluenceContactParts(contact) {
    if (!contact) return { name: '', title: '' };
    const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    const title = String(contact.title ?? contact.job_title ?? '').trim();
    return { name, title };
}

/**
 * @param {unknown} entry
 * @param {unknown[]} contacts
 * @returns {string}
 */
function formatInfluenceEntryLabel(entry, contacts) {
    if (typeof entry === 'string' || typeof entry === 'number') {
        const contact = resolveContactById(entry, contacts);
        return formatInfluenceContactLabel(contact) || `Contact ${entry}`;
    }
    if (isPlainObject(entry)) {
        const contact = resolveContactById(entry.id, contacts);
        const namePart = formatInfluenceContactLabel(contact)
            || (entry.id != null ? `Contact ${entry.id}` : 'Contact');
        const notes = String(entry.notes ?? '').trim();
        return notes ? `${namePart}: ${notes}` : namePart;
    }
    return '';
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
 * @param {unknown} plan
 * @param {{ name?: string, contacts?: unknown[] } | null} account
 */
function resolveExecExportContext(plan, account) {
    const normalized = normalizePlan(plan);
    const sections = normalized.current_draft.sections;
    const momentum = resolveMomentumFromInteractionLog(sections);
    const contacts = getExportContacts(account);

    return {
        sections,
        contacts,
        accountName: account?.name ? String(account.name) : 'Account',
        dateLabel: formatExportDate(new Date()),
        psychology: isPlainObject(sections.psychology) ? sections.psychology : {},
        plan306090: isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {},
        score: momentum.score,
        pursuitThesis: summarizePursuitThesis(sections.pursuit_thesis),
        competitive: summarizeCompetitiveLandscape(sections.competitive_landscape)
            || 'No competitive landscape captured yet.',
        timelineNotes: getExportMomentumNotes(sections).slice(0, 3),
        momentumNarrative: momentum.narrative,
    };
}

/**
 * @param {string} slideKey
 * @param {string} kicker
 * @param {string} accountName
 * @param {ExecSlidePageInfo} pageInfo
 * @param {'brief' | 'standard'} [titleMode]
 * @param {string} [slideHook]
 */
function createExecSlideElement(slideKey, kicker, accountName, pageInfo, titleMode = 'standard', slideHook = '') {
    const slide = document.createElement('div');
    const hasHighlight = Boolean(slideHook.trim());
    slide.className = `ap-exec-slide ap-exec-slide--${slideKey}${hasHighlight ? ' ap-exec-slide--highlight' : ''}`;
    slide.style.width = `${EXEC_WIDTH_PX}px`;
    slide.style.height = `${EXEC_HEIGHT_PX}px`;

    const titleHtml = titleMode === 'brief'
        ? `<h1 class="ap-exec-slide-title">${escapeHtml(accountName)} <span class="ap-exec-slide-title-sub">Strategic Brief</span></h1>`
        : `<h1 class="ap-exec-slide-title">${escapeHtml(accountName)}</h1>`;
    const hookHtml = hasHighlight
        ? `<p class="ap-exec-slide-hook">${escapeHtml(slideHook.trim())}</p>`
        : '';

    slide.innerHTML = `
        <img class="ap-exec-slide-logo" src="${GPC_LOGO_NAVY}" alt="Great Plains Communications" crossorigin="anonymous" />
        <header class="ap-exec-slide-header">
            <p class="ap-exec-slide-kicker">${escapeHtml(kicker)}</p>
            ${titleHtml}
            ${hookHtml}
            <p class="ap-exec-slide-date">${escapeHtml(formatExportDate(new Date()))}</p>
        </header>
        <div class="ap-exec-slide-body"></div>
        <footer class="ap-exec-slide-footer">
            <span class="ap-exec-slide-footer-left">${pageInfo.pageNumber} / ${escapeHtml(GPC_BRAND.companyName)}</span>
            <span class="ap-exec-slide-footer-right">${escapeHtml(formatGpcFooterDate(new Date()))}</span>
        </footer>`;

    return slide;
}

/**
 * @param {string} className
 * @param {string} title
 * @param {string} sectionId
 */
function createExecPanel(className, title, sectionId) {
    const panel = document.createElement('div');
    panel.className = `ap-exec-panel ${className}`;
    panel.innerHTML = buildExecPanelHeading(title, sectionId);
    return panel;
}

/**
 * @param {Record<string, unknown>} psychology
 */
function buildExecPsychBarsHtml(psychology) {
    return PSYCHOLOGY_SLIDERS.map((slider) => {
        const value = clampScale(psychology[slider.id], 3);
        const pct = ((value - 1) / 4) * 100;
        return `
            <div class="ap-exec-psych-row">
                <div class="ap-exec-psych-row-head">
                    <span>${escapeHtml(slider.label)}</span>
                    <span>${value}/5</span>
                </div>
                <div class="ap-exec-psych-track">
                    <div class="ap-exec-psych-fill" style="width:${pct}%"></div>
                </div>
            </div>`;
    }).join('');
}

/**
 * @param {Record<string, unknown>} sections
 */
function buildExecStrategyBody(sections) {
    const wrap = document.createElement('div');
    wrap.className = 'ap-exec-prose-stack';

    const data = isPlainObject(sections.pursuit_thesis) ? sections.pursuit_thesis : null;
    // Post-Task-2: the merged `thesis` field replaces `core` +
    // `cost_of_standing_still`. We coalesce legacy fields when the new
    // one is empty so unmigrated plans still surface a paragraph.
    const thesisText = data
        ? (String(data.thesis ?? '').trim()
            || [data.core, data.cost_of_standing_still]
                .map((v) => String(v ?? '').trim())
                .filter(Boolean)
                .join('\n\n'))
        : '';
    const blocks = data
        ? [
            [TACTICAL_UX_LABELS.pursuitThesis, thesisText],
            [TACTICAL_UX_LABELS.actionForcingEvent, data.action_forcing_event],
            ['Strategic Timing', data.timing],
        ].filter(([, value]) => String(value ?? '').trim())
        : [];

    if (blocks.length > 0) {
        blocks.forEach(([label, value]) => {
            const block = document.createElement('div');
            block.className = 'ap-exec-prose-block';
            block.innerHTML = `
                <h3 class="ap-exec-prose-kicker">${escapeHtml(label)}</h3>
                <p class="ap-exec-prose-copy">${escapeHtml(String(value ?? '').trim())}</p>`;
            wrap.appendChild(block);
        });
        return wrap;
    }

    const fallback = document.createElement('p');
    fallback.className = 'ap-exec-prose-copy';
    fallback.textContent = summarizePursuitThesis(sections.pursuit_thesis);
    wrap.appendChild(fallback);
    return wrap;
}

/**
 * @param {Record<string, unknown>} sections
 */
function buildExecCompetitiveBody(sections) {
    const wrap = document.createElement('div');
    wrap.className = 'ap-exec-prose-stack';

    const data = isPlainObject(sections.competitive_landscape) ? sections.competitive_landscape : null;
    if (data) {
        const pills = Array.isArray(data.positioning_pills) ? data.positioning_pills.filter(Boolean) : [];
        if (pills.length > 0) {
            const pillBlock = document.createElement('div');
            pillBlock.className = 'ap-exec-prose-block';
            pillBlock.innerHTML = `
                <h3 class="ap-exec-prose-kicker">Positioning</h3>
                <p class="ap-exec-prose-copy">${escapeHtml(pills.join(' · '))}</p>`;
            wrap.appendChild(pillBlock);
        }
        const moatPills = Array.isArray(data.moat_pills) ? data.moat_pills.filter(Boolean) : [];
        if (moatPills.length > 0) {
            const moatBlock = document.createElement('div');
            moatBlock.className = 'ap-exec-prose-block';
            moatBlock.innerHTML = `
                <h3 class="ap-exec-prose-kicker">Moat Factors</h3>
                <p class="ap-exec-prose-copy">${escapeHtml(moatPills.join(' · '))}</p>`;
            wrap.appendChild(moatBlock);
        }
        [
            ['Incumbents', data.incumbents],
            ['Narrative', data.narrative],
            ['Compound Relationships', data.compound_relationships],
            ['Difficult to Remove', data.difficult_to_remove],
        ].filter(([, value]) => String(value ?? '').trim()).forEach(([label, value]) => {
            const block = document.createElement('div');
            block.className = 'ap-exec-prose-block';
            block.innerHTML = `
                <h3 class="ap-exec-prose-kicker">${escapeHtml(label)}</h3>
                <p class="ap-exec-prose-copy">${escapeHtml(String(value ?? '').trim())}</p>`;
            wrap.appendChild(block);
        });
    }

    if (!wrap.childElementCount) {
        const empty = document.createElement('p');
        empty.className = 'ap-exec-prose-copy';
        empty.textContent = summarizeCompetitiveLandscape(sections.competitive_landscape)
            || 'No competitive landscape captured yet.';
        wrap.appendChild(empty);
    }

    return wrap;
}

/**
 * @param {unknown} entries
 */
function buildExecInfluenceListHtml(entries, contacts = []) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return '<li class="ap-exec-influence-item ap-exec-influence-item--empty">—</li>';
    }

    return entries.map((entry) => {
        const label = formatInfluenceEntryLabel(entry, contacts);
        if (!label) return '';
        return `<li class="ap-exec-influence-item"><span class="ap-line-clamp-3">${escapeHtml(label)}</span></li>`;
    }).filter(Boolean).join('');
}

/**
 * @param {Record<string, unknown>} sections
 * @param {number} [maxProfiles]
 */
function buildExecEntryPointsPanel(sections, maxProfiles = 2) {
    const panel = createExecPanel('ap-exec-panel--entry-points', 'Entry Points', 'entry_points');
    const body = buildEntryPointsTargetProfileBody(sections);
    body.classList.add('ap-exec-entry-profiles');

    const profiles = [...body.querySelectorAll('.ap-export-target-profile')];
    profiles.slice(maxProfiles).forEach((node) => node.remove());

    profiles.slice(0, maxProfiles).forEach((profile) => {
        profile.querySelectorAll('.ap-export-profile-copy').forEach((el) => {
            el.classList.add('ap-line-clamp-4');
        });
    });

    panel.appendChild(body);
    return panel;
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
 * @param {string[]} bullets
 */
function buildHighlightBulletsHtml(bullets) {
    return bullets
        .map((bullet) => `<li>${escapeHtml(String(bullet ?? '').trim())}</li>`)
        .join('');
}

/**
 * @param {Array<{ label: string, insight: string }>} callouts
 */
function buildHighlightCalloutsHtml(callouts) {
    return callouts.map((callout) => `
        <div class="ap-exec-psych-callout">
            <div class="ap-exec-psych-callout-label">${escapeHtml(callout.label)}</div>
            <div class="ap-exec-psych-callout-insight">${escapeHtml(callout.insight)}</div>
        </div>`).join('');
}

/**
 * @param {Array<{ name: string, headline: string, hook: string, badges: string }>} entryPoints
 */
function buildHighlightEntryCardsHtml(entryPoints) {
    return entryPoints.map((entry) => `
        <article class="ap-exec-highlight-entry">
            <div class="ap-exec-highlight-entry-name">${escapeHtml(entry.name)}</div>
            <div class="ap-exec-highlight-entry-headline">${escapeHtml(entry.headline)}</div>
            <p class="ap-exec-highlight-entry-hook">${escapeHtml(entry.hook)}</p>
            ${entry.badges ? `<div class="ap-exec-highlight-entry-badges">${escapeHtml(entry.badges)}</div>` : ''}
        </article>`).join('');
}

/**
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight | null} presentationHighlight
 * @returns {Array<(plan: unknown, account: { name?: string } | null, pageInfo?: ExecSlidePageInfo) => HTMLElement>}
 */
export function createExecSlideBuilders(presentationHighlight = null) {
    return [
        (plan, account, pageInfo) => buildSlide1Situation(plan, account, pageInfo, presentationHighlight),
        (plan, account, pageInfo) => buildSlide2Battlefield(plan, account, pageInfo, presentationHighlight),
        (plan, account, pageInfo) => buildSlide3Execution(plan, account, pageInfo, presentationHighlight),
    ];
}

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @param {ExecSlidePageInfo} [pageInfo]
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight | null} [presentationHighlight]
 */
export function buildSlide1Situation(plan, account, pageInfo = { pageNumber: 1, totalPages: EXEC_SLIDE_COUNT }, presentationHighlight = null) {
    const ctx = resolveExecExportContext(plan, account);
    const situation = presentationHighlight?.slides?.situation ?? null;
    const slide = createExecSlideElement(
        'situation',
        'The Situation',
        ctx.accountName,
        pageInfo,
        'brief',
        situation?.headline ?? ''
    );
    const body = slide.querySelector('.ap-exec-slide-body');
    if (!(body instanceof HTMLElement)) return slide;

    const grid = document.createElement('div');
    grid.className = 'ap-exec-grid ap-exec-grid--situation';

    const strategyPanel = createExecPanel(
        'ap-exec-panel--strategy',
        situation?.pursuit_thesis?.headline ?? TACTICAL_UX_LABELS.pursuitThesis,
        'pursuit_thesis'
    );
    if (situation) {
        strategyPanel.querySelector('.ap-exec-panel-heading')?.classList.add('ap-exec-panel-heading--highlight');
        const bullets = document.createElement('ul');
        bullets.className = 'ap-exec-highlight-list';
        bullets.innerHTML = buildHighlightBulletsHtml(situation.pursuit_thesis.bullets);
        strategyPanel.appendChild(bullets);
    } else {
        strategyPanel.appendChild(buildExecStrategyBody(ctx.sections));
    }

    const sideStack = document.createElement('div');
    sideStack.className = 'ap-exec-stack';

    const momentumPanel = createExecPanel('ap-exec-panel--momentum', 'Relationship Momentum', 'momentum_timeline');
    const kpi = document.createElement('div');
    kpi.className = 'ap-exec-kpi';
    kpi.innerHTML = `
        <div class="ap-exec-kpi-score">${ctx.score}</div>
        <div class="ap-exec-kpi-label">${escapeHtml(MOMENTUM_LABELS[ctx.score - 1])}</div>`;
    if (situation?.momentum?.insight) {
        const insight = document.createElement('p');
        insight.className = 'ap-exec-kpi-insight';
        insight.textContent = situation.momentum.insight;
        kpi.appendChild(insight);
    } else if (ctx.momentumNarrative) {
        const insight = document.createElement('p');
        insight.className = 'ap-exec-kpi-insight';
        insight.textContent = ctx.momentumNarrative;
        kpi.appendChild(insight);
    }
    momentumPanel.appendChild(kpi);

    const psychPanel = createExecPanel(
        'ap-exec-panel--psych',
        situation?.psychology?.headline ?? TACTICAL_UX_LABELS.psychologySection,
        'psychology'
    );
    if (situation?.psychology?.callouts?.length) {
        psychPanel.querySelector('.ap-exec-panel-heading')?.classList.add('ap-exec-panel-heading--highlight');
        const psychWrap = document.createElement('div');
        psychWrap.className = 'ap-exec-psych-callouts';
        psychWrap.innerHTML = buildHighlightCalloutsHtml(situation.psychology.callouts);
        psychPanel.appendChild(psychWrap);
    } else {
        const psychWrap = document.createElement('div');
        psychWrap.className = 'ap-exec-psych-stack';
        psychWrap.innerHTML = buildExecPsychBarsHtml(ctx.psychology);
        psychPanel.appendChild(psychWrap);
    }

    sideStack.appendChild(momentumPanel);
    sideStack.appendChild(psychPanel);

    grid.appendChild(strategyPanel);
    grid.appendChild(sideStack);
    body.appendChild(grid);
    return slide;
}

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @param {ExecSlidePageInfo} [pageInfo]
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight | null} [presentationHighlight]
 */
export function buildSlide2Battlefield(plan, account, pageInfo = { pageNumber: 2, totalPages: EXEC_SLIDE_COUNT }, presentationHighlight = null) {
    const ctx = resolveExecExportContext(plan, account);
    const battlefield = presentationHighlight?.slides?.battlefield ?? null;
    const slide = createExecSlideElement(
        'battlefield',
        'The Battlefield',
        ctx.accountName,
        pageInfo,
        'standard',
        battlefield?.headline ?? ''
    );
    const body = slide.querySelector('.ap-exec-slide-body');
    if (!(body instanceof HTMLElement)) return slide;

    const grid = document.createElement('div');
    grid.className = 'ap-exec-grid ap-exec-grid--battlefield';

    const competitivePanel = createExecPanel(
        'ap-exec-panel--competitive',
        battlefield?.competitive?.headline ?? 'Competitive Landscape',
        'competitive_landscape'
    );
    if (battlefield?.competitive?.bullets?.length) {
        competitivePanel.querySelector('.ap-exec-panel-heading')?.classList.add('ap-exec-panel-heading--highlight');
        const bullets = document.createElement('ul');
        bullets.className = 'ap-exec-highlight-list';
        bullets.innerHTML = buildHighlightBulletsHtml(battlefield.competitive.bullets);
        competitivePanel.appendChild(bullets);
    } else {
        competitivePanel.appendChild(buildExecCompetitiveBody(ctx.sections));
    }

    const influencePanel = createExecPanel('ap-exec-panel--influence', 'Influence Board', 'influence_mapping');
    if (battlefield?.influence) {
        influencePanel.innerHTML += `
            <div class="ap-exec-influence-hooks">
                <div class="ap-exec-influence-hook">
                    <h3 class="ap-exec-influence-hook-title">Executive Leadership</h3>
                    <p class="ap-exec-influence-hook-copy">${escapeHtml(battlefield.influence.executive_hook)}</p>
                </div>
                <div class="ap-exec-influence-hook">
                    <h3 class="ap-exec-influence-hook-title">Mid-Level Champions</h3>
                    <p class="ap-exec-influence-hook-copy">${escapeHtml(battlefield.influence.champions_hook)}</p>
                </div>
            </div>`;
    } else {
        const influenceData = isPlainObject(ctx.sections.influence_mapping) ? ctx.sections.influence_mapping : {};
        influencePanel.innerHTML += `
            <div class="ap-exec-influence-buckets">
                <div class="ap-exec-influence-bucket">
                    <h3 class="ap-exec-influence-bucket-title">Executive Leadership</h3>
                    <ul class="ap-exec-influence-list">${buildExecInfluenceListHtml(influenceData.executive, ctx.contacts)}</ul>
                </div>
                <div class="ap-exec-influence-bucket">
                    <h3 class="ap-exec-influence-bucket-title">Mid-Level Champions</h3>
                    <ul class="ap-exec-influence-list">${buildExecInfluenceListHtml(influenceData.mid_level, ctx.contacts)}</ul>
                </div>
            </div>`;
    }

    if (battlefield?.entry_points?.length) {
        const entryPanel = createExecPanel('ap-exec-panel--entry-points', 'Entry Points', 'entry_points');
        const cards = document.createElement('div');
        cards.className = 'ap-exec-highlight-entries';
        cards.innerHTML = buildHighlightEntryCardsHtml(battlefield.entry_points);
        entryPanel.appendChild(cards);
        grid.appendChild(competitivePanel);
        grid.appendChild(influencePanel);
        grid.appendChild(entryPanel);
    } else {
        grid.appendChild(competitivePanel);
        grid.appendChild(influencePanel);
        grid.appendChild(buildExecEntryPointsPanel(ctx.sections));
    }
    body.appendChild(grid);
    return slide;
}

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @param {ExecSlidePageInfo} [pageInfo]
 * @param {import('./account-plan-presentation-types.js').PresentationHighlight | null} [presentationHighlight]
 */
export function buildSlide3Execution(plan, account, pageInfo = { pageNumber: 3, totalPages: EXEC_SLIDE_COUNT }, presentationHighlight = null) {
    const ctx = resolveExecExportContext(plan, account);
    const execution = presentationHighlight?.slides?.execution ?? null;
    const slide = createExecSlideElement(
        'execution',
        'The Execution',
        ctx.accountName,
        pageInfo,
        'standard',
        execution?.headline ?? ''
    );
    const body = slide.querySelector('.ap-exec-slide-body');
    if (!(body instanceof HTMLElement)) return slide;

    const grid = document.createElement('div');
    grid.className = 'ap-exec-grid ap-exec-grid--execution';

    const planPanel = createExecPanel('ap-exec-panel--plan', '30 / 60 / 90', 'plan_30_60_90');
    const planGrid = document.createElement('div');
    planGrid.className = 'ap-exec-plan-horizons';

    const highlightHorizons = execution
        ? [
            { key: 'plan_30', fallbackTitle: 'Next 30 Days' },
            { key: 'plan_60', fallbackTitle: 'Day 31–60' },
            { key: 'plan_90', fallbackTitle: 'Day 61–90' },
        ]
        : null;

    if (highlightHorizons) {
        highlightHorizons.forEach(({ key, fallbackTitle }) => {
            const block = execution[key];
            const { period, action } = parseHorizonHeadline(block?.headline, fallbackTitle);
            const col = document.createElement('div');
            col.className = 'ap-exec-plan-horizon-col ap-exec-plan-horizon-col--highlight';
            col.innerHTML = `
                <div class="ap-exec-plan-horizon-period">${escapeHtml(period)}</div>
                <h3 class="ap-exec-plan-horizon-headline">${escapeHtml(action)}</h3>`;
            const colBody = document.createElement('ul');
            colBody.className = 'ap-exec-highlight-list ap-exec-highlight-list--compact';
            colBody.innerHTML = buildHighlightBulletsHtml(block?.bullets ?? []);
            col.appendChild(colBody);
            planGrid.appendChild(col);
        });
    } else {
        PLAN_306090_HORIZONS.forEach((horizon) => {
            const col = document.createElement('div');
            col.className = 'ap-exec-plan-horizon-col';
            col.innerHTML = `<h3 class="ap-exec-plan-horizon-title">${escapeHtml(horizon.title)}</h3>`;
            const colBody = document.createElement('div');
            colBody.className = 'ap-exec-plan-horizon-body';
            colBody.innerHTML = formatPlanHorizonRichHtml(ctx.plan306090[horizon.key]);
            col.appendChild(colBody);
            planGrid.appendChild(col);
        });
    }
    planPanel.appendChild(planGrid);

    const commitments = Array.isArray(ctx.plan306090?.client_commitments)
        ? ctx.plan306090.client_commitments
        : [];
    if (commitments.length > 0) {
        const giveGet = document.createElement('div');
        giveGet.className = 'ap-exec-client-commitments';
        giveGet.innerHTML = `<h4 class="ap-exec-plan-horizon-title">${escapeHtml(formatClientCommitmentsLabel())}</h4>`;
        const list = document.createElement('ul');
        list.className = 'ap-exec-highlight-list ap-exec-highlight-list--compact';
        list.innerHTML = commitments
            .map((entry) => `<li>${escapeHtml(String(entry ?? '').trim())}</li>`)
            .filter(Boolean)
            .join('');
        giveGet.appendChild(list);
        planPanel.appendChild(giveGet);
    }

    const signalsPanel = createExecPanel('ap-exec-panel--signals', 'Strategic Signals', 'momentum_timeline');
    const signalsList = document.createElement('ul');
    signalsList.className = 'ap-exec-signals-list';
    const signals = execution?.signals?.length ? execution.signals : null;

    if (signals && signals.length > 0) {
        signals.forEach((signal) => {
            const item = document.createElement('li');
            item.className = 'ap-exec-signals-item ap-exec-signals-item--highlight';
            item.innerHTML = `
                <time class="ap-exec-signals-date">${escapeHtml(signal.date_label)}</time>
                <span class="ap-exec-signals-headline">${escapeHtml(signal.headline)}</span>`;
            signalsList.appendChild(item);
        });
    } else if (ctx.timelineNotes.length === 0) {
        signalsList.innerHTML = '<li class="ap-exec-signals-item ap-exec-signals-item--empty"><span class="ap-line-clamp-2">No strategic signals logged.</span></li>';
    } else {
        ctx.timelineNotes.forEach((note) => {
            const item = document.createElement('li');
            item.className = 'ap-exec-signals-item';
            item.innerHTML = `
                <time class="ap-exec-signals-date">${escapeHtml(formatMomentumNoteDateShort(note.date))}</time>
                <span class="ap-line-clamp-3">${escapeHtml(note.text)}</span>`;
            signalsList.appendChild(item);
        });
    }
    signalsPanel.appendChild(signalsList);

    grid.appendChild(planPanel);
    grid.appendChild(signalsPanel);
    body.appendChild(grid);
    return slide;
}

/** @type {Array<(plan: unknown, account: { name?: string } | null, pageInfo?: ExecSlidePageInfo) => HTMLElement>} */
export const EXEC_SLIDE_BUILDERS = createExecSlideBuilders();

/**
 * @param {unknown} plan
 * @param {{ name?: string, contacts?: unknown[] } | null} account
 * @returns {{ sectionBlocks: HTMLElement[], meta: { accountName: string, dateLabel: string } }}
 */
export function buildDossierTemplate(plan, account) {
    const normalized = normalizePlan(plan);
    const sections = normalized.current_draft.sections;
    const accountName = account?.name ? String(account.name) : 'Account';
    const dateLabel = formatExportDate(new Date());
    const contacts = getExportContacts(account);

    const rawBlocks = PLAN_SECTIONS
        .filter((section) => section.exportDossier !== false)
        .filter((section) => !isPlanSectionEmptyForExport(section, sections, contacts, account))
        // Thread `account` through — the account_snapshot section needs the
        // raw account record to render the "Firmographics (CRM)" panel
        // (name / industry / employee_count / sites / address / customer
        // status). Without it those rows render empty.
        .flatMap((section) => buildDossierSectionUnits(section, sections, contacts, account))
        .filter(Boolean);

    const sectionBlocks = orderDossierSectionBlocks(rawBlocks);

    return {
        sectionBlocks,
        meta: { accountName, dateLabel },
    };
}

/**
 * Sort dossier section blocks into the export narrative order.
 * @param {HTMLElement[]} blocks
 * @returns {HTMLElement[]}
 */
export function orderDossierSectionBlocks(blocks) {
    if (!Array.isArray(blocks) || blocks.length === 0) return blocks;

    const orderIndex = new Map(
        DOSSIER_EXPORT_SECTION_ORDER.map((id, index) => [id, index])
    );

    return [...blocks]
        .filter((block) => block instanceof HTMLElement)
        .sort((a, b) => {
            const left = orderIndex.get(a.dataset.sectionId || '') ?? Number.MAX_SAFE_INTEGER;
            const right = orderIndex.get(b.dataset.sectionId || '') ?? Number.MAX_SAFE_INTEGER;
            if (left !== right) return left - right;
            return 0;
        });
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {HTMLElement | null} bodyEl
 * @param {string} [titleOverride]
 * @param {'editorial' | 'metric'} [bodyMode]
 * @param {Record<string, unknown>} [planSections]
 */
/** @type {import('./account-plan-sections.js').PlanSectionDef} */
const CLIENT_COMMITMENTS_DOSSIER_SECTION = {
    id: 'client_commitments',
    type: 'client_commitments',
    title: TACTICAL_UX_LABELS.clientCommitments,
    contextMode: 'none',
};

/**
 * @param {string[]} commitments
 * @returns {HTMLElement}
 */
function createClientCommitmentsDossierBlock(commitments) {
    const body = document.createElement('div');
    body.className = 'ap-export-client-commitments-body';

    if (commitments.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'ap-export-editorial-empty';
        empty.textContent = 'What does the customer owe us this month to keep the deal moving?';
        body.appendChild(empty);
    } else {
        const list = document.createElement('ul');
        list.className = 'ap-export-blindspots-list';
        commitments.forEach((entry) => {
            const text = String(entry ?? '').trim();
            if (!text) return;
            const li = document.createElement('li');
            li.className = 'ap-export-blindspots-item';
            li.textContent = text;
            list.appendChild(li);
        });
        body.appendChild(list);
    }

    return createDossierSectionBlock(
        CLIENT_COMMITMENTS_DOSSIER_SECTION,
        body,
        TACTICAL_UX_LABELS.clientCommitments
    );
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {HTMLElement | null} bodyEl
 * @param {string} [titleOverride]
 * @param {'editorial' | 'metric'} [bodyMode]
 * @param {Record<string, unknown>} [planSections]
 */
function createDossierSectionBlock(section, bodyEl, titleOverride, bodyMode = 'editorial', planSections = null) {
    const block = document.createElement('section');
    block.className = 'ap-export-dossier-section';
    block.dataset.sectionId = section.id;

    const titleText = titleOverride || section.title;
    block.dataset.sectionTitle = titleText;

    const title = document.createElement('h2');
    title.className = 'ap-export-dossier-section-title';
    title.innerHTML = buildDossierSectionTitleHtml(section.id, titleText);
    block.appendChild(title);

    let resolvedBody = bodyEl;
    if (section.type === 'entry_point_carousel') {
        resolvedBody = buildEntryPointsTargetProfileBody(planSections || {});
    }
    if (!resolvedBody) {
        resolvedBody = document.createElement('div');
    }

    const bodyWrap = document.createElement('div');
    bodyWrap.className = bodyMode === 'metric'
        ? 'ap-export-dossier-body ap-export-dossier-body--metric'
        : 'ap-export-dossier-body ap-export-dossier-body--editorial';
    bodyWrap.appendChild(resolvedBody);
    block.appendChild(bodyWrap);
    return block;
}

/**
 * @param {string} [extraClass]
 */
function createEditorialGrid(extraClass = '') {
    const grid = document.createElement('div');
    grid.className = extraClass
        ? `ap-export-editorial-grid ${extraClass}`
        : 'ap-export-editorial-grid';
    return grid;
}

/**
 * @param {string} kicker
 * @param {string} text
 * @param {{ span?: 'full' }} [options]
 */
function createEditorialCell(kicker, text, options = {}) {
    const cell = document.createElement('div');
    cell.className = 'ap-export-editorial-cell';
    if (options.span === 'full') {
        cell.classList.add('ap-export-editorial-span-full');
    }

    const label = document.createElement('h3');
    label.className = 'ap-export-editorial-kicker';
    label.textContent = kicker;

    const copy = document.createElement('p');
    copy.className = 'ap-export-editorial-copy';
    copy.textContent = String(text ?? '').trim() || '—';

    cell.appendChild(label);
    cell.appendChild(copy);
    return cell;
}

/**
 * @param {string} kicker
 * @param {unknown} text
 */
function createEditorialPlanHorizonCell(kicker, text) {
    const cell = document.createElement('div');
    cell.className = 'ap-export-editorial-cell';

    const label = document.createElement('h3');
    label.className = 'ap-export-editorial-kicker';
    label.textContent = kicker;

    const body = document.createElement('div');
    body.className = 'ap-export-plan-horizon-body';
    body.innerHTML = formatPlanHorizonRichHtml(text);

    cell.appendChild(label);
    cell.appendChild(body);
    return cell;
}

/**
 * @param {string} label
 * @param {string[]} pills
 */
function createEditorialPillsRow(label, pills) {
    const row = document.createElement('div');
    row.className = 'ap-export-editorial-pills-row';

    if (label) {
        const labelEl = document.createElement('div');
        labelEl.className = 'ap-export-editorial-pills-label';
        labelEl.textContent = label;
        row.appendChild(labelEl);
    }

    const badges = document.createElement('div');
    badges.className = 'ap-export-badge-row ap-export-badge-row--editorial';
    pills.forEach((pill) => {
        const trimmed = String(pill ?? '').trim();
        if (!trimmed) return;
        const badge = document.createElement('span');
        badge.className = 'ap-export-badge ap-export-badge--editorial';
        badge.textContent = trimmed;
        badges.appendChild(badge);
    });

    if (badges.childElementCount > 0) {
        row.appendChild(badges);
    }
    return row;
}

/**
 * @param {string | string[]} pillsInput
 * @returns {string[]}
 */
function normalizeEditorialPills(pillsInput) {
    if (Array.isArray(pillsInput)) {
        return pillsInput.map((pill) => String(pill ?? '').trim()).filter(Boolean);
    }
    return String(pillsInput ?? '')
        .split(',')
        .map((pill) => pill.trim())
        .filter(Boolean);
}

/**
 * @param {string} pillsLabel
 * @param {string | string[]} pillsInput
 * @param {{ kicker: string, text: string }[]} blocks
 */
function createEditorialProseBlock(pillsLabel, pillsInput, blocks) {
    const prose = document.createElement('div');
    prose.className = 'ap-export-editorial-prose';

    const pills = normalizeEditorialPills(pillsInput);
    if (pills.length > 0) {
        prose.appendChild(createEditorialPillsRow(pillsLabel, pills));
    }

    blocks.forEach(({ kicker, text }) => {
        if (!String(text ?? '').trim() && kicker) return;
        if (kicker) {
            const label = document.createElement('h3');
            label.className = 'ap-export-editorial-kicker';
            label.textContent = kicker;
            prose.appendChild(label);
        }
        const copy = document.createElement('p');
        copy.className = 'ap-export-editorial-copy';
        copy.textContent = String(text ?? '').trim() || '—';
        prose.appendChild(copy);
    });

    if (!prose.childElementCount) {
        const copy = document.createElement('p');
        copy.className = 'ap-export-editorial-copy';
        copy.textContent = '—';
        prose.appendChild(copy);
    }

    return prose;
}

/**
 * @param {string} title
 * @param {string} text
 * @param {'default' | 'accent' | 'metric'} [variant]
 * @param {string} [descriptor]
 * @param {{ span?: 'full' }} [options]
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
 * @param {string} kicker
 * @param {string} text
 */
function createProfileField(kicker, text) {
    const field = document.createElement('div');
    field.className = 'ap-export-profile-field';

    const label = document.createElement('div');
    label.className = 'ap-export-profile-kicker';
    label.textContent = kicker;

    const copy = document.createElement('p');
    copy.className = 'ap-export-profile-copy';
    copy.textContent = String(text ?? '').trim() || '—';

    field.appendChild(label);
    field.appendChild(copy);
    return field;
}

/**
 * @param {string} label
 * @param {unknown} value
 */
function createStatusBadge(label, value) {
    const badge = document.createElement('span');
    badge.className = 'ap-export-badge ap-export-badge--status';

    const labelEl = document.createElement('span');
    labelEl.className = 'ap-export-badge-label';
    labelEl.textContent = `${label}:`;

    const valueEl = document.createElement('span');
    valueEl.className = 'ap-export-badge-value';
    valueEl.textContent = String(value).trim();

    badge.appendChild(labelEl);
    badge.appendChild(valueEl);
    return badge;
}

/**
 * @param {unknown} rawPoint
 * @returns {HTMLElement | null}
 */
function buildTargetProfile(rawPoint) {
    if (!isPlainObject(rawPoint)) return null;
    const contactName = String(rawPoint.contact_name ?? '').trim();
    // Entry points are about CONTACTS now (opportunities live exclusively on
    // White Space rows). Skip the card unless a contact has been mapped — an
    // un-named, contact-less entry point has no useful payload to print.
    if (!contactName) return null;

    const profile = document.createElement('div');
    profile.className = 'ap-export-target-profile';

    const header = document.createElement('div');
    header.className = 'ap-export-target-profile-header';

    const nameEl = document.createElement('h3');
    nameEl.className = 'ap-export-target-profile-name';
    nameEl.textContent = contactName;
    header.appendChild(nameEl);

    const badgeDefs = [
        ['Trust', rawPoint.trust_level],
        ['Responsiveness', rawPoint.responsiveness],
        ['Influence', rawPoint.political_influence],
        ['Comm Style', rawPoint.comm_style],
        ['Compound Potential', rawPoint.compound_potential],
    ].filter(([, val]) => String(val ?? '').trim());

    if (badgeDefs.length > 0) {
        const badgeRow = document.createElement('div');
        badgeRow.className = 'ap-export-badge-row';
        badgeDefs.forEach(([label, val]) => {
            badgeRow.appendChild(createStatusBadge(label, val));
        });
        header.appendChild(badgeRow);
    }

    profile.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'ap-export-target-profile-grid';

    const whyColumn = document.createElement('div');
    whyColumn.className = 'ap-export-target-profile-column';
    const whyTitle = document.createElement('h4');
    whyTitle.className = 'ap-export-target-profile-group-title';
    whyTitle.textContent = 'The Why';
    whyColumn.appendChild(whyTitle);

    const howColumn = document.createElement('div');
    howColumn.className = 'ap-export-target-profile-column';
    const howTitle = document.createElement('h4');
    howTitle.className = 'ap-export-target-profile-group-title';
    howTitle.textContent = 'The How';
    howColumn.appendChild(howTitle);

    // Post-Task-1 the field set is tightened to the consolidated
    // keys. We still fall back to legacy values when the merged field
    // is empty so older exports continue to surface every paragraph
    // the rep originally wrote — the data layer's normalizeEntryPoint
    // will normally have merged these by now, but we keep the fallback
    // in case the export is run against a raw payload.
    const pickMerged = (mergedVal, ...legacyVals) => {
        const merged = String(mergedVal ?? '').trim();
        if (merged) return merged;
        return legacyVals
            .map((v) => String(v ?? '').trim())
            .filter(Boolean)
            .join('\n\n');
    };

    const whyFields = [
        ['Why They Matter', rawPoint.why_they_matter],
        ['Operational Pain', pickMerged(rawPoint.operational_pain, rawPoint.likely_pressure, rawPoint.what_failure_looks_like)],
        ['Mutual Connections', rawPoint.mutual_connections],
        [TACTICAL_UX_LABELS.humanContext, rawPoint.human_context],
    ].filter(([, val]) => String(val ?? '').trim());

    const howFields = [
        ['Conversation Wedge', pickMerged(rawPoint.conversation_wedge, rawPoint.best_themes, rawPoint.narrative_openings)],
        ['Next Move', rawPoint.next_move],
    ].filter(([, val]) => String(val ?? '').trim());

    whyFields.forEach(([label, val]) => {
        whyColumn.appendChild(createProfileField(label, String(val)));
    });
    howFields.forEach(([label, val]) => {
        howColumn.appendChild(createProfileField(label, String(val)));
    });

    if (!whyFields.length && !howFields.length) {
        whyColumn.appendChild(createProfileField('Intelligence', 'No profile details captured.'));
    }

    grid.appendChild(whyColumn);
    grid.appendChild(howColumn);
    profile.appendChild(grid);
    return profile;
}

/**
 * @param {Record<string, unknown>} planSections
 */
function buildEntryPointsTargetProfileBody(planSections) {
    const points = Array.isArray(planSections.entry_points) ? planSections.entry_points : [];
    const body = document.createElement('div');
    body.className = 'ap-export-target-profiles-body';

    points.forEach((rawPoint) => {
        const profile = buildTargetProfile(rawPoint);
        if (profile) body.appendChild(profile);
    });

    if (!body.childElementCount) {
        const empty = document.createElement('p');
        empty.className = 'ap-export-editorial-copy';
        empty.textContent = 'No entry points defined.';
        body.appendChild(empty);
    }

    return body;
}

/**
 * @param {unknown} entries
 * @param {unknown[]} [contacts]
 * @returns {HTMLElement}
 */
function createInfluenceList(entries, contacts = []) {
    const list = document.createElement('ul');
    list.className = 'ap-export-editorial-list';

    if (!Array.isArray(entries) || entries.length === 0) {
        const item = document.createElement('li');
        item.className = 'ap-export-editorial-copy';
        item.textContent = '—';
        list.appendChild(item);
        return list;
    }

    entries.forEach((entry) => {
        if (entry == null) return;
        const label = formatInfluenceEntryLabel(entry, contacts);
        if (!label) return;
        const item = document.createElement('li');
        item.className = 'ap-export-editorial-copy';
        item.textContent = label;
        list.appendChild(item);
    });

    if (!list.childElementCount) {
        const item = document.createElement('li');
        item.className = 'ap-export-editorial-copy';
        item.textContent = '—';
        list.appendChild(item);
    }

    return list;
}

/**
 * @param {string} title
 * @param {Array<[string, unknown]>} rows
 * @returns {HTMLElement}
 */
function createExportDataTable(title, rows) {
    // NOTE: this used to render an actual <table>/<th>/<td> structure.
    // Snapdom's SVG-foreignObject capture path produces visibly softer text
    // for HTML table cells than for normal block/flex layouts (the table
    // layout algorithm sub-pixel positions cells and borders, and the
    // browser then anti-aliases at fractional offsets that don't survive
    // rasterization cleanly at scale 2). Every other surface in the
    // dossier renders with snapdom-crisp text because it's built from
    // <div>/<h3>/<p>; this helper now mirrors that pattern with a flex
    // key/value list so the Account Snapshot page matches the rest of the
    // document's fidelity.
    const wrap = document.createElement('div');
    wrap.className = 'ap-export-data-table-wrap ap-export-kv-list-wrap';

    const heading = document.createElement('h3');
    heading.className = 'ap-export-editorial-kicker';
    heading.textContent = title;
    wrap.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'ap-export-kv-list';

    rows.forEach(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'ap-export-kv-row';

        const labelEl = document.createElement('div');
        labelEl.className = 'ap-export-kv-label';
        labelEl.textContent = label;

        const valueEl = document.createElement('div');
        valueEl.className = 'ap-export-kv-value';
        valueEl.textContent = formatExportTableValue(value);

        row.appendChild(labelEl);
        row.appendChild(valueEl);
        list.appendChild(row);
    });

    wrap.appendChild(list);
    return wrap;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatExportTableValue(value) {
    if (value == null || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    const text = String(value).trim();
    return text || '—';
}

/**
 * @param {HTMLElement} container
 * @param {string} text
 * @param {'default' | 'accent' | 'muted'} [variant]
 */
function appendSnapshotChip(container, text, variant = 'default') {
    const trimmed = String(text ?? '').trim();
    if (!trimmed || trimmed === '—') return;
    const chip = document.createElement('span');
    chip.className = `ap-export-snapshot-chip ap-export-snapshot-chip--${variant}`;
    chip.textContent = trimmed;
    container.appendChild(chip);
}

/**
 * @param {string} label
 * @param {unknown} value
 * @returns {HTMLElement}
 */
function createSnapshotStatCell(label, value) {
    const cell = document.createElement('div');
    cell.className = 'ap-export-snapshot-stat';

    const labelEl = document.createElement('div');
    labelEl.className = 'ap-export-snapshot-stat-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('div');
    valueEl.className = 'ap-export-snapshot-stat-value';
    valueEl.textContent = formatExportTableValue(value);

    cell.appendChild(labelEl);
    cell.appendChild(valueEl);
    return cell;
}

/**
 * @param {string} label
 * @param {string} text
 * @returns {HTMLElement}
 */
function createSnapshotNarrativeCell(label, text) {
    const cell = document.createElement('div');
    cell.className = 'ap-export-snapshot-narrative';

    const labelEl = document.createElement('div');
    labelEl.className = 'ap-export-snapshot-narrative-label';
    labelEl.textContent = label;

    const copy = document.createElement('p');
    copy.className = 'ap-export-snapshot-narrative-copy';
    copy.textContent = text;

    cell.appendChild(labelEl);
    cell.appendChild(copy);
    return cell;
}

/**
 * Compact dashboard-style account snapshot — replaces the tall CRM key/value tables.
 * @param {{ name?: string, industry?: string, employee_count?: number | null, quantity_of_sites?: number | null, address?: string, is_customer?: boolean } | null | undefined} account
 * @param {Record<string, unknown>} snapshot
 * @param {import('./account-plan-sections.js').PlanFieldDef[]} fields
 * @returns {HTMLElement}
 */
function buildAccountSnapshotBody(account, snapshot, fields) {
    const body = document.createElement('div');
    body.className = 'ap-export-snapshot-compact';

    const customerStatus = account?.is_customer === true
        ? 'Customer'
        : account?.is_customer === false
            ? 'Prospect'
            : '';

    const hero = document.createElement('div');
    hero.className = 'ap-export-snapshot-hero';

    const identity = document.createElement('div');
    identity.className = 'ap-export-snapshot-identity';

    const nameEl = document.createElement('div');
    nameEl.className = 'ap-export-snapshot-account-name';
    nameEl.textContent = formatExportTableValue(account?.name);
    identity.appendChild(nameEl);

    const chips = document.createElement('div');
    chips.className = 'ap-export-snapshot-chips';
    appendSnapshotChip(chips, account?.industry);
    appendSnapshotChip(chips, account?.address, 'muted');
    if (account?.quantity_of_sites != null && Number(account.quantity_of_sites) > 0) {
        appendSnapshotChip(chips, `${account.quantity_of_sites} sites`, 'muted');
    }
    if (account?.employee_count != null && Number(account.employee_count) > 0) {
        appendSnapshotChip(chips, `${account.employee_count} employees`, 'muted');
    }
    appendSnapshotChip(chips, customerStatus, customerStatus === 'Customer' ? 'accent' : 'default');
    identity.appendChild(chips);
    hero.appendChild(identity);
    body.appendChild(hero);

    const statFieldKeys = new Set(['existing_providers', 'expansion_potential']);
    const statFields = fields.filter((field) => !statFieldKeys.has(field.key));
    const filledStats = statFields.filter((field) => hasMeaningfulText(snapshot[field.key]));

    if (filledStats.length > 0) {
        const statGrid = document.createElement('div');
        statGrid.className = 'ap-export-snapshot-stat-grid';
        statGrid.style.gridTemplateColumns = `repeat(${filledStats.length}, minmax(0, 1fr))`;
        filledStats.forEach((field) => {
            statGrid.appendChild(createSnapshotStatCell(
                field.label || field.key,
                snapshot[field.key]
            ));
        });
        body.appendChild(statGrid);
    }

    const narrativeFields = fields.filter((field) => statFieldKeys.has(field.key));
    const filledNarratives = narrativeFields.filter((field) => hasMeaningfulText(snapshot[field.key]));

    if (filledNarratives.length > 0) {
        const narratives = document.createElement('div');
        narratives.className = 'ap-export-snapshot-narratives';
        filledNarratives.forEach((field) => {
            narratives.appendChild(createSnapshotNarrativeCell(
                field.label || field.key,
                String(snapshot[field.key] ?? '').trim()
            ));
        });
        body.appendChild(narratives);
    }

    return body;
}

/**
 * @param {Record<string, unknown>} data
 * @param {{ pillsLabel: string, pillField: string, textFields: import('./account-plan-sections.js').PlanFieldDef[] }} config
 * @returns {HTMLElement}
 */
function buildPillsAndTextExportBody(data, config) {
    const pills = Array.isArray(data[config.pillField]) ? data[config.pillField] : [];
    const blocks = config.textFields.map((field) => ({
        kicker: field.label || field.hint || field.key,
        text: String(data[field.key] ?? '').trim(),
    }));
    return createEditorialProseBlock(config.pillsLabel, pills, blocks);
}

/**
 * @param {string} title
 * @param {string[]} pills
 * @param {{ kicker: string, text: string }[]} blocks
 * @returns {HTMLElement}
 */
function buildBattlefieldPanel(title, pills, blocks) {
    const panel = document.createElement('div');
    panel.className = 'ap-export-battlefield-panel';

    const heading = document.createElement('h3');
    heading.className = 'ap-export-battlefield-panel-title';
    heading.textContent = title;
    panel.appendChild(heading);

    if (pills.length > 0) {
        const pillsRow = createEditorialPillsRow('', pills);
        const badgeRow = pillsRow.querySelector('.ap-export-badge-row');
        if (badgeRow) {
            badgeRow.classList.add('ap-export-badge-row--stacked');
        }
        panel.appendChild(pillsRow);
    }

    blocks.forEach(({ kicker, text }) => {
        if (!String(text ?? '').trim() && kicker) return;
        if (kicker) {
            const label = document.createElement('h4');
            label.className = 'ap-export-editorial-kicker';
            label.textContent = kicker;
            panel.appendChild(label);
        }
        const copy = document.createElement('p');
        copy.className = 'ap-export-editorial-copy';
        copy.textContent = String(text ?? '').trim() || '—';
        panel.appendChild(copy);
    });

    if (panel.childElementCount === 1) {
        const copy = document.createElement('p');
        copy.className = 'ap-export-editorial-copy';
        copy.textContent = '—';
        panel.appendChild(copy);
    }

    return panel;
}

/**
 * @param {string} notes
 * @param {string} contactLabel
 * @returns {string}
 */
function normalizeInfluenceNotes(notes, contactLabel) {
    let text = String(notes ?? '').trim().replace(/''/g, "'");
    if (!text || !contactLabel) return text;

    const label = contactLabel.trim();
    const lowerText = text.toLowerCase();
    const lowerLabel = label.toLowerCase();
    if (lowerText.startsWith(lowerLabel)) {
        text = text.slice(label.length).replace(/^[\s:\-—]+/, '').trim();
    }

    const nameOnly = label.split(' — ')[0]?.trim();
    if (nameOnly && nameOnly !== label) {
        const lowerName = nameOnly.toLowerCase();
        if (text.toLowerCase().startsWith(lowerName)) {
            text = text.slice(nameOnly.length).replace(/^[\s:\-—]+/, '').trim();
        }
    }

    return text.replace(/^[\s.:\-—]+/, '').trim();
}

/**
 * @param {unknown[]} entries
 * @returns {boolean}
 */
function hasInfluenceEntries(entries) {
    return Array.isArray(entries) && entries.length > 0;
}

/**
 * @param {HTMLElement} body
 * @param {string} title
 * @param {unknown[]} entries
 * @param {unknown[]} contacts
 * @param {{ fullWidth?: boolean, skipWhenEmpty?: boolean }} [options]
 */
function appendInfluenceTier(body, title, entries, contacts, options = {}) {
    if (options.skipWhenEmpty && !hasInfluenceEntries(entries)) return;

    const tier = document.createElement('div');
    tier.className = 'ap-export-editorial-influence-tier';
    if (options.fullWidth) {
        tier.classList.add('ap-export-editorial-span-full');
    }

    const kicker = document.createElement('h3');
    kicker.className = 'ap-export-editorial-kicker';
    kicker.textContent = title;
    tier.appendChild(kicker);
    tier.appendChild(createInfluenceStructuredList(entries, contacts));
    body.appendChild(tier);
}

/**
 * @param {Record<string, unknown>[]} rows
 * @returns {HTMLElement}
 */
function buildWhiteSpaceMatrixBody(rows) {
    const wrap = document.createElement('div');
    wrap.className = 'ap-export-white-space-wrap';

    if (!rows.length) {
        const empty = document.createElement('p');
        empty.className = 'ap-export-editorial-copy';
        empty.textContent = 'No white space opportunities captured.';
        wrap.appendChild(empty);
        return wrap;
    }

    // CSS Grid-based matrix (NOT an HTML <table>) so snapdom rasterizes it
    // through the same code path as every other surface in the dossier.
    // The <table>-based version produced visibly softer text/borders due
    // to the table layout algorithm's sub-pixel cell positioning under
    // foreignObject capture at scale 2.
    //
    // Column structure (matches the previous <table> exactly):
    //   1. Opportunity              (wider — multi-word names)
    //   2. Area
    //   3. Operational Importance
    //   4. Executive Visibility
    //   5. Confidence
    //   6. Description              (wider — sentence-length)
    //   7. Estimated Value / Sizing Notes  (wider — sentence-length)
    // "Opportunity" falls back to "Opportunity N" when the rep hasn't
    // authored a name yet.
    // Header labels use explicit line breaks (\\n) so PDF capture wraps at
    // phrase boundaries — never mid-word inside narrow grid tracks.
    const columns = [
        { header: 'Opportunity',              key: 'name',                   flex: 1.15, isName: true },
        { header: 'Area',                     key: 'area',                   flex: 0.8 },
        { header: 'Ops\nImportance',              key: 'operational_importance', flex: 1.05 },
        { header: 'Exec\nVisibility',             key: 'executive_visibility',   flex: 1.05 },
        { header: 'Confidence',               key: 'confidence',             flex: 0.95 },
        { header: 'Description',              key: 'opportunity',            flex: 1.55 },
        { header: 'Value /\nSizing',              key: 'value_notes',            flex: 1.35 },
    ];

    const matrix = document.createElement('div');
    matrix.className = 'ap-export-ws-matrix';
    matrix.style.gridTemplateColumns = columns.map((col) => `${col.flex}fr`).join(' ');

    const lastColIdx = columns.length - 1;

    columns.forEach((col, colIdx) => {
        const headerCell = document.createElement('div');
        const classes = ['ap-export-ws-matrix-cell', 'ap-export-ws-matrix-cell--header'];
        if (colIdx === lastColIdx) classes.push('ap-export-ws-matrix-cell--last-col');
        headerCell.className = classes.join(' ');
        headerCell.textContent = col.header;
        matrix.appendChild(headerCell);
    });

    const lastRowIdx = rows.length - 1;
    rows.forEach((row, rowIndex) => {
        const rowOdd = rowIndex % 2 === 1;
        const isLastRow = rowIndex === lastRowIdx;
        columns.forEach((col, colIdx) => {
            const cell = document.createElement('div');
            const classes = ['ap-export-ws-matrix-cell', 'ap-export-ws-matrix-cell--body'];
            if (rowOdd) classes.push('ap-export-ws-matrix-cell--alt');
            if (col.isName) classes.push('ap-export-ws-matrix-cell--name');
            if (colIdx === lastColIdx) classes.push('ap-export-ws-matrix-cell--last-col');
            if (isLastRow) classes.push('ap-export-ws-matrix-cell--last-row');
            cell.className = classes.join(' ');

            if (col.isName) {
                const named = String(row[col.key] ?? '').trim();
                cell.textContent = named || `Opportunity ${rowIndex + 1}`;
            } else {
                cell.textContent = formatExportTableValue(row[col.key]);
            }
            matrix.appendChild(cell);
        });
    });

    wrap.appendChild(matrix);
    return wrap;
}

/**
 * @param {unknown} entry
 * @param {unknown[]} contacts
 * @returns {HTMLElement | null}
 */
function buildInfluenceContactCard(entry, contacts) {
    if (entry == null) return null;

    const card = document.createElement('div');
    card.className = 'ap-export-influence-contact';

    const contact = typeof entry === 'object' && entry != null && 'id' in entry
        ? resolveContactById(entry.id, contacts)
        : resolveContactById(entry, contacts);
    const entryObj = isPlainObject(entry) ? entry : {};

    const nameEl = document.createElement('div');
    nameEl.className = 'ap-export-influence-contact-name';
    const { name, title } = formatInfluenceContactParts(contact);
    const contactLabel = formatInfluenceContactLabel(contact)
        || (entryObj.id != null ? `Contact ${entryObj.id}` : 'Contact');
    nameEl.textContent = name || contactLabel;
    card.appendChild(nameEl);

    if (title && name) {
        const titleEl = document.createElement('div');
        titleEl.className = 'ap-export-influence-contact-title';
        titleEl.textContent = title;
        card.appendChild(titleEl);
    }

    const notes = normalizeInfluenceNotes(entryObj.notes, contactLabel);
    if (notes) {
        card.appendChild(createProfileField('Notes', notes));
    }

    INFLUENCE_CONTACT_FIELD_KEYS.forEach((key) => {
        const value = String(entryObj[key] ?? '').trim();
        if (!value) return;
        card.appendChild(createProfileField(
            INFLUENCE_CONTACT_FIELD_LABELS[key] || key,
            value
        ));
    });

    return card;
}

/**
 * @param {unknown} entries
 * @param {unknown[]} contacts
 * @returns {HTMLElement}
 */
function createInfluenceStructuredList(entries, contacts = []) {
    const list = document.createElement('div');
    list.className = 'ap-export-influence-contact-list';

    if (!Array.isArray(entries) || entries.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'ap-export-editorial-copy';
        empty.textContent = '—';
        list.appendChild(empty);
        return list;
    }

    entries.forEach((entry) => {
        const card = buildInfluenceContactCard(entry, contacts);
        if (card) list.appendChild(card);
    });

    if (!list.childElementCount) {
        const empty = document.createElement('p');
        empty.className = 'ap-export-editorial-copy';
        empty.textContent = '—';
        list.appendChild(empty);
    }

    return list;
}

/**
 * @param {Record<string, unknown>} psychology
 * @param {import('./account-plan-sections.js').PlanFieldDef[]} gravityFields
 * @returns {HTMLElement}
 */
function buildPsychologyGravityGrid(psychology, gravityFields) {
    // Asymmetric 2-col layout:
    //   - Left rail (narrower): the three "dial" fields stacked vertically
    //     (Org Gravity / Innovation Friction / Procurement Friction). Short
    //     single-word values, so a narrow column reads cleanly.
    //   - Right rail (wider): Consensus Requirement + Gravity Narrative.
    //     Narrative is multi-sentence prose, so the wider column keeps the
    //     line length comfortable instead of forcing tight wraps.
    // Falls back to a plain stack if any of the expected fields is missing.
    const byKey = new Map(gravityFields.map((field) => [field.key, field]));
    const cellFor = (key) => {
        const field = byKey.get(key);
        if (!field) return null;
        return createEditorialCell(
            field.label || field.key,
            String(psychology[field.key] ?? '').trim()
        );
    };

    const grid = document.createElement('div');
    grid.className = 'ap-export-psych-gravity-grid ap-export-psych-gravity-grid--split';

    const leftRail = document.createElement('div');
    leftRail.className = 'ap-export-psych-gravity-rail ap-export-psych-gravity-rail--left';
    ['organizational_gravity', 'innovation_friction', 'procurement_friction'].forEach((key) => {
        const cell = cellFor(key);
        if (cell) leftRail.appendChild(cell);
    });

    const rightRail = document.createElement('div');
    rightRail.className = 'ap-export-psych-gravity-rail ap-export-psych-gravity-rail--right';
    ['consensus_requirement', 'narrative'].forEach((key) => {
        const cell = cellFor(key);
        if (cell) rightRail.appendChild(cell);
    });

    grid.appendChild(leftRail);
    grid.appendChild(rightRail);

    // Defensive: if neither rail picked up any of the expected keys (e.g.
    // gravityFields was reshaped), fall back to the legacy 3-col grid so
    // we never silently drop content.
    if (!leftRail.childElementCount && !rightRail.childElementCount) {
        const fallback = createEditorialGrid('ap-export-editorial-grid--3 ap-export-psych-gravity-grid');
        gravityFields.forEach((field) => {
            fallback.appendChild(createEditorialCell(
                field.label || field.key,
                String(psychology[field.key] ?? '').trim()
            ));
        });
        return fallback;
    }

    return grid;
}

/**
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} sections
 * @param {unknown[]} [contacts]
 * @param {{ name?: string, industry?: string, employee_count?: number | null, quantity_of_sites?: number | null, address?: string, is_customer?: boolean } | null} [account]
 * @returns {HTMLElement[]}
 */
function buildDossierSectionUnits(section, sections, contacts = [], account = null) {
    if (section.type === 'account_snapshot') {
        const snapshot = isPlainObject(sections.account_snapshot) ? sections.account_snapshot : {};
        const body = buildAccountSnapshotBody(account, snapshot, section.fields || []);
        return [createDossierSectionBlock(section, body)];
    }

    if (section.type === 'pursuit_with_pain') {
        const data = isPlainObject(sections.pursuit_thesis) ? sections.pursuit_thesis : {};
        const fields = section.fields || [];
        const grid = createEditorialGrid('ap-export-editorial-grid--3');

        fields.forEach((field, index) => {
            const value = String(data[field.key] ?? '').trim();
            const heading = field.label || field.hint || field.key;
            const cellOptions = index >= 3 ? { span: 'full' } : {};
            grid.appendChild(createEditorialCell(heading, value, cellOptions));
        });

        const painPills = sanitizeStringArray(data.operational_pain_selected);
        const painNotes = String(data.operational_pain_notes ?? '').trim();
        const painBody = createEditorialProseBlock(
            'Operational Pain Signals',
            painPills,
            painNotes ? [{ kicker: 'Pain Context', text: painNotes }] : []
        );
        painBody.classList.add('ap-export-editorial-prose--pursuit-pain');

        const wrap = document.createElement('div');
        wrap.className = 'ap-export-pursuit-with-pain-body';
        wrap.appendChild(grid);
        if (painPills.length > 0 || painNotes) {
            wrap.appendChild(painBody);
        }

        return [createDossierSectionBlock(section, wrap)];
    }

    if (section.type === 'pain_signals') {
        const data = isPlainObject(sections.pain_signals) ? sections.pain_signals : {};
        const body = buildPillsAndTextExportBody(data, {
            pillsLabel: 'Pain Signals',
            pillField: section.pillField || 'selected',
            textFields: section.textFields || [{ key: 'notes', hint: 'Notes' }],
        });
        return [createDossierSectionBlock(section, body)];
    }

    if (section.type === 'critical_unknowns' || section.type === 'blindspots_list') {
        // Post-Task-3 the section is "The Blindspots" — a flat string
        // array under sections.critical_unknowns.blindspots. We still
        // accept the legacy `critical_unknowns` type alias above so an
        // older PLAN_SECTIONS configuration would not crash the export.
        const data = isPlainObject(sections.critical_unknowns) ? sections.critical_unknowns : {};
        const items = Array.isArray(data.blindspots)
            ? data.blindspots
            // Legacy fallback: split the old `unknowns` rich-text on
            // newlines so older plans still produce bullets in the PDF.
            : String(data.unknowns ?? '')
                .split(/\r?\n+/)
                .map((line) => line.replace(/^[\s]*(?:[-*\u2022]\s+|\d+[.)]\s+)/, '').trim())
                .filter(Boolean);
        const body = document.createElement('div');
        body.className = 'ap-export-blindspots-body';
        if (items.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'ap-export-blindspots-empty';
            empty.textContent = 'No discovery questions captured yet.';
            body.appendChild(empty);
        } else {
            const list = document.createElement('ul');
            list.className = 'ap-export-blindspots-list';
            items.forEach((item) => {
                const li = document.createElement('li');
                li.className = 'ap-export-blindspots-item';
                li.textContent = String(item ?? '').trim();
                list.appendChild(li);
            });
            body.appendChild(list);
        }
        return [createDossierSectionBlock(section, body)];
    }

    if (section.type === 'battlefield') {
        const data = isPlainObject(sections.competitive_landscape) ? sections.competitive_landscape : {};
        const positioningPills = Array.isArray(data.positioning_pills) ? data.positioning_pills : [];
        const moatPills = Array.isArray(data.moat_pills) ? data.moat_pills : [];
        const textFields = section.textFields || [];
        const competitiveKeys = new Set(['incumbents', 'narrative']);

        const competitiveBlocks = textFields
            .filter((field) => competitiveKeys.has(field.key))
            .map((field) => ({
                kicker: field.label || field.hint || field.key,
                text: String(data[field.key] ?? '').trim(),
            }));
        const moatBlocks = textFields
            .filter((field) => !competitiveKeys.has(field.key))
            .map((field) => ({
                kicker: field.label || field.hint || field.key,
                text: String(data[field.key] ?? '').trim(),
            }));

        const wrap = document.createElement('div');
        wrap.className = 'ap-export-battlefield-body';
        wrap.appendChild(buildBattlefieldPanel('Positioning', positioningPills, competitiveBlocks));
        wrap.appendChild(buildBattlefieldPanel('Incumbent Moat', moatPills, moatBlocks));

        return [createDossierSectionBlock(section, wrap)];
    }

    if (section.type === 'account_expansion') {
        const data = isPlainObject(sections.white_space) ? sections.white_space : {};
        const wedgeFields = section.wedgeFields || [];
        const wrap = document.createElement('div');
        wrap.className = 'ap-export-account-expansion-body';

        const hasWedgeContent = wedgeFields.some((field) => hasMeaningfulText(data[field.key]));
        if (hasWedgeContent) {
            const wedgeGrid = createEditorialGrid('ap-export-editorial-grid--3');
            wedgeFields.forEach((field) => {
                const value = String(data[field.key] ?? '').trim();
                if (!hasMeaningfulText(value)) return;
                wedgeGrid.appendChild(createEditorialCell(
                    field.label || field.hint || field.key,
                    value
                ));
            });
            if (wedgeGrid.childElementCount > 0) {
                wrap.appendChild(wedgeGrid);
            }
        }

        const rows = getWhiteSpaceRows(data);
        wrap.appendChild(buildWhiteSpaceMatrixBody(rows));

        return [createDossierSectionBlock(section, wrap)];
    }

    if (section.type === 'entrenchment') {
        const data = isPlainObject(sections.entrenchment) ? sections.entrenchment : {};
        const body = buildPillsAndTextExportBody(data, {
            pillsLabel: 'Moat Factors',
            pillField: section.pillField || 'moat_pills',
            textFields: section.textFields || [
                { key: 'compound_relationships', hint: 'Compound relationships' },
                { key: 'difficult_to_remove', hint: 'Difficult to remove' },
            ],
        });
        return [createDossierSectionBlock(section, body)];
    }

    if (section.type === 'white_space_matrix') {
        const rows = getWhiteSpaceRows(sections.white_space);
        return [createDossierSectionBlock(section, buildWhiteSpaceMatrixBody(rows))];
    }

    if (section.type === 'composite_textarea') {
        const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
        const fields = section.fields || [];
        const gridClass = section.id === 'white_space' || fields.length >= 3
            ? 'ap-export-editorial-grid--3'
            : fields.length === 2
                ? 'ap-export-editorial-grid--2'
                : '';
        const grid = createEditorialGrid(gridClass);

        // On a 3-column composite grid, any field beyond index 2 wraps
        // to a new row. Without intervention the wrapped cell sits
        // orphaned in column 1 of row 2 with no visual separator above
        // it — the export reads as a continuation of the column above
        // (e.g. Executive Narrative trailing under Pursuit Thesis),
        // not as a new section. Forcing overflow cells into the
        // existing `span: 'full'` mode reuses the
        // `.ap-export-editorial-span-full` style (border-top: 1px
        // solid #e2e8f0 + 18px top padding/margin), which is the same
        // divider line used between sections at the top of the table.
        // Bonus: span-full also widens the line-length, which is
        // better for executive narrative prose.
        const isThreeColGrid = gridClass.includes('ap-export-editorial-grid--3');
        fields.forEach((field, index) => {
            const value = String(data[field.key] ?? '').trim();
            const heading = field.label || field.hint || field.key;
            const cellOptions = isThreeColGrid && index >= 3 ? { span: 'full' } : {};
            grid.appendChild(createEditorialCell(heading, value, cellOptions));
        });

        if (!grid.childElementCount) {
            grid.appendChild(createEditorialCell(section.title, '—'));
        }

        return [createDossierSectionBlock(section, grid)];
    }

    if (section.type === 'pills_and_narrative') {
        const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
        const pillField = section.pillField
            || (Array.isArray(data.positioning_pills) ? 'positioning_pills' : 'selected_pills');
        const pills = Array.isArray(data[pillField]) ? data[pillField] : [];
        const pillsLabel = section.pillMode === 'either_or'
            ? 'Tension Choices'
            : pillField === 'positioning_pills'
                ? 'Positioning'
                : 'Selected';
        const blocks = (section.textFields || []).map((field) => ({
            kicker: field.label || field.hint || field.key,
            text: String(data[field.key] ?? '').trim(),
        }));

        const prose = createEditorialProseBlock(
            pillsLabel,
            pills,
            blocks
        );

        return [createDossierSectionBlock(section, prose)];
    }

    if (section.type === 'influence_board') {
        const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
        const body = document.createElement('div');
        body.className = 'ap-export-editorial-influence ap-export-editorial-influence--v2';

        appendInfluenceTier(body, 'Executive Leadership', data.executive, contacts);
        appendInfluenceTier(body, 'Mid-Level Champions', data.mid_level, contacts);
        appendInfluenceTier(
            body,
            'Technical / Operational Influencers',
            data.technical,
            contacts,
            { fullWidth: true, skipWhenEmpty: true }
        );

        const invisibleTier = document.createElement('div');
        invisibleTier.className = 'ap-export-editorial-influence-tier ap-export-editorial-span-full';
        invisibleTier.appendChild(createEditorialCell(
            'Invisible Org Chart',
            String(data.invisible_org_chart ?? '').trim()
        ));
        body.appendChild(invisibleTier);

        const politicalTier = document.createElement('div');
        politicalTier.className = 'ap-export-editorial-influence-tier ap-export-editorial-span-full';
        politicalTier.appendChild(createEditorialCell(
            'Political Dynamics',
            String(data.political_dynamics ?? '').trim()
        ));
        body.appendChild(politicalTier);

        const accessPath = isPlainObject(data.access_path) ? data.access_path : {};
        const accessGrid = createEditorialGrid('ap-export-editorial-grid--2 ap-export-editorial-span-full');
        [
            ['Current Access', accessPath.current],
            ['Desired Access', accessPath.desired],
            ['Bridge Contacts', accessPath.bridge],
            ['Access Strategy', accessPath.strategy],
        ].forEach(([label, value]) => {
            accessGrid.appendChild(createEditorialCell(label, String(value ?? '').trim()));
        });
        body.appendChild(accessGrid);

        return [createDossierSectionBlock(section, body)];
    }

    if (section.type === 'entry_point_carousel') {
        return [createDossierSectionBlock(section, null, undefined, 'editorial', sections)];
    }

    if (section.type === 'textarea') {
        const prose = createEditorialProseBlock('', '', [{
            kicker: section.title,
            text: String(sections[section.id] ?? '').trim(),
        }]);
        return [createDossierSectionBlock(section, prose)];
    }

    if (section.type === 'psychology_grid') {
        const psychology = isPlainObject(sections.psychology) ? sections.psychology : {};
        const sliders = section.sliders || PSYCHOLOGY_SLIDERS;
        const wrap = document.createElement('div');
        wrap.className = 'ap-export-psych-export-wrap';

        // McKinsey-style 2-column grid of slim horizontal bars. The row IS
        // the card (no outer panel wrap) — keeps the visual treatment crisp
        // and gives each metric maximum horizontal runway for the bar.
        const grid = document.createElement('div');
        grid.className = 'ap-export-psych-grid ap-export-psych-grid--dossier';
        sliders.forEach((slider) => {
            const value = clampScale(psychology[slider.id], 3);
            grid.appendChild(buildPsychologyBar(slider, value));
        });
        wrap.appendChild(grid);

        const gravityFields = section.gravityFields || [];
        if (gravityFields.length > 0) {
            const gravityHeading = document.createElement('h3');
            gravityHeading.className = 'ap-export-editorial-kicker ap-export-psych-gravity-heading';
            gravityHeading.textContent = 'Enterprise Gravity';
            wrap.appendChild(gravityHeading);
            wrap.appendChild(buildPsychologyGravityGrid(psychology, gravityFields));
        }

        return [createDossierSectionBlock(section, wrap, undefined, 'metric')];
    }

    if (section.type === 'momentum') {
        const momentum = resolveMomentumFromInteractionLog(sections);
        const score = momentum.score;
        const stack = createExportPanelStack('ap-export-panel-stack ap-export-panel-stack--momentum');
        stack.appendChild(buildMomentumMetricPanel(score));
        stack.appendChild(createExportPanel('Momentum Narrative', momentum.narrative));
        return [createDossierSectionBlock(section, stack, undefined, 'metric')];
    }

    if (section.type === 'timeline_view') {
        return [createDossierSectionBlock(section, buildDossierMomentumTimelineBody(sections))];
    }

    if (section.type === 'triple_textarea') {
        const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};
        const horizons = section.horizons || PLAN_306090_HORIZONS;
        const horizonFilled = horizons.some((horizon) => !isPlanHorizonTextEmpty(plan306090[horizon.key]));
        const commitments = sanitizeStringArray(plan306090.client_commitments);

        const buildPlanGrid = () => {
            const grid = createEditorialGrid('ap-export-editorial-grid--3 ap-export-editorial-grid--plan');
            horizons.forEach((horizon) => {
                grid.appendChild(createEditorialPlanHorizonCell(
                    horizon.title,
                    plan306090[horizon.key]
                ));
            });
            return grid;
        };

        /** @type {HTMLElement[]} */
        const blocks = [];

        if (horizonFilled) {
            blocks.push(createDossierSectionBlock(section, buildPlanGrid()));
            blocks.push(createClientCommitmentsDossierBlock(commitments));
        } else if (commitments.length > 0) {
            blocks.push(createClientCommitmentsDossierBlock(commitments));
        } else {
            blocks.push(createDossierSectionBlock(section, buildPlanGrid()));
            blocks.push(createClientCommitmentsDossierBlock([]));
        }

        return blocks;
    }

    const prose = createEditorialProseBlock('', '', [{ kicker: section.title, text: '' }]);
    return [createDossierSectionBlock(section, prose)];
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
            <p class="ap-export-gpc-cover-subtitle">${escapeHtml(PLAN_SUMMARY_DOCUMENT_TITLE)}</p>
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

    // Unified running header — identical structure on every interior page so
    // there is no "first page is special" treatment. The three-part crumb
    // (<Account> | Strategic Dossier | <Section>) reads like a tasteful
    // newspaper running head and the logo anchors the right edge.
    const header = document.createElement('div');
    header.className = 'ap-export-gpc-page-header';
    header.innerHTML = `
        <div class="ap-export-gpc-header-row">
            <div class="ap-export-gpc-running" role="presentation">
                <span class="ap-export-gpc-running-account">${escapeHtml(meta.accountName)}</span>
                <span class="ap-export-gpc-running-sep" aria-hidden="true"></span>
                <span class="ap-export-gpc-running-doc">${escapeHtml(DOSSIER_RUNNING_DOC_LABEL)}</span>
                <span class="ap-export-gpc-running-sep" aria-hidden="true"></span>
                <span class="ap-export-gpc-running-section">${escapeHtml(pageTitle)}</span>
            </div>
            <img class="ap-export-gpc-logo ap-export-gpc-logo--content" src="${GPC_LOGO_NAVY}" alt="" crossorigin="anonymous" />
        </div>
        <div class="ap-export-gpc-page-rule"></div>`;
    page.appendChild(header);

    const content = document.createElement('div');
    content.className = 'ap-export-dossier-content';
    blocks.forEach((block) => {
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
    if (!Array.isArray(blocks) || blocks.length === 0) {
        return PLAN_SUMMARY_DOCUMENT_TITLE;
    }

    // Collect the section titles in document order (including for grouped
    // pages where multiple sections share a page). The running header reads
    // best when it leads with the first section the reader's eye lands on,
    // rather than falling back to the document title for multi-section pages.
    const orderedTitles = blocks
        .flatMap((block) => collectBlockSectionTitles(block))
        .filter(Boolean);

    if (orderedTitles.length === 0) {
        return PLAN_SUMMARY_DOCUMENT_TITLE;
    }

    const distinctTitles = [...new Set(orderedTitles)];
    const continued = blocks.some((block) => {
        if (!(block instanceof HTMLElement)) return false;
        return Boolean(block.querySelector('.ap-export-dossier-section-title')?.textContent?.includes('(continued)'));
    });

    if (distinctTitles.length === 1) {
        return continued ? `${distinctTitles[0]} (continued)` : distinctTitles[0];
    }

    // Multi-section page (e.g. an orphan-control group, or two packed shorts).
    // Lead with the first section's title — that is what the reader sees at
    // the top of the page — without a "continued" suffix.
    return distinctTitles[0];
}

/**
 * @param {Element | HTMLElement} block
 * @returns {string[]}
 */
function collectBlockSectionTitles(block) {
    if (!(block instanceof HTMLElement)) return [];
    if (block.classList.contains('ap-export-section-group')) {
        return [...block.querySelectorAll(':scope > .ap-export-dossier-section')]
            .map((child) => (child instanceof HTMLElement ? child.dataset.sectionTitle || '' : ''));
    }
    return [block.dataset.sectionTitle || ''];
}

/**
 * @param {unknown} value
 */
function summarizePursuitThesis(value) {
    if (typeof value === 'string') {
        return value.trim() || 'No pursuit thesis captured yet.';
    }
    if (!isPlainObject(value)) return 'No pursuit thesis captured yet.';

    // Post-Task-2: prefer the merged `thesis` field but stitch the
    // legacy `core` + `cost_of_standing_still` together when needed so
    // older plans still produce a non-empty summary block.
    const thesisText = String(value.thesis ?? '').trim()
        || [value.core, value.cost_of_standing_still]
            .map((v) => String(v ?? '').trim())
            .filter(Boolean)
            .join('\n\n');
    const parts = [
        thesisText ? `${TACTICAL_UX_LABELS.pursuitThesis}: ${thesisText}` : '',
        value.why_account_matters ? `Why This Account Matters: ${String(value.why_account_matters).trim()}` : '',
        value.timing ? `Strategic Timing: ${String(value.timing).trim()}` : '',
        value.executive_narrative ? `Executive Narrative: ${String(value.executive_narrative).trim()}` : '',
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
    const moatPills = Array.isArray(value.moat_pills) ? value.moat_pills.join(', ') : '';
    const parts = [
        value.incumbents ? String(value.incumbents).trim() : '',
        pills ? `Positioning: ${pills}` : '',
        value.narrative ? String(value.narrative).trim() : '',
        moatPills ? `Moat: ${moatPills}` : '',
        value.compound_relationships ? String(value.compound_relationships).trim() : '',
        value.difficult_to_remove ? String(value.difficult_to_remove).trim() : '',
    ].filter(Boolean);

    return parts.join('\n\n');
}

/**
 * @param {number} score
 * @returns {HTMLElement}
 */
function buildMomentumMetricPanel(score) {
    const panel = document.createElement('div');
    panel.className = 'ap-export-panel ap-export-panel--metric ap-export-panel--momentum-metric';

    const scoreBlock = document.createElement('div');
    scoreBlock.className = 'ap-export-momentum-score-block';
    scoreBlock.innerHTML = `
        <span class="ap-export-momentum-score">${score}</span>
        <span class="ap-export-momentum-label">${escapeHtml(MOMENTUM_LABELS[score - 1])}</span>`;
    panel.appendChild(scoreBlock);

    const scale = document.createElement('div');
    scale.className = 'ap-export-momentum-scale';

    const track = document.createElement('div');
    track.className = 'ap-export-momentum-scale-track';
    track.innerHTML = '<div class="ap-export-momentum-scale-line" aria-hidden="true"></div>';

    const dots = document.createElement('div');
    dots.className = 'ap-export-momentum-scale-dots';
    for (let step = 1; step <= 5; step += 1) {
        const dot = document.createElement('span');
        dot.className = step === score
            ? 'ap-export-momentum-scale-dot is-active'
            : 'ap-export-momentum-scale-dot';
        dot.setAttribute('aria-hidden', 'true');
        dots.appendChild(dot);
    }
    track.appendChild(dots);
    scale.appendChild(track);

    const endpoints = document.createElement('div');
    endpoints.className = 'ap-export-momentum-scale-endpoints';
    endpoints.innerHTML = `
        <span>${escapeHtml(MOMENTUM_LABELS[0])}</span>
        <span>${escapeHtml(MOMENTUM_LABELS[4])}</span>`;
    scale.appendChild(endpoints);

    panel.appendChild(scale);
    return panel;
}

/**
 * @param {import('./account-plan-sections.js').PsychologySliderDef} slider
 * @param {number} value
 */
function buildPsychologyBar(slider, value) {
    const row = document.createElement('div');
    row.className = 'ap-export-psych-row';
    // Map a 1-5 score to a 0-100% fill. Anchor 1 just inside the left edge
    // (8%) so the fill is always visible — a true 0%-width div reads as
    // "missing data" in print rather than "low score."
    const pct = 8 + ((value - 1) / 4) * 92;
    row.innerHTML = `
        <div class="ap-export-psych-row-header">
            <span class="ap-export-psych-row-label">${escapeHtml(slider.label)}</span>
            <span class="ap-export-psych-row-value">${value}<span class="ap-export-psych-row-value-divider">/</span><span class="ap-export-psych-row-value-max">5</span></span>
        </div>
        <div class="ap-export-psych-row-scale">
            <span class="ap-export-psych-row-scale-low">${escapeHtml(slider.lowLabel)}</span>
            <span class="ap-export-psych-row-scale-high">${escapeHtml(slider.highLabel)}</span>
        </div>
        <div class="ap-export-psych-track">
            <div class="ap-export-psych-fill" style="width:${pct}%"></div>
        </div>`;
    return row;
}

/**
 * User-logged strategic signals only for client-facing export.
 * Per docs/saos/DECISIONS.md #1 (signals-only timeline): CRM activities may appear
 * in the canvas timeline but are never included in dossier PDF or exec deck output.
 * @param {Record<string, unknown>} sections
 * @returns {{ id: string, date: string, text: string, dateMs: number }[]}
 */
function getExportMomentumNotes(sections) {
    /** @type {Map<string, { id: string, date: string, text: string, dateMs: number }>} */
    const byId = new Map();

    const addNote = (note) => {
        if (!note.text) return;
        const existing = byId.get(note.id);
        if (!existing || note.dateMs >= existing.dateMs) {
            byId.set(note.id, note);
        }
    };

    const rawNotes = Array.isArray(sections.momentum_notes) ? sections.momentum_notes : [];
    rawNotes
        .filter((note) => {
            if (!isPlainObject(note)) return false;
            const source = note.source != null ? String(note.source).toLowerCase() : '';
            const type = note.type != null ? String(note.type).toLowerCase() : '';
            if (source === 'activity' || source === 'crm' || type === 'activity') return false;
            return String(note.text ?? '').trim().length > 0;
        })
        .forEach((note) => {
            const dateStr = String(note.date ?? '');
            const dateMs = new Date(dateStr).getTime();
            addNote({
                id: note.id != null ? String(note.id) : crypto.randomUUID(),
                date: dateStr,
                text: String(note.text ?? '').trim(),
                dateMs: Number.isNaN(dateMs) ? 0 : dateMs,
            });
        });

    const interactionLog = Array.isArray(sections.interaction_log) ? sections.interaction_log : [];
    interactionLog
        .filter((entry) => {
            if (!isPlainObject(entry)) return false;
            const source = entry.source != null ? String(entry.source).toLowerCase() : '';
            if (source === 'activity' || source === 'crm') return false;
            const text = String(entry.text ?? entry.interaction ?? entry.key_insight ?? '').trim();
            return text.length > 0;
        })
        .forEach((entry) => {
            const dateStr = String(entry.date ?? '');
            const dateMs = new Date(dateStr).getTime();
            addNote({
                id: entry.id != null ? String(entry.id) : crypto.randomUUID(),
                date: dateStr,
                text: String(entry.text ?? entry.interaction ?? entry.key_insight ?? '').trim(),
                dateMs: Number.isNaN(dateMs) ? 0 : dateMs,
            });
        });

    return [...byId.values()].sort((a, b) => b.dateMs - a.dateMs);
}

/**
 * @param {Record<string, unknown>} sections
 * @returns {HTMLElement}
 */
function buildDossierMomentumTimelineBody(sections) {
    const notes = getExportMomentumNotes(sections);
    const wrap = document.createElement('div');
    wrap.className = 'ap-export-momentum-timeline';

    if (notes.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'ap-export-editorial-copy ap-export-momentum-timeline-empty';
        empty.textContent = 'No strategic signals logged.';
        wrap.appendChild(empty);
        return wrap;
    }

    const tree = document.createElement('div');
    tree.className = 'ap-export-momentum-timeline-tree';

    const trunk = document.createElement('div');
    trunk.className = 'ap-export-momentum-timeline-trunk';
    trunk.setAttribute('aria-hidden', 'true');

    const items = document.createElement('div');
    items.className = 'ap-export-momentum-timeline-items';

    notes.forEach((note) => {
        const entry = document.createElement('article');
        entry.className = 'ap-export-momentum-timeline-item timeline-item-signal';

        const node = document.createElement('div');
        node.className = 'ap-export-momentum-timeline-node';
        node.setAttribute('aria-hidden', 'true');

        const card = document.createElement('div');
        card.className = 'ap-export-momentum-timeline-card';

        const dateEl = document.createElement('time');
        dateEl.className = 'ap-export-momentum-timeline-date';
        dateEl.dateTime = note.date;
        dateEl.textContent = formatMomentumNoteDate(note.date);

        const textEl = document.createElement('p');
        textEl.className = 'ap-export-momentum-timeline-text';
        textEl.textContent = note.text;

        card.appendChild(dateEl);
        card.appendChild(textEl);
        entry.appendChild(node);
        entry.appendChild(card);
        items.appendChild(entry);
    });

    tree.appendChild(trunk);
    tree.appendChild(items);
    wrap.appendChild(tree);
    return wrap;
}

/**
 * @param {string} dateStr
 */
function formatMomentumNoteDate(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr || '—';
    return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

/**
 * @param {string} dateStr
 */
function formatMomentumNoteDateShort(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr || '—';
    return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
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
            right: 50%;
            top: 50%;
            transform: translateY(-50%);
        }
        .ap-export-gpc-cover-title-frame {
            border: 2px solid ${GPC_BRAND.white};
            padding: 18px 22px;
            margin-bottom: 18px;
            max-width: 520px;
            box-sizing: border-box;
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
        /* --- Unified running header (identical on every interior page) --- */
        .ap-export-gpc-page-header {
            position: absolute;
            left: 48px;
            right: 48px;
            top: 38px;
        }
        .ap-export-gpc-header-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            min-height: 28px;
        }
        .ap-export-gpc-logo--content {
            display: block;
            width: 96px;
            height: auto;
            flex-shrink: 0;
            transform: translateY(-7px);
        }
        .ap-export-gpc-running {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-right: 0;
            flex: 1 1 auto;
            min-width: 0;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 10.5px;
            line-height: 1.2;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #0f172a;
            min-height: 24px;
        }
        .ap-export-gpc-running-account {
            color: #0f172a;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 38%;
        }
        .ap-export-gpc-running-doc {
            color: ${GPC_BRAND.teal};
            white-space: nowrap;
        }
        .ap-export-gpc-running-section {
            color: #475569;
            font-weight: 600;
            letter-spacing: 0.12em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1 1 auto;
            min-width: 0;
        }
        .ap-export-gpc-running-sep {
            display: inline-block;
            width: 1px;
            height: 12px;
            background: #cbd5e1;
            flex-shrink: 0;
        }
        .ap-export-gpc-page-rule {
            margin-top: 12px;
            height: 2px;
            background: linear-gradient(
                to right,
                ${GPC_BRAND.navyDeep} 0%,
                ${GPC_BRAND.navyDeep} 28%,
                ${GPC_BRAND.teal} 28%,
                ${GPC_BRAND.teal} 60%,
                ${GPC_BRAND.lime} 60%,
                ${GPC_BRAND.lime} 100%
            );
        }
        .ap-export-dossier-content {
            position: absolute;
            left: 48px;
            right: 48px;
            top: 94px;
            bottom: 58px;
            overflow: hidden;
            /*
             * Do NOT add "contain: paint" here. It establishes an overflow
             * clip edge that causes Chrome's scrollHeight to return the
             * clipped (= clientHeight) value for modestly oversized
             * content, which defeats the paginator (every pageFits() reads
             * scrollHeight === clientHeight and concludes "doesn't fit",
             * forcing each section onto its own page). Plain
             * "overflow: hidden" is enough to visually clip during snapdom
             * capture while keeping scrollHeight accurate.
             */
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
        .ap-export-dossier-section {
            margin-bottom: 0;
        }
        .ap-export-dossier-section + .ap-export-dossier-section {
            margin-top: 14px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
        }
        .ap-export-dossier-section-title {
            margin: 0 0 14px;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 11px;
            line-height: 1.25;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            font-weight: 700;
        }
        .ap-export-dossier-section + .ap-export-dossier-section .ap-export-dossier-section-title {
            margin-top: 2px;
        }
        .ap-export-section-icon {
            color: #3b82f6;
            margin-right: 8px;
            font-size: 1.1em;
            opacity: 0.9;
        }
        .ap-export-section-title-qualifier {
            color: #64748b;
            font-weight: 600;
        }
        .ap-export-client-commitments-body {
            border-top: 2px solid #0f172a;
            padding-top: 18px;
        }
        .ap-export-dossier-content > .ap-export-dossier-section:first-child .ap-export-dossier-section-title {
            margin-top: 10px;
        }
        .ap-export-dossier-body--editorial {
            color: #1e293b;
            font-family: ${GPC_BRAND.fontBody};
        }
        .ap-export-dossier-body--editorial .ap-export-editorial-copy,
        .ap-export-dossier-body--editorial .ap-export-editorial-list {
            font-size: 12px;
            line-height: 1.55;
            color: #1e293b;
        }
        .ap-export-editorial-kicker,
        .ap-export-dossier-body--editorial h3.ap-export-editorial-kicker {
            margin: 0 0 6px;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 10px;
            line-height: 1.3;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            font-weight: 700;
        }
        .ap-export-editorial-copy {
            margin: 0 0 10px;
            white-space: pre-wrap;
        }
        .ap-export-editorial-copy:last-child {
            margin-bottom: 0;
        }
        .ap-export-momentum-timeline {
            display: flex;
            flex-direction: column;
            gap: 0;
        }
        .ap-export-momentum-timeline-empty {
            margin: 0;
            color: #64748b;
        }
        .ap-export-momentum-timeline-tree {
            position: relative;
            padding: 4px 0 4px 28px;
        }
        .ap-export-momentum-timeline-trunk {
            position: absolute;
            left: 11px;
            top: 10px;
            bottom: 10px;
            width: 2px;
            background: #e2e8f0;
        }
        .ap-export-momentum-timeline-items {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .ap-export-momentum-timeline-item {
            position: relative;
        }
        .ap-export-momentum-timeline-node {
            position: absolute;
            left: -22px;
            top: 8px;
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background: #3b82f6;
            border: 2px solid #ffffff;
            box-shadow: 0 0 0 1px #cbd5e1;
            z-index: 1;
        }
        .ap-export-momentum-timeline-card {
            padding-left: 4px;
        }
        .ap-export-momentum-timeline-date {
            display: block;
            margin: 0 0 4px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: #64748b;
        }
        .ap-export-momentum-timeline-text {
            margin: 0;
            font-size: 12px;
            line-height: 1.5;
            color: #1e293b;
        }
        .ap-export-plan-horizon-body .plan-horizon-list,
        .ap-exec-plan-horizon-body .plan-horizon-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .ap-export-plan-horizon-body .plan-horizon-list li,
        .ap-exec-plan-horizon-body .plan-horizon-list li {
            position: relative;
            padding-left: 14px;
            font-size: 11px;
            line-height: 1.45;
            color: #1e293b;
        }
        .ap-export-plan-horizon-body .plan-horizon-list li::before,
        .ap-exec-plan-horizon-body .plan-horizon-list li::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0.55em;
            width: 5px;
            height: 5px;
            border-radius: 999px;
            background: #3b82f6;
        }
        .ap-exec-plan-horizon-body .plan-horizon-list li {
            color: #334155;
        }
        .ap-export-plan-horizon-body .plan-horizon-meta,
        .ap-exec-plan-horizon-body .plan-horizon-meta {
            display: inline-block;
            white-space: nowrap;
            color: #2563eb;
            font-weight: 700;
            font-size: 10.5px;
            margin-left: 0.35em;
        }
        .ap-export-plan-horizon-body .plan-horizon-empty,
        .ap-exec-plan-horizon-body .plan-horizon-empty {
            margin: 0;
            color: #64748b;
            font-size: 12px;
        }
        .ap-exec-plan-horizons {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            flex: 1;
            min-height: 0;
            overflow: hidden;
        }
        .ap-exec-plan-horizon-col {
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
        }
        .ap-exec-plan-horizon-title {
            margin: 0 0 8px;
            font-size: 10px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
            flex-shrink: 0;
        }
        .ap-exec-plan-horizon-body {
            flex: 1;
            min-height: 0;
            overflow: hidden;
        }
        .ap-exec-plan-horizon-body .plan-horizon-list {
            gap: 6px;
        }
        .ap-exec-plan-horizon-body .plan-horizon-list li {
            font-size: 10px;
            line-height: 1.4;
        }
        .ap-export-editorial-pills-line {
            margin: 0 0 12px;
            font-size: 12px;
            line-height: 1.55;
            color: #0f172a;
        }
        .ap-export-editorial-pills-line strong {
            font-weight: 700;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            font-size: 10px;
            color: #64748b;
        }
        .ap-export-editorial-pills-row {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
            margin: 0 0 8px;
        }
        .ap-export-editorial-pills-label {
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #64748b;
        }
        .ap-export-badge-row--editorial {
            width: 100%;
        }
        .ap-export-battlefield-body {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            border-top: 2px solid #0f172a;
            padding-top: 18px;
        }
        .ap-export-battlefield-panel {
            border: 1px solid #e2e8f0;
            border-top: 3px solid #0f172a;
            padding: 10px 12px 11px;
            background: #f8fafc;
        }
        .ap-export-battlefield-panel-title {
            margin: 0 0 8px;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #0f172a;
        }
        .ap-export-battlefield-panel .ap-export-editorial-kicker {
            margin-top: 8px;
        }
        .ap-export-battlefield-panel .ap-export-editorial-kicker:first-of-type {
            margin-top: 0;
        }
        .ap-export-editorial-prose {
            border-top: 2px solid #0f172a;
            padding-top: 18px;
        }
        .ap-export-editorial-prose .ap-export-editorial-kicker:not(:first-child) {
            margin-top: 14px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
        }
        .ap-export-pursuit-with-pain-body > .ap-export-editorial-prose--pursuit-pain {
            margin-top: 16px;
        }
        .ap-export-pursuit-with-pain-body {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .ap-export-pursuit-with-pain-body .ap-export-editorial-grid {
            padding-top: 18px;
        }
        .ap-export-blindspots-body {
            border-top: 2px solid #0f172a;
            padding-top: 18px;
        }
        .ap-export-blindspots-list {
            margin: 0;
            padding: 0;
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .ap-export-blindspots-item {
            position: relative;
            padding-left: 14px;
            font-size: 11.5px;
            line-height: 1.45;
            color: #1e293b;
        }
        .ap-export-blindspots-item::before {
            content: '▢';
            position: absolute;
            left: 0;
            top: 0.05em;
            color: #3b82f6;
            font-size: 10px;
            line-height: 1;
        }
        .ap-export-blindspots-empty {
            margin: 0;
            font-size: 12px;
            line-height: 1.45;
            color: #64748b;
            font-style: italic;
        }
        .ap-export-editorial-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0;
            border-top: 2px solid #0f172a;
            padding-top: 18px;
        }
        .ap-export-editorial-grid--2 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .ap-export-editorial-grid--3,
        .ap-export-editorial-grid--plan {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .ap-export-editorial-cell {
            padding: 0 18px 0 0;
        }
        .ap-export-editorial-grid > .ap-export-editorial-cell:not(:last-child) {
            border-right: 1px solid #e2e8f0;
            padding-right: 18px;
            margin-right: 0;
        }
        .ap-export-editorial-grid--3 > .ap-export-editorial-cell,
        .ap-export-editorial-grid--plan > .ap-export-editorial-cell {
            padding-left: 18px;
            padding-right: 18px;
        }
        /* Full-width rows inside editorial grids — padding shorthand on
         * grid cells was zeroing padding-top and collapsing kickers against
         * the divider (Strategic Timing, Executive Narrative). */
        .ap-export-editorial-grid > .ap-export-editorial-cell.ap-export-editorial-span-full {
            grid-column: 1 / -1;
            border-right: none !important;
            margin-right: 0 !important;
            margin-top: 16px;
            padding: 18px 0 0;
            border-top: 1px solid #e2e8f0;
        }
        .ap-export-editorial-influence-tier.ap-export-editorial-span-full {
            grid-column: 1 / -1;
            margin-top: 16px;
            padding: 18px 0 0;
            border-top: 1px solid #e2e8f0;
            padding-right: 0;
        }
        .ap-export-editorial-grid.ap-export-editorial-span-full {
            grid-column: 1 / -1;
            margin-top: 16px;
            padding-top: 18px;
            border-top: 1px solid #e2e8f0;
        }
        .ap-export-editorial-influence {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0;
            border-top: 2px solid #0f172a;
            padding-top: 18px;
        }
        .ap-export-editorial-influence-tier > .ap-export-editorial-kicker:first-child {
            margin-top: 0;
        }
        .ap-export-editorial-influence-tier {
            padding: 0 18px 0 0;
        }
        .ap-export-editorial-influence-tier:first-child {
            border-right: 1px solid #e2e8f0;
            padding-right: 18px;
            margin-right: 18px;
        }
        .ap-export-editorial-list {
            margin: 0 0 14px;
            padding: 0 0 0 1.1em;
        }
        .ap-export-editorial-list li {
            margin: 0 0 6px;
        }
        .ap-export-snapshot-body,
        .ap-export-snapshot-compact {
            display: flex;
            flex-direction: column;
            gap: 10px;
            border-top: 2px solid #0f172a;
            padding-top: 18px;
        }
        .ap-export-snapshot-hero {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 12px;
            background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
            border: 1px solid #e2e8f0;
            border-left: 4px solid #2563eb;
            border-radius: 6px;
        }
        .ap-export-snapshot-identity {
            min-width: 0;
            flex: 1;
        }
        .ap-export-snapshot-account-name {
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 18px;
            line-height: 1.2;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 6px;
        }
        .ap-export-snapshot-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .ap-export-snapshot-chip {
            display: inline-flex;
            align-items: center;
            white-space: nowrap;
            padding: 3px 9px;
            border-radius: 999px;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            color: #475569;
        }
        .ap-export-snapshot-chip--accent {
            background: #dbeafe;
            border-color: #93c5fd;
            color: #1d4ed8;
        }
        .ap-export-snapshot-chip--muted {
            text-transform: none;
            letter-spacing: 0.01em;
            font-weight: 600;
            font-size: 10px;
            color: #64748b;
            background: rgba(255,255,255,0.72);
        }
        .ap-export-snapshot-stat-grid {
            display: grid;
            gap: 6px;
        }
        .ap-export-snapshot-stat {
            padding: 6px 8px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-top: 2px solid #0f172a;
            min-width: 0;
        }
        .ap-export-snapshot-stat-label {
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 7.5px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 3px;
            line-height: 1.2;
        }
        .ap-export-snapshot-stat-value {
            font-size: 10.5px;
            line-height: 1.3;
            font-weight: 700;
            color: #0f172a;
        }
        .ap-export-snapshot-narratives {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        }
        .ap-export-snapshot-narrative {
            padding: 8px 10px;
            background: #fafbfc;
            border: 1px solid #e2e8f0;
            min-width: 0;
        }
        .ap-export-snapshot-narrative-label {
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 8.5px;
            font-weight: 700;
            letter-spacing: 0.07em;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 4px;
        }
        .ap-export-snapshot-narrative-copy {
            margin: 0;
            font-size: 10.5px;
            line-height: 1.4;
            color: #1e293b;
        }
        .ap-export-data-table-wrap + .ap-export-data-table-wrap {
            margin-top: 4px;
        }
        /* Legacy <table>-based renderer is no longer used for the Account
         * Snapshot key/value tables (snapdom rasterizes HTML table cells
         * with anti-aliased sub-pixel borders that look fuzzy). The matrix
         * variant below still uses a real <table> because the white-space
         * matrix is genuinely tabular (multi-column comparison grid). */
        .ap-export-data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            line-height: 1.5;
        }
        .ap-export-data-table th,
        .ap-export-data-table td {
            border: 1px solid #cbd5e1;
            padding: 9px 12px;
            vertical-align: top;
            text-align: left;
        }
        .ap-export-data-table th {
            width: 34%;
            background: #f1f5f9;
            color: #334155;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }
        .ap-export-data-table td {
            color: #0f172a;
            font-weight: 500;
            white-space: pre-wrap;
        }

        /* --- Snapdom-friendly key/value list (used by Account Snapshot) --- */
        .ap-export-kv-list-wrap + .ap-export-kv-list-wrap {
            margin-top: 18px;
        }
        .ap-export-kv-list {
            display: flex;
            flex-direction: column;
            border-top: 1px solid #cbd5e1;
            border-bottom: 1px solid #cbd5e1;
        }
        .ap-export-kv-row {
            display: flex;
            align-items: stretch;
            border-bottom: 1px solid #e2e8f0;
        }
        .ap-export-kv-row:last-child {
            border-bottom: none;
        }
        .ap-export-kv-label {
            flex: 0 0 34%;
            padding: 9px 14px;
            background: #f1f5f9;
            color: #334155;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            line-height: 1.4;
            border-right: 1px solid #cbd5e1;
        }
        .ap-export-kv-value {
            flex: 1 1 auto;
            padding: 9px 14px;
            color: #0f172a;
            font-family: ${GPC_BRAND.fontBody};
            font-size: 13px;
            font-weight: 500;
            line-height: 1.5;
            white-space: pre-wrap;
        }
        .ap-export-white-space-wrap {
            border-top: 2px solid #0f172a;
            padding-top: 18px;
            overflow: hidden;
        }
        .ap-export-account-expansion-body {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .ap-export-account-expansion-body > .ap-export-editorial-grid {
            padding-top: 0;
            border-top: none;
        }
        .ap-export-account-expansion-body > .ap-export-white-space-wrap {
            border-top: none;
            padding-top: 0;
        }

        /* --- Snapdom-friendly White Space matrix (CSS grid, not <table>) --- */
        .ap-export-ws-matrix {
            display: grid;
            width: 100%;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            overflow: hidden;
            font-family: ${GPC_BRAND.fontBody};
        }
        .ap-export-ws-matrix-cell {
            padding: 7px 8px;
            font-size: 10.5px;
            line-height: 1.4;
            color: #0f172a;
            border-right: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
            min-width: 0;
            white-space: pre-wrap;
            word-break: normal;
            overflow-wrap: break-word;
        }
        /* Strip the trailing borders on the last column / last row so the
         * outer .ap-export-ws-matrix border carries the edge cleanly
         * instead of doubling up. The classes are added explicitly in JS
         * so the column count can change without breaking nth-child math. */
        .ap-export-ws-matrix-cell--last-col {
            border-right: none;
        }
        .ap-export-ws-matrix-cell--last-row {
            border-bottom: none;
        }
        .ap-export-ws-matrix-cell--header {
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.04em;
            line-height: 1.25;
            text-transform: uppercase;
            color: #334155;
            background: #f1f5f9;
            border-bottom: 1px solid #cbd5e1;
            text-align: center;
            white-space: pre-line;
            overflow-wrap: normal;
            word-break: normal;
            hyphens: none;
        }
        .ap-export-ws-matrix-cell--body {
            background: #ffffff;
            font-weight: 500;
        }
        .ap-export-ws-matrix-cell--alt {
            background: #fafbfd;
        }
        .ap-export-ws-matrix-cell--name {
            font-weight: 700;
            color: #0f172a;
        }
        .ap-export-influence-contact-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .ap-export-influence-contact {
            border: 1px solid #e2e8f0;
            background: #fafbfc;
            padding: 8px 10px;
        }
        .ap-export-influence-contact-name {
            margin: 0 0 2px;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 12px;
            font-weight: 700;
            line-height: 1.25;
            color: #0f172a;
        }
        .ap-export-influence-contact-title {
            margin: 0 0 6px;
            font-size: 10.5px;
            line-height: 1.35;
            color: #475569;
        }
        .ap-export-influence-contact .ap-export-profile-field {
            margin-bottom: 6px;
            padding-left: 8px;
        }
        .ap-export-influence-contact .ap-export-profile-field:last-child {
            margin-bottom: 0;
        }
        .ap-export-editorial-influence--v2 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .ap-export-psych-export-wrap {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .ap-export-psych-gravity-heading {
            margin-top: 2px;
        }
        .ap-export-psych-gravity-grid {
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
        }
        /* Asymmetric 2-col gravity layout: narrow left rail (3 dial fields
         * stacked) + wider right rail (consensus + narrative prose). */
        .ap-export-psych-gravity-grid--split {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
            column-gap: 22px;
        }
        .ap-export-psych-gravity-rail {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .ap-export-psych-gravity-rail--left {
            border-right: 1px solid #e2e8f0;
            padding-right: 14px;
        }
        .ap-export-psych-gravity-rail--right {
            padding-left: 4px;
        }
        .ap-export-psych-gravity-rail > .ap-export-editorial-cell {
            padding: 0;
            border-right: none;
            margin-right: 0;
        }
        /* --- Strategic Entry Points: up to 3 target profiles per dossier page --- */
        .ap-export-target-profiles-body {
            display: flex;
            flex-direction: column;
            gap: 10px;
            border-top: 2px solid #0f172a;
            padding-top: 18px;
        }
        .ap-export-target-profile {
            page-break-inside: avoid;
            break-inside: avoid;
            border: 1px solid #e2e8f0;
            background: #fafbfc;
            padding: 9px 12px 10px;
            border-radius: 4px;
        }
        .ap-export-target-profile + .ap-export-target-profile {
            margin-top: 0;
        }
        .ap-export-target-profile-header {
            margin-bottom: 9px;
            padding-bottom: 7px;
            border-bottom: 1px solid #e2e8f0;
        }
        .ap-export-target-profile-name {
            margin: 0 0 5px;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 13.5px;
            line-height: 1.2;
            font-weight: 700;
            letter-spacing: 0.01em;
            color: #0f172a;
            text-transform: none;
        }
        .ap-export-badge-row {
            display: flex;
            flex-wrap: wrap;
            gap: 5px 6px;
            align-items: flex-start;
        }
        .ap-export-badge-row--stacked {
            flex-direction: column;
            align-items: flex-start;
        }
        .ap-export-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.28em;
            white-space: nowrap;
            flex-shrink: 0;
            max-width: 100%;
            box-sizing: border-box;
            font-size: 8.5px;
            text-transform: uppercase;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 3px 7px;
            border-radius: 999px;
            margin-right: 0;
            color: #475569;
            font-weight: 600;
            letter-spacing: 0.03em;
            line-height: 1.35;
        }
        .ap-export-badge--editorial {
            text-transform: none;
            letter-spacing: 0.01em;
            font-size: 9px;
            font-weight: 600;
            color: #334155;
        }
        .ap-export-badge-label {
            color: #64748b;
            font-weight: 700;
        }
        .ap-export-badge-value {
            color: #0f172a;
            font-weight: 700;
        }
        .ap-export-target-profile-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0 14px;
        }
        .ap-export-target-profile-column {
            min-width: 0;
        }
        .ap-export-target-profile-column:first-child {
            border-right: 1px solid #e2e8f0;
            padding-right: 14px;
        }
        .ap-export-target-profile-group-title {
            margin: 0 0 7px;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 9.5px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #0f172a;
        }
        .ap-export-target-profile .ap-export-profile-field {
            margin-bottom: 7px;
            padding-left: 8px;
            border-left: 2px solid #3b82f6;
        }
        .ap-export-target-profile .ap-export-profile-field:last-child {
            margin-bottom: 0;
        }
        .ap-export-target-profile .ap-export-profile-kicker {
            font-size: 8.5px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 2px;
            letter-spacing: 0.04em;
            line-height: 1.2;
        }
        .ap-export-target-profile .ap-export-profile-copy {
            margin: 0;
            font-size: 10.5px;
            line-height: 1.45;
            color: #1e293b;
            white-space: pre-wrap;
        }
        /* Two on one page — trim gap only; keep readable type */
        .ap-export-target-profiles-body--per-page-2 {
            gap: 10px;
        }
        /* Three on one page — light density pass (pagination falls back if too tall) */
        .ap-export-target-profiles-body--per-page-3 {
            gap: 8px;
            padding-top: 10px;
        }
        .ap-export-target-profiles-body--per-page-3 .ap-export-target-profile {
            padding: 9px 12px 10px;
        }
        .ap-export-target-profiles-body--per-page-3 .ap-export-target-profile-header {
            margin-bottom: 7px;
            padding-bottom: 6px;
        }
        .ap-export-target-profiles-body--per-page-3 .ap-export-target-profile-name {
            font-size: 12.5px;
            line-height: 1.2;
        }
        .ap-export-target-profiles-body--per-page-3 .ap-export-badge {
            font-size: 8px;
        }
        .ap-export-target-profiles-body--per-page-3 .ap-export-target-profile-group-title {
            margin: 0 0 5px;
            font-size: 9px;
        }
        .ap-export-target-profiles-body--per-page-3 .ap-export-profile-field {
            margin-bottom: 5px;
        }
        .ap-export-target-profiles-body--per-page-3 .ap-export-profile-kicker {
            font-size: 8px;
        }
        .ap-export-target-profiles-body--per-page-3 .ap-export-profile-copy {
            font-size: 10px;
            line-height: 1.4;
        }
        .ap-export-profile-field {
            margin-bottom: 12px;
            padding-left: 10px;
            border-left: 2px solid #3b82f6;
        }
        .ap-export-profile-field:last-child {
            margin-bottom: 0;
        }
        .ap-export-profile-kicker {
            font-size: 10px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 4px;
            letter-spacing: 0.04em;
        }
        .ap-export-profile-copy {
            margin: 0;
            font-size: 12px;
            line-height: 1.6;
            color: #1e293b;
            white-space: pre-wrap;
        }

        /* --- Section group (orphan control wrapper) --- */
        .ap-export-section-group {
            page-break-inside: avoid;
            break-inside: avoid;
            display: flex;
            flex-direction: column;
        }
        .ap-export-section-group > .ap-export-dossier-section + .ap-export-dossier-section {
            margin-top: 18px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
        }

        /* --- Account Psychology (McKinsey/Gartner horizontal bars) --- */
        .ap-export-psych-grid { display: flex; flex-direction: column; gap: 14px; }
        .ap-export-psych-grid--dossier {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px 14px;
        }
        .ap-export-psych-row {
            padding: 10px 12px 8px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .ap-export-psych-row-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 8px;
            margin: 0;
        }
        .ap-export-psych-row-label {
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.02em;
            color: #0f172a;
            text-transform: none;
        }
        .ap-export-psych-row-value {
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 12px;
            font-weight: 700;
            color: ${GPC_BRAND.teal};
            letter-spacing: 0.02em;
            white-space: nowrap;
        }
        .ap-export-psych-row-value-divider,
        .ap-export-psych-row-value-max {
            color: #94a3b8;
            font-weight: 600;
        }
        .ap-export-psych-row-value-divider {
            margin: 0 2px;
        }
        .ap-export-psych-row-scale {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 8.5px;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #64748b;
            margin-top: 2px;
        }
        .ap-export-psych-row-scale-low,
        .ap-export-psych-row-scale-high {
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 48%;
        }
        .ap-export-psych-row-scale-high {
            text-align: right;
        }
        .ap-export-psych-track {
            height: 5px;
            background: #e2e8f0;
            border-radius: 0;
            overflow: hidden;
            margin-top: 4px;
        }
        .ap-export-psych-fill {
            height: 100%;
            background: ${GPC_BRAND.teal};
            border-radius: 0;
        }
        .ap-export-dossier-body--metric .ap-export-panel--momentum-metric {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 16px 14px 14px;
        }
        .ap-export-momentum-score-block {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            margin-bottom: 14px;
        }
        .ap-export-dossier-body--metric .ap-export-momentum-score {
            width: 42px;
            height: 42px;
            border-radius: 999px;
            background: ${GPC_BRAND.teal};
            color: #fff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 18px;
            line-height: 1;
        }
        .ap-export-dossier-body--metric .ap-export-momentum-label {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: ${GPC_BRAND.navyDeep};
        }
        .ap-export-momentum-scale {
            width: 100%;
            max-width: 188px;
        }
        .ap-export-momentum-scale-track {
            position: relative;
            display: flex;
            align-items: center;
            height: 14px;
            padding: 4px 0;
        }
        .ap-export-momentum-scale-line {
            position: absolute;
            left: 0;
            right: 0;
            top: 50%;
            height: 2px;
            background: #e2e8f0;
            transform: translateY(-50%);
            z-index: 0;
        }
        .ap-export-momentum-scale-dots {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
        }
        .ap-export-momentum-scale-dot {
            flex: 0 0 auto;
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #ffffff;
            border: 2px solid #cbd5e1;
            box-sizing: border-box;
        }
        .ap-export-momentum-scale-dot.is-active {
            width: 12px;
            height: 12px;
            background: ${GPC_BRAND.teal};
            border-color: ${GPC_BRAND.teal};
        }
        .ap-export-momentum-scale-endpoints {
            display: flex;
            justify-content: space-between;
            margin-top: 6px;
            font-size: 9px;
            line-height: 1.2;
            color: #64748b;
            letter-spacing: 0.02em;
        }
        .ap-export-dossier-body--metric .ap-export-panel-stack {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .ap-export-dossier-body--metric .ap-export-panel-stack--momentum {
            display: grid;
            grid-template-columns: minmax(0, 240px) minmax(0, 1fr);
            gap: 10px;
            align-items: stretch;
        }
        .ap-export-dossier-body--metric .ap-export-panel {
            border: 1px solid color-mix(in srgb, ${GPC_BRAND.gray} 90%, transparent);
            border-radius: 8px;
            overflow: hidden;
            background: #ffffff;
            min-height: 100%;
            display: flex;
            flex-direction: column;
        }
        .ap-export-dossier-body--metric .ap-export-panel--accent {
            border-color: color-mix(in srgb, ${GPC_BRAND.teal} 45%, ${GPC_BRAND.gray});
            background: color-mix(in srgb, ${GPC_BRAND.teal} 6%, #ffffff);
        }
        .ap-export-dossier-body--metric .ap-export-panel--metric {
            padding: 12px 14px;
            background: color-mix(in srgb, ${GPC_BRAND.navyDeep} 4%, #ffffff);
        }
        .ap-export-dossier-body--metric .ap-export-panel-header {
            padding: 7px 12px;
            border-bottom: 1px solid color-mix(in srgb, ${GPC_BRAND.gray} 80%, transparent);
            background: color-mix(in srgb, ${GPC_BRAND.navyDeep} 4%, #ffffff);
        }
        .ap-export-dossier-body--metric .ap-export-panel-header h3 {
            margin: 0;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 10px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: ${GPC_BRAND.teal};
            font-weight: 700;
        }
        .ap-export-dossier-body--metric .ap-export-panel-body {
            padding: 10px 12px;
            flex: 1;
        }
        .ap-export-dossier-body--metric .ap-export-panel-body p {
            margin: 0;
            font-size: 12px;
            line-height: 1.52;
            color: ${GPC_BRAND.textDark};
            white-space: pre-wrap;
        }

        /* --- Exec presentation deck (16:9 × 3 slides) --- */
        .ap-line-clamp-2,
        .ap-line-clamp-3,
        .ap-line-clamp-4,
        .ap-line-clamp-6,
        .ap-line-clamp-10,
        .ap-line-clamp-12 {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .ap-line-clamp-2 { -webkit-line-clamp: 2; }
        .ap-line-clamp-3 { -webkit-line-clamp: 3; }
        .ap-line-clamp-4 { -webkit-line-clamp: 4; }
        .ap-line-clamp-6 { -webkit-line-clamp: 6; }
        .ap-line-clamp-10 { -webkit-line-clamp: 10; }
        .ap-line-clamp-12 { -webkit-line-clamp: 12; }

        .ap-exec-slide {
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            width: 1056px;
            height: 594px;
            background: #f8fafc;
            padding: 36px 40px 44px;
            color: #0f172a;
            font-family: ${GPC_BRAND.fontBody};
        }
        .ap-exec-slide-logo {
            position: absolute;
            top: 28px;
            right: 36px;
            width: 118px;
            height: auto;
            z-index: 3;
        }
        .ap-exec-slide-header {
            flex-shrink: 0;
            margin-bottom: 14px;
            padding-right: 132px;
        }
        .ap-exec-slide-kicker {
            margin: 0 0 6px;
            font-size: 11px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #2563eb;
            font-family: ${GPC_BRAND.fontHeading};
            font-weight: 700;
        }
        .ap-exec-slide-title {
            margin: 0 0 4px;
            font-size: 28px;
            line-height: 1.12;
            font-weight: 700;
            font-family: ${GPC_BRAND.fontHeading};
            color: #0f172a;
        }
        .ap-exec-slide-title-sub {
            font-weight: 600;
            color: #2563eb;
        }
        .ap-exec-slide-date {
            margin: 0;
            font-size: 12px;
            color: #64748b;
        }
        .ap-exec-slide-body {
            flex: 1 1 auto;
            min-height: 420px;
            overflow: hidden;
        }
        .ap-exec-slide-footer {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 40px;
            background: #ffffff;
            border-top: 1px solid #e2e8f0;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 11px;
            color: #64748b;
        }
        .ap-exec-grid {
            display: grid;
            gap: 14px;
            height: 100%;
            min-height: 420px;
            overflow: hidden;
            align-items: stretch;
        }
        .ap-exec-grid--situation {
            grid-template-columns: 1.35fr 0.65fr;
        }
        .ap-exec-grid--battlefield {
            grid-template-columns: 1.1fr 0.85fr 1.05fr;
        }
        .ap-exec-grid--execution {
            grid-template-columns: 1fr 1fr;
        }
        .ap-exec-stack {
            display: flex;
            flex-direction: column;
            gap: 12px;
            min-height: 0;
            height: 100%;
            overflow: hidden;
        }
        .ap-exec-panel {
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            min-height: 0;
            height: 100%;
            overflow: hidden;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px 16px;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .ap-exec-stack .ap-exec-panel--momentum {
            flex: 0 0 34%;
            height: auto;
        }
        .ap-exec-stack .ap-exec-panel--psych {
            flex: 1;
        }
        .ap-exec-panel-heading {
            margin: 0 0 10px;
            font-size: 13px;
            line-height: 1.2;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: #475569;
            font-family: ${GPC_BRAND.fontHeading};
            font-weight: 700;
            flex-shrink: 0;
            display: flex;
            align-items: center;
        }
        .ap-exec-panel-icon {
            color: #2563eb;
            margin-right: 8px;
            font-size: 13px;
            flex-shrink: 0;
        }
        .ap-exec-prose-stack {
            display: flex;
            flex-direction: column;
            gap: 10px;
            flex: 1 1 auto;
            min-height: 0;
            overflow: auto;
        }
        .ap-exec-prose-block {
            flex-shrink: 0;
        }
        .ap-exec-prose-kicker {
            margin: 0 0 4px;
            font-size: 10px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
            font-family: ${GPC_BRAND.fontHeading};
        }
        .ap-exec-prose-copy {
            margin: 0;
            font-size: 12px;
            line-height: 1.55;
            color: #334155;
            white-space: pre-line;
        }
        .ap-exec-panel-copy {
            margin: 0;
            font-size: 12px;
            line-height: 1.55;
            color: #334155;
            white-space: pre-line;
            flex: 1 1 auto;
            min-height: 0;
            overflow: auto;
        }
        .ap-exec-kpi {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 0;
            text-align: center;
        }
        .ap-exec-kpi-score {
            font-size: 52px;
            font-weight: 800;
            line-height: 1;
            color: #2563eb;
        }
        .ap-exec-kpi-label {
            margin-top: 6px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #64748b;
        }
        .ap-exec-psych-stack {
            display: flex;
            flex-direction: column;
            gap: 7px;
            flex: 1;
            min-height: 0;
            overflow: hidden;
        }
        .ap-exec-psych-row {
            flex-shrink: 0;
        }
        .ap-exec-psych-row-head {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 4px;
            font-size: 10px;
            color: #64748b;
            font-weight: 600;
        }
        .ap-exec-psych-track {
            height: 5px;
            border-radius: 999px;
            background: #e2e8f0;
            overflow: hidden;
        }
        .ap-exec-psych-fill {
            height: 100%;
            border-radius: 999px;
            background: linear-gradient(90deg, #2563eb 0%, #38bdf8 100%);
        }
        .ap-exec-influence-buckets {
            display: flex;
            flex-direction: column;
            gap: 10px;
            flex: 1;
            min-height: 0;
            overflow: hidden;
        }
        .ap-exec-influence-bucket {
            flex: 1;
            min-height: 0;
            overflow: hidden;
        }
        .ap-exec-influence-bucket-title {
            margin: 0 0 6px;
            font-size: 10px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
        }
        .ap-exec-influence-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .ap-exec-influence-item {
            font-size: 12px;
            line-height: 1.45;
            color: #334155;
        }
        .ap-exec-influence-item--empty {
            color: #64748b;
        }
        .ap-exec-entry-profiles {
            flex: 1;
            min-height: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .ap-exec-slide .ap-export-target-profile {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 12px;
            flex-shrink: 0;
        }
        .ap-exec-slide .ap-export-target-profile-name {
            font-size: 13px;
            color: #0f172a;
        }
        .ap-exec-slide .ap-export-badge {
            background: #eff6ff;
            color: #1e40af;
            border: 1px solid #bfdbfe;
            font-size: 9px;
        }
        .ap-exec-slide .ap-export-target-profile-group-title {
            color: #64748b;
            font-size: 9px;
        }
        .ap-exec-slide .ap-export-profile-kicker {
            color: #64748b;
            font-size: 9px;
        }
        .ap-exec-slide .ap-export-profile-copy {
            color: #334155;
            font-size: 11px;
            line-height: 1.45;
        }
        .ap-exec-slide .ap-export-target-profile-grid {
            gap: 8px;
        }
        .ap-exec-plan-list,
        .ap-exec-signals-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
            flex: 1;
            min-height: 0;
            overflow: hidden;
        }
        .ap-exec-plan-item {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            font-size: 12px;
            line-height: 1.45;
            color: #cbd5e1;
            min-height: 0;
        }
        .ap-exec-plan-item strong {
            flex-shrink: 0;
            color: #3b82f6;
            font-size: 11px;
            letter-spacing: 0.04em;
        }
        .ap-exec-plan-item span {
            flex: 1;
            min-width: 0;
        }
        .ap-exec-signals-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-height: 0;
        }
        .ap-exec-signals-item--empty {
            color: #64748b;
            font-size: 12px;
        }
        .ap-exec-signals-date {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: #64748b;
        }
        .ap-exec-signals-item span {
            font-size: 12px;
            line-height: 1.45;
            color: #334155;
            min-width: 0;
        }

        /* --- Highlight-reel deck (AI-synthesized headlines) --- */
        .ap-exec-slide--highlight {
            padding: 28px 40px 44px;
        }
        .ap-exec-slide--highlight .ap-exec-slide-header {
            margin-bottom: 12px;
        }
        .ap-exec-slide--highlight .ap-exec-slide-title {
            font-size: 22px;
            line-height: 1.15;
            margin-bottom: 0;
        }
        .ap-exec-slide--highlight .ap-exec-slide-date {
            display: none;
        }
        .ap-exec-slide-hook {
            margin: 6px 0 0;
            font-size: 19px;
            line-height: 1.28;
            font-weight: 700;
            color: #0f172a;
            font-family: ${GPC_BRAND.fontHeading};
            max-width: 92%;
        }
        .ap-exec-slide--highlight .ap-exec-slide-body {
            min-height: 448px;
        }
        .ap-exec-slide--highlight .ap-exec-grid {
            min-height: 448px;
            gap: 12px;
        }
        .ap-exec-slide--highlight .ap-exec-panel {
            padding: 12px 14px;
        }
        .ap-exec-panel-heading--highlight {
            font-size: 12px;
            line-height: 1.35;
            letter-spacing: 0.04em;
            text-transform: none;
            color: #0f172a;
            margin-bottom: 10px;
        }
        .ap-exec-slide--highlight .ap-exec-panel-icon {
            font-size: 12px;
            margin-right: 6px;
        }
        .ap-exec-highlight-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
            min-height: 0;
            overflow: hidden;
            flex: 1;
        }
        .ap-exec-highlight-list li {
            position: relative;
            padding-left: 14px;
            font-size: 12.5px;
            line-height: 1.44;
            color: #334155;
        }
        .ap-exec-highlight-list li::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0.58em;
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: #2563eb;
        }
        .ap-exec-slide--highlight .ap-exec-grid--situation {
            grid-template-columns: 1.22fr 0.78fr;
        }
        .ap-exec-slide--highlight .ap-exec-panel--strategy .ap-exec-highlight-list {
            justify-content: center;
            gap: 11px;
        }
        .ap-exec-slide--highlight .ap-exec-panel--strategy .ap-exec-highlight-list li {
            font-size: 13px;
            line-height: 1.46;
        }
        .ap-exec-slide--highlight .ap-exec-stack .ap-exec-panel--momentum {
            flex: 0 0 auto;
            height: auto;
        }
        .ap-exec-slide--highlight .ap-exec-kpi {
            align-items: stretch;
            justify-content: flex-start;
            gap: 0;
        }
        .ap-exec-slide--highlight .ap-exec-kpi-score {
            font-size: 34px;
            align-self: center;
        }
        .ap-exec-slide--highlight .ap-exec-kpi-label {
            margin-top: 4px;
            font-size: 10px;
            align-self: center;
        }
        .ap-exec-kpi-insight {
            margin: 10px 0 0;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            line-height: 1.45;
            color: #475569;
            text-align: left;
        }
        .ap-exec-psych-callouts {
            display: flex;
            flex-direction: column;
            gap: 9px;
            flex: 1;
            min-height: 0;
            overflow: hidden;
            justify-content: space-evenly;
        }
        .ap-exec-psych-callout {
            border-left: 3px solid #2563eb;
            padding: 6px 0 6px 11px;
        }
        .ap-exec-psych-callout-label {
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 3px;
        }
        .ap-exec-psych-callout-insight {
            font-size: 11.5px;
            line-height: 1.38;
            color: #334155;
        }
        .ap-exec-slide--highlight .ap-exec-grid--battlefield {
            grid-template-columns: 0.92fr 0.88fr 1.2fr;
        }
        .ap-exec-influence-hooks {
            display: flex;
            flex-direction: column;
            gap: 16px;
            flex: 1;
            min-height: 0;
            overflow: hidden;
            justify-content: center;
        }
        .ap-exec-influence-hook-title {
            margin: 0 0 5px;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #64748b;
        }
        .ap-exec-influence-hook-copy {
            margin: 0;
            font-size: 12px;
            line-height: 1.44;
            font-weight: 600;
            color: #1e293b;
        }
        .ap-exec-highlight-entries {
            display: flex;
            flex-direction: column;
            gap: 10px;
            flex: 1;
            min-height: 0;
            overflow: hidden;
        }
        .ap-exec-highlight-entry {
            flex: 1;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 11px 13px;
            background: #f8fafc;
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-height: 0;
        }
        .ap-exec-highlight-entry-name {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 3px;
        }
        .ap-exec-highlight-entry-headline {
            font-size: 11.5px;
            font-weight: 600;
            line-height: 1.32;
            color: #2563eb;
            margin-bottom: 5px;
        }
        .ap-exec-highlight-entry-hook {
            margin: 0;
            font-size: 11px;
            line-height: 1.42;
            color: #334155;
        }
        .ap-exec-highlight-entry-badges {
            margin-top: 7px;
            font-size: 8.5px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: #64748b;
        }
        .ap-exec-slide--highlight .ap-exec-grid--execution {
            grid-template-columns: 1.38fr 0.62fr;
        }
        .ap-exec-plan-horizon-col--highlight {
            border-left: 1px solid #e2e8f0;
            padding-left: 12px;
        }
        .ap-exec-plan-horizon-col--highlight:first-child {
            border-left: none;
            padding-left: 0;
        }
        .ap-exec-plan-horizon-period {
            font-size: 9px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #2563eb;
            font-weight: 700;
            margin-bottom: 4px;
            font-family: ${GPC_BRAND.fontHeading};
        }
        .ap-exec-plan-horizon-headline {
            margin: 0 0 10px;
            font-size: 12.5px;
            line-height: 1.3;
            font-weight: 700;
            color: #0f172a;
            text-transform: none;
            letter-spacing: 0;
            font-family: ${GPC_BRAND.fontHeading};
        }
        .ap-exec-highlight-list--compact {
            gap: 7px;
        }
        .ap-exec-highlight-list--compact li {
            font-size: 10.5px;
            line-height: 1.42;
        }
        .ap-exec-slide--highlight .ap-exec-signals-list {
            gap: 12px;
            justify-content: flex-start;
        }
        .ap-exec-signals-item--highlight {
            padding-bottom: 2px;
        }
        .ap-exec-signals-headline {
            font-size: 12px;
            line-height: 1.4;
            font-weight: 600;
            color: #1e293b;
        }
    `;
    document.head.appendChild(style);
}
