import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatCurrencyK,
    formatDate,
    loadSVGs,
    initializeAppState,
    hideGlobalLoader,
    injectGlobalNavigation,
    setupUserMenuAndAuth,
    setupGlobalSearch,
    checkAndSetNotifications,
    updateActiveNavLink,
    showToast,
} from './shared_constants.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
    currentUser: null,
    allUsers: [],
    charts: {},
    filters: {
        userId: 'all',
        dateRange: 'this_month',
        chartView: 'combined',
    },
    data: {
        activities: [],
        tasks: [],
        deals: [],
        contact_sequences: [],
        sequences: [],
        campaigns: [],
        campaign_members: [],
        cognito_alerts: [],
        accounts: [],
        contacts: [],
        account_plans: [],
    },
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isUserDeactivated(user) {
    return Boolean(user?.deactivated_at);
}

function getReportableUsers() {
    return state.allUsers.filter((u) => !u.exclude_from_reporting && !isUserDeactivated(u));
}

function getDateRange(rangeKey) {
    const now = new Date();
    let startDate = new Date();
    const endDate = new Date(now);
    switch (rangeKey) {
        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'last_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate.setDate(0);
            break;
        case 'last_2_months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            break;
        case 'this_fiscal_year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        case 'last_365_days':
            startDate.setDate(now.getDate() - 365);
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { startDate, endDate };
}

function userMatchesFilter(userId) {
    const { userId: selected } = state.filters;
    return selected === 'all' || userId === selected;
}

function isUserIncluded(userId) {
    return getReportableUsers().some((u) => u.user_id === userId);
}

function inDateRange(value, startDate, endDate) {
    if (!value) return false;
    const itemDate = new Date(value);
    return itemDate >= startDate && itemDate <= endDate;
}

function filterByUserAndDate(rows, dateField) {
    const { startDate, endDate } = getDateRange(state.filters.dateRange);
    return (rows || []).filter((item) => {
        if (!isUserIncluded(item.user_id) || !userMatchesFilter(item.user_id)) return false;
        return inDateRange(item[dateField], startDate, endDate);
    });
}

function groupByUser(data, valueField = null) {
    return getReportableUsers()
        .map((user) => {
            const userItems = data.filter((item) => item.user_id === user.user_id);
            const value = valueField
                ? userItems.reduce((sum, item) => sum + (item[valueField] || 0), 0)
                : userItems.length;
            return { label: user.full_name || user.email || 'Unknown', value };
        })
        .sort((a, b) => b.value - a.value);
}

function kpiHtml(items) {
    return items
        .map(
            (item) => `
        <div class="insights-kpi">
            <p class="insights-kpi-label">${escapeHtml(item.label)}</p>
            <p class="insights-kpi-value">${escapeHtml(String(item.value))}</p>
        </div>`
        )
        .join('');
}

function emptyRow(colspan, message) {
    return `<tr><td colspan="${colspan}" class="insights-empty">${escapeHtml(message)}</td></tr>`;
}

async function loadUsers() {
    const { data: rpcUsers, error: rpcError } = await supabase.rpc('get_admin_users');
    if (!rpcError && Array.isArray(rpcUsers) && rpcUsers.length) {
        state.allUsers = rpcUsers;
        return;
    }

    const { data, error } = await supabase
        .from('user_quotas')
        .select('user_id, full_name, monthly_quota, is_manager, exclude_from_reporting, deactivated_at');
    if (error) {
        console.error('[insights] user load failed:', error);
        state.allUsers = [];
        return;
    }
    state.allUsers = (data || []).map((u) => ({ ...u, email: null }));
}

async function loadInsightsData() {
    document.body.classList.add('loading');
    try {
        await loadUsers();

        const fetches = [
            ['activities', supabase.from('activities').select('*')],
            ['tasks', supabase.from('tasks').select('*')],
            ['deals', supabase.from('deals').select('*')],
            ['contact_sequences', supabase.from('contact_sequences').select('*')],
            ['sequences', supabase.from('sequences').select('id, name, user_id')],
            ['campaigns', supabase.from('campaigns').select('*')],
            ['campaign_members', supabase.from('campaign_members').select('*')],
            ['cognito_alerts', supabase.from('cognito_alerts').select('*')],
            ['accounts', supabase.from('accounts').select('id, user_id, name')],
            ['contacts', supabase.from('contacts').select('id, user_id, account_id')],
            ['account_plans', supabase.from('account_plans').select('id, account_id, updated_at, created_by, plan')],
        ];

        const results = await Promise.all(fetches.map(([, query]) => query));
        results.forEach((result, index) => {
            const key = fetches[index][0];
            if (result.error) {
                console.error(`[insights] failed to load ${key}:`, result.error);
                state.data[key] = [];
            } else {
                state.data[key] = result.data || [];
            }
        });

        populateFilters();
        renderAll();
    } catch (error) {
        console.error('[insights] load failed:', error);
        showToast(`Unable to load Insights: ${error.message || 'Unknown error'}`, 'error');
    } finally {
        document.body.classList.remove('loading');
    }
}

function populateFilters() {
    const repFilter = document.getElementById('insights-rep-filter');
    if (!repFilter) return;
    const current = state.filters.userId;
    repFilter.innerHTML = '<option value="all">All Reps</option>';
    getReportableUsers()
        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
        .forEach((user) => {
            repFilter.innerHTML += `<option value="${user.user_id}">${escapeHtml(user.full_name || 'Unnamed')}</option>`;
        });
    repFilter.value = [...repFilter.options].some((o) => o.value === current) ? current : 'all';
    state.filters.userId = repFilter.value;
    const toggle = document.getElementById('insights-chart-view-toggle');
    if (toggle) toggle.style.display = state.filters.userId === 'all' ? 'flex' : 'none';
}

function renderChart(canvasId, data, isCurrency = false) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;
    if (state.charts[canvasId]) state.charts[canvasId].destroy();

    const chartData = Array.isArray(data) ? data : [data];
    state.charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.map((d) => d.label),
            datasets: [
                {
                    label: 'Total',
                    data: chartData.map((d) => d.value),
                    backgroundColor: 'rgba(74, 144, 226, 0.6)',
                    borderColor: 'rgba(74, 144, 226, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                },
            ],
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const value = context.parsed.x;
                            return `${context.label || ''}: ${isCurrency ? formatCurrencyK(value) : value}`;
                        },
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { color: 'var(--text-medium)' },
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: 'var(--text-medium)',
                        callback(value) {
                            return isCurrency ? formatCurrencyK(value) : value;
                        },
                    },
                },
            },
        },
    });
}

