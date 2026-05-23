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

export const PLAN_SUMMARY_DOCUMENT_TITLE = 'Strategic Account Plan Summary';

export const DOSSIER_WIDTH_PX = 816;
export const DOSSIER_HEIGHT_PX = 1056;
export const EXEC_WIDTH_PX = 1056;
export const EXEC_HEIGHT_PX = 594;

const MOMENTUM_LABELS = ['Stalled', 'Cooling', 'Neutral', 'Warming', 'Champion'];

/** @type {Record<string, string>} */
const DOSSIER_SECTION_ICONS = {
    pursuit_thesis: 'fa-bullseye',
    strategic_tensions: 'fa-scale-balanced',
    influence_mapping: 'fa-sitemap',
    competitive_landscape: 'fa-chess-knight',
    land_and_expand: 'fa-route',
    psychology: 'fa-brain',
    relationship_momentum: 'fa-arrow-trend-up',
    momentum_timeline: 'fa-bolt',
    plan_30_60_90: 'fa-calendar-check',
    entry_points: 'fa-crosshairs',
};

/**
 * @param {string} sectionId
 * @param {string} title
 * @param {boolean} [continued]
 */
export function buildDossierSectionTitleHtml(sectionId, title, continued = false) {
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
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 */
function resolveExecExportContext(plan, account) {
    const normalized = normalizePlan(plan);
    const sections = normalized.current_draft.sections;
    const momentum = isPlainObject(sections.relationship_momentum) ? sections.relationship_momentum : {};

    return {
        sections,
        accountName: account?.name ? String(account.name) : 'Account',
        dateLabel: formatExportDate(new Date()),
        psychology: isPlainObject(sections.psychology) ? sections.psychology : {},
        plan306090: isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {},
        score: clampScale(momentum.score, 3),
        pursuitThesis: summarizePursuitThesis(sections.pursuit_thesis),
        competitive: summarizeCompetitiveLandscape(sections.competitive_landscape)
            || 'No competitive landscape captured yet.',
        timelineNotes: getExportMomentumNotes(sections).slice(0, 3),
    };
}

/**
 * @param {string} slideKey
 * @param {string} kicker
 * @param {string} accountName
 * @param {ExecSlidePageInfo} pageInfo
 * @param {'brief' | 'standard'} [titleMode]
 */
function createExecSlideElement(slideKey, kicker, accountName, pageInfo, titleMode = 'standard') {
    const slide = document.createElement('div');
    slide.className = `ap-exec-slide ap-exec-slide--${slideKey}`;
    slide.style.width = `${EXEC_WIDTH_PX}px`;
    slide.style.height = `${EXEC_HEIGHT_PX}px`;

    const titleHtml = titleMode === 'brief'
        ? `<h1 class="ap-exec-slide-title">${escapeHtml(accountName)} <span class="ap-exec-slide-title-sub">Strategic Brief</span></h1>`
        : `<h1 class="ap-exec-slide-title">${escapeHtml(accountName)}</h1>`;

    slide.innerHTML = `
        <img class="ap-exec-slide-logo" src="${GPC_LOGO_WHITE}" alt="Great Plains Communications" crossorigin="anonymous" />
        <header class="ap-exec-slide-header">
            <p class="ap-exec-slide-kicker">${escapeHtml(kicker)}</p>
            ${titleHtml}
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
 * @param {unknown} entries
 */
function buildExecInfluenceListHtml(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return '<li class="ap-exec-influence-item ap-exec-influence-item--empty">—</li>';
    }

    return entries.map((entry) => {
        let label = 'Contact';
        if (typeof entry === 'string' || typeof entry === 'number') {
            label = `Contact ${entry}`;
        } else if (isPlainObject(entry)) {
            label = entry.id != null ? `Contact ${entry.id}` : 'Contact';
            const notes = entry.notes ? `: ${String(entry.notes).trim()}` : '';
            label += notes;
        } else {
            return '';
        }
        return `<li class="ap-exec-influence-item"><span class="ap-line-clamp-2">${escapeHtml(label)}</span></li>`;
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
            el.classList.add('ap-line-clamp-3');
        });
    });

    panel.appendChild(body);
    return panel;
}

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @param {ExecSlidePageInfo} [pageInfo]
 */
export function buildSlide1Situation(plan, account, pageInfo = { pageNumber: 1, totalPages: EXEC_SLIDE_COUNT }) {
    const ctx = resolveExecExportContext(plan, account);
    const slide = createExecSlideElement('situation', 'The Situation', ctx.accountName, pageInfo, 'brief');
    const body = slide.querySelector('.ap-exec-slide-body');
    if (!(body instanceof HTMLElement)) return slide;

    const grid = document.createElement('div');
    grid.className = 'ap-exec-grid ap-exec-grid--situation';

    const strategyPanel = createExecPanel('ap-exec-panel--strategy', 'Pursuit Strategy', 'pursuit_thesis');
    const strategyCopy = document.createElement('p');
    strategyCopy.className = 'ap-exec-panel-copy ap-line-clamp-10';
    strategyCopy.textContent = ctx.pursuitThesis;
    strategyPanel.appendChild(strategyCopy);

    const sideStack = document.createElement('div');
    sideStack.className = 'ap-exec-stack';

    const momentumPanel = createExecPanel('ap-exec-panel--momentum', 'Relationship Momentum', 'relationship_momentum');
    const kpi = document.createElement('div');
    kpi.className = 'ap-exec-kpi';
    kpi.innerHTML = `
        <div class="ap-exec-kpi-score">${ctx.score}</div>
        <div class="ap-exec-kpi-label">${escapeHtml(MOMENTUM_LABELS[ctx.score - 1])}</div>`;
    momentumPanel.appendChild(kpi);

    const psychPanel = createExecPanel('ap-exec-panel--psych', 'Account Psychology', 'psychology');
    const psychWrap = document.createElement('div');
    psychWrap.className = 'ap-exec-psych-stack';
    psychWrap.innerHTML = buildExecPsychBarsHtml(ctx.psychology);
    psychPanel.appendChild(psychWrap);

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
 */
export function buildSlide2Battlefield(plan, account, pageInfo = { pageNumber: 2, totalPages: EXEC_SLIDE_COUNT }) {
    const ctx = resolveExecExportContext(plan, account);
    const slide = createExecSlideElement('battlefield', 'The Battlefield', ctx.accountName, pageInfo);
    const body = slide.querySelector('.ap-exec-slide-body');
    if (!(body instanceof HTMLElement)) return slide;

    const grid = document.createElement('div');
    grid.className = 'ap-exec-grid ap-exec-grid--battlefield';

    const competitivePanel = createExecPanel('ap-exec-panel--competitive', 'Competitive Landscape', 'competitive_landscape');
    const competitiveCopy = document.createElement('p');
    competitiveCopy.className = 'ap-exec-panel-copy ap-line-clamp-12';
    competitiveCopy.textContent = ctx.competitive;
    competitivePanel.appendChild(competitiveCopy);

    const influencePanel = createExecPanel('ap-exec-panel--influence', 'Influence Board', 'influence_mapping');
    const influenceData = isPlainObject(ctx.sections.influence_mapping) ? ctx.sections.influence_mapping : {};
    influencePanel.innerHTML += `
        <div class="ap-exec-influence-buckets">
            <div class="ap-exec-influence-bucket">
                <h3 class="ap-exec-influence-bucket-title">Executive Leadership</h3>
                <ul class="ap-exec-influence-list">${buildExecInfluenceListHtml(influenceData.executive)}</ul>
            </div>
            <div class="ap-exec-influence-bucket">
                <h3 class="ap-exec-influence-bucket-title">Mid-Level Champions</h3>
                <ul class="ap-exec-influence-list">${buildExecInfluenceListHtml(influenceData.mid_level)}</ul>
            </div>
        </div>`;

    grid.appendChild(competitivePanel);
    grid.appendChild(influencePanel);
    grid.appendChild(buildExecEntryPointsPanel(ctx.sections));
    body.appendChild(grid);
    return slide;
}

/**
 * @param {unknown} plan
 * @param {{ name?: string } | null} account
 * @param {ExecSlidePageInfo} [pageInfo]
 */
export function buildSlide3Execution(plan, account, pageInfo = { pageNumber: 3, totalPages: EXEC_SLIDE_COUNT }) {
    const ctx = resolveExecExportContext(plan, account);
    const slide = createExecSlideElement('execution', 'The Execution', ctx.accountName, pageInfo);
    const body = slide.querySelector('.ap-exec-slide-body');
    if (!(body instanceof HTMLElement)) return slide;

    const grid = document.createElement('div');
    grid.className = 'ap-exec-grid ap-exec-grid--execution';

    const planPanel = createExecPanel('ap-exec-panel--plan', '30 / 60 / 90', 'plan_30_60_90');
    const planList = document.createElement('ul');
    planList.className = 'ap-exec-plan-list';
    [
        ['30', ctx.plan306090.days_30],
        ['60', ctx.plan306090.days_60],
        ['90', ctx.plan306090.days_90],
    ].forEach(([days, text]) => {
        const line = String(text ?? '').trim() || 'Not defined';
        const item = document.createElement('li');
        item.className = 'ap-exec-plan-item';
        item.innerHTML = `<strong>${days}d</strong><span class="ap-line-clamp-4">${escapeHtml(line)}</span>`;
        planList.appendChild(item);
    });
    planPanel.appendChild(planList);

    const signalsPanel = createExecPanel('ap-exec-panel--signals', 'Strategic Signals', 'momentum_timeline');
    const signalsList = document.createElement('ul');
    signalsList.className = 'ap-exec-signals-list';
    if (ctx.timelineNotes.length === 0) {
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
export const EXEC_SLIDE_BUILDERS = [
    buildSlide1Situation,
    buildSlide2Battlefield,
    buildSlide3Execution,
];

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
 * @param {string} pillsLabel
 * @param {string} pillsText
 * @param {{ kicker: string, text: string }[]} blocks
 */
function createEditorialProseBlock(pillsLabel, pillsText, blocks) {
    const prose = document.createElement('div');
    prose.className = 'ap-export-editorial-prose';

    if (pillsText) {
        const pillsLine = document.createElement('p');
        pillsLine.className = 'ap-export-editorial-pills-line';
        pillsLine.innerHTML = `<strong>${escapeHtml(pillsLabel)}:</strong> ${escapeHtml(pillsText)}`;
        prose.appendChild(pillsLine);
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
    badge.className = 'ap-export-badge';
    badge.textContent = `${label}: ${String(value).trim()}`;
    return badge;
}

/**
 * @param {unknown} rawPoint
 * @returns {HTMLElement | null}
 */
function buildTargetProfile(rawPoint) {
    if (!isPlainObject(rawPoint)) return null;
    const contactName = String(rawPoint.contact_name ?? '').trim();
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

    const whyFields = [
        ['Why They Matter', rawPoint.why_they_matter],
        ['Likely Pressure', rawPoint.likely_pressure],
        ['What Failure Looks Like', rawPoint.what_failure_looks_like],
    ].filter(([, val]) => String(val ?? '').trim());

    const howFields = [
        ['Best Themes', rawPoint.best_themes],
        ['Narrative Openings', rawPoint.narrative_openings],
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
 * @returns {HTMLElement}
 */
function createInfluenceList(entries) {
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
        const item = document.createElement('li');
        item.className = 'ap-export-editorial-copy';
        if (typeof entry === 'string' || typeof entry === 'number') {
            item.textContent = `Contact ${entry}`;
        } else if (isPlainObject(entry)) {
            const label = entry.id != null ? `Contact ${entry.id}` : 'Contact';
            const notes = entry.notes ? `: ${String(entry.notes).trim()}` : '';
            item.textContent = `${label}${notes}`;
        } else {
            return;
        }
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
 * @param {import('./account-plan-sections.js').PlanSectionDef} section
 * @param {Record<string, unknown>} sections
 * @returns {HTMLElement[]}
 */
function buildDossierSectionUnits(section, sections) {
    if (section.type === 'composite_textarea') {
        const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
        const fields = section.fields || [];
        const gridClass = section.id === 'land_and_expand' || fields.length >= 3
            ? 'ap-export-editorial-grid--3'
            : fields.length === 2
                ? 'ap-export-editorial-grid--2'
                : '';
        const grid = createEditorialGrid(gridClass);

        fields.forEach((field) => {
            const value = String(data[field.key] ?? '').trim();
            const heading = field.label || field.hint || field.key;
            grid.appendChild(createEditorialCell(heading, value));
        });

        if (!grid.childElementCount) {
            grid.appendChild(createEditorialCell(section.title, '—'));
        }

        return [createDossierSectionBlock(section, grid)];
    }

    if (section.type === 'pills_and_narrative') {
        const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
        const pillField = section.pillField || 'selected_pills';
        const pills = Array.isArray(data[pillField]) ? data[pillField] : [];
        const pillsLabel = section.pillMode === 'either_or' ? 'Tension Choices' : 'Positioning';
        const blocks = (section.textFields || []).map((field) => ({
            kicker: field.label || field.hint || field.key,
            text: String(data[field.key] ?? '').trim(),
        }));

        const prose = createEditorialProseBlock(
            pillsLabel,
            pills.join(', '),
            blocks
        );

        return [createDossierSectionBlock(section, prose)];
    }

    if (section.type === 'influence_board') {
        const data = isPlainObject(sections[section.id]) ? sections[section.id] : {};
        const body = document.createElement('div');
        body.className = 'ap-export-editorial-influence';

        const executiveTier = document.createElement('div');
        executiveTier.className = 'ap-export-editorial-influence-tier';
        const executiveKicker = document.createElement('h3');
        executiveKicker.className = 'ap-export-editorial-kicker';
        executiveKicker.textContent = 'Executive Leadership';
        executiveTier.appendChild(executiveKicker);
        executiveTier.appendChild(createInfluenceList(data.executive));
        body.appendChild(executiveTier);

        const midTier = document.createElement('div');
        midTier.className = 'ap-export-editorial-influence-tier';
        const midKicker = document.createElement('h3');
        midKicker.className = 'ap-export-editorial-kicker';
        midKicker.textContent = 'Mid-Level Champions';
        midTier.appendChild(midKicker);
        midTier.appendChild(createInfluenceList(data.mid_level));
        body.appendChild(midTier);

        const invisibleTier = document.createElement('div');
        invisibleTier.className = 'ap-export-editorial-influence-tier ap-export-editorial-span-full';
        invisibleTier.appendChild(createEditorialCell(
            'Invisible Org Chart',
            String(data.invisible_org_chart ?? '').trim()
        ));
        body.appendChild(invisibleTier);

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
        const grid = document.createElement('div');
        grid.className = 'ap-export-psych-grid ap-export-psych-grid--dossier';
        sliders.forEach((slider) => {
            const value = clampScale(psychology[slider.id], 3);
            const panel = document.createElement('div');
            panel.className = 'ap-export-panel ap-export-panel--metric ap-export-panel--psych-compact';
            panel.appendChild(buildPsychologyBar(slider, value));
            grid.appendChild(panel);
        });
        return [createDossierSectionBlock(section, grid, undefined, 'metric')];
    }

    if (section.type === 'momentum') {
        const momentum = isPlainObject(sections.relationship_momentum) ? sections.relationship_momentum : {};
        const score = clampScale(momentum.score, 3);
        const stack = createExportPanelStack('ap-export-panel-stack ap-export-panel-stack--momentum');
        stack.appendChild(buildMomentumMetricPanel(score));
        stack.appendChild(createExportPanel('Momentum Narrative', String(momentum.narrative ?? '').trim()));
        return [createDossierSectionBlock(section, stack, undefined, 'metric')];
    }

    if (section.type === 'timeline_view') {
        return [createDossierSectionBlock(section, buildDossierMomentumTimelineBody(sections))];
    }

    if (section.type === 'triple_textarea') {
        const plan306090 = isPlainObject(sections.plan_30_60_90) ? sections.plan_30_60_90 : {};
        const grid = createEditorialGrid('ap-export-editorial-grid--3 ap-export-editorial-grid--plan');
        PLAN_306090_HORIZONS.forEach((horizon) => {
            grid.appendChild(createEditorialCell(
                horizon.title,
                String(plan306090[horizon.key] ?? '').trim()
            ));
        });
        return [createDossierSectionBlock(section, grid)];
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
    void blocks;
    return PLAN_SUMMARY_DOCUMENT_TITLE;
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
 * User-logged strategic signals only — excludes automated CRM activity records.
 * @param {Record<string, unknown>} sections
 * @returns {{ id: string, date: string, text: string, dateMs: number }[]}
 */
function getExportMomentumNotes(sections) {
    const raw = Array.isArray(sections.momentum_notes) ? sections.momentum_notes : [];
    return raw
        .filter((note) => {
            if (!isPlainObject(note)) return false;
            const source = note.source != null ? String(note.source).toLowerCase() : '';
            const type = note.type != null ? String(note.type).toLowerCase() : '';
            if (source === 'activity' || source === 'crm' || type === 'activity') return false;
            return String(note.text ?? '').trim().length > 0;
        })
        .map((note) => {
            const dateStr = String(note.date ?? '');
            const dateMs = new Date(dateStr).getTime();
            return {
                id: note.id != null ? String(note.id) : '',
                date: dateStr,
                text: String(note.text ?? '').trim(),
                dateMs: Number.isNaN(dateMs) ? 0 : dateMs,
            };
        })
        .sort((a, b) => b.dateMs - a.dateMs);
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

    notes.forEach((note) => {
        const entry = document.createElement('article');
        entry.className = 'ap-export-momentum-timeline-entry';

        const dateEl = document.createElement('p');
        dateEl.className = 'ap-export-momentum-timeline-date';
        dateEl.textContent = formatMomentumNoteDate(note.date);

        const textEl = document.createElement('p');
        textEl.className = 'ap-export-momentum-timeline-text';
        textEl.textContent = note.text;

        entry.appendChild(dateEl);
        entry.appendChild(textEl);
        wrap.appendChild(entry);
    });

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
        .ap-export-dossier-section {
            margin-bottom: 0;
        }
        .ap-export-dossier-section + .ap-export-dossier-section {
            margin-top: 28px;
            padding-top: 22px;
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
        .ap-export-section-icon {
            color: #3b82f6;
            margin-right: 8px;
            font-size: 1.1em;
            opacity: 0.9;
        }
        .ap-export-dossier-content > .ap-export-dossier-section:first-child .ap-export-dossier-section-title {
            margin-top: 0;
        }
        .ap-export-dossier-body--editorial {
            color: #1e293b;
            font-family: ${GPC_BRAND.fontBody};
        }
        .ap-export-dossier-body--editorial .ap-export-editorial-copy,
        .ap-export-dossier-body--editorial .ap-export-editorial-list {
            font-size: 13px;
            line-height: 1.6;
            color: #1e293b;
        }
        .ap-export-editorial-kicker,
        .ap-export-dossier-body--editorial h3.ap-export-editorial-kicker {
            margin: 0 0 8px;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 10px;
            line-height: 1.3;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            font-weight: 700;
        }
        .ap-export-editorial-copy {
            margin: 0 0 14px;
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
        .ap-export-momentum-timeline-entry {
            border-left: 2px solid #e2e8f0;
            padding-left: 12px;
            margin-bottom: 16px;
        }
        .ap-export-momentum-timeline-entry:last-child {
            margin-bottom: 0;
        }
        .ap-export-momentum-timeline-date {
            margin: 0 0 4px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: #64748b;
        }
        .ap-export-momentum-timeline-text {
            margin: 0;
            font-size: 13px;
            line-height: 1.55;
            color: #1e293b;
            white-space: pre-wrap;
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
        .ap-export-editorial-prose .ap-export-editorial-kicker:not(:first-child) {
            margin-top: 16px;
        }
        .ap-export-editorial-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0;
            border-top: 2px solid #0f172a;
            padding-top: 14px;
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
            padding: 0 18px;
        }
        .ap-export-editorial-span-full {
            grid-column: 1 / -1;
            border-right: none !important;
            padding-right: 0 !important;
            margin-right: 0 !important;
            margin-top: 18px;
            padding-top: 18px;
            border-top: 1px solid #e2e8f0;
        }
        .ap-export-editorial-influence {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0;
            border-top: 2px solid #0f172a;
            padding-top: 14px;
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
        .ap-export-target-profiles-body {
            display: flex;
            flex-direction: column;
            gap: 18px;
            border-top: 2px solid #0f172a;
            padding-top: 14px;
        }
        .ap-export-target-profile {
            page-break-inside: avoid;
            break-inside: avoid;
            border: 1px solid #e2e8f0;
            background: #fafbfc;
            padding: 16px 18px 18px;
        }
        .ap-export-target-profile + .ap-export-target-profile {
            margin-top: 0;
        }
        .ap-export-target-profile-header {
            margin-bottom: 14px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        .ap-export-target-profile-name {
            margin: 0 0 8px;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.01em;
            color: #0f172a;
            text-transform: none;
        }
        .ap-export-badge-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .ap-export-badge {
            display: inline-block;
            font-size: 9px;
            text-transform: uppercase;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 2px 6px;
            border-radius: 4px;
            margin-right: 0;
            color: #475569;
            font-weight: 600;
            letter-spacing: 0.03em;
        }
        .ap-export-target-profile-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0 20px;
        }
        .ap-export-target-profile-column {
            min-width: 0;
        }
        .ap-export-target-profile-column:first-child {
            border-right: 1px solid #e2e8f0;
            padding-right: 18px;
        }
        .ap-export-target-profile-group-title {
            margin: 0 0 10px;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #0f172a;
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

        /* --- Account Psychology (unchanged visual treatment) --- */
        .ap-export-psych-grid { display: flex; flex-direction: column; gap: 10px; }
        .ap-export-psych-grid--dossier {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px 14px;
        }
        .ap-export-dossier-body--metric .ap-export-panel--psych-compact {
            padding: 10px 12px;
        }
        .ap-export-dossier-body--metric .ap-export-panel--psych-compact .ap-export-psych-row-header {
            margin-bottom: 3px;
        }
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
            background: #0f172a;
            padding: 40px 40px 48px;
            color: #f8fafc;
            font-family: ${GPC_BRAND.fontBody};
        }
        .ap-exec-slide-logo {
            position: absolute;
            top: 28px;
            right: 36px;
            width: 120px;
            height: auto;
            z-index: 3;
        }
        .ap-exec-slide-header {
            flex-shrink: 0;
            margin-bottom: 16px;
            padding-right: 132px;
        }
        .ap-exec-slide-kicker {
            margin: 0 0 6px;
            font-size: 12px;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #3b82f6;
            font-family: ${GPC_BRAND.fontHeading};
            font-weight: 700;
        }
        .ap-exec-slide-title {
            margin: 0 0 4px;
            font-size: 26px;
            line-height: 1.12;
            font-weight: 700;
            font-family: ${GPC_BRAND.fontHeading};
            color: #ffffff;
        }
        .ap-exec-slide-title-sub {
            font-weight: 600;
            color: #93c5fd;
        }
        .ap-exec-slide-date {
            margin: 0;
            font-size: 12px;
            color: #94a3b8;
        }
        .ap-exec-slide-body {
            flex: 1;
            min-height: 0;
            overflow: hidden;
        }
        .ap-exec-slide-footer {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 40px;
            background: #0f172a;
            border-top: 1px solid #334155;
            font-family: ${GPC_BRAND.fontHeading};
            font-size: 11px;
            color: #94a3b8;
        }
        .ap-exec-grid {
            display: grid;
            gap: 16px;
            height: 100%;
            min-height: 0;
            overflow: hidden;
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
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 14px 16px;
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
            font-size: 14px;
            line-height: 1.2;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: #94a3b8;
            font-family: ${GPC_BRAND.fontHeading};
            font-weight: 700;
            flex-shrink: 0;
            display: flex;
            align-items: center;
        }
        .ap-exec-panel-icon {
            color: #3b82f6;
            margin-right: 8px;
            font-size: 14px;
            flex-shrink: 0;
        }
        .ap-exec-panel-copy {
            margin: 0;
            font-size: 12px;
            line-height: 1.55;
            color: #cbd5e1;
            white-space: pre-line;
            flex: 1;
            min-height: 0;
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
            font-size: 56px;
            font-weight: 800;
            line-height: 1;
            color: #3b82f6;
        }
        .ap-exec-kpi-label {
            margin-top: 6px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #93c5fd;
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
            color: #94a3b8;
            font-weight: 600;
        }
        .ap-exec-psych-track {
            height: 5px;
            border-radius: 999px;
            background: #334155;
            overflow: hidden;
        }
        .ap-exec-psych-fill {
            height: 100%;
            border-radius: 999px;
            background: linear-gradient(90deg, #3b82f6 0%, #22d3ee 100%);
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
            line-height: 1.4;
            color: #cbd5e1;
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
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 6px;
            padding: 10px 12px;
            flex-shrink: 0;
        }
        .ap-exec-slide .ap-export-target-profile + .ap-export-target-profile {
            margin-top: 0;
        }
        .ap-exec-slide .ap-export-target-profile-name {
            font-size: 13px;
            color: #f8fafc;
        }
        .ap-exec-slide .ap-export-badge {
            background: #334155;
            color: #e2e8f0;
            border: 1px solid #475569;
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
            color: #cbd5e1;
            font-size: 11px;
            line-height: 1.4;
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
            color: #cbd5e1;
            min-width: 0;
        }
    `;
    document.head.appendChild(style);
}
