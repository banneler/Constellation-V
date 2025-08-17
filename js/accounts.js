import { SUPABASE_URL, SUPABASE_ANON_KEY, formatDate, formatMonthYear, parseCsvRow, themes, setupModalListeners, showModal, hideModal, updateActiveNavLink, setupUserMenuAndAuth, loadSVGs, setupGlobalSearch } from './shared_constants.js';

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
        tasks: [],
        isFormDirty: false,
        dealStages: []
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
    const aiAccountInsightBtn = document.getElementById("ai-account-insight-btn");
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
    
    const confirmAndSwitchAccount = (newAccountId) => {
        if (state.isFormDirty) {
            showModal("Unsaved Changes", "You have unsaved changes. Are you sure you want to switch accounts?", () => {
                state.isFormDirty = false;
                state.selectedAccountId = newAccountId;
                renderAccountList();
                renderAccountDetails();
                hideModal();
            }, true, `<button id="modal-confirm-btn" class="btn-primary">Discard & Switch</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
        } else {
            state.selectedAccountId = newAccountId;
            renderAccountList();
            renderAccountDetails();
        }
    };

    // --- Data Fetching ---
    async function loadAllData() {
        if (!state.currentUser) return;
        const userSpecificTables = ["contacts", "accounts", "activities", "contact_sequences", "deals", "tasks"];
        const promises = userSpecificTables.map((table) =>
            supabase.from(table).select("*").eq("user_id", state.currentUser.id)
        );
        const dealStagesPromise = supabase.from("deal_stages").select("*").order('sort_order');
        promises.push(dealStagesPromise);

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
            const dealStagesResult = results[userSpecificTables.length];
            if (dealStagesResult.status === "fulfilled" && !dealStagesResult.value.error) {
                state.dealStages = dealStagesResult.value.data || [];
            } else {
                console.error(`Error fetching deal_stages:`, dealStagesResult.status === 'fulfilled' ? dealStagesResult.value.error : dealStagesResult.reason);
                state.dealStages = [];
            }

            renderAccountList();
            if (state.selectedAccountId) {
                const updatedAccount = state.accounts.find(a => a.id === state.selectedAccountId);
                if (updatedAccount) {
                    renderAccountDetails();
                } else {
                    hideAccountDetails(false, true);
                }
            } else {
                hideAccountDetails(false, true);
            }

        } catch (error) {
            console.error("Critical error in loadAllData:", error);
        }
    }

    // --- Render Functions ---
    const renderAccountList = () => {
        if (!accountList || !accountSearch || !accountStatusFilter) return;

        const searchTerm = accountSearch.value.toLowerCase();
        const statusFilter = accountStatusFilter.value;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const hotAccountIds = new Set(
            state.activities
                .filter(act => new Date(act.date) > thirtyDaysAgo)
                .map(act => {
                    if (act.account_id) return act.account_id;
                    const contact = state.contacts.find(c => c.id === act.contact_id);
                    return contact ? contact.account_id : null;
                })
                .filter(id => id)
        );

        const accountsWithOpenDealsIds = new Set(
            state.deals
                .filter(deal => deal.stage !== 'Closed Won' && deal.stage !== 'Closed Lost')
                .map(deal => deal.account_id)
        );

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

                if (account.id === state.selectedAccountId) i.classList.add("selected");
                accountList.appendChild(i);
            });
    };

    const renderAccountDetails = () => {
        if (!accountForm) return;
        const account = state.accounts.find((a) => a.id === state.selectedAccountId);

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
            accountPendingTaskReminder.classList.add('hidden');
        }

        if (!accountContactsList || !accountActivitiesList || !accountDealsTableBody) return;
        accountContactsList.innerHTML = "";
        accountActivitiesList.innerHTML = "";
        accountDealsTableBody.innerHTML = "";

        if (account) {
            accountForm.classList.remove('hidden');
            accountForm.querySelector("#account-id").value = account.id;
            accountForm.querySelector("#account-name").value = account.name || "";
            
            const websiteInput = accountForm.querySelector("#account-website");
            const websiteLink = document.getElementById("account-website-link");
            websiteInput.value = account.website || "";

            const updateWebsiteLink = (url) => {
                if (!url || !url.trim()) {
                    if(websiteLink) websiteLink.classList.add('hidden');
                    return;
                }
                let fullUrl = url.trim();
                if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
                    fullUrl = 'https://' + fullUrl;
                }
                if(websiteLink) {
                    websiteLink.href = fullUrl;
                    websiteLink.classList.remove('hidden');
                }
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
            
            const accountAndContactActivities = state.activities.filter(act =>
                act.account_id === account.id ||
                state.contacts.some(c => c.id === act.contact_id && c.account_id === account.id)
            ).sort((a, b) => new Date(b.date) - new Date(a.date));

            accountActivitiesList.innerHTML = "";
            accountAndContactActivities.forEach((act) => {
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
            hideAccountDetails(true, true);
        }
    };

    const hideAccountDetails = (hideForm = true, clearSelection = false) => {
        if (accountForm && hideForm) accountForm.classList.add('hidden');
        else if (accountForm) {
            accountForm.classList.remove('hidden');
            accountForm.reset();
        }

        if (accountContactsList) accountContactsList.innerHTML = "";
        if (accountActivitiesList) accountActivitiesList.innerHTML = "";
        if (accountDealsTableBody) accountDealsTableBody.innerHTML = "";

        if (accountPendingTaskReminder) accountPendingTaskReminder.classList.add('hidden');

        if (clearSelection) {
            state.selectedAccountId = null;
            document.querySelectorAll(".list-item").forEach(item => item.classList.remove("selected"));
            state.isFormDirty = false;
        }
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
        const deal = state.deals.find(d => d.id === dealId);
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
            else { await loadAllData(); hideModal(); showModal("Success", "Deal updated successfully!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); }
        }, true, `<button id="modal-confirm-btn" class="btn-primary">Save Deal</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
    }

    // --- Event Listener Setup ---
    function setupPageEventListeners() {
        setupModalListeners();
        
        if(accountForm) {
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
                            const { data: newAccountArr, error} = await supabase.from("accounts").insert([{ name, user_id: state.currentUser.id }]).select();
                            if (error) {
                                showModal("Error", "Error creating account: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                                return false;
                            }
                            state.isFormDirty = false;
                            await loadAllData();
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
                if(error) {
                    showModal("Error", "Error saving account: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                state.isFormDirty = false;
                await loadAllData();
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
                        await loadAllData();
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
                            let successCount = 0, errorCount = 0;
                            
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

                            await loadAllData();
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

                const stageOptions = state.dealStages.sort((a,b) => a.sort_order - b.sort_order).map(s => `<option value="${s.stage_name}">${s.stage_name}</option>`).join('');

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
                    
                    await loadAllData();
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
                        await loadAllData();
                        hideModal();
                        showModal("Success", "Task created successfully!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                        return true;
                    }, true, `<button id="modal-confirm-btn" class="btn-primary">Add Task</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
            });
        }
        
        if (aiAccountInsightBtn) {
            aiAccountInsightBtn.addEventListener("click", async () => {
                if (!state.selectedAccountId) {
                    showModal("Error", "Please select an account to get AI insights.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                const account = state.accounts.find(a => a.id === state.selectedAccountId);
                if (!account) {
                    showModal("Error", "Selected account not found.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                const relevantActivities = state.activities
                    .filter(act =>
                        act.account_id === account.id ||
                        state.contacts.some(c => c.id === act.contact_id && c.account_id === account.id)
                    )
                    .sort((a, b) => new Date(a.date) - new Date(b.date));

                if (relevantActivities.length === 0) {
                    showModal("Info", "No activities found for this account or its contacts to generate insights.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                const activityData = relevantActivities.map(act => {
                    const contact = state.contacts.find(c => c.id === act.contact_id);
                    const contactName = contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 'Account-Level';
                    return `[${formatDate(act.date)}] Type: ${act.type}, Contact: ${contactName}, Description: ${act.description}`;
                }).join('\n');

                showModal("Generating AI Insight", `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">Analyzing account activities and generating insights...</p>`, null, false, `<button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);

                try {
                    const { data, error } = await supabase.functions.invoke('get-activity-insight', {
                        body: {
                            accountName: account.name,
                            activityLog: activityData
                        }
                    });
                    if (error) throw error;
                    
                    const insight = data.insight || "No insight generated.";
                    const nextSteps = data.next_steps || "No specific next steps suggested.";

                    showModal("AI Account Insight", `
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

        // 1. Load all data from the database first.
        // This also handles selecting an account if an ID is in the URL.
        const urlParams = new URLSearchParams(window.location.search);
        const accountIdFromUrl = urlParams.get('accountId');
        if (accountIdFromUrl) state.selectedAccountId = Number(accountIdFromUrl);
        await loadAllData(); // This function will also do the initial render.

        // 2. Now that data is loaded and the list is rendered, set up the rest of the UI and listeners.
        await setupUserMenuAndAuth(supabase, state); 
        await setupGlobalSearch(supabase, state.currentUser);
        setupPageEventListeners(); 
        
    } else {
        window.location.href = "index.html";
    }
}

    initializePage();
