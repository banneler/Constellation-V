import { SUPABASE_URL, SUPABASE_ANON_KEY, formatDate, formatMonthYear, parseCsvRow, themes, setupModalListeners, showModal, hideModal, updateActiveNavLink, setupUserMenuAndAuth, initializeAppState, getState, loadSVGs, addDays, showToast, setupGlobalSearch, checkAndSetNotifications, injectGlobalNavigation } from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    injectGlobalNavigation();
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
        products: [],
        selectedContactId: null,
        isFormDirty: false, // Comma was missing here
        nameDisplayFormat: 'lastFirst'
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
    const assignSequenceSelect = document.getElementById("assign-sequence-select");
    let tomSelectAccount = null;
    let tomSelectSequence = null;
    let tomSelectIndustry = null;

    function initTomSelect(el, opts = {}) {
        if (typeof window.TomSelect === 'undefined') return null;
        try {
            return new window.TomSelect(el, { create: false, ...opts });
        } catch (e) {
            return null;
        }
    }

    function populateAssignSequenceDropdown() {
        if (!assignSequenceSelect) return;
        if (tomSelectSequence) {
            tomSelectSequence.destroy();
            tomSelectSequence = null;
        }
        const currentContactSequence = state.selectedContactId
            ? state.contact_sequences.find(cs => cs.contact_id === state.selectedContactId && cs.status === 'Active')
            : null;
        const showDropdown = state.selectedContactId && !currentContactSequence;

        assignSequenceSelect.innerHTML = '<option value="">Assign Sequence</option>' +
            state.sequences.map(s => `<option value="${s.id}">${s.is_abm ? '[ABM] ' : ''}${s.name}</option>`).join('');
        assignSequenceSelect.value = '';
        if (showDropdown) {
            assignSequenceSelect.classList.remove('hidden');
            tomSelectSequence = initTomSelect(assignSequenceSelect, {
                placeholder: 'Assign Sequence',
                searchField: [],
                dropdownParent: 'body',
                render: {
                    dropdown: function() {
                        const d = document.createElement('div');
                        d.className = 'ts-dropdown tom-select-no-search';
                        return d;
                    }
                }
            });
        } else {
            assignSequenceSelect.classList.add('hidden');
        }
    }

    function populateAccountDropdown() {
        const contactAccountNameSelect = contactForm.querySelector("#contact-account-name");
        if (!contactAccountNameSelect) return;
        if (tomSelectAccount) {
            tomSelectAccount.destroy();
            tomSelectAccount = null;
        }
        contactAccountNameSelect.innerHTML = '<option value="">-- No Account --</option>';
        state.accounts
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .forEach((acc) => {
                const o = document.createElement("option");
                o.value = acc.id;
                o.textContent = acc.name;
                contactAccountNameSelect.appendChild(o);
            });
        tomSelectAccount = initTomSelect(contactAccountNameSelect, { placeholder: '-- No Account --' });
    }

    const addTaskContactBtn = document.getElementById("add-task-contact-btn");
    const contactActivitiesList = document.getElementById("contact-activities-list");
    const removeFromSequenceBtn = document.getElementById("remove-from-sequence-btn");
    const completeSequenceBtn = document.getElementById("complete-sequence-btn");
    const sequenceEnrollmentText = document.getElementById("sequence-enrollment-text");
    const ringChartText = document.getElementById("ring-chart-text");
    const contactEmailsList = document.getElementById("contact-emails-list");
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
    const aiClearInsightBtn = document.getElementById("ai-clear-insight-btn");
    const organicStarIndicator = document.getElementById("organic-star-indicator");
    const aiAssistantContent = document.getElementById("ai-assistant-content");
    const aiToastContainer = document.getElementById("ai-toast-container");
    const sortFirstLastBtn = document.getElementById("sort-first-last-btn");
    const sortLastFirstBtn = document.getElementById("sort-last-first-btn");

    function showAIToast(message, type = 'success') {
        if (!aiToastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        aiToastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('hide');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 4000);
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
    try {
        const [
            contactsRes,
            accountsRes,
            activitiesRes,
            contactSequencesRes,
            sequencesRes, // Consolidated into one simple query
            dealsRes,
            tasksRes,
            sequenceStepsRes,
            emailLogRes,
            activityTypesRes,
            productsRes
        ] = await Promise.all([
            supabase.from('contacts').select('*').eq('user_id', getState().effectiveUserId),
            supabase.from('accounts').select('*').eq('user_id', getState().effectiveUserId),
            supabase.from('activities').select('*').eq('user_id', getState().effectiveUserId),
            supabase.from('contact_sequences').select('*').eq('user_id', getState().effectiveUserId),
            supabase.from('sequences').select('*').eq('user_id', getState().effectiveUserId),
            supabase.from('deals').select('*').eq('user_id', getState().effectiveUserId),
            supabase.from('tasks').select('*').eq('user_id', getState().effectiveUserId),
            supabase.from('sequence_steps').select('*'),
            supabase.from('email_log').select('*'),
            supabase.from('activity_types').select('*'),
            supabase.from('product_knowledge').select('product_name')
        ]);

        // Helper to check for errors and assign data
        const processResponse = (res, tableName) => {
            if (res.error) console.error(`Error loading ${tableName}:`, res.error.message);
            return res.data || [];
        };

        state.contacts = processResponse(contactsRes, 'contacts');
        state.accounts = processResponse(accountsRes, 'accounts');
        state.activities = processResponse(activitiesRes, 'activities');
        state.contact_sequences = processResponse(contactSequencesRes, 'contact_sequences');
        state.deals = processResponse(dealsRes, 'deals');
        state.tasks = processResponse(tasksRes, 'tasks');
        state.sequence_steps = processResponse(sequenceStepsRes, 'sequence_steps');
        state.email_log = processResponse(emailLogRes, 'email_log');
        state.activityTypes = [...new Map(processResponse(activityTypesRes, 'activity_types').map(item => [item.type_name, item])).values()];
        state.sequences = processResponse(sequencesRes, 'sequences'); // Assign all of your sequences
        const productData = processResponse(productsRes, 'product_knowledge');
        state.products = [...new Set(productData.map(p => p?.product_name).filter(Boolean))].sort();

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
    function updateSortToggleUI() {
        if (state.nameDisplayFormat === 'firstLast') {
            sortFirstLastBtn.classList.add('active');
            sortLastFirstBtn.classList.remove('active');
        } else {
            sortFirstLastBtn.classList.remove('active');
            sortLastFirstBtn.classList.add('active');
        }
    }
    
    // --- Render Functions ---
    const renderContactList = () => {
        if (!contactList) return;
        const searchTerm = contactSearch.value.toLowerCase();
        
        const filteredContacts = state.contacts
            .filter(c => (c.first_name || "").toLowerCase().includes(searchTerm) || (c.last_name || "").toLowerCase().includes(searchTerm) || (c.email || "").toLowerCase().includes(searchTerm))
            .sort((a, b) => {
                if (state.nameDisplayFormat === 'firstLast') {
                    return (a.first_name || "").localeCompare(b.first_name || "");
                } else { // lastFirst
                    return (a.last_name || "").localeCompare(b.last_name || "");
                }
            });

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

            const displayName = state.nameDisplayFormat === 'firstLast'
                ? `${contact.first_name} ${contact.last_name}`
                : `${contact.last_name}, ${contact.first_name}`;

            item.innerHTML = `
                <div class="contact-info">
                    <div class="contact-picker-item-icons${!contact.is_organic ? ' contact-picker-item-icons-empty' : ''}">${organicIcon}</div>
                    <div class="contact-name">${displayName}</div>
                    <div class="contact-picker-row-icons">${sequenceIcon}${hotIcon}</div>
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

        if (contact) {
            const accountRow = document.getElementById("contact-account-row");
            if (accountRow) accountRow.classList.remove("hidden");
            populateAccountDropdown();
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
            const accountVal = contact.account_id || "";
            contactForm.querySelector("#contact-account-name").value = accountVal;
            if (tomSelectAccount) tomSelectAccount.setValue(accountVal);

            state.isFormDirty = false;

            contactActivitiesList.innerHTML = "";
            const activities = state.activities
                .filter((act) => act.contact_id === contact.id)
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            if (activities.length === 0) {
                contactActivitiesList.innerHTML = '<p class="recent-activities-empty text-sm text-[var(--text-medium)] px-4 py-6">No activities yet.</p>';
            } else {
                activities.forEach((act) => {
                    const typeLower = act.type.toLowerCase();
                    let iconClass = "icon-default", icon = "fa-circle-info", iconPrefix;
                    if (typeLower.includes("cognito") || typeLower.includes("intelligence")) { icon = "fa-magnifying-glass"; }
                    else if (typeLower.includes("email")) { iconClass = "icon-email"; icon = "fa-envelope"; }
                    else if (typeLower.includes("call")) { iconClass = "icon-call"; icon = "fa-phone"; }
                    else if (typeLower.includes("meeting")) { iconClass = "icon-meeting"; icon = "fa-video"; }
                    else if (typeLower.includes("linkedin")) { iconClass = "icon-linkedin"; icon = "fa-linkedin-in"; iconPrefix = "fa-brands"; }
                    const item = document.createElement("div");
                    item.className = "recent-activity-item";
                    item.innerHTML = `
                        <div class="activity-icon-wrap ${iconClass}"><i class="${iconPrefix || "fas"} ${icon}"></i></div>
                        <div class="activity-body">
                            <div class="activity-description">${act.type}: ${act.description}</div>
                            <div class="activity-date">${formatDate(act.date)}</div>
                        </div>
                    `;
                    contactActivitiesList.appendChild(item);
                });
            }
            
            renderContactEmails(contact.email);
            renderAIAssistant(contact);

            const activeSequence = state.contact_sequences.find(cs => cs.contact_id === contact.id && cs.status === "Active");
            const ringChart = document.getElementById('ring-chart');
            const ringProgress = document.getElementById('ring-chart-progress');
            if (ringChart) ringChart.classList.remove('ring-chart-inactive');
            if (sequenceEnrollmentText && ringChartText) {
                if (activeSequence) {
                    const sequence = state.sequences.find((s) => s.id === activeSequence.sequence_id);
                    const allSequenceSteps = state.sequence_steps.filter((s) => s.sequence_id === activeSequence.sequence_id);
                    const totalSteps = allSequenceSteps.length;
                    const currentStep = activeSequence.current_step_number;
                    const lastCompleted = currentStep - 1;
                    const percentage = totalSteps > 0 ? Math.round((lastCompleted / totalSteps) * 100) : 0;
                    if (ringProgress) ringProgress.style.setProperty('--p', percentage);
                    ringChartText.textContent = `${lastCompleted}/${totalSteps}`;
                    sequenceEnrollmentText.textContent = sequence ? sequence.name : 'Unknown';
                    sequenceEnrollmentText.classList.remove('sequence-enrollment-empty');
                    if (removeFromSequenceBtn) removeFromSequenceBtn.classList.remove('hidden');
                    if (completeSequenceBtn) completeSequenceBtn.classList.remove('hidden');
                } else {
                    if (ringChart) ringChart.classList.add('ring-chart-inactive');
                    if (ringProgress) ringProgress.style.setProperty('--p', 0);
                    ringChartText.textContent = '—';
                    sequenceEnrollmentText.textContent = 'Not in a sequence';
                    sequenceEnrollmentText.classList.add('sequence-enrollment-empty');
                    if (removeFromSequenceBtn) removeFromSequenceBtn.classList.add('hidden');
                    if (completeSequenceBtn) completeSequenceBtn.classList.add('hidden');
                }
            }
            populateAssignSequenceDropdown();
        } else {
            hideContactDetails(true, true);
        }
    };
    
    const PRODUCT_LABELS = {
        'Dedicated Internet Access': 'DIA',
        'Managed Network Security': 'Managed Security',
        'Network Monitoring Portal': 'Network Monitoring',
        'Standard Internet Access': 'SIA',
        'Unified Communications': 'UC',
        'Wavelength Services': 'Wave Circuits'
    };

    function renderAIProductPickers() {
        const container = document.getElementById("ai-product-pickers");
        if (!container) return;
        const products = state.products || [];
        const industries = ['General', 'Healthcare', 'Financial', 'Retail', 'Manufacturing', 'K-12 Education'];
        const getDisplayLabel = (name) => PRODUCT_LABELS[name] ?? name;
        const displayLabels = products.map(p => getDisplayLabel(p || ''));
        const maxDisplayLen = displayLabels.length > 0
            ? Math.max(...displayLabels.map(l => l.length), 10)
            : 10;
        const productPills = products.length > 0
            ? products.map((p) => {
                const name = p || '';
                const displayLabel = getDisplayLabel(name);
                const attrEscaped = name.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
                const displayEscaped = displayLabel.replace(/</g, '&lt;');
                return `<button type="button" class="ai-product-pill" data-value="${attrEscaped}" style="min-width: ${maxDisplayLen}ch">${displayEscaped}</button>`;
            }).join('')
            : '';
        const industryOptions = industries.map(ind => `<option value="${ind}">${ind}</option>`).join('');
        const pillsContent = products.length > 0 ? productPills : '<span class="text-xs text-[var(--text-muted)] col-span-2">No products in product knowledge.</span>';
        const pillsAndButton = pillsContent + `<button id="ai-generate-email-btn" class="ai-generate-pill-btn btn-primary text-sm py-2 flex items-center justify-center gap-2" title="Generate email"><i class="fas fa-wand-magic-sparkles"></i>Generate</button>`;
        if (tomSelectIndustry) {
            tomSelectIndustry.destroy();
            tomSelectIndustry = null;
        }
        container.innerHTML = `
            <select id="ai-industry-select" class="ai-industry-select w-full py-2 px-3 rounded-lg text-sm bg-[var(--bg-medium)] border border-[var(--border-color)]">
                <option value="" disabled selected>Industry</option>
                ${industryOptions}
            </select>
            <div class="ai-product-pills mt-2">${pillsAndButton}</div>
        `;
        const industrySelect = document.getElementById("ai-industry-select");
        if (industrySelect) {
            tomSelectIndustry = initTomSelect(industrySelect, {
                placeholder: 'Industry',
                searchField: [],
                dropdownParent: 'body',
                render: {
                    dropdown: function() {
                        const d = document.createElement('div');
                        d.className = 'ts-dropdown tom-select-no-search';
                        return d;
                    }
                }
            });
        }
    }

    function renderAIAssistant(contact) {
        const aiWriteForm = document.getElementById("ai-write-form");
        const aiEmailResponse = document.getElementById("ai-email-response");
        const aiInsightView = document.getElementById("ai-insight-view");
        const aiPromptInput = document.getElementById("ai-email-prompt");
        const aiEmailSubject = document.getElementById("ai-email-subject");
        const aiEmailBody = document.getElementById("ai-email-body");
        if (!aiWriteForm) return;

        if (aiClearInsightBtn) aiClearInsightBtn.classList.add("hidden");
        aiWriteForm.classList.remove("hidden");
        aiEmailResponse?.classList.add("hidden");
        aiInsightView?.classList.add("hidden");
        if (aiPromptInput) {
            aiPromptInput.value = "";
            aiPromptInput.placeholder = contact
                ? "e.g., 'Write a follow-up email after our meeting.'"
                : "Select a contact to write an email.";
        }
        if (aiEmailSubject) aiEmailSubject.value = "";
        if (aiEmailBody) aiEmailBody.value = "";

        renderAIProductPickers();
    }

    function showAIInsightView(summary, nextSteps) {
        const aiWriteForm = document.getElementById("ai-write-form");
        const aiEmailResponse = document.getElementById("ai-email-response");
        const aiInsightView = document.getElementById("ai-insight-view");
        const aiInsightSummary = document.getElementById("ai-insight-summary");
        const aiInsightNextSteps = document.getElementById("ai-insight-next-steps");
        if (!aiInsightView) return;
        aiWriteForm?.classList.add("hidden");
        aiEmailResponse?.classList.add("hidden");
        aiInsightView.classList.remove("hidden");
        if (aiInsightSummary) aiInsightSummary.innerHTML = summary;
        if (aiInsightNextSteps) aiInsightNextSteps.textContent = nextSteps;
        if (aiClearInsightBtn) aiClearInsightBtn.classList.remove("hidden");
    }

    function showAIWriteForm() {
        const aiWriteForm = document.getElementById("ai-write-form");
        const aiEmailResponse = document.getElementById("ai-email-response");
        const aiInsightView = document.getElementById("ai-insight-view");
        aiWriteForm?.classList.remove("hidden");
        aiEmailResponse?.classList.add("hidden");
        aiInsightView?.classList.add("hidden");
        if (aiClearInsightBtn) aiClearInsightBtn.classList.add("hidden");
    }

    function showAIEmailResponse() {
        const aiWriteForm = document.getElementById("ai-write-form");
        const aiEmailResponse = document.getElementById("ai-email-response");
        const aiInsightView = document.getElementById("ai-insight-view");
        aiWriteForm?.classList.add("hidden");
        aiEmailResponse?.classList.remove("hidden");
        aiInsightView?.classList.add("hidden");
    }

    function renderContactEmails(contactEmail) {
        if (!contactEmailsList) return;
        contactEmailsList.innerHTML = '';

        if (!contactEmail) {
            contactEmailsList.innerHTML = '<p class="logged-emails-empty text-sm text-[var(--text-medium)] py-6">Contact has no email address.</p>';
            return;
        }

        const loggedEmails = state.email_log
            .filter(email => (email.recipient || '').toLowerCase() === (contactEmail || '').toLowerCase())
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (loggedEmails.length === 0) {
            contactEmailsList.innerHTML = '<p class="logged-emails-empty text-sm text-[var(--text-medium)] py-6">No logged emails for this contact.</p>';
            return;
        }

        loggedEmails.forEach(email => {
            const hasAttachment = email.attachments && email.attachments.length > 0;
            const attachmentIndicator = hasAttachment ? ` <i class="fas fa-paperclip text-xs" title="${email.attachments.length} attachment(s)"></i>` : '';
            const item = document.createElement('div');
            item.className = 'email-item';
            item.innerHTML = `
                <div class="email-item-inner">
                    <div class="email-item-content">
                        <div class="email-date">${formatDate(email.created_at)}</div>
                        <div class="email-subject">${(email.subject || '(No Subject)') + attachmentIndicator}</div>
                    </div>
                    <button class="btn-view-email btn-icon-logged-email" data-email-id="${email.id}" title="View email"><i class="fas fa-envelope"></i></button>
                </div>
            `;
            contactEmailsList.appendChild(item);
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
            showModal('Error', 'Failed to download attachment. Path is missing.', null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        try {
            const { data, error } = await supabase.storage.from('email-attachments').download(downloadPath);

            if (error) {
                console.error('Error downloading attachment:', error);
                showModal('Error', `Failed to download attachment: ${error.message}. Please try again.`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
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
            showModal('Error', 'An unexpected error occurred.', null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        }
    }

    function closeEmailViewModal() {
        emailViewModalBackdrop.classList.add('hidden');
    }

    const hideContactDetails = (hideForm = true, clearSelection = false) => {
        if (tomSelectAccount) {
            tomSelectAccount.destroy();
            tomSelectAccount = null;
        }
        const accountRow = document.getElementById("contact-account-row");
        if (accountRow) accountRow.classList.add("hidden");
        if (contactForm && hideForm) contactForm.classList.add('hidden');
        if (contactForm) {
            contactForm.reset();
            contactForm.querySelector("#contact-id").value = "";
            contactForm.querySelector("#contact-last-saved").textContent = "Not yet saved.";
            const contactAccountInput = document.getElementById("contact-account-name");
            if (contactAccountInput) contactAccountInput.value = "";
        }
        if(contactActivitiesList) contactActivitiesList.innerHTML = '<p class="recent-activities-empty text-sm text-[var(--text-medium)] px-4 py-6">Select a contact to see activities.</p>';
        if(sequenceEnrollmentText) {
            sequenceEnrollmentText.textContent = "Select a contact to see details.";
            sequenceEnrollmentText.classList.add('sequence-enrollment-empty');
        }
        const ringChart = document.getElementById('ring-chart');
        const ringProgress = document.getElementById('ring-chart-progress');
        if (ringChart) ringChart.classList.add('ring-chart-inactive');
        if (ringProgress) ringProgress.style.setProperty('--p', 0);
        const ringChartTextEl = document.getElementById('ring-chart-text');
        if (ringChartTextEl) ringChartTextEl.textContent = '—';
        if(removeFromSequenceBtn) removeFromSequenceBtn.classList.add('hidden');
        if(completeSequenceBtn) completeSequenceBtn.classList.add('hidden');
        if (contactEmailsList) contactEmailsList.innerHTML = '<p class="logged-emails-empty text-sm text-[var(--text-medium)] py-6">Select a contact to see logged emails.</p>';
        if(contactPendingTaskReminder) contactPendingTaskReminder.classList.add('hidden');
        populateAssignSequenceDropdown();
        renderAIAssistant(null);

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
                        user_id: getState().effectiveUserId
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

    // --- AI EMAIL GENERATION (inline in AI container) ---
    async function generateEmailWithAI(contact) {
        if (!contact?.email) {
            showAIToast("Contact has no email address.", "error");
            return;
        }
        const userPrompt = document.getElementById('ai-email-prompt')?.value;
        const aiEmailSubject = document.getElementById('ai-email-subject');
        const aiEmailBody = document.getElementById('ai-email-body');
        const generateButton = document.getElementById('ai-generate-email-btn');

        if (!userPrompt) {
            showAIToast("Please enter a prompt.", "error");
            return;
        }

        const originalButtonText = generateButton?.innerHTML;
        if (generateButton) {
            generateButton.disabled = true;
            generateButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating...`;
        }

        const contactName = `${contact.first_name} ${contact.last_name}`;
        const accountName = state.accounts.find(acc => acc.id === contact.account_id)?.name || '';
        const selectedProducts = Array.from(document.querySelectorAll('.ai-product-pill.active')).map(pill => pill.dataset.value);
        const selectedIndustry = document.getElementById('ai-industry-select')?.value || 'General';

        try {
            const { data, error } = await supabase.functions.invoke('generate-prospect-email', {
                body: {
                    userPrompt: userPrompt,
                    contactName: contactName,
                    accountName: accountName,
                    product_names: selectedProducts,
                    industry: selectedIndustry
                }
            });

            if (error) throw error;
            
            const generatedSubject = data.subject || "No Subject";
            const generatedBody = data.body || "Failed to generate email content.";
            
            if (aiEmailSubject) aiEmailSubject.value = generatedSubject;
            if (aiEmailBody) aiEmailBody.value = generatedBody;
            
            showAIEmailResponse();
            showAIToast("Email generated successfully!", "success");

        } catch (e) {
            console.error("Error generating email:", e);
            if (aiEmailSubject) aiEmailSubject.value = "Error";
            if (aiEmailBody) aiEmailBody.value = "An error occurred while generating the email. Please try again.";
            showAIEmailResponse();
            showAIToast("Failed to generate email.", "error");
        } finally {
            if (generateButton) {
                generateButton.disabled = false;
                generateButton.innerHTML = originalButtonText || '<i class="fas fa-wand-magic-sparkles"></i>Generate';
            }
        }
    }

async function openEmailClient(contact) {
    if (!contact?.email) {
        showAIToast("Contact has no email address.", "error");
        return;
    }
    const emailSubject = document.getElementById('ai-email-subject')?.value || '';
    const emailBody = document.getElementById('ai-email-body')?.value || '';

    // CORRECTED: Let encodeURIComponent handle the newlines automatically.
    const encodedBody = encodeURIComponent(emailBody); 
    
    const mailtoLink = `mailto:${contact.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodedBody}`;
    window.open(mailtoLink, '_blank');

    try {
        const { error } = await supabase.from('activities').insert({
            contact_id: state.selectedContactId,
            account_id: contact?.account_id,
            type: 'AI-Generated Email',
            description: `AI-generated email draft opened in mail client. Subject: "${emailSubject}".`,
            user_id: getState().effectiveUserId,
            date: new Date().toISOString()
        });

        if (error) {
            console.error("Error logging AI email activity:", error);
            showToast("Email activity logged with errors.", "warning");
        } else {
            showToast("Email activity successfully logged!", "success");
        }

        await loadAllData();
    } catch (e) {
        console.error("Error logging activity:", e);
    }
}
async function handleAssignSequenceToContact(contactId, sequenceId, userId) {
    // 1. Fetch all steps for the chosen sequence, sorted by step number
    const { data: steps, error: stepsError } = await supabase
        .from('sequence_steps')
        .select('*')
        .eq('sequence_id', sequenceId)
        .order('step_number');

    if (stepsError || !steps || steps.length === 0) {
        showToast("Could not find steps for this sequence.", "error");
        return false;
    }

    // 2. Create the main tracking record in `contact_sequences`
    const firstStep = steps[0];
    const firstDueDate = new Date();
    firstDueDate.setDate(firstDueDate.getDate() + (firstStep.delay_days || 0));

    const { data: contactSequence, error: csError } = await supabase
        .from('contact_sequences')
        .insert({
            contact_id: contactId,
            sequence_id: sequenceId,
            user_id: userId,
            status: 'Active',
            current_step_number: firstStep.step_number,
            next_step_due_date: firstDueDate.toISOString()
        })
        .select()
        .single();

    if (csError) {
        showToast('Failed to enroll contact in sequence: ' + csError.message, "error");
        return false;
    }

    // 3. Prepare a to-do item for each step to be inserted into our new table
    let runningDueDate = new Date(); // This will be the base for calculating delays
    const contactStepRecords = steps.map((step, index) => {
        // The due date is relative to the *previous* step's completion. For initial creation, we chain them from today.
        if (index > 0) {
             runningDueDate.setDate(runningDueDate.getDate() + (step.delay_days || 0));
        } else {
             // The first step's due date is calculated from today
             runningDueDate.setDate(new Date().getDate() + (step.delay_days || 0));
        }
        
        return {
            contact_id: contactId,
            sequence_id: sequenceId,
            sequence_step_id: step.id,
            contact_sequence_id: contactSequence.id,
            user_id: userId,
            status: 'pending',
            due_date: new Date(runningDueDate).toISOString(),
            assigned_to: step.assigned_to
        };
    });

    // 4. Bulk insert all the step tracking records
    const { error: cssError } = await supabase
        .from('contact_sequence_steps')
        .insert(contactStepRecords);
        
    if (cssError) {
        showToast('Failed to create individual step tasks: ' + cssError.message, "error");
        await supabase.from('contact_sequences').delete().eq('id', contactSequence.id); // Roll back
        return false;
    }
    
    return true; // Indicate success
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

        // Step 5: Add event listeners for the toggle
        if (sortFirstLastBtn) {
            sortFirstLastBtn.addEventListener('click', () => {
                if (state.nameDisplayFormat !== 'firstLast') {
                    state.nameDisplayFormat = 'firstLast';
                    localStorage.setItem('contactNameDisplayFormat', 'firstLast');
                    updateSortToggleUI();
                    renderContactList();
                }
            });
        }

        if (sortLastFirstBtn) {
            sortLastFirstBtn.addEventListener('click', () => {
                if (state.nameDisplayFormat !== 'lastFirst') {
                    state.nameDisplayFormat = 'lastFirst';
                    localStorage.setItem('contactNameDisplayFormat', 'lastFirst');
                    updateSortToggleUI();
                    renderContactList();
                }
            });
        }
        
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
                        user_id: getState().effectiveUserId 
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
                user_id: getState().effectiveUserId
            };
            if (!data.first_name || !data.last_name) {
                showModal("Error", "First and Last name are required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                return;
            }

            if (id) {
                const { error } = await supabase.from("contacts").update(data).eq("id", id);
                if (error) {
                    showModal("Error", "Error saving contact: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                } else {
                    state.isFormDirty = false;
                    await loadAllData();
                    showModal("Success", "Contact saved successfully!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                }
            } else {
                const { data: newContactArr, error: insertError } = await supabase.from("contacts").insert([data]).select();
                if (insertError) {
                    showModal("Error", "Error creating contact: " + insertError.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                } else {
                    state.selectedContactId = newContactArr?.[0]?.id;
                    state.isFormDirty = false;
                    await loadAllData();
                    showModal("Success", "Contact created successfully!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                }
            }
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
                        user_id: getState().effectiveUserId
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
                    const suggested_account_id = findBestAccountMatch(record.company);
                    
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
                        
                        recordsToUpdate.push({ ...record, id: existingContact.id, changes, suggested_account_id: suggested_account_id });
                    } else {
                        recordsToInsert.push({ ...record, suggested_account_id: suggested_account_id });
                    }
                }
                
                // This is the core change: build a reusable option string that checks for selected value
                const getAccountOptions = (suggestedId) => {
                    let options = `<option value="">-- No Account --</option>`;
                    options += state.accounts.map(acc => `<option value="${acc.id}" ${acc.id === suggestedId ? 'selected' : ''}>${acc.name}</option>`).join('');
                    return options;
                };

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
                                        <td>
                                            <select class="account-select">${getAccountOptions(r.suggested_account_id)}</select>
                                        </td>
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
                                        <td>
                                            <select class="account-select">${getAccountOptions(r.suggested_account_id)}</select>
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
                    user_id: getState().effectiveUserId,
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

    assignSequenceSelect?.addEventListener("change", async () => {
        const sequenceId = assignSequenceSelect.value;
        if (!sequenceId || !state.selectedContactId) return;

        const selectedSequence = state.sequences.find(s => s.id === Number(sequenceId));
        if (!selectedSequence) {
            showToast("Selected sequence not found.", "error");
            assignSequenceSelect.value = '';
            return;
        }

        let success = false;
        if (selectedSequence.is_abm) {
            success = await handleAssignSequenceToContact(state.selectedContactId, Number(sequenceId), getState().effectiveUserId);
        } else {
            const firstStep = state.sequence_steps.find(s => s.sequence_id === selectedSequence.id && s.step_number === 1);
            if (!firstStep) {
                showToast("Selected sequence has no steps.", "error");
                assignSequenceSelect.value = '';
                return;
            }
            const { error } = await supabase.from('contact_sequences').insert({
                contact_id: state.selectedContactId,
                sequence_id: Number(sequenceId),
                current_step_number: 1,
                status: 'Active',
                next_step_due_date: addDays(new Date(), firstStep.delay_days).toISOString(),
                user_id: getState().effectiveUserId
            });
            if (error) {
                showToast("Error assigning sequence: " + error.message, "error");
                assignSequenceSelect.value = '';
            } else {
                success = true;
            }
        }

        if (success) {
            await loadAllData();
            showToast("Sequence assigned successfully!", "success");
        }
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
                // **NEW: Clean up the individual to-do items from the ABM table**
                await supabase.from('contact_sequence_steps').delete().eq('contact_sequence_id', activeContactSequence.id);

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
            // **NEW: Clean up the individual to-do items from the ABM table**
            await supabase.from('contact_sequence_steps').delete().eq('contact_sequence_id', activeContactSequence.id);
            
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
                        showModal("Error", 'Task description is required.', null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                        return false;
                    }
                    const newTask = {
                        user_id: getState().effectiveUserId,
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
                    showAIToast("Please select a contact to get AI insights.", "error");
                    return;
                }

                const contact = state.contacts.find(c => c.id === state.selectedContactId);
                if (!contact) {
                    showAIToast("Selected contact not found.", "error");
                    return;
                }

                const relevantActivities = state.activities
                    .filter(act => act.contact_id === contact.id)
                    .sort((a, b) => new Date(a.date) - new Date(b.date));

                if (relevantActivities.length === 0) {
                    showAIToast("No activities found for this contact to generate insights.", "info");
                    return;
                }

                const activityData = relevantActivities.map(act => 
                    `[${formatDate(act.date)}] Type: ${act.type}, Description: ${act.description}`
                ).join('\n');

                showAIInsightView('<i class="fas fa-spinner fa-spin"></i> Analyzing...', '');

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
                    showAIInsightView(insight, nextSteps);

                } catch (error) {
                    console.error("Error invoking AI insight Edge Function:", error);
                    showAIInsightView("", `Failed to generate insight: ${error.message}. Please try again.`);
                }
            });
        }

        if (aiClearInsightBtn) {
            aiClearInsightBtn.addEventListener("click", () => {
                const contact = state.contacts.find(c => c.id === state.selectedContactId);
                showAIWriteForm();
                renderAIAssistant(contact);
            });
        }

        if (aiAssistantContent) {
            aiAssistantContent.addEventListener("click", (e) => {
                const pill = e.target.closest(".ai-product-pill");
                const generateBtn = e.target.closest("#ai-generate-email-btn");
                const regenerateBtn = e.target.closest("#ai-regenerate-email-btn");
                const openClientBtn = e.target.closest("#open-email-client-btn");
                const newEmailBtn = e.target.closest("#ai-new-email-btn");
                if (pill) {
                    e.preventDefault();
                    pill.classList.toggle("active");
                } else if ((generateBtn || regenerateBtn) && state.selectedContactId) {
                    e.preventDefault();
                    const contact = state.contacts.find(c => c.id === state.selectedContactId);
                    if (contact) generateEmailWithAI(contact);
                } else if (openClientBtn && state.selectedContactId) {
                    e.preventDefault();
                    const contact = state.contacts.find(c => c.id === state.selectedContactId);
                    if (contact) openEmailClient(contact);
                } else if (newEmailBtn) {
                    e.preventDefault();
                    const contact = state.contacts.find(c => c.id === state.selectedContactId);
                    showAIWriteForm();
                    renderAIAssistant(contact);
                }
            });
        }
    }

    // --- App Initialization ---
    async function initializePage() {
        await loadSVGs();
        const appState = await initializeAppState(supabase);
        if (!appState.currentUser) return;
        state.currentUser = appState.currentUser;
        state.nameDisplayFormat = localStorage.getItem('contactNameDisplayFormat') || 'lastFirst';
        updateSortToggleUI();
        setupPageEventListeners();
        await setupUserMenuAndAuth(supabase, getState());
        const urlParams = new URLSearchParams(window.location.search);
        const contactIdFromUrl = urlParams.get('contactId');
        if (contactIdFromUrl) state.selectedContactId = Number(contactIdFromUrl);
        await setupGlobalSearch(supabase, state.currentUser);
        await checkAndSetNotifications(supabase);
        await loadAllData();
        window.addEventListener('effectiveUserChanged', loadAllData);
    }

    initializePage();
});