function renderTableForChart(containerId, data, isCurrency = false) {
    const container = document.getElementById(containerId);
    const tableView = container?.querySelector('.chart-table-view');
    if (!tableView) return;
    tableView.innerHTML = `
        <table>
            <thead><tr><th>User</th><th>Value</th></tr></thead>
            <tbody>
                ${data
                    .map(
                        (item) =>
                            `<tr><td>${escapeHtml(item.label)}</td><td>${
                                isCurrency ? formatCurrencyK(item.value) : item.value
                            }</td></tr>`
                    )
                    .join('')}
            </tbody>
        </table>`;
}

function renderCoreKpis() {
    const { userId, chartView } = state.filters;
    const { startDate, endDate } = getDateRange(state.filters.dateRange);
    const reportable = getReportableUsers();

    const activities = filterByUserAndDate(state.data.activities, 'date');
    const tasks = (state.data.tasks || []).filter((t) => {
        if (!isUserIncluded(t.user_id) || !userMatchesFilter(t.user_id)) return false;
        return t.status === 'Pending' && t.due_date && new Date(t.due_date) < new Date();
    });
    const newDeals = filterByUserAndDate(state.data.deals, 'created_at');
    const closedWonDeals = (state.data.deals || []).filter((d) => {
        if (!isUserIncluded(d.user_id) || !userMatchesFilter(d.user_id)) return false;
        if (!d.close_month || d.stage !== 'Closed Won') return false;
        const closedDate = new Date(`${d.close_month}-02`);
        return closedDate >= startDate && closedDate <= endDate;
    });

    const closedWonValue = closedWonDeals.reduce((s, d) => s + (d.mrc || 0), 0);
    const quotaBaseUsers =
        userId === 'all' ? reportable : reportable.filter((u) => u.user_id === userId);
    const totalQuota = quotaBaseUsers.reduce((s, u) => s + (Number(u.monthly_quota) || 0), 0);
    const quotaPct = totalQuota > 0 ? Math.round((closedWonValue / totalQuota) * 100) : 0;

    const isIndividualView = userId === 'all' && chartView === 'individual';
    document.querySelectorAll('#insights-core-charts .chart-container').forEach((container) => {
        const metricCard = container.querySelector('.analytics-metric-card');
        const chartWrapper = container.querySelector('.chart-wrapper');
        const toggleBtn = container.querySelector('.chart-toggle-btn');
        if (isIndividualView) {
            metricCard?.classList.add('hidden');
            chartWrapper?.classList.remove('hidden');
            toggleBtn?.classList.remove('hidden');
        } else {
            metricCard?.classList.remove('hidden');
            chartWrapper?.classList.add('hidden');
            toggleBtn?.classList.add('hidden');
        }
    });

    document.getElementById('insights-activities-metric').textContent = String(activities.length);
    document.getElementById('insights-tasks-metric').textContent = String(tasks.length);
    document.getElementById('insights-new-deals-metric').textContent = String(newDeals.length);
    document.getElementById('insights-new-deals-value-metric').textContent = formatCurrencyK(
        newDeals.reduce((s, d) => s + (d.mrc || 0), 0)
    );
    document.getElementById('insights-closed-won-metric').textContent = formatCurrencyK(closedWonValue);
    document.getElementById('insights-quota-metric').textContent = `${quotaPct}%`;
    document.getElementById('insights-quota-caption').textContent =
        totalQuota > 0
            ? `${formatCurrencyK(closedWonValue)} closed won vs ${formatCurrencyK(totalQuota)} monthly quota`
            : 'No monthly quota configured for selected reps';

    const quotaByUser = reportable
        .map((user) => {
            const won = closedWonDeals
                .filter((d) => d.user_id === user.user_id)
                .reduce((s, d) => s + (d.mrc || 0), 0);
            const quota = Number(user.monthly_quota) || 0;
            return {
                label: user.full_name || 'Unknown',
                value: quota > 0 ? Math.round((won / quota) * 100) : 0,
            };
        })
        .sort((a, b) => b.value - a.value);

    renderChart('insights-activities-chart', groupByUser(activities), false);
    renderChart('insights-tasks-chart', groupByUser(tasks), false);
    renderChart('insights-new-deals-chart', groupByUser(newDeals), false);
    renderChart('insights-new-deals-value-chart', groupByUser(newDeals, 'mrc'), true);
    renderChart('insights-closed-won-chart', groupByUser(closedWonDeals, 'mrc'), true);
    renderChart('insights-quota-chart', quotaByUser, false);
}

