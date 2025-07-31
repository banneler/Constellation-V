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
        chartView: 'combined' // 'combined' or 'individual'
    }
};

const loadAllDataForView = async () => { /* ... */ };
async function loadUserData() { /* ... */ }
async function loadContentData() { /* ... */ }
async function loadAnalyticsData() { /* ... */ }

// --- DATA FETCHING ---
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
    const { data, error } = await supabase.rpc('get_all_users_with_last_login');
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
    const promises = tablesToFetch.map(table => supabase.from(table).select('*'));
    
    const [ { data: users, error: userError }, { data: log, error: logError }, ...results ] = await Promise.all([
        supabase.rpc('get_all_users_with_last_login'),
        supabase.rpc('get_system_activity_log'),
        ...promises
    ]);

    if(userError || logError) { alert('Could not load user or log data for analytics.'); return; }
    state.allUsers = users || [];
    state.activityLog = log || [];
    
    results.forEach((result, index) => { state.analyticsData[tableName] = result.data || []; });
    
    populateAnalyticsFilters();
    renderAnalyticsDashboard();
    renderActivityLogTable();
}


// --- RENDER FUNCTIONS ---
function renderUserTable() { /* ... function is unchanged ... */ }
function renderContentTable() { /* ... function is unchanged ... */ }
function renderActivityLogTable() { /* ... function is unchanged ... */ }

function populateAnalyticsFilters() {
    const repFilter = document.getElementById('analytics-rep-filter');
    repFilter.innerHTML = '<option value="all">All Reps</option>';
    state.allUsers.forEach(user => { repFilter.innerHTML += `<option value="${user.user_id}">${user.full_name}</option>`; });
}

function renderAnalyticsDashboard() {
    const { userId, dateRange, chartView } = state.analyticsFilters;
    const { startDate, endDate } = getDateRange(dateRange);

    const filterData = (data, dateField) => {
        return data.filter(item => {
            const itemDate = new Date(item[dateField]);
            const userMatch = (userId === 'all' || item.user_id === userId);
            return userMatch && itemDate >= startDate && itemDate <= endDate;
        });
    };

    const filterTasks = (data) => {
        return data.filter(t => {
            const userMatch = (userId === 'all' || t.user_id === userId);
            const isPastDue = new Date(t.due_date) < new Date();
            return userMatch && isPastDue && t.status === 'Pending';
        });
    };

    const groupByUser = (data, valueField = null) => {
        return state.allUsers.map(user => {
            const userItems = data.filter(item => item.user_id === user.user_id);
            const value = valueField ? userItems.reduce((sum, item) => sum + (item[valueField] || 0), 0) : userItems.length;
            return { label: user.full_name, value };
        }).sort((a,b) => b.value - a.value);
    };

    const activities = filterData(state.analyticsData.activities, 'date');
    const sequences = filterData(state.analyticsData.contact_sequences, 'created_at');
    const campaigns = filterData(state.analyticsData.campaigns, 'completed_at');
    const tasks = filterTasks(state.analyticsData.tasks);
    const newDeals = filterData(state.analyticsData.deals, 'created_at');
    const closedWonDeals = filterData(state.analyticsData.deals, 'updated_at').filter(d => d.stage === 'Closed Won');

    if (userId === 'all' && chartView === 'individual') {
        renderChart('activities-chart', groupByUser(activities));
        renderChart('sequences-chart', groupByUser(sequences));
        renderChart('campaigns-chart', groupByUser(campaigns));
        renderChart('tasks-chart', groupByUser(tasks));
        renderChart('new-deals-chart', groupByUser(newDeals));
        renderChart('new-deals-value-chart', groupByUser(newDeals, 'mrc'), true);
        renderChart('closed-won-chart', groupByUser(closedWonDeals, 'mrc'), true);
    } else {
        renderChart('activities-chart', { label: 'Activities Logged', value: activities.length });
        renderChart('sequences-chart', { label: 'Contacts in Sequence', value: sequences.length });
        renderChart('campaigns-chart', { label: 'Campaigns Completed', value: campaigns.length });
        renderChart('tasks-chart', { label: 'Tasks Past Due', value: tasks.length });
        renderChart('new-deals-chart', { label: 'Deals Added', value: newDeals.length });
        renderChart('new-deals-value-chart', { label: 'Value of New Deals', value: newDeals.reduce((s, d) => s + (d.mrc || 0), 0) }, true);
        renderChart('closed-won-chart', { label: 'Value of Deals Won', value: closedWonDeals.reduce((s, d) => s + (d.mrc || 0), 0) }, true);
    }
}

function renderChart(canvasId, data, isCurrency = false) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (state.charts[canvasId]) {
        state.charts[canvasId].destroy();
    }
    
    const isIndividual = Array.isArray(data);
    const chartLabels = isIndividual ? data.map(d => d.label) : [data.label];
    const chartData = isIndividual ? data.map(d => d.value) : [data.value];

    state.charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: { labels: chartLabels, datasets: [{ data: chartData, backgroundColor: '#4a90e2' }] },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { displayColors: false, bodyFont: {size: 14}, callbacks: { label: (c) => isCurrency ? formatCurrencyK(c.raw) : c.raw } } },
            scales: {
                x: { ticks: { color: 'var(--text-light)', font: {size: 14}, callback: (val) => isCurrency ? formatCurrencyK(val) : val } },
                y: { ticks: { color: 'var(--text-light)', font: {size: 12} } }
            }
        }
    });
}


// --- HANDLER FUNCTIONS ---
async function handleSaveUser(e) { /* ... same as before ... */ }
function handleInviteUser() { /* ... same as before ... */ }
function handleDeactivateUser(e) { /* ... same as before ... */ }
async function handleContentToggle(e) { /* ... same as before ... */ }
async function handleDeleteContent(e) { /* ... same as before ... */ }

function handleNavigation() {
    const hash = window.location.hash || '#user-management';
    state.currentView = hash.substring(1);
    document.querySelectorAll('.admin-nav').forEach(link => link.classList.remove('active'));
    document.querySelector(`.admin-nav[href="${hash}"]`)?.classList.add('active');
    document.querySelectorAll('.content-view').forEach(view => view.classList.add('hidden'));
    document.getElementById(`${state.currentView}-view`)?.classList.remove('hidden');
    loadAllDataForView();
}

function getDateRange(rangeKey) { /* ... same as before ... */ }

// --- EVENT LISTENER SETUP ---
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
