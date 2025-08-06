// js/contacts.js

import { SUPABASE_URL, SUPABASE_ANON_KEY, formatDate, formatMonthYear, parseCsvRow, themes, setupModalListeners, showModal, hideModal, updateActiveNavLink, setupUserMenuAndAuth, loadSVGs } from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        contacts: [],
        accounts: [], // Ensure accounts are loaded in state for mapping
        activities: [],
        contact_sequences: [],
        deals: [],
        selectedContactId: null,
        tasks: [],
        isFormDirty: false
    };

    // --- DOM Element Selectors ---
    const navSidebar = document.querySelector(".nav-sidebar");
    const contactList = document.getElementById("contact-list");
    const contactForm = document.getElementById("contact-form");
    const contactSearch = document.getElementById("contact-search");
    const bulkImportContactsBtn = document.getElementById("bulk-import-contacts-btn");
    const bulkExportContactsBtn = document.getElementById("bulk-export-contacts-btn"); // NEW
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
    const importContactScreenshotBtn = document.getElementById("import-contact-screenshot-btn");
    const takePictureBtn = document.getElementById("take-picture-btn");
    const cameraInput = document.getElementById("camera-input");
    // NEW: AI Activity Insight button selector
    const aiActivityInsightBtn = document.getElementById("ai-activity-insight-btn");


    // --- Dirty Check and Navigation ---
    const handleNavigation = (url) => {
        if (state.isFormDirty) {
            showModal("Unsaved Changes", "You have unsaved changes that will be lost. Are you sure you want to leave?", () => {
                state.isFormDirty = false;
                window.location.href = url;
            }, true, `<button id="modal-confirm-btn" class="btn-primary">Discard & Leave</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
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
            }, true, `<button id="modal-confirm-btn" class="btn-primary">Discard & Switch</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
        } else {
            state.selectedContactId = newContactId;
            renderContactList();
            renderContactDetails();
        }
    };


    // --- Data Fetching ---
    async function loadAllData() {
        if (!state.currentUser) return;
        // Ensure 'accounts' is included in userSpecificTables to be loaded into state
        const userSpecificTables = ["contacts", "accounts", "activities", "contact_sequences", "sequences", "deals", "tasks"];
        const sharedTables = ["sequence_steps", "email_log"];
        const userPromises = userSpecificTables.map((table) => supabase.from(table).select("*").eq("user_id", state.currentUser.id));
        const sharedPromises = sharedTables.map((table) => supabase.from(table).select("*"));
        const allPromises = [...userPromises, ...sharedPromises];
        const allTableNames = [...userSpecificTables, ...sharedTables];


        // FIX: Combine both queries into a single select
        let activityTypesData = [];
        const { data: allActivityTypes, error: activityError } = await supabase.from("activity_types").select("*");
        if (activityError) {
            console.error("Error fetching activity types:", activityError);
        } else {
            activityTypesData = allActivityTypes || [];
        }

        state.activityTypes = activityTypesData;

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

    const populateAccountDropdown = () => {
        const contactAccountNameSelect = contactForm.querySelector("#contact-account-name");
        if (!contactAccountNameSelect) return;
        
        contactAccountNameSelect.innerHTML = '<option value="">-- No Account --</option>';
        state.accounts
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .forEach((acc) => {
                const o = document.createElement("option");
                o.value = acc.id;
                o.textContent = acc.name;
                contactAccountNameSelect.appendChild(o);
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
        
        populateAccountDropdown();

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
            contactForm.querySelector("#contact-account-name").value = contact.account_id || "";

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
        const loggedEmails = state.email_log.filter(email => (email.sender || '').toLowerCase() === (contactEmail || '').toLowerCase() || (email.recipient || '').toLowerCase() === (contactEmail || '').toLowerCase()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
        const contactAccountNameSelect = contactForm.querySelector("#contact-account-name");
        if (contactAccountNameSelect) contactAccountNameSelect.innerHTML = '<option value="">-- No Account --</option>';
        contactActivitiesList.innerHTML = "";
        if(sequenceStatusContent) sequenceStatusContent.classList.add('hidden');
        if(noSequenceText) {
            noSequenceText.textContent = "Select a contact to see details.";
            noSequenceText.classList.remove("hidden");
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
    
    // Unified function to process and send image data to the Edge Function
    async function processAndImportImage(base64Image) {
        // Show a loading state in the modal
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">Analyzing image...</p>`;

        try {
            // Call the Supabase Edge Function
            const { data, error } = await supabase.functions.invoke('extract-contact-info', {
                body: { image: base64Image }
            });

            if (error) throw error;
            
            const contactData = data;

            // --- NEW LOGIC FOR ACCOUNT MAPPING ---
            let accountIdToLink = null;
            if (contactData.company) {
                // Find a matching account by name (case-insensitive)
                const matchingAccount = state.accounts.find(
                    acc => acc.name && contactData.company && acc.name.toLowerCase() === contactData.company.toLowerCase()
                );
                if (matchingAccount) {
                    accountIdToLink = matchingAccount.id;
                }
            }
            // --- END NEW LOGIC ---

            // Check for an existing contact by name
            let contactId = null;
            if (contactData.first_name || contactData.last_name) {
                const existingContact = state.contacts.find(c =>
                    c.first_name === contactData.first_name && c.last_name === contactData.last_name
                );
                if (existingContact) {
                    contactId = existingContact.id;
                }
            }

            // Create or update the contact
            if (contactId) {
                // Update existing contact
                await supabase.from("contacts").update({
                    email: contactData.email || '',
                    phone: contactData.phone || '',
                    title: contactData.title || '',
                    account_id: accountIdToLink // Use the resolved account ID
                }).eq('id', contactId);
            } else {
                // Create a new contact
                const { data: newContactArr, error: insertError } = await supabase.from("contacts").insert([
                    {
                        first_name: contactData.first_name || '',
                        last_name: contactData.last_name || '',
                        email: contactData.email || '',
                        phone: contactData.phone || '',
                        title: contactData.title || '',
                        account_id: accountIdToLink, // Use the resolved account ID for new contacts
                        user_id: state.currentUser.id
                    }
                ]).select();
                if (insertError) throw insertError;
                contactId = newContactArr?.[0]?.id;
            }

            await loadAllData(); // Reload all data
            state.selectedContactId = contactId;
            renderContactList(); // Re-render list to highlight
            renderContactDetails(); // Display in form

            hideModal();
            showModal("Success", `Contact information for ${contactData.first_name || ''} ${contactData.last_name || ''} imported successfully!`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);

        } catch (error) {
            console.error("Error invoking Edge Function or saving data:", error);
            showModal("Error", `Failed to process image: ${error.message}. Please try again or enter the details manually.`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        }
    }

    // Handles the paste event for importing a screenshot
    async function handlePasteEvent(event) {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        let blob = null;
    
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                blob = item.getAsFile();
                break;
            }
        }
    
        if (blob) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Image = e.target.result.split(',')[1];
                await processAndImportImage(base64Image);
            };
            reader.readAsDataURL(blob);
        } else {
            showModal("Error", "No image found in clipboard. Please ensure you copied an image.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        }
    }

    // Handles the change event for camera input
    async function handleCameraInputChange(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Image = e.target.result.split(',')[1];
                await processAndImportImage(base64Image);
            };
            reader.readAsDataURL(file);
        } else {
            showModal("Error", "No image captured from camera.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        }
    }


    // --- EVENT LISTENER SETUP ---
    function setupPageEventListeners() {
        setupModalListeners();
        
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
                }, true, `<button id="modal-confirm-btn" class="btn-primary">Discard & Log Out</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
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
            const openNewContactModal = () => {
                hideContactDetails(false, true); // Clear form and selection
                showModal("New Contact", `
                    <label>First Name:</label><input type="text" id="modal-contact-first-name" required><br>
                    <label>Last Name:</label><input type="text" id="modal-contact-last-name" required>
                `, async () => {
                    const firstName = document.getElementById("modal-contact-first-name")?.value.trim();
                    const lastName = document.getElementById("modal-contact-last-name")?.value.trim();
                    if (!firstName || !lastName) {
                        showModal("Error", "First Name and Last Name are required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                        return false;
                    }

                    const { data: newContactArr, error } = await supabase.from("contacts").insert([{ 
                        first_name: firstName, 
                        last_name: lastName, 
                        user_id: state.currentUser.id 
                    }]).select();

                    if (error) {
                        showModal("Error", "Error creating contact: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                        return false;
                    }
                    
                    state.isFormDirty = false; // Reset dirty state after successful creation
                    await loadAllData(); // Reload all data to include the new contact
                    state.selectedContactId = newContactArr?.[0]?.id; // Select the newly created contact
                    renderContactList(); // Re-render list to highlight new contact
                    renderContactDetails(); // Display new contact in the form
                    hideModal(); // Close the modal
                    return true;
                }, true, `<button id="modal-confirm-btn" class="btn-primary">Create Contact</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
            };

            if (state.isFormDirty) {
                showModal("Unsaved Changes", "You have unsaved changes. Do you want to discard them and add a new contact?", () => {
                    hideModal();
                    openNewContactModal();
                }, true, `<button id="modal-confirm-btn" class="btn-primary">Discard & Add New</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
            } else {
                openNewContactModal();
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
            if (!data.first_name || !data.last_name) {
                showModal("Error", "First and Last name are required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                return; // Prevent form submission
            }

            // If ID exists, update; otherwise, insert
            if (id) {
                const { error } = await supabase.from("contacts").update(data).eq("id", id);
                if (error) {
                    showModal("Error", "Error saving contact: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }
            } else {
                const { data: newContactData, error: insertError } = await supabase.from("contacts").insert([data]).select();
                if (insertError) {
                    showModal("Error", "Error creating contact: " + insertError.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }
                if (newContactData?.length > 0) state.selectedContactId = newContactData[0].id;
            }
            state.isFormDirty = false;
            await loadAllData();
            showModal("Success", "Contact saved successfully!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        });

        deleteContactBtn.addEventListener("click", async () => {
            if (!state.selectedContactId) return;
            showModal("Confirm Deletion", "Are you sure you want to delete this contact?", async () => {
                const { error } = await supabase.from("contacts").delete().eq("id", state.selectedContactId);
                if (error) {
                    showModal("Error", "Error deleting contact: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }
                state.selectedContactId = null;
                state.isFormDirty = false;
                await loadAllData();
                hideModal();
                showModal("Success", "Contact deleted successfully.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            }, true, `<button id="modal-confirm-btn" class="btn-danger">Delete</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
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

                if (newRecords.length === 0) {
                    showModal("Info", "No valid records found to import.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                let recordsToUpdate = [];
                let recordsToInsert = [];
                
                // First, check for duplicates and changes
                for (const record of newRecords) {
                    const existingContact = state.contacts.find(contact => 
                        contact.email && contact.email.toLowerCase() === (record.email || '').toLowerCase()
                    );
                    if (existingContact) {
                        let changes = {};
                        if (existingContact.first_name !== record.first_name) changes.first_name = { old: existingContact.first_name, new: record.first_name };
                        if (existingContact.last_name !== record.last_name) changes.last_name = { old: existingContact.last_name, new: record.last_name };
                        if (existingContact.phone !== record.phone) changes.phone = { old: existingContact.phone, new: record.phone };
                        if (existingContact.title !== record.title) changes.title = { old: existingContact.title, new: record.title };
                        
                        recordsToUpdate.push({ ...record, id: existingContact.id, changes });
                    } else {
                        recordsToInsert.push(record);
                    }
                }

                // Prepare the modal content with a summary of changes
                const modalBodyHtml = `
                    <p>The import process identified the following changes. Use the checkboxes to select which rows you want to process.</p>
                    <div class="table-container-scrollable" style="max-height: 400px;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th><input type="checkbox" id="select-all-checkbox" checked></th>
                                    <th>Action</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Changes</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${recordsToInsert.map((r, index) => `
                                    <tr class="import-row" data-action="insert" data-index="${index}">
                                        <td><input type="checkbox" class="row-select-checkbox" checked></td>
                                        <td style="color: var(--success-color);">Insert New</td>
                                        <td>${r.first_name} ${r.last_name}</td>
                                        <td>${r.email}</td>
                                        <td>-</td>
                                    </tr>
                                `).join('')}
                                ${recordsToUpdate.map((r, index) => `
                                    <tr class="import-row" data-action="update" data-index="${index}">
                                        <td><input type="checkbox" class="row-select-checkbox" checked></td>
                                        <td style="color: var(--warning-yellow);">Update Existing</td>
                                        <td>${r.first_name} ${r.last_name}</td>
                                        <td>${r.email}</td>
                                        <td>
                                            ${Object.keys(r.changes).map(key => `
                                                <p><small><strong>${key}:</strong> "${r.changes[key].old}" &rarr; "<strong>${r.changes[key].new}</strong>"</small></p>
                                            `).join('')}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;

                showModal("Confirm CSV Import", modalBodyHtml, async () => {
                    let successCount = 0;
                    let errorCount = 0;
                    const selectedRows = document.querySelectorAll('#modal-body .import-row input[type="checkbox"]:checked');
                    
                    for (const checkbox of selectedRows) {
                        const row = checkbox.closest('.import-row');
                        const action = row.dataset.action;
                        const index = row.dataset.index;

                        if (action === 'insert') {
                            const record = recordsToInsert[index];
                            const { error } = await supabase.from("contacts").insert([record]);
                            if (error) {
                                console.error("Error inserting contact:", error);
                                errorCount++;
                            } else {
                                successCount++;
                            }
                        } else if (action === 'update') {
                            const record = recordsToUpdate[index];
                            const updateData = {};
                            for (const key in record.changes) {
                                updateData[key] = record[key];
                            }
                            if (Object.keys(updateData).length > 0) {
                                const { error } = await supabase.from("contacts").update(updateData).eq('id', record.id);
                                if (error) {
                                    console.error("Error updating contact:", error);
                                    errorCount++;
                                } else {
                                    successCount++;
                                }
                            } else {
                                successCount++; // No changes to update, but still count as a success
                            }
                        }
                    }

                    // Show a final result modal
                    if (errorCount > 0) {
                        showModal("Import Complete", `Import finished with ${successCount} successes and ${errorCount} errors.`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    } else {
                        showModal("Import Complete", `Successfully imported/updated ${successCount} contacts.`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    }

                    await loadAllData();
                    return true;
                }, true, `<button id="modal-confirm-btn" class="btn-primary">Confirm & Import</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
                
                // Add event listener for the select-all checkbox
                const selectAllCheckbox = document.getElementById('select-all-checkbox');
                if (selectAllCheckbox) {
                    selectAllCheckbox.addEventListener('change', (e) => {
                        const isChecked = e.target.checked;
                        document.querySelectorAll('#modal-body .row-select-checkbox').forEach(checkbox => {
                            checkbox.checked = isChecked;
                        });
                    });
                }
            };
            r.readAsText(f);
            e.target.value = "";
        });

        // NEW: Bulk export contacts to CSV
        if (bulkExportContactsBtn) {
            bulkExportContactsBtn.addEventListener("click", () => {
                const contactsToExport = state.contacts;
                if (contactsToExport.length === 0) {
                    showModal("Info", "No contacts to export.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                let csvContent = "data:text/csv;charset=utf-8,";
                const headers = ["first_name", "last_name", "email", "phone", "title"];
                csvContent += headers.join(",") + "\r\n";

                contactsToExport.forEach(contact => {
                    const row = [
                        `"${(contact.first_name || '').replace(/"/g, '""')}"`,
                        `"${(contact.last_name || '').replace(/"/g, '""')}"`,
                        `"${(contact.email || '').replace(/"/g, '""')}"`,
                        `"${(contact.phone || '').replace(/"/g, '""')}"`,
                        `"${(contact.title || '').replace(/"/g, '""')}"`
                    ];
                    csvContent += row.join(",") + "\r\n";
                });

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "contacts_export.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }


        logActivityBtn.addEventListener("click", () => {
            if (!state.selectedContactId) return showModal("Error", "Please select a contact to log activity for.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            const contact = state.contacts.find(c => c.id === state.selectedContactId);
            const typeOptions = state.activityTypes.map(t => `<option value="${t.type_name}">${t.type_name}</option>`).join('');
            
            showModal("Log Activity", `
                <label>Activity Type:</label><select id="modal-activity-type" required>${typeOptions || '<option value="">No types found</option>'}</select>
                <label>Description:</label><textarea id="modal-activity-description" rows="4" required></textarea>
            `, async () => {
                const type = document.getElementById('modal-activity-type').value;
                const description = document.getElementById('modal-activity-description').value.trim();
                if (!type || !description) {
                    showModal("Error", "Activity type and description are required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return false;
                }
                const { error } = await supabase.from('activities').insert({
                    contact_id: state.selectedContactId,
                    account_id: contact?.account_id,
                    type: type,
                    description: description,
                    user_id: state.currentUser.id,
                    date: new Date().toISOString()
                });
                if (error) {
                    showModal("Error", "Error logging activity: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                } else {
                    await loadAllData();
                    hideModal();
                    showModal("Success", "Activity logged successfully!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                }
                return true; // Indicate success for modal to close
            });
        });

        assignSequenceBtn.addEventListener("click", () => {
            if (!state.selectedContactId) return showModal("Error", "Please select a contact to assign a sequence to.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            const currentContactSequence = state.contact_sequences.find(cs => cs.contact_id === state.selectedContactId && cs.status === 'Active');
            if (currentContactSequence) {
                showModal("Error", `Contact is already in an active sequence: "${state.sequences.find(s => s.id === currentContactSequence.sequence_id)?.name || 'Unknown'}"". Remove them from current sequence first.`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                return;
            }

            const availableSequences = state.sequences;
            const sequenceOptions = availableSequences.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

            showModal("Assign Sequence", `
                <label>Select Sequence:</label>
                <select id="modal-sequence-select" required><option value="">-- Select --</option>${sequenceOptions}</select>
            `, async () => {
                const sequenceId = document.getElementById('modal-sequence-select').value;
                if (!sequenceId) {
                    showModal("Error", "Please select a sequence.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return false;
                }
                const selectedSequence = state.sequences.find(s => s.id === Number(sequenceId));
                if (!selectedSequence) {
                    showModal("Error", "Selected sequence not found.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return false;
                }

                const firstStep = state.sequence_steps.find(s => s.sequence_id === selectedSequence.id && s.step_number === 1);
                if (!firstStep) {
                    showModal("Error", "Selected sequence has no steps defined. Add steps to the sequence first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return false;
                }

                const { error } = await supabase.from('contact_sequences').insert({
                    contact_id: state.selectedContactId,
                    sequence_id: Number(sequenceId),
                    current_step_number: 1,
                    status: 'Active',
                    next_step_due_date: addDays(new Date(), firstStep.delay_days).toISOString(),
                    user_id: state.currentUser.id
                });
                if (error) {
                    showModal("Error", "Error assigning sequence: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return false;
                } else {
                    await loadAllData();
                    hideModal();
                    showModal("Success", "Sequence assigned successfully!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return true;
                }
            }, true, `<button id="modal-confirm-btn" class="btn-primary">Assign</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
        });

        removeFromSequenceBtn.addEventListener("click", async () => {
            if (!state.selectedContactId) return;
            const activeContactSequence = state.contact_sequences.find(cs => cs.contact_id === state.selectedContactId && cs.status === 'Active');
            if (!activeContactSequence) return showModal("Info", "Contact is not in an active sequence.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);

            showModal("Confirm Removal", `Are you sure you want to remove this contact from "${state.sequences.find(s => s.id === activeContactSequence.sequence_id)?.name || 'Unknown'}" sequence?`, async () => {
                const { error } = await supabase.from('contact_sequences').update({ status: 'Removed' }).eq('id', activeContactSequence.id);
                if (error) {
                    showModal("Error", "Error removing from sequence: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                } else {
                    await loadAllData();
                    hideModal();
                    showModal("Success", "Contact removed from sequence.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                }
            }, true, `<button id="modal-confirm-btn" class="btn-danger">Remove</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
        });

        if (addTaskContactBtn) addTaskContactBtn.addEventListener("click", async () => {
            if (!state.selectedContactId) return showModal("Error", "Please select a contact to add a task for.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            const contact = state.contacts.find(c => c.id === state.selectedContactId);
            showModal('Add New Task', `
                <label>Description:</label><input type="text" id="modal-task-description" required><br><label>Due Date:</label><input type="date" id="modal-task-due-date">`,
                async () => {
                    const description = document.getElementById('modal-task-description').value.trim();
                    const dueDate = document.getElementById('modal-task-due-date').value;
                    if (!description) {
                        alert('Task description is required.');
                        return false;
                    }
                    const newTask = {
                        user_id: state.currentUser.id,
                        description,
                        due_date: dueDate || null,
                        status: 'Pending',
                        account_id: contact?.account_id
                    };
                    const { error } = await supabase.from('tasks').insert([newTask]);
                    if (error) {
                        showModal("Error", 'Error adding task: ' + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    } else {
                        await loadAllData();
                        hideModal();
                        showModal("Success", 'Task added successfully!', null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    }
                    return true;
                }, true, `<button id="modal-confirm-btn" class="btn-primary">Add Task</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
        });

        if (importContactScreenshotBtn) {
            importContactScreenshotBtn.addEventListener("click", () => {
                showModal("Import Contact Information",
                    `<p>To import contact information:</p>
                    <ul>
                        <li><strong>Paste a screenshot:</strong> Use CTRL+V (or CMD+V on Mac) after taking a screenshot of an email signature.</li>
                        <li><strong>Take a picture:</strong> (Mobile only) Click the "Take Picture of Signature" button to use your device's camera.</li>
                    </ul>`,
                    null, false,
                    `<button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
                );
            
                document.addEventListener('paste', handlePasteEvent, { once: true });
            });
        }

        if (takePictureBtn) {
            takePictureBtn.addEventListener("click", () => {
                cameraInput.click();
                showModal("Camera Ready", "Your device camera should be opening. Please take a picture of the email signature or business card.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            });
        }

        if (cameraInput) {
            cameraInput.addEventListener('change', handleCameraInputChange);
        }

        // NEW: Event listener for AI Activity Insight button
        if (aiActivityInsightBtn) {
            aiActivityInsightBtn.addEventListener("click", async () => {
                if (!state.selectedContactId) {
                    showModal("Error", "Please select a contact to get AI insights.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                const contact = state.contacts.find(c => c.id === state.selectedContactId);
                if (!contact) {
                    showModal("Error", "Selected contact not found.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                // Filter activities relevant to the selected contact
                const relevantActivities = state.activities
                    .filter(act => act.contact_id === contact.id)
                    .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort chronologically for better summary

                if (relevantActivities.length === 0) {
                    showModal("Info", "No activities found for this contact to generate insights.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                // Prepare activity data for the AI
                const activityData = relevantActivities.map(act => 
                    `[${formatDate(act.date)}] Type: ${act.type}, Description: ${act.description}`
                ).join('\n');

                // Show loading modal
                showModal("Generating AI Insight", `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">Analyzing activities and generating insights...</p>`, null, false, `<button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);

                try {
                    // Call the new Supabase Edge Function for AI insight
                    const { data, error } = await supabase.functions.invoke('get-activity-insight', {
                        body: {
                            contactName: `${contact.first_name || ''} ${contact.last_name || ''}`,
                            activityLog: activityData
                        }
                    });

                    if (error) throw error;

                    // Display the AI-generated insight
                    const insight = data.insight || "No insight generated.";
                    const nextSteps = data.next_steps || "No specific next steps suggested.";

                    showModal("AI Activity Insight", `
                        <h4>Summary:</h4>
                        <p>${insight}</p>
                        <h4>Suggested Next Steps:</h4>
                        <p>${nextSteps}</p>
                    `, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);

                } catch (error) {
                    console.error("Error invoking AI insight Edge Function:", error);
                    showModal("Error", `Failed to generate AI insight: ${error.message}. Please try again.`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                }
            });
        }

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
