// File: contacts.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, formatDate, formatMonthYear, parseCsvRow, themes, setupModalListeners, showModal, hideModal, updateActiveNavLink, setupUserMenuAndAuth, loadSVGs, addDays, showToast } from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        contacts: [],
        accounts: [],
        activities: [],
        contact_sequences: [],
        sequences: [],
        deals: [],
        tasks: [],
        sequence_steps: [],
        email_log: [],
        activityTypes: [],
        selectedContactId: null,
        isFormDirty: false
    };

    // --- DOM Element Selectors ---
    const navSidebar = document.querySelector(".nav-sidebar");
    const contactList = document.getElementById("contact-list");
    const contactForm = document.getElementById("contact-form");
    const contactSearch = document.getElementById("contact-search");
    const bulkImportContactsBtn = document.getElementById("bulk-import-contacts-btn");
    const bulkExportContactsBtn = document.getElementById("bulk-export-contacts-btn");
    const contactCsvInput = document.getElementById("contact-csv-input");
    const addContactBtn = document.getElementById("add-contact-btn");
    const deleteContactBtn = document.getElementById("delete-contact-btn");
    const logActivityBtn = document.getElementById("log-activity-btn");
    const assignSequenceBtn = document.getElementById("assign-sequence-btn");
    const addTaskContactBtn = document.getElementById("add-task-contact-btn");
    const contactActivitiesList = document.getElementById("contact-activities-list");
    const contactSequenceInfoText = document.getElementById("contact-sequence-info-text");
    const removeFromSequenceBtn = document.getElementById("remove-from-sequence-btn");
    const completeSequenceBtn = document.getElementById("complete-sequence-btn");
    const noSequenceText = document.getElementById("no-sequence-text");
    const sequenceStatusContent = document.getElementById("sequence-status-content");
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
    const aiActivityInsightBtn = document.getElementById("ai-activity-insight-btn");
    const aiWriteEmailBtn = document.getElementById("ai-write-email-btn");
    const organicStarIndicator = document.getElementById("organic-star-indicator");

    // --- Helper function to escape HTML characters ---
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

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
        const userSpecificTables = ["contacts", "accounts", "activities", "contact_sequences", "sequences", "deals", "tasks"];
        const sharedTables = ["sequence_steps", "email_log"];
        const userPromises = userSpecificTables.map((table) => supabase.from(table).select("*").eq("user_id", state.currentUser.id));
        const sharedPromises = sharedTables.map((table) => supabase.from(table).select("*"));
        
        const allPromises = [...userPromises, ...sharedPromises];
        const allTableNames = [...userSpecificTables, ...sharedTables];

        const { data: allActivityTypes, error: activityError } = await supabase.from("activity_types").select("*");
        if (activityError) {
            console.error("Error fetching activity types:", activityError);
        } else {
            const allTypes = [...(allActivityTypes || [])];
            state.activityTypes = [...new Map(allTypes.map(item => [item.type_name, item])).values()];
        }
        
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

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        contactList.innerHTML = "";
        filteredContacts.forEach((contact) => {
            const item = document.createElement("div");
            item.className = "list-item";
            const inActiveSequence = state.contact_sequences.some(cs => cs.contact_id === contact.id && cs.status === "Active");
            
            const hasRecentActivity = state.activities.some(act => act.contact_id === contact.id && new Date(act.date) > thirtyDaysAgo);
            
            const organicIcon = contact.is_organic ? '<span class="organic-star-list">★</span>' : '';
            const sequenceIcon = inActiveSequence ? '<span class="sequence-status-icon"><i class="fa-solid fa-paper-plane"></i></span>' : '';
            const hotIcon = hasRecentActivity ? '<span class="hot-contact-icon">🔥</span>' : '';

            item.innerHTML = `
                <div class="contact-info">
                    <div class="contact-name">${organicIcon}${contact.first_name} ${contact.last_name}${sequenceIcon}${hotIcon}</div>
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

            if (organicStarIndicator) {
                organicStarIndicator.classList.toggle('is-organic', !!contact.is_organic);
            }

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
            if (sequenceStatusContent && noSequenceText && contactSequenceInfoText) {
                if (activeSequence) {
                    const sequence = state.sequences.find((s) => s.id === activeSequence.sequence_id);
                    const allSequenceSteps = state.sequence_steps.filter((s) => s.sequence_id === activeSequence.sequence_id);
                    const totalSteps = allSequenceSteps.length;
                    const currentStep = activeSequence.current_step_number;
                    const lastCompleted = currentStep - 1;
                    const percentage = totalSteps > 0 ? Math.round((lastCompleted / totalSteps) * 100) : 0;
                    const ringProgress = document.getElementById('ring-chart-progress');
                    if (ringProgress) {
                        ringProgress.style.setProperty('--p', percentage);
                    }
                    if(ringChartText) ringChartText.textContent = `${lastCompleted}/${totalSteps}`;
                    contactSequenceInfoText.textContent = `Enrolled in "${sequence ? sequence.name : 'Unknown'}" (On Step ${currentStep} of ${totalSteps}).`;
                    sequenceStatusContent.classList.remove("hidden");
                    noSequenceText.classList.add("hidden");
                    removeFromSequenceBtn.classList.remove('hidden');
                    completeSequenceBtn.classList.remove('hidden');
                } else {
                    sequenceStatusContent.classList.add("hidden");
                    noSequenceText.textContent = "Not in a sequence.";
                    noSequenceText.classList.remove("hidden");
                    removeFromSequenceBtn.classList.add('hidden');
                    completeSequenceBtn.classList.add('hidden');
                }
            }
        } else {
            hideContactDetails(true, true);
        }
    };
    
    function renderContactEmails(contactEmail) {
        if (!contactEmailsTableBody) return;
        contactEmailsTableBody.innerHTML = ''; 

        if (!contactEmail) {
            contactEmailsTableBody.innerHTML = '<tr><td colspan="3" class="placeholder-text">Contact has no email address.</td></tr>';
            return;
        }

        const loggedEmails = state.email_log
            .filter(email => (email.recipient || '').toLowerCase() === (contactEmail || '').toLowerCase())
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
        if (loggedEmails.length === 0) {
            contactEmailsTableBody.innerHTML = '<tr><td colspan="3" class="placeholder-text">No logged emails for this contact.</td></tr>';
            return;
        }
        
        loggedEmails.forEach(email => {
            const row = contactEmailsTableBody.insertRow();
            row.dataset.emailId = email.id;
            const hasAttachment = email.attachments && email.attachments.length > 0;
            const attachmentIndicator = hasAttachment ? ` <i class="fas fa-paperclip" title="${email.attachments.length} attachment(s)"></i>` : '';
            
            row.innerHTML = `
                <td>${formatDate(email.created_at)}</td>
                <td>${email.subject || '(No Subject)'}${attachmentIndicator}</td>
                <td><button class="btn-secondary btn-view-email" data-email-id="${email.id}">View</button></td>
            `;
        });
    }

    function openEmailViewModal(email) {
        if (!email) return;

        emailViewSubject.textContent = email.subject || '(No Subject)';
        emailViewFrom.textContent = email.sender || 'N/A';
        emailViewTo.textContent = email.recipient || 'N/A';
        emailViewDate.textContent = new Date(email.created_at).toLocaleString();
        emailViewBodyContent.innerHTML = (email.body_text || '(Email body is empty)').replace(/\\n/g, '<br>');

        const attachmentsContainer = document.getElementById('email-view-attachments-container');
        if (attachmentsContainer) {
            attachmentsContainer.innerHTML = ''; 
            if (email.attachments && email.attachments.length > 0) {
                attachmentsContainer.classList.remove('hidden');
                const attachmentsTitle = document.createElement('h5');
                attachmentsTitle.textContent = 'Attachments';
                attachmentsContainer.appendChild(attachmentsTitle);

                email.attachments.forEach(att => {
                    if (typeof att === 'object' && att !== null && att.url) {
                        const link = document.createElement('a');
                        link.href = "#";

                        const fileName = att.fileName || 'Unknown File';
                        
                        let downloadPath = '';
                        try {
                            const urlObject = new URL(att.url);
                            const relevantPath = urlObject.pathname.split('/public/email-attachments/')[1];
                            if (relevantPath) {
                                downloadPath = relevantPath;
                            }
                        } catch (e) {
                            console.error("Could not parse attachment URL:", att.url, e);
                        }

                        if (downloadPath) {
                            console.log("Created download link. Path stored in data attribute:", downloadPath);

                            link.textContent = fileName;
                            link.className = "btn-secondary btn-sm attachment-link";
                            link.dataset.filename = fileName;
                            link.dataset.downloadpath = downloadPath;
                            attachmentsContainer.appendChild(link);
                        }
                    }
                });
            } else {
                attachmentsContainer.classList.add('hidden');
            }
        }

        emailViewModalBackdrop.classList.remove('hidden');

        document.querySelectorAll('.email-view-modal .attachment-link').forEach(link => {
            link.addEventListener('click', handleAttachmentClick);
        });
    }

    async function handleAttachmentClick(event) {
        event.preventDefault();
        const downloadPath = decodeURIComponent(event.target.dataset.downloadpath); 
        const fileName = event.target.dataset.filename || 'downloaded-file';

        console.log("Attempting to download from bucket 'email-attachments' with path:", downloadPath);

        if (!downloadPath) {
            console.error('File download path not found.', event.target.dataset);
            alert('Failed to download attachment. Path is missing.');
            return;
        }

        try {
            const { data, error } = await supabase.storage.from('email-attachments').download(downloadPath);

            if (error) {
                console.error('Error downloading attachment:', error);
                alert(`Failed to download attachment: ${error.message}. Please try again.`);
                return;
            }

            const blob = new Blob([data], { type: data.type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Error handling attachment download:', e);
            alert('An unexpected error occurred.');
        }
    }

    function closeEmailViewModal() {
        emailViewModalBackdrop.classList.add('hidden');
    }

    const hideContactDetails = (hideForm = true, clearSelection = false) => {
        if (contactForm && hideForm) contactForm.classList.add('hidden');
        if (contactForm) {
            contactForm.reset();
            contactForm.querySelector("#contact-id").value = "";
            contactForm.querySelector("#contact-last-saved").textContent = "Not yet saved.";
            const contactAccountNameSelect = contactForm.querySelector("#contact-account-name");
            if (contactAccountNameSelect) contactAccountNameSelect.innerHTML = '<option value="">-- No Account --</option>';
        }
        if(contactActivitiesList) contactActivitiesList.innerHTML = "";
        if(sequenceStatusContent) sequenceStatusContent.classList.add('hidden');
        if(noSequenceText) {
            noSequenceText.textContent = "Select a contact to see details.";
            noSequenceText.classList.remove("hidden");
        }
        if(removeFromSequenceBtn) removeFromSequenceBtn.classList.add('hidden');
        if(completeSequenceBtn) completeSequenceBtn.classList.add('hidden');
        if (contactEmailsTableBody) contactEmailsTableBody.innerHTML = '<tr><td colspan="3" class="placeholder-text">Select a contact to see logged emails.</td></tr>';
        if(contactPendingTaskReminder) contactPendingTaskReminder.classList.add('hidden');

        if (clearSelection) {
            state.selectedContactId = null;
            document.querySelectorAll(".list-item").forEach(item => item.classList.remove("selected"));
            state.isFormDirty = false;
        }
    };
    
    async function processAndImportImage(base64Image) {
        showToast("Analyzing image data...", 'info');
        
        try {
            const { data, error } = await supabase.functions.invoke('extract-contact-info', {
                body: { image: base64Image }
            });

            if (error) throw error;
            
            const contactData = data;

            let accountIdToLink = null;
            if (contactData.company) {
                const matchingAccount = state.accounts.find(
                    acc => acc.name && contactData.company && acc.name.toLowerCase() === contactData.company.toLowerCase()
                );
                if (matchingAccount) {
                    accountIdToLink = matchingAccount.id;
                }
            }

            let contactId = null;
            if (contactData.first_name || contactData.last_name) {
                const existingContact = state.contacts.find(c =>
                    c.first_name === contactData.first_name && c.last_name === contactData.last_name
                );
                if (existingContact) {
                    contactId = existingContact.id;
                }
            }

            if (contactId) {
                await supabase.from("contacts").update({
                    email: contactData.email || '',
                    phone: contactData.phone || '',
                    title: contactData.title || '',
                    account_id: accountIdToLink
                }).eq('id', contactId);
            } else {
                const { data: newContactArr, error: insertError } = await supabase.from("contacts").insert([
                    {
                        first_name: contactData.first_name || '',
                        last_name: contactData.last_name || '',
                        email: contactData.email || '',
                        phone: contactData.phone || '',
                        title: contactData.title || '',
                        account_id: accountIdToLink,
                        user_id: state.currentUser.id
                    }
                ]).select();
                if (insertError) throw insertError;
                contactId = newContactArr?.[0]?.id;
            }

            await loadAllData();
            state.selectedContactId = contactId;
            renderContactList();
            renderContactDetails();

            showToast(`Contact information for ${contactData.first_name || ''} ${contactData.last_name || ''} imported successfully!`, 'success');

        } catch (error) {
            console.error("Error invoking Edge Function or saving data:", error);
            showToast(`Failed to process image: ${error.message}. Please try again.`, 'error');
        } finally {
            hideModal();
        }
    }

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
            const modalBody = showModal("Importing Contact", `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">Processing image from clipboard...</p>`, null, false, `<button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
            
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

    async function handleCameraInputChange(event) {
        const file = event.target.files[0];
        if (file) {
            const modalBody = showModal("Importing Contact", `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">Processing image from camera...</p>`, null, false, `<button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
            
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

    async function handleAiWriteEmailClick() {
        if (!state.selectedContactId) {
            showModal("Error", "Please select a contact first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        const modalBody = `
            <label for="ai-email-prompt">What is the purpose of this email?</label>
            <textarea id="ai-email-prompt" rows="4" placeholder="e.g., Follow up on our call last Tuesday about cloud solutions..."></textarea>
        `;

        showModal("Write Email with AI", modalBody, async () => {
            const userPrompt = document.getElementById('ai-email-prompt').value.trim();
            if (!userPrompt) {
                alert("Please enter a prompt for the email.");
                return false;
            }
            
            hideModal(); // Close the prompt modal
            await generateAndDisplayEmail(userPrompt);
            return true;

        }, true, `<button id="modal-confirm-btn" class="btn-primary">Generate Email</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
    }

    async function generateAndDisplayEmail(userPrompt) {
        const contact = state.contacts.find(c => c.id === state.selectedContactId);
        const account = state.accounts.find(a => a.id === contact.account_id);

        showModal("Generating Email...", `<div class="loader"></div><p class="placeholder-text">Please wait while AI drafts your email...</p>`, null, false);

        try {
            const { data: emailContent, error } = await supabase.functions.invoke('generate-prospect-email', {
                body: {
                    contactName: `${contact.first_name} ${contact.last_name}`,
                    accountName: account ? account.name : '',
                    userPrompt: userPrompt
                }
            });

            if (error) throw error;
            
            hideModal(); // Hide the loading modal
            
            // --- FIX: Escape HTML characters for safe rendering ---
            const sanitizedSubject = escapeHtml(emailContent.subject);
            const sanitizedBody = escapeHtml(emailContent.body).replace(/\\n/g, '<br>');

            const modalBody = `
                <label>Subject:</label>
                <input type="text" id="ai-email-subject" value="${sanitizedSubject}" readonly style="background-color: var(--bg-dark);">
                <label>Body:</label>
                <textarea id="ai-email-body" rows="10" readonly style="background-color: var(--bg-dark);">${sanitizedBody}</textarea>
            `;

            showModal(
                "AI Generated Email",
                modalBody,
                null, // No primary action on the modal itself
                false,
                `
                <button id="modal-open-client-btn" class="btn-primary">Open in Email Client</button>
                <button id="modal-log-email-btn" class="btn-secondary">Log Email as Activity</button>
                <button id="modal-cancel-btn" class="btn-secondary">Close</button>
                `
            );
            
            // Add listeners for the new buttons inside the final modal
            document.getElementById('modal-open-client-btn').addEventListener('click', () => {
                const subject = encodeURIComponent(emailContent.subject);
                const body = encodeURIComponent(emailContent.body);
                window.location.href = `mailto:${contact.email}?subject=${subject}&body=${body}`;
            });

            document.getElementById('modal-log-email-btn').addEventListener('click', async () => {
                const { error } = await supabase.from('activities').insert({
                    contact_id: state.selectedContactId,
                    account_id: contact.account_id,
                    type: 'Email',
                    description: `Sent AI-generated email with subject: "${emailContent.subject}"`,
                    user_id: state.currentUser.id,
                    date: new Date().toISOString()
                });

                if (error) {
                    showToast("Error logging email: " + error.message, 'error');
                } else {
                    showToast("Email logged as activity!", 'success');
                    hideModal();
                    await loadAllData();
                }
            });

        } catch (err) {
            console.error("Error generating AI email:", err);
            hideModal();
            showModal("Error", `Failed to generate email: ${err.message}`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        }
    }

    function setupPageEventListeners() {
        setupModalListeners();
        
        navSidebar.addEventListener('click', (e) => {
            const navButton = e.target.closest('a.nav-button');
            if (navButton) {
                e.preventDefault();
                handleNavigation(navButton.href);
            }
        });

        if (organicStarIndicator) {
            organicStarIndicator.addEventListener('click', async () => {
                if (!state.selectedContactId) return;

                const contact = state.contacts.find(c => c.id === state.selectedContactId);
                if (!contact) return;

                const newOrganicState = !contact.is_organic;
                organicStarIndicator.classList.toggle('is-organic', newOrganicState);
                contact.is_organic = newOrganicState;

                const { error } = await supabase
                    .from('contacts')
                    .update({ is_organic: newOrganicState })
                    .eq('id', state.selectedContactId);

                if (error) {
                    console.error("Error updating organic status:", error);
                    organicStarIndicator.classList.toggle('is-organic', !newOrganicState);
                    contact.is_organic = !newOrganicState;
                    showModal("Error", "Could not save organic status.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                }
            });
        }
        
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
                hideContactDetails(false, true);
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
                    
                    state.isFormDirty = false;
                    await loadAllData();
                    state.selectedContactId = newContactArr?.[0]?.id;
                    renderContactList();
                    renderContactDetails();
                    hideModal();
                    return true;
                }, true, `<button id="modal-confirm-btn" class="btn-primary">Create Contact</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
            };

            if (state.isFormDirty) {
                showModal("Unsaved Changes", "You have unsaved changes. Do you want to discard them and add a new contact?", () => {
                    hideModal();
                    openNewContactModal();
                }, true, `<button id="modal-confirm-btn" class="btn-primary">Discard & New</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
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
                return;
            }

            if (id) {
                const { error } = await supabase.from("contacts").update(data).eq("id", id);
                if (error) {
                    showModal("Error", "Error saving contact: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }
            } else {
                const { data: newContactArr, error: insertError } = await supabase.from("contacts").insert([data]).select();
                if (insertError) {
                    showModal("Error", "Error creating contact: " + insertError.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }
                if (newContactArr?.length > 0) state.selectedContactId = newContactArr[0].id;
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
                } else {
                    state.selectedContactId = null;
                    state.isFormDirty = false;
                    await loadAllData();
                    hideModal();
                    showModal("Success", "Contact deleted successfully.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                }
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
                        company: c[5] || "",
                        user_id: state.currentUser.id
                    };
                });

                if (newRecords.length === 0) {
                    showModal("Info", "No valid records found to import.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                let recordsToUpdate = [];
                let recordsToInsert = [];
                
                const findBestAccountMatch = (companyName) => {
                    if (!companyName) return null;
                    const lowerCompanyName = companyName.toLowerCase().trim();
                    const exactMatch = state.accounts.find(acc => acc.name.toLowerCase().trim() === lowerCompanyName);
                    if (exactMatch) return exactMatch.id;
                    const partialMatch = state.accounts.find(acc => acc.name.toLowerCase().includes(lowerCompanyName) || lowerCompanyName.includes(acc.name.toLowerCase()));
                    return partialMatch ? partialMatch.id : null;
                };

                for (const record of newRecords) {
                    record.suggested_account_id = findBestAccountMatch(record.company);
                    
                    let existingContact = null;
                    if (record.email && record.email.trim()) {
                        existingContact = state.contacts.find(contact => 
                            contact.email && contact.email.toLowerCase() === record.email.toLowerCase()
                        );
                    }
                    if (!existingContact) {
                        existingContact = state.contacts.find(contact =>
                            contact.first_name.toLowerCase() === record.first_name.toLowerCase() &&
                            contact.last_name.toLowerCase() === record.last_name.toLowerCase()
                        );
                    }

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

                const accountOptions = state.accounts.map(acc => `<option value="${acc.id}">${acc.name}</option>`).join('');

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
                                    <th>Suggested Account</th>
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
                                        <td><select class="account-select"><option value="">-- No Account --</option>${accountOptions}</select></td>
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
                                        <td><select class="account-select"><option value="">-- No Account --</option>${accountOptions}</select></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                
                showModal("Confirm CSV Import", modalBodyHtml, async () => {
                    let successCount = 0;
                    let errorCount = 0;
                    
                    const selectedRowsData = [];
                    document.querySelectorAll('.modal-content .import-row input[type="checkbox"]:checked').forEach(checkbox => {
                        const row = checkbox.closest('.import-row');
                        const action = row.dataset.action;
                        const index = parseInt(row.dataset.index);
                        const accountSelect = row.querySelector('.account-select');
                        const accountId = accountSelect ? accountSelect.value : null;
                        selectedRowsData.push({ action, index, accountId });
                    });
                    
                    for (const rowData of selectedRowsData) {
                        const { action, index, accountId } = rowData;
                        
                        if (action === 'insert') {
                            const record = recordsToInsert[index];
                            record.account_id = accountId ? parseInt(accountId) : null;
                            delete record.company;
                            delete record.suggested_account_id;
                            const { error } = await supabase.from("contacts").insert([record]);
                            if (error) {
                                console.error("Error inserting contact:", error);
                                errorCount++;
                            } else {
                                successCount++;
                            }
                        } else if (action === 'update') {
                            const record = recordsToUpdate[index];
                            const updateData = {
                                first_name: record.first_name,
                                last_name: record.last_name,
                                email: record.email,
                                phone: record.phone,
                                title: record.title,
                                account_id: accountId ? parseInt(accountId) : null
                            };
                            const { error } = await supabase.from("contacts").update(updateData).eq('id', record.id);
                            if (error) {
                                console.error("Error updating contact:", error);
                                errorCount++;
                            } else {
                                successCount++;
                            }
                        }
                    }
                    
                    hideModal();

                    let resultMessage = '';
                    if (errorCount > 0) {
                        resultMessage = `Import finished with ${successCount} successes and ${errorCount} errors.`;
                    } else {
                        resultMessage = `Successfully imported/updated ${successCount} contacts.`;
                    }

                    showModal(
                        "Import Complete",
                        resultMessage,
                        async () => {
                            hideModal();
                            await loadAllData();
                        },
                        false,
                        `<button id="modal-confirm-btn" class="btn-primary">OK</button>`
                    );

                    return false;
                }, true, `<button id="modal-confirm-btn" class="btn-primary">Confirm & Import</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
                
                document.querySelectorAll('.import-row').forEach(row => {
                    const action = row.dataset.action;
                    const index = parseInt(row.dataset.index);
                    const record = action === 'insert' ? recordsToInsert[index] : recordsToUpdate[index];
                    if (record.suggested_account_id) {
                        const accountSelect = row.querySelector('.account-select');
                        if (accountSelect) accountSelect.value = record.suggested_account_id;
                    }
                });
                
                const selectAllCheckbox = document.getElementById('select-all-checkbox');
                if (selectAllCheckbox) {
                    selectAllCheckbox.addEventListener('change', (e) => {
                        const isChecked = e.target.checked;
                        document.querySelectorAll('.modal-content .row-select-checkbox').forEach(checkbox => {
                            checkbox.checked = isChecked;
                        });
                    });
                }
            };
            r.readAsText(f);
            e.target.value = "";
        });

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
                return true;
            }, true, `<button id="modal-confirm-btn" class="btn-primary">Add Activity</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
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
                } else {
                    await loadAllData();
                    hideModal();
                    showModal("Success", "Sequence assigned successfully!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                }
                return true;
            }, true, `<button id="modal-confirm-btn" class="btn-primary">Assign</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
        });

        if (completeSequenceBtn) {
            completeSequenceBtn.addEventListener("click", async () => {
                if (!state.selectedContactId) return;
                const activeContactSequence = state.contact_sequences.find(cs => cs.contact_id === state.selectedContactId && cs.status === 'Active');
                if (!activeContactSequence) return showModal("Info", "Contact is not in an active sequence.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);

                showModal("Confirm Completion", `Are you sure you want to mark this sequence as complete? This indicates a successful outcome.`, async () => {
                    const { error } = await supabase.from('contact_sequences').update({ status: 'Completed' }).eq('id', activeContactSequence.id);
                    if (error) {
                        showModal("Error", "Error completing sequence: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    } else {
                        await loadAllData();
                        hideModal();
                        showModal("Success", "Sequence marked as complete!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    }
                }, true, `<button id="modal-confirm-btn" class="btn-primary">Yes, Complete</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
            });
        }

        removeFromSequenceBtn.addEventListener("click", async () => {
            if (!state.selectedContactId) return;
            const activeContactSequence = state.contact_sequences.find(cs => cs.contact_id === state.selectedContactId && cs.status === 'Active');
            if (!activeContactSequence) return showModal("Info", "Contact is not in an active sequence.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);

            showModal("Confirm Removal", `Are you sure you want to remove this contact from the sequence? This action should be used if the sequence was unsuccessful.`, async () => {
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
                        account_id: contact?.account_id,
                        contact_id: state.selectedContactId
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

                const relevantActivities = state.activities
                    .filter(act => act.contact_id === contact.id)
                    .sort((a, b) => new Date(a.date) - new Date(b.date));

                if (relevantActivities.length === 0) {
                    showModal("Info", "No activities found for this contact to generate insights.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                const activityData = relevantActivities.map(act => 
                    `[${formatDate(act.date)}] Type: ${act.type}, Description: ${act.description}`
                ).join('\n');

                showModal("Generating AI Insight", `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">Analyzing activities and generating insights...</p>`, null, false, `<button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);

                try {
                    const { data, error } = await supabase.functions.invoke('get-activity-insight', {
                        body: {
                            contactName: `${contact.first_name || ''} ${contact.last_name || ''}`,
                            activityLog: activityData
                        }
                    });

                    if (error) throw error;

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
        
        // --- THIS IS THE CORRECT PLACEMENT FOR THE NEW EVENT LISTENER ---
        if (aiWriteEmailBtn) {
            aiWriteEmailBtn.addEventListener("click", handleAiWriteEmailClick);
        }
    }

    // --- App Initialization ---
    async function initializePage() {
        await loadSVGs();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            state.currentUser = { ...session.user };
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
