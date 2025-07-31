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
    activityLog: [],
    analyticsData: {},
    charts: {},
    currentView: 'user-management',
    analyticsFilters: {
        userId: 'all',
        dateRange: 'this_month'
    }
};

// --- DATA FETCHING ---
const loadAllDataForView = async () => {
    switch (state.currentView) {
        case 'user-management': await loadUserData(); break;
        case 'activity-log': await loadActivityLogData(); break;
        case 'analytics': await loadAnalyticsData(); break;
    }
};

async function loadUserData() {
    const { data, error } = await supabase.rpc('get_all_users_with_last_login');
    if (error) { alert(`Could not load user data: ${error.message}`); return; }
    state.allUsers = data || [];
    renderUserTable();
}

async function loadActivityLogData() {
    const { data, error } = await supabase.rpc('get_system_activity_log');
    if (error) { alert(`Could not load activity log: ${error.message}`); return; }
    state.activityLog = data || [];
    renderActivityLogTable();
}

async function loadAnalyticsData() {
    const tablesToFetch = ['activities', 'contact_sequences', 'campaigns', 'tasks', 'deals'];
    const promises = tablesToFetch.map(table => supabase.from(table).select('*'));
    
    const [
        { data: users, error: userError },
        ...results
    ] = await Promise.all([
        supabase.rpc('get_all_users_with_last_login'),
        ...promises
    ]);

    if(userError) { alert('Could not load user data for analytics.'); return; }
    state.allUsers = users || [];
    
    results.forEach((result, index) => {
        const tableName = tablesToFetch[index];
        state.analyticsData[tableName] = result.data || [];
    });
    
    populateAnalyticsFilters();
    renderAnalyticsDashboard();
}

// --- RENDER FUNCTIONS ---
function renderUserTable() {
    const tableBody = document.querySelector("#user-management-table tbody");
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
                <td class="action-buttons">${deactivateBtn}<button class="btn-primary btn-sm save-user-btn">Save</button></td>
            </tr>`;
        }).join('');
}

function renderActivityLogTable() {
    const tableBody = document.querySelector("#activity-log-table tbody");
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
    state.allUsers.forEach(user => {
        repFilter.innerHTML += `<option value="${user.user_id}">${user.full_name}</option>`;
    });
}

function renderAnalyticsDashboard() {
    const { userId, dateRange } = state.analyticsFilters;
    const { startDate, endDate } = getDateRange(dateRange);

    const filterData = (data, dateField) => {
        return data.filter(item => {
            const itemDate = new Date(item[dateField]);
            const userMatch = (userId === 'all' || item.user_id === userId);
            return userMatch && itemDate >= startDate && itemDate <= endDate;
        });
    };

    const activities = filterData(state.analyticsData.activities, 'date');
    const sequences = filterData(state.analyticsData.contact_sequences, 'created_at');
    const campaigns = filterData(state.analyticsData.campaigns, 'completed_at');
    const tasks = state.analyticsData.tasks.filter(t => (userId === 'all' || t.user_id === userId) && new Date(t.due_date) < new Date() && t.status === 'Pending');
    const newDeals = filterData(state.analyticsData.deals, 'created_at');
    const closedWonDeals = filterData(state.analyticsData.deals, 'updated_at').filter(d => d.stage === 'Closed Won');

    renderChart('activities-chart', 'Activities Logged', activities.length);
    renderChart('sequences-chart', 'Contacts in Sequence', sequences.length);
    renderChart('campaigns-chart', 'Campaigns Completed', campaigns.length);
    renderChart('tasks-chart', 'Tasks Past Due', tasks.length);
    renderChart('new-deals-chart', 'Deals Added', newDeals.length);
    renderChart('new-deals-value-chart', 'Value of New Deals', newDeals.reduce((sum, d) => sum + (d.mrc || 0), 0), true);
    renderChart('closed-won-chart', 'Deals Won', closedWonDeals.length);
}

function renderChart(canvasId, label, value, isCurrency = false) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (state.charts[canvasId]) {
        state.charts[canvasId].destroy();
    }
    state.charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: { labels: [label], datasets: [{ data: [value], backgroundColor: ['#4a90e2'] }] },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: 'var(--text-light)', callback: (val) => isCurrency ? formatCurrencyK(val) : val } },
                y: { ticks: { display: false } }
            }
        }
    });
}


// --- HANDLER FUNCTIONS ---
async function handleSaveUser(e) { /* ... same as before ... */ }
function handleInviteUser() { /* ... same as before ... */ }
function handleDeactivateUser(e) { /* ... same as before ... */ }

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
        case 'last_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        case 'last_2_months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        case 'this_fiscal_year':
            const fiscalYearStartMonth = 6; // July
            let fiscalYear = now.getFullYear();
            if (now.getMonth() < fiscalYearStartMonth) {
                fiscalYear--;
            }
            startDate = new Date(fiscalYear, fiscalYearStartMonth, 1);
            break;
        case 'last_365_days':
            startDate.setDate(now.getDate() - 365);
            break;
        case 'this_month':
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
    }
    return { startDate, endDate };
}


// --- EVENT LISTENER SETUP ---
function setupPageEventListeners() {
    window.addEventListener('hashchange', handleNavigation);
    
    document.getElementById('user-management-table')?.addEventListener('click', e => {
        if (e.target.matches('.save-user-btn')) handleSaveUser(e);
        if (e.target.matches('.deactivate-user-btn')) handleDeactivateUser(e);
    });
    
    document.getElementById('invite-user-btn')?.addEventListener('click', handleInviteUser);

    document.getElementById('analytics-rep-filter')?.addEventListener('change', e => {
        state.analyticsFilters.userId = e.target.value;
        renderAnalyticsDashboard();
    });

    document.getElementById('analytics-date-filter')?.addEventListener('change', e => {
        state.analyticsFilters.dateRange = e.target.value;
        renderAnalyticsDashboard();
    });
}

// --- INITIALIZATION ---
async function initializePage() {
    setupModalListeners();
    loadSVGs();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }
    state.currentUser = session.user;
    
    if (!state.currentUser.user_metadata?.is_admin) {
        alert("Access Denied: You must be an admin to view this page.");
        window.location.href = "command-center.html";
        return;
    }
    
    await setupUserMenuAndAuth(supabase, state);
    setupPageEventListeners();
    handleNavigation();
}

initializePage();
