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
    checkAndSetNotifications,
    initializeAppState,
    getState,
    injectGlobalNavigation,
    logToSalesforce,
    showGlobalLoader,
    hideGlobalLoader
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    injectGlobalNavigation();
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- STATE MANAGEMENT ---
    // The local state now primarily holds the data, while user/view state is managed globally.
    let state = {
        contacts: [],
        accounts: [],
        sequences: [],
        sequence_steps: [],
        activities: [],
        contact_sequences: [],
        tasks: [],
        deals: [],
        cognitoAlerts: [],
        nurtureAccounts: []
    };

    // --- DOM Element Selectors ---
    const logoutBtn = document.getElementById("logout-btn");
    const sequenceStepsList = document.getElementById("sequence-steps-list");
    const recentActivitiesList = document.getElementById("recent-activities-list");
    const myTasksList = document.getElementById("my-tasks-list");
    const sequenceToggleDue = document.getElementById("sequence-toggle-due");
    const sequenceToggleUpcoming = document.getElementById("sequence-toggle-upcoming");
    const myTasksHamburger = document.getElementById("my-tasks-hamburger");
    const aiBriefingContainer = document.getElementById("ai-briefing-container");
    const aiBriefingRefreshBtn = document.getElementById("ai-briefing-refresh-btn");

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

    // --- DATA FETCHING ---
    async function loadAllData() {
        const appState = getState();
        if (!appState.currentUser?.id) return;

        if (myTasksList) myTasksList.innerHTML = '<p class="my-tasks-empty text-sm text-[var(--text-medium)] px-4 py-6">Loading tasks...</p>';
        
        const tableMap = {
            "contacts": "contacts", "accounts": "accounts", "sequences": "sequences",
            "activities": "activities", "contact_sequences": "contact_sequences",
            "deals": "deals", "tasks": "tasks", "cognito_alerts": "cognitoAlerts"
        };
        const userSpecificTables = Object.keys(tableMap);
        const publicTables = ["sequence_steps"];

        // Command center always shows only the current (or effective) user's data, never all users
        const userId = appState.effectiveUserId || appState.currentUser.id;
        const userPromises = userSpecificTables.map(table => supabase.from(table).select("*").eq("user_id", userId));

        const publicPromises = publicTables.map(table => supabase.from(table).select("*"));
        const allPromises = [...userPromises, ...publicPromises];
        const allTableNames = [...userSpecificTables, ...publicTables];

        try {
            const results = await Promise.allSettled(allPromises);
            results.forEach((result, index) => {
                const tableName = allTableNames[index];
                const stateKey = tableMap[tableName] || tableName;
                if (result.status === "fulfilled" && result.value && !result.value.error) {
                    state[stateKey] = result.value.data || [];
                } else {
                    console.error(`Error fetching ${tableName}:`, result.status === 'fulfilled' ? (result.value ? result.value.error.message : 'Unknown error') : result.reason);
                }
            });
        } catch (error) {
            console.error("Critical error in loadAllData:", error);
        } finally {
            hideGlobalLoader();
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
        populateQuickAddSelect();
    }

    function populateQuickAddSelect() {
        const contactSelect = document.getElementById('quick-add-contact');
        const accountSelect = document.getElementById('quick-add-account');
        if (!contactSelect || !accountSelect) return;
        const sortedContacts = [...state.contacts].sort((a, b) => {
            const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
            const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
            return nameA.localeCompare(nameB);
        });
        const sortedAccounts = [...state.accounts].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        const contactsOptions = sortedContacts.map(c => `<option value="${c.id}">${c.first_name} ${c.last_name}</option>`).join('');
        const accountsOptions = sortedAccounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        contactSelect.innerHTML = `<option value="">Link to Contact</option>${contactsOptions}`;
        accountSelect.innerHTML = `<option value="">Link to Account</option>${accountsOptions}`;
    }
        
    // --- Core Logic ---
    async function completeStep(csId, processedDescription = null) {
        const appState = getState();
        const cs = state.contact_sequences.find((c) => c.id === csId);
        if (!cs) return;

        const contact = state.contacts.find((c) => c.id === cs.contact_id);
        const currentStepInfo = state.sequence_steps.find(s => s.sequence_id === cs.sequence_id && s.step_number === cs.current_step_number);
        
        if (contact && currentStepInfo) {
            const { error: updateStepError } = await supabase
                .from('contact_sequence_steps')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('contact_sequence_id', cs.id)
                .eq('sequence_step_id', currentStepInfo.id);

            if (updateStepError) {
                console.error("Error updating contact_sequence_step:", updateStepError);
                alert("Could not update the specific task step. Please check the console for errors.");
                return;
            }
            
            const account = contact.account_id ? state.accounts.find(a => a.id === contact.account_id) : null;
            const rawDescription = currentStepInfo.subject || currentStepInfo.message || "Completed step";
            const finalDescription = replacePlaceholders(rawDescription, contact, account);
            const descriptionForLog = processedDescription || finalDescription;

            await supabase.from("activities").insert([{
                contact_id: contact.id,
                account_id: contact.account_id,
                date: new Date().toISOString(),
                type: `Sequence: ${currentStepInfo.type}`,
                description: descriptionForLog,
                user_id: appState.currentUser.id
            }]);
        }
        
        const allStepsInSequence = state.sequence_steps
            .filter(s => s.sequence_id === cs.sequence_id)
            .sort((a, b) => a.step_number - b.step_number);
        
        const nextStep = allStepsInSequence.find(s => s.step_number > cs.current_step_number);
        
        if (nextStep) {
            await supabase.from("contact_sequences").update({
                current_step_number: nextStep.step_number,
                last_completed_date: new Date().toISOString(),
                next_step_due_date: addDays(new Date(), nextStep.delay_days).toISOString()
            }).eq("id", cs.id);
        } else {
            await supabase.from("contact_sequences").update({ status: "Completed" }).eq("id", cs.id);
        }
        
        await loadAllData();
    }

    // --- AI Briefing Logic ---
    async function handleGenerateBriefing() {
        aiBriefingContainer.classList.remove('hidden');
        aiBriefingContainer.innerHTML = `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">Generating your daily briefing...</p>`;

        try {
            const briefingPayload = {
                tasks: state.tasks.filter(t => t.status === 'Pending'),
                sequenceSteps: state.contact_sequences.filter(cs => {
                    if (!cs.next_step_due_date || cs.status !== "Active") return false;
                    const dueDate = new Date(cs.next_step_due_date);
                    const startOfToday = new Date();
                    startOfToday.setHours(0, 0, 0, 0);
                    return dueDate.setHours(0, 0, 0, 0) <= startOfToday.getTime();
                }),
                deals: state.deals,
                cognitoAlerts: state.cognitoAlerts,
                nurtureAccounts: state.nurtureAccounts,
                contacts: state.contacts,
                accounts: state.accounts,
                sequences: state.sequences,
                sequence_steps: state.sequence_steps
            };
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
        const cardsHtml = briefing.priorities.map(item => `
            <div class="ai-briefing-priority-card">
                <div class="priority-title">${item.title}</div>
                <div class="priority-reason">${item.reason}</div>
            </div>
        `).join('');
        aiBriefingContainer.innerHTML = cardsHtml || '<p class="text-xs text-[var(--text-medium)]">No priorities for today.</p>';
        aiBriefingContainer.classList.remove('hidden');
        sessionStorage.setItem('crm-briefing-generated', 'true');
        sessionStorage.setItem('crm-briefing-html', aiBriefingContainer.innerHTML);
    }

    // --- Sequence Steps View Mode ---
    let sequenceViewMode = 'due';

    // --- Render Function ---
    function renderDashboard() {
        if (!myTasksList || !sequenceStepsList || !recentActivitiesList) return;
        myTasksList.innerHTML = "";
        sequenceStepsList.innerHTML = "";
        recentActivitiesList.innerHTML = "";

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const salesSequenceTasks = [];
        const upcomingSalesTasks = [];
        
        const appState = getState();

        for (const cs of state.contact_sequences) {
            if (cs.status !== 'Active' || !cs.current_step_number) continue;
            const effectiveId = appState.effectiveUserId || appState.currentUser?.id;
            if (cs.user_id !== effectiveId) continue;

            const currentStep = state.sequence_steps.find(
                s => s.sequence_id === cs.sequence_id && s.step_number === cs.current_step_number
            );
            
            let shouldShowTask = false;
            if (currentStep) {
                const assignedTo = currentStep.assigned_to || 'Sales';
                if (assignedTo === 'Marketing') continue;
                // Show both Sales and Sales Manager steps (most default to Sales)
                shouldShowTask = assignedTo === 'Sales' || assignedTo === 'Sales Manager';
            }

            if (shouldShowTask) {
                const contact = state.contacts.find(c => c.id === cs.contact_id);
                const sequence = state.sequences.find(s => s.id === cs.sequence_id);
                if (contact && sequence) {
                    const taskObject = {
                        ...cs,
                        contact: contact,
                        account: contact.account_id ? state.accounts.find(a => a.id === contact.account_id) : null,
                        sequence: sequence,
                        step: currentStep
                    };
                    
                    if (cs.next_step_due_date && new Date(cs.next_step_due_date).setHours(0,0,0,0) <= startOfToday.getTime()) {
                        salesSequenceTasks.push(taskObject);
                    } else {
                        upcomingSalesTasks.push(taskObject);
                    }
                }
            }
        }
        
        const pendingTasks = state.tasks.filter(task => task.status === 'Pending').sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        if (pendingTasks.length > 0) {
            pendingTasks.forEach(task => {
                const taskDueDate = task.due_date ? new Date(task.due_date) : null;
                const isPastDue = taskDueDate && taskDueDate.setHours(0, 0, 0, 0) < startOfToday.getTime();
                let linkedEntity = 'N/A';
                if (task.contact_id) {
                    const contact = state.contacts.find(c => c.id === task.contact_id);
                    if (contact) linkedEntity = `<a href="contacts.html?contactId=${contact.id}" class="contact-name-link">${contact.first_name} ${contact.last_name}</a> (Contact)`;
                } else if (task.account_id) {
                    const account = state.accounts.find(a => a.id === task.account_id);
                    if (account) linkedEntity = `<a href="accounts.html?accountId=${account.id}" class="contact-name-link">${account.name}</a> (Account)`;
                }
                const actionsHtml = `
                    <button class="btn-primary btn-icon-only mark-task-complete-btn" data-task-id="${task.id}" title="Complete"><i class="fa-solid fa-square-check"></i></button>
                    <button class="btn-secondary btn-icon-only edit-task-btn" data-task-id="${task.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-danger btn-icon-only delete-task-btn" data-task-id="${task.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                `;
                const item = document.createElement("div");
                item.className = `task-item ${isPastDue ? 'past-due' : ''}`;
                item.innerHTML = `
                    <div class="task-left">
                        <div class="task-due">${formatSimpleDate(task.due_date)}</div>
                    </div>
                    <div class="task-content">
                        <div class="task-linked">${linkedEntity}</div>
                        <div class="task-description">${task.description}</div>
                    </div>
                    <div class="task-actions">${actionsHtml}</div>
                `;
                myTasksList.appendChild(item);
            });
        } else {
            myTasksList.innerHTML = '<p class="my-tasks-empty text-sm text-[var(--text-medium)] px-4 py-6">No pending tasks. Great job!</p>';
        }

        const myTasksCard = document.getElementById('my-tasks-card');
        const hamburgerBtn = document.getElementById('my-tasks-hamburger');
        if (myTasksCard && hamburgerBtn) {
            const taskCount = pendingTasks.length;
            const TASK_THRESHOLD = 3;
            if (taskCount > TASK_THRESHOLD) {
                myTasksCard.classList.add('quick-add-hidden');
            } else {
                myTasksCard.classList.remove('quick-add-hidden', 'hamburger-expanded');
                const icon = hamburgerBtn.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-plus';
                hamburgerBtn.setAttribute('title', 'Add task');
                hamburgerBtn.setAttribute('aria-label', 'Add task');
            }
        }

        salesSequenceTasks.sort((a, b) => new Date(a.next_step_due_date) - new Date(b.next_step_due_date));
        upcomingSalesTasks.sort((a, b) => new Date(a.next_step_due_date) - new Date(b.next_step_due_date));

        function renderSequenceStepsList() {
            sequenceStepsList.innerHTML = "";
            const tasks = sequenceViewMode === 'due' ? salesSequenceTasks : upcomingSalesTasks;

            if (tasks.length > 0) {
                tasks.forEach(task => {
                    const dueDate = new Date(task.next_step_due_date);
                    const isPastDue = sequenceViewMode === 'due' && dueDate < startOfToday;
                    const contactName = `${task.contact.first_name || ''} ${task.contact.last_name || ''}`.trim();
                    const description = task.step.subject || task.step.message || '';

                    const stepType = (task.step.type || '').toLowerCase();
                    const getStepIcon = () => {
                        if (stepType.includes('linkedin')) return { icon: 'fa-paper-plane', title: 'Go to LinkedIn' };
                        if (stepType.includes('email')) return { icon: 'fa-envelope', title: 'Send Email' };
                        if (stepType.includes('call')) return { icon: 'fa-phone', title: 'Complete' };
                        if (stepType.includes('gift')) return { icon: 'fa-gift', title: 'Complete' };
                        return { icon: 'fa-square-check', title: 'Complete' };
                    };
                    let btnHtml;
                    if (sequenceViewMode === 'due') {
                        const { icon, title } = getStepIcon();
                        if (stepType.includes('linkedin')) {
                            btnHtml = `<button class="btn-primary btn-icon-only send-linkedin-message-btn" data-cs-id="${task.id}" title="${title}"><i class="fa-solid ${icon}"></i></button>`;
                        } else if (stepType.includes('email') && task.contact.email) {
                            btnHtml = `<button class="btn-primary btn-icon-only send-email-btn" data-cs-id="${task.id}" title="${title}"><i class="fa-solid ${icon}"></i></button>`;
                        } else if (stepType.includes('call')) {
                            btnHtml = `<button class="btn-primary btn-icon-only log-call-btn" data-cs-id="${task.id}" title="Log a call"><i class="fa-solid ${icon}"></i></button>`;
                        } else {
                            btnHtml = `<button class="btn-primary btn-icon-only complete-step-btn" data-cs-id="${task.id}" title="${title}"><i class="fa-solid ${icon}"></i></button>`;
                        }
                    } else {
                        btnHtml = `<button class="btn-secondary btn-icon-only revisit-step-btn" data-cs-id="${task.id}" title="Revisit Last Step"><i class="fa-solid fa-rotate-left"></i></button>`;
                    }

                    const item = document.createElement("div");
                    item.className = `sequence-step-item ${isPastDue ? 'past-due' : ''}`;
                    item.innerHTML = `
                        <div class="sequence-step-left">
                            <div class="sequence-step-due">${formatSimpleDate(task.next_step_due_date)}</div>
                            <div class="sequence-step-actions">${btnHtml}</div>
                        </div>
                        <div class="sequence-step-content">
                            <div class="sequence-step-meta">${contactName} · ${task.step.type}</div>
                            <div class="sequence-step-description">${description}</div>
                            <div class="sequence-step-sequence">${task.sequence.name}</div>
                        </div>
                    `;
                    sequenceStepsList.appendChild(item);
                });
            } else {
                const emptyMsg = sequenceViewMode === 'due' ? 'No sequence steps due today.' : 'No upcoming sequence steps.';
                sequenceStepsList.innerHTML = `<p class="sequence-steps-empty text-sm text-[var(--text-medium)] px-4 py-6">${emptyMsg}</p>`;
            }
        }

        renderSequenceStepsList();

        const sortedActivities = state.activities
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 20);
        if (sortedActivities.length === 0) {
            recentActivitiesList.innerHTML = '<p class="recent-activities-empty text-sm text-[var(--text-medium)] px-4 py-6">No recent activities yet.</p>';
        } else {
            sortedActivities.forEach(act => {
                const contact = state.contacts.find(c => c.id === act.contact_id);
                const account = contact ? state.accounts.find(a => a.id === contact.account_id) : null;
                const accountName = account ? account.name : "N/A";
                const contactName = contact ? `${contact.first_name} ${contact.last_name}` : "N/A";
                const meta = `${accountName} · ${contactName}`;
                const typeLower = act.type.toLowerCase();
                let iconClass = "icon-default", icon = "fa-circle-info", iconPrefix;
                if (typeLower.includes("cognito") || typeLower.includes("intelligence")) { icon = "fa-magnifying-glass"; }
                else if (typeLower.includes("email")) { iconClass = "icon-email"; icon = "fa-envelope"; }
                else if (typeLower.includes("call")) { iconClass = "icon-call"; icon = "fa-phone"; }
                else if (typeLower.includes("meeting")) { iconClass = "icon-meeting"; icon = "fa-video"; }
                else if (typeLower.includes("linkedin")) { iconClass = "icon-linkedin"; icon = "fa-linkedin-in"; iconPrefix = "fa-brands"; }
                const item = document.createElement("div");
                item.className = "recent-activity-item";
                const logSfBtnHtml = act.logged_to_sf ? '' : `<button type="button" class="btn-log-sf" data-activity-id="${act.id}" title="Log to Salesforce"><i class="fa-brands fa-salesforce"></i> Log to SF</button>`;
                item.innerHTML = `
                    <div class="activity-icon-wrap ${iconClass}"><i class="${iconPrefix || "fas"} ${icon}"></i></div>
                    <div class="activity-body">
                        <div class="activity-meta">${meta}</div>
                        <div class="activity-description">${act.type}: ${act.description}</div>
                        <div class="activity-date">${formatDate(act.date)}</div>
                    </div>
                    <div class="activity-actions">${logSfBtnHtml}</div>
                `;
                recentActivitiesList.appendChild(item);
            });
        }
    }

    function getActivityIconInfo(act) {
        const typeLower = (act.type || '').toLowerCase();
        if (typeLower.includes("cognito") || typeLower.includes("intelligence")) return { iconClass: "icon-default", icon: "fa-magnifying-glass", iconPrefix: "fas" };
        if (typeLower.includes("email")) return { iconClass: "icon-email", icon: "fa-envelope", iconPrefix: "fas" };
        if (typeLower.includes("call")) return { iconClass: "icon-call", icon: "fa-phone", iconPrefix: "fas" };
        if (typeLower.includes("meeting")) return { iconClass: "icon-meeting", icon: "fa-video", iconPrefix: "fas" };
        if (typeLower.includes("linkedin")) return { iconClass: "icon-linkedin", icon: "fa-linkedin-in", iconPrefix: "fa-brands" };
        return { iconClass: "icon-default", icon: "fa-circle-info", iconPrefix: "fas" };
    }

    function openLogCallModal(task) {
        const contact = task.contact;
        const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
        const phone = (contact.phone || '').trim();
        const telHref = phone ? `tel:${phone.replace(/\D/g, '')}` : '';
        const phoneDisplay = phone || 'No phone number';
        const phoneHtml = telHref
            ? `<a href="${telHref}" class="log-call-phone-link">${phoneDisplay}</a>`
            : `<span class="text-[var(--text-medium)]">${phoneDisplay}</span>`;

        const contactActivities = state.activities
            .filter(a => a.contact_id === contact.id)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 15);
        let activitiesHtml = '';
        contactActivities.forEach(act => {
            const account = act.account_id ? state.accounts.find(a => a.id === act.account_id) : null;
            const meta = account ? account.name : 'N/A';
            const { iconClass, icon, iconPrefix } = getActivityIconInfo(act);
            activitiesHtml += `
                <div class="recent-activity-item">
                    <div class="activity-icon-wrap ${iconClass}"><i class="${iconPrefix} ${icon}"></i></div>
                    <div class="activity-body">
                        <div class="activity-meta">${meta}</div>
                        <div class="activity-description">${act.type}: ${(act.description || '').replace(/</g, '&lt;')}</div>
                        <div class="activity-date">${formatDate(act.date)}</div>
                    </div>
                </div>`;
        });
        if (!activitiesHtml) activitiesHtml = '<p class="text-sm text-[var(--text-medium)] py-2">No recent activities for this contact.</p>';

        const bodyHtml = `
            <div class="log-call-modal-body">
                <p class="mb-3"><strong>${contactName.replace(/</g, '&lt;')}</strong></p>
                <p class="mb-3">${phoneHtml}</p>
                <label class="block text-sm font-medium mb-1">Call notes (optional)</label>
                <textarea id="modal-call-notes" class="w-full rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm bg-[var(--bg-light)] min-h-[80px] mb-3" placeholder="Notes from the call..."></textarea>
                <div class="log-call-recent-activities">
                    <div class="text-xs font-semibold text-[var(--text-medium)] mb-2">Recent activities</div>
                    <div class="log-call-activities-list max-h-[200px] overflow-y-auto space-y-2">${activitiesHtml}</div>
                </div>
            </div>`;

        showModal('Log a call', bodyHtml, async () => {
            const notes = (document.getElementById('modal-call-notes')?.value || '').trim();
            const description = notes || 'Call completed';
            await completeStep(task.id, description);
        }, true, `<button id="modal-confirm-btn" class="btn-primary">Log</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
    }

    // --- EVENT LISTENER SETUP ---
    function setupPageEventListeners() {
        setupModalListeners();

        if (recentActivitiesList) {
            recentActivitiesList.addEventListener('click', async (e) => {
                const btn = e.target.closest('.btn-log-sf');
                if (!btn) return;
                const id = btn.getAttribute('data-activity-id');
                if (!id) return;
                const act = state.activities.find(a => String(a.id) === String(id));
                if (act) {
                    const account = act.account_id ? state.accounts.find(a => a.id === act.account_id) : null;
                    logToSalesforce({ subject: act.description, notes: act.description, type: act.type, created_at: act.date, sf_account_locator: account?.sf_account_locator });
                    const { error } = await supabase.from('activities').update({ logged_to_sf: true }).eq('id', act.id);
                    if (!error) {
                        act.logged_to_sf = true;
                        btn.style.display = 'none';
                    }
                }
            });
        }

        if (aiBriefingRefreshBtn) {
            aiBriefingRefreshBtn.addEventListener('click', handleGenerateBriefing);
        }

        if (sequenceToggleDue && sequenceToggleUpcoming) {
            sequenceToggleDue.addEventListener('click', () => {
                if (sequenceViewMode === 'due') return;
                sequenceViewMode = 'due';
                sequenceToggleDue.classList.add('active');
                sequenceToggleUpcoming.classList.remove('active');
                renderDashboard();
            });
            sequenceToggleUpcoming.addEventListener('click', () => {
                if (sequenceViewMode === 'upcoming') return;
                sequenceViewMode = 'upcoming';
                sequenceToggleUpcoming.classList.add('active');
                sequenceToggleDue.classList.remove('active');
                renderDashboard();
            });
        }
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                sessionStorage.removeItem('crm-briefing-generated');
                sessionStorage.removeItem('crm-briefing-html');
                await supabase.auth.signOut();
                window.location.href = "index.html";
            });
        }
        if (myTasksHamburger) {
            myTasksHamburger.addEventListener('click', () => {
                const card = document.getElementById('my-tasks-card');
                if (!card) return;
                const isExpanded = card.classList.toggle('hamburger-expanded');
                const icon = myTasksHamburger.querySelector('i');
                if (icon) {
                    icon.className = isExpanded ? 'fa-solid fa-times' : 'fa-solid fa-plus';
                }
                myTasksHamburger.setAttribute('title', isExpanded ? 'Close' : 'Add task');
                myTasksHamburger.setAttribute('aria-label', isExpanded ? 'Close' : 'Add task');
            });
        }
        const quickAddForm = document.getElementById('quick-add-task-form');
        if (quickAddForm) {
            quickAddForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const appState = getState();
                const description = document.getElementById('quick-add-description').value.trim();
                const dueDate = document.getElementById('quick-add-due-date').value;
                const contactId = document.getElementById('quick-add-contact').value;
                const accountId = document.getElementById('quick-add-account').value;
                if (!description) { alert('Description is required.'); return; }
                const taskData = { description, due_date: dueDate || null, user_id: appState.currentUser.id, status: 'Pending' };
                if (contactId) taskData.contact_id = Number(contactId);
                if (accountId) taskData.account_id = Number(accountId);
                const { error } = await supabase.from('tasks').insert(taskData);
                if (error) { alert('Error adding task: ' + error.message); }
                else {
                    quickAddForm.reset();
                    await loadAllData();
                }
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
            } else if (button.matches('.log-call-btn')) {
                const csId = Number(button.dataset.csId);
                const cs = state.contact_sequences.find(c => c.id === csId);
                if (!cs) return alert("Contact sequence not found.");
                const contact = state.contacts.find(c => c.id === cs.contact_id);
                if (!contact) return alert("Contact not found.");
                const sequence = state.sequences.find(s => s.id === cs.sequence_id);
                const currentStep = state.sequence_steps.find(s => s.sequence_id === cs.sequence_id && s.step_number === cs.current_step_number);
                if (!sequence || !currentStep) return alert("Sequence step not found.");
                const task = { id: cs.id, contact, sequence, step: currentStep };
                openLogCallModal(task);
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
                    await completeStep(csId, `Email Sent: ${finalSubject}`);
                },
                true,
                `<button id="modal-confirm-btn" class="btn-primary">Send with Email Client</button>
                 <button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
                );
            } else if (button.matches('.send-linkedin-message-btn')) {
                const csId = Number(button.dataset.csId);
                const cs = state.contact_sequences.find(c => c.id === csId);
                if (!cs) return alert("Contact sequence not found.");

                const contact = state.contacts.find(c => c.id === cs.contact_id);
                if (!contact) return alert("Contact not found.");

                const account = contact.account_id ? state.accounts.find(a => a.id === contact.account_id) : null;
                const step = state.sequence_steps.find(s => s.sequence_id === cs.sequence_id && s.step_number === cs.current_step_number);
                if (!step) return alert("Sequence step not found.");

                const message = replacePlaceholders(step.message, contact, account);
                const linkedinUrl = contact.linkedin_profile_url || 'https://www.linkedin.com/feed/';

                showModal('Compose LinkedIn Message', `
                    <div class="form-group">
                        <p><strong>To:</strong> ${contact.first_name} ${contact.last_name}</p>
                        <p class="modal-sub-text">The message below will be copied to your clipboard. Paste it into the message box on LinkedIn.</p>
                    </div>
                    <div class="form-group">
                        <label for="modal-linkedin-body">Message:</label>
                        <textarea id="modal-linkedin-body" class="form-control" rows="10">${message}</textarea>
                    </div>
                `, async () => {
                    const finalMessage = document.getElementById('modal-linkedin-body').value;
                    try {
                        await navigator.clipboard.writeText(finalMessage);
                    } catch (err) {
                        console.error('Failed to copy text: ', err);
                        alert('Could not copy text to clipboard. Please copy it manually.');
                    }
                    window.open(linkedinUrl, "_blank");
                    await completeStep(csId, "LinkedIn Message Sent");
                },
                true,
                `<button id="modal-confirm-btn" class="btn-primary">Copy Text & Open LinkedIn</button>
                 <button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
                );
            } else if (button.matches('.complete-step-btn')) {
                const csId = Number(button.dataset.csId);
                completeStep(csId);
            } else if (button.matches('.revisit-step-btn')) {
                const csId = Number(button.dataset.csId);
                const contactSequence = state.contact_sequences.find(cs => cs.id === csId);
                if (!contactSequence) return;
                
                const allStepsInSequence = state.sequence_steps
                    .filter(s => s.sequence_id === contactSequence.sequence_id)
                    .sort((a,b) => a.step_number - b.step_number);

                const currentStepIndex = allStepsInSequence.findIndex(s => s.step_number === contactSequence.current_step_number);
                
                if (currentStepIndex > 0) {
                    const previousStep = allStepsInSequence[currentStepIndex - 1];
                    showModal('Revisit Step', `Are you sure you want to go back to step ${previousStep.step_number}?`, async () => {
                        await supabase.from('contact_sequences').update({ current_step_number: previousStep.step_number, next_step_due_date: getStartOfLocalDayISO(), status: 'Active' }).eq('id', csId);
                        await loadAllData();
                    });
                } else {
                    alert("This is already the first step.");
                }
            }
        });
    }

// --- App Initialization (UPDATED) ---
    async function initializePage() {
        await loadSVGs();
        updateActiveNavLink();
        
        // Use the new global state initializer from shared_constants.js
        const appState = await initializeAppState(supabase);
        
        if (appState.currentUser) {
            // Pass the whole appState object to setup the user menu
            await setupUserMenuAndAuth(supabase, appState, { skipImpersonation: true }); 
            
            // Setup other shared features
            await setupGlobalSearch(supabase);
            await checkAndSetNotifications(supabase);
            
            // Initial data load for the effective user (which is the current user by default)
            await loadAllData();
            
            // Setup event listeners (including Refresh button)
            setupPageEventListeners();

            // Auto-run briefing once per login (session)
            if (!sessionStorage.getItem('crm-briefing-generated')) {
                handleGenerateBriefing();
            } else {
                const savedHtml = sessionStorage.getItem('crm-briefing-html');
                if (savedHtml) {
                    aiBriefingContainer.innerHTML = savedHtml;
                    aiBriefingContainer.classList.remove('hidden');
                } else {
                    const placeholder = document.getElementById('ai-briefing-placeholder');
                    if (placeholder) placeholder.textContent = 'Refresh to generate a new briefing.';
                }
            }

            
        } else {
            hideGlobalLoader();
            window.location.href = "index.html";
        }
    }

    initializePage();
});
