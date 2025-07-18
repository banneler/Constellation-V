import { SUPABASE_URL, SUPABASE_ANON_KEY, formatDate, formatMonthYear, parseCsvRow, themes, setupModalListeners, showModal, hideModal, updateActiveNavLink, setupUserMenuAndAuth } from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        contacts: [],
        accounts: [],
        activities: [],
        contact_sequences: [],
        deals: [],
        selectedAccountId: null,
        tasks: [], // Ensure 'tasks' is included in your state
        isFormDirty: false // State to track unsaved changes
    };

    // --- DOM Element Selectors ---
    const navSidebar = document.querySelector(".nav-sidebar"); // Selector for the whole sidebar
    const accountList = document.getElementById("account-list");
    const accountSearch = document.getElementById("account-search"); // Search Input
    const addAccountBtn = document.getElementById("add-account-btn");
    const bulkImportAccountsBtn = document.getElementById("bulk-import-accounts-btn");
    const accountCsvInput = document.getElementById("account-csv-input");
    const accountForm = document.getElementById("account-form");
    const deleteAccountBtn = document.getElementById("delete-account-btn");
    const addDealBtn = document.getElementById("add-deal-btn");
    const addTaskAccountBtn = document.getElementById("add-task-account-btn");
    const accountContactsList = document.getElementById("account-contacts-list");
    const accountActivitiesList = document.getElementById("account-activities-list");
    const accountDealsTableBody = document.querySelector("#account-deals-table tbody");
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const themeNameSpan = document.getElementById("theme-name");

    // Selector for the pending task reminder for accounts page
    const accountPendingTaskReminder = document.getElementById("account-pending-task-reminder");


    // --- Dirty Check and Navigation ---

    // Function to handle navigating away from the page
    const handleNavigation = (url) => {
        if (state.isFormDirty) {
            showModal("Unsaved Changes", "You have unsaved changes that will be lost. Are you sure you want to leave?", () => {
                state.isFormDirty = false; // Acknowledge discard and allow navigation
                window.location.href = url;
            });
        } else {
            window.location.href = url; // No changes, navigate immediately
        }
    };
    
    // Function to handle switching between accounts
    const confirmAndSwitchAccount = (newAccountId) => {
        if (state.isFormDirty) {
            showModal("Unsaved Changes", "You have unsaved changes. Are you sure you want to switch accounts?", () => {
                state.isFormDirty = false; // Acknowledge discard
                state.selectedAccountId = newAccountId;
                renderAccountList();
                renderAccountDetails();
                hideModal();
            });
        } else {
            state.selectedAccountId = newAccountId;
            renderAccountList();
            renderAccountDetails();
        }
    };


    // --- Theme Logic ---
    let currentThemeIndex = 0;
    function applyTheme(themeName) {
        if (!themeNameSpan) return;
        document.body.className = '';
        document.body.classList.add(`theme-${themeName}`);
        const capitalizedThemeName = themeName.charAt(0).toUpperCase() + themeName.slice(1);
        themeNameSpan.textContent = capitalizedThemeName;
        localStorage.setItem('crm-theme', themeName);
    }
    function cycleTheme() {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        const newTheme = themes[currentThemeIndex];
        applyTheme(newTheme);
    }

    // --- Data Fetching ---
    async function loadAllData() {
        if (!state.currentUser) return;
        // Ensure 'tasks' is part of the tables being fetched for the user
        const userSpecificTables = ["contacts", "accounts", "activities", "contact_sequences", "deals", "tasks"];
        const promises = userSpecificTables.map((table) =>
            supabase.from(table).select("*").eq("user_id", state.currentUser.id)
        );

        try {
            const results = await Promise.allSettled(promises);
            results.forEach((result, index) => {
                const tableName = userSpecificTables[index];
                if (result.status === "fulfilled" && !result.value.error) {
                    state[tableName] = result.value.data || [];
                } else {
                    console.error(`Error fetching ${tableName}:`, result.status === 'fulfilled' ? result.value.error : result.reason);
                    state[tableName] = [];
                }
            });
        } catch (error) {
            console.error("Critical error in loadAllData:", error);
        } finally {
            renderAccountList();
            // Call renderAccountDetails after data is loaded to update reminder
            if (state.selectedAccountId) {
                const updatedAccount = state.accounts.find(a => a.id === state.selectedAccountId);
                if (updatedAccount) {
                    renderAccountDetails();
                } else {
                    hideAccountDetails(false, true); // Hide details if account not found (and hide reminder)
                }
            } else {
                hideAccountDetails(false, true); // Hide details if no account selected (and hide reminder)
            }
        }
    }

    // --- Render Functions ---
    const renderAccountList = () => {
        if (!accountList || !accountSearch) return;
        const searchTerm = accountSearch.value.toLowerCase();
        const filteredAccounts = state.accounts.filter(account =>
            (account.name || "").toLowerCase().includes(searchTerm)
        );

        accountList.innerHTML = "";
        filteredAccounts
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .forEach((account) => {
                const i = document.createElement("div");
                i.className = "list-item";
                i.textContent = account.name;
                i.dataset.id = account.id;
                if (account.id === state.selectedAccountId) i.classList.add("selected");
                accountList.appendChild(i);
            });
    };

    const renderAccountDetails = () => {
        if (!accountForm) return;
        const account = state.accounts.find((a) => a.id === state.selectedAccountId);

        // Check for pending tasks related to this account and display reminder
        if (accountPendingTaskReminder && account) {
            const pendingAccountTasks = state.tasks.filter(task => 
                task.status === 'Pending' && task.account_id === account.id
            );
            if (pendingAccountTasks.length > 0) {
                const taskCount = pendingAccountTasks.length;
                accountPendingTaskReminder.textContent = `You have ${taskCount} pending task${taskCount > 1 ? 's' : ''} for this account.`;
                accountPendingTaskReminder.classList.remove('hidden');
            } else {
                accountPendingTaskReminder.classList.add('hidden');
            }
        } else if (accountPendingTaskReminder) {
            // Hide if no account selected
            accountPendingTaskReminder.classList.add('hidden');
        }


        if (!accountContactsList || !accountActivitiesList || !accountDealsTableBody) return;
        accountContactsList.innerHTML = "";
        accountActivitiesList.innerHTML = "";
        accountDealsTableBody.innerHTML = "";

        if (account) {
            accountForm.classList.remove('hidden'); // Ensure form is visible
            accountForm.querySelector("#account-id").value = account.id;
            accountForm.querySelector("#account-name").value = account.name || "";
            accountForm.querySelector("#account-website").value = account.website || "";
            accountForm.querySelector("#account-industry").value = account.industry || "";
            accountForm.querySelector("#account-phone").value = account.phone || "";
            accountForm.querySelector("#account-address").value = account.address || "";
            accountForm.querySelector("#account-notes").value = account.notes || "";
            document.getElementById("account-last-saved").textContent = account.last_saved ? `Last Saved: ${formatDate(account.last_saved)}` : "";
            // NEW: Added rendering for new fields
            accountForm.querySelector("#account-sites").value = account.quantity_of_sites || "";
            accountForm.querySelector("#account-employees").value = account.employee_count || "";
            accountForm.querySelector("#account-is-customer").checked = account.is_customer;
            
            // NEW: Reset dirty flag when loading new data into the form
            state.isFormDirty = false;

            state.deals
                .filter((d) => d.account_id === account.id)
                .forEach((deal) => {
                    const row = accountDealsTableBody.insertRow();
                    row.innerHTML = `<td><input type="checkbox" class="commit-deal-checkbox" data-deal-id="${deal.id}" ${deal.is_committed ? "checked" : ""}></td><td>${deal.name}</td><td>${deal.term || ""}</td><td>${deal.stage}</td><td>$${deal.mrc || 0}</td><td>${deal.close_month ? formatMonthYear(deal.close_month) : ""}</td><td>${deal.products || ""}</td><td><button class="btn-secondary edit-deal-btn" data-deal-id="${deal.id}">Edit</button></td>`;
                });

            state.contacts
                .filter((c) => c.account_id === account.id)
                .forEach((c) => {
                    const li = document.createElement("li");
                    const inSeq = state.contact_sequences.some((cs) => cs.contact_id === c.id && cs.status === "Active");
                    li.innerHTML = `<a href="contacts.html?contactId=${c.id}" class="contact-name-link" data-contact-id="${c.id}">${c.first_name} ${c.last_name}</a> (${c.title || "No Title"}) ${inSeq ? '<span class="sequence-status-icon"></span>' : ""}`;
                    accountContactsList.appendChild(li);
                });
            
            state.activities
                .filter((act) => act.account_id === account.id)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .forEach((act) => {
                    const c = state.contacts.find((c) => c.id === act.contact_id);
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
        } else {
            // This function is for clearing details when no account is selected
            hideAccountDetails(true, true);
        }
    };

    // New helper function to hide/clear account details and reminder
    const hideAccountDetails = (hideForm = true, clearSelection = false) => {
        if (accountForm && hideForm) accountForm.classList.add('hidden');
        else if (accountForm) accountForm.classList.remove('hidden'); // Ensure it's shown if not explicitly hidden

        // Clear form fields
        accountForm.querySelector("#account-id").value = "";
        accountForm.querySelector("#account-name").value = "";
        accountForm.querySelector("#account-website").value = "";
        accountForm.querySelector("#account-industry").value = "";
        accountForm.querySelector("#account-phone").value = "";
        accountForm.querySelector("#account-address").value = "";
        accountForm.querySelector("#account-notes").value = "";
        document.getElementById("account-last-saved").textContent = "";
        // NEW: Clear new form fields as well
        accountForm.querySelector("#account-sites").value = "";
        accountForm.querySelector("#account-employees").value = "";
        accountForm.querySelector("#account-is-customer").checked = false;


        // Clear related lists
        if (accountContactsList) accountContactsList.innerHTML = "";
        if (accountActivitiesList) accountActivitiesList.innerHTML = "";
        if (accountDealsTableBody) accountDealsTableBody.innerHTML = "";

        // Hide reminder
        if (accountPendingTaskReminder) accountPendingTaskReminder.classList.add('hidden');

        if (clearSelection) {
            state.selectedAccountId = null;
            document.querySelectorAll(".list-item").forEach(item => item.classList.remove("selected"));
            state.isFormDirty = false; // Reset dirty flag when clearing selection
        }
    };

    // --- Deal Handlers ---
    async function handleCommitDeal(dealId, isCommitted) {
        const { error } = await supabase.from('deals').update({ is_committed: isCommitted }).eq('id', dealId);
        if (error) {
            alert('Error updating commit status: ' + error.message);
        } else {
            const deal = state.deals.find(d => d.id === dealId);
            if (deal) deal.is_committed = isCommitted;
        }
    }

    function handleEditDeal(dealId) {
        const deal = state.deals.find(d => d.id === dealId);
        if (!deal) return alert("Deal not found!");
        const stages = ["New", "Qualifying", "Proposal", "Negotiation", "Closed Won", "Closed Lost"];
        const stageOptions = stages.map(s => `<option value="${s}" ${deal.stage === s ? 'selected' : ''}>${s}</option>`).join('');
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
            if (!updatedDealData.name) return alert('Deal name is required.');
            const { error } = await supabase.from('deals').update(updatedDealData).eq('id', dealId);
            if (error) { alert('Error updating deal: ' + error.message); }
            else { await loadAllData(); hideModal(); alert('Deal updated successfully!'); }
        });
    }


    // --- Event Listener Setup ---
    function setupPageEventListeners() {
        setupModalListeners();
        updateActiveNavLink();
        
        // Intercept all main navigation clicks
        const navSidebar = document.querySelector(".nav-sidebar");
        if (navSidebar) {
            navSidebar.addEventListener('click', (e) => {
                const navButton = e.target.closest('a.nav-button');
                if (navButton) {
                    e.preventDefault(); // Prevent immediate navigation
                    handleNavigation(navButton.href);
                }
            });
        }

        // Intercept clicks on the logout button
        const logoutBtn = document.getElementById("logout-btn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", (e) => {
                e.preventDefault();
                handleNavigation('index.html'); // The logout logic is now handled after confirmation
            });
        }

        // Flag form as dirty on any input
        if (accountForm) {
            accountForm.addEventListener('input', () => {
                state.isFormDirty = true;
            });
        }
        
        // Handle browser-level navigation (refresh, close tab)
        window.addEventListener('beforeunload', (event) => {
            if (state.isFormDirty) {
                event.preventDefault();
                event.returnValue = ''; // Required for legacy browsers
            }
        });

        if (accountSearch) accountSearch.addEventListener("input", renderAccountList);

        if (addAccountBtn) {
            addAccountBtn.addEventListener("click", async () => {
                // Use the confirmation function before adding a new account
                if (state.isFormDirty) {
                     showModal("Unsaved Changes", "You have unsaved changes. Are you sure you want to proceed?", () => {
                        hideAccountDetails(false, true);
                        showModal("New Account Name", `<label>Account Name</label><input type="text" id="modal-account-name" required>`,
                            async () => {
                                const name = document.getElementById("modal-account-name")?.value.trim();
                                if (name) {
                                    const { data: newAccountArr, error} = await supabase.from("accounts").insert([{ name, user_id: state.currentUser.id }]).select();
                                    if (error) return alert("Error creating account: " + error.message);
                                    state.isFormDirty = false;
                                    await loadAllData();
                                    state.selectedAccountId = newAccountArr?.[0]?.id; // Use optional chaining for safety
                                    renderAccountList();
                                    renderAccountDetails();
                                    hideModal();
                                } else { alert("Account name is required."); return false; } // Return false to prevent modal close
                            }
                        );
                    });
                } else {
                     hideAccountDetails(false, true);
                     showModal("New Account Name", `<label>Account Name</label><input type="text" id="modal-account-name" required>`,
                        async () => {
                            const name = document.getElementById("modal-account-name")?.value.trim();
                            if (name) {
                                const { data: newAccountArr, error} = await supabase.from("accounts").insert([{ name, user_id: state.currentUser.id }]).select();
                                if (error) return alert("Error creating account: " + error.message);
                                await loadAllData();
                                state.selectedAccountId = newAccountArr?.[0]?.id; // Use optional chaining for safety
                                renderAccountList();
                                renderAccountDetails();
                                hideModal();
                            } else { alert("Account name is required."); return false; } // Return false to prevent modal close
                        }
                    );
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
                    // NEW: Include the new fields in the update
                    quantity_of_sites: parseInt(accountForm.querySelector("#account-sites")?.value) || 0,
                    employee_count: parseInt(accountForm.querySelector("#account-employees")?.value) || 0,
                    is_customer: accountForm.querySelector("#account-is-customer")?.checked
                };
                if (!data.name) return alert("Account name is required.");

                const { error } = await supabase.from("accounts").update(data).eq("id", id);
                if(error) return alert("Error saving account: " + error.message);

                // NEW: Reset dirty flag after successful save
                state.isFormDirty = false;
                await loadAllData();
                alert("Account saved!");
            });
        }


        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener("click", async () => {
                if (!state.selectedAccountId) return;
                showModal("Confirm Deletion", "Are you sure you want to delete this account? This cannot be undone.",
                    async () => {
                        const { error } = await supabase.from("accounts").delete().eq("id", state.selectedAccountId);
                        if (error) return alert("Error deleting account: " + error.message);
                        state.selectedAccountId = null;
                        state.isFormDirty = false; // NEW: Reset dirty flag
                        await loadAllData();
                        hideModal();
                        alert("Account deleted successfully!");
                    }
                );
            });
        }

        if (bulkImportAccountsBtn) bulkImportAccountsBtn.addEventListener("click", () => accountCsvInput.click());

        if (accountCsvInput) {
            accountCsvInput.addEventListener("change", (e) => {
                const f = e.target.files[0]; if (!f) return;
                const r = new FileReader();
                r.onload = async function (e) {
                    const rows = e.target.result.split("\n").filter((r) => r.trim() !== "");
                    // Assuming CSV headers are: name,website,industry,phone,address,notes,quantity_of_sites,employee_count,is_customer
                    const newRecords = rows.slice(1).map((row) => { // Skip header row
                        const c = parseCsvRow(row);
                        return {
                            name: c[0] || "",
                            website: c[1] || "",
                            industry: c[2] || "",
                            phone: c[3] || "",
                            address: c[4] || "",
                            // The original CSV template from accounts_template.csv only had 5 columns.
                            // If user's CSV includes new fields, they need to be mapped here.
                            // For safety, let's include the new fields as optional here, assuming they come after.
                            quantity_of_sites: parseInt(c[5]) || 0, // Assuming 6th column if extended
                            employee_count: parseInt(c[6]) || 0, // Assuming 7th column
                            is_customer: c[7]?.toLowerCase() === 'true', // Assuming 8th column
                            user_id: state.currentUser.id
                        };
                    });
                    if (newRecords.length > 0) {
                        const { error } = await supabase.from("accounts").insert(newRecords);
                        if (error) {
                            alert("Error importing accounts: " + error.message);
                        } else {
                            alert(`${newRecords.length} accounts imported.`);
                            await loadAllData();
                        }
                    } else {
                        alert("No valid records found to import.");
                    }
                };
                r.readAsText(f); e.target.value = "";
            });
        }

        if (addDealBtn) {
            addDealBtn.addEventListener("click", () => {
                if (!state.selectedAccountId) return alert("Please select an account first.");
                showModal("Create New Deal", `
                    <label>Deal Name:</label><input type="text" id="modal-deal-name" required>
                    <label>Term:</label><input type="text" id="modal-deal-term" placeholder="e.g., 12 months">
                    <label>Stage:</label><select id="modal-deal-stage" required>
                        <option value="New">New</option>
                        <option value="Qualifying">Qualifying</option>
                        <option value="Proposal">Proposal</option>
                        <option value="Negotiation">Negotiation</option>
                        <option value="Closed Won">Closed Won</option>
                        <option value="Closed Lost">Closed Lost</option>
                    </select>
                    <label>Monthly Recurring Revenue (MRC):</label><input type="number" id="modal-deal-mrc" min="0" value="0">
                    <label>Close Month:</label><input type="month" id="modal-deal-close-month">
                    <label>Products:</label><textarea id="modal-deal-products" placeholder="List products, comma-separated"></textarea>
                `, async () => {
                    const dealName = document.getElementById('modal-deal-name')?.value.trim();
                    const term = document.getElementById('modal-deal-term')?.value.trim();
                    const stage = document.getElementById('modal-deal-stage')?.value;
                    const mrc = parseFloat(document.getElementById('modal-deal-mrc')?.value) || 0;
                    const closeMonth = document.getElementById('modal-deal-close-month')?.value;
                    const products = document.getElementById('modal-deal-products')?.value.trim();

                    if (!dealName) { alert('Deal name is required.'); return false; } // Return false to prevent modal close

                    const newDeal = {
                        user_id: state.currentUser.id,
                        account_id: state.selectedAccountId,
                        name: dealName,
                        term: term,
                        stage: stage,
                        mrc: mrc,
                        close_month: closeMonth || null,
                        products: products,
                        is_committed: false
                    };
                    const { error } = await supabase.from('deals').insert([newDeal]);
                    if (error) { alert('Error creating deal: ' + error.message); return false; } // Return false on error
                    else { await loadAllData(); hideModal(); alert('Deal created successfully!'); return true; } // Return true on success
                });
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
                if (!state.selectedAccountId) return alert("Please select an account to link the task.");
                const currentAccount = state.accounts.find(a => a.id === state.selectedAccountId);
                if (!currentAccount) return alert("Selected account not found.");
                showModal(`Create Task for ${currentAccount.name}`,
                    `<label>Description:</label><input type="text" id="modal-task-description" required><br><label>Due Date:</label><input type="date" id="modal-task-due-date">`,
                    async () => {
                        const description = document.getElementById('modal-task-description')?.value.trim();
                        const dueDate = document.getElementById('modal-task-due-date')?.value;
                        if (!description) {
                            alert('Task description is required.');
                            return false; // Return false to prevent modal close
                        }
                        const newTask = {
                            user_id: state.currentUser.id,
                            description,
                            due_date: dueDate || null,
                            status: 'Pending',
                            account_id: state.selectedAccountId
                        };
                        const { error } = await supabase.from('tasks').insert([newTask]);
                        if (error) {
                            alert('Error: ' + error.message);
                            return false; // Return false on error
                        } else {
                            await loadAllData();
                            hideModal();
                            alert('Task created successfully!');
                            return true; // Return true on success
                        }
                    }
                );
            });
        }
    }

    // --- App Initialization ---
    async function initializePage() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            state.currentUser = session.user;
            setupPageEventListeners(); // Ensure listeners are set up before data load or user menu setup might trigger them.
            await setupUserMenuAndAuth(supabase, state); // Call setupUserMenuAndAuth here
            const urlParams = new URLSearchParams(window.location.search);
            const accountIdFromUrl = urlParams.get('accountId');
            if (accountIdFromUrl) state.selectedAccountId = Number(accountIdFromUrl);
            await loadAllData();
        } else {
            window.location.href = "index.html";
        }
    }

    initializePage();
});
