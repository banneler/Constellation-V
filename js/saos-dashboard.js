import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    initializeAppState,
    getState,
    injectGlobalNavigation,
    setupUserMenuAndAuth,
    setupGlobalSearch,
    checkAndSetNotifications,
    loadSVGs,
    hideGlobalLoader,
    showGlobalLoader,
    showToast,
    formatSimpleDate,
} from './shared_constants.js';
import { normalizePlan } from './account-plan-data.js';
import { PLAN_SECTIONS } from './account-plan-sections.js';

const SECTION_ICON_MAP = Object.freeze({
    account_snapshot: 'fa-id-card-clip',
    pursuit_thesis: 'fa-bullseye',
    influence_mapping: 'fa-people-arrows',
    white_space: 'fa-chart-line',
    competitive_landscape: 'fa-chess-knight',
    entry_points: 'fa-door-open',
    plan_30_60_90: 'fa-calendar-check',
    momentum_timeline: 'fa-timeline',
});

const DASHBOARD_SECTION_IDS = Object.freeze([
    'account_snapshot',
    'pursuit_thesis',
    'influence_mapping',
    'white_space',
    'competitive_landscape',
    'entry_points',
    'plan_30_60_90',
    'momentum_timeline',
]);

document.addEventListener('DOMContentLoaded', async () => {
    injectGlobalNavigation();
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const els = {
        content: document.getElementById('saos-dashboard-content'),
        denied: document.getElementById('saos-access-denied'),
        kpis: document.getElementById('saos-kpi-grid'),
        caption: document.getElementById('saos-table-caption'),
        list: document.getElementById('saos-account-list'),
        detail: document.getElementById('saos-detail-panel'),
        search: document.getElementById('saos-search-input'),
        sort: document.getElementById('saos-sort-select'),
        ownerFilter: document.getElementById('saos-owner-filter'),
        refresh: document.getElementById('saos-refresh-btn'),
    };

    const state = {
        rows: [],
        filteredRows: [],
        ownerOptions: [],
        selectedAccountId: null,
        totalTeamAccounts: 0,
    };

    let ownerTomSelect = null;
    let sortTomSelect = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function toText(value) {
        if (value == null) return '';
        if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(' ');
        if (typeof value === 'object') return Object.values(value).map(toText).filter(Boolean).join(' ');
        return String(value).trim();
    }

    function hasText(value) {
        return toText(value).length > 0;
    }

    function countTruthy(values) {
        return values.reduce((count, value) => count + (hasText(value) ? 1 : 0), 0);
    }

    function truncate(value, max = 220) {
        const text = toText(value).replace(/\s+/g, ' ').trim();
        if (!text) return '';
        return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
    }

    function formatNumber(value) {
        const number = Number(value);
        if (!Number.isFinite(number) || number <= 0) return '';
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(number);
    }

    function formatLocation(account) {
        return [account.city, account.state].map((item) => String(item || '').trim()).filter(Boolean).join(', ');
    }

    function getSections(plan) {
        return plan?.current_draft?.sections || {};
    }

    function nonEmptyArray(value) {
        return Array.isArray(value) ? value.filter((item) => hasText(item)) : [];
    }

    function scoreSection(sectionId, sections) {
        const section = sections[sectionId] || {};
        switch (sectionId) {
            case 'account_snapshot': {
                const score = countTruthy([
                    section.tier,
                    section.relationship_status,
                    section.ai_cloud_maturity,
                    section.strategic_patience,
                    section.pursuit_priority,
                    section.existing_providers,
                    section.expansion_potential,
                ]);
                return score >= 5 ? 1 : score > 0 ? 0.5 : 0;
            }
            case 'pursuit_thesis': {
                const pain = nonEmptyArray(section.operational_pain_selected).length || hasText(section.operational_pain_notes);
                const score = countTruthy([section.thesis, section.action_forcing_event, section.executive_narrative]) + (pain ? 1 : 0);
                return score >= 3 ? 1 : score > 0 ? 0.5 : 0;
            }
            case 'strategic_tensions': {
                const hasPills = nonEmptyArray(section.selected_pills).length > 0;
                if (hasPills && hasText(section.narrative)) return 1;
                return hasPills || hasText(section.narrative) ? 0.5 : 0;
            }
            case 'critical_unknowns': {
                const blindspots = nonEmptyArray(section.blindspots).length;
                return blindspots >= 2 ? 1 : blindspots > 0 ? 0.5 : 0;
            }
            case 'influence_mapping': {
                const mappedContacts = ['executive', 'mid_level', 'technical'].reduce((sum, key) => sum + nonEmptyArray(section[key]).length, 0);
                const accessPath = section.access_path || {};
                const politicalContext = countTruthy([
                    section.invisible_org_chart,
                    section.political_dynamics,
                    accessPath.current,
                    accessPath.desired,
                    accessPath.strategy,
                ]);
                if (mappedContacts >= 2 && politicalContext >= 2) return 1;
                return mappedContacts > 0 || politicalContext > 0 ? 0.5 : 0;
            }
            case 'white_space': {
                const wedgeScore = countTruthy([section.initial_entry, section.trust_creation, section.expansion_path]);
                const rows = Array.isArray(section.rows) ? section.rows.filter((row) => hasText(row?.name) || hasText(row?.area) || hasText(row?.opportunity)) : [];
                if (wedgeScore >= 2 && rows.length > 0) return 1;
                return wedgeScore > 0 || rows.length > 0 ? 0.5 : 0;
            }
            case 'competitive_landscape': {
                const score = countTruthy([section.incumbents, section.narrative, section.compound_relationships, section.difficult_to_remove]);
                const pills = nonEmptyArray(section.positioning_pills).length + nonEmptyArray(section.moat_pills).length;
                if (score >= 2 && pills > 0) return 1;
                return score > 0 || pills > 0 ? 0.5 : 0;
            }
            case 'entry_points': {
                const entries = Array.isArray(sections.entry_points) ? sections.entry_points : [];
                const meaningful = entries.filter((entry) => countTruthy([entry?.contact_name, entry?.why_they_matter, entry?.operational_pain, entry?.conversation_wedge, entry?.next_move]) >= 2);
                return meaningful.length > 0 ? 1 : entries.some((entry) => hasText(entry)) ? 0.5 : 0;
            }
            case 'psychology': {
                const score = countTruthy([
                    section.organizational_gravity,
                    section.consensus_requirement,
                    section.procurement_friction,
                    section.innovation_friction,
                    section.narrative,
                ]);
                return score >= 3 ? 1 : score > 0 ? 0.5 : 0;
            }
            case 'plan_30_60_90': {
                const score = countTruthy([section.days_30, section.days_60, section.days_90]);
                return score === 3 ? 1 : score > 0 ? 0.5 : 0;
            }
            case 'momentum_timeline': {
                const log = Array.isArray(sections.interaction_log) ? sections.interaction_log : [];
                return log.length >= 3 ? 1 : log.length > 0 ? 0.5 : 0;
            }
            default:
                return hasText(section) ? 0.5 : 0;
        }
    }

    function getSectionStates(plan) {
        const sections = getSections(plan);
        return PLAN_SECTIONS.map((section) => {
            const score = scoreSection(section.id, sections);
            return {
                id: section.id,
                title: section.title,
                score,
                state: score >= 1 ? 'complete' : score > 0 ? 'partial' : 'empty',
            };
        });
    }

    function buildDashboardRow(account, owner, planRow) {
        const plan = planRow?.plan ? normalizePlan(planRow.plan) : null;
        const sectionStates = plan ? getSectionStates(plan) : [];
        const progress = sectionStates.length
            ? Math.round((sectionStates.reduce((sum, item) => sum + item.score, 0) / sectionStates.length) * 100)
            : 0;
        const sections = getSections(plan);
        return {
            account,
            owner,
            planRow,
            plan,
            sectionStates,
            progress,
            updatedAt: planRow?.updated_at || plan?.current_draft?.updated_at || null,
            tier: sections.account_snapshot?.tier || account.tier || 'Unassigned',
            priority: sections.account_snapshot?.pursuit_priority || '',
            thesis: sections.pursuit_thesis?.thesis || '',
            whyNow: sections.pursuit_thesis?.action_forcing_event || '',
            expansion: sections.white_space?.expansion_path || sections.white_space?.initial_entry || '',
            industry: account.industry || '',
            location: formatLocation(account),
            sites: account.quantity_of_sites || null,
            employees: account.employee_count || null,
            customerStatus: account.is_customer === true ? 'Customer' : 'Prospect',
            mappedInfluence: ['executive', 'mid_level', 'technical'].reduce((sum, key) => sum + nonEmptyArray(sections.influence_mapping?.[key]).length, 0),
            openDeals: 0,
        };
    }

    function hasMeaningfulSaos(row) {
        return row.plan && row.progress > 0;
    }

    function getStatusClass(progress) {
        if (progress >= 80) return 'complete';
        if (progress >= 40) return 'partial';
        return 'empty';
    }

    function renderKpis() {
        const total = state.rows.length;
        const withPlans = state.rows.length;
        const complete = state.rows.filter((row) => row.progress >= 80).length;
        const avg = withPlans
            ? Math.round(state.rows.reduce((sum, row) => sum + row.progress, 0) / withPlans)
            : 0;
        const staleCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
        const stale = state.rows.filter((row) => row.updatedAt && new Date(row.updatedAt).getTime() < staleCutoff).length;
        const kpis = [
            { label: 'Team Accounts', value: state.totalTeamAccounts, icon: 'fa-building' },
            { label: 'Active SAOS', value: withPlans, icon: 'fa-sitemap' },
            { label: 'Avg Progress', value: `${avg}%`, icon: 'fa-chart-simple' },
            { label: 'Ready / Strong', value: complete, icon: 'fa-circle-check' },
            { label: 'Stale 14+ Days', value: stale, icon: 'fa-clock-rotate-left' },
        ];
        els.kpis.innerHTML = kpis.map((kpi) => `
            <article class="saos-kpi-card">
                <div class="saos-kpi-icon"><i class="fa-solid ${kpi.icon}"></i></div>
                <div>
                    <div class="saos-kpi-value">${escapeHtml(kpi.value)}</div>
                    <div class="saos-kpi-label">${escapeHtml(kpi.label)}</div>
                </div>
            </article>
        `).join('');
    }

    function renderOwnerFilter() {
        const currentValue = els.ownerFilter.value || 'all';
        els.ownerFilter.innerHTML = '<option value="all">All owners</option>' + state.ownerOptions.map((owner) => (
            `<option value="${escapeHtml(owner.id)}">${escapeHtml(owner.name)}</option>`
        )).join('');
        els.ownerFilter.value = state.ownerOptions.some((owner) => owner.id === currentValue) ? currentValue : 'all';
    }

    function initDashboardTomSelect(selectEl, existingInstance, placeholder) {
        if (!(selectEl instanceof HTMLSelectElement) || typeof window.TomSelect !== 'function') {
            return null;
        }
        if (existingInstance && typeof existingInstance.destroy === 'function') {
            try { existingInstance.destroy(); } catch (_) {}
        }
        try {
            return new window.TomSelect(selectEl, {
                create: false,
                maxItems: 1,
                placeholder,
                controlInput: null,
                searchField: [],
                dropdownParent: 'body',
                onDropdownOpen() {
                    const d = this.dropdown;
                    if (d) d.className = 'ts-dropdown tom-select-no-search';
                },
                onChange: () => applyFilters(),
                render: {
                    dropdown: () => {
                        const d = document.createElement('div');
                        d.className = 'ts-dropdown tom-select-no-search';
                        return d;
                    },
                },
            });
        } catch (_) {
            return null;
        }
    }

    function initFilterControls() {
        sortTomSelect = initDashboardTomSelect(els.sort, sortTomSelect, 'Sort');
        ownerTomSelect = initDashboardTomSelect(els.ownerFilter, ownerTomSelect, 'Owner');
    }

    function renderSectionIcons(row) {
        return DASHBOARD_SECTION_IDS.map((id) => {
            const section = row.sectionStates.find((item) => item.id === id);
            const def = PLAN_SECTIONS.find((item) => item.id === id);
            const icon = SECTION_ICON_MAP[id] || 'fa-circle-dot';
            const stateName = section?.state || 'empty';
            return `
                <span class="saos-section-dot saos-section-dot--${stateName}" title="${escapeHtml(def?.title || id)}: ${escapeHtml(stateName)}">
                    <i class="fa-solid ${icon}"></i>
                </span>
            `;
        }).join('');
    }

    function getRowSortValue(row, sortBy) {
        if (sortBy.startsWith('updated')) {
            const time = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
            return Number.isFinite(time) ? time : 0;
        }
        if (sortBy.startsWith('progress')) return row.progress || 0;
        return String(row.account.name || '').toLowerCase();
    }

    function sortRows(rows) {
        const sortBy = els.sort.value || 'updated_desc';
        const sorted = [...rows].sort((a, b) => {
            const aValue = getRowSortValue(a, sortBy);
            const bValue = getRowSortValue(b, sortBy);
            if (sortBy === 'name_asc') return String(aValue).localeCompare(String(bValue));
            const direction = sortBy.endsWith('_asc') ? 1 : -1;
            return (Number(aValue) - Number(bValue)) * direction || String(a.account.name || '').localeCompare(String(b.account.name || ''));
        });
        return sorted;
    }

    function renderFirmographicChips(row) {
        const chips = [
            row.industry ? { icon: 'fa-industry', label: row.industry } : null,
            row.location ? { icon: 'fa-location-dot', label: row.location } : null,
            row.sites ? { icon: 'fa-network-wired', label: `${formatNumber(row.sites)} sites` } : null,
            row.employees ? { icon: 'fa-users', label: `${formatNumber(row.employees)} employees` } : null,
            row.customerStatus ? { icon: row.customerStatus === 'Customer' ? 'fa-circle-check' : 'fa-user-plus', label: row.customerStatus } : null,
        ].filter(Boolean);
        if (!chips.length) return '';
        return `<div class="saos-row-chips">${chips.map((chip) => `
            <span class="saos-row-chip"><i class="fa-solid ${chip.icon}"></i> ${escapeHtml(chip.label)}</span>
        `).join('')}</div>`;
    }

    function renderList() {
        const search = (els.search.value || '').trim().toLowerCase();
        const owner = els.ownerFilter.value || 'all';
        state.filteredRows = state.rows.filter((row) => {
            const matchesOwner = owner === 'all' || String(row.account.user_id) === owner;
            const haystack = `${row.account.name || ''} ${row.owner?.name || ''} ${row.tier || ''} ${row.priority || ''} ${row.industry || ''} ${row.location || ''} ${row.thesis || ''}`.toLowerCase();
            return matchesOwner && (!search || haystack.includes(search));
        });
        state.filteredRows = sortRows(state.filteredRows);

        els.caption.textContent = `${state.filteredRows.length} of ${state.rows.length} active SAOS plans shown (${state.totalTeamAccounts} team accounts total)`;

        if (!state.filteredRows.length) {
            els.list.innerHTML = '<div class="saos-empty-list">No active SAOS plans match the current filters.</div>';
            return;
        }

        els.list.innerHTML = state.filteredRows.map((row) => {
            const active = Number(row.account.id) === Number(state.selectedAccountId);
            const statusClass = getStatusClass(row.progress);
            return `
                <button type="button" class="saos-account-row ${active ? 'is-active' : ''}" data-account-id="${escapeHtml(row.account.id)}" role="listitem">
                    <div class="saos-account-main">
                        <div class="saos-account-name">${escapeHtml(row.account.name || 'Unnamed Account')}</div>
                        <div class="saos-account-meta">
                            <span><i class="fa-solid fa-user"></i> ${escapeHtml(row.owner?.name || 'Unassigned')}</span>
                            <span><i class="fa-solid fa-layer-group"></i> ${escapeHtml(row.tier)}</span>
                            ${row.priority ? `<span><i class="fa-solid fa-flag"></i> ${escapeHtml(row.priority)}</span>` : ''}
                            ${row.updatedAt ? `<span><i class="fa-solid fa-clock"></i> ${escapeHtml(formatSimpleDate(row.updatedAt))}</span>` : ''}
                        </div>
                        ${renderFirmographicChips(row)}
                    </div>
                    <div class="saos-account-strategy">
                        <span>Big Play</span>
                        <p>${escapeHtml(truncate(row.thesis || row.whyNow || row.expansion, 190) || 'No Big Play summary captured yet.')}</p>
                    </div>
                    <div class="saos-row-progress" aria-label="Progress ${row.progress}%">
                        <div class="saos-progress-ring saos-progress-ring--${statusClass}">${row.progress}%</div>
                    </div>
                    <div class="saos-section-icons" aria-label="Section status icons">
                        ${renderSectionIcons(row)}
                    </div>
                </button>
            `;
        }).join('');
    }

    function renderDetailListCard(title, items, emptyText, extraClass = '') {
        const normalized = (items || []).map((item) => {
            if (typeof item === 'string') return { label: '', text: item };
            return item || {};
        }).filter((item) => hasText(item.label) || hasText(item.text));
        return `
            <article class="saos-detail-readout-card ${extraClass} ${normalized.length ? '' : 'is-empty'}">
                <h3>${escapeHtml(title)}</h3>
                ${normalized.length ? `
                    <ul>
                        ${normalized.map((item) => `
                            <li>
                                ${item.label ? `<strong>${escapeHtml(item.label)}</strong>` : ''}
                                <span>${escapeHtml(item.text)}</span>
                            </li>
                        `).join('')}
                    </ul>
                ` : `<p class="saos-muted">${escapeHtml(emptyText)}</p>`}
            </article>
        `;
    }

    function pillItems(values, label) {
        const items = nonEmptyArray(values);
        if (!items.length) return [];
        return [{ label, text: items.join(', ') }];
    }

    function buildBattlefieldItems(section = {}) {
        return [
            { label: 'Incumbents', text: section.incumbents },
            { label: 'Positioning', text: section.narrative },
            { label: 'Compound Relationships', text: section.compound_relationships },
            { label: 'Difficult to Remove', text: section.difficult_to_remove },
            ...pillItems(section.positioning_pills, 'Positioning Pills'),
            ...pillItems(section.moat_pills, 'Moat Pills'),
        ];
    }

    function buildPlanItems(section = {}) {
        return [
            { label: '30 Days', text: section.days_30 },
            { label: '60 Days', text: section.days_60 },
            { label: '90 Days', text: section.days_90 },
            ...pillItems(section.client_commitments, 'Client Commitments'),
        ];
    }

    function buildEntryPointItems(entries = []) {
        return (Array.isArray(entries) ? entries : []).slice(0, 4).map((entry) => ({
            label: entry.contact_name || entry.title || 'Entry Point',
            text: [
                entry.why_they_matter,
                entry.operational_pain,
                entry.conversation_wedge,
                entry.next_move,
            ].map((value) => truncate(value, 170)).filter(Boolean).join(' • '),
        }));
    }

    function buildTimelineItems(entries = []) {
        return (Array.isArray(entries) ? entries : []).slice(0, 5).map((entry) => ({
            label: entry.date || entry.date_label || entry.source || 'Signal',
            text: entry.text || entry.interaction || entry.key_insight || entry.note,
        }));
    }

    function buildInfluenceItems(section = {}) {
        const tiers = [
            ['executive', 'Executive'],
            ['mid_level', 'Mid-Level'],
            ['technical', 'Technical'],
        ];
        return tiers.flatMap(([key, label]) => (
            (Array.isArray(section[key]) ? section[key] : []).slice(0, 4).map((contact) => {
                const name = contact.name || contact.contact_name || contact.full_name || contact.title || 'Mapped Contact';
                const details = [
                    contact.title,
                    contact.role,
                    contact.influence_level ? `Influence: ${contact.influence_level}` : '',
                    contact.relationship_temperature ? `Temp: ${contact.relationship_temperature}` : '',
                    contact.personality_style,
                    contact.notes || contact.relationship_notes || contact.hook,
                ].map((value) => truncate(value, 180)).filter(Boolean);
                return {
                    label: `${label}: ${name}`,
                    text: details.join(' • ') || 'No additional influence details captured.',
                };
            })
        ));
    }

    function renderDetail(row) {
        if (!row) {
            els.detail.innerHTML = `
                <div class="saos-empty-detail">
                    <i class="fa-solid fa-arrow-up-wide-short"></i>
                    <h2>Select an account SAOS</h2>
                    <p>Choose a plan above to open a fresh strategy container here with progress, section states, and the key account planning signals.</p>
                </div>
            `;
            return;
        }

        const sections = getSections(row.plan);
        const openUrl = `accounts.html?accountId=${encodeURIComponent(row.account.id)}&saos=1`;
        const importantSections = row.sectionStates.filter((item) => DASHBOARD_SECTION_IDS.includes(item.id));
        const pursuit = sections.pursuit_thesis || {};
        const influence = sections.influence_mapping || {};
        const whiteSpace = sections.white_space || {};
        const battlefield = sections.competitive_landscape || {};
        const plan306090 = sections.plan_30_60_90 || {};
        const blindspots = nonEmptyArray(sections.critical_unknowns?.blindspots).slice(0, 5).map((item) => ({ text: item }));
        const whiteSpaceRows = Array.isArray(whiteSpace.rows)
            ? whiteSpace.rows.filter((item) => hasText(item?.name) || hasText(item?.area) || hasText(item?.opportunity)).slice(0, 5)
                .map((item) => ({
                    label: item.name || item.area || 'Opportunity',
                    text: [item.opportunity, item.confidence, item.owner].filter(Boolean).join(' • '),
                }))
            : [];
        const whiteSpaceItems = [
            { label: 'Initial Entry', text: whiteSpace.initial_entry },
            { label: 'Trust Creation', text: whiteSpace.trust_creation },
            { label: 'Expansion Path', text: whiteSpace.expansion_path },
            ...whiteSpaceRows,
        ];

        els.detail.innerHTML = `
            <div class="saos-detail-header">
                <div>
                    <p class="saos-dashboard-eyebrow">Selected SAOS</p>
                    <h2>${escapeHtml(row.account.name || 'Unnamed Account')}</h2>
                    <div class="saos-account-meta saos-detail-meta">
                        <span><i class="fa-solid fa-user"></i> ${escapeHtml(row.owner?.name || 'Unassigned')}</span>
                        <span><i class="fa-solid fa-layer-group"></i> ${escapeHtml(row.tier)}</span>
                        <span><i class="fa-solid fa-clock"></i> ${row.updatedAt ? escapeHtml(formatSimpleDate(row.updatedAt)) : 'Not started'}</span>
                    </div>
                </div>
                <a class="btn-primary saos-open-account-btn" href="${openUrl}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open Full SAOS</a>
            </div>
            <div class="saos-detail-grid">
                <div class="saos-detail-score-card">
                    <div class="saos-progress-ring saos-progress-ring--${getStatusClass(row.progress)} saos-progress-ring--large">${row.progress}%</div>
                    <div>
                        <h3>Plan Progress</h3>
                        <p>${row.plan ? 'Computed from populated SAOS sections.' : 'No saved SAOS plan exists yet for this account.'}</p>
                    </div>
                </div>
                <div class="saos-detail-section-grid">
                    ${importantSections.map((section) => `
                        <div class="saos-detail-section-state saos-detail-section-state--${section.state}">
                            <i class="fa-solid ${SECTION_ICON_MAP[section.id] || 'fa-circle-dot'}"></i>
                            <span>${escapeHtml(section.title)}</span>
                            <strong>${section.state === 'complete' ? 'Complete' : section.state === 'partial' ? 'In progress' : 'Empty'}</strong>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="saos-insight-grid">
                ${renderInsightCard('The Big Play', row.thesis, 'No pursuit thesis captured yet.', 'saos-insight-card--wide')}
                ${renderInsightCard('Why Now', row.whyNow, 'No action-forcing event captured yet.', 'saos-insight-card--wide')}
                ${renderInsightCard('Executive Narrative', pursuit.executive_narrative || pursuit.why_account_matters || pursuit.timing, 'No executive narrative captured yet.', 'saos-insight-card--wide')}
                ${renderDetailListCard('Influence Coverage', buildInfluenceItems(influence), 'No influence map contacts yet.', 'saos-insight-card saos-insight-card--third saos-influence-card')}
            </div>
            <div class="saos-detail-lists saos-detail-lists--rich">
                ${renderDetailListCard('The Battlefield', buildBattlefieldItems(battlefield), 'No competitive battlefield captured yet.')}
                ${renderDetailListCard('Strategic Entry Points', buildEntryPointItems(sections.entry_points), 'No strategic entry points captured yet.')}
                ${renderDetailListCard('30 / 60 / 90 Plan', buildPlanItems(plan306090), 'No execution plan captured yet.')}
                ${renderDetailListCard('Relationship Timeline', buildTimelineItems(sections.interaction_log), 'No relationship timeline signals logged yet.')}
                ${renderDetailListCard('Blindspots', blindspots, 'No blindspots logged.', 'saos-detail-readout-card--half')}
                ${renderDetailListCard('White Space', whiteSpaceItems, 'No expansion opportunities logged.', 'saos-detail-readout-card--half')}
            </div>
        `;
    }

    function renderInsightCard(title, value, emptyText, extraClass = '') {
        const text = truncate(value);
        return `
            <article class="saos-insight-card ${extraClass} ${text ? '' : 'is-empty'}">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(text || emptyText)}</p>
            </article>
        `;
    }

    function applyFilters() {
        renderList();
    }

    async function loadDashboardData() {
        showGlobalLoader();
        try {
            const appState = getState();
            const ownerIds = [appState.currentUser?.id, ...(appState.managedUsers || []).map((user) => user.id || user.user_id)]
                .filter(Boolean)
                .map(String);
            const uniqueOwnerIds = Array.from(new Set(ownerIds));

            const [accountsRes, ownersRes, plansRes] = await Promise.all([
                supabase.from('accounts').select('*').in('user_id', uniqueOwnerIds).order('name', { ascending: true }),
                supabase.from('user_quotas').select('user_id, full_name').in('user_id', uniqueOwnerIds),
                supabase.from('account_plans').select('id, account_id, plan, updated_at, created_by').order('updated_at', { ascending: false }),
            ]);

            if (accountsRes.error) throw accountsRes.error;
            if (ownersRes.error) throw ownersRes.error;
            if (plansRes.error) throw plansRes.error;

            const ownerMap = new Map((ownersRes.data || []).map((owner) => [String(owner.user_id), { id: String(owner.user_id), name: owner.full_name || 'Unnamed Owner' }]));
            if (appState.currentUser?.id && !ownerMap.has(String(appState.currentUser.id))) {
                ownerMap.set(String(appState.currentUser.id), { id: String(appState.currentUser.id), name: appState.effectiveUserFullName || 'Me' });
            }

            const accountIds = new Set((accountsRes.data || []).map((account) => Number(account.id)));
            const planByAccountId = new Map((plansRes.data || [])
                .filter((planRow) => accountIds.has(Number(planRow.account_id)))
                .map((planRow) => [Number(planRow.account_id), planRow]));

            state.ownerOptions = Array.from(ownerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
            state.totalTeamAccounts = (accountsRes.data || []).length;
            state.rows = (accountsRes.data || []).map((account) => buildDashboardRow(
                account,
                ownerMap.get(String(account.user_id)) || { id: String(account.user_id || ''), name: 'Unassigned' },
                planByAccountId.get(Number(account.id))
            )).filter(hasMeaningfulSaos);

            renderOwnerFilter();
            initFilterControls();
            renderKpis();
            renderList();
            if (state.selectedAccountId) {
                const selected = state.rows.find((row) => Number(row.account.id) === Number(state.selectedAccountId));
                if (selected) renderDetail(selected);
                else {
                    state.selectedAccountId = null;
                    renderDetail(null);
                }
            }
        } catch (error) {
            console.error('[saos-dashboard] load failed:', error);
            showToast(`Unable to load SAOS dashboard: ${error.message || 'Unknown error'}`, 'error');
            els.caption.textContent = 'Unable to load SAOS dashboard.';
        } finally {
            hideGlobalLoader();
        }
    }

    function bindEvents() {
        els.search.addEventListener('input', applyFilters);
        els.ownerFilter.addEventListener('change', applyFilters);
        els.sort.addEventListener('change', applyFilters);
        els.refresh.addEventListener('click', loadDashboardData);
        els.list.addEventListener('click', (event) => {
            const rowEl = event.target.closest('.saos-account-row');
            if (!rowEl) return;
            state.selectedAccountId = Number(rowEl.dataset.accountId);
            renderList();
            const row = state.rows.find((item) => Number(item.account.id) === state.selectedAccountId);
            renderDetail(row);
            els.detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    try {
        await loadSVGs();
        const appState = await initializeAppState(supabase);
        if (!appState.currentUser) {
            hideGlobalLoader();
            return;
        }
        await setupUserMenuAndAuth(supabase, getState());
        await setupGlobalSearch(supabase);
        await checkAndSetNotifications(supabase);
        bindEvents();

        if (!getState().isManager) {
            els.denied.classList.remove('hidden');
            els.content.classList.add('hidden');
            hideGlobalLoader();
            return;
        }

        els.denied.classList.add('hidden');
        els.content.classList.remove('hidden');
        await loadDashboardData();
    } catch (error) {
        console.error('[saos-dashboard] initialization failed:', error);
        showToast(`Unable to initialize SAOS dashboard: ${error.message || 'Unknown error'}`, 'error');
        hideGlobalLoader();
    }
});
