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
    
    const filterDataByCreationDate = (data, dateField) => data.filter(item => {
        if (!item[dateField]) return false;
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
    
    const activities = filterDataByCreationDate(state.analyticsData.activities, 'date');
    const sequences = filterDataByCreationDate(state.analyticsData.contact_sequences, 'last_completed_date');
    const campaigns = filterDataByCreationDate(state.analyticsData.campaigns, 'completed_at');
    const tasks = filterTasks(state.analyticsData.tasks);
    const newDeals = filterDataByCreationDate(state.analyticsData.deals, 'created_at');
    const closedWonDeals = state.analyticsData.deals.filter(d => {
        const userMatch = (userId === 'all' || d.user_id === userId);
        const userIncluded = usersForAnalytics.some(u => u.user_id === d.user_id);
        if (!d.updated_at) return false;
        const closedDate = new Date(d.updated_at);
        return userIncluded && userMatch && d.stage === 'Closed Won' && closedDate >= startDate && closedDate <= endDate;
    });

    const isIndividualView = (userId === 'all' && chartView === 'individual');
    
    document.querySelectorAll('.chart-container').forEach(container => {
        const metricCard = container.querySelector('.analytics-metric-card');
        const chartWrapper = container.querySelector('.chart-wrapper');
        const toggleBtn = container.querySelector('.chart-toggle-btn');
        
        if (isIndividualView) {
            metricCard.classList.add('hidden');
            chartWrapper.classList.remove('hidden');
            toggleBtn.classList.remove('hidden');
        } else {
            metricCard.classList.remove('hidden');
            chartWrapper.classList.add('hidden');
            toggleBtn.classList.add('hidden');
        }
    });

    document.getElementById('activities-metric').textContent = activities.length;
    document.getElementById('sequences-metric').textContent = sequences.length;
    document.getElementById('campaigns-metric').textContent = campaigns.length;
    document.getElementById('tasks-metric').textContent = tasks.length;
    document.getElementById('new-deals-metric').textContent = newDeals.length;
    document.getElementById('new-deals-value-metric').textContent = formatCurrencyK(newDeals.reduce((s, d) => s + (d.mrc || 0), 0));
    document.getElementById('closed-won-metric').textContent = formatCurrencyK(closedWonDeals.reduce((s, d) => s + (d.mrc || 0), 0));

    renderChart('activities-chart', groupByUser(activities), false);
    renderChart('sequences-chart', groupByUser(sequences), false);
    renderChart('campaigns-chart', groupByUser(campaigns), false);
    renderChart('tasks-chart', groupByUser(tasks), false);
    renderChart('new-deals-chart', groupByUser(newDeals), false);
    renderChart('new-deals-value-chart', groupByUser(newDeals, 'mrc'), true);
    renderChart('closed-won-chart', groupByUser(closedWonDeals, 'mrc'), true);
}

function renderChart(canvasId, data, isCurrency = false) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (state.charts[canvasId]) state.charts[canvasId].destroy();
    
    const chartData = Array.isArray(data) ? data : [data];
    const chartLabels = chartData.map(d => d.label);
    const chartValues = chartData.map(d => d.value);

    state.charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Total',
                data: chartValues,
                backgroundColor: 'rgba(74, 144, 226, 0.6)',
                borderColor: 'rgba(74, 144, 226, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) { label += ': '; }
                            let value = context.parsed.x;
                            label += isCurrency ? formatCurrencyK(value) : value;
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { color: 'var(--text-medium)' }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: 'var(--text-medium)',
                        callback: function(value) {
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


async function handleSaveUser(e) {
    const row = e.target.closest('tr');
    const userId = row.dataset.userId;
    const isManagerStatus = row.querySelector('.is-manager-checkbox').checked;
    const excludeReportingStatus = row.querySelector('.exclude-reporting-checkbox').checked;
    e.target.disabled = true;

    try {
        const { error: rpcError } = await supabase.rpc('set_user_metadata_admin', {
            target_user_id: userId,
            is_manager_status: isManagerStatus,
            exclude_status: excludeReportingStatus
        });
        if (rpcError) throw rpcError;

        const { error: quotaError } = await supabase.from('user_quotas').update({
            full_name: row.querySelector('.user-name-input').value.trim(),
            monthly_quota: parseInt(row.querySelector('.user-quota-input').value, 10) || 0
        }).eq('user_id', userId);
        if (quotaError) throw quotaError;
        
        alert(`User updated successfully!`);
    } catch (error) {
        alert(`Failed to save user: ${error.message}`);
    } finally {
        e.target.disabled = false;
        loadUserData();
    }
}

function handleInviteUser() {
    showModal(
        'Invite New User',
        `
            <label for="invite-email">Email:</label>
            <input type="email" id="invite-email" required>
        `,
        async () => {
            const email = document.getElementById('invite-email').value;
            if (!email) {
                alert('Email is required.');
                return false;
            }
            const { error } = await supabase.auth.admin.inviteUserByEmail(email);
            if (error) {
                alert('Error inviting user: ' + error.message);
                return false;
            }
            alert('User invited successfully!');
            return true;
        }
    );
}

function handleDeactivateUser(e) { showModal('Deactivate User', 'Feature coming soon!', null, false, '<button id="modal-ok-btn" class="btn-primary">OK</button>');}

async function handleContentToggle(e) {
    const row = e.target.closest('tr');
    const id = row.dataset.id;
    const type = row.dataset.type;
    const isShared = e.target.checked;
    const tableName = type === 'template' ? 'email_templates' : 'marketing_sequences';

    const { error } = await supabase.from(tableName).update({ is_shared: isShared }).eq('id', id);
    if (error) {
        alert(`Error updating status: ${error.message}`);
        e.target.checked = !isShared;
    } else {
        console.log(`${type} ${id} shared status set to ${isShared}`);
    }
}

async function handleDeleteContent(e) {
    const row = e.target.closest('tr');
    const id = row.dataset.id;
    const type = row.dataset.type;
    const tableName = type === 'template' ? 'email_templates' : 'marketing_sequences';
    const itemName = row.querySelector('td:first-child').textContent;
    
    showModal(`Confirm Deletion`, `Are you sure you want to delete "${itemName}"? This cannot be undone.`, async () => {
        const { error } = await supabase.from(tableName).delete().eq('id', id);
        if (error) {
            alert(`Error deleting ${type}: ${error.message}`);
        } else {
            alert(`${type} deleted successfully.`);
            loadContentData();
        }
        hideModal();
    });
}

function handleNavigation() {
    const hash = window.location.hash || '#user-management';
    state.currentView = hash.substring(1);
    document.querySelectorAll('.admin-nav').forEach(link => link.classList.remove('active'));
    document.querySelector(`.admin-nav[href="${hash}"]`)?.classList.add('active');
    document.querySelectorAll('.content-view').forEach(view => view.classList.add('hidden'));
    document.getElementById(`${state.currentView}-view`)?.classList.remove('hidden');
    loadAllDataForView();
}

function getDateRange(rangeKey) {
    const now = new Date();
    let startDate = new Date();
    const endDate = new Date(now);
    switch (rangeKey) {
        case 'this_month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'last_month': startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); endDate.setDate(0); break;
        case 'last_2_months': startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1); break;
        case 'this_fiscal_year': startDate = new Date(now.getFullYear(), 0, 1); break;
        case 'last_365_days': startDate.setDate(now.getDate() - 365); break;
    }
    return { startDate, endDate };
}

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
            const chartHeader = toggleBtn.closest('.chart-header');
            const container = chartHeader.closest('.chart-container');
            const canvas = container.querySelector('canvas');
            const tableView = container.querySelector('.chart-table-view');
            
            if (toggleBtn.dataset.view === 'chart') {
                const chartInstance = state.charts[canvas.id];
                if (chartInstance) {
                    const chartData = chartInstance.data.labels.map((label, index) => ({
                        label: label,
                        value: chartInstance.data.datasets[0].data[index]
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
