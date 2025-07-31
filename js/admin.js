// js/admin.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    setupModalListeners,
    showModal,
    hideModal,
    svgLoader // <<< CORRECTLY IMPORTED
} from './shared_constants.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let state = {
    currentUser: null,
    allUsers: []
};

// --- RENDER FUNCTIONS ---
function renderUserTable() {
    const tableBody = document.querySelector("#user-management-table tbody");
    if (!tableBody) return;

    tableBody.innerHTML = ""; // Clear existing rows

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

// --- DATA FETCHING & UPDATING ---
async function loadAllData() {
    const { data, error } = await supabase.rpc('get_all_users_with_roles');

    if (error) {
        console.error("Error fetching user data:", error);
        alert(`Could not load user data: ${error.message}`);
        return;
    }
    state.allUsers = data || [];
    renderUserTable();
}

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
        const { error: quotaError } = await supabase
            .from('user_quotas')
            .update(updatedData)
            .eq('user_id', userId);

        if (quotaError) throw quotaError;

        const { error: roleError } = await supabase.rpc('set_manager_status', {
            target_user_id: userId,
            is_manager_status: isManagerStatus
        });

        if (roleError) throw roleError;
        
        alert(`User ${updatedData.full_name} updated successfully!`);

    } catch (error) {
        console.error("Error saving user:", error);
        alert(`Failed to save user: ${error.message}`);
    } finally {
        button.textContent = 'Save';
        button.disabled = false;
    }
}


// --- INITIALIZATION ---
async function initializePage() {
    setupModalListeners();
    svgLoader(); // <<< FIXED: Added the call to load SVGs

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

    const table = document.getElementById('user-management-table');
    if (table) {
        table.addEventListener('click', e => {
            if (e.target.matches('.save-user-btn')) {
                handleSaveUser(e);
            }
        });
    }

    await loadAllData();
}

initializePage();
