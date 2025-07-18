// js/cognito.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatDate,
    setupModalListeners,
    showModal,
    hideModal,
    updateActiveNavLink,
    setupUserMenuAndAuth
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        accounts: [],
        contacts: [],
        alerts: [],
        selectedAlert: null,
        viewMode: 'dashboard'
    };

    // --- DOM SELECTORS ---
    const dashboardViewBtn = document.getElementById('view-dashboard-btn');
    const archiveViewBtn = document.getElementById('view-archive-btn');
    const alertsContainer = document.getElementById('alerts-container');


    // --- DATA FETCHING ---
    async function loadAllData() {
        if (!state.currentUser) return;

        const [
            { data: alerts, error: alertsError },
            { data: accounts, error: accountsError },
            { data: contacts, error: contactsError }
        ] = await Promise.all([
            supabase.from("cognito_alerts").select("*").eq("user_id", state.currentUser.id),
            supabase.from("accounts").select("*").eq("user_id", state.currentUser.id),
            supabase.from("contacts").select("*").eq("user_id", state.currentUser.id)
        ]);
        
        if (alertsError) console.error("Error fetching Cognito alerts:", alertsError);
        if (accountsError) console.error("Error fetching accounts:", accountsError);
        if (contactsError) console.error("Error fetching contacts:", contactsError);

        state.alerts = alerts || [];
        state.accounts = accounts || [];
        state.contacts = contacts || [];

        renderAlerts();
    }

    // --- RENDER FUNCTIONS ---
    function renderAlerts() {
        alertsContainer.innerHTML = '';
        const alertsToRender = state.viewMode === 'dashboard' ?
            state.alerts.filter(a => a.status === 'New') :
            state.alerts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (alertsToRender.length === 0 && state.viewMode === 'dashboard') {
            alertsContainer.innerHTML = `<p class="placeholder-text">No new intelligence alerts today. The archive is available if you need to review past items.</p>`;
        } else if (alertsToRender.length === 0) {
            alertsContainer.innerHTML = `<p class="placeholder-text">The Intelligence Archive is empty.</p>`;
        } else {
            alertsToRender.forEach(alert => {
                const account = state.accounts.find(acc => acc.id === alert.account_id);
                const card = document.createElement('div');
                card.className = 'alert-card';
                card.dataset.alertId = alert.id;
                card.innerHTML = `
                    <div class="alert-header">
                        <span class="alert-trigger-type" data-type="${alert.trigger_type}">${alert.trigger_type}</span>
                        <span class="alert-status" data-status="${alert.status}">${alert.status}</span>
                    </div>
                    <h4 class="alert-account-name">${account ? account.name : `Account ID #${alert.account_id} (Not Found)`}</h4>
                    <h5 class="alert-headline">${alert.headline}</h5>
                    <p class="alert-summary">${alert.summary}</p>
                    <div class="alert-footer">
                        <span class="alert-source">Source: <a href="${alert.source_url}" target="_blank">${alert.source_name}</a></span>
                        <span class="alert-date">${formatDate(alert.created_at)}</span>
                    </div>
                    <div class="alert-actions">
                        <button class="btn-primary action-btn" data-action="action">Action</button>
                        <button class="btn-secondary action-btn" data-action="dismiss">Dismiss</button>
                    </div>
                `;
                alertsContainer.appendChild(card);
            });
        }
    }


    // --- ACTION CENTER LOGIC ---
    function showActionCenter(alertId) {
        state.selectedAlert = state.alerts.find(a => a.id === alertId);
        if (!state.selectedAlert) return;

        const account = state.accounts.find(acc => acc.id === state.selectedAlert.account_id);
        
        if (!account) {
            alert(`Error: Could not find the corresponding account (ID: ${state.selectedAlert.account_id}) in your Constellation database.`);
            return;
        }

        const relevantContacts = state.contacts.filter(c => c.account_id === state.selectedAlert.account_id);
        const contactOptions = relevantContacts.map(c => `<option value="${c.id}">${c.first_name} ${c.last_name} (${c.title || 'No Title'})</option>`).join('');

        const outreachCopy = generateOutreachCopy(state.selectedAlert, account);

        let suggestedContactId = null;
        if(relevantContacts.length > 0) {
            if(state.selectedAlert.trigger_type === 'C-Suite Change') {
                const cLevelContact = relevantContacts.find(c => c.title && (c.title.includes('CIO') || c.title.includes('CTO') || c.title.includes('Chief')));
                suggestedContactId = cLevelContact ? cLevelContact.id : relevantContacts[0].id;
            } else {
                suggestedContactId = relevantContacts[0].id;
            }
        }
        
        const modalBody = `
            <h4>Action Center: ${account.name}</h4>
            <div class="action-center-grid">
                <div class="action-center-col">
                    <label for="contact-selector">Suggested Contact:</label>
                    <select id="contact-selector" ${relevantContacts.length === 0 ? 'disabled' : ''}>
                        <option value="">-- Select a Contact --</option>
                        ${contactOptions}
                    </select>
                    
                    <label for="outreach-subject">Suggested Subject:</label>
                    <input type="text" id="outreach-subject" value="${outreachCopy.subject}">
                    <label for="outreach-body">Suggested Body:</label>
                    <textarea id="outreach-body" rows="8">${outreachCopy.body}</textarea>
                    <div class="action-buttons">
                         <button class="btn-secondary" id="copy-btn">Copy</button>
                         <button class="btn-secondary" id="create-template-btn">Create Campaign Email Template</button>
                         <button class="btn-primary" id="send-email-btn">Open Email Client</button>
                    </div>
                </div>
                <div class="action-center-col">
                    <label for="log-interaction-notes">Log an Interaction:</label>
                    <textarea id="log-interaction-notes" rows="4" placeholder="e.g., Emailed the new CIO..." ${relevantContacts.length === 0 ? 'disabled' : ''}></textarea>
                    <button class="btn-secondary" id="log-interaction-btn" style="width: 100%; margin-bottom: 15px;" ${relevantContacts.length === 0 ? 'disabled' : ''}>Log to Constellation</button>

                    <label for="create-task-desc">Create a Task:</label>
                    <input type="text" id="create-task-desc" placeholder="e.g., Follow up with new CIO in 1 week" ${relevantContacts.length === 0 ? 'disabled' : ''}>
                    <label for="create-task-due-date">Due Date:</label>
                    <input type="date" id="create-task-due-date" ${relevantContacts.length === 0 ? 'disabled' : ''}>
                    <button class="btn-primary" id="create-task-btn" style="width: 100%;" ${relevantContacts.length === 0 ? 'disabled' : ''}>Create in Constellation</button>
                    
                    ${relevantContacts.length === 0 ? '<p class="placeholder-text" style="color: var(--warning-yellow); margin-top: 10px;">Add a contact to this account in Constellation to enable logging and task creation.</p>' : ''}
                </div>
            </div>`;

        showModal('Action Center', modalBody, null, false, `<button id="modal-close-btn" class="btn-secondary">Close</button>`);
        
        const contactSelector = document.getElementById('contact-selector');
        
        if (suggestedContactId) {
            contactSelector.value = suggestedContactId;
            contactSelector.dispatchEvent(new Event('change'));
        }

        document.getElementById('modal-close-btn').addEventListener('click', hideModal);
        contactSelector.addEventListener('change', handleContactChange);
        document.getElementById('send-email-btn').addEventListener('click', handleEmailAction);
        document.getElementById('copy-btn').addEventListener('click', handleCopyAction);
        document.getElementById('create-template-btn').addEventListener('click', handleCreateTemplate);
        document.getElementById('log-interaction-btn').addEventListener('click', handleLogInteraction);
        document.getElementById('create-task-btn').addEventListener('click', handleCreateTask);
    }

    function generateOutreachCopy(alert, account) {
        const accountName = account ? account.name : '[Account Name]';
        let subject = ``;
        let body = ``;

        switch (alert.trigger_type) {
            case 'C-Suite Change':
                subject = `Congratulations on the new role`;
                body = `Hi [Contact Name],\n\nI saw the news about your new role as CIO at ${accountName} — congratulations.\n\nLeaders taking on new roles are often re-evaluating their infrastructure to support their vision. If exploring high-speed fiber or new cloud connectivity solutions is on your roadmap, I'd welcome a brief chat.\n\nBest regards,\n[Your Name]`;
                break;
            case 'Expansion':
                subject = `Regarding ${accountName}'s new campus`;
                body = `Hi [Contact Name],\n\nCongratulations on the news about the new campus expansion in West Omaha. That's a significant project and great for the area.\n\nAs you scope out the infrastructure needs for a facility of that size, our team at Great Plains Communications specializes in providing foundational high-availability fiber and managed services. \n\nWould be happy to connect when the time is right.\n\nBest regards,\n[Your Name]`;
                break;
            default:
                subject = `Following up on ${accountName}'s latest news`;
                body = `Hi [Contact Name],\n\nI saw the recent news about "${alert.headline}" and wanted to reach out.\n\n[Add your personalized message here]\n\nBest regards,\n[Your Name]`;
        }
        return { subject, body };
    }


    // --- ACTION HANDLERS (Integration with Constellation) ---
    function handleContactChange(e) {
        const selectedContactId = e.target.value;
        const outreachBodyTextarea = document.getElementById('outreach-body');
        if (!selectedContactId || !outreachBodyTextarea) return;

        const contact = state.contacts.find(c => c.id === Number(selectedContactId));
        if (contact) {
            outreachBodyTextarea.value = outreachBodyTextarea.value.replace(/\[Contact Name\]/g, `${contact.first_name}`);
        }
    }

    function handleEmailAction() {
        const contactId = document.getElementById('contact-selector').value;
        if (!contactId) {
            alert('Please select a contact to email.');
            return;
        }
        const contact = state.contacts.find(c => c.id === Number(contactId));
        if (!contact || !contact.email) {
            alert('Selected contact does not have an email address.');
            return;
        }

        const subject = document.getElementById('outreach-subject').value;
        const body = document.getElementById('outreach-body').value;
        window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }

    function handleCopyAction() {
        const body = document.getElementById('outreach-body').value;
        navigator.clipboard.writeText(body).then(() => {
            alert('Email body copied to clipboard!');
        });
    }

    async function handleCreateTemplate() {
        const templateName = prompt("Please enter a name for your new email template:");
        if (!templateName || templateName.trim() === '') {
            alert("Template name cannot be empty.");
            return;
        }

        const subject = document.getElementById('outreach-subject').value;
        const body = document.getElementById('outreach-body').value;

        const { error } = await supabase.from('email_templates').insert({
            name: templateName,
            subject: subject,
            body: body,
            user_id: state.currentUser.id
        });

        if (error) {
            alert('Error creating template: ' + error.message);
        } else {
            alert(`Template "${templateName}" created successfully and is now available in the Campaigns hub.`);
        }
    }

    async function handleLogInteraction() {
        const selectedContactId = document.getElementById('contact-selector').value;
        if (!selectedContactId) {
            alert('Please select a contact to log this interaction against.');
            return;
        }

        const notes = document.getElementById('log-interaction-notes').value.trim();
        if (!notes) {
            alert('Please enter notes for the interaction.');
            return;
        }

        const { error } = await supabase.from('activities').insert({
            account_id: state.selectedAlert.account_id,
            contact_id: Number(selectedContactId),
            type: 'Cognito Intelligence',
            description: `[${state.selectedAlert.trigger_type}] ${state.selectedAlert.headline} - Notes: ${notes}`,
            user_id: state.currentUser.id,
            date: new Date().toISOString()
        });

        if (error) {
            alert('Error logging interaction: ' + error.message);
        } else {
            alert('Interaction logged to Constellation!');
            document.getElementById('log-interaction-notes').value = '';
            await updateAlertStatus(state.selectedAlert.id, 'Actioned');
            hideModal();
        }
    }

    async function handleCreateTask() {
        const selectedContactId = document.getElementById('contact-selector').value;
        if (!selectedContactId) {
            alert('Please select a contact to associate with this task.');
            return;
        }
        
        const description = document.getElementById('create-task-desc').value.trim();
        const dueDate = document.getElementById('create-task-due-date').value;
        if (!description) {
            alert('Please enter a description for the task.');
            return;
        }

        const { error } = await supabase.from('tasks').insert({
            account_id: state.selectedAlert.account_id,
            contact_id: Number(selectedContactId),
            description: `Cognito: ${description}`,
            due_date: dueDate || null,
            status: 'Pending',
            user_id: state.currentUser.id
        });

        if (error) {
            alert('Error creating task: ' + error.message);
        } else {
            alert('Task created in Constellation!');
            document.getElementById('create-task-desc').value = '';
            document.getElementById('create-task-due-date').value = '';
            await updateAlertStatus(state.selectedAlert.id, 'Actioned');
            hideModal();
        }
    }

    async function updateAlertStatus(alertId, newStatus) {
        const { error } = await supabase.from('cognito_alerts').update({ status: newStatus }).eq('id', alertId);
        if (error) {
            alert('Error updating alert status: ' + error.message);
        }
        await loadAllData();
    }

    // --- EVENT LISTENER SETUP ---
    function setupPageEventListeners() {
        setupModalListeners();

        dashboardViewBtn.addEventListener('click', () => {
            state.viewMode = 'dashboard';
            dashboardViewBtn.classList.add('active');
            archiveViewBtn.classList.remove('active');
            renderAlerts();
        });

        archiveViewBtn.addEventListener('click', () => {
            state.viewMode = 'archive';
            archiveViewBtn.classList.add('active');
            dashboardViewBtn.classList.remove('active');
            renderAlerts();
        });

        alertsContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.action-btn');
            if (!button) return;

            const card = e.target.closest('.alert-card');
            if (!card) return;

            const alertId = Number(card.dataset.alertId);
            const action = button.dataset.action;

            if (action === 'action') {
                showActionCenter(alertId);
            } else if (action === 'dismiss') {
                showModal("Confirm Dismissal", "Are you sure you want to dismiss this alert? It will be moved to the archive.", () => {
                    updateAlertStatus(alertId, 'Dismissed');
                    hideModal();
                });
            }
        });
    }

    // --- INITIALIZATION ---
    async function initializePage() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            state.currentUser = session.user;
            await setupUserMenuAndAuth(supabase, state);
            setupPageEventListeners();
            await loadAllData();
        } else {
            window.location.href = "index.html";
        }
    }

    initializePage();
});
