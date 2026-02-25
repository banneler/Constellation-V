// js/deals.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatMonthYear,
    formatCurrencyK,
    formatCurrency,
    themes,
    setupModalListeners,
    showModal,
    hideModal,
    showToast,
    showGlobalLoader,
    hideGlobalLoader,
    updateActiveNavLink,
    setupUserMenuAndAuth,
    loadSVGs,
    setupGlobalSearch,
    checkAndSetNotifications,
    injectGlobalNavigation
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    injectGlobalNavigation();
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        deals: [],
        accounts: [],
        dealStages: [],
        dealsSortBy: "name",
        dealsSortDir: "asc",
        dealsViewMode: 'mine',
        currentView: 'list', // NEW: 'list' or 'board'
        currentUserQuota: 0,
        allUsersQuotas: [],
        dealsByStageChart: null,
        dealsByTimeChart: null,
        dealsByProductChart: null,
        filterStage: '',
        filterCloseMonth: '',
        filterCommitted: '', // '' = all, 'yes' = committed only, 'no' = uncommitted only
        showClosedLost: false,
        closeMonthOffset: 0  // 0 = last/current/next; +/- = slide window
    };

    // --- DOM Element Selectors ---
    const dealsByStageCanvas = document.getElementById('deals-by-stage-chart');
    const stageChartEmptyMessage = document.getElementById('chart-empty-message');
    const dealsByTimeCanvas = document.getElementById('deals-by-time-chart');
    const timeChartEmptyMessage = document.getElementById('time-chart-empty-message');
    const dealsByProductCanvas = document.getElementById('deals-by-product-chart');
    const productChartEmptyMessage = document.getElementById('product-chart-empty-message');
    const dealsTableBody = document.querySelector("#deals-table tbody");
    const metricCurrentCommit = document.getElementById("metric-current-commit");
    const metricBestCase = document.getElementById("metric-best-case");
    const metricFunnel = document.getElementById("metric-funnel");
    const metricClosedWon = document.getElementById("metric-closed-won");
    const viewMyDealsBtn = document.getElementById("view-my-deals-btn");
    const viewAllDealsBtn = document.getElementById("view-all-deals-btn");
    const dealsViewToggleDiv = document.querySelector('.deals-view-toggle');
    const metricCurrentCommitTitle = document.getElementById("metric-current-commit-title");
    const metricBestCaseTitle = document.getElementById("metric-best-case-title");
    const commitTotalQuota = document.getElementById("commit-total-quota");
    const bestCaseTotalQuota = document.getElementById("best-case-total-quota");

    // NEW: Selectors for view toggle and containers
    const listViewContainer = document.getElementById('list-view-container');
    const kanbanBoardView = document.getElementById('kanban-board-view');
    const listViewBtn = document.getElementById('list-view-btn');
    const boardViewBtn = document.getElementById('board-view-btn');
    const dealsByStageChartContainer = document.getElementById('deals-by-stage-chart-container');
    const dealsChartsSection = document.querySelector('.deals-charts-section');
    const filterStagePills = document.getElementById('filter-stage-pills');
    const filterCloseMonthPills = document.getElementById('filter-close-month-pills');
    const filterCloseMonthScroll = document.getElementById('filter-close-month-scroll');
    const closeMonthPrevBtn = document.getElementById('close-month-prev');
    const closeMonthNextBtn = document.getElementById('close-month-next');
    const filterCommittedPills = document.getElementById('filter-committed-pills');
    const showClosedLostEl = document.getElementById('show-closed-lost');
    const dealsFiltersResetBtn = document.getElementById('deals-filters-reset');


    // --- Data Fetching ---
    async function loadAllData() {
        if (!state.currentUser) return;

        showGlobalLoader();
        const isManager = state.currentUser.user_metadata?.is_manager === true;
        const isTeamView = state.dealsViewMode === 'all' && isManager;

        const dealsQuery = supabase.from("deals").select("*");
        const accountsQuery = supabase.from("accounts").select("*");
        const dealStagesQuery = supabase.from("deal_stages").select("stage_name, sort_order").order('sort_order');
        
        if (!isTeamView) {
            dealsQuery.eq("user_id", state.currentUser.id);
            accountsQuery.eq("user_id", state.currentUser.id);
        }

        const currentUserQuotaQuery = supabase.from("user_quotas").select("monthly_quota").eq("user_id", state.currentUser.id);
        let allQuotasQuery = isManager ? supabase.from("user_quotas").select("monthly_quota") : Promise.resolve({ data: [], error: null });

        const promises = [dealsQuery, accountsQuery, currentUserQuotaQuery, dealStagesQuery, allQuotasQuery];
        const allTableNames = ["deals", "accounts", "currentUserQuota", "dealStages", "allUsersQuotas"];
        
        try {
            const results = await Promise.allSettled(promises);
            results.forEach((result, index) => {
                const tableName = allTableNames[index];
                if (result.status === "fulfilled" && !result.value.error) {
                    if (tableName === "currentUserQuota") {
                        state.currentUserQuota = result.value.data?.[0]?.monthly_quota || 0;
                    } else {
                        state[tableName] = result.value.data || [];
                    }
                } else {
                    console.error(`Error fetching ${tableName}:`, result.status === 'fulfilled' ? result.value.error?.message : result.reason);
                }
            });
        } catch (error) {
            console.error("Critical error in loadAllData:", error);
        } finally {
            hideGlobalLoader();
            populateDealsFilters();
            render(); 
            renderDealsMetrics();
            renderDealsByStageChart();
            renderDealsByTimeChart();
            renderDealsByProductChart();
        }
    }

    function createFilterPill(value, label, active) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'deals-filter-pill rounded-md px-3 py-1.5 text-sm font-medium transition-colors flex-shrink-0 ' + (active ? 'active' : '');
        btn.dataset.value = value;
        btn.textContent = label;
        return btn;
    }

    function getCloseMonthRange() {
        const now = new Date();
        const months = [];
        for (let i = -12; i <= 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return months;
    }

    function populateDealsFilters() {
        if (filterStagePills) {
            filterStagePills.innerHTML = '';
            const stages = (state.dealStages || []).sort((a, b) => a.sort_order - b.sort_order);
            filterStagePills.appendChild(createFilterPill('', 'All', !state.filterStage));
            stages.forEach(s => {
                const name = s.stage_name || '';
                filterStagePills.appendChild(createFilterPill(name, name, state.filterStage === name));
            });
        }
        if (filterCloseMonthPills) {
            filterCloseMonthPills.innerHTML = '';
            filterCloseMonthPills.appendChild(createFilterPill('', 'All', !state.filterCloseMonth));
            const months = getCloseMonthRange();
            months.forEach(m => filterCloseMonthPills.appendChild(createFilterPill(m, formatMonthYear(m), state.filterCloseMonth === m)));
            // Scroll to show last/current/next (3-month view); offset 0 = indices 11,12,13
            if (filterCloseMonthScroll) {
                requestAnimationFrame(() => {
                    const pills = filterCloseMonthPills.querySelectorAll('.deals-filter-pill[data-value]');
                    const firstMonthPill = Array.from(pills).find(p => p.dataset.value);
                    const step = firstMonthPill ? firstMonthPill.offsetWidth + 4 : 80;
                    const baseIndex = 11; // pill index of "last" month (All=0, months 1-25)
                    const targetIndex = Math.max(0, Math.min(baseIndex + state.closeMonthOffset, months.length - 3));
                    filterCloseMonthScroll.scrollLeft = targetIndex * step;
                });
            }
        }
        if (filterCommittedPills) {
            filterCommittedPills.innerHTML = '';
            const opts = [['', 'All'], ['yes', 'Committed'], ['no', 'Uncommitted']];
            opts.forEach(([val, lbl]) => filterCommittedPills.appendChild(createFilterPill(val, lbl, state.filterCommitted === val)));
        }
        if (showClosedLostEl) showClosedLostEl.checked = state.showClosedLost;
        updateClosedLostToggleUI();
    }

    function updateClosedLostToggleUI() {
        // Toggle styling is driven by CSS :has(input:checked) on .deals-filter-toggle
    }

    // --- Chart Colors & Helpers ---
    function createChartGradient(ctx, chartArea, index, totalDatasets) {
        if (!chartArea || !ctx) return 'rgba(0,0,0,0.5)';
        const bodyClass = document.body.className;
        let palette;
        if (bodyClass.includes('theme-green')) {
            palette = ['#00ff41', '#33ff66', '#66ff99', '#99ffcc', '#ccffee'];
        } else if (bodyClass.includes('theme-blue')) {
            palette = ['#f92772', '#ae81ff', '#66d9ef', '#a6e22e', '#fd971f'];
        } else if (bodyClass.includes('theme-corporate')) {
            palette = ['#000080', '#0000ff', '#008080', '#00ffff', '#808080'];
        } else { // Default for dark and light themes
            palette = ['#007bff', '#00aeff', '#00c6ff', '#00dfff', '#00f2ff'];
        }
        const baseColor = palette[index % palette.length];
        const lightenColor = (color, percent) => {
            const f=parseInt(color.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
            return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
        }
        const gradient = ctx.createLinearGradient(chartArea.left, chartArea.top, chartArea.right, chartArea.bottom);
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(1, lightenColor(baseColor, 0.3));
        return gradient;
    }

    function getFutureDeals() {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        return state.deals.filter(deal => {
            if (!deal.close_month) return true;
            const [dealYear, dealMonth] = deal.close_month.split('-').map(Number);
            return dealYear > currentYear || (dealYear === currentYear && dealMonth >= currentMonth);
        });
    }

    function getBaseDeals() {
        if (!state.showClosedLost) return getFutureDeals();
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const isClosedLost = (d) => (d.stage || '').toLowerCase().includes('closed lost') || (d.stage || '').toLowerCase().includes('lost');
        return state.deals.filter(deal => {
            if (!deal.close_month) return true;
            const [dealYear, dealMonth] = deal.close_month.split('-').map(Number);
            const isFuture = dealYear > currentYear || (dealYear === currentYear && dealMonth >= currentMonth);
            if (isFuture) return true;
            return isClosedLost(deal);
        });
    }

    function getFilteredDeals() {
        let deals = getBaseDeals();
        if (state.filterStage) deals = deals.filter(d => d.stage === state.filterStage);
        if (state.filterCloseMonth) deals = deals.filter(d => d.close_month === state.filterCloseMonth);
        if (state.filterCommitted === 'yes') deals = deals.filter(d => d.is_committed);
        if (state.filterCommitted === 'no') deals = deals.filter(d => !d.is_committed);
        return deals;
    }
    
    // NEW: Main render function to switch between views
    const render = () => {
        if (state.currentView === 'list') {
            renderDealsPage(); // Your original table render function
            listViewContainer.classList.remove('hidden');
            kanbanBoardView.classList.add('hidden');
            if (dealsChartsSection) dealsChartsSection.classList.remove('hidden');
        } else {
            renderKanbanBoard();
            listViewContainer.classList.add('hidden');
            kanbanBoardView.classList.remove('hidden');
            if (dealsChartsSection) dealsChartsSection.classList.add('hidden');
        }
    };

    // Stage pill style: light fill + darker border (matches deal-list-stage-pill)
    function getStageChartColors(stageName) {
        const s = (stageName || '').toLowerCase();
        if (s.includes('discovery')) return { fill: '#93c5fd', border: '#3b82f6' };
        if (s.includes('proposal')) return { fill: '#fde68a', border: '#f59e0b' };
        if (s.includes('negotiation')) return { fill: '#c4b5fd', border: '#8b5cf6' };
        if (s.includes('won')) return { fill: '#86efac', border: '#22c55e' };
        if (s.includes('lost')) return { fill: '#fca5a5', border: '#ef4444' };
        return { fill: '#d1d5db', border: '#6b7280' };
    }

    // --- Render Functions ---
    function renderDealsByStageChart() {
        if (!dealsByStageCanvas || !stageChartEmptyMessage) return;
        const filteredDeals = getFilteredDeals();
        const openDeals = filteredDeals.filter(deal => deal.stage !== 'Closed Won' && deal.stage !== 'Closed Lost');
        if (openDeals.length === 0) {
            dealsByStageCanvas.classList.add('hidden');
            stageChartEmptyMessage.classList.remove('hidden');
            if (state.dealsByStageChart) { state.dealsByStageChart.destroy(); state.dealsByStageChart = null; }
            return;
        }
        dealsByStageCanvas.classList.remove('hidden');
        stageChartEmptyMessage.classList.add('hidden');
        const stageMrc = openDeals.reduce((acc, deal) => {
            const stage = deal.stage || 'Uncategorized';
            acc[stage] = (acc[stage] || 0) + (deal.mrc || 0);
            return acc;
        }, {});
        const sortedStages = Object.entries(stageMrc).sort(([, a], [, b]) => a - b);
        const labels = sortedStages.map(([stage]) => stage);
        const data = sortedStages.map(([, mrc]) => mrc);
        const isManager = state.currentUser.user_metadata?.is_manager === true;
        const isMyTeamView = state.dealsViewMode === 'all' && isManager;
        const effectiveMonthlyQuota = isMyTeamView ? state.allUsersQuotas.reduce((sum, quota) => sum + (quota.monthly_quota || 0), 0) : state.currentUserQuota;
        
        const fills = labels.map(stage => getStageChartColors(stage).fill);
        const borders = labels.map(stage => getStageChartColors(stage).border);

        if (state.dealsByStageChart) state.dealsByStageChart.destroy();
        state.dealsByStageChart = new Chart(dealsByStageCanvas, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'MRC by Stage', data, backgroundColor: fills, borderColor: borders, borderWidth: 1.5, borderRadius: 6, barPercentage: 0.6 }] },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (c) => `MRC: ${formatCurrency(c.parsed.x)}` } },
                    annotation: { annotations: { quotaLine: { type: 'line', scaleID: 'x', value: effectiveMonthlyQuota, borderColor: 'red', borderWidth: 2, borderDash: [6, 6] } } }
                },
                scales: { 
                    x: { grid: { display: false }, ticks: { color: 'var(--text-medium)', callback: (v) => formatCurrencyK(v) } }, 
                    y: { grid: { color: 'var(--border-color)', borderDash: [4, 4] }, ticks: { color: 'var(--text-medium)' } } 
                }
            }
        });
    }

    function renderDealsByTimeChart() {
        if (!dealsByTimeCanvas || !timeChartEmptyMessage) return;
        const filteredDeals = getFilteredDeals();
        const openDeals = filteredDeals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost' && d.close_month);
        if (openDeals.length === 0) {
            dealsByTimeCanvas.classList.add('hidden');
            timeChartEmptyMessage.classList.remove('hidden');
            if (state.dealsByTimeChart) { state.dealsByTimeChart.destroy(); state.dealsByTimeChart = null; }
            return;
        }
        dealsByTimeCanvas.classList.remove('hidden');
        timeChartEmptyMessage.classList.add('hidden');
        const today = new Date(), currentYear = today.getFullYear(), currentMonth = today.getMonth();
        const funnel = { '0-30 Days': 0, '31-60 Days': 0, '61-90 Days': 0, '90+ Days': 0 };
        openDeals.forEach(deal => {
            const [dealYear, dealMonth] = deal.close_month.split('-').map(Number);
            const monthDiff = (dealYear - currentYear) * 12 + (dealMonth - 1 - currentMonth);
            if (monthDiff === 0) { funnel['0-30 Days'] += deal.mrc || 0; }
            else if (monthDiff === 1) { funnel['31-60 Days'] += deal.mrc || 0; }
            else if (monthDiff === 2) { funnel['61-90 Days'] += deal.mrc || 0; }
            else if (monthDiff > 2) { funnel['90+ Days'] += deal.mrc || 0; }
        });
        const labels = Object.keys(funnel), data = Object.values(funnel);
        const isManager = state.currentUser.user_metadata?.is_manager === true;
        const isMyTeamView = state.dealsViewMode === 'all' && isManager;
        const effectiveMonthlyQuota = isMyTeamView ? state.allUsersQuotas.reduce((sum, quota) => sum + (quota.monthly_quota || 0), 0) : state.currentUserQuota;
        
        const funnelFills = ['#86efac', '#93c5fd', '#fde68a', '#c4b5fd'];   // light: green, blue, yellow, purple
        const funnelBorders = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6']; // darker borders

        if (state.dealsByTimeChart) state.dealsByTimeChart.destroy();
        state.dealsByTimeChart = new Chart(dealsByTimeCanvas, {
            type: 'bar',
            data: { labels, datasets: [{ data, backgroundColor: funnelFills, borderColor: funnelBorders, borderWidth: 1.5, borderRadius: 6, barPercentage: 0.6 }] },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (c) => `MRC: ${formatCurrency(c.parsed.x)}` } },
                    annotation: { annotations: { quotaLine: { type: 'line', scaleID: 'x', value: effectiveMonthlyQuota, borderColor: 'red', borderWidth: 2, borderDash: [6, 6] } } }
                },
                scales: { 
                    x: { grid: { display: false }, ticks: { color: 'var(--text-medium)', callback: (v) => formatCurrencyK(v) } }, 
                    y: { grid: { color: 'var(--border-color)', borderDash: [4, 4] }, ticks: { color: 'var(--text-medium)' } } 
                }
            }
        });
    }

    function renderDealsByProductChart() {
        if (!dealsByProductCanvas || !productChartEmptyMessage) return;
        const filteredDeals = getFilteredDeals();
        const openDeals = filteredDeals.filter(deal => deal.stage !== 'Closed Won' && deal.stage !== 'Closed Lost');
        
        const productMrc = {};
        openDeals.forEach(deal => {
            if (!deal.products || !deal.products.trim()) {
                productMrc['Uncategorized'] = (productMrc['Uncategorized'] || 0) + (deal.mrc || 0);
                return;
            }
            const products = deal.products.split(',').map(p => p.trim()).filter(p => p);
            const mrcPerProduct = (deal.mrc || 0) / products.length;
            products.forEach(p => {
                let normalized = p;
                const lower = p.toLowerCase();
                if (lower.includes('internet')) normalized = 'Internet';
                else if (lower.includes('ethernet')) normalized = 'Ethernet';
                else if (lower.includes('uc')) normalized = 'UC';
                else if (lower.includes('pri') || lower.includes('sip')) normalized = 'PRI/SIP';
                else if (lower.includes('sdwan') || lower.includes('sd-wan')) normalized = 'SD-WAN';
                else if (lower.includes('firewall')) normalized = 'Firewall';
                else if (lower.includes('5g')) normalized = '5G';
                else if (lower.includes('cloud')) normalized = 'Cloud Connect';
                else if (lower.includes('wave')) normalized = 'Waves';
                
                productMrc[normalized] = (productMrc[normalized] || 0) + mrcPerProduct;
            });
        });

        if (Object.keys(productMrc).length === 0) {
            dealsByProductCanvas.classList.add('hidden');
            productChartEmptyMessage.classList.remove('hidden');
            if (state.dealsByProductChart) { state.dealsByProductChart.destroy(); state.dealsByProductChart = null; }
            return;
        }

        dealsByProductCanvas.classList.remove('hidden');
        productChartEmptyMessage.classList.add('hidden');

        const sortedProducts = Object.entries(productMrc).sort(([, a], [, b]) => b - a);
        const labels = sortedProducts.map(([p]) => p);
        const data = sortedProducts.map(([, mrc]) => mrc);
        
        const backgroundColors = labels.map(label => {
            const colorObj = getProductColor(label);
            return colorObj.bg;
        });
        const borderColors = labels.map(label => {
            const colorObj = getProductColor(label);
            return colorObj.border;
        });

        if (state.dealsByProductChart) state.dealsByProductChart.destroy();
        state.dealsByProductChart = new Chart(dealsByProductCanvas, {
            type: 'doughnut',
            data: { 
                labels, 
                datasets: [{ 
                    data, 
                    backgroundColor: backgroundColors, 
                    borderColor: borderColors, 
                    borderWidth: 1.5 
                }] 
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { position: 'right', labels: { color: 'var(--text-medium)', font: { size: 11 } } },
                    tooltip: { callbacks: { label: (c) => ` ${c.label}: ${formatCurrency(c.parsed)}` } }
                }
            }
        });
    }

    const renderDealsPage = () => {
        if (!dealsTableBody) return;
        const filteredDeals = getFilteredDeals();
        const dealsWithAccount = filteredDeals.map((deal) => ({ ...deal, account_name: state.accounts.find((a) => a.id === deal.account_id)?.name || "N/A" }));
        dealsWithAccount.sort((a, b) => {
            const valA = a[state.dealsSortBy], valB = b[state.dealsSortBy];
            let comparison = (typeof valA === "string") ? (valA || "").localeCompare(b[state.dealsSortBy] || "") : (valA > valB ? 1 : -1);
            return state.dealsSortDir === "desc" ? comparison * -1 : comparison;
        });
        dealsTableBody.innerHTML = "";
        const esc = (s) => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        dealsWithAccount.forEach((deal) => {
            const row = dealsTableBody.insertRow();
            row.innerHTML = `
                <td class="text-center align-middle w-12"><input type="checkbox" class="commit-deal-checkbox" data-deal-id="${deal.id}" ${deal.is_committed ? "checked" : ""}></td>
                <td class="deal-cell-editable deal-cell-select align-middle text-center w-32 relative" data-deal-id="${deal.id}" data-field="stage" data-display="${esc(deal.stage)}">
                    <span class="deal-list-stage-pill px-2 py-1 rounded-full text-xs font-semibold ${getDealStageColorClass(deal.stage)}">${esc(deal.stage) || "Stage"}</span>
                </td>
                <td class="deal-cell-editable deal-cell-month align-middle text-center w-40" data-deal-id="${deal.id}" data-field="close_month">${deal.close_month ? formatMonthYear(deal.close_month) : ""}</td>
                <td class="deal-cell-details align-middle">
                    <span class="deal-list-account deal-cell-editable deal-cell-select" data-deal-id="${deal.id}" data-field="account_id" data-display="${esc(deal.account_name)}" data-placeholder="Select Account">${esc(deal.account_name)}</span><br>
                    <span class="deal-list-name deal-cell-editable" contenteditable="true" data-deal-id="${deal.id}" data-field="name" data-placeholder="Deal Name">${esc(deal.name)}</span>
                </td>
                <td class="deal-cell-products align-middle">
                    <div class="deal-list-products" data-deal-id="${deal.id}" data-field="products">${getProductPillHtml(deal.id, deal.products)}</div>
                </td>
                <td class="deal-cell-editable align-middle text-center w-20" contenteditable="true" data-deal-id="${deal.id}" data-field="term">${esc(deal.term)}</td>
                <td class="deal-cell-editable deal-cell-number align-middle text-center font-bold text-[var(--primary-blue)] w-28" data-deal-id="${deal.id}" data-field="mrc">${formatCurrency(deal.mrc || 0)}</td>
                <td class="deal-cell-notes align-middle min-w-[16rem] w-full p-0"><div class="deal-notes-cell-inner deal-cell-editable text-[0.8rem]" contenteditable="true" data-deal-id="${deal.id}" data-field="notes" data-placeholder="Notes">${esc(deal.notes)}</div></td>`;
        });
        document.querySelectorAll("#deals-table th.sortable").forEach((th) => {
            th.classList.remove("asc", "desc");
            if (th.dataset.sort === state.dealsSortBy) th.classList.add(state.dealsSortDir);
        });
    };

    // NEW: Kanban Board Render Functions
    const renderKanbanBoard = () => {
        kanbanBoardView.innerHTML = '';
        const dealsToRender = getFilteredDeals();
        const stages = state.dealStages.map(s => s.stage_name);

        stages.forEach(stage => {
            const dealsInStage = dealsToRender.filter(d => d.stage === stage);
            const column = document.createElement('div');
            column.className = 'kanban-column';
            column.dataset.stage = stage;
            const totalMRC = dealsInStage.reduce((sum, deal) => sum + deal.mrc, 0);
            const emptyHint = dealsInStage.length === 0 ? '<div class="kanban-column-empty">No deals</div>' : '';
            column.innerHTML = `
                <div class="kanban-column-header">
                    <h4>${stage} (${dealsInStage.length})</h4>
                    <span class="kanban-column-total">${formatCurrency(totalMRC)}</span>
                </div>
                <div class="kanban-column-body">
                    ${dealsInStage.map(deal => renderDealCard(deal)).join('')}
                    ${emptyHint}
                </div>`;
            kanbanBoardView.appendChild(column);
        });
        setupDragAndDrop();
        setupKanbanFlipListeners();
    };

    function setupKanbanFlipListeners() {
        kanbanBoardView.onclick = (e) => {
            const editBtn = e.target.closest('.edit-deal-btn');
            const saveBtn = e.target.closest('.deal-card-save-btn');
            const cancelBtn = e.target.closest('.deal-card-cancel-btn');
            const commitToggle = e.target.closest('.deal-card-commit-toggle');
            const commitCheck = commitToggle?.querySelector('.commit-deal-checkbox') || e.target.closest('.commit-deal-checkbox');
            
            if (editBtn) {
                e.stopPropagation();
                enterDealEditMode(Number(editBtn.dataset.dealId));
                return;
            }
            if (saveBtn) {
                e.stopPropagation();
                handleKanbanSaveDeal(Number(saveBtn.dataset.dealId));
                return;
            }
            if (cancelBtn) {
                e.stopPropagation();
                exitDealEditMode(Number(cancelBtn.dataset.dealId));
                return;
            }
            if (commitCheck) {
                e.stopPropagation();
                handleCommitDeal(Number(commitCheck.dataset.dealId), commitCheck.checked);
                return;
            }
            if (commitToggle) {
                e.stopPropagation();
                return;
            }

            const card = e.target.closest('.kanban-card.deal-card-flippable');
            if (!card || card.classList.contains('dragging')) return;
            const dealId = Number(card.dataset.id);
            const flipInner = card.querySelector('.deal-card-flip-inner');
            if (!flipInner) return;
            if (card.classList.contains('deal-card-editing') || card.classList.contains('deal-card-notes-editing')) return;
            const isBackEdit = e.target.closest('.deal-card-back-edit');
            const isNotesSave = e.target.closest('.deal-card-notes-save');
            const isNotesCancel = e.target.closest('.deal-card-notes-cancel');
            if (isBackEdit) { e.stopPropagation(); enterKanbanNotesEditMode(card, dealId); return; }
            if (isNotesSave || isNotesCancel) return;
            if (card.classList.contains('deal-card-flipped')) card.classList.remove('deal-card-flipped');
            else card.classList.add('deal-card-flipped');
        };
    }

    function enterKanbanNotesEditMode(card, dealId) {
        const deal = state.deals.find(d => d.id === dealId);
        const currentNotes = (deal?.notes || '').trim();
        const backContent = card.querySelector('.deal-card-back-content');
        const backBody = card.querySelector('.deal-card-back-body');
        const backEditBtn = card.querySelector('.deal-card-back-edit');
        if (!backContent || !backBody || !backEditBtn) return;
        card.classList.add('deal-card-notes-editing');
        backBody.dataset.originalNotes = currentNotes;
        const textarea = document.createElement('textarea');
        textarea.className = 'deal-card-notes-textarea';
        textarea.value = currentNotes;
        textarea.rows = 4;
        backBody.innerHTML = '';
        backBody.appendChild(textarea);
        const wrap = document.createElement('div');
        wrap.className = 'deal-card-notes-edit-actions';
        wrap.innerHTML = '<button type="button" class="btn-icon btn-icon-sm deal-card-notes-cancel" title="Cancel"><i class="fas fa-times"></i></button><button type="button" class="btn-icon btn-icon-sm deal-card-notes-save" title="Save notes"><i class="fas fa-check"></i></button>';
        backEditBtn.replaceWith(wrap);
        const saveBtn = wrap.querySelector('.deal-card-notes-save');
        const cancelBtn = wrap.querySelector('.deal-card-notes-cancel');
        const exitNotesEdit = () => {
            card.classList.remove('deal-card-notes-editing');
            const orig = backBody.dataset.originalNotes || '';
            const escaped = orig.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>');
            backBody.removeAttribute('data-original-notes');
            backBody.innerHTML = escaped || '<span class="text-[var(--text-muted)]">No notes</span>';
            const newEditBtn = document.createElement('button');
            newEditBtn.type = 'button';
            newEditBtn.className = 'btn-icon btn-icon-sm deal-card-back-edit';
            newEditBtn.dataset.dealId = dealId;
            newEditBtn.title = 'Edit notes';
            newEditBtn.innerHTML = '<i class="fas fa-pen"></i>';
            wrap.replaceWith(newEditBtn);
        };
        saveBtn.onclick = async (ev) => {
            ev.stopPropagation();
            const value = textarea.value.trim();
            const { error } = await supabase.from('deals').update({ notes: value }).eq('id', dealId);
            if (error) { showToast('Error saving notes.', 'error'); return; }
            if (deal) deal.notes = value;
            backBody.dataset.originalNotes = value;
            exitNotesEdit();
        };
        cancelBtn.onclick = (ev) => { ev.stopPropagation(); exitNotesEdit(); };
    }

    function enterDealEditMode(dealId) {
        const deal = state.deals.find(d => d.id === dealId);
        if (!deal) return;
        const card = kanbanBoardView?.querySelector(`.kanban-card[data-id="${dealId}"]`);
        if (!card) return;
        if (card.classList.contains('deal-card-editing')) return;

        card.classList.add('deal-card-editing');

        const valueEl = card.querySelector('.deal-card-value');
        if (valueEl) {
            valueEl.textContent = '';
            valueEl.appendChild(document.createTextNode('$'));
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'deal-card-inline-input deal-card-value-input';
            input.dataset.field = 'mrc';
            input.value = deal.mrc || 0;
            input.min = 0;
            input.step = 0.01;
            input.placeholder = '0';
            valueEl.appendChild(input);
            valueEl.appendChild(document.createTextNode('/mo'));
        }

        const nameEl = card.querySelector('.deal-card-name');
        if (nameEl) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'deal-card-inline-input deal-card-name-input';
            input.dataset.field = 'name';
            input.value = deal.name || '';
            input.placeholder = 'Deal name';
            nameEl.textContent = '';
            nameEl.appendChild(input);
        }

        const stageEl = card.querySelector('.deal-card-stage');
        if (stageEl) {
            const stages = state.dealStages.sort((a, b) => a.sort_order - b.sort_order);
            const currentStage = deal.stage || '';
            const wrap = document.createElement('div');
            wrap.className = 'deal-card-stage-fan-wrap';
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.className = 'deal-card-stage-input';
            hiddenInput.dataset.field = 'stage';
            hiddenInput.value = currentStage;
            wrap.appendChild(hiddenInput);

            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = `deal-card-stage-trigger ${getDealStageColorClass(currentStage)}`;
            trigger.textContent = currentStage || 'Stage';
            trigger.innerHTML = `${currentStage || 'Stage'} <i class="fas fa-chevron-down deal-card-stage-chevron"></i>`;
            wrap.appendChild(trigger);

            const fan = document.createElement('div');
            fan.className = 'deal-card-stage-fan';
            const total = stages.length;
            const spread = Math.min(120, Math.max(60, (total - 1) * 25));
            const startAngle = 90 + spread / 2;
            stages.forEach((s, i) => {
                const angle = total <= 1 ? 90 : startAngle - (spread * i) / (total - 1);
                const pill = document.createElement('button');
                pill.type = 'button';
                pill.className = `deal-card-stage-pill ${getDealStageColorClass(s.stage_name)}`;
                pill.textContent = s.stage_name;
                pill.dataset.stage = s.stage_name;
                pill.style.setProperty('--fan-angle', `${angle}deg`);
                pill.style.setProperty('--fan-i', `${i}`);
                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hiddenInput.value = s.stage_name;
                    trigger.innerHTML = `${s.stage_name} <i class="fas fa-chevron-down deal-card-stage-chevron"></i>`;
                    trigger.className = `deal-card-stage-trigger ${getDealStageColorClass(s.stage_name)}`;
                });
                fan.appendChild(pill);
            });
            wrap.appendChild(fan);

            const closeFan = () => {
                wrap.classList.remove('open');
                document.removeEventListener('click', closeFan);
            };
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                if (wrap.classList.contains('open')) {
                    closeFan();
                } else {
                    wrap.classList.add('open');
                    setTimeout(() => document.addEventListener('click', closeFan), 0);
                }
            });
            wrap.addEventListener('click', (e) => e.stopPropagation());
            fan.querySelectorAll('.deal-card-stage-pill').forEach((p) => {
                p.addEventListener('click', () => closeFan());
            });
            stageEl.replaceWith(wrap);
        }

        const footerEl = card.querySelector('.deal-card-footer');
        if (footerEl) {
            const closeEl = footerEl.querySelector('.deal-card-close');
            const closeWrap = document.createElement('div');
            closeWrap.className = 'deal-card-close-picker';
            const [year, month] = (deal.close_month || '').split('-');
            const hiddenClose = document.createElement('input');
            hiddenClose.type = 'hidden';
            hiddenClose.className = 'deal-card-close-input';
            hiddenClose.dataset.field = 'close_month';
            hiddenClose.value = deal.close_month || '';

            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const monthOptions = monthNames.map((m, i) => ({ value: String(i + 1).padStart(2, '0'), label: m }));
            const currentYear = new Date().getFullYear();
            const yearOptions = [currentYear, currentYear + 1, currentYear + 2].map(y => ({ value: String(y), label: String(y) }));

            let selectedMonth = month || '';
            let selectedYear = year || '';

            const createCloseFan = (options, currentVal, placeholder, onSelect) => {
                const wrap = document.createElement('div');
                wrap.className = 'deal-card-stage-fan-wrap deal-card-close-fan';
                const trigger = document.createElement('button');
                trigger.type = 'button';
                trigger.className = 'deal-card-stage-trigger deal-card-close-fan-trigger';
                const currentLabel = options.find(o => o.value === currentVal)?.label || placeholder;
                trigger.innerHTML = `${currentLabel} <i class="fas fa-chevron-down deal-card-stage-chevron"></i>`;
                wrap.appendChild(trigger);
                const fan = document.createElement('div');
                fan.className = 'deal-card-stage-fan';
                options.forEach((opt, i) => {
                    const pill = document.createElement('button');
                    pill.type = 'button';
                    pill.className = 'deal-card-stage-pill deal-stage-default';
                    pill.textContent = opt.label;
                    pill.dataset.value = opt.value;
                    pill.style.setProperty('--fan-i', `${i}`);
                    pill.addEventListener('click', (e) => {
                        e.stopPropagation();
                        onSelect(opt.value, opt.label);
                        trigger.innerHTML = `${opt.label} <i class="fas fa-chevron-down deal-card-stage-chevron"></i>`;
                    });
                    fan.appendChild(pill);
                });
                wrap.appendChild(fan);
                const closeFan = () => {
                    wrap.classList.remove('open');
                    document.removeEventListener('click', closeFan);
                };
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (wrap.classList.contains('open')) closeFan();
                    else {
                        wrap.classList.add('open');
                        setTimeout(() => document.addEventListener('click', closeFan), 0);
                    }
                });
                wrap.addEventListener('click', (e) => e.stopPropagation());
                fan.querySelectorAll('.deal-card-stage-pill').forEach((p) => p.addEventListener('click', () => closeFan()));
                return wrap;
            };

            const syncHidden = () => {
                hiddenClose.value = (selectedYear && selectedMonth) ? `${selectedYear}-${selectedMonth}` : '';
            };

            const monthFan = createCloseFan(monthOptions, month, 'Mo', (val) => {
                selectedMonth = val;
                syncHidden();
            });
            monthFan.classList.add('deal-card-close-month-fan');
            const yearFan = createCloseFan(yearOptions, year, 'Yr', (val) => {
                selectedYear = val;
                syncHidden();
            });
            yearFan.classList.add('deal-card-close-year-fan');

            closeWrap.appendChild(monthFan);
            closeWrap.appendChild(yearFan);
            closeWrap.appendChild(hiddenClose);
            closeEl.replaceWith(closeWrap);

            const termEl = footerEl.querySelector('.deal-card-term');
            const termOptions = [
                { value: '12', label: '12' },
                { value: '24', label: '24' },
                { value: '36', label: '36' },
                { value: '48', label: '48' },
                { value: '60', label: '60' }
            ];
            const termValue = (deal.term || '').replace(/\D/g, '') || '';
            const termHidden = document.createElement('input');
            termHidden.type = 'hidden';
            termHidden.className = 'deal-card-term-input';
            termHidden.dataset.field = 'term';
            termHidden.value = deal.term || '';
            const termFan = createCloseFan(termOptions, termValue, 'Term', (val) => {
                termHidden.value = val;
            });
            termFan.classList.add('deal-card-close-term-fan');
            const termWrap = document.createElement('div');
            termWrap.className = 'deal-card-term-fan-wrap';
            termWrap.appendChild(termFan);
            termWrap.appendChild(termHidden);
            termEl.replaceWith(termWrap);
        }

        const productsEl = card.querySelector('.deal-card-products');
        if (productsEl) {
            // In kanban edit mode, we don't need a text input anymore since they are toggles.
            // We just let the toggles work directly.
            // We can add a hidden input just to satisfy the getVal('products') logic.
            const input = document.createElement('input');
            input.type = 'hidden';
            input.className = 'deal-card-products-input';
            input.dataset.field = 'products';
            input.value = deal.products || '';
            productsEl.appendChild(input);
            
            // Add a listener to update the hidden input when pills are clicked in edit mode
            productsEl.addEventListener('click', (e) => {
                const pill = e.target.closest('.product-pill-toggle');
                if (pill) {
                    // Let the global handler handle the DB save, but we also update our hidden input
                    // wait a tick for the global handler to update the state
                    setTimeout(() => {
                        const updatedDeal = state.deals.find(d => d.id === deal.id);
                        if (updatedDeal) input.value = updatedDeal.products || '';
                    }, 50);
                }
            });
        }

        const editBtn = card.querySelector('.edit-deal-btn');
        if (editBtn) {
            editBtn.classList.remove('edit-deal-btn');
            editBtn.classList.add('deal-card-save-btn');
            editBtn.dataset.dealId = dealId;
            editBtn.title = 'Save';
            editBtn.innerHTML = '<i class="fas fa-check"></i>';
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn-icon btn-icon-sm deal-card-cancel-btn';
            cancelBtn.dataset.dealId = dealId;
            cancelBtn.title = 'Cancel';
            cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
            editBtn.parentNode.insertBefore(cancelBtn, editBtn);
        }
    }

    function exitDealEditMode(dealId, refresh = false) {
        if (refresh) {
            render();
            return;
        }
        const card = kanbanBoardView?.querySelector(`.kanban-card[data-id="${dealId}"]`);
        if (!card) return;
        card.classList.remove('deal-card-editing');
        render();
    }

    async function handleKanbanSaveDeal(dealId) {
        const card = kanbanBoardView?.querySelector(`.kanban-card[data-id="${dealId}"]`);
        if (!card) return;
        const getVal = (field) => {
            const el = card.querySelector(`[data-field="${field}"]`);
            return el ? el.value.trim() : '';
        };
        const name = getVal('name');
        if (!name) { showToast('Deal name is required', 'error'); return; }
        
        const mrcRaw = getVal('mrc');
        const mrc = mrcRaw ? parseFloat(mrcRaw) : 0;
        
        const dealData = {
            name,
            term: getVal('term'),
            stage: getVal('stage'),
            mrc: mrc,
            close_month: getVal('close_month') || null,
            products: getVal('products')
        };
        
        const { error } = await supabase.from('deals').update(dealData).eq('id', dealId);
        if (error) { showToast('Error saving deal', 'error'); return; }
        
        const dealMaster = state.deals.find(d => d.id === dealId);
        if (dealMaster) Object.assign(dealMaster, dealData);
        exitDealEditMode(dealId, true);
    }

    function getDealStageColorClass(stageName) {
        if (!stageName) return 'deal-stage-default';
        const s = (stageName || '').toLowerCase();
        if (s.includes('closed won') || s.includes('won')) return 'deal-stage-won';
        if (s.includes('closed lost') || s.includes('lost')) return 'deal-stage-lost';
        if (s.includes('discovery') || s.includes('qualification')) return 'deal-stage-discovery';
        if (s.includes('proposal') || s.includes('quote')) return 'deal-stage-proposal';
        if (s.includes('negotiation') || s.includes('contract')) return 'deal-stage-negotiation';
        return 'deal-stage-default';
    }

    function escapeNotesForHtml(notes) {
        if (!notes || !notes.trim()) return '';
        return (notes || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>');
    }

    const PRODUCT_FAMILIES = ['Internet', 'Ethernet', 'UC', 'PRI/SIP', 'SD-WAN', 'Firewall', '5G', 'Cloud Connect', 'Waves'];

    function getProductColor(productName) {
        const p = productName.toLowerCase().trim();
        if (p.includes('internet')) return { bg: '#93c5fd', border: '#3b82f6' };       // light blue fill, primary-blue border
        if (p.includes('ethernet')) return { bg: '#d1d5db', border: '#6b7280' };     // light gray, secondary-gray border
        if (p.includes('uc')) return { bg: '#c4b5fd', border: '#8b5cf6' };           // light purple, meeting-purple border
        if (p.includes('pri') || p.includes('sip')) return { bg: '#c4b5fd', border: '#8b5cf6' };
        if (p.includes('sdwan') || p.includes('sd-wan')) return { bg: '#fde68a', border: '#f59e0b' };
        if (p.includes('firewall')) return { bg: '#fca5a5', border: '#ef4444' };
        if (p.includes('5g')) return { bg: '#fde68a', border: '#f59e0b' };
        if (p.includes('cloud')) return { bg: '#f8fafc', border: '#e2e8f0' };  // white fill, light gray border
        if (p.includes('wave')) return { bg: '#86efac', border: '#22c55e' };
        if (p.includes('uncategorized')) return { bg: '#bfdbfe', border: '#60a5fa' };  // light blue fill, blue border
        return { bg: '#bfdbfe', border: '#60a5fa' };  // Uncategorized
    }

    function getProductClass(productName) {
        const p = productName.toLowerCase().trim();
        if (p.includes('internet')) return 'product-internet';
        if (p.includes('ethernet')) return 'product-ethernet';
        if (p.includes('uc')) return 'product-uc';
        if (p.includes('pri') || p.includes('sip')) return 'product-pri-sip';
        if (p.includes('sdwan') || p.includes('sd-wan')) return 'product-sdwan';
        if (p.includes('firewall')) return 'product-firewall';
        if (p.includes('5g')) return 'product-5g';
        if (p.includes('cloud')) return 'product-cloud';
        if (p.includes('wave')) return 'product-waves';
        return 'product-default';
    }

    function getProductPillHtml(dealId, productsString) {
        const activeProducts = (productsString || '').split(',').map(p => p.trim().toLowerCase()).filter(p => p);
        
        return `<div class="flex flex-wrap gap-1 mt-1 justify-start">
            ${PRODUCT_FAMILIES.map(p => {
                const isMatch = (ap) => ap === p.toLowerCase() || 
                                        (p === 'PRI/SIP' && (ap.includes('pri') || ap.includes('sip'))) || 
                                        (p === 'SD-WAN' && (ap.includes('sdwan') || ap.includes('sd-wan')));
                const isActive = activeProducts.some(isMatch);
                
                if (isActive) {
                    return `<span class="product-pill product-pill-toggle active cursor-pointer hover:opacity-80 transition-opacity ${getProductClass(p)}" data-deal-id="${dealId}" data-product="${p}" title="Remove ${p}">${p}</span>`;
                } else {
                    return `<span class="product-pill product-pill-toggle cursor-pointer hover:bg-[var(--bg-medium)] transition-colors" data-deal-id="${dealId}" data-product="${p}" style="background-color: transparent; color: var(--text-muted); border-color: var(--border-color);" title="Add ${p}">${p}</span>`;
                }
            }).join('')}
        </div>`;
    }

    const renderDealCard = (deal) => {
        const stageClass = getDealStageColorClass(deal.stage);
        const notes = (deal.notes || '').trim();
        const notesEscaped = escapeNotesForHtml(notes);
        
        const truncate = (str, max = 30) => {
            if (!str) return '';
            return str.length > max ? str.substring(0, max) + '...' : str;
        };
        
        const safeName = (deal.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeProducts = (deal.products || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        const frontContent = `
            <div class="deal-card-header">
                <div class="deal-card-commit-row">
                    <label class="deal-card-commit-toggle" for="deal-commit-${deal.id}">
                        <input type="checkbox" id="deal-commit-${deal.id}" class="deal-card-commit-input commit-deal-checkbox sr-only" data-deal-id="${deal.id}" ${deal.is_committed ? "checked" : ""}>
                        <span class="deal-card-commit-slider"></span>
                        <span class="deal-card-commit-label">Committed</span>
                    </label>
                    <span class="deal-card-stage">${deal.stage}</span>
                </div>
                <button type="button" class="btn-icon btn-icon-sm edit-deal-btn" data-deal-id="${deal.id}" title="Edit Deal"><i class="fas fa-pen"></i></button>
            </div>
            <div class="deal-card-value">$${deal.mrc || 0}/mo</div>
            <div class="deal-card-name" title="${safeName}">${truncate(safeName, 30)}</div>
            <div class="deal-card-products">${getProductPillHtml(deal.id, deal.products)}</div>
            <div class="deal-card-footer">
                ${deal.close_month ? `<span class="deal-card-close">${formatMonthYear(deal.close_month)}</span>` : '<span class="deal-card-close deal-card-empty"></span>'}
                ${deal.term ? `<span class="deal-card-term">Term: ${deal.term}</span>` : '<span class="deal-card-term deal-card-empty"></span>'}
            </div>
        `;
        const backContent = `
            <div class="deal-card-back-content">
                <div class="deal-card-back-body">${notesEscaped || '<span class="text-[var(--text-muted)]">No notes</span>'}</div>
                <button type="button" class="btn-icon btn-icon-sm deal-card-back-edit" data-deal-id="${deal.id}" title="Edit notes"><i class="fas fa-pen"></i></button>
            </div>`;
            
        return `
            <div class="kanban-card deal-card ${stageClass} deal-card-flippable" draggable="true" data-id="${deal.id}">
                <div class="deal-card-flip-inner">
                    <div class="deal-card-front">${frontContent}</div>
                    <div class="deal-card-back">${backContent}</div>
                </div>
            </div>`;
    };

    const renderDealsMetrics = () => {
        if (!metricCurrentCommit) return;
        const isManager = state.currentUser.user_metadata?.is_manager === true;
        const isMyTeamView = state.dealsViewMode === 'all' && isManager;
        if (metricCurrentCommitTitle && metricBestCaseTitle) {
            metricCurrentCommitTitle.textContent = isMyTeamView ? "My Team's Current Commit" : "My Current Commit";
            metricBestCaseTitle.textContent = isMyTeamView ? "My Team's Current Best Case" : "My Current Best Case";
        }
        const effectiveMonthlyQuota = isMyTeamView ? state.allUsersQuotas.reduce((sum, quota) => sum + (quota.monthly_quota || 0), 0) : state.currentUserQuota;
        if (commitTotalQuota && bestCaseTotalQuota) {
            if (isMyTeamView) {
                commitTotalQuota.textContent = formatCurrency(effectiveMonthlyQuota);
                bestCaseTotalQuota.textContent = formatCurrency(effectiveMonthlyQuota);
                commitTotalQuota.classList.remove('hidden');
                bestCaseTotalQuota.classList.remove('hidden');
            } else {
                commitTotalQuota.classList.add('hidden');
                bestCaseTotalQuota.classList.add('hidden');
            }
        }
        const filteredDeals = getFilteredDeals();
        const currentMonth = new Date().getMonth(), currentYear = new Date().getFullYear();
        let currentCommit = 0, bestCase = 0, closedWon = 0;
        filteredDeals.forEach((deal) => {
            const dealCloseDate = deal.close_month ? new Date(deal.close_month + '-02') : null;
            const isCurrentMonth = dealCloseDate && dealCloseDate.getMonth() === currentMonth && dealCloseDate.getFullYear() === currentYear;
            if (isCurrentMonth) {
                if (deal.stage === 'Closed Won') closedWon += deal.mrc || 0;
                else {
                    bestCase += deal.mrc || 0;
                    if (deal.is_committed) currentCommit += deal.mrc || 0;
                }
            }
        });
        const totalFunnel = filteredDeals.reduce((sum, deal) => sum + (deal.mrc || 0), 0);
        
        const openDeals = filteredDeals.filter(d => d.stage !== 'Closed Lost' && d.stage !== 'Closed Won');
        const totalOpenMrc = openDeals.reduce((sum, deal) => sum + (deal.mrc || 0), 0);
        const arpu = openDeals.length > 0 ? (totalOpenMrc / openDeals.length) : 0;
        const metricArpu = document.getElementById('metric-arpu');
        if (metricArpu) metricArpu.textContent = formatCurrency(arpu);

        metricCurrentCommit.textContent = formatCurrencyK(currentCommit);
        metricBestCase.textContent = formatCurrencyK(bestCase);
        metricFunnel.textContent = formatCurrencyK(totalFunnel);
        metricClosedWon.textContent = formatCurrencyK(closedWon);
        const commitPercentage = effectiveMonthlyQuota > 0 ? ((currentCommit / effectiveMonthlyQuota) * 100).toFixed(1) : 0;
        const bestCasePercentage = effectiveMonthlyQuota > 0 ? ((bestCase / effectiveMonthlyQuota) * 100).toFixed(1) : 0;
        document.getElementById("commit-quota-percent").textContent = `${commitPercentage}%`;
        document.getElementById("best-case-quota-percent").textContent = `${bestCasePercentage}%`;
    };

    async function saveDealField(dealId, field, value) {
        const deal = state.deals.find(d => d.id === dealId);
        if (!deal) return;
        const prev = deal[field];
        if (String(prev) === String(value)) return;
        if (field === 'name' && !value.trim()) return showToast('Deal name is required.', 'error');
        let updateVal = value;
        if (field === 'mrc') updateVal = parseFloat(value) || 0;
        if (field === 'account_id') updateVal = value ? Number(value) : null;
        const { error } = await supabase.from('deals').update({ [field]: updateVal }).eq('id', dealId);
        if (error) showToast('Error saving: ' + error.message, 'error');
        else {
            deal[field] = updateVal;
            if (field === 'account_id') deal.account_name = updateVal ? state.accounts.find(a => a.id === updateVal)?.name || 'N/A' : 'N/A';
            
            // If we just updated products, also update the product chart
            if (field === 'products') {
                renderDealsByProductChart();
            }
            
            renderDealsPage();
        }
    }
    function enterSelectMode(cell) {
        const dealId = Number(cell.dataset.dealId);
        const field = cell.dataset.field;
        const deal = state.deals.find(d => d.id === dealId);
        if (!deal) return;
        if (field === 'account_id') {
            const opts = state.accounts.sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(a =>
                `<option value="${a.id}" ${deal.account_id === a.id ? 'selected' : ''}>${(a.name||'').replace(/</g,'&lt;')}</option>`).join('');
            cell.innerHTML = `<select class="deal-inline-select"><option value="">--</option>${opts}</select>`;
            const sel = cell.querySelector('select');
            sel.focus();
            sel.onblur = async () => { const v = sel.value; await saveDealField(dealId, field, v); renderDealsPage(); };
            sel.onchange = () => { sel.blur(); };
        } else if (field === 'stage') {
            const stages = state.dealStages.sort((a, b) => a.sort_order - b.sort_order);
            const currentStage = deal.stage || '';
            const wrap = document.createElement('div');
            wrap.className = 'deal-card-stage-fan-wrap';
            
            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = `deal-card-stage-trigger ${getDealStageColorClass(currentStage)}`;
            trigger.textContent = currentStage || 'Stage';
            trigger.innerHTML = `${currentStage || 'Stage'} <i class="fas fa-chevron-down deal-card-stage-chevron"></i>`;
            wrap.appendChild(trigger);
            
            const fan = document.createElement('div');
            fan.className = 'deal-card-stage-fan';
            const total = stages.length;
            const spread = Math.min(120, Math.max(60, (total - 1) * 25));
            const startAngle = 90 + spread / 2;
            let isSaved = false;
            const closeFan = () => {
                wrap.classList.remove('open');
                document.removeEventListener('click', closeFan);
                if (!isSaved) setTimeout(() => renderDealsPage(), 150);
            };
            
            stages.forEach((s, i) => {
                const angle = total <= 1 ? 90 : startAngle - (spread * i) / (total - 1);
                const pill = document.createElement('button');
                pill.type = 'button';
                pill.className = `deal-card-stage-pill ${getDealStageColorClass(s.stage_name)}`;
                pill.textContent = s.stage_name;
                pill.dataset.stage = s.stage_name;
                pill.style.setProperty('--fan-angle', `${angle}deg`);
                pill.style.setProperty('--fan-i', `${i}`);
                pill.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    isSaved = true;
                    closeFan();
                    await saveDealField(dealId, field, s.stage_name);
                    renderDealsPage();
                });
                fan.appendChild(pill);
            });
            wrap.appendChild(fan);
            
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                if (wrap.classList.contains('open')) {
                    closeFan();
                } else {
                    wrap.classList.add('open');
                    setTimeout(() => document.addEventListener('click', closeFan), 0);
                }
            });
            wrap.addEventListener('click', (e) => e.stopPropagation());
            
            cell.innerHTML = '';
            cell.appendChild(wrap);
            
            // Auto open the fan
            trigger.click();
        }
    }
    function enterNumberMode(cell) {
        const dealId = Number(cell.dataset.dealId);
        const deal = state.deals.find(d => d.id === dealId);
        if (!deal) return;
        const val = deal.mrc || 0;
        cell.innerHTML = `<input type="number" class="deal-inline-input" value="${val}" min="0" step="0.01">`;
        const inp = cell.querySelector('input');
        inp.focus();
        inp.onblur = async () => { await saveDealField(dealId, 'mrc', inp.value); renderDealsPage(); };
    }
    function enterMonthMode(cell) {
        const dealId = Number(cell.dataset.dealId);
        const deal = state.deals.find(d => d.id === dealId);
        if (!deal) return;
        const val = deal.close_month || '';
        cell.innerHTML = `<input type="month" class="deal-inline-input" value="${val}">`;
        const inp = cell.querySelector('input');
        inp.focus();
        inp.onblur = async () => { await saveDealField(dealId, 'close_month', inp.value); renderDealsPage(); };
    }
    async function handleCommitDeal(dealId, isCommitted) {
        const { error } = await supabase.from('deals').update({ is_committed: isCommitted }).eq('id', dealId);
        if (error) {
            showToast('Error updating commit status: ' + error.message, 'error');
        } else {
            const deal = state.deals.find(d => d.id === dealId);
            if (deal) deal.is_committed = isCommitted;
            renderDealsMetrics();
            render();
        }
    }

    let tsAccountInstance = null, tsStageInstance = null;
    function initDealModalTomSelect(el, opts = {}) {
        if (!el || typeof window.TomSelect === 'undefined') return null;
        try {
            return new window.TomSelect(el, { create: false, ...opts });
        } catch (e) { return null; }
    }
    function handleEditDeal(dealId) {
        if (tsAccountInstance) { tsAccountInstance.destroy(); tsAccountInstance = null; }
        if (tsStageInstance) { tsStageInstance.destroy(); tsStageInstance = null; }
        const deal = state.deals.find(d => d.id === dealId);
        if (!deal) return;
        const stageOptions = state.dealStages.sort((a,b) => a.sort_order - b.sort_order).map(s => `<option value="${s.stage_name}" ${deal.stage === s.stage_name ? 'selected' : ''}>${s.stage_name}</option>`).join('');
        const accountOptions = state.accounts.sort((a,b) => (a.name || "").localeCompare(b.name || "")).map(acc => `<option value="${acc.id}" ${deal.account_id === acc.id ? 'selected' : ''}>${acc.name}</option>`).join('');
        const tsOpts = {
            maxItems: 1,
            render: { dropdown: () => { const d = document.createElement('div'); d.className = 'ts-dropdown tom-select-no-search'; return d; } }
        };
        const modalBody = showModal("Edit Deal", `
            <div class="modal-form">
                <label for="modal-deal-name">Deal Name</label>
                <input type="text" id="modal-deal-name" value="${(deal.name || '').replace(/"/g, '&quot;')}" required>
                <label for="modal-deal-account">Account</label>
                <select id="modal-deal-account" required>${accountOptions}</select>
                <label for="modal-deal-term">Term</label>
                <input type="text" id="modal-deal-term" value="${(deal.term || '').replace(/"/g, '&quot;')}" placeholder="e.g., 12 months">
                <label for="modal-deal-stage">Stage</label>
                <select id="modal-deal-stage" required>${stageOptions}</select>
                <label for="modal-deal-mrc">Monthly Recurring Revenue (MRC)</label>
                <input type="number" id="modal-deal-mrc" min="0" value="${deal.mrc || 0}">
                <label for="modal-deal-close-month">Close Month</label>
                <input type="month" id="modal-deal-close-month" value="${deal.close_month || ''}">
                <label for="modal-deal-products">Products</label>
                <textarea id="modal-deal-products" placeholder="List products, comma-separated">${(deal.products || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
            </div>
        `, async () => {
            const accEl = document.getElementById('modal-deal-account');
            const stageEl = document.getElementById('modal-deal-stage');
            const accountId = tsAccountInstance ? tsAccountInstance.getValue() : (accEl?.value ?? '');
            const stageVal = tsStageInstance ? tsStageInstance.getValue() : (stageEl?.value ?? '');
            const updatedDeal = {
                name: document.getElementById('modal-deal-name').value.trim(),
                account_id: Number(accountId),
                term: document.getElementById('modal-deal-term').value.trim(),
                stage: stageVal,
                mrc: parseFloat(document.getElementById('modal-deal-mrc').value) || 0,
                close_month: document.getElementById('modal-deal-close-month').value || null,
                products: document.getElementById('modal-deal-products').value.trim(),
            };
            if (!updatedDeal.name) { showToast('Deal name is required.', 'error'); return false; }
            const { error } = await supabase.from("deals").update(updatedDeal).eq("id", deal.id);
            if (error) { showToast("Error updating deal: " + error.message, 'error'); return false; }
            if (tsAccountInstance) { tsAccountInstance.destroy(); tsAccountInstance = null; }
            if (tsStageInstance) { tsStageInstance.destroy(); tsStageInstance = null; }
            await loadAllData();
        }, true, null, () => {
            if (tsAccountInstance) { tsAccountInstance.destroy(); tsAccountInstance = null; }
            if (tsStageInstance) { tsStageInstance.destroy(); tsStageInstance = null; }
        });
        if (modalBody) {
            const accSel = modalBody.querySelector('#modal-deal-account');
            const stageSel = modalBody.querySelector('#modal-deal-stage');
            if (accSel) tsAccountInstance = initDealModalTomSelect(accSel, tsOpts);
            if (stageSel) tsStageInstance = initDealModalTomSelect(stageSel, tsOpts);
        }
    }

    // NEW: Drag and Drop Logic
    const setupDragAndDrop = () => {
        const cards = document.querySelectorAll('.kanban-card');
        const columns = document.querySelectorAll('.kanban-column-body');
        let draggedCard = null;
        cards.forEach(card => {
            card.addEventListener('dragstart', () => {
                draggedCard = card;
                setTimeout(() => card.classList.add('dragging'), 0);
            });
            card.addEventListener('dragend', () => {
                draggedCard.classList.remove('dragging');
                draggedCard = null;
            });
        });
        columns.forEach(column => {
            column.addEventListener('dragover', e => {
                e.preventDefault();
                const afterElement = getDragAfterElement(column, e.clientY);
                if (afterElement == null) column.appendChild(draggedCard);
                else column.insertBefore(draggedCard, afterElement);
            });
            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                if (!draggedCard) return;
                const newStage = column.closest('.kanban-column').dataset.stage;
                const dealId = Number(draggedCard.dataset.id);
                const deal = state.deals.find(d => d.id === dealId);
                if (deal && deal.stage !== newStage) {
                    deal.stage = newStage; // Optimistic update
                    render(); // Re-render to update column totals
                    const { error } = await supabase.from('deals').update({ stage: newStage }).eq('id', dealId);
                    if (error) {
                        console.error("Error updating deal stage:", error);
                        showToast("Could not update deal stage. Please try again.", 'error');
                        await loadAllData();
                    }
                }
            });
        });
    };

    const getDragAfterElement = (container, y) => {
        const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    };

    async function handleProductPillToggle(pillElement) {
        const dealId = Number(pillElement.dataset.dealId);
        const productName = pillElement.dataset.product;
        const deal = state.deals.find(d => d.id === dealId);
        if (!deal || !productName) return;

        const isActive = pillElement.classList.contains('active');
        let currentProducts = (deal.products || '').split(',').map(p => p.trim()).filter(p => p);
        
        if (isActive) {
            // Remove the product
            currentProducts = currentProducts.filter(p => {
                const pLower = p.toLowerCase();
                const targetLower = productName.toLowerCase();
                if (targetLower === 'pri/sip') return !pLower.includes('pri') && !pLower.includes('sip');
                if (targetLower === 'sd-wan') return !pLower.includes('sdwan') && !pLower.includes('sd-wan');
                return pLower !== targetLower;
            });
        } else {
            // Add the product
            currentProducts.push(productName);
        }
        
        const newProductsString = currentProducts.join(', ');
        await saveDealField(dealId, 'products', newProductsString);
        
        // The saveDealField function calls renderDealsPage(), which re-renders the list view.
        // If we are in board view, we should re-render the board to update the card.
        if (state.currentView === 'board') {
            renderKanbanBoard();
        }
    }
    function setupPageEventListeners() {
        setupModalListeners();
        document.getElementById("logout-btn").addEventListener("click", async () => {
            await supabase.auth.signOut();
            window.location.href = "index.html";
        });

        document.querySelector("#deals-table thead").addEventListener("click", (e) => {
            const th = e.target.closest("th.sortable");
            if (!th) return;
            const sortKey = th.dataset.sort;
            if (state.dealsSortBy === sortKey) {
                state.dealsSortDir = state.dealsSortDir === "asc" ? "desc" : "asc";
            } else {
                state.dealsSortBy = sortKey;
                state.dealsSortDir = "asc";
            }
            renderDealsPage();
        });

        dealsTableBody.addEventListener("blur", (e) => {
            const cell = e.target.closest(".deal-cell-editable[contenteditable='true']");
            if (!cell) return;
            const dealId = Number(cell.dataset.dealId);
            const field = cell.dataset.field;
            const value = cell.textContent.trim();
            if (dealId && field) saveDealField(dealId, field, value);
        }, true);
        dealsTableBody.addEventListener("click", (e) => {
            const selectCell = e.target.closest(".deal-cell-select");
            const numCell = e.target.closest(".deal-cell-number");
            const monthCell = e.target.closest(".deal-cell-month");
            const productPill = e.target.closest(".product-pill-toggle");
            
            if (selectCell && !selectCell.querySelector("select")) enterSelectMode(selectCell);
            else if (numCell && !numCell.querySelector("input")) enterNumberMode(numCell);
            else if (monthCell && !monthCell.querySelector("input")) enterMonthMode(monthCell);
            else if (productPill) handleProductPillToggle(productPill);
        });
        
        dealsTableBody.addEventListener("change", (e) => {
            const commitCheck = e.target.closest(".commit-deal-checkbox");
            if (commitCheck) handleCommitDeal(Number(commitCheck.dataset.dealId), commitCheck.checked);
        });

        if (viewMyDealsBtn) {
            viewMyDealsBtn.addEventListener('click', async () => {
                state.dealsViewMode = 'mine';
                viewMyDealsBtn.classList.add('active');
                viewAllDealsBtn.classList.remove('active');
                await loadAllData();
            });
        }
        if (viewAllDealsBtn) {
            viewAllDealsBtn.addEventListener('click', async () => {
                const isManager = state.currentUser.user_metadata?.is_manager === true;
                if (!isManager) return showToast("You must be a manager to view all deals.", 'error');
                state.dealsViewMode = 'all';
                viewAllDealsBtn.classList.add('active');
                viewMyDealsBtn.classList.remove('active');
                await loadAllData();
            });
        }
        
        // NEW: Event listeners for the view toggle
        listViewBtn.addEventListener('click', () => handleViewToggle('list'));
        boardViewBtn.addEventListener('click', () => handleViewToggle('board'));

        if (filterStagePills) filterStagePills.addEventListener('click', (e) => { const p = e.target.closest('.deals-filter-pill'); if (p) { state.filterStage = p.dataset.value || ''; handleFilterChange(); } });
        if (filterCloseMonthPills) filterCloseMonthPills.addEventListener('click', (e) => { const p = e.target.closest('.deals-filter-pill'); if (p) { state.filterCloseMonth = p.dataset.value || ''; handleFilterChange(); } });
        if (closeMonthPrevBtn) closeMonthPrevBtn.addEventListener('click', () => { state.closeMonthOffset = Math.max(-12, state.closeMonthOffset - 1); handleFilterChange(); });
        if (closeMonthNextBtn) closeMonthNextBtn.addEventListener('click', () => { state.closeMonthOffset = Math.min(12, state.closeMonthOffset + 1); handleFilterChange(); });
        if (filterCloseMonthScroll) {
            filterCloseMonthScroll.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) { e.preventDefault(); state.closeMonthOffset = Math.max(-12, Math.min(12, state.closeMonthOffset + (e.deltaY > 0 ? 1 : -1))); handleFilterChange(); }
            }, { passive: false });
        }
        if (filterCommittedPills) filterCommittedPills.addEventListener('click', (e) => { const p = e.target.closest('.deals-filter-pill'); if (p) { state.filterCommitted = p.dataset.value || ''; handleFilterChange(); } });
        if (showClosedLostEl) {
            showClosedLostEl.addEventListener('change', () => { state.showClosedLost = showClosedLostEl.checked; localStorage.setItem('deals_show_closed_lost', state.showClosedLost); updateClosedLostToggleUI(); handleFilterChange(); });
            showClosedLostEl.closest('.deals-filter-toggle')?.addEventListener('click', (e) => { if (!e.target.closest('input')) { e.preventDefault(); showClosedLostEl.checked = !showClosedLostEl.checked; showClosedLostEl.dispatchEvent(new Event('change')); } });
        }
        if (dealsFiltersResetBtn) {
            dealsFiltersResetBtn.addEventListener('click', () => {
                state.filterStage = '';
                state.filterCloseMonth = '';
                state.filterCommitted = '';
                state.showClosedLost = false;
                state.closeMonthOffset = 0;
                localStorage.setItem('deals_show_closed_lost', false);
                handleFilterChange();
            });
        }
    }

    function handleFilterChange() {
        populateDealsFilters();
        render();
        renderDealsMetrics();
        renderDealsByStageChart();
        renderDealsByTimeChart();
    }
    
    // NEW: Handler for the view toggle
    const handleViewToggle = (view) => {
        state.currentView = view;
        localStorage.setItem('deals_view_mode', view);
        listViewBtn.classList.toggle('active', view === 'list');
        boardViewBtn.classList.toggle('active', view === 'board');
        render();
    };

    // --- App Initialization ---
    async function initializePage() {
        await loadSVGs();
        updateActiveNavLink();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            state.currentUser = session.user;
            await setupUserMenuAndAuth(supabase, state, { skipImpersonation: true });
            if (dealsViewToggleDiv) {
                const isManager = state.currentUser.user_metadata?.is_manager === true;
                dealsViewToggleDiv.classList.toggle('hidden', !isManager);
                if(isManager) {
                    viewMyDealsBtn.classList.add('active');
                    viewAllDealsBtn.classList.remove('active');
                }
            }
            setupPageEventListeners();
            await setupGlobalSearch(supabase, state.currentUser);
            await checkAndSetNotifications(supabase);
            
            // NEW: Load saved view from localStorage
            const savedView = localStorage.getItem('deals_view_mode') || 'list';
            state.currentView = savedView;
            listViewBtn.classList.toggle('active', savedView === 'list');
            boardViewBtn.classList.toggle('active', savedView === 'board');

            state.showClosedLost = localStorage.getItem('deals_show_closed_lost') === 'true';
            if (showClosedLostEl) showClosedLostEl.checked = state.showClosedLost;
            
            await loadAllData();
        } else {
            hideGlobalLoader();
            window.location.href = "index.html";
        }
    }

    initializePage();
});

