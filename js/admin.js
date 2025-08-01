// js/admin.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatDate,
    formatCurrencyK,
    setupModalListeners,
    showModal,
    hideModal,
    loadSVGs,
    setupUserMenuAndAuth
} from './shared_constants.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let state = {
    currentUser: null,
    allUsers: [],
    allTemplates: [],
    allSequences: [],
    activityLog: [],
    analyticsData: {},
    charts: {},
    currentView: 'user-management',
    contentView: 'templates',
    analyticsFilters: {
        userId: 'all',
        dateRange: 'this_month',
        chartView: 'combined'
    }
};

const loadAllDataForView = async () => {
    document.body.classList.add('loading');
    switch (state.currentView) {
        case 'user-management': await loadUserData(); break;
        case 'content-management': await loadContentData(); break;
        case 'analytics': await loadAnalyticsData(); break;
    }
    document.body.classList.remove('loading');
};

async function loadUserData() {
    const { data, error } = await supabase.from('admin_users_view').select('*');
    if (error) { alert(`Could not load user data: ${error.message}`); return; }
    state.allUsers = data || [];
    renderUserTable();
}

async function loadContentData() {
    const [ { data: t, error: tE }, { data: s, error: sE } ] = await Promise.all([
        supabase.from('email_templates').select('*, user_quotas(full_name)'),
        supabase.from('marketing_sequences').select('*, user_quotas(full_name)')
    ]);
    if (tE || sE) { alert('Error loading content.'); console.error(tE || sE); }
    state.allTemplates = t || [];
    state.allSequences = s || [];
    renderContentTable();
}

async function loadAnalyticsData() {
    const tablesToFetch = ['activities', 'contact_sequences', 'campaigns', 'tasks', 'deals'];
    
    const { data: users, error: userError } = await supabase.from('admin_users_view').select('*');
    if(userError) {
        alert('Could not load user data for analytics.');
        return;
    }
    state.allUsers = users || [];

    const { data: log, error: logError } = await supabase.from('admin_activity_log_view').select('*').order('activity_date', { ascending: false }).limit(200);
    if(logError) {
         alert('Could not load system activity log: ' + logError.message);
         state.activityLog = [];
    } else {
        state.activityLog = log || [];
    }

    const promises = tablesToFetch.map(table => supabase.from(table).select('*'));
    const results = await Promise.all(promises);

    results.forEach((result, index) => {
        const tableName = tablesToFetch[index];
        if (result.error) {
            console.error(`Error fetching analytics data for ${tableName}:`, result.error);
            state.analyticsData[tableName] = [];
        } else {
            state.analyticsData[tableName] = result.data || [];
        }
    });
    
    populateAnalyticsFilters();
    renderAnalyticsDashboard();
    renderActivityLogTable();
}

function renderUserTable() {
    // This function is complete and correct
    const tableBody = document.querySelector("#user-management-table tbody");
    if (!tableBody) return;
    tableBody.innerHTML = state.allUsers
        .sort((a, b) => (a.full_name || "z").localeCompare(b.full_name || "z"))
        .map(user => {
            const isSelf = user.user_id === state.currentUser.id;
            const deactivateBtn = isSelf ? '' : `<button class="btn-danger btn-sm deactivate-user-btn" data-user-id="${user.user_id}" data-user-name="${user.full_name}">Deactivate</button>`;
            return `
            <tr data-user-id="${user.user_id}">
                <td><input type="text" class="form-control user-name-input" value="${user.full_name || ''}"></td>
                <td>${user.email || 'N/A'}</td>
                <td>${user.last_login ? formatDate(user.last_login) : 'Never'}</td>
                <td><input type="number" class="form-control user-quota-input" value="${user.monthly_quota || 0}"></td>
                <td><input type="checkbox" class="is-manager-checkbox" ${user.is_manager ? 'checked' : ''} ${isSelf ? 'disabled' : ''}></td>
                <td><input type="checkbox" class="exclude-reporting-checkbox" ${user.exclude_from_reporting ? 'checked' : ''}></td>
                <td class="action-buttons">${deactivateBtn}<button class="btn-primary btn-sm save-user-btn">Save</button></td>
            </tr>`;
        }).join('');
}

