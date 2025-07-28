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
    const pageTitle = document.querySelector('#cognito-view h2');


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
        
        const alertsToRender = state.viewMode === 'dashboard'
            ? state.alerts.filter(a => a.status === 'New').sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            : state.alerts.filter(a => a.status !== 'New').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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

                const actionButtonsHTML = alert.status === 'New' ? `
                    <div class="alert-actions">
                        <button class="btn-primary action-btn" data-action="action">Action</button>
                        <button class="btn-secondary action-btn" data-action="dismiss">Dismiss</button>
                    </div>` : '';

                card.innerHTML = `
                    <div class="alert-header">
                        <span class="alert-trigger-type" data-type="${alert.trigger_type}">${alert.trigger_type}</span>
                        <span class="alert-status" data-status="${alert.status}">${alert.status}</span>
                    </div>
                    <h4 class="alert-account-name">${account ? account.name : `Account ID #${alert.account_id} (Not Found)`}</h4>
                    <h5 class="alert-headline">${alert.headline}</h5>
                    <p class="alert-summary">${alert.summary}</p>
                    <div class="alert-footer">
                        <span class="alert-source">Source: <a href="${alert.source_url}" target="_blank">${alert.source_name || 'N/A'}</a></span>
                        <span class="alert-date">${formatDate(alert.created_at)}</span>
                    </div>
                    ${actionButtonsHTML}
                `;
                alertsContainer.appendChild(card);
            });
        }
    }


    // --- ACTION CENTER LOGIC (GEMINI INTEGRATED) ---
    async function showActionCenter(alertId) {
        state.selectedAlert = state.alerts.find(a => a.id === alertId);
        if (!state.selectedAlert) return;

        const account = state.accounts.find(acc => acc.id === state.selectedAlert.account_id);
        
        if (!account) {
            alert(`Error: Could not find the corresponding account (ID: ${state.selectedAlert.account_id}) in your Constellation database.`);
            return;
        }
        
        // Show a temporary loading state in the modal
        showModal('Action Center', '<p class="placeholder-text">Generating AI suggestion...</p>', null, false, `<button id="modal-close-btn" class="btn-secondary">Close</button>`);
        document.getElementById('modal-close-btn').addEventListener('click', hideModal);

        // Fetch the AI-generated outreach copy
        const outreachCopy = await generateOutreachCopy(state.selectedAlert, account);

        const relevantContacts = state.contacts.filter(c => c.account_id === state.selectedAlert.account_id);
        const contactOptions = relevantContacts.map(c => `<option value="${c.id}">${c.first_name} ${c.last_name} (${c.title || 'No Title'})</option>`).join('');

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
            <div class="action-center-content">
                <div class="action-center-section">
                    <h5>Suggested Outreach</h5>
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
                <div class="action-center-section">
                    <h5>Log Actions in Constellation</h5>
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

        // Update the modal with the full content
        const modalBodyElement = document.getElementById('modal-body');
        if (modalBodyElement) {
            modalBodyElement.innerHTML = modalBody;
        }

        const contactSelector = document.getElementById('contact-selector');
        
        // Attach all event listeners FIRST
        document.getElementById('modal-close-btn').addEventListener('click', hideModal);
        contactSelector.addEventListener('change', handleContactChange);
        document.getElementById('send-email-btn').addEventListener('click', handleEmailAction);
        document.getElementById('copy-btn').addEventListener('click', handleCopyAction);
        document.getElementById('create-template-btn').addEventListener('click', handleCreateTemplate);
        document.getElementById('log-interaction-btn').addEventListener('click', handleLogInteraction);
        document.getElementById('create-task-btn').addEventListener('click', handleCreateTask);

        // THEN, set the suggested value and dispatch the event
        if (suggestedContactId) {
            contactSelector.value = suggestedContactId;
            contactSelector.dispatchEvent(new Event('change'));
        }
    }

    async function generateOutreachCopy(alert, account) {
        try {
            // Invoke the Supabase Edge Function
            const { data, error } = await supabase.functions.invoke('get-gemini-suggestion', {
                body: { alertData: alert, accountData: account }
            });

            if (error) {
                throw error;
            }
            
            // The edge function should return a JSON object with { subject, body }
            return data; 
        } catch (error) {
            console.error("Error invoking Supabase Edge Function:", error);
            // Provide a fallback template in case the AI call fails
            return { 
                subject: `Following up on ${account.name}'s latest news`, 
                body: `Hi [FirstName],\n\nI saw the recent news about "${alert.headline}" and wanted to reach out.\n\n[Could not generate AI suggestion. Please write your message here.]\n\nBest regards,\n[Your Name]`
            };
        }
    }

    // --- ACTION HANDLERS (Integration with Constellation) ---
    async function handleContactChange(e) {
        const selectedContactId = e.target.value;
        const outreachBodyTextarea = document.getElementById('outreach-body');
        const outreachSubjectInput = document.getElementById('outreach-subject');
        
        if (!outreachBodyTextarea || !outreachSubjectInput) return;

        // Generate the base AI copy first, regardless of contact selection
        const aiCopy = await generateOutreachCopy(state.selectedAlert, state.accounts.find(acc => acc.id === state.selectedAlert.account_id));
        outreachSubjectInput.value = aiCopy.subject; // Set the subject

        // Now, personalize the body with the selected contact
        if (selectedContactId) {
            const contact = state.contacts.find(c => c.id === Number(selectedContactId));
            if (contact) {
                outreachBodyTextarea.value = aiCopy.body.replace(/\[FirstName\]/g, `${contact.first_name}`);
            } else {
                 outreachBodyTextarea.value = aiCopy.body; // Use the generic version if contact not found
            }
        } else {
            outreachBodyTextarea.value = aiCopy.body; // Use the generic version if no contact is selected
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
            pageTitle.textContent = 'New Alerts';
            dashboardViewBtn.classList.add('active');
            archiveViewBtn.classList.remove('active');
            renderAlerts();
        });

        archiveViewBtn.addEventListener('click', () => {
            state.viewMode = 'archive';
            pageTitle.textContent = 'Intelligence Archive';
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
                showModal("Confirm Dismissal", "Are you sure you want to dismiss this alert?", () => {
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
