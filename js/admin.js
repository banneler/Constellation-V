// js/admin.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatDate,
    setupModalListeners,
    showModal,
    hideModal,
    loadSVGs, // <<< FIXED: Correct function name
    setupUserMenuAndAuth // <<< FIXED: Re-added this import
} from './shared_constants.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let state = {
    currentUser: null,
    allUsers: [],
    activityLog: [],
    currentView: 'user-management',
};

// --- DATA FETCHING ---
const loadAllDataForView = async () => {
    switch (state.currentView) {
        case 'user-management': await loadUserData(); break;
        case 'activity-log': await loadActivityLogData(); break;
    }
};

async function loadUserData() {
    const { data, error } = await supabase.rpc('get_all_users_with_roles');
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


// --- RENDER FUNCTIONS ---
function renderUserTable() {
    const tableBody = document.querySelector("#user-management-table tbody");
    if (!tableBody) return;
    tableBody.innerHTML = state.allUsers
        .sort((a, b) => (a.full_name || "z").localeCompare(b.full_name || "z"))
        .map(user => {
            const isSelf = user.user_id === state.currentUser.id;
            const deactivateButton = isSelf ? '' : `<button class="btn-danger deactivate-user-btn" data-user-id="${user.user_id}" data-user-name="${user.full_name}">Deactivate</button>`;
            
            return `
            <tr data-user-id="${user.user_id}">
                <td><input type="text" class="form-control user-name-input" value="${user.full_name || ''}"></td>
                <td>${user.email || 'N/A'}</td>
                <td><input type="number" class="form-control user-quota-input" value="${user.monthly_quota || 0}"></td>
                <td><input type="checkbox" class="is-manager-checkbox" ${user.is_manager ? 'checked' : ''} ${isSelf ? 'disabled' : ''}></td>
                <td class="action-buttons">
                    <button class="btn-primary save-user-btn" data-user-id="${user.user_id}">Save</button>
                    ${deactivateButton}
                </td>
            </tr>
        `}).join('');
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
            const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
            if(error) { alert(`Error inviting user: ${error.message}`); return false; }
            
            alert(`Invitation sent to ${email}.`);
            return true;
        }
    );
}

function handleDeactivateUser(e) {
    const button = e.target;
    const userId = button.dataset.userId;
    const userName = button.dataset.userName;

    showModal("Confirm Deactivation", `Are you sure you want to deactivate ${userName}? They will no longer be able to log in.`, async () => {
        try {
            const { data, error } = await supabase.rpc('deactivate_user', { target_user_id: userId });
            if (error) throw error;
            alert(data); // Show success message from the function
            await loadUserData();
        } catch (error) {
            alert(`Failed to deactivate user: ${error.message}`);
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

// --- EVENT LISTENER SETUP ---
function setupPageEventListeners() {
    window.addEventListener('hashchange', handleNavigation);
    
    document.getElementById('user-management-table')?.addEventListener('click', e => {
        if (e.target.matches('.save-user-btn')) handleSaveUser(e);
        if (e.target.matches('.deactivate-user-btn')) handleDeactivateUser(e);
    });
    
    document.getElementById('invite-user-btn')?.addEventListener('click', handleInviteUser);
}

// --- INITIALIZATION ---
async function initializePage() {
    setupModalListeners();
    loadSVGs(); // <<< FIXED: Correct function name

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = "index.html";
        return;
    }
    state.currentUser = session.user;
    
    // ADMIN GATEKEEPER
    if (!state.currentUser.user_metadata?.is_admin) {
        alert("Access Denied: You must be an admin to view this page.");
        window.location.href = "command-center.html";
        return;
    }
    
    // <<< FIXED: This call was missing
    await setupUserMenuAndAuth(supabase, state);

    setupPageEventListeners();
    handleNavigation();
}

initializePage();
