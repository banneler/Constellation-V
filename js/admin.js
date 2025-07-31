// js/admin.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatDate,
    formatCurrencyK,
    setupModalListeners,
    showModal,
    hideModal,
    loadSVGs
} from './shared_constants.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let state = {
    currentUser: null,
    allUsers: [],
    sharedTemplates: [],
    sharedSequences: [],
    sequence_steps: [],
    allDeals: [],
    allAccounts: [],
    currentView: 'user-management',
    contentView: 'templates',
    selectedTemplateId: null,
    selectedSequenceId: null,
};

// --- DATA FETCHING ---

async function loadUserData() {
    const { data, error } = await supabase.rpc('get_all_users_with_roles');
    if (error) {
        alert(`Could not load user data: ${error.message}`);
        return;
    }
    state.allUsers = data || [];
    renderUserTable();
}

async function loadContentData() {
    const [
        { data: templates, error: tError },
        { data: sequences, error: sError },
        { data: steps, error: stError }
    ] = await Promise.all([
        supabase.from('email_templates').select('*').eq('is_shared', true),
        supabase.from('marketing_sequences').select('*').eq('is_shared', true),
        supabase.from('marketing_sequence_steps').select('*') // Steps are linked by ID, no need to filter here
    ]);

    if (tError || sError || stError) console.error("Error loading content data:", tError || sError || stError);
    state.sharedTemplates = templates || [];
    state.sharedSequences = sequences || [];
    state.sequence_steps = steps || [];
    renderContentManagementView();
}

async function loadAnalyticsData() {
    const [
        { data: deals, error: dError },
        { data: accounts, error: aError },
        { data: users, error: uError }
    ] = await Promise.all([
        supabase.from('deals').select('*'),
        supabase.from('accounts').select('*'),
        supabase.rpc('get_all_users_with_roles') // Use our secure function
    ]);

    if (dError || aError || uError) console.error("Error loading analytics data:", dError || aError || uError);
    state.allDeals = deals || [];
    state.allAccounts = accounts || [];
    state.allUsers = users || []; // This now includes quota info
    renderAnalyticsDashboard();
}

// --- RENDER FUNCTIONS ---

function renderUserTable() {
    const tableBody = document.querySelector("#user-management-table tbody");
    if (!tableBody) return;
    tableBody.innerHTML = "";
    state.allUsers
        .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))
        .forEach(user => {
            const row = tableBody.insertRow();
            row.dataset.userId = user.user_id;
            row.innerHTML = `
                <td><input type="text" class="form-control user-name-input" value="${user.full_name || ''}"></td>
                <td>${user.email || 'N/A'}</td>
                <td><input type="number" class="form-control user-quota-input" value="${user.monthly_quota || 0}"></td>
                <td><input type="checkbox" class="is-manager-checkbox" ${user.is_manager ? 'checked' : ''}></td>
                <td><button class="btn-primary save-user-btn" data-user-id="${user.user_id}">Save</button></td>
            `;
        });
}

function renderContentManagementView() {
    const listHeader = document.getElementById('list-header');
    const itemList = document.getElementById('item-list');
    const detailsPanel = document.getElementById('dynamic-details-panel');

    if (state.contentView === 'templates') {
        listHeader.textContent = 'Shared Email Templates';
        itemList.innerHTML = state.sharedTemplates.map(t => `<div class="list-item" data-id="${t.id}" data-type="template">${t.name}</div>`).join('');
        detailsPanel.innerHTML = '<p>Select a template or create a new one.</p>';
        if(state.selectedTemplateId) renderTemplateDetails();
    } else {
        // Future implementation for sequences
    }
}