function renderContentTable() {
    // This function is complete and correct
    const table = document.getElementById('content-management-table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (state.contentView === 'templates') {
        thead.innerHTML = `<tr><th>Template Name</th><th>Creator</th><th>Shared</th><th>Actions</th></tr>`;
        tbody.innerHTML = state.allTemplates.map(t => `
            <tr data-id="${t.id}" data-type="template">
                <td>${t.name}</td>
                <td>${t.user_quotas?.full_name || 'N/A'}</td>
                <td><input type="checkbox" class="share-toggle" ${t.is_shared ? 'checked' : ''}></td>
                <td><button class="btn-danger btn-sm delete-content-btn">Delete</button></td>
            </tr>`).join('');
    } else if (state.contentView === 'sequences') {
        thead.innerHTML = `<tr><th>Sequence Name</th><th>Creator</th><th>Shared</th><th>Actions</th></tr>`;
        tbody.innerHTML = state.allSequences.map(s => `
            <tr data-id="${s.id}" data-type="sequence">
                <td>${s.name}</td>
                <td>${s.user_quotas?.full_name || 'N/A'}</td>
                <td><input type="checkbox" class="share-toggle" ${s.is_shared ? 'checked' : ''}></td>
                <td><button class="btn-danger btn-sm delete-content-btn">Delete</button></td>
            </tr>`).join('');
    }
}

function renderActivityLogTable() {
    // This function is complete and correct
    const tableBody = document.querySelector("#activity-log-table tbody");
    if (!tableBody) return;
    tableBody.innerHTML = state.activityLog.map(log => `
        <tr>
            <td>${formatDate(log.activity_date)}</td>
            <td>${log.user_name}</td>
            <td>${log.activity_type}</td>
            <td>${log.description}</td>
            <td>${log.contact_name || 'N/A'}</td>
            <td>${log.account_name || 'N/A'}</td>
        </tr>`).join('');
}

function populateAnalyticsFilters() {
    // This function is complete and correct
    const repFilter = document.getElementById('analytics-rep-filter');
    repFilter.innerHTML = '<option value="all">All Reps</option>';
    state.allUsers.filter(u => !u.exclude_from_reporting).forEach(user => {
        repFilter.innerHTML += `<option value="${user.user_id}">${user.full_name}</option>`;
    });
}

