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
    plan_30_60_90: 'fa-calendar-check',
});

const DASHBOARD_SECTION_IDS = Object.freeze([
    'account_snapshot',
    'pursuit_thesis',
    'influence_mapping',
    'white_space',
    'competitive_landscape',
    'plan_30_60_90',
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
        ownerFilter: document.getElementById('saos-owner-filter'),
        refresh: document.getElementById('saos-refresh-btn'),
    };

    const state = {
        rows: [],
        filteredRows: [],
        ownerOptions: [],
        selectedAccountId: null,
    };

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
            mappedInfluence: ['executive', 'mid_level', 'technical'].reduce((sum, key) => sum + nonEmptyArray(sections.influence_mapping?.[key]).length, 0),
            openDeals: 0,
        };
    }

    function getStatusClass(progress) {
        if (progress >= 80) return 'complete';
        if (progress >= 40) return 'partial';
        return 'empty';
    }

    function renderKpis() {
        const total = state.rows.length;
        const withPlans = state.rows.filter((row) => row.plan).length;
        const complete = state.rows.filter((row) => row.progress >= 80).length;
        const avg = withPlans
            ? Math.round(state.rows.reduce((sum, row) => sum + row.progress, 0) / withPlans)
            : 0;
        const staleCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
        const stale = state.rows.filter((row) => row.updatedAt && new Date(row.updatedAt).getTime() < staleCutoff).length;
        const kpis = [
            { label: 'Team Accounts', value: total, icon: 'fa-building' },
            { label: 'SAOS Started', value: withPlans, icon: 'fa-sitemap' },
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

    function renderList() {
        const search = (els.search.value || '').trim().toLowerCase();
        const owner = els.ownerFilter.value || 'all';
        state.filteredRows = state.rows.filter((row) => {
            const matchesOwner = owner === 'all' || String(row.account.user_id) === owner;
            const haystack = `${row.account.name || ''} ${row.owner?.name || ''} ${row.tier || ''} ${row.priority || ''}`.toLowerCase();
            return matchesOwner && (!search || haystack.includes(search));
        });

        els.caption.textContent = `${state.filteredRows.length} of ${state.rows.length} accounts shown`;

        if (!state.filteredRows.length) {
            els.list.innerHTML = '<div class="saos-empty-list">No matching SAOS accounts found.</div>';
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
                            ${row.updatedAt ? `<span><i class="fa-solid fa-clock"></i> ${escapeHtml(formatSimpleDate(row.updatedAt))}</span>` : '<span>No SAOS yet</span>'}
                        </div>
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
        const blindspots = nonEmptyArray(sections.critical_unknowns?.blindspots).slice(0, 3);
        const whiteSpaceRows = Array.isArray(sections.white_space?.rows) ? sections.white_space.rows.filter((item) => hasText(item?.name) || hasText(item?.area) || hasText(item?.opportunity)).slice(0, 3) : [];

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
                ${renderInsightCard('The Big Play', row.thesis, 'No pursuit thesis captured yet.')}
                ${renderInsightCard('Why Now', row.whyNow, 'No action-forcing event captured yet.')}
                ${renderInsightCard('Expansion Path', row.expansion, 'No expansion wedge captured yet.')}
                ${renderInsightCard('Influence Coverage', `${row.mappedInfluence || 0} mapped contact${row.mappedInfluence === 1 ? '' : 's'}`, 'No influence map contacts yet.')}
            </div>
            <div class="saos-detail-lists">
                <div>
                    <h3>Blindspots</h3>
                    ${blindspots.length ? `<ul>${blindspots.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="saos-muted">No blindspots logged.</p>'}
                </div>
                <div>
                    <h3>White Space</h3>
                    ${whiteSpaceRows.length ? `<ul>${whiteSpaceRows.map((rowItem) => `<li>${escapeHtml(rowItem.name || rowItem.area || rowItem.opportunity)}</li>`).join('')}</ul>` : '<p class="saos-muted">No expansion opportunities logged.</p>'}
                </div>
            </div>
        `;
    }

    function renderInsightCard(title, value, emptyText) {
        const text = truncate(value);
        return `
            <article class="saos-insight-card ${text ? '' : 'is-empty'}">
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
            state.rows = (accountsRes.data || []).map((account) => buildDashboardRow(
                account,
                ownerMap.get(String(account.user_id)) || { id: String(account.user_id || ''), name: 'Unassigned' },
                planByAccountId.get(Number(account.id))
            ));

            renderOwnerFilter();
            renderKpis();
            renderList();
            if (state.selectedAccountId) {
                const selected = state.rows.find((row) => Number(row.account.id) === Number(state.selectedAccountId));
                renderDetail(selected || null);
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