function renderSequenceHealth() {
    const { startDate, endDate } = getDateRange(state.filters.dateRange);
    const seqMap = new Map((state.data.sequences || []).map((s) => [s.id, s.name || `Sequence #${s.id}`]));
    const rows = (state.data.contact_sequences || []).filter((cs) => {
        if (!isUserIncluded(cs.user_id) || !userMatchesFilter(cs.user_id)) return false;
        const stamp = cs.last_completed_date || cs.created_at || cs.next_step_due_date;
        if (!stamp) return cs.status === 'Active';
        return inDateRange(stamp, startDate, endDate) || cs.status === 'Active';
    });

    const now = new Date();
    const active = rows.filter((r) => r.status === 'Active');
    const completed = rows.filter((r) => r.status === 'Completed');
    const removed = rows.filter((r) => r.status === 'Removed');
    const overdue = active.filter((r) => r.next_step_due_date && new Date(r.next_step_due_date) < now);

    document.getElementById('insights-sequence-kpis').innerHTML = kpiHtml([
        { label: 'Active', value: active.length },
        { label: 'Completed', value: completed.length },
        { label: 'Removed', value: removed.length },
        { label: 'Overdue', value: overdue.length },
    ]);

    const bySeq = new Map();
    rows.forEach((cs) => {
        const key = cs.sequence_id || 'unknown';
        if (!bySeq.has(key)) {
            bySeq.set(key, { name: seqMap.get(key) || `Sequence #${key}`, active: 0, completed: 0, removed: 0, overdue: 0 });
        }
        const bucket = bySeq.get(key);
        if (cs.status === 'Active') {
            bucket.active += 1;
            if (cs.next_step_due_date && new Date(cs.next_step_due_date) < now) bucket.overdue += 1;
        } else if (cs.status === 'Completed') bucket.completed += 1;
        else if (cs.status === 'Removed') bucket.removed += 1;
    });

    const ranked = [...bySeq.values()].sort(
        (a, b) => b.active + b.completed + b.removed - (a.active + a.completed + a.removed)
    );
    const tbody = document.querySelector('#insights-sequence-table tbody');
    if (!tbody) return;
    if (!ranked.length) {
        tbody.innerHTML = emptyRow(5, 'No sequence enrollments in this period.');
        return;
    }
    tbody.innerHTML = ranked
        .slice(0, 12)
        .map(
            (row) => `
        <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${row.active}</td>
            <td>${row.completed}</td>
            <td>${row.removed}</td>
            <td>${row.overdue}</td>
        </tr>`
        )
        .join('');
}

