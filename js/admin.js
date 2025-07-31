// js/admin.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatDate,
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
    activityLog: [],
    currentView: 'user-management',
    selectedTemplateId: null,
};

// --- DATA FETCHING ---
async function loadUserData() {
    const { data, error } = await supabase.rpc('get_all_users_with_roles');
    if (error) { alert(`Could not load user data: ${error.message}`); return; }
    state.allUsers = data || [];
    renderUserTable();
}

async function loadContentData() {
    const { data, error } = await supabase.from('email_templates').select('*').eq('is_shared', true);
    if (error) { alert(`Could not load shared templates: ${error.message}`); return; }
    state.sharedTemplates = data || [];
    renderContentManagementView();
}

async function loadActivityLogData() {
    const { data, error } = await supabase.rpc('get_system_activity_log');
    if (error) { alert(`Could not load activity log: ${error.message}`); return; }
    state.activityLog = data || [];
    renderActivityLogTable();
}

const loadAllDataForView = async () => {
    switch (state.currentView) {
        case 'user-management': await loadUserData(); break;
        case 'content-management': await loadContentData(); break;
        case 'activity-log': await loadActivityLogData(); break;
    }
};

// --- RENDER FUNCTIONS ---
function renderUserTable() {
    const tableBody = document.querySelector("#user-management-table tbody");
    if (!tableBody) return;
    tableBody.innerHTML = state.allUsers
        .sort((a, b) => (a.full_name || "z").localeCompare(b.full_name || "z"))
        .map(user => `
            <tr data-user-id="${user.user_id}">
                <td><input type="text" class="form-control user-name-input" value="${user.full_name || ''}"></td>
                <td>${user.email || 'N/A'}</td>
                <td><input type="number" class="form-control user-quota-input" value="${user.monthly_quota || 0}"></td>
                <td><input type="checkbox" class="is-manager-checkbox" ${user.is_manager ? 'checked' : ''}></td>
                <td>
                    <button class="btn-primary save-user-btn" data-user-id="${user.user_id}">Save</button>
                    </td>
            </tr>
        `).join('');
}

function renderContentManagementView() {
    const itemList = document.getElementById('item-list');
    itemList.innerHTML = state.sharedTemplates.map(t => `<div class="list-item" data-id="${t.id}" data-type="template">${t.name}</div>`).join('');
    renderTemplateDetails(); // Will show placeholder or selected template
}

function renderTemplateDetails() {
    const detailsPanel = document.getElementById('dynamic-details-panel');
    const template = state.sharedTemplates.find(t => t.id === state.selectedTemplateId);
    if (template) {
        detailsPanel.innerHTML = `
            <h3>Template Details</h3>
            <input type="hidden" id="template-id" value="${template.id}">
            <label>Template Name:</label><input type="text" id="template-name" value="${template.name || ''}" required>
            <label>Subject:</label><input type="text" id="template-subject" value="${template.subject || ''}">
            <label>Email Body:</label><textarea id="template-body" rows="10">${template.body || ''}</textarea>
            <div class="form-buttons">
                <button id="save-template-btn" class="btn-primary">Save Template</button>
                <button id="delete-template-btn" class="btn-danger">Delete Template</button>
            </div>`;
    } else {
        detailsPanel.innerHTML = `<h3>New Shared Template</h3>
            <input type="hidden" id="template-id" value="">
            <label>Template Name:</label><input type="text" id="template-name" value="" required>
            <label>Subject:</label><input type="text" id="template-subject" value="">
            <label>Email Body:</label><textarea id="template-body" rows="10"></textarea>
            <div class="form-buttons"><button id="save-template-btn" class="btn-primary">Save Template</button></div>`;
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
        </tr>
    `).join('');
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

function handleInviteUser() {
    showModal("Invite New User",
        `<label>Email Address:</label><input type="email" id="modal-invite-email" required>`,
        async () => {
            const email = document.getElementById('modal-invite-email').value;
            if(!email) { alert("Email is required."); return false; }

            const { error } = await supabase.auth.admin.inviteUserByEmail(email);
            if(error) { alert(`Error inviting user: ${error.message}`); return false; }
            
            alert(`Invitation sent to ${email}.`);
            return true;
        }
    );
}

function handleCreateNewItem() {
    state.selectedTemplateId = null;
    renderTemplateDetails();
}

async function handleSaveTemplate() {
    const id = document.getElementById('template-id')?.value;
    const name = document.getElementById('template-name')?.value.trim();
    if (!name) { alert('Template name is required.'); return; }

    const templateData = { name, subject: document.getElementById('template-subject')?.value.trim(), body: document.getElementById('template-body')?.value, is_shared: true, user_id: state.currentUser.id };

    const { error } = id ? await supabase.from('email_templates').update(templateData).eq('id', id) : await supabase.from('email_templates').insert(templateData);

    if (error) { alert("Error saving template: " + error.message); }
    else { alert("Shared template saved successfully!"); await loadContentData(); }
}

async function handleDeleteTemplate() {
    if (!state.selectedTemplateId) return;
    showModal("Confirm Deletion", "Are you sure you want to delete this shared template?", async () => {
        const { error } = await supabase.from('email_templates').delete().eq('id', state.selectedTemplateId);
        if (error) { alert("Error deleting template: " + error.message); }
        else {
            alert("Template deleted.");
            state.selectedTemplateId = null;
            await loadContentData();
        }
        hideModal();
    });
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

// --- EVENT LISTENER SETUP ---
function setupPageEventListeners() {
    window.addEventListener('hashchange', handleNavigation);
    
    document.getElementById('user-management-table')?.addEventListener('click', e => {
        if (e.target.matches('.save-user-btn')) handleSaveUser(e);
    });
    
    document.getElementById('invite-user-btn')?.addEventListener('click', handleInviteUser);

    document.getElementById('create-new-item-btn')?.addEventListener('click', handleCreateNewItem);
    document.getElementById('item-list')?.addEventListener('click', e => {
        const item = e.target.closest('.list-item');
        if(item) {
            state.selectedTemplateId = Number(item.dataset.id);
            renderContentManagementView(); // Re-render to highlight selection
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
    
    await setupUserMenuAndAuth(supabase, state);
    setupPageEventListeners();
    handleNavigation();
}

initializePage();
