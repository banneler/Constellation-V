import { SUPABASE_URL, SUPABASE_ANON_KEY, formatDate, formatMonthYear, parseCsvRow, themes, setupModalListeners, showModal, hideModal, updateActiveNavLink, setupUserMenuAndAuth, loadSVGs, setupGlobalSearch, checkAndSetNotifications } from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let state = {
    currentUser: null,
    isFormDirty: false,

    // Master lists for the main account list view
    accounts: [],
    contacts: [],
    activities: [],
    deals: [],
    dealStages: [],

    // A dedicated object to hold data for ONLY the selected account
    selectedAccountId: null,
    selectedAccountDetails: {
        account: null,
        contacts: [],
        activities: [],
        deals: [],
        tasks: [],
        contact_sequences: []
    }
};

    // --- DOM Element Selectors ---
    const navSidebar = document.querySelector(".nav-sidebar");
    const accountList = document.getElementById("account-list");
    const accountSearch = document.getElementById("account-search");
    const addAccountBtn = document.getElementById("add-account-btn");
    const bulkImportAccountsBtn = document.getElementById("bulk-import-accounts-btn");
    const bulkExportAccountsBtn = document.getElementById("bulk-export-accounts-btn");
    const accountCsvInput = document.getElementById("account-csv-input");
    const accountForm = document.getElementById("account-form");
    const deleteAccountBtn = document.getElementById("delete-account-btn");
    const addDealBtn = document.getElementById("add-deal-btn");
    const addTaskAccountBtn = document.getElementById("add-task-account-btn");
    const accountContactsList = document.getElementById("account-contacts-list");
    const accountActivitiesList = document.getElementById("account-activities-list");
    const accountDealsTableBody = document.querySelector("#account-deals-table tbody");
    const accountPendingTaskReminder = document.getElementById("account-pending-task-reminder");
    const aiBriefingBtn = document.getElementById("ai-briefing-btn");
    const accountStatusFilter = document.getElementById("account-status-filter");

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

    const confirmAndSwitchAccount = async (newAccountId) => { // Make the function async
    const switchAccount = async () => {
        state.selectedAccountId = newAccountId;
        renderAccountList(); // Re-render list to highlight the new selection
        await loadDetailsForSelectedAccount(); // Await the on-demand fetch
    };

    if (state.isFormDirty) {
        showModal("Unsaved Changes", "You have unsaved changes. Are you sure you want to switch accounts?", async () => {
            state.isFormDirty = false;
            hideModal();
            await switchAccount();
        }, true, `<button id="modal-confirm-btn" class="btn-primary">Discard & Switch</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
    } else {
        await switchAccount();
    }
};

    // --- Data Fetching ---

// 1. Fetches only the data needed to build the account list on the left.
async function loadInitialData() {
    if (!state.currentUser) return;
    
    // Select only the columns needed for the list view icons (🔥, 💰) to keep the query fast.
    const [accountsRes, dealsRes, activitiesRes, contactsRes, dealStagesRes] = await Promise.all([
        supabase.from("accounts").select("*").eq("user_id", state.currentUser.id),
        supabase.from("deals").select("id, account_id, stage").eq("user_id", state.currentUser.id),
        supabase.from("activities").select("id, account_id, contact_id, date").eq("user_id", state.currentUser.id),
        supabase.from("contacts").select("id, account_id").eq("user_id", state.currentUser.id),
        supabase.from("deal_stages").select("*").order('sort_order')
    ]);

    // Check for errors from each query
    if (accountsRes.error) throw accountsRes.error;
    if (dealsRes.error) throw dealsRes.error;
    if (activitiesRes.error) throw activitiesRes.error;
    if (contactsRes.error) throw contactsRes.error;
    if (dealStagesRes.error) throw dealStagesRes.error;
    
    // Assign data to state
    state.accounts = accountsRes.data || [];
    state.deals = dealsRes.data || [];
    state.activities = activitiesRes.data || [];
    state.contacts = contactsRes.data || [];
    state.dealStages = dealStagesRes.data || [];

    renderAccountList(); // Render the list as soon as it's ready
}

// 2. Fetches detailed data for ONE account after it has been selected.
// Fetches detailed data and puts it into the new state.selectedAccountDetails object
async function loadDetailsForSelectedAccount() {
    if (!state.selectedAccountId) return;

    // Show a loading state in the UI immediately
    accountContactsList.innerHTML = '<li>Loading...</li>';
    accountActivitiesList.innerHTML = '<li>Loading...</li>';
    accountDealsTableBody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
    
    const account = state.accounts.find(a => a.id === state.selectedAccountId);
    state.selectedAccountDetails.account = account;

    // Fetch all related data for only the selected account
    const [contactsRes, dealsRes, activitiesRes, tasksRes, sequencesRes] = await Promise.all([
        supabase.from("contacts").select("*").eq("account_id", state.selectedAccountId),
        supabase.from("deals").select("*").eq("account_id", state.selectedAccountId),
        supabase.from("activities").select("*").eq("account_id", state.selectedAccountId),
        supabase.from("tasks").select("*").eq("account_id", state.selectedAccountId),
        supabase.from("contact_sequences").select("*") // This may need a more specific filter later
    ]);

    if (contactsRes.error) throw contactsRes.error;
    if (dealsRes.error) throw dealsRes.error;
    if (activitiesRes.error) throw activitiesRes.error;
    if (tasksRes.error) throw tasksRes.error;
    if (sequencesRes.error) throw sequencesRes.error;

    // Populate the dedicated details object, leaving the master lists untouched
    state.selectedAccountDetails.contacts = contactsRes.data || [];
    state.selectedAccountDetails.deals = dealsRes.data || [];
    state.selectedAccountDetails.activities = activitiesRes.data || [];
    state.selectedAccountDetails.tasks = tasksRes.data || [];
    state.selectedAccountDetails.contact_sequences = sequencesRes.data || [];

    renderAccountDetails();
}
        // Add this new function
async function refreshData() {
    await loadInitialData();
    // Re-load details only if an account is currently selected
    if (state.selectedAccountId) {
        await loadDetailsForSelectedAccount();
    }
}

    
// This function now handles creating the "empty shell" view
const hideAccountDetails = (clearSelection = false) => {
    if (accountForm) {
        accountForm.classList.remove('hidden'); // Ensure form is visible
        accountForm.reset(); // Clear all fields
        accountForm.querySelector("#account-id").value = '';
        document.getElementById("account-last-saved").textContent = "";
    }
    
    // Clear out all related data lists
    if (accountContactsList) accountContactsList.innerHTML = "";
    if (accountActivitiesList) accountActivitiesList.innerHTML = "";
    if (accountDealsTableBody) accountDealsTableBody.innerHTML = "";
    if (accountPendingTaskReminder) accountPendingTaskReminder.classList.add('hidden');
    
    // Reset the state for the selected account
    if (clearSelection) {
        state.selectedAccountId = null;
        state.selectedAccountDetails = { account: null, contacts: [], activities: [], deals: [], tasks: [], contact_sequences: [] };
        document.querySelectorAll(".list-item.selected").forEach(item => item.classList.remove("selected"));
        state.isFormDirty = false;
    }
};
    // --- Render Functions ---
    const renderAccountList = () => {
        if (!accountList || !accountSearch || !accountStatusFilter) {
            console.error("Render failed: A required DOM element is missing.");
            return;
        }

        const searchTerm = accountSearch.value.toLowerCase();
        const statusFilter = accountStatusFilter.value;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let hotAccountIds = new Set();
        let accountsWithOpenDealsIds = new Set();

        try {
            hotAccountIds = new Set(
                state.activities
                .filter(act => act.date && new Date(act.date) > thirtyDaysAgo)
                .map(act => {
                    if (act.account_id) return act.account_id;
                    const contact = state.contacts.find(c => c.id === act.contact_id);
                    return contact ? contact.account_id : null;
                })
                .filter(id => id)
            );
        } catch (error) {
            console.error("Error calculating hot accounts:", error);
        }

        try {
            accountsWithOpenDealsIds = new Set(
                state.deals
                .filter(deal => deal.stage && deal.stage !== 'Closed Won' && deal.stage !== 'Closed Lost')
                .map(deal => deal.account_id)
                .filter(id => id)
            );
        } catch (error) {
            console.error("Error calculating accounts with open deals:", error);
        }

        const filteredAccounts = state.accounts.filter(account => {
            const matchesSearch = (account.name || "").toLowerCase().includes(searchTerm);
            if (!matchesSearch) return false;

            switch (statusFilter) {
                case 'hot':
                    return hotAccountIds.has(account.id);
                case 'with_deals':
                    return accountsWithOpenDealsIds.has(account.id);
                case 'customer':
                    return account.is_customer === true;
                case 'prospect':
                    return account.is_customer !== true;
                case 'all':
                default:
                    return true;
            }
        });

        accountList.innerHTML = "";
        filteredAccounts
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .forEach((account) => {
                const i = document.createElement("div");
                i.className = "list-item";
                i.dataset.id = account.id;

                const hasOpenDeal = accountsWithOpenDealsIds.has(account.id);
                const isHot = hotAccountIds.has(account.id);

                const dealIcon = hasOpenDeal ? '<span class="deal-open-icon">$</span>' : '';
                const hotIcon = isHot ? '<span class="hot-contact-icon">🔥</span>' : '';

                i.innerHTML = `<div class="account-list-name">${account.name}</div> <div class="list-item-icons">${hotIcon}${dealIcon}</div>`;

                if (account.id === state.selectedAccountId) {
                    i.classList.add("selected");
                }
                accountList.appendChild(i);
            });
    };

    const renderAccountDetails = () => {
    // Read from the new, dedicated details object
    const { account, contacts, activities, deals, tasks, contact_sequences } = state.selectedAccountDetails;

    if (!account) {
        hideAccountDetails(true);
        return;
    }

    if (accountPendingTaskReminder) {
        const pendingAccountTasks = tasks.filter(task => task.status === 'Pending');
        if (pendingAccountTasks.length > 0) {
            const taskCount = pendingAccountTasks.length;
            accountPendingTaskReminder.textContent = `You have ${taskCount} pending task${taskCount > 1 ? 's' : ''} for this account.`;
            accountPendingTaskReminder.classList.remove('hidden');
        } else {
            accountPendingTaskReminder.classList.add('hidden');
        }
    }

    // Populate form fields from the account object
    accountForm.classList.remove('hidden');
    accountForm.querySelector("#account-id").value = account.id;
    accountForm.querySelector("#account-name").value = account.name || "";
    // ... (rest of the form fields populate as before)
    const websiteInput = accountForm.querySelector("#account-website");
    const websiteLink = document.getElementById("account-website-link");
    websiteInput.value = account.website || "";
    // This internal function doesn't need to change
    const updateWebsiteLink = (url) => {
        if (!url || !url.trim()) { if (websiteLink) websiteLink.classList.add('hidden'); return; }
        let fullUrl = url.trim();
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) { fullUrl = 'https://' + fullUrl; }
        if (websiteLink) { websiteLink.href = fullUrl; websiteLink.classList.remove('hidden'); }
    };
    updateWebsiteLink(account.website);
    accountForm.querySelector("#account-industry").value = account.industry || "";
    accountForm.querySelector("#account-phone").value = account.phone || "";
    accountForm.querySelector("#account-address").value = account.address || "";
    accountForm.querySelector("#account-notes").value = account.notes || "";
    document.getElementById("account-last-saved").textContent = account.last_saved ? `Last Saved: ${formatDate(account.last_saved)}` : "";
    accountForm.querySelector("#account-sites").value = account.quantity_of_sites || "";
    accountForm.querySelector("#account-employees").value = account.employee_count || "";
    accountForm.querySelector("#account-is-customer").checked = account.is_customer;

    // Render related lists using data from the details object
    accountDealsTableBody.innerHTML = "";
    deals.forEach((deal) => {
        const row = accountDealsTableBody.insertRow();
        row.innerHTML = `<td><input type="checkbox" class="commit-deal-checkbox" data-deal-id="${deal.id}" ${deal.is_committed ? "checked" : ""}></td><td>${deal.name}</td><td>${deal.term || ""}</td><td>${deal.stage}</td><td>$${deal.mrc || 0}</td><td>${deal.close_month ? formatMonthYear(deal.close_month) : ""}</td><td>${deal.products || ""}</td><td><button class="btn-secondary edit-deal-btn" data-deal-id="${deal.id}">Edit</button></td>`;
    });

    accountContactsList.innerHTML = "";
    contacts.forEach((c) => {
        const li = document.createElement("li");
        const inSeq = contact_sequences.some((cs) => cs.contact_id === c.id && cs.status === "Active");
        li.innerHTML = `<a href="contacts.html?contactId=${c.id}" class="contact-name-link" data-contact-id="${c.id}">${c.first_name} ${c.last_name}</a> (${c.title || "No Title"}) ${inSeq ? '<span class="sequence-status-icon"></span>' : ""}`;
        accountContactsList.appendChild(li);
    });

    accountActivitiesList.innerHTML = "";
    activities.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach((act) => {
        const c = contacts.find((c) => c.id === act.contact_id);
        const li = document.createElement("li");
        li.textContent = `[${formatDate(act.date)}] ${act.type} with ${c ? `${c.first_name} ${c.last_name}` : "Unknown"}: ${act.description}`;
        let borderColor = "var(--primary-blue)";
        const activityTypeLower = act.type.toLowerCase();
        if (activityTypeLower.includes("email")) borderColor = "var(--warning-yellow)";
        else if (activityTypeLower.includes("call")) borderColor = "var(--completed-color)";
        else if (activityTypeLower.includes("meeting")) borderColor = "var(--meeting-purple)";
        li.style.borderLeftColor = borderColor;
        accountActivitiesList.appendChild(li);
    });

    state.isFormDirty = false;
};


    // --- Deal Handlers ---
    async function handleCommitDeal(dealId, isCommitted) {
        const { error } = await supabase.from('deals').update({ is_committed: isCommitted }).eq('id', dealId);
        if (error) {
            showModal("Error", 'Error updating commit status: ' + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        } else {
            const deal = state.deals.find(d => d.id === dealId);
            if (deal) deal.is_committed = isCommitted;
        }
    }

    function handleEditDeal(dealId) {
        const deal = state.selectedAccountDetails.deals.find(d => d.id === dealId);
        if (!deal) return showModal("Error", "Deal not found!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);

        const stageOptions = state.dealStages.sort((a, b) => a.sort_order - b.sort_order).map(s => `<option value="${s.stage_name}" ${deal.stage === s.stage_name ? 'selected' : ''}>${s.stage_name}</option>`).join('');

        showModal("Edit Deal", `
            <label>Deal Name:</label><input type="text" id="modal-deal-name" value="${deal.name || ''}" required>
            <label>Term:</label><input type="text" id="modal-deal-term" value="${deal.term || ''}" placeholder="e.g., 12 months">
            <label>Stage:</label><select id="modal-deal-stage" required>${stageOptions}</select>
            <label>Monthly Recurring Revenue (MRC):</label><input type="number" id="modal-deal-mrc" min="0" value="${deal.mrc || 0}">
            <label>Close Month:</label><input type="month" id="modal-deal-close-month" value="${deal.close_month || ''}">
            <label>Products:</label><textarea id="modal-deal-products" placeholder="List products, comma-separated">${deal.products || ''}</textarea>
        `, async () => {
            const updatedDealData = {
                name: document.getElementById('modal-deal-name').value.trim(),
                term: document.getElementById('modal-deal-term').value.trim(),
                stage: document.getElementById('modal-deal-stage').value,
                mrc: parseFloat(document.getElementById('modal-deal-mrc').value) || 0,
                close_month: document.getElementById('modal-deal-close-month').value || null,
                products: document.getElementById('modal-deal-products').value.trim(),
            };
            if (!updatedDealData.name) {
                showModal("Error", "Deal name is required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                return false;
            }
            const { error } = await supabase.from('deals').update(updatedDealData).eq('id', dealId);
            if (error) { showModal("Error", 'Error updating deal: ' + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); }
            else { await refreshData(); hideModal(); showModal("Success", "Deal updated successfully!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); }
        }, true, `<button id="modal-confirm-btn" class="btn-primary">Save Deal</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
    }
function handlePrintBriefing() {
    const accountName = state.selectedAccountDetails.account?.name;
    const briefingHtml = document.querySelector('.ai-briefing-container')?.innerHTML;
    if (!accountName || !briefingHtml) {
        alert("Could not find briefing content to print.");
        return;
    }

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(`
        <html>
            <head>
                <title>AI Briefing: ${accountName}</title> <!-- This sets the PDF file name -->
                <link rel="stylesheet" href="css/style.css">
                <style>
                    @media print {
                        body { 
                            margin: 20px; 
                            font-family: sans-serif;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .ai-briefing-container { box-shadow: none; border: none; }
                        h4 { color: #3b82f6 !important; border-bottom: 1px solid #ccc !important; }
                        .briefing-section { background-color: #f9f9f9 !important; page-break-inside: avoid; }
                        div.briefing-pre { 
                            background-color: #eee !important; 
                            border: 1px solid #ddd;
                            white-space: pre-wrap;
                            word-wrap: break-word;
                        }
                    }
                </style>
            </head>
            <body>
                <h2>AI Reconnaissance Report</h2>
                <h3>${accountName}</h3>
                <div class="ai-briefing-container">${briefingHtml}</div>
            </body>
        </html>
    `);
    frameDoc.close();

    setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        document.body.removeChild(printFrame);
    }, 250);
}
// --- AI Briefing Handler ---
async function handleGenerateBriefing() {
    if (!state.selectedAccountId) {
        showModal("Error", "Please select an account to generate a briefing.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        return;
    }
    const { account, contacts, activities, deals } = state.selectedAccountDetails;
    if (!account) return;

    showModal("Generating AI Reconnaissance Report", `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">Scanning internal records and external sources...</p>`, null, false, `<button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);

    try {
        const internalData = {
            accountName: account.name,
            contacts: contacts.map(c => ({ name: `${c.first_name || ''} ${c.last_name || ''}`.trim(), title: c.title })),
            deals: deals.map(d => ({ name: d.name, stage: d.stage, mrc: d.mrc, close_month: d.close_month })),
            activities: activities.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map(act => {
                const contact = contacts.find(c => c.id === act.contact_id);
                const contactName = contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 'Account-Level';
                return `[${formatDate(act.date)}] ${act.type} with ${contactName}: ${act.description}`;
            }).join('\n')
        };

        const { data: briefing, error } = await supabase.functions.invoke('get-account-briefing', { body: { internalData } });
        if (error) throw error;

        // MODIFIED: Added a safety check to ensure we're always working with strings
        const keyPlayersHtml = String(briefing.key_players || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        const icebreakersHtml = String(briefing.icebreakers || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        const briefingHtml = `
            <div class="ai-briefing-container">
                <h4><i class="fas fa-database"></i> Internal Intelligence (What We Know)</h4>
                <div class="briefing-section">
                    <p><strong>Relationship Summary:</strong> ${briefing.summary}</p>
                    <p><strong>Key Players in CRM:</strong> ${keyPlayersHtml}</p>
                    <p><strong>Open Pipeline:</strong> ${briefing.pipeline}</p>
                    <p><strong>Recent Activity:</strong></p>
                    <div class="briefing-pre">${briefing.activity_highlights}</div>
                </div>
                <h4><i class="fas fa-globe"></i> External Intelligence (What's Happening Now)</h4>
                <div class="briefing-section">
                    <p><strong>Latest News & Signals:</strong> ${briefing.news}</p>
                    <p><strong>Potential New Contacts:</strong> ${briefing.new_contacts}</p>
                    <p><strong>Social Icebreakers:</strong></p>
                    <div class="briefing-pre">${icebreakersHtml}</div>
                </div>
                <h4><i class="fas fa-lightbulb"></i> AI Recommendation</h4>
                <div class="briefing-section recommendation">
                    <p>${briefing.recommendation}</p>
                </div>
            </div>`;
        
        const modalFooter = `
            <button id="print-briefing-btn" class="btn-secondary"><i class="fas fa-print"></i> Print / Download</button>
            <button id="modal-ok-btn" class="btn-primary">Close</button>
        `;
        showModal(`AI Briefing: ${account.name}`, briefingHtml, null, false, modalFooter);

    } catch (error) {
        console.error("Error invoking AI Briefing Edge Function:", error);
        showModal("Error", `Failed to generate AI briefing: ${error.message}. Please try again.`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
    }
}


    // --- Event Listener Setup ---
    function setupPageEventListeners() {
        setupModalListeners();

        if (accountForm) {
            accountForm.addEventListener('input', () => {
                state.isFormDirty = true;
            });
        }

        if (navSidebar) {
            navSidebar.addEventListener('click', (e) => {
                const navButton = e.target.closest('a.nav-button');
                if (navButton) {
                    e.preventDefault();
                    handleNavigation(navButton.href);
                }
            });
        }

        window.addEventListener('beforeunload', (event) => {
            if (state.isFormDirty) {
                event.preventDefault();
                event.returnValue = '';
            }
        });

        if (accountSearch) accountSearch.addEventListener("input", renderAccountList);
        if (accountStatusFilter) accountStatusFilter.addEventListener("change", renderAccountList);

        if (addAccountBtn) {
            addAccountBtn.addEventListener("click", () => {
                const openNewAccountModal = () => {
                    hideAccountDetails(false, true);
                    showModal("New Account", `<label>Account Name</label><input type="text" id="modal-account-name" required>`,
                        async () => {
                            const name = document.getElementById("modal-account-name")?.value.trim();
                            if (!name) {
                                showModal("Error", "Account name is required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                                return false;
                            }
                            const { data: newAccountArr, error } = await supabase.from("accounts").insert([{ name, user_id: state.currentUser.id }]).select();
                            if (error) {
                                showModal("Error", "Error creating account: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                                return false;
                            }
                            state.isFormDirty = false;
                            await refreshData();
                            state.selectedAccountId = newAccountArr?.[0]?.id;
                            renderAccountList();
                            renderAccountDetails();
                            hideModal();
                            return true;
                        }, true, `<button id="modal-confirm-btn" class="btn-primary">Create Account</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
                };

                if (state.isFormDirty) {
                    showModal("Unsaved Changes", "You have unsaved changes. Discard and add a new account?", () => {
                        hideModal();
                        openNewAccountModal();
                    }, true, `<button id="modal-confirm-btn" class="btn-primary">Discard & Add New</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
                } else {
                    openNewAccountModal();
                }
            });
        }

        if (accountList) {
            accountList.addEventListener("click", (e) => {
                const item = e.target.closest(".list-item");
                if (item) {
                    const accountId = Number(item.dataset.id);
                    if (accountId !== state.selectedAccountId) {
                        confirmAndSwitchAccount(accountId);
                    }
                }
            });
        }

        if (accountDealsTableBody) {
            accountDealsTableBody.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.edit-deal-btn');
                const commitCheck = e.target.closest('.commit-deal-checkbox');
                if (editBtn) handleEditDeal(Number(editBtn.dataset.dealId));
                if (commitCheck) handleCommitDeal(Number(commitCheck.dataset.dealId), commitCheck.checked);
            });
        }

        if (accountForm) {
            accountForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const id = Number(accountForm.querySelector("#account-id")?.value);
                if (!id) return;
                const data = {
                    name: accountForm.querySelector("#account-name")?.value.trim(),
                    website: accountForm.querySelector("#account-website")?.value.trim(),
                    industry: accountForm.querySelector("#account-industry")?.value.trim(),
                    phone: accountForm.querySelector("#account-phone")?.value.trim(),
                    address: accountForm.querySelector("#account-address")?.value.trim(),
                    notes: accountForm.querySelector("#account-notes")?.value,
                    last_saved: new Date().toISOString(),
                    quantity_of_sites: parseInt(accountForm.querySelector("#account-sites")?.value) || null,
                    employee_count: parseInt(accountForm.querySelector("#account-employees")?.value) || null,
                    is_customer: accountForm.querySelector("#account-is-customer")?.checked
                };
                if (!data.name) {
                    showModal("Error", "Account name is required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                const { error } = await supabase.from("accounts").update(data).eq("id", id);
                if (error) {
                    showModal("Error", "Error saving account: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                state.isFormDirty = false;
                await refreshData();
                showModal("Success", "Account saved successfully!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            });
        }

        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener("click", async () => {
                if (!state.selectedAccountId) return;
                showModal("Confirm Deletion", "Are you sure you want to delete this account? This cannot be undone.",
                    async () => {
                        const { error } = await supabase.from("accounts").delete().eq("id", state.selectedAccountId);
                        if (error) {
                            showModal("Error", "Error deleting account: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                            return;
                        }
                        state.selectedAccountId = null;
                        state.isFormDirty = false;
                        await refreshData();
                        hideModal();
                        showModal("Success", "Account deleted successfully!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    }, true, `<button id="modal-confirm-btn" class="btn-danger">Delete</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
            });
        }

        if (bulkImportAccountsBtn) bulkImportAccountsBtn.addEventListener("click", () => accountCsvInput.click());

        if (bulkExportAccountsBtn) {
            bulkExportAccountsBtn.addEventListener("click", () => {
                const accountsToExport = state.accounts;
                if (accountsToExport.length === 0) {
                    showModal("Info", "No accounts to export.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                const headers = ["name", "website", "industry", "phone", "address", "quantity_of_sites", "employee_count", "is_customer"];
                let csvContent = headers.join(",") + "\n";

                accountsToExport.forEach(account => {
                    const row = headers.map(header => {
                        let value = account[header];
                        if (value === null || value === undefined) return '';
                        value = String(value).replace(/"/g, '""');
                        return `"${value}"`;
                    });
                    csvContent += row.join(",") + "\n";
                });

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", "accounts_export.csv");
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }

        if (accountCsvInput) {
            accountCsvInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (!file) return;

                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: true,
                    complete: async (results) => {
                        const csvRecords = results.data;
                        const requiredHeaders = ["name"];
                        const actualHeaders = results.meta.fields;

                        if (!requiredHeaders.every(h => actualHeaders.includes(h))) {
                            showModal("Import Error", `CSV must contain a 'name' column.`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                            return;
                        }

                        const recordsToUpdate = [];
                        const recordsToInsert = [];
                        const existingAccountMap = new Map(state.accounts.map(acc => [String(acc.name).toLowerCase(), acc]));

                        csvRecords.forEach(record => {
                            if (!record.name) return;

                            const recordName = String(record.name).trim().toLowerCase();
                            const existingAccount = existingAccountMap.get(recordName);

                            const processedRecord = {
                                name: record.name,
                                website: record.website || "",
                                industry: record.industry || "",
                                phone: record.phone || "",
                                address: record.address || "",
                                quantity_of_sites: (record.quantity_of_sites === 0) ? 0 : (parseInt(record.quantity_of_sites) || null),
                                employee_count: (record.employee_count === 0) ? 0 : (parseInt(record.employee_count) || null),
                                is_customer: record.is_customer === true,
                                user_id: state.currentUser.id
                            };

                            if (existingAccount) {
                                let changes = {};
                                for (const key in processedRecord) {
                                    if (key !== 'user_id' && key !== 'name' && processedRecord[key] !== existingAccount[key]) {
                                        changes[key] = { old: existingAccount[key], new: processedRecord[key] };
                                    }
                                }
                                if (Object.keys(changes).length > 0) {
                                    recordsToUpdate.push({ ...processedRecord, id: existingAccount.id, changes });
                                }
                            } else {
                                recordsToInsert.push(processedRecord);
                            }
                        });

                        if (recordsToInsert.length === 0 && recordsToUpdate.length === 0) {
                            showModal("Info", "No new accounts or changes found to import.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                            return;
                        }

                        const modalBodyHtml = `
                            <p>Review the changes below and select the records you wish to import.</p>
                            <div class="table-container-scrollable" style="max-height: 400px;">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th><input type="checkbox" id="select-all-checkbox" checked></th>
                                            <th>Action</th><th>Name</th><th>Changes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${recordsToInsert.map((r, index) => `
                                            <tr class="import-row" data-action="insert" data-index="${index}">
                                                <td><input type="checkbox" class="row-select-checkbox" checked></td>
                                                <td class="status-insert" style="color: var(--success-color);">New</td><td>${r.name}</td><td>New account will be created.</td>
                                            </tr>`).join('')}
                                        ${recordsToUpdate.map((r, index) => `
                                            <tr class="import-row" data-action="update" data-index="${index}">
                                                <td><input type="checkbox" class="row-select-checkbox" checked></td>
                                                <td class="status-update" style="color: var(--warning-yellow);">Update</td><td>${r.name}</td>
                                                <td>${Object.keys(r.changes).map(key => `<p><small><strong>${key}:</strong> <span style="color: #d9534f; text-decoration: line-through;">'${r.changes[key].old}'</span> &rarr; <strong style="color: #5cb85c;">'${r.changes[key].new}'</strong></small></p>`).join('')}</td>
                                            </tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>`;

                        showModal("Confirm CSV Import", modalBodyHtml, async () => {
                            const selectedCheckboxes = document.querySelectorAll('#modal-body .row-select-checkbox:checked');
                            let successCount = 0,
                                errorCount = 0;

                            const updatePromises = [];
                            const insertPromises = [];

                            selectedCheckboxes.forEach(cb => {
                                const row = cb.closest('.import-row');
                                const action = row.dataset.action;
                                const index = parseInt(row.dataset.index);

                                if (action === 'insert') {
                                    const record = recordsToInsert[index];
                                    insertPromises.push(supabase.from("accounts").insert(record));
                                } else if (action === 'update') {
                                    const record = recordsToUpdate[index];
                                    const updateData = Object.keys(record.changes).reduce((acc, key) => ({ ...acc, [key]: record[key] }), {});
                                    updatePromises.push(supabase.from("accounts").update(updateData).eq('id', record.id));
                                }
                            });

                            const results = await Promise.allSettled([...insertPromises, ...updatePromises]);
                            results.forEach(result => {
                                if (result.status === 'fulfilled' && !result.value.error) successCount++;
                                else errorCount++;
                            });

                            let resultMessage = `Import finished: ${successCount} successful operations.`;
                            if (errorCount > 0) resultMessage += ` ${errorCount} failed. Check console for details.`;
                            showModal("Import Complete", resultMessage, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);

                            await refreshData();
                            return true;
                        }, true, `<button id="modal-confirm-btn" class="btn-primary">Process Selected</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);

                        const selectAllCheckbox = document.getElementById('select-all-checkbox');
                        if (selectAllCheckbox) {
                            selectAllCheckbox.addEventListener('change', (e) => {
                                document.querySelectorAll('#modal-body .row-select-checkbox').forEach(cb => cb.checked = e.target.checked);
                            });
                        }
                    },
                    error: (err) => {
                        showModal("Import Error", `Error parsing CSV file: ${err.message}`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    }
                });
                e.target.value = "";
            });
        }

        if (addDealBtn) {
            addDealBtn.addEventListener("click", () => {
                if (!state.selectedAccountId) return showModal("Error", "Please select an account first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);

                if (state.dealStages.length === 0) {
                    showModal("No Deal Stages Defined", "Please contact your administrator to define deal stages before creating a deal.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                const stageOptions = state.dealStages.sort((a, b) => a.sort_order - b.sort_order).map(s => `<option value="${s.stage_name}">${s.stage_name}</option>`).join('');

                showModal("Create New Deal", `
                    <label>Deal Name:</label><input type="text" id="modal-deal-name" required>
                    <label>Term:</label><input type="text" id="modal-deal-term" placeholder="e.g., 12 months">
                    <label>Stage:</label><select id="modal-deal-stage" required>${stageOptions}</select>
                    <label>Monthly Recurring Revenue (MRC):</label><input type="number" id="modal-deal-mrc" min="0" value="0">
                    <label>Close Month:</label><input type="month" id="modal-deal-close-month">
                    <label>Products:</label><textarea id="modal-deal-products" placeholder="List products, comma-separated"></textarea>
                `, async () => {
                    const newDeal = {
                        user_id: state.currentUser.id,
                        account_id: state.selectedAccountId,
                        name: document.getElementById('modal-deal-name')?.value.trim(),
                        term: document.getElementById('modal-deal-term')?.value.trim(),
                        stage: document.getElementById('modal-deal-stage')?.value,
                        mrc: parseFloat(document.getElementById('modal-deal-mrc')?.value) || 0,
                        close_month: document.getElementById('modal-deal-close-month')?.value || null,
                        products: document.getElementById('modal-deal-products')?.value.trim(),
                        is_committed: false
                    };

                    if (!newDeal.name) {
                        showModal("Error", "Deal name is required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                        return false;
                    }

                    const { error } = await supabase.from('deals').insert([newDeal]);
                    if (error) {
                        showModal("Error", 'Error creating deal: ' + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                        return false;
                    }

                    await refreshData();
                    hideModal();
                    showModal("Success", 'Deal created successfully!', null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return true;
                }, true, `<button id="modal-confirm-btn" class="btn-primary">Create Deal</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
            });
        }

        if (accountContactsList) {
            accountContactsList.addEventListener("click", (e) => {
                const targetLink = e.target.closest(".contact-name-link");
                if (targetLink) {
                    e.preventDefault();
                    handleNavigation(targetLink.href);
                }
            });
        }

        if (addTaskAccountBtn) {
            addTaskAccountBtn.addEventListener("click", async () => {
                if (!state.selectedAccountId) return showModal("Error", "Please select an account to add a task for.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);

                const currentAccount = state.accounts.find(a => a.id === state.selectedAccountId);
                if (!currentAccount) return showModal("Error", "Selected account not found.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);

                showModal(`Create Task for ${currentAccount.name}`,
                    `<label>Description:</label><input type="text" id="modal-task-description" required><br><label>Due Date:</label><input type="date" id="modal-task-due-date">`,
                    async () => {
                        const description = document.getElementById('modal-task-description')?.value.trim();
                        if (!description) {
                            showModal("Error", "Task description is required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                            return false;
                        }
                        const newTask = {
                            user_id: state.currentUser.id,
                            description,
                            due_date: document.getElementById('modal-task-due-date')?.value || null,
                            status: 'Pending',
                            account_id: state.selectedAccountId,
                            contact_id: null
                        };
                        const { error } = await supabase.from('tasks').insert([newTask]);
                        if (error) {
                            showModal("Error", 'Error adding task: ' + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                            return false;
                        }
                        await refreshData();
                        hideModal();
                        showModal("Success", "Task created successfully!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                        return true;
                    }, true, `<button id="modal-confirm-btn" class="btn-primary">Add Task</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
            });
        }
    if (aiBriefingBtn) {
    aiBriefingBtn.addEventListener("click", handleGenerateBriefing);
}
     // NEW: Event listener for the dynamically created print button
        document.body.addEventListener('click', (e) => {
            if (e.target.id === 'print-briefing-btn') {
                handlePrintBriefing();
            }
        });
    }
async function initializePage() {
    await loadSVGs();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        console.error('Authentication failed or no session found. Redirecting to login.');
        window.location.href = "index.html";
        return;
    }
    state.currentUser = session.user;

    try {
        // Use the new, fast initial load
        await loadInitialData(); 

        // If an accountId is in the URL from another page, load its details
        const urlParams = new URLSearchParams(window.location.search);
        const accountIdFromUrl = urlParams.get('accountId');
        if (accountIdFromUrl) {
            state.selectedAccountId = Number(accountIdFromUrl);
            await loadDetailsForSelectedAccount();
        } else {
            // If no account is selected, ensure the details panel is hidden
            hideAccountDetails(false, true);
        }
        
        // The rest of the setup runs after the initial view is ready
        await setupUserMenuAndAuth(supabase, state);
        await setupGlobalSearch(supabase); // No longer needs currentUser
        await checkAndSetNotifications(supabase);
        setupPageEventListeners();

    } catch (error) {
        console.error("Critical error during page initialization:", error);
        showModal(
            "Loading Error",
            "There was a problem loading account data. Please refresh the page to try again.",
            null,
            false,
            `<button id="modal-ok-btn" class="btn-primary">OK</button>`
        );
    }
}
    initializePage();
});