function renderCampaigns() {
    const campaigns = filterByUserAndDate(state.data.campaigns, 'created_at');
    const campaignIds = new Set(campaigns.map((c) => c.id));
    const members = (state.data.campaign_members || []).filter((m) => {
        if (!campaignIds.has(m.campaign_id)) return false;
        if (!isUserIncluded(m.user_id) || !userMatchesFilter(m.user_id)) return false;
        return true;
    });
    const completedMembers = members.filter((m) => m.status === 'Completed');
    const rate = members.length ? Math.round((completedMembers.length / members.length) * 100) : 0;

    document.getElementById('insights-campaign-kpis').innerHTML = kpiHtml([
        { label: 'Campaigns', value: campaigns.length },
        { label: 'Members', value: members.length },
        { label: 'Completed', value: completedMembers.length },
        { label: 'Completion', value: `${rate}%` },
    ]);

    const byCampaign = campaigns
        .map((campaign) => {
            const cm = members.filter((m) => m.campaign_id === campaign.id);
            const done = cm.filter((m) => m.status === 'Completed').length;
            const pct = cm.length ? Math.round((done / cm.length) * 100) : 0;
            return {
                name: campaign.name || `Campaign #${campaign.id}`,
                members: cm.length,
                completed: done,
                rate: pct,
            };
        })
        .sort((a, b) => b.members - a.members);

    const tbody = document.querySelector('#insights-campaign-table tbody');
    if (!tbody) return;
    if (!byCampaign.length) {
        tbody.innerHTML = emptyRow(4, 'No campaigns in this period.');
        return;
    }
    tbody.innerHTML = byCampaign
        .slice(0, 12)
        .map(
            (row) => `
        <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${row.members}</td>
            <td>${row.completed}</td>
            <td>${row.rate}%</td>
        </tr>`
        )
        .join('');
}

