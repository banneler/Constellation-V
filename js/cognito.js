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

    // --- MODAL ELEMENTS (Dynamic, fetched after modal body is rendered) ---
    // These will be re-selected within showActionCenter or a helper function
    // to ensure they exist after modal content is updated.
    let initialAiSuggestionSection, refineSuggestionBtn, outreachSubjectInput, outreachBodyTextarea;
    let customPromptSection, customPromptInput, generateCustomBtn, cancelCustomBtn, customSuggestionOutput;
    let customOutreachSubjectInput, customOutreachBodyTextarea;
    let copyCustomBtn, createTemplateCustomBtn, sendEmailCustomBtn;
    let contactSelector, logInteractionNotes, logInteractionBtn, createTaskDesc, createTaskDueDate, createTaskBtn, noContactMessage;


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
        
        // Show a temporary loading state in the modal immediately
        showModal('Action Center', '<p class="placeholder-text">Generating AI suggestion...</p>', null, false, `<button id="modal-close-btn" class="btn-secondary">Close</button>`);
        document.getElementById('modal-close-btn').addEventListener('click', hideModal);

        // Fetch the initial AI-generated outreach copy in the background
        const initialOutreachCopy = await generateOutreachCopy(state.selectedAlert, account);

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
        
        // Construct the full modal body (now including the custom prompt sections)
        const modalBodyContent = `
            <div class="action-center-content">
                <div class="action-center-section">
                    <h5>Suggested Outreach</h5>
                    <label for="contact-selector">Suggested Contact:</label>
                    <select id="contact-selector" ${relevantContacts.length === 0 ? 'disabled' : ''}>
                        <option value="">-- Select a Contact --</option>
                        ${contactOptions}
                    </select>
                    
                    <div id="initial-ai-suggestion-section">
                        <label for="outreach-subject">Suggested Subject:</label>
                        <input type="text" id="outreach-subject" value="${initialOutreachCopy.subject}" readonly>
                        <label for="outreach-body">Suggested Body:</label>
                        <textarea id="outreach-body" rows="8" readonly>${initialOutreachCopy.body}</textarea>
                        <div class="action-buttons">
                            <button class="btn-secondary" id="copy-btn">Copy</button>
                            <button class="btn-secondary" id="create-template-btn">Create Campaign Email Template</button>
                            <button class="btn-primary" id="send-email-btn">Open Email Client</button>
                        </div>
                        <button class="btn-tertiary" id="refine-suggestion-btn" style="margin-top: 15px;">Refine with Custom Prompt</button>
                    </div>

                    <div id="custom-prompt-section" style="display: none; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border-color);">
                        <h5>Custom Suggestion Generator</h5>
                        <p class="placeholder-text">Enter your specific instructions to refine or get a new email suggestion based on the alert.</p>
                        <label for="custom-prompt-input">Your Custom Prompt:</label>
                        <textarea id="custom-prompt-input" rows="4" placeholder="e.g., 'Make the email more urgent and focus on a direct call to action for a meeting.'"></textarea>
                        <button class="btn-primary" id="generate-custom-btn" style="width: 100%; margin-top: 10px;">Generate Custom Suggestion</button>
                        <button class="btn-secondary" id="cancel-custom-btn" style="width: 100%; margin-top: 10px;">Back to Initial Suggestion</button>

                        <div id="custom-suggestion-output" style="display: none; margin-top: 20px; padding-top: 15px; border-top: 1px dashed var(--border-color);">
                            <h6>Custom AI Suggestion:</h6>
                            <label for="custom-outreach-subject">Subject:</label>
                            <input type="text" id="custom-outreach-subject" value="" readonly>
                            <label for="custom-outreach-body">Body:</label>
                            <textarea id="custom-outreach-body" rows="8" readonly></textarea>
                            <div class="action-buttons">
                                <button class="btn-secondary" id="copy-custom-btn">Copy Custom</button>
                                <button class="btn-secondary" id="create-template-custom-btn">Create Custom Template</button>
                                <button class="btn-primary" id="send-email-custom-btn">Open Email Client (Custom)</button>
                            </div>
                        </div>
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
                    
                    <p class="placeholder-text" style="color: var(--warning-yellow); margin-top: 10px; ${relevantContacts.length === 0 ? '' : 'display: none;'}" id="no-contact-message">
                        Add a contact to this account in Constellation to enable logging and task creation.
                    </p>
                </div>
            </div>`;

        // Now that the AI content has arrived, replace the loading message with the full modal body
        const modalBodyElement = document.getElementById('modal-body');
        if (modalBodyElement) {
            modalBodyElement.innerHTML = modalBodyContent; 
        }

        // Re-select all elements now that they are in the DOM
        contactSelector = document.getElementById('contact-selector');
        initialAiSuggestionSection = document.getElementById('initial-ai-suggestion-section');
        refineSuggestionBtn = document.getElementById('refine-suggestion-btn');
        outreachSubjectInput = document.getElementById('outreach-subject');
        outreachBodyTextarea = document.getElementById('outreach-body');

        customPromptSection = document.getElementById('custom-prompt-section');
        customPromptInput = document.getElementById('custom-prompt-input');
        generateCustomBtn = document.getElementById('generate-custom-btn');
        cancelCustomBtn = document.getElementById('cancel-custom-btn');
        customSuggestionOutput = document.getElementById('custom-suggestion-output');
        customOutreachSubjectInput = document.getElementById('custom-outreach-subject');
        customOutreachBodyTextarea = document.getElementById('custom-outreach-body');
        copyCustomBtn = document.getElementById('copy-custom-btn');
        createTemplateCustomBtn = document.getElementById('create-template-custom-btn');
        sendEmailCustomBtn = document.getElementById('send-email-custom-btn');

        logInteractionNotes = document.getElementById('log-interaction-notes');
        logInteractionBtn = document.getElementById('log-interaction-btn');
        createTaskDesc = document.getElementById('create-task-desc');
        createTaskDueDate = document.getElementById('create-task-due-date');
        createTaskBtn = document.getElementById('create-task-btn');
        noContactMessage = document.getElementById('no-contact-message');

        // Initial state for custom prompt section
        initialAiSuggestionSection.style.display = 'block';
        customPromptSection.style.display = 'none';

        // Re-attach all the necessary event listeners to the new content
        document.getElementById('modal-close-btn').addEventListener('click', hideModal);
        contactSelector.addEventListener('change', handleContactChange);
        document.getElementById('send-email-btn').addEventListener('click', () => handleEmailAction(false)); // Not custom
        document.getElementById('copy-btn').addEventListener('click', () => handleCopyAction(false)); // Not custom
        document.getElementById('create-template-btn').addEventListener('click', () => handleCreateTemplate(false)); // Not custom
        document.getElementById('log-interaction-btn').addEventListener('click', handleLogInteraction);
        document.getElementById('create-task-btn').addEventListener('click', handleCreateTask);

        // --- NEW CUSTOM PROMPT EVENT LISTENERS ---
        refineSuggestionBtn.addEventListener('click', () => {
            console.log("Refine button clicked. Hiding initial suggestion and showing custom prompt section."); // DEBUG LOG
            initialAiSuggestionSection.style.display = 'none';
            customPromptSection.style.display = 'block';
            customSuggestionOutput.style.display = 'none'; // Hide output when showing input
            customPromptInput.value = ''; // Clear previous prompt
            customOutreachSubjectInput.value = ''; // Clear previous custom result
            customOutreachBodyTextarea.value = ''; // Clear previous custom result
        });

        cancelCustomBtn.addEventListener('click', () => {
            console.log("Cancel custom prompt button clicked. Showing initial suggestion."); // DEBUG LOG
            customPromptSection.style.display = 'none';
            initialAiSuggestionSection.style.display = 'block';
        });

        generateCustomBtn.addEventListener('click', async () => {
            console.log("Generate custom button clicked."); // DEBUG LOG
            const customPrompt = customPromptInput.value.trim();
            console.log("Value of customPromptInput (raw):", customPromptInput.value); // DEBUG LOG
            console.log("Trimmed customPrompt:", customPrompt); // DEBUG LOG

            if (!customPrompt) {
                alert("Please enter a prompt to generate a custom suggestion.");
                console.log("Custom prompt was empty, showing alert."); // DEBUG LOG
                return;
            }

            // Show loading state
            generateCustomBtn.disabled = true;
            generateCustomBtn.textContent = 'Generating...';
            customOutreachSubjectInput.value = 'Generating...';
            customOutreachBodyTextarea.value = 'Generating...';
            console.log("Calling generateCustomOutreachCopy..."); // DEBUG LOG

            const customOutreachCopy = await generateCustomOutreachCopy(state.selectedAlert, account, customPrompt);

            // Hide loading state
            generateCustomBtn.disabled = false;
            generateCustomBtn.textContent = 'Generate Custom Suggestion';
            console.log("generateCustomOutreachCopy returned:", customOutreachCopy); // DEBUG LOG

            if (customOutreachCopy) {
                customOutreachSubjectInput.value = customOutreachCopy.subject;
                customOutreachBodyTextarea.value = customOutreachCopy.body;
                customSuggestionOutput.style.display = 'block';
                // Adjust body for selected contact if any
                handlePersonalizeOutreach({ subject: customOutreachCopy.subject, body: customOutreachCopy.body }, contactSelector.value, true);
            } else {
                 customOutreachSubjectInput.value = 'Error generating suggestion.';
                 customOutreachBodyTextarea.value = 'Please try again or check the console for details.';
                 console.error("Custom outreach copy was null or undefined."); // DEBUG LOG
            }
        });

        // Event listeners for custom suggestion action buttons
        copyCustomBtn.addEventListener('click', () => handleCopyAction(true)); // Pass true for custom
        createTemplateCustomBtn.addEventListener('click', () => handleCreateTemplate(true)); // Pass true for custom
        sendEmailCustomBtn.addEventListener('click', () => handleEmailAction(true)); // Pass true for custom


        // Set the suggested value and dispatch the event
        if (suggestedContactId) {
            contactSelector.value = suggestedContactId;
            contactSelector.dispatchEvent(new Event('change'));
        }

        // Adjust disabled states and messages based on relevantContacts
        if (relevantContacts.length === 0) {
            logInteractionNotes.disabled = true;
            logInteractionBtn.disabled = true;
            createTaskDesc.disabled = true;
            createTaskDueDate.disabled = true;
            createTaskBtn.disabled = true;
            noContactMessage.style.display = 'block';
        } else {
            logInteractionNotes.disabled = false;
            logInteractionBtn.disabled = false;
            createTaskDesc.disabled = false;
            createTaskDueDate.disabled = false;
            createTaskBtn.disabled = false;
            noContactMessage.style.display = 'none';
        }
    }

    // Function to handle personalization of any outreach (initial or custom)
    function handlePersonalizeOutreach(outreachCopy, selectedContactId, isCustomTarget = false) {
        const targetBodyTextarea = isCustomTarget ? customOutreachBodyTextarea : outreachBodyTextarea;
        if (!targetBodyTextarea) {
            console.error("Target textarea not found for personalization."); // DEBUG LOG
            return; // Safeguard
        }

        if (selectedContactId) {
            const contact = state.contacts.find(c => c.id === Number(selectedContactId));
            if (contact) {
                targetBodyTextarea.value = outreachCopy.body.replace(/\[FirstName\]/g, `${contact.first_name}`);
            } else {
                targetBodyTextarea.value = outreachCopy.body;
            }
        } else {
            targetBodyTextarea.value = outreachCopy.body;
        }
        console.log("Personalization applied to", isCustomTarget ? "custom" : "initial", "outreach."); // DEBUG LOG
    }

    async function generateOutreachCopy(alert, account) {
        try {
            console.log("Invoking get-gemini-suggestion Edge Function..."); // DEBUG LOG
            const { data, error } = await supabase.functions.invoke('get-gemini-suggestion', {
                body: { alertData: alert, accountData: account }
            });

            if (error) {
                throw error;
            }
            
            console.log("get-gemini-suggestion returned data:", data); // DEBUG LOG
            return data; 
        } catch (error) {
            console.error("Error invoking get-gemini-suggestion Edge Function:", error);
            return { 
                subject: `Following up on ${account.name}'s latest news`, 
                body: `Hi [FirstName],\n\nI saw the recent news about "${alert.headline}" and wanted to reach out.\n\n[Could not generate AI suggestion. Please write your message here.]\n\nBest regards,\n[Your Name]`
            };
        }
    }

    // NEW FUNCTION: For custom prompt generation
    async function generateCustomOutreachCopy(alert, account, customPrompt) {
        try {
            console.log("Invoking generate-custom-suggestion Edge Function..."); // DEBUG LOG
            const { data, error } = await supabase.functions.invoke('generate-custom-suggestion', {
                body: { alertData: alert, accountData: account, customPrompt: customPrompt }
            });

            if (error) {
                throw error;
            }
            
            console.log("generate-custom-suggestion returned data:", data); // DEBUG LOG
            return data;
        } catch (error) {
            console.error("Error invoking generate-custom-suggestion Edge Function:", error);
            return {
                subject: `Custom Suggestion Error: ${account.name}'s news`,
                body: `Hi [FirstName],\n\n[Failed to generate custom AI suggestion: ${error.message}]\n\nBest regards,\n[Your Name]`
            };
        }
    }

    // --- ACTION HANDLERS (Integration with Constellation) ---
    async function handleContactChange(e) {
        const selectedContactId = e.target.value;
        console.log("Contact selector changed to:", selectedContactId); // DEBUG LOG
        
        // Always generate the base AI copy for the default suggestion fields
        // This ensures the initial suggestion is re-personalilzed if contact changes
        const initialAiCopy = await generateOutreachCopy(state.selectedAlert, state.accounts.find(acc => acc.id === state.selectedAlert.account_id));
        outreachSubjectInput.value = initialAiCopy.subject; // Set the subject for initial suggestion
        handlePersonalizeOutreach(initialAiCopy, selectedContactId, false); // Personalize initial body

        // Also update the custom suggestion body if it's currently displayed
        if (customSuggestionOutput && customSuggestionOutput.style.display === 'block') {
             const currentCustomSubject = customOutreachSubjectInput.value;
             const currentCustomBody = customOutreachBodyTextarea.value;
             if (currentCustomSubject && currentCustomBody) { // Only re-personalize if there's content
                 handlePersonalizeOutreach({subject: currentCustomSubject, body: currentCustomBody}, selectedContactId, true);
             }
        }
    }

    function handleEmailAction(isCustom = false) { 
        console.log("Email action triggered. Is custom:", isCustom); // DEBUG LOG
        const contactId = contactSelector.value;
        if (!contactId) {
            alert('Please select a contact to email.');
            return;
        }
        const contact = state.contacts.find(c => c.id === Number(contactId));
        if (!contact || !contact.email) {
            alert('Selected contact does not have an email address.');
            return;
        }

        const subject = isCustom ? customOutreachSubjectInput.value : outreachSubjectInput.value;
        const body = isCustom ? customOutreachBodyTextarea.value : outreachBodyTextarea.value;
        window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }

    function handleCopyAction(isCustom = false) { 
        console.log("Copy action triggered. Is custom:", isCustom); // DEBUG LOG
        const body = isCustom ? customOutreachBodyTextarea.value : outreachBodyTextarea.value;
        navigator.clipboard.writeText(body).then(() => {
            alert('Email body copied to clipboard!');
        });
    }

    async function handleCreateTemplate(isCustom = false) { 
        console.log("Create template action triggered. Is custom:", isCustom); // DEBUG LOG
        const templateName = prompt("Please enter a name for your new email template:");
        if (!templateName || templateName.trim() === '') {
            alert("Template name cannot be empty.");
            return;
        }

        const subject = isCustom ? customOutreachSubjectInput.value : outreachSubjectInput.value;
        const body = isCustom ? customOutreachBodyTextarea.value : outreachBodyTextarea.value;

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
        console.log("Log interaction triggered."); // DEBUG LOG
        const selectedContactId = contactSelector.value;
        if (!selectedContactId) {
            alert('Please select a contact to log this interaction against.');
            return;
        }

        const notes = logInteractionNotes.value.trim();
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
            logInteractionNotes.value = '';
            await updateAlertStatus(state.selectedAlert.id, 'Actioned');
            hideModal();
        }
    }

    async function handleCreateTask() {
        console.log("Create task triggered."); // DEBUG LOG
        const selectedContactId = contactSelector.value;
        if (!selectedContactId) {
            alert('Please select a contact to associate with this task.');
            return;
        }
        
        const description = createTaskDesc.value.trim();
        const dueDate = createTaskDueDate.value;
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
            createTaskDesc.value = '';
            createTaskDueDate.value = '';
            await updateAlertStatus(state.selectedAlert.id, 'Actioned');
            hideModal();
        }
    }

    async function updateAlertStatus(alertId, newStatus) {
        console.log(`Updating alert ${alertId} status to ${newStatus}.`); // DEBUG LOG
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
