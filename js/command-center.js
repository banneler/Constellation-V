// js/command-center.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatDate,
    formatSimpleDate,
    addDays,
    themes,
    setupModalListeners,
    showModal,
    hideModal,
    updateActiveNavLink,
    setupUserMenuAndAuth,
    loadSVGs,
    setupGlobalSearch,
    checkAndSetNotifications
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const loadingScreen = document.getElementById('loading-screen');
    if (sessionStorage.getItem('showLoadingScreen') === 'true') {
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
            }, 7000);
        }
        sessionStorage.removeItem('showLoadingScreen');
    }

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // REFACTORED: Lean state object for performance.
    let state = {
        currentUser: null,
        contacts: [], // Kept for populating modals
        accounts: [], // Kept for populating modals
        manualTasks: [], // For the "My Tasks" list
        sequenceTasks: [], // For "Due Today" & "Upcoming" lists
        activities: [] // For the "Recent Activities" list
    };

    // --- DOM Element Selectors ---
    const dashboardTable = document.querySelector("#dashboard-table tbody");
    const recentActivitiesTable = document.querySelector("#recent-activities-table tbody");
    const allTasksTable = document.querySelector("#all-tasks-table tbody");
    const myTasksTable = document.querySelector("#my-tasks-table tbody");
    const addNewTaskBtn = document.getElementById("add-new-task-btn");
    const aiDailyBriefingBtn = document.getElementById("ai-daily-briefing-btn");
    const aiBriefingContainer = document.getElementById("ai-briefing-container");

    // --- Utility ---
    function getStartOfLocalDayISO() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today.toISOString();
    }

    function replacePlaceholders(template, contact, account) {
        if (!template) return '';
        let result = template;
        if (contact) {
            const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
            result = result.replace(/\[FirstName\]/gi, contact.first_name || '');
            result = result.replace(/\[LastName\]/gi, contact.last_name || '');
            result = result.replace(/\[FullName\]/gi, fullName);
            result = result.replace(/\[Name\]/gi, fullName);
        }
        if (account) {
            result = result.replace(/\[AccountName\]/gi, account.name || '');
            result = result.replace(/\[Account\]/gi, account.name || '');
        }
        return result;
    }

    // --- Data Fetching (REFACTORED for Performance) ---
    async function loadAllData() {
        if (!state.currentUser) return;
        if(myTasksTable) myTasksTable.innerHTML = '<tr><td colspan="4">Loading tasks...</td></tr>';
        if(dashboardTable) dashboardTable.innerHTML = '<tr><td colspan="6">Loading sequence tasks...</td></tr>';

        try {
            const [
                sequenceTasksResult,
                manualTasksResult,
                contactsResult,
                accountsResult,
                activitiesResult
            ] = await Promise.all([
                supabase.rpc('get_sales_tasks'),
                supabase.from('tasks').select('id, due_date, description, status, contact_id, account_id').eq('user_id', state.currentUser.id).eq('status', 'Pending'),
                supabase.from('contacts').select('*').eq("user_id", state.currentUser.id),
                supabase.from('accounts').select('*').eq("user_id", state.currentUser.id),
                supabase.from('activities').select('date, type, description, contact_id, account_id').eq('user_id', state.currentUser.id).order('date', { ascending: false }).limit(20)
            ]);

            const { data: sequenceTasks, error: seqError } = sequenceTasksResult;
            if (seqError) throw seqError;
            state.sequenceTasks = sequenceTasks || [];

            const { data: manualTasks, error: manualTaskError } = manualTasksResult;
            if (manualTaskError) throw manualTaskError;
            state.manualTasks = manualTasks || [];

            const { data: contacts, error: contactsError } = contactsResult;
            if (contactsError) throw contactsError;
            state.contacts = contacts || [];

            const { data: accounts, error: accountsError } = accountsResult;
            if (accountsError) throw accountsError;
            state.accounts = accounts || [];

            const { data: activities, error: activityError } = activitiesResult;
            if (activityError) throw activityError;
            state.activities = activities || [];

        } catch (error) {
            console.error("Critical error loading command center data:", error);
            if (myTasksTable) myTasksTable.innerHTML = `<tr><td colspan="4" class="error-text">Could not load tasks.</td></tr>`;
            if (dashboardTable) dashboardTable.innerHTML = `<tr><td colspan="6" class="error-text">Could not load sequence tasks.</td></tr>`;
        }
        
        renderDashboard();
    }
        
    // --- Core Logic ---
    async function completeStep(csId) {
        const { data: cs, error: csError } = await supabase.from('contact_sequences').select('sequence_id, current_step_number').eq('id', csId).single();
        if(csError || !cs) {
            console.error("Could not find contact sequence to complete.");
            return;
        }

        const { data: nextStep } = await supabase.from('sequence_steps')
            .select('step_number, delay_days')
            .eq('sequence_id', cs.sequence_id)
            .gt('step_number', cs.current_step_number)
            .order('step_number')
            .limit(1)
            .single();

        if (nextStep) {
            await supabase.from("contact_sequences").update({ current_step_number: nextStep.step_number, last_completed_date: new Date().toISOString(), next_step_due_date: addDays(new Date(), nextStep.delay_days).toISOString() }).eq("id", csId);
        } else {
            await supabase.from("contact_sequences").update({ status: "Completed" }).eq("id", csId);
        }
        
        await loadAllData();
    }

    // --- Render Function ---
    function renderDashboard() {
        if (!myTasksTable || !dashboardTable || !allTasksTable || !recentActivitiesTable) return;
        myTasksTable.innerHTML = "";
        dashboardTable.innerHTML = "";
        allTasksTable.innerHTML = "";
        recentActivitiesTable.innerHTML = "";

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        // Render Manual Tasks from state.manualTasks
        if (state.manualTasks.length > 0) {
            state.manualTasks.forEach(task => {
                const row = myTasksTable.insertRow();
                if (task.due_date && new Date(task.due_date).setHours(0,0,0,0) < startOfToday.getTime()) {
                    row.classList.add('past-due');
                }
                let linkedEntity = 'N/A';
                if (task.contact_id) {
                    const contact = state.contacts.find(c => c.id === task.contact_id);
                    if (contact) linkedEntity = `<a href="contacts.html?contactId=${contact.id}" class="contact-name-link">${contact.first_name} ${contact.last_name}</a> (Contact)`;
                } else if (task.account_id) {
                    const account = state.accounts.find(a => a.id === task.account_id);
                    if (account) linkedEntity = `<a href="accounts.html?accountId=${account.id}" class="contact-name-link">${account.name}</a> (Account)`;
                }
                row.innerHTML = `<td>${formatSimpleDate(task.due_date)}</td><td>${task.description}</td><td>${linkedEntity}</td>
                    <td>
                        <div class="button-group-wrapper">
                            <button class="btn-primary mark-task-complete-btn" data-task-id="${task.id}">Complete</button>
                            <button class="btn-secondary edit-task-btn" data-task-id="${task.id}">Edit</button>
                            <button class="btn-danger delete-task-btn" data-task-id="${task.id}">Delete</button>
                        </div>
                    </td>`;
            });
        } else {
            myTasksTable.innerHTML = '<tr><td colspan="4">No pending manual tasks. Great job!</td></tr>';
        }

        // Render Sequence Tasks from state.sequenceTasks
        const dueSequenceTasks = state.sequenceTasks.filter(task => new Date(task.due_date).setHours(0,0,0,0) <= startOfToday.getTime());
        const upcomingSequenceTasks = state.sequenceTasks.filter(task => new Date(task.due_date).setHours(0,0,0,0) > startOfToday.getTime());
        
        if (dueSequenceTasks.length > 0) {
            dueSequenceTasks.forEach(task => {
                const row = dashboardTable.insertRow();
                if (new Date(task.due_date).setHours(0,0,0,0) < startOfToday.getTime()) row.classList.add('past-due');
                let btnHtml;
                if (task.step_type.toLowerCase().includes("linkedin")) {
                    btnHtml = `<button class="btn-primary send-linkedin-message-btn" data-cs-id="${task.contact_sequence_id}">Send Message</button>`;
                } else if (task.step_type.toLowerCase().includes("email") && task.contact_email) {
                    btnHtml = `<button class="btn-primary send-email-btn" data-cs-id="${task.contact_sequence_id}">Send Email</button>`;
                } else {
                    btnHtml = `<button class="btn-primary complete-step-btn" data-id="${task.contact_sequence_id}">Complete</button>`;
                }
                row.innerHTML = `<td>${formatSimpleDate(task.due_date)}</td><td>${task.contact_name}</td><td>${task.sequence_name}</td><td>${task.step_number}: ${task.step_type}</td><td>${task.description}</td><td><div class="button-group-wrapper">${btnHtml}</div></td>`;
            });
        } else {
            dashboardTable.innerHTML = '<tr><td colspan="6">No sequence tasks due today.</td></tr>';
        }

        if (upcomingSequenceTasks.length > 0) {
            upcomingSequenceTasks.forEach(task => {
                const row = allTasksTable.insertRow();
                row.innerHTML = `<td>${formatSimpleDate(task.due_date)}</td><td>${task.contact_name}</td><td>${task.account_name || "N/A"}</td><td><div class="button-group-wrapper"><button class="btn-secondary revisit-step-btn" data-cs-id="${task.contact_sequence_id}">Revisit Last Step</button></div></td>`;
            });
        } else {
            allTasksTable.innerHTML = '<tr><td colspan="4">No upcoming sequence tasks.</td></tr>';
        }

        // Render Recent Activities
        state.activities.forEach(act => {
            const contact = state.contacts.find(c => c.id === act.contact_id);
            const account = act.account_id ? state.accounts.find(a => a.id === act.account_id) : (contact ? state.accounts.find(a => a.id === contact.account_id) : null);
            const row = recentActivitiesTable.insertRow();
            row.innerHTML = `<td>${formatDate(act.date)}</td><td>${account ? account.name : "N/A"}</td><td>${contact ? `${contact.first_name} ${contact.last_name}` : "N/A"}</td><td>${act.type}: ${act.description}</td>`;
        });
    }

    // --- EVENT LISTENER SETUP (Complete and Final) ---
    function setupPageEventListeners() {
        setupModalListeners();

        if (addNewTaskBtn) {
            addNewTaskBtn.addEventListener('click', () => {
                const contactsOptions = state.contacts.map(c => `<option value="c-${c.id}">${c.first_name} ${c.last_name} (Contact)</option>`).join('');
                const accountsOptions = state.accounts.map(a => `<option value="a-${a.id}">${a.name} (Account)</option>`).join('');
                showModal('Add New Task', `
                    <label>Description:</label><input type="text" id="modal-task-description" required>
                    <label>Due Date:</label><input type="date" id="modal-task-due-date">
                    <label>Link To (Optional):</label>
                    <select id="modal-task-linked-entity">
                        <option value="">-- None --</option>
                        <optgroup label="Contacts">${contactsOptions}</optgroup>
                        <optgroup label="Accounts">${accountsOptions}</optgroup>
                    </select>
                `, async () => {
                    const description = document.getElementById('modal-task-description').value.trim();
                    const dueDate = document.getElementById('modal-task-due-date').value;
                    const linkedEntityValue = document.getElementById('modal-task-linked-entity').value;
                    if (!description) { alert('Description is required.'); return; }
                    const taskData = { description, due_date: dueDate || null, user_id: state.currentUser.id, status: 'Pending' };
                    if (linkedEntityValue.startsWith('c-')) { taskData.contact_id = Number(linkedEntityValue.substring(2)); }
                    else if (linkedEntityValue.startsWith('a-')) { taskData.account_id = Number(linkedEntityValue.substring(2)); }
                    const { error } = await supabase.from('tasks').insert(taskData);
                    if (error) { alert('Error adding task: ' + error.message); }
                    else { await loadAllData(); }
                });
            });
        }
        
        document.body.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            if (button.matches('.mark-task-complete-btn')) {
                const taskId = button.dataset.taskId;
                showModal('Confirm Completion', 'Mark this task as completed?', async () => {
                    await supabase.from('tasks').update({ status: 'Completed' }).eq('id', taskId);
                    await loadAllData();
                });
            } else if (button.matches('.delete-task-btn')) {
                const taskId = button.dataset.taskId;
                showModal('Confirm Deletion', 'Are you sure you want to delete this task?', async () => {
                    await supabase.from('tasks').delete().eq('id', taskId);
                    await loadAllData();
                });
            } else if (button.matches('.edit-task-btn')) {
                const taskId = button.dataset.taskId;
                const task = state.manualTasks.find(t => t.id == taskId);
                if (!task) { alert('Task not found.'); return; }
                const contactsOptions = state.contacts.map(c => `<option value="c-${c.id}" ${c.id === task.contact_id ? 'selected' : ''}>${c.first_name} ${c.last_name} (Contact)</option>`).join('');
                const accountsOptions = state.accounts.map(a => `<option value="a-${a.id}" ${a.id === task.account_id ? 'selected' : ''}>${a.name} (Account)</option>`).join('');
                showModal('Edit Task', `
                    <label>Description:</label><input type="text" id="modal-task-description" value="${task.description}" required>
                    <label>Due Date:</label><input type="date" id="modal-task-due-date" value="${task.due_date ? new Date(task.due_date).toISOString().substring(0, 10) : ''}">
                    <label>Link To:</label>
                    <select id="modal-task-linked-entity">
                        <option value="">-- None --</option>
                        <optgroup label="Contacts">${contactsOptions}</optgroup>
                        <optgroup label="Accounts">${accountsOptions}</optgroup>
                    </select>
                `, async () => {
                    const newDescription = document.getElementById('modal-task-description').value.trim();
                    const newDueDate = document.getElementById('modal-task-due-date').value;
                    const linkedEntityValue = document.getElementById('modal-task-linked-entity').value;
                    if (!newDescription) { alert('Task description is required.'); return; }
                    const updateData = { description: newDescription, due_date: newDueDate || null, contact_id: null, account_id: null };
                    if (linkedEntityValue.startsWith('c-')) { updateData.contact_id = Number(linkedEntityValue.substring(2)); }
                    else if (linkedEntityValue.startsWith('a-')) { updateData.account_id = Number(linkedEntityValue.substring(2)); }
                    await supabase.from('tasks').update(updateData).eq('id', taskId);
                    await loadAllData();
                });
            } else if (button.matches('.send-email-btn')) {
                const csId = Number(button.dataset.csId);
                const { data: csData, error } = await supabase.from('contact_sequences')
                    .select(`*, contact:contacts(*, account:accounts(*)), sequence:sequences(*, steps:sequence_steps(*))`)
                    .eq('id', csId)
                    .single();
                if (error || !csData) return alert("Could not load sequence details.");
                
                const { contact, sequence } = csData;
                const step = sequence.steps.find(s => s.step_number === csData.current_step_number);
                if (!contact || !step) return alert("Contact or step not found.");

                const subject = replacePlaceholders(step.subject, contact, contact.account);
                const message = replacePlaceholders(step.message, contact, contact.account);
                showModal('Compose Email', `
                    <div class="form-group"><label>Subject:</label><input type="text" id="modal-email-subject" value="${subject.replace(/"/g, '&quot;')}"></div>
                    <div class="form-group"><label>Message:</label><textarea id="modal-email-body" rows="10">${message}</textarea></div>
                `, async () => {
                    const finalSubject = document.getElementById('modal-email-subject').value;
                    const finalMessage = document.getElementById('modal-email-body').value;
                    const mailtoLink = `mailto:${contact.email}?subject=${encodeURIComponent(finalSubject)}&body=${encodeURIComponent(finalMessage)}`;
                    window.open(mailtoLink, "_blank");
                    await completeStep(csId);
                }, true, `<button id="modal-confirm-btn" class="btn-primary">Send with Email Client</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);

            } else if (button.matches('.send-linkedin-message-btn')) {
                const csId = Number(button.dataset.csId);
                const { data: csData, error } = await supabase.from('contact_sequences')
                    .select(`*, contact:contacts(*, account:accounts(*)), sequence:sequences(*, steps:sequence_steps(*))`)
                    .eq('id', csId)
                    .single();
                if (error || !csData) return alert("Could not load sequence details.");

                const { contact, sequence } = csData;
                const step = sequence.steps.find(s => s.step_number === csData.current_step_number);
                if (!contact || !step) return alert("Contact or step not found.");
                
                const message = replacePlaceholders(step.message, contact, contact.account);
                const linkedinUrl = contact.linkedin_profile_url || 'https://www.linkedin.com/feed/';
                showModal('Compose LinkedIn Message', `
                    <p><strong>To:</strong> ${contact.first_name} ${contact.last_name}</p>
                    <p class="modal-sub-text">The message below will be copied to your clipboard.</p>
                    <div class="form-group"><label>Message:</label><textarea id="modal-linkedin-body" rows="10">${message}</textarea></div>
                `, async () => {
                    const finalMessage = document.getElementById('modal-linkedin-body').value;
                    await navigator.clipboard.writeText(finalMessage);
                    window.open(linkedinUrl, "_blank");
                    await completeStep(csId);
                }, true, `<button id="modal-confirm-btn" class="btn-primary">Copy & Open LinkedIn</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);

            } else if (button.matches('.complete-step-btn')) {
                const csId = Number(button.dataset.id);
                completeStep(csId);
            } else if (button.matches('.revisit-step-btn')) {
                const csId = Number(button.dataset.csId);
                const { data: contactSequence, error } = await supabase.from('contact_sequences').select('current_step_number').eq('id', csId).single();
                if (error || !contactSequence) return;
                const newStepNumber = Math.max(1, contactSequence.current_step_number - 1);
                showModal('Revisit Step', `Are you sure you want to go back to step ${newStepNumber}?`, async () => {
                    await supabase.from('contact_sequences').update({ current_step_number: newStepNumber, next_step_due_date: getStartOfLocalDayISO(), status: 'Active' }).eq('id', csId);
                    await loadAllData();
                });
            }
        });
    }

    // --- App Initialization ---
    async function initializePage() {
        await loadSVGs();
        updateActiveNavLink();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            state.currentUser = session.user;
            await setupUserMenuAndAuth(supabase, state);
            await setupGlobalSearch(supabase, state.currentUser);
            await checkAndSetNotifications(supabase);
            await loadAllData();
            
            if (aiDailyBriefingBtn) {
                aiDailyBriefingBtn.addEventListener('click', () => alert("AI Briefing is being updated."));
            }
            
            setupPageEventListeners();
        } else {
            window.location.href = "index.html";
        }
    }

    initializePage();
});