function renderCognitoOutreach() {
    const { startDate, endDate } = getDateRange(state.filters.dateRange);
    const alerts = (state.data.cognito_alerts || []).filter((alert) => {
        if (!isUserIncluded(alert.user_id) || !userMatchesFilter(alert.user_id)) return false;
        return inDateRange(alert.created_at, startDate, endDate);
    });
    const activities = (state.data.activities || []).filter(
        (a) => isUserIncluded(a.user_id) && userMatchesFilter(a.user_id)
    );

    let converted = 0;
    const byStatus = new Map();
    alerts.forEach((alert) => {
        const status = alert.status || 'Unknown';
        if (!byStatus.has(status)) byStatus.set(status, { status, triggers: 0, converted: 0 });
        const bucket = byStatus.get(status);
        bucket.triggers += 1;
        const alertTime = new Date(alert.created_at).getTime();
        const matched = activities.some((activity) => {
            if (activity.account_id !== alert.account_id || !activity.date) return false;
            return new Date(activity.date).getTime() >= alertTime;
        });
        if (matched) {
            bucket.converted += 1;
            converted += 1;
        }
    });

    const conversionRate = alerts.length ? Math.round((converted / alerts.length) * 100) : 0;
    document.getElementById('insights-cognito-kpis').innerHTML = kpiHtml([
        { label: 'Triggers', value: alerts.length },
        { label: 'Converted', value: converted },
        { label: 'Conversion', value: `${conversionRate}%` },
    ]);

    const tbody = document.querySelector('#insights-cognito-table tbody');
    if (!tbody) return;
    const rows = [...byStatus.values()].sort((a, b) => b.triggers - a.triggers);
    if (!rows.length) {
        tbody.innerHTML = emptyRow(3, 'No Cognito triggers in this period.');
        return;
    }
    tbody.innerHTML = rows
        .map(
            (row) => `
        <tr>
            <td>${escapeHtml(row.status)}</td>
            <td>${row.triggers}</td>
            <td>${row.converted}</td>
        </tr>`
        )
        .join('');
}

function renderSaosSnapshot() {
    const accounts = (state.data.accounts || []).filter(
        (a) => isUserIncluded(a.user_id) && userMatchesFilter(a.user_id)
    );
    const accountIds = new Set(accounts.map((a) => a.id));
    const plans = (state.data.account_plans || []).filter((p) => accountIds.has(p.account_id));
    const coveredIds = new Set(plans.map((p) => p.account_id));
    const coverage = accounts.length ? Math.round((coveredIds.size / accounts.length) * 100) : 0;
    const staleCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const stale = plans.filter((p) => p.updated_at && new Date(p.updated_at).getTime() < staleCutoff).length;

    document.getElementById('insights-saos-kpis').innerHTML = kpiHtml([
        { label: 'Team Accounts', value: accounts.length },
        { label: 'Active Plans', value: coveredIds.size },
        { label: 'Coverage', value: `${coverage}%` },
        { label: 'Stale 14+ Days', value: stale },
    ]);
}

function renderPenetration() {
    const { startDate, endDate } = getDateRange(state.filters.dateRange);
    const accounts = (state.data.accounts || []).filter(
        (a) => isUserIncluded(a.user_id) && userMatchesFilter(a.user_id)
    );
    const contactsByAccount = new Map();
    (state.data.contacts || []).forEach((c) => {
        contactsByAccount.set(c.account_id, (contactsByAccount.get(c.account_id) || 0) + 1);
    });

    const activityByAccount = new Map();
    (state.data.activities || []).forEach((activity) => {
        if (!activity.account_id || !activity.date) return;
        if (!isUserIncluded(activity.user_id)) return;
        const stamp = new Date(activity.date);
        if (stamp < startDate || stamp > endDate) return;
        const prev = activityByAccount.get(activity.account_id);
        if (!prev || stamp > prev) activityByAccount.set(activity.account_id, stamp);
    });

    const ownerName = (userId) =>
        state.allUsers.find((u) => u.user_id === userId)?.full_name || 'Unknown';

    const low = accounts
        .filter((account) => !activityByAccount.has(account.id))
        .map((account) => {
            const allActs = (state.data.activities || [])
                .filter((a) => a.account_id === account.id && a.date)
                .map((a) => new Date(a.date))
                .sort((a, b) => b - a);
            return {
                name: account.name || `Account #${account.id}`,
                owner: ownerName(account.user_id),
                contacts: contactsByAccount.get(account.id) || 0,
                lastActivity: allActs[0] || null,
            };
        })
        .sort((a, b) => b.contacts - a.contacts)
        .slice(0, 25);

    const tbody = document.querySelector('#insights-penetration-table tbody');
    if (!tbody) return;
    if (!low.length) {
        tbody.innerHTML = emptyRow(4, 'Every reportable account has activity in this period.');
        return;
    }
    tbody.innerHTML = low
        .map(
            (row) => `
        <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.owner)}</td>
            <td>${row.contacts}</td>
            <td>${row.lastActivity ? escapeHtml(formatDate(row.lastActivity.toISOString())) : 'Never'}</td>
        </tr>`
        )
        .join('');
}

