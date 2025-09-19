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
    // --- UPDATED LOADING SCREEN LOGIC ---
    const loadingScreen = document.getElementById('loading-screen');
    if (sessionStorage.getItem('showLoadingScreen') === 'true') {
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
            }, 7000); // 7 seconds
        }
        sessionStorage.removeItem('showLoadingScreen');
    }
    // --- END OF UPDATED LOGIC ---

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        contacts: [],
        accounts: [],
        sequences: [],
        sequence_steps: [],
        activities: [],
        contact_sequences: [],
        tasks: [],
        salesTasks: [], // For ABM sequence tasks
        deals: [],
        cognitoAlerts: [],
        nurtureAccounts: [] // NEW: To hold accounts needing nurturing
    };

    // --- DOM Element Selectors ---
    const logoutBtn = document.getElementById("logout-btn");
    const dashboardTable = document.querySelector("#dashboard-table tbody");
    const recentActivitiesTable = document.querySelector("#recent-activities-table tbody");
    const allTasksTable = document.querySelector("#all-tasks-table tbody");
    const myTasksTable = document.querySelector("#my-tasks-table tbody");
    const addNewTaskBtn = document.getElementById("add-new-task-btn");
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const themeNameSpan = document.getElementById("theme-name");
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

    // --- Data Fetching ---
    async function loadSalesTasks() {
        const { data, error } = await supabase.rpc('get_sales_tasks');
        if (error) {
            console.error('Error fetching sales tasks:', error);
            state.salesTasks = [];
        } else {
            state.salesTasks = data || [];
        }
    }

    async function loadAllData() {
        if (!state.currentUser) return;
        if (myTasksTable) myTasksTable.innerHTML = '<tr><td colspan="4">Loading tasks...</td></tr>';

        const tableMap = {
            "contacts": "contacts",
            "accounts": "accounts",
            "sequences": "sequences",
            "activities": "activities",
            "contact_sequences": "contact_sequences",
            "deals": "deals",
            "tasks": "tasks",
            "cognito_alerts": "cognitoAlerts"
        };

        const userSpecificTables = Object.keys(tableMap);
        const publicTables = ["sequence_steps"];
        const userPromises = userSpecificTables.map(table => supabase.from(table).select("*").eq("user_id", state.currentUser.id));
        const publicPromises = publicTables.map(table => supabase.from(table).select("*"));
        
        // Add the new RPC call to the list of promises
        const allPromises = [loadSalesTasks(), ...userPromises, ...publicPromises];
        const allTableNames = [...userSpecificTables, ...publicTables]; // Note: table names don't perfectly align with promises anymore, but it's okay for the loop

        try {
            const results = await Promise.allSettled(allPromises);

            // Process results for table fetches (skip the first result which is from loadSalesTasks)
            results.slice(1).forEach((result, index) => {
                const tableName = allTableNames[index];
                const stateKey = tableMap[tableName] || tableName;
                if (result.status === "fulfilled" && result.value && !result.value.error) {
                    state[stateKey] = result.value.data || [];
                } else if (result.status === "fulfilled" && result.value && result.value.error) {
                    console.error(`Error fetching ${tableName}:`, result.value.error.message);
                    state[stateKey] = [];
                } else if (result.status === "rejected") {
                    console.error(`Error fetching ${tableName}:`, result.reason);
                    state[stateKey] = [];
                }
            });
        } catch (error) {
            console.error("Critical error in loadAllData:", error);
        }

        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const activeAccountIds = new Set(
            state.activities
            .filter(act => act.date && new Date(act.date) > sixtyDaysAgo)
            .map(act => {
                if (act.account_id) return act.account_id;
                const contact = state.contacts.find(c => c.id === act.contact_id);
                return contact ? contact.account_id : null;
            })
            .filter(id => id)
        );

        state.nurtureAccounts = state.accounts.filter(account => !activeAccountIds.has(account.id));

        renderDashboard();
    }

    // --- Core Logic ---
    async function handleCompleteSalesTask(contactSequenceStepId, activityDescription = null) {
        try {
            // Log the activity first
            const task = state.salesTasks.find(t => t.task_id === contactSequenceStepId);
            if (task) {
                await supabase.from("activities").insert([{
                    contact_id: task.contact_id,
                    account_id: task.account_id,
                    date: new Date().toISOString(),
                    type: `Sequence: ${task.step_type}`,
                    description: activityDescription || task.step_subject || `Completed step: ${task.step_type}`,
                    user_id: state.currentUser.id
                }]);
            }

            // Then, advance the sequence
            const { data: updatedSteps, error: updateError } = await supabase
                .from('contact_sequence_steps')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', contactSequenceStepId)
                .select('contact_sequence_id')
                .single();

            if (updateError) throw updateError;

            const { contact_sequence_id } = updatedSteps;
            const { data: contactSequence, error: csError } = await supabase
                .from('contact_sequences')
                .select('current_step_number, sequence_id')
                .eq('id', contact_sequence_id)
                .single();

            if (csError) throw csError;

            const { data: allSequenceSteps, error: stepsError } = await supabase
                .from('sequence_steps')
                .select('step_number, delay_days')
                .eq('sequence_id', contactSequence.sequence_id)
                .order('step_number');

            if (stepsError) throw stepsError;

            const nextStep = allSequenceSteps.find(s => s.step_number > contactSequence.current_step_number);

            let updateData = {};
            if (nextStep) {
                updateData = {
                    current_step_number: nextStep.step_number,
                    last_completed_date: new Date().toISOString(),
                    next_step_due_date: addDays(new Date(), nextStep.delay_days || 0).toISOString(),
                };
            } else {
                updateData = { status: 'Completed', next_step_due_date: null };
            }

            await supabase.from('contact_sequences').update(updateData).eq('id', contact_sequence_id);
            await loadAllData();

        } catch (error) {
            console.error('Error completing sales task:', error);
            alert('Error completing task: ' + error.message);
        }
    }

    // --- AI Briefing Logic ---
    async function handleGenerateBriefing() {
        aiBriefingContainer.classList.remove('hidden');
        aiBriefingContainer.innerHTML = `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">Generating your daily briefing...</p>`;

        try {
            const briefingPayload = {
                tasks: state.tasks.filter(t => t.status === 'Pending'),
                sequenceSteps: state.salesTasks.filter(t => new Date(t.task_due_date) <= new Date()),
                deals: state.deals,
                cognitoAlerts: state.cognitoAlerts,
                nurtureAccounts: state.nurtureAccounts,
                contacts: state.contacts,
                accounts: state.accounts,
                sequences: state.sequences,
                sequence_steps: state.sequence_steps
            };
            console.log("Payload being sent to Edge Function:", briefingPayload);
            const { data: briefing, error } = await supabase.functions.invoke('get-daily-briefing', {
                body: { briefingPayload }
            });
            if (error) throw error;
            renderAIBriefing(briefing);
        } catch (error) {
            console.error("Error generating AI briefing:", error);
            aiBriefingContainer.innerHTML = `<p class="error-text">Could not generate briefing. Please try again later.</p>`;
        }
    }

    function renderAIBriefing(briefing) {
        const greeting = `<h3>Howdy, Partner! Here are your top priorities:</h3>`;
        const briefingHtml = `
            ${greeting}
            <ol id="ai-briefing-list">
                ${briefing.priorities.map(item => `
                    <li>
                        <strong>${item.title}</strong>
                        <em>Why: ${item.reason}</em>
                    </li>
                `).join('')}
            </ol>
        `;
        aiBriefingContainer.innerHTML = briefingHtml;
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

        // Renders manual tasks (Unchanged)
        const pendingTasks = state.tasks.filter(task => task.status === 'Pending').sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        if (pendingTasks.length > 0) {
            pendingTasks.forEach(task => {
                const row = myTasksTable.insertRow();
                if (task.due_date) {
                    const taskDueDate = new Date(task.due_date);
                    if (taskDueDate.setHours(0, 0, 0, 0) < startOfToday.getTime()) {
                        row.classList.add('past-due');
                    }
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
            myTasksTable.innerHTML = '<tr><td colspan="4">No pending tasks. Great job!</td></tr>';
        }

        // Renders ABM sequence tasks (UPDATED LOGIC)
        const dueSequenceTasks = state.salesTasks
            .filter(task => new Date(task.task_due_date) <= new Date())
            .sort((a, b) => new Date(a.task_due_date) - new Date(b.task_due_date));

        if (dueSequenceTasks.length > 0) {
            dueSequenceTasks.forEach(task => {
                const row = dashboardTable.insertRow();
                const dueDate = new Date(task.task_due_date);
                if (dueDate < startOfToday) {
                    row.classList.add('past-due');
                }

                const contactName = `${task.contact_first_name || ''} ${task.contact_last_name || ''}`;
                const description = task.step_subject || task.step_message || '';

                let btnHtml;
                if (task.step_type.toLowerCase().includes("linkedin")) {
                    btnHtml = `<button class="btn-primary send-linkedin-message-btn" data-task-id="${task.task_id}">Send Message</button>`;
                } else if (task.step_type.toLowerCase().includes("email")) {
                    btnHtml = `<button class="btn-primary send-email-btn" data-task-id="${task.task_id}">Send Email</button>`;
                } else {
                    btnHtml = `<button class="btn-primary complete-step-btn" data-task-id="${task.task_id}">Complete</button>`;
                }

                row.innerHTML = `
                    <td>${formatSimpleDate(task.task_due_date)}</td>
                    <td>${contactName}</td>
                    <td>${task.sequence_name}</td>
                    <td>${task.step_type}</td>
                    <td>${description}</td>
                    <td><div class="button-group-wrapper">${btnHtml}</div></td>
                `;
            });
        } else {
            dashboardTable.innerHTML = '<tr><td colspan="6">No sequence steps due today.</td></tr>';
        }

        // Renders upcoming sequence tasks (UPDATED LOGIC)
        const upcomingSequenceTasks = state.salesTasks
            .filter(task => new Date(task.task_due_date) > new Date())
            .sort((a, b) => new Date(a.task_due_date) - new Date(b.task_due_date));
        
        if (upcomingSequenceTasks.length > 0) {
            upcomingSequenceTasks.forEach(task => {
                const row = allTasksTable.insertRow();
                const contactName = `${task.contact_first_name || ''} ${task.contact_last_name || ''}`;
                row.innerHTML = `<td>${formatSimpleDate(task.task_due_date)}</td><td>${contactName}</td><td>${task.account_name || "N/A"}</td><td>Next Step: ${task.step_type}</td>`;
            });
        } else {
             allTasksTable.innerHTML = '<tr><td colspan="4">No upcoming sequence tasks.</td></tr>';
        }

        // Renders recent activities (Unchanged)
        state.activities
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 20)
            .forEach(act => {
                const contact = state.contacts.find(c => c.id === act.contact_id);
                const account = act.account_id ? state.accounts.find(a => a.id === act.account_id) : (contact ? state.accounts.find(a => a.id === contact.account_id) : null);
                const row = recentActivitiesTable.insertRow();
                row.innerHTML = `<td>${formatDate(act.date)}</td><td>${account ? account.name : "N/A"}</td><td>${contact ? `${contact.first_name} ${contact.last_name}` : "N/A"}</td><td>${act.type}: ${act.description}</td>`;
            });
    }

    // --- EVENT LISTENER SETUP ---
    function setupPageEventListeners() {
        setupModalListeners();
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                await supabase.auth.signOut();
                window.location.href = "index.html";
            });
        }
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
                    if (!description) { alert('Description is required.'); return false; }
                    const taskData = { description, due_date: dueDate || null, user_id: state.currentUser.id, status: 'Pending' };
                    if (linkedEntityValue.startsWith('c-')) { taskData.contact_id = Number(linkedEntityValue.substring(2)); } 
                    else if (linkedEntityValue.startsWith('a-')) { taskData.account_id = Number(linkedEntityValue.substring(2)); }
                    const { error } = await supabase.from('tasks').insert(taskData);
                    if (error) { alert('Error adding task: ' + error.message); return false; }
                    
                    await loadAllData();
                    return true;
                });
            });
        }
        document.body.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            // Manual task completion (Unchanged)
            if (button.matches('.mark-task-complete-btn')) {
                const taskId = button.dataset.taskId;
                showModal('Confirm Completion', 'Mark this manual task as completed?', async () => {
                    await supabase.from('tasks').update({ status: 'Completed' }).eq('id', taskId);
                    await loadAllData();
                    hideModal();
                });
            } else if (button.matches('.delete-task-btn')) {
                const taskId = button.dataset.taskId;
                showModal('Confirm Deletion', 'Are you sure you want to delete this manual task?', async () => {
                    await supabase.from('tasks').delete().eq('id', taskId);
                    await loadAllData();
                    hideModal();
                });
            } else if (button.matches('.edit-task-btn')) {
                const taskId = button.dataset.taskId;
                const task = state.tasks.find(t => t.id == taskId);
                if (!task) { alert('Task not found.'); return; }
                const contactsOptions = state.contacts.map(c => `<option value="c-${c.id}" ${c.id === task.contact_id ? 'selected' : ''}>${c.first_name} ${c.last_name} (Contact)</option>`).join('');
                const accountsOptions = state.accounts.map(a => `<option value="a-${a.id}" ${a.id === task.account_id ? 'selected' : ''}>${a.name} (Account)</option>`).join('');
                showModal('Edit Task', `...`, async () => { /* ... */ });
            
            // Sequence task completion (UPDATED LOGIC)
            } else if (button.matches('.complete-step-btn')) {
                const taskId = Number(button.dataset.taskId);
                showModal('Confirm Task', 'Mark this sequence step as complete?', async () => {
                    await handleCompleteSalesTask(taskId);
                    hideModal();
                });

            // Email and LinkedIn handlers (UPDATED LOGIC)
            } else if (button.matches('.send-email-btn')) {
                const taskId = Number(button.dataset.taskId);
                const task = state.salesTasks.find(t => t.task_id === taskId);
                if (!task) return alert("Sales task not found.");
                
                const contact = state.contacts.find(c => c.id === task.contact_id);
                if (!contact || !contact.email) return alert("Contact email not found.");
                
                const account = state.accounts.find(a => a.id === task.account_id);
                const subject = replacePlaceholders(task.step_subject, contact, account);
                const message = replacePlaceholders(task.step_message, contact, account);

                showModal('Compose Email', `...`, async () => {
                    const finalSubject = document.getElementById('modal-email-subject').value;
                    const finalMessage = document.getElementById('modal-email-body').value;
                    const mailtoLink = `mailto:${contact.email}?subject=${encodeURIComponent(finalSubject)}&body=${encodeURIComponent(finalMessage)}`;
                    window.open(mailtoLink, "_blank");
                    await handleCompleteSalesTask(taskId, `Email Sent: ${finalSubject}`);
                    return true;
                });
            } else if (button.matches('.send-linkedin-message-btn')) {
                const taskId = Number(button.dataset.taskId);
                const task = state.salesTasks.find(t => t.task_id === taskId);
                if (!task) return alert("Sales task not found.");

                const contact = state.contacts.find(c => c.id === task.contact_id);
                if (!contact) return alert("Contact not found.");

                const account = state.accounts.find(a => a.id === task.account_id);
                const message = replacePlaceholders(task.step_message, contact, account);
                const linkedinUrl = contact.linkedin_profile_url || 'https://www.linkedin.com/feed/';

                showModal('Compose LinkedIn Message', `...`, async () => {
                    const finalMessage = document.getElementById('modal-linkedin-body').value;
                    await navigator.clipboard.writeText(finalMessage);
                    window.open(linkedinUrl, "_blank");
                    await handleCompleteSalesTask(taskId, "LinkedIn Message Sent");
                    return true;
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

            const aiDailyBriefingBtn = document.getElementById("ai-daily-briefing-btn");
            if (aiDailyBriefingBtn) {
                aiDailyBriefingBtn.addEventListener('click', handleGenerateBriefing);
            }

            setupPageEventListeners();
        } else {
            window.location.href = "index.html";
        }
    }

    initializePage();
});