function renderTemplateDetails() {
    const detailsPanel = document.getElementById('dynamic-details-panel');
    const template = state.sharedTemplates.find(t => t.id === state.selectedTemplateId);

    if (template) {
        detailsPanel.innerHTML = `
            <h3>Template Details</h3>
            <div id="template-form-container">
                <input type="hidden" id="template-id" value="${template.id}">
                <label>Template Name:</label><input type="text" id="template-name" value="${template.name || ''}" required>
                <label>Subject:</label><input type="text" id="template-subject" value="${template.subject || ''}">
                <label>Email Body:</label><textarea id="template-body" rows="10">${template.body || ''}</textarea>
                <div class="form-buttons">
                    <button id="save-template-btn" class="btn-primary">Save Template</button>
                    <button id="delete-template-btn" class="btn-danger">Delete Template</button>
                </div>
            </div>`;
    } else {
        detailsPanel.innerHTML = `
            <h3>New Shared Template</h3>
            <div id="template-form-container">
                 <input type="hidden" id="template-id" value="">
                <label>Template Name:</label><input type="text" id="template-name" value="" required>
                <label>Subject:</label><input type="text" id="template-subject" value="">
                <label>Email Body:</label><textarea id="template-body" rows="10"></textarea>
                <div class="form-buttons">
                    <button id="save-template-btn" class="btn-primary">Save Template</button>
                </div>
            </div>`;
    }
}

