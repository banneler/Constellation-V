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
    // --- LOADING SCREEN LOGIC ---
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

    let state = {
        currentUser: null,
        contacts: [],
        accounts: [],
        sequences: [],
        sequence_steps: [],
        activities: [],
        contact_sequences: [],
        tasks: [],
        deals: [],
        cognitoAlerts: [],
        nurtureAccounts: [],
        salesTasks: [] // NEW: To hold tasks from our RPC call
    };

    // --- DOM Element Selectors ---
    const dueTasksTable = document.querySelector("#due-tasks-table tbody");
    const upcomingTasksTable = document.querySelector("#upcoming-tasks-table tbody");
    const myTasksTable = document.querySelector("#my-tasks-table tbody");
    const recentActivitiesTable = document.querySelector("#recent-activities-table tbody");
    const addNewTaskBtn = document.getElementById("add-new-task-btn");
    const aiDailyBriefingBtn = document.getElementById("ai-daily-briefing-btn");
    const aiBriefingContainer = document.getElementById("ai-briefing-container");

    // --- Utility ---
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
    async function loadAllData() {
        if (!state.currentUser) return;
        if(myTasksTable) myTasksTable.innerHTML = '<tr><td colspan="4">Loading tasks...</td></tr>';
        
        try {
            // UPDATED: Fetch sales tasks with our RPC, and fetch other data in parallel
            const [
                salesTasksRes,
                contactsRes,
                accountsRes,
                sequencesRes,
                activitiesRes,
                contactSequencesRes,
                dealsRes,
                tasksRes,
                cognitoAlertsRes,
                sequenceStepsRes
            ] = await Promise.all([
                supabase.rpc('get_sales_tasks'),
                supabase.from('contacts').select('*').eq('user_id', state.currentUser.id),
                supabase.from('accounts').select('*').eq('user_id', state.currentUser.id),
                supabase.from('sequences').select('*').eq('user_id', state.currentUser.id),
                supabase.from('activities').select('*').eq('user_id', state.currentUser.id),
                supabase.from('contact_sequences').select('*').eq('user_id', state.currentUser.id),
                supabase.from('deals').select('*').eq('user_id', state.currentUser.id),
                supabase.from('tasks').select('*').eq('user_id', state.currentUser.id),
                supabase.from('cognito_alerts').select('*').eq('user_id', state.currentUser.id),
                supabase.from('sequence_steps').select('*') // Still need this for context
            ]);

            const processResponse = (res, tableName) => {
                if (res.error) console.error(`Error loading ${tableName}:`, res.error.message);
                return res.data || [];
            };

            state.salesTasks = processResponse(salesTasksRes, 'sales_tasks');
            state.contacts = processResponse(contactsRes, 'contacts');
            state.accounts = processResponse(accountsRes, 'accounts');
            state.sequences = processResponse(sequencesRes, 'sequences');
            state.activities = processResponse(activitiesRes, 'activities');
            state.contact_sequences = processResponse(contactSequencesRes, 'contact_sequences');
            state.deals = processResponse(dealsRes, 'deals');
            state.tasks = processResponse(tasksRes, 'tasks');
            state.cognitoAlerts = processResponse(cognitoAlertsRes, 'cognito_alerts');
            state.sequence_steps = processResponse(sequenceStepsRes, 'sequence_steps');

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
            
    // --- NEW: Core Task & Step Completion Logic for the ABM System ---
    async function completeSequenceStep(taskStepId) {
        try {
            const { data: updatedSteps, error: updateError } = await supabase
                .from('contact_sequence_steps')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', taskStepId)
                .select();
    
            if (updateError) throw updateError;
            if (!updatedSteps || updatedSteps.length === 0) {
                alert("This task may have already been completed or removed.");
                return;
            }
    
            const completedStep = updatedSteps[0];
            const { contact_sequence_id, sequence_id, contact_id } = completedStep;

            const contact = state.contacts.find((c) => c.id === contact_id);
            const step_details = state.sequence_steps.find(s => s.id === completedStep.sequence_step_id);

            // Log activity for the completed step
            if (contact && step_details) {
                const account = contact.account_id ? state.accounts.find(a => a.id === contact.account_id) : null;
                const rawDescription = step_details.subject || step_details.message || "Completed step";
                const finalDescription = replacePlaceholders(rawDescription, contact, account);
                await supabase.from("activities").insert([{
                    contact_id: contact.id,
                    account_id: contact.account_id,
                    date: new Date().toISOString(),
                    type: `Sequence: ${step_details.type}`,
                    description: finalDescription,
                    user_id: state.currentUser.id
                }]);
            }

            const { data: contactSequences, error: csError } = await supabase
                .from('contact_sequences')
                .select('current_step_number')
                .eq('id', contact_sequence_id);

            if (csError) throw csError;
            if (!contactSequences || contactSequences.length === 0) return;
            const contactSequence = contactSequences[0];

            const { data: allSequenceSteps, error: stepsError } = await supabase
                .from('sequence_steps')
                .select('step_number, delay_days')
                .eq('sequence_id', sequence_id)
                .order('step_number');

            if (stepsError) throw stepsError;
            
            const currentStepNumber = contactSequence.current_step_number;
            const nextStep = allSequenceSteps.find(s => s.step_number > currentStepNumber);

            let updateData = {};
            if (nextStep) {
                const nextDueDate = new Date();
                nextDueDate.setDate(nextDueDate.getDate() + (nextStep.delay_days || 0));
                updateData = {
                    current_step_number: nextStep.step_number,
                    last_completed_date: new Date().toISOString(),
                    next_step_due_date: nextDueDate.toISOString(),
                };
            } else {
                updateData = {
                    status: 'Completed',
                    last_completed_date: new Date().toISOString(),
                    next_step_due_date: null,
                    current_step_number: null 
                };
            }

            const { error: advanceError } = await supabase
                .from('contact_sequences')
                .update(updateData)
                .eq('id', contact_sequence_id);

            if (advanceError) throw advanceError;

            // If it was the last step, clean up all associated steps from the to-do list
            if (updateData.status === 'Completed') {
                await supabase.from('contact_sequence_steps').delete().eq('contact_sequence_id', contact_sequence_id);
            }

        } catch (error) {
            console.error("Error completing step:", error);
            alert("Error completing step: " + error.message);
        } finally {
            await loadAllData();
        }
    }

    // --- Render Function ---
    function renderDashboard() {
        if (!myTasksTable || !dueTasksTable || !upcomingTasksTable || !recentActivitiesTable) return;
        myTasksTable.innerHTML = "";
        dueTasksTable.innerHTML = "";
        upcomingTasksTable.innerHTML = "";
        recentActivitiesTable.innerHTML = "";
    
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
    
        // UPDATED: Filter salesTasks from our RPC call
        const dueSequenceTasks = (state.salesTasks || []).filter(task => new Date(task.task_due_date) <= endOfToday);
        const upcomingSequenceTasks = (state.salesTasks || []).filter(task => new Date(task.task_due_date) > endOfToday);
    
        // Render Due Sequence Tasks
        if (dueSequenceTasks.length > 0) {
            dueSequenceTasks.forEach(task => {
                const row = dueTasksTable.insertRow();
                row.innerHTML = `
                    <td>${formatSimpleDate(task.task_due_date)}</td>
                    <td><a href="contacts.html?contactId=${task.contact_id}" class="contact-name-link">${task.contact_first_name} ${task.contact_last_name}</a></td>
                    <td>${task.sequence_name}</td>
                    <td>${task.step_type}</td>
                    <td>${task.step_subject || 'N/A'}</td>
                    <td><div class="button-group-wrapper"><button class="btn-primary complete-step-btn" data-task-id="${task.task_id}">Complete</button></div></td>
                `;
            });
        } else {
            dueTasksTable.innerHTML = '<tr><td colspan="6">No sequence tasks due today.</td></tr>';
        }
    
        // Render Upcoming Sequence Tasks
        if (upcomingSequenceTasks.length > 0) {
            upcomingSequenceTasks.forEach(task => {
                const row = upcomingTasksTable.insertRow();
                row.innerHTML = `
                    <td>${formatSimpleDate(task.task_due_date)}</td>
                    <td><a href="contacts.html?contactId=${task.contact_id}" class="contact-name-link">${task.contact_first_name} ${task.contact_last_name}</a></td>
                    <td>${task.sequence_name}</td>
                    <td>${task.step_type}: ${task.step_subject || 'N/A'}</td>
                `;
            });
        } else {
            upcomingTasksTable.innerHTML = '<tr><td colspan="4">No upcoming sequence tasks.</td></tr>';
        }
    
        // Render Manual "My Tasks"
        const pendingTasks = state.tasks.filter(task => task.status === 'Pending').sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        if (pendingTasks.length > 0) {
            pendingTasks.forEach(task => {
                const row = myTasksTable.insertRow();
                if (task.due_date && new Date(task.due_date) < endOfToday) {
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
                row.innerHTML = `
                    <td>${formatSimpleDate(task.due_date)}</td>
                    <td>${task.description}</td>
                    <td>${linkedEntity}</td>
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
    
        // Render Recent Activities
        state.activities
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 20)
            .forEach(act => {
                const contact = state.contacts.find(c => c.id === act.contact_id);
                const account = contact ? state.accounts.find(a => a.id === contact.account_id) : null;
                const row = recentActivitiesTable.insertRow();
                row.innerHTML = `<td>${formatDate(act.date)}</td><td>${account ? account.name : "N/A"}</td><td>${contact ? `${contact.first_name} ${contact.last_name}` : "N/A"}</td><td>${act.type}: ${act.description}</td>`;
            });
    }

    // --- EVENT LISTENER SETUP ---
    function setupPageEventListeners() {
        setupModalListeners();

        document.body.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            // UPDATED: Handle completing a sequence step from the new system
            if (button.matches('.complete-step-btn')) {
                const taskStepId = Number(button.dataset.taskId);
                await completeSequenceStep(taskStepId);
            }

            // Handlers for manual tasks
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
                const task = state.tasks.find(t => t.id == taskId);
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
            }
        });

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
                // The AI briefing logic was removed as it was incomplete and relied on the old data structure
                // You can add the listener back here if you update handleGenerateBriefing
            }
            
            setupPageEventListeners();
        } else {
            window.location.href = "index.html";
        }
    }

    initializePage();
});
