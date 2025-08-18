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
        deals: []
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

    // --- Utility ---
    function getStartOfLocalDayISO() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today.toISOString();
    }

    // Helper function to replace placeholders in templates
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

        const userSpecificTables = ["contacts", "accounts", "sequences", "activities", "contact_sequences", "deals", "tasks"];
        const publicTables = ["sequence_steps"];
        const userPromises = userSpecificTables.map(table => supabase.from(table).select("*").eq("user_id", state.currentUser.id));
        const publicPromises = publicTables.map(table => supabase.from(table).select("*"));
        const allPromises = [...userPromises, ...publicPromises];
        const allTableNames = [...userSpecificTables, ...publicTables];

        try {
            const results = await Promise.allSettled(allPromises);
            results.forEach((result, index) => {
                const tableName = allTableNames[index];
                if (result.status === "fulfilled" && !result.value.error) {
                    state[tableName] = result.value.data || [];
                } else {
                    console.error(`Error fetching ${tableName}:`, result.status === 'fulfilled' ? result.value.error.message : result.reason);
                    state[tableName] = [];
                }
            });
        } catch (error) {
            console.error("Critical error in loadAllData:", error);
        } finally {
            renderDashboard();
        }
    }

    // --- Core Logic ---
    async function completeStep(csId, processedDescription = null) {
        const cs = state.contact_sequences.find((c) => c.id === csId);
        if (!cs) return;
        const contact = state.contacts.find((c) => c.id === cs.contact_id);
        const step = state.sequence_steps.find(s => s.sequence_id === cs.sequence_id && s.step_number === cs.current_step_number);
        if (contact && step) {
            // ** FIX STARTS HERE **
            const account = contact.account_id ? state.accounts.find(a => a.id === contact.account_id) : null;
            const rawDescription = step.subject || step.message || "Completed step";
            const finalDescription = replacePlaceholders(rawDescription, contact, account);
            const descriptionForLog = processedDescription || finalDescription;
            // ** FIX ENDS HERE **
            await supabase.from("activities").insert([{ 
                contact_id: contact.id, 
                account_id: contact.account_id, 
                date: new Date().toISOString(), 
                type: `Sequence: ${step.type}`, 
                description: descriptionForLog, 
                user_id: state.currentUser.id 
            }]);
        }
        const nextStep = state.sequence_steps.find(s => s.sequence_id === cs.sequence_id && s.step_number === cs.current_step_number + 1);
        if (nextStep) {
            await supabase.from("contact_sequences").update({ current_step_number: nextStep.step_number, last_completed_date: new Date().toISOString(), next_step_due_date: addDays(new Date(), nextStep.delay_days).toISOString() }).eq("id", cs.id);
        } else {
            await supabase.from("contact_sequences").update({ status: "Completed" }).eq("id", cs.id);
        }
        loadAllData();
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

        const pendingTasks = state.tasks.filter(task => task.status === 'Pending').sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        if (pendingTasks.length > 0) {
            pendingTasks.forEach(task => {
                const row = myTasksTable.insertRow();
                if (task.due_date) {
                    const taskDueDate = new Date(task.due_date);
                    if (taskDueDate.setHours(0,0,0,0) < startOfToday.getTime()) {
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

        state.contact_sequences
            .filter(cs => {
                if (!cs.next_step_due_date || cs.status !== "Active") return false;
                const dueDate = new Date(cs.next_step_due_date);
                return dueDate.setHours(0,0,0,0) <= startOfToday.getTime();
            })
            .sort((a, b) => new Date(a.next_step_due_date) - new Date(b.next_step_due_date))
            .forEach(cs => {
                const row = dashboardTable.insertRow();
                const dueDate = new Date(cs.next_step_due_date);
                if (dueDate.setHours(0,0,0,0) < startOfToday.getTime()) {
                    row.classList.add('past-due');
                }
                const contact = state.contacts.find(c => c.id === cs.contact_id);
                const sequence = state.sequences.find(s => s.id === cs.sequence_id);
                if (!contact || !sequence) return;
                const step = state.sequence_steps.find(s => s.sequence_id === sequence.id && s.step_number === cs.current_step_number);
                if (!step) return;
                const account = contact.account_id ? state.accounts.find(a => a.id === contact.account_id) : null;
                const desc = replacePlaceholders(step.subject || step.message || "", contact, account);

                let btnHtml;
                if (step.type.toLowerCase() === "linkedin") {
                    btnHtml = `<button class="btn-primary complete-linkedin-step-btn" data-id="${cs.id}" data-linkedin-url="${encodeURIComponent('https://www.linkedin.com/feed/')}">Go to LinkedIn</button>`;
                } else if (step.type.toLowerCase() === "email" && contact.email) {
                    btnHtml = `<button class="btn-primary send-email-btn" data-cs-id="${cs.id}">Send Email</button>`;
                } else {
                    btnHtml = `<button class="btn-primary complete-step-btn" data-id="${cs.id}">Complete</button>`;
                }
                row.innerHTML = `<td>${formatSimpleDate(cs.next_step_due_date)}</td><td>${contact.first_name} ${contact.last_name}</td><td>${sequence.name}</td><td>${step.step_number}: ${step.type}</td><td>${desc}</td><td><div class="button-group-wrapper">${btnHtml}</div></td>`;
            });

        state.contact_sequences
            .filter(cs => {
                if (!cs.next_step_due_date || cs.status !== "Active") return false;
                const dueDate = new Date(cs.next_step_due_date);
                return dueDate.setHours(0,0,0,0) > startOfToday.getTime();
            })
            .sort((a, b) => new Date(a.next_step_due_date) - new Date(b.next_step_due_date))
            .forEach(cs => {
                const row = allTasksTable.insertRow();
                const contact = state.contacts.find(c => c.id === cs.contact_id);
                if (!contact) return;
                const account = contact.account_id ? state.accounts.find(a => a.id === contact.account_id) : null;
                row.innerHTML = `<td>${formatSimpleDate(cs.next_step_due_date)}</td><td>${contact.first_name} ${contact.last_name}</td><td>${account ? account.name : "N/A"}</td><td><div class="button-group-wrapper"><button class="btn-secondary revisit-step-btn" data-cs-id="${cs.id}">Revisit Last Step</button></div></td>`;
            });

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
            } else if (button.matches('.send-email-btn')) {
                const csId = Number(button.dataset.csId);
                const cs = state.contact_sequences.find(c => c.id === csId);
                if (!cs) return alert("Contact sequence not found.");
                
                const contact = state.contacts.find(c => c.id === cs.contact_id);
                if (!contact) return alert("Contact not found.");
                
                const account = contact.account_id ? state.accounts.find(a => a.id === contact.account_id) : null;
                const step = state.sequence_steps.find(s => s.sequence_id === cs.sequence_id && s.step_number === cs.current_step_number);
                if (!step) return alert("Sequence step not found.");

                const subject = replacePlaceholders(step.subject, contact, account);
                const message = replacePlaceholders(step.message, contact, account);
                
                showModal('Compose Email', `
                    <div class="form-group">
                        <label for="modal-email-subject">Subject:</label>
                        <input type="text" id="modal-email-subject" class="form-control" value="${subject.replace(/"/g, '&quot;')}">
                    </div>
                    <div class="form-group">
                        <label for="modal-email-body">Message:</label>
                        <textarea id="modal-email-body" class="form-control" rows="10">${message}</textarea>
                    </div>
                `, async () => {
                    const finalSubject = document.getElementById('modal-email-subject').value;
                    const finalMessage = document.getElementById('modal-email-body').value;
                    
                    const mailtoLink = `mailto:${contact.email}?subject=${encodeURIComponent(finalSubject)}&body=${encodeURIComponent(finalMessage)}`;
                    window.open(mailtoLink, "_blank");
                    
                    await completeStep(csId, finalSubject);
                }, 
                true, // This is the 'showCancel' parameter
                `<button id="modal-confirm-btn" class="btn-primary">Send with Email Client</button>
                 <button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
                );

            } else if (button.matches('.complete-linkedin-step-btn')) {
                const csId = Number(button.dataset.id);
                const linkedinUrl = decodeURIComponent(button.dataset.linkedinUrl);
                if (linkedinUrl) { window.open(linkedinUrl, "_blank"); }
                else { alert("LinkedIn URL is missing from button data attribute."); }
                completeStep(csId);

            } else if (button.matches('.complete-step-btn')) {
                const csId = Number(button.dataset.id);
                completeStep(csId);

            } else if (button.matches('.revisit-step-btn')) {
                 const csId = Number(button.dataset.csId);
                const contactSequence = state.contact_sequences.find(cs => cs.id === csId);
                if (!contactSequence) return;
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
            setupPageEventListeners();
            await setupGlobalSearch(supabase, state.currentUser); // <-- ADD THIS LINE
            await checkAndSetNotifications(supabase); // <-- AND ADD THIS LINE
            loadAllData();
        } else {
            window.location.href = "index.html";
        }
    }

    initializePage();
});