function renderAnalyticsDashboard() {
    const metricsContainer = document.getElementById('team-metrics-container');
    const leaderboardBody = document.querySelector('#leaderboard-table tbody');

    // Metrics calculation
    const totalQuota = state.allUsers.reduce((sum, user) => sum + (user.monthly_quota || 0), 0);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let currentCommit = 0, bestCase = 0, totalFunnel = 0;

    state.allDeals.forEach(deal => {
        const dealCloseDate = deal.close_month ? new Date(deal.close_month + '-02') : null;
        const isCurrentMonth = dealCloseDate && dealCloseDate.getMonth() === currentMonth && dealCloseDate.getFullYear() === currentYear;
        totalFunnel += deal.mrc || 0;
        if (isCurrentMonth) {
            bestCase += deal.mrc || 0;
            if (deal.is_committed) currentCommit += deal.mrc || 0;
        }
    });

    metricsContainer.innerHTML = `
        <div class="metric-card">
            <div class="metric-title">Team Current Commit</div>
            <div class="metric-value">${formatCurrencyK(currentCommit)}</div>
            <span class="metric-quota-percent">${totalQuota > 0 ? ((currentCommit/totalQuota)*100).toFixed(1) : 0}% of ${formatCurrencyK(totalQuota)}</span>
        </div>
        <div class="metric-card">
            <div class="metric-title">Team Best Case</div>
            <div class="metric-value">${formatCurrencyK(bestCase)}</div>
             <span class="metric-quota-percent">${totalQuota > 0 ? ((bestCase/totalQuota)*100).toFixed(1) : 0}% of ${formatCurrencyK(totalQuota)}</span>
        </div>
        <div class="metric-card">
            <div class="metric-title">Total Team Funnel</div>
            <div class="metric-value">${formatCurrencyK(totalFunnel)}</div>
        </div>
    `;

    // Leaderboard calculation
    const leaderboardData = state.allUsers.map(user => {
        const userCommit = state.allDeals
            .filter(d => {
                const closeDate = d.close_month ? new Date(d.close_month + '-02') : null;
                return d.user_id === user.user_id && d.is_committed && closeDate && closeDate.getMonth() === currentMonth && closeDate.getFullYear() === currentYear;
            })
            .reduce((sum, d) => sum + (d.mrc || 0), 0);
        
        return {
            name: user.full_name,
            commit: userCommit,
            quota: user.monthly_quota || 0,
            quotaPercent: user.monthly_quota > 0 ? ((userCommit / user.monthly_quota) * 100) : 0
        };
    }).sort((a, b) => b.commit - a.commit);

    leaderboardBody.innerHTML = leaderboardData.map((user, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${user.name}</td>
            <td>${formatCurrencyK(user.commit)}</td>
            <td>${user.quotaPercent.toFixed(1)}%</td>
        </tr>
    `).join('');
    
    // Chart rendering (you can add your chart.js logic here)
}


// --- HANDLER FUNCTIONS ---

async function handleSaveUser(e) {
    const button = e.target;
    const row = button.closest('tr');
    const userId = row.dataset.userId;

    const updatedData = {
        full_name: row.querySelector('.user-name-input').value.trim(),
        monthly_quota: parseInt(row.querySelector('.user-quota-input').value, 10) || 0
    };
    const isManagerStatus = row.querySelector('.is-manager-checkbox').checked;

    button.textContent = 'Saving...';
    button.disabled = true;

    try {
        const { error: quotaError } = await supabase.from('user_quotas').update(updatedData).eq('user_id', userId);
        if (quotaError) throw quotaError;

        const { error: roleError } = await supabase.rpc('set_manager_status', { target_user_id: userId, is_manager_status: isManagerStatus });
        if (roleError) throw roleError;
        
        alert(`User ${updatedData.full_name} updated successfully!`);
    } catch (error) {
        alert(`Failed to save user: ${error.message}`);
    } finally {
        button.textContent = 'Save';
        button.disabled = false;
    }
}

function handleNavigation() {
    const hash = window.location.hash || '#user-management';
    state.currentView = hash.substring(1);

    document.querySelectorAll('.admin-nav').forEach(link => link.classList.remove('active'));
    document.querySelector(`.admin-nav[href="${hash}"]`).classList.add('active');

    document.querySelectorAll('.content-view').forEach(view => view.classList.add('hidden'));
    document.getElementById(`${state.currentView}-view`).classList.remove('hidden');

    loadAllDataForView();
}

function handleCreateNewItem() {
    if(state.contentView === 'templates') {
        state.selectedTemplateId = null;
        renderTemplateDetails();
    }
}

async function handleSaveTemplate() {
    const id = document.getElementById('template-id')?.value;
    const name = document.getElementById('template-name')?.value.trim();
    if (!name) { alert('Template name is required.'); return; }

    const templateData = {
        name,
        subject: document.getElementById('template-subject')?.value.trim(),
        body: document.getElementById('template-body')?.value,
        is_shared: true, // All templates from admin are shared
        user_id: state.currentUser.id
    };

    let error;
    if (id) {
        ({ error } = await supabase.from('email_templates').update(templateData).eq('id', id));
    } else {
        ({ error } = await supabase.from('email_templates').insert(templateData));
    }

    if (error) { alert("Error saving template: " + error.message); }
    else { alert("Shared template saved successfully!"); await loadContentData(); }
}

async function handleDeleteTemplate() {
     if (!state.selectedTemplateId) return;
     showModal("Confirm Deletion", "Are you sure you want to delete this shared template?", async () => {
        const { error } = await supabase.from('email_templates').delete().eq('id', state.selectedTemplateId);
        if (error) alert("Error deleting template: " + error.message);
        else {
            alert("Template deleted.");
            state.selectedTemplateId = null;
            await loadContentData();
        }
        hideModal();
     });
}

// --- EVENT LISTENER SETUP ---
function setupPageEventListeners() {
    window.addEventListener('hashchange', handleNavigation);
    
    document.getElementById('user-management-table')?.addEventListener('click', e => {
        if (e.target.matches('.save-user-btn')) handleSaveUser(e);
    });

    document.getElementById('create-new-item-btn')?.addEventListener('click', handleCreateNewItem);
    document.getElementById('item-list')?.addEventListener('click', e => {
        const item = e.target.closest('.list-item');
        if(item) {
            if(item.dataset.type === 'template') {
                state.selectedTemplateId = Number(item.dataset.id);
                renderTemplateDetails();
            }
        }
    });

    document.getElementById('dynamic-details-panel')?.addEventListener('click', e => {
        if(e.target.id === 'save-template-btn') handleSaveTemplate();
        if(e.target.id === 'delete-template-btn') handleDeleteTemplate();
    });
}

// --- INITIALIZATION ---
async function initializePage() {
    loadSVGs();
    setupModalListeners();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = "index.html";
        return;
    }
    state.currentUser = session.user;

    if (!state.currentUser.user_metadata?.is_admin) {
        alert("Access Denied: You must be an admin to view this page.");
        window.location.href = "command-center.html";
        return;
    }

    setupPageEventListeners();
    handleNavigation();
}

initializePage();