function renderAnalyticsDashboard() {
    const { userId, dateRange, chartView } = state.analyticsFilters;
    const { startDate, endDate } = getDateRange(dateRange);
    const usersForAnalytics = state.allUsers.filter(u => !u.exclude_from_reporting);
    const filterData = (data, dateField) => data.filter(item => {
        const itemDate = new Date(item[dateField]);
        const userMatch = (userId === 'all' || item.user_id === userId);
        const userIncluded = usersForAnalytics.some(u => u.user_id === item.user_id);
        return userIncluded && userMatch && itemDate >= startDate && itemDate <= endDate;
    });
    const filterTasks = (data) => data.filter(t => {
        const userMatch = (userId === 'all' || t.user_id === userId);
        const userIncluded = usersForAnalytics.some(u => u.user_id === t.user_id);
        const isPastDue = new Date(t.due_date) < new Date();
        return userIncluded && userMatch && isPastDue && t.status === 'Pending';
    });
    const groupByUser = (data, valueField = null) => {
        return usersForAnalytics.map(user => {
            const userItems = data.filter(item => item.user_id === user.user_id);
            const value = valueField ? userItems.reduce((sum, item) => sum + (item[valueField] || 0), 0) : userItems.length;
            return { label: user.full_name, value };
        }).sort((a,b) => b.value - a.value);
    };
    
    // Calculate all metrics
    const activities = filterData(state.analyticsData.activities, 'date');
    const sequences = filterData(state.analyticsData.contact_sequences, 'created_at');
    const campaigns = filterData(state.analyticsData.campaigns, 'completed_at');
    const tasks = filterTasks(state.analyticsData.tasks);
    const newDeals = filterData(state.analyticsData.deals, 'created_at');
    const closedWonDeals = filterData(state.analyticsData.deals, 'updated_at').filter(d => d.stage === 'Closed Won' && new Date(d.updated_at) >= startDate && new Date(d.updated_at) <= endDate);

    // Update UI based on view mode (Combined vs Individual)
    const isIndividualView = (userId === 'all' && chartView === 'individual');
    
    document.querySelectorAll('.chart-container').forEach(container => {
        const metricCard = container.querySelector('.analytics-metric-card');
        const chartWrapper = container.querySelector('.chart-wrapper');
        
        if (isIndividualView) {
            metricCard.classList.add('hidden');
            chartWrapper.classList.remove('hidden');
        } else {
            metricCard.classList.remove('hidden');
            chartWrapper.classList.add('hidden');
        }
    });

    // Populate metric cards for Combined view
    document.getElementById('activities-metric').textContent = activities.length;
    document.getElementById('sequences-metric').textContent = sequences.length;
    document.getElementById('campaigns-metric').textContent = campaigns.length;
    document.getElementById('tasks-metric').textContent = tasks.length;
    document.getElementById('new-deals-metric').textContent = newDeals.length;
    document.getElementById('new-deals-value-metric').textContent = formatCurrencyK(newDeals.reduce((s, d) => s + (d.mrc || 0), 0));
    document.getElementById('closed-won-metric').textContent = formatCurrencyK(closedWonDeals.reduce((s, d) => s + (d.mrc || 0), 0));

    // Render charts (they will be hidden or visible based on the logic above)
    renderChart('activities-chart', groupByUser(activities));
    renderChart('sequences-chart', groupByUser(sequences));
    renderChart('campaigns-chart', groupByUser(campaigns));
    renderChart('tasks-chart', groupByUser(tasks));
    renderChart('new-deals-chart', groupByUser(newDeals));
    renderChart('new-deals-value-chart', groupByUser(newDeals, 'mrc'), true);
    renderChart('closed-won-chart', groupByUser(closedWonDeals, 'mrc'), true);
}

function renderChart(canvasId, data, isCurrency = false) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (state.charts[canvasId]) state.charts[canvasId].destroy();
    
    const isIndividual = Array.isArray(data);
    const chartLabels = isIndividual ? data.map(d => d.label) : [data.label];
    const chartData = isIndividual ? data.map(d => d.value) : [data.value];

    state.charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: chartLabels.join(', '),
                data: chartData,
                backgroundColor: 'rgba(74, 144, 226, 0.6)',
                borderColor: 'rgba(74, 144, 226, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: isIndividual ? 'y' : 'x',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) { label += ': '; }
                            let value = context.parsed.y || context.parsed.x;
                            label += isCurrency ? formatCurrencyK(value) : value;
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { display: false }, // Removed grid lines
                    ticks: {
                        color: 'var(--text-medium)',
                        callback: function(value, index) {
                            if (isIndividual) return this.getLabelForValue(value);
                            return isCurrency ? formatCurrencyK(value) : value;
                        }
                    }
                },
                x: {
                    grid: { display: false }, // Removed grid lines
                    ticks: {
                        color: 'var(--text-medium)',
                        callback: function(value) {
                            if (!isIndividual) return this.getLabelForValue(value);
                            return isCurrency ? formatCurrencyK(value) : value;
                        }
                    }
                }
            }
        }
    });
}

function renderTableForChart(containerId, data, isCurrency = false) {
    const container = document.getElementById(containerId);
    const tableView = container.querySelector('.chart-table-view');
    if (!tableView) return;

    let tableHtml = '<table><thead><tr><th>User</th><th>Value</th></tr></thead><tbody>';
    data.forEach(item => {
        tableHtml += `<tr><td>${item.label}</td><td>${isCurrency ? formatCurrencyK(item.value) : item.value}</td></tr>`;
    });
    tableHtml += '</tbody></table>';
    tableView.innerHTML = tableHtml;
}


