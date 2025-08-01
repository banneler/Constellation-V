import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatDate,
    parseCsvRow,
    setupModalListeners,
    showModal,
    hideModal,
    addDays,
    updateActiveNavLink,
    setupUserMenuAndAuth,
    loadSVGs
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
        activityTypes: [], // Add activityTypes to state
        contact_sequences: [],
        selectedContactId: null,
        deals: [],
        tasks: [],
        email_log: [],
        isFormDirty: false
    };

    // --- DOM Element Selectors ---
    const navSidebar = document.querySelector(".nav-sidebar");
    const contactList = document.getElementById("contact-list");
    const contactForm = document.getElementById("contact-form");
    const contactSearch = document.getElementById("contact-search");
    const bulkImportContactsBtn = document.getElementById("bulk-import-contacts-btn");
    const contactCsvInput = document.getElementById("contact-csv-input");
    const addContactBtn = document.getElementById("add-contact-btn");
    const deleteContactBtn = document.getElementById("delete-contact-btn");
    const logActivityBtn = document.getElementById("log-activity-btn");
    const assignSequenceBtn = document.getElementById("assign-sequence-btn");
    const addTaskContactBtn = document.getElementById("add-task-contact-btn");
    const contactActivitiesList = document.getElementById("contact-activities-list");
    const contactSequenceInfoText = document.getElementById("contact-sequence-info-text");
    const removeFromSequenceBtn = document.getElementById("remove-from-sequence-btn");
    const noSequenceText = document.getElementById("no-sequence-text");
    const sequenceStatusContent = document.getElementById("sequence-status-content");
    const ringChart = document.getElementById("ring-chart");
    const ringChartText = document.getElementById("ring-chart-text");
    const contactEmailsTableBody = document.getElementById("contact-emails-table-body");
    const emailViewModalBackdrop = document.getElementById("email-view-modal-backdrop");
    const emailViewCloseBtn = document.getElementById("email-view-close-btn");
    const emailViewSubject = document.getElementById("email-view-subject");
    const emailViewFrom = document.getElementById("email-view-from");
    const emailViewTo = document.getElementById("email-view-to");
    const emailViewDate = document.getElementById("email-view-date");
    const emailViewBodyContent = document.getElementById("email-view-body-content");
    const contactPendingTaskReminder = document.getElementById("contact-pending-task-reminder");


    // --- Dirty Check and Navigation ---
    const handleNavigation = (url) => {
        if (state.isFormDirty) {
            showModal("Unsaved Changes", "You have unsaved changes that will be lost. Are you sure you want to leave?", () => {
                state.isFormDirty = false;
                window.location.href = url;
            });
        } else {
            window.location.href = url;
        }
    };
    
    const confirmAndSwitchContact = (newContactId) => {
        if (state.isFormDirty) {
            showModal("Unsaved Changes", "You have unsaved changes. Are you sure you want to switch contacts?", () => {
                state.isFormDirty = false;
                state.selectedContactId = newContactId;
                renderContactList();
                renderContactDetails();
                hideModal();
            });
        } else {
            state.selectedContactId = newContactId;
            renderContactList();
            renderContactDetails();
        }
    };


    // --- Data Fetching ---
    async function loadAllData() {
        if (!state.currentUser) return;
        const userSpecificTables = ["contacts", "accounts", "activities", "contact_sequences", "sequences", "deals", "tasks"];
        const sharedTables = ["sequence_steps", "email_log", "activity_types"];
        const userPromises = userSpecificTables.map((table) => supabase.from(table).select("*").eq("user_id", state.currentUser.id));
        const sharedPromises = sharedTables.map((table) => supabase.from(table).select("*"));
        const allPromises = [...userPromises, ...sharedPromises];
        const allTableNames = [...userSpecificTables, ...sharedTables];

        try {
            const results = await Promise.allSettled(allPromises);
            results.forEach((result, index) => {
                const tableName = allTableNames[index];
                if (result.status === "fulfilled") {
                    if (result.value.error) {
                        console.error(`Supabase error fetching ${tableName}:`, result.value.error.message);
                        state[tableName] = [];
                    } else {
                        state[tableName] = result.value.data || [];
                    }
                } else {
                    console.error(`Failed to fetch ${tableName}:`, result.reason);
                    state[tableName] = [];
                }
            });
        } catch (error) {
            console.error("Critical error in loadAllData:", error);
        } finally {
            renderContactList();
            if (state.selectedContactId) {
                const updatedContact = state.contacts.find(c => c.id === state.selectedContactId);
                if (updatedContact) {
                    renderContactDetails();
                } else {
                    hideContactDetails(false, true);
                }
            } else {
                hideContactDetails(false, true);
            }
        }
    }

    // --- Render Functions ---
    const renderContactList = () => {
        if (!contactList) return;
        const searchTerm = contactSearch.value.toLowerCase();
        const filteredContacts = state.contacts
            .filter(c => (c.first_name || "").toLowerCase().includes(searchTerm) || (c.last_name || "").toLowerCase().includes(searchTerm) || (c.email || "").toLowerCase().includes(searchTerm))
            .sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));

        contactList.innerHTML = "";
        filteredContacts.forEach((contact) => {
            const item = document.createElement("div");
            item.className = "list-item";
            const inActiveSequence = state.contact_sequences.some(cs => cs.contact_id === contact.id && cs.status === "Active");
            item.innerHTML = `
                <div class="contact-info">
                    <div class="contact-name">${contact.first_name} ${contact.last_name}${inActiveSequence ? '<span class="sequence-status-icon"></span>' : ''}</div>
                    <small class="account-name">${state.accounts.find(a => a.id === contact.account_id)?.name || 'No Account'}</small>
                </div>
            `;
            item.dataset.id = contact.id;
            if (contact.id === state.selectedContactId) item.classList.add("selected");
            contactList.appendChild(item);
        });
    };

    const renderContactDetails = () => {
        const contact = state.contacts.find((c) => c.id === state.selectedContactId);
        if (!contactForm) return;

        if (contactPendingTaskReminder && contact) {
            const pendingContactTasks = state.tasks.filter(task => task.status === 'Pending' && task.contact_id === contact.id);
            if (pendingContactTasks.length > 0) {
                const taskCount = pendingContactTasks.length;
                contactPendingTaskReminder.textContent = `You have ${taskCount} pending task${taskCount > 1 ? 's' : ''} for this contact.`;
                contactPendingTaskReminder.classList.remove('hidden');
            } else {
                contactPendingTaskReminder.classList.add('hidden');
            }
        } else if (contactPendingTaskReminder) {
            contactPendingTaskReminder.classList.add('hidden');
        }

        const contactAccountNameSelect = contactForm.querySelector("#contact-account-name");
        contactAccountNameSelect.innerHTML = '<option value="">-- No Account --</option>';
        state.accounts
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .forEach((acc) => {
                const o = document.createElement("option");
                o.value = acc.id;
                o.textContent = acc.name;
                contactAccountNameSelect.appendChild(o);
            });

        if (contact) {
            contactForm.classList.remove('hidden');
            contactForm.querySelector("#contact-id").value = contact.id;
            contactForm.querySelector("#contact-first-name").value = contact.first_name || "";
            contactForm.querySelector("#contact-last-name").value = contact.last_name || "";
            contactForm.querySelector("#contact-email").value = contact.email || "";
            contactForm.querySelector("#contact-phone").value = contact.phone || "";
            contactForm.querySelector("#contact-title").value = contact.title || "";
            contactForm.querySelector("#contact-notes").value = contact.notes || "";
            contactForm.querySelector("#contact-last-saved").textContent = contact.last_saved ? `Last Saved: ${formatDate(contact.last_saved)}` : "Not yet saved.";
            contactAccountNameSelect.value = contact.account_id || "";

            state.isFormDirty = false;

            contactActivitiesList.innerHTML = "";
            state.activities
                .filter((act) => act.contact_id === contact.id)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .forEach((act) => {
                    const li = document.createElement("li");
                    li.textContent = `[${formatDate(act.date)}] ${act.type}: ${act.description}`;
                    let borderColor = "var(--primary-blue)";
                    const activityTypeLower = act.type.toLowerCase();
                    if (activityTypeLower.includes("email")) borderColor = "var(--warning-yellow)";
                    else if (activityTypeLower.includes("call")) borderColor = "var(--completed-color)";
                    else if (activityTypeLower.includes("meeting")) borderColor = "var(--meeting-purple)";
                    li.style.borderLeftColor = borderColor;
                    contactActivitiesList.appendChild(li);
                });
            
            renderContactEmails(contact.email);

            const activeSequence = state.contact_sequences.find(cs => cs.contact_id === contact.id && cs.status === "Active");
            if (ringChart && ringChartText && sequenceStatusContent && noSequenceText && contactSequenceInfoText) {
                if (activeSequence) {
                    const sequence = state.sequences.find((s) => s.id === activeSequence.sequence_id);
                    const allSequenceSteps = state.sequence_steps.filter((s) => s.sequence_id === activeSequence.sequence_id);
                    const totalSteps = allSequenceSteps.length;
                    const currentStep = activeSequence.current_step_number;
                    const lastCompleted = currentStep - 1;
                    const percentage = totalSteps > 0 ? Math.round((lastCompleted / totalSteps) * 100) : 0;
                    ringChart.style.background = `conic-gradient(var(--completed-color) ${percentage}%, var(--bg-medium) ${percentage}% 100%)`;
                    ringChartText.textContent = `${lastCompleted}/${totalSteps}`;
                    contactSequenceInfoText.textContent = `Enrolled in "${sequence ? sequence.name : 'Unknown'}" (On Step ${currentStep} of ${totalSteps}).`;
                    sequenceStatusContent.classList.remove("hidden");
                    noSequenceText.classList.add("hidden");
                    removeFromSequenceBtn.classList.remove('hidden');
                } else {
                    sequenceStatusContent.classList.add("hidden");
                    noSequenceText.textContent = "Not in a sequence.";
                    noSequenceText.classList.remove("hidden");
                    removeFromSequenceBtn.classList.add('hidden');
                }
            }
        } else {
            hideContactDetails(true, true);
        }
    };
    
    function renderContactEmails(contactEmail) {
        if (!contactEmailsTableBody) return;
        if (!contactEmail) {
            contactEmailsTableBody.innerHTML = '<tr><td colspan="3">Contact has no email address.</td></tr>';
            return;
        }
        const loggedEmails = state.email_log.filter(email => email.sender === contactEmail || email.recipient === contactEmail).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        if (loggedEmails.length === 0) {
            contactEmailsTableBody.innerHTML = '<tr><td colspan="3">No logged emails for this contact.</td></tr>';
            return;
        }
        contactEmailsTableBody.innerHTML = '';
        loggedEmails.forEach(email => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${formatDate(email.created_at)}</td><td>${email.subject || '(No Subject)'}</td><td><button class="btn-secondary btn-view-email" data-email-id="${email.id}">View</button></td>`;
            contactEmailsTableBody.appendChild(tr);
        });
    }

    function openEmailViewModal(email) {
        if (!email) return;
        emailViewSubject.textContent = email.subject || '(No Subject)';
        emailViewFrom.textContent = email.sender || 'N/A';
        emailViewTo.textContent = email.recipient || 'N/A';
        emailViewDate.textContent = new Date(email.created_at).toLocaleString();
        emailViewBodyContent.innerHTML = (email.body_text || '(Email body is empty)').replace(/\\n/g, '<br>');
        emailViewModalBackdrop.classList.remove('hidden');
    }

    function closeEmailViewModal() {
        emailViewModalBackdrop.classList.add('hidden');
    }

    const hideContactDetails = (hideForm = true, clearSelection = false) => {
        if (contactForm && hideForm) contactForm.classList.add('hidden');
        contactForm.reset();
        contactForm.querySelector("#contact-id").value = "";
        contactForm.querySelector("#contact-last-saved").textContent = "Not yet saved.";
        contactForm.querySelector("#contact-account-name").innerHTML = '<option value="">-- No Account --</option>';
        contactActivitiesList.innerHTML = "";
        if(sequenceStatusContent) sequenceStatusContent.classList.add('hidden');
        if(noSequenceText) {
            noSequenceText.textContent = "Select a contact to see details.";
            noSequenceText.classList.remove('hidden');
        }
        if(removeFromSequenceBtn) removeFromSequenceBtn.classList.add('hidden');
        if (contactEmailsTableBody) contactEmailsTableBody.innerHTML = '';
        if(contactPendingTaskReminder) contactPendingTaskReminder.classList.add('hidden');

        if (clearSelection) {
            state.selectedContactId = null;
            document.querySelectorAll(".list-item").forEach(item => item.classList.remove("selected"));
            state.isFormDirty = false;
        }
    };

    // --- EVENT LISTENER SETUP ---
    function setupPageEventListeners() {
        setupModalListeners();
        updateActiveNavLink();
        
        navSidebar.addEventListener('click', (e) => {
            const navButton = e.target.closest('a.nav-button');
            if (navButton) {
                e.preventDefault();
                handleNavigation(navButton.href);
            }
        });

        document.getElementById("logout-btn").addEventListener("click", (e) => {
            e.preventDefault();
            const logoutUrl = e.target.href || 'index.html';
            if (state.isFormDirty) {
                showModal("Unsaved Changes", "You have unsaved changes that will be lost. Are you sure you want to log out?", async () => {
                    state.isFormDirty = false;
                    await supabase.auth.signOut();
                    window.location.href = logoutUrl;
                });
            } else {
                (async () => {
                    await supabase.auth.signOut();
                    window.location.href = logoutUrl;
                })();
            }
        });
        
        contactForm.addEventListener('input', () => {
            state.isFormDirty = true;
        });

        window.addEventListener('beforeunload', (event) => {
            if (state.isFormDirty) {
                event.preventDefault();
                event.returnValue = '';
            }
        });
        
        contactSearch.addEventListener("input", renderContactList);

        addContactBtn.addEventListener("click", () => {
            const action = () => {
                state.isFormDirty = false;
                hideContactDetails(false, true);
                contactForm.querySelector("#contact-first-name").focus();
            };
            if (state.isFormDirty) {
                showModal("Unsaved Changes", "You have unsaved changes. Are you sure you want to discard them and add a new contact?", () => {
                    hideModal();
                    action();
                });
            } else {
                action();
            }
        });

        contactList.addEventListener("click", (e) => {
            const item = e.target.closest(".list-item");
            if (item) {
                const contactId = Number(item.dataset.id);
                if (contactId !== state.selectedContactId) {
                    confirmAndSwitchContact(contactId);
                }
            }
        });

        const contactDetailsPanel = document.getElementById('contact-details');
        if (contactDetailsPanel) {
            contactDetailsPanel.addEventListener('click', (e) => {
                const viewButton = e.target.closest('.btn-view-email');
                if (viewButton) {
                    const emailId = Number(viewButton.dataset.emailId);
                    const emailToView = state.email_log.find(e => e.id === emailId);
                    openEmailViewModal(emailToView);
                }
            });
        }
        
        if(emailViewCloseBtn) emailViewCloseBtn.addEventListener('click', closeEmailViewModal);
        if(emailViewModalBackdrop) emailViewModalBackdrop.addEventListener('click', (e) => {
            if (e.target === emailViewModalBackdrop) closeEmailViewModal();
        });

        contactForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = contactForm.querySelector("#contact-id").value ? Number(contactForm.querySelector("#contact-id").value) : null;
            const data = {
                first_name: contactForm.querySelector("#contact-first-name").value.trim(),
                last_name: contactForm.querySelector("#contact-last-name").value.trim(),
                email: contactForm.querySelector("#contact-email").value.trim(),
                phone: contactForm.querySelector("#contact-phone").value.trim(),
                title: contactForm.querySelector("#contact-title").value.trim(),
                account_id: contactForm.querySelector("#contact-account-name").value ? Number(contactForm.querySelector("#contact-account-name").value) : null,
                notes: contactForm.querySelector("#contact-notes").value,
                last_saved: new Date().toISOString(),
                user_id: state.currentUser.id
            };
            if (!data.first_name || !data.last_name) return alert("First and Last name are required.");
            if (id) { await supabase.from("contacts").update(data).eq("id", id); }
            else {
                const { data: newContactData } = await supabase.from("contacts").insert([data]).select();
                if (newContactData?.length > 0) state.selectedContactId = newContactData[0].id;
            }
            state.isFormDirty = false;
            await loadAllData();
            alert("Contact saved successfully!");
        });

        deleteContactBtn.addEventListener("click", async () => {
            if (!state.selectedContactId) return;
            showModal("Confirm Deletion", "Are you sure you want to delete this contact?", async () => {
                await supabase.from("contacts").delete().eq("id", state.selectedContactId);
                state.selectedContactId = null;
                state.isFormDirty = false;
                await loadAllData();
                hideModal();
                alert("Contact deleted successfully.");
            });
        });

        bulkImportContactsBtn.addEventListener("click", () => contactCsvInput.click());
        contactCsvInput.addEventListener("change", async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = async function(e) {
                const rows = e.target.result.split("\n").filter((r) => r.trim() !== "");
                const newRecords = rows.slice(1).map((row) => {
                    const c = parseCsvRow(row);
                    return {
                        first_name: c[0] || "",
                        last_name: c[1] || "",
                        email: c[2] || "",
                        phone: c[3] || "",
                        title: c[4] || "",
                        user_id: state.currentUser.id
                    };
                });
                if (newRecords.length > 0) {
                    const { error } = await supabase.from("contacts").insert(newRecords);
                    if (error) {
                        alert("Error importing contacts: " + error.message);
                    } else {
                        alert(`${newRecords.length} contacts imported.`);
                        await loadAllData();
                    }
                } else {
                    alert("No valid records found to import.");
                }
            };
            r.readAsText(f);
            e.target.value = "";
        });

        logActivityBtn.addEventListener("click", () => {
            if (!state.selectedContactId) return alert("Please select a contact to log activity for.");
            const contact = state.contacts.find(c => c.id === state.selectedContactId);
            const typeOptions = state.activityTypes.map(t => `<option value="${t.type_name}">${t.type_name}</option>`).join('');
            showModal("Log Activity", `
                <label>Activity Type:</label><select id="modal-activity-type" required>${typeOptions || '<option value="">No types found</option>'}</select>
                <label>Description:</label><textarea id="modal-activity-description" rows="4" required></textarea>
            `, async () => {
                const type = document.getElementById('modal-activity-type').value;
                const description = document.getElementById('modal-activity-description').value.trim();
                if (!type || !description) return alert("Activity type and description are required.");
                const { error } = await supabase.from('activities').insert({
                    contact_id: state.selectedContactId,
                    account_id: contact?.account_id,
                    type: type,
                    description: description,
                    user_id: state.currentUser.id,
                    date: new Date().toISOString()
                });
                if (error) {
                    alert("Error logging activity: " + error.message);
                } else {
                    await loadAllData();
                    hideModal();
                    alert("Activity logged successfully!");
                }
            });
        });

        assignSequenceBtn.addEventListener("click", () => {
            if (!state.selectedContactId) return alert("Please select a contact to assign a sequence to.");
            const currentContactSequence = state.contact_sequences.find(cs => cs.contact_id === state.selectedContactId && cs.status === 'Active');
            if (currentContactSequence) {
                return alert(`Contact is already in an active sequence: "${state.sequences.find(s => s.id === currentContactSequence.sequence_id)?.name || 'Unknown'}". Remove them from current sequence first.`);
            }

            const availableSequences = state.sequences;
            const sequenceOptions = availableSequences.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

            showModal("Assign Sequence", `
                <label>Select Sequence:</label>
                <select id="modal-sequence-select" required><option value="">-- Select --</option>${sequenceOptions}</select>
            `, async () => {
                const sequenceId = document.getElementById('modal-sequence-select').value;
                if (!sequenceId) return alert("Please select a sequence.");
                const selectedSequence = state.sequences.find(s => s.id === Number(sequenceId));
                if (!selectedSequence) return alert("Selected sequence not found.");

                const firstStep = state.sequence_steps.find(s => s.sequence_id === selectedSequence.id && s.step_number === 1);
                if (!firstStep) return alert("Selected sequence has no steps defined. Add steps to the sequence first.");

                const { error } = await supabase.from('contact_sequences').insert({
                    contact_id: state.selectedContactId,
                    sequence_id: Number(sequenceId),
                    current_step_number: 1,
                    status: 'Active',
                    next_step_due_date: addDays(new Date(), firstStep.delay_days).toISOString(),
                    user_id: state.currentUser.id
                });
                if (error) {
                    alert("Error assigning sequence: " + error.message);
                } else {
                    await loadAllData();
                    hideModal();
                    alert("Sequence assigned successfully!");
                }
            });
        });

        removeFromSequenceBtn.addEventListener("click", async () => {
            if (!state.selectedContactId) return;
            const activeContactSequence = state.contact_sequences.find(cs => cs.contact_id === state.selectedContactId && cs.status === 'Active');
            if (!activeContactSequence) return alert("Contact is not in an active sequence.");

            showModal("Confirm Removal", `Are you sure you want to remove this contact from "${state.sequences.find(s => s.id === activeContactSequence.sequence_id)?.name || 'Unknown'}" sequence?`, async () => {
                const { error } = await supabase.from('contact_sequences').update({ status: 'Removed' }).eq('id', activeContactSequence.id);
                if (error) {
                    alert("Error removing from sequence: " + error.message);
                } else {
                    await loadAllData();
                    hideModal();
                    alert("Contact removed from sequence.");
                }
            });
        });

        if (addTaskContactBtn) addTaskContactBtn.addEventListener("click", async () => {
            if (!state.selectedContactId) return alert("Please select a contact to add a task for.");
            const contact = state.contacts.find(c => c.id === state.selectedContactId);
            showModal('Add New Task', `
                <label>Description:</label><input type="text" id="modal-task-description" required>
                <label>Due Date:</label><input type="date" id="modal-task-due-date">
            `, async () => {
                const description = document.getElementById('modal-task-description').value.trim();
                const dueDate = document.getElementById('modal-task-due-date').value;
                if (!description) { alert('Description is required.'); return; }
                const taskData = {
                    description,
                    due_date: dueDate || null,
                    contact_id: state.selectedContactId,
                    account_id: contact?.account_id,
                    user_id: state.currentUser.id,
                    status: 'Pending'
                };
                const { error } = await supabase.from('tasks').insert(taskData);
                if (error) { alert('Error adding task: ' + error.message); }
                else { await loadAllData(); hideModal(); alert('Task added successfully!'); }
            });
        });
    }

    // --- App Initialization ---
    async function initializePage() {
        await loadSVGs();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            state.currentUser = session.user;
            setupPageEventListeners();
            await setupUserMenuAndAuth(supabase, state);
            const urlParams = new URLSearchParams(window.location.search);
            const contactIdFromUrl = urlParams.get('contactId');
            if (contactIdFromUrl) state.selectedContactId = Number(contactIdFromUrl);
            await loadAllData();
        } else {
            window.location.href = "index.html";
        }
    }

    initializePage();
});