function renderAll() {
    renderCoreKpis();
    renderSequenceHealth();
    renderCampaigns();
    renderCognitoOutreach();
    renderSaosSnapshot();
    renderPenetration();
}

function setupEventListeners() {
    document.getElementById('insights-refresh-btn')?.addEventListener('click', () => {
        loadInsightsData();
    });

    document.getElementById('insights-rep-filter')?.addEventListener('change', (e) => {
        state.filters.userId = e.target.value;
        const toggle = document.getElementById('insights-chart-view-toggle');
        if (toggle) toggle.style.display = e.target.value === 'all' ? 'flex' : 'none';
        renderAll();
    });

    document.getElementById('insights-date-filter')?.addEventListener('change', (e) => {
        state.filters.dateRange = e.target.value;
        renderAll();
    });

    document.getElementById('insights-chart-view-toggle')?.addEventListener('click', (e) => {
        if (!e.target.matches('button')) return;
        document.querySelectorAll('#insights-chart-view-toggle button').forEach((b) => b.classList.remove('active'));
        e.target.classList.add('active');
        state.filters.chartView =
            e.target.id === 'insights-view-individual-btn' ? 'individual' : 'combined';
        renderAll();
    });

    document.getElementById('insights-core-charts')?.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.chart-toggle-btn');
        if (!toggleBtn) return;
        const container = toggleBtn.closest('.chart-container');
        const canvas = container?.querySelector('canvas');
        const tableView = container?.querySelector('.chart-table-view');
        if (!canvas || !tableView) return;

        if (toggleBtn.dataset.view === 'chart') {
            const chartInstance = state.charts[canvas.id];
            if (chartInstance) {
                const chartData = chartInstance.data.labels.map((label, index) => ({
                    label,
                    value: chartInstance.data.datasets[0].data[index],
                }));
                const isCurrency = canvas.id.includes('value') || canvas.id.includes('won');
                renderTableForChart(container.id, chartData, isCurrency);
            }
            canvas.classList.add('hidden');
            tableView.classList.remove('hidden');
            toggleBtn.dataset.view = 'table';
            toggleBtn.innerHTML = '<i class="fas fa-chart-bar"></i>';
        } else {
            canvas.classList.remove('hidden');
            tableView.classList.add('hidden');
            toggleBtn.dataset.view = 'chart';
            toggleBtn.innerHTML = '<i class="fas fa-table"></i>';
        }
    });
}

async function initializePage() {
    injectGlobalNavigation();
    await loadSVGs();
    const appState = await initializeAppState(supabase);
    if (!appState.currentUser) {
        hideGlobalLoader();
        window.location.href = 'index.html';
        return;
    }

    state.currentUser = appState.currentUser;
    const isAdmin = state.currentUser.user_metadata?.is_admin === true;
    const canAccess = appState.isManager === true || isAdmin;

    await setupUserMenuAndAuth(supabase, appState);
    await setupGlobalSearch(supabase, state.currentUser);
    await checkAndSetNotifications(supabase);
    updateActiveNavLink();
    setupEventListeners();

    const denied = document.getElementById('insights-access-denied');
    const content = document.getElementById('insights-content');

    if (!canAccess) {
        denied?.classList.remove('hidden');
        content?.classList.add('hidden');
        hideGlobalLoader();
        window.location.href = 'command-center.html';
        return;
    }

    denied?.classList.add('hidden');
    content?.classList.remove('hidden');
    await loadInsightsData();
    hideGlobalLoader();
}

initializePage();