async function handleSaveUser(e) { /* ... same as before ... */ }
function handleInviteUser() { /* ... same as before ... */ }
function handleDeactivateUser(e) { /* ... same as before ... */ }
async function handleContentToggle(e) { /* ... same as before ... */ }
async function handleDeleteContent(e) { /* ... same as before ... */ }
function handleNavigation() { /* ... same as before ... */ }
function getDateRange(rangeKey) { /* ... same as before ... */ }

function setupPageEventListeners() {
    window.addEventListener('hashchange', handleNavigation);
    
    document.getElementById('user-management-table')?.addEventListener('click', e => {
        if (e.target.matches('.save-user-btn')) handleSaveUser(e);
        if (e.target.matches('.deactivate-user-btn')) handleDeactivateUser(e);
    });
    
    document.getElementById('invite-user-btn')?.addEventListener('click', handleInviteUser);

    document.getElementById('content-management-table')?.addEventListener('change', e => {
        if (e.target.matches('.share-toggle')) handleContentToggle(e);
    });
    document.getElementById('content-management-table')?.addEventListener('click', e => {
        if (e.target.matches('.delete-content-btn')) handleDeleteContent(e);
    });
    document.querySelectorAll('.content-view-btn').forEach(btn => btn.addEventListener('click', e => {
        document.querySelectorAll('.content-view-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        state.contentView = e.target.id === 'view-templates-btn' ? 'templates' : 'sequences';
        renderContentTable();
    }));

    document.getElementById('analytics-rep-filter')?.addEventListener('change', e => {
        state.analyticsFilters.userId = e.target.value;
        document.getElementById('analytics-chart-view-toggle').style.display = e.target.value === 'all' ? 'flex' : 'none';
        renderAnalyticsDashboard();
    });
    document.getElementById('analytics-date-filter')?.addEventListener('change', e => {
        state.analyticsFilters.dateRange = e.target.value;
        renderAnalyticsDashboard();
    });
    document.getElementById('analytics-chart-view-toggle')?.addEventListener('click', e => {
        if (e.target.matches('button')) {
            document.querySelectorAll('#analytics-chart-view-toggle button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.analyticsFilters.chartView = e.target.id === 'view-individual-btn' ? 'individual' : 'combined';
            renderAnalyticsDashboard();
        }
    });

    document.getElementById('analytics-charts-container').addEventListener('click', e => {
        const toggleBtn = e.target.closest('.chart-toggle-btn');
        if (toggleBtn) {
            const container = toggleBtn.closest('.chart-wrapper');
            const canvas = container.querySelector('canvas');
            const tableView = container.querySelector('.chart-table-view');
            
            if (toggleBtn.dataset.view === 'chart') {
                // Generate and show table
                const chartInstance = state.charts[canvas.id];
                if (chartInstance) {
                    const chartData = chartInstance.data.labels.map((label, index) => ({
                        label: label,
                        value: chartInstance.data.datasets[0].data[index]
                    }));
                    const isCurrency = canvas.id.includes('value') || canvas.id.includes('won');
                    renderTableForChart(canvas.id.replace('-chart', '-chart-container'), chartData, isCurrency);
                }
                canvas.classList.add('hidden');
                tableView.classList.remove('hidden');
                toggleBtn.dataset.view = 'table';
                toggleBtn.innerHTML = '<i class="fas fa-chart-bar"></i>';
            } else {
                // Show chart
                canvas.classList.remove('hidden');
                tableView.classList.add('hidden');
                toggleBtn.dataset.view = 'chart';
                toggleBtn.innerHTML = '<i class="fas fa-table"></i>';
            }
        }
    });
}

async function initializePage() {
    setupModalListeners();
    await loadSVGs();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }
    state.currentUser = session.user;
    if (state.currentUser.user_metadata?.is_admin !== true) {
        alert("Access Denied: You must be an admin to view this page.");
        window.location.href = "command-center.html";
        return;
    }
    await setupUserMenuAndAuth(supabase, state);
    setupPageEventListeners();
    handleNavigation();
}

initializePage();
