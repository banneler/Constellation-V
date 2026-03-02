import { SUPABASE_URL, SUPABASE_ANON_KEY, formatDate, formatMonthYear, formatSimpleDate, parseCsvRow, getDealNotesStatus, themes, setupModalListeners, showModal, hideModal, updateActiveNavLink, setupUserMenuAndAuth, initializeAppState, getState, loadSVGs, showGlobalLoader, hideGlobalLoader, setupGlobalSearch, checkAndSetNotifications, injectGlobalNavigation, logToSalesforce } from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    injectGlobalNavigation();
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
        },

        contactViewMode: 'list' // 'list' or 'org'
    };

    let draggedContactId = null;

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
    
    const contactListView = document.getElementById("contact-list-view");
    const contactOrgChartView = document.getElementById("contact-org-chart-view");
    const accountContactsList = document.getElementById("account-contacts-list");
    const contactListBtn = document.getElementById("contact-list-btn");
    const contactOrgChartBtn = document.getElementById("contact-org-chart-btn");
    const orgChartMaximizeBtn = document.getElementById("org-chart-maximize-btn");
    const orgChartModalBackdrop = document.getElementById("org-chart-modal-backdrop");
    const orgChartModalContent = document.getElementById("org-chart-modal-content");
    const orgChartModalCloseBtn = document.getElementById("org-chart-modal-close-btn");
    
    const accountActivitiesList = document.getElementById("account-activities-list");
    const accountDealsCards = document.getElementById("account-deals-cards");
    const accountPendingTaskReminder = document.getElementById("account-pending-task-reminder");
    const aiBriefingBtn = document.getElementById("ai-briefing-btn");
    const zoominfoAccountBtn = document.getElementById("zoominfo-account-btn");
    const salesforceAccountBtn = document.getElementById("salesforce-account-btn");
    const accountFilterIcons = document.getElementById("account-filter-icons");
    const accountIndustrySelect = document.getElementById("account-industry");

    if (accountActivitiesList) {
        accountActivitiesList.addEventListener("click", async (e) => {
            const btn = e.target.closest(".btn-log-sf");
            if (!btn) return;
            const id = btn.getAttribute("data-activity-id");
            if (!id) return;
            const act = state.selectedAccountDetails.activities.find((a) => String(a.id) === String(id));
            if (act) {
                const account = state.selectedAccountDetails.account;
                logToSalesforce({ subject: act.description, notes: act.description, type: act.type, created_at: act.date, sf_account_locator: account?.sf_account_locator });
                const { error } = await supabase.from("activities").update({ logged_to_sf: true }).eq("id", act.id);
                if (!error) {
                    act.logged_to_sf = true;
                    btn.style.display = "none";
                }
            }
        });
    }

    let tomSelectIndustry = null;

    function initTomSelect(el, opts = {}) {
        if (typeof window.TomSelect === 'undefined') return null;
        try {
            return new window.TomSelect(el, { create: true, ...opts });
        } catch (e) {
            return null;
        }
    }

    function getDealStageColorClass(stageName) {
        if (!stageName) return "deal-stage-default";
        const s = (stageName || "").toLowerCase();
        if (s.includes("closed won") || s.includes("won")) return "deal-stage-won";
        if (s.includes("closed lost") || s.includes("lost")) return "deal-stage-lost";
        if (s.includes("discovery") || s.includes("qualification")) return "deal-stage-discovery";
        if (s.includes("proposal") || s.includes("quote")) return "deal-stage-proposal";
        if (s.includes("negotiation") || s.includes("contract")) return "deal-stage-negotiation";
        return "deal-stage-default";
    }

    function escapeNotesForHtml(notes) {
        if (!notes || !notes.trim()) return "";
        return (notes || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br>");
    }

    const PRODUCT_FAMILIES = ["Internet", "Ethernet", "UC", "PRI/SIP", "SD-WAN", "Firewall", "5G", "Cloud Connect", "Waves"];

    function getProductClass(productName) {
        const p = productName.toLowerCase().trim();
        if (p.includes("internet")) return "product-internet";
        if (p.includes("ethernet")) return "product-ethernet";
        if (p.includes("uc")) return "product-uc";
        if (p.includes("pri") || p.includes("sip")) return "product-pri-sip";
        if (p.includes("sdwan") || p.includes("sd-wan")) return "product-sdwan";
        if (p.includes("firewall")) return "product-firewall";
        if (p.includes("5g")) return "product-5g";
        if (p.includes("cloud")) return "product-cloud";
        if (p.includes("wave")) return "product-waves";
        return "product-default";
    }

    function getProductPillHtml(dealId, productsString) {
        const activeProducts = (productsString || "").split(",").map((p) => p.trim().toLowerCase()).filter((p) => p);
        return `<div class="flex flex-wrap gap-1 mt-1 justify-start">
            ${PRODUCT_FAMILIES.map((p) => {
                const isMatch = (ap) => ap === p.toLowerCase() ||
                    (p === "PRI/SIP" && (ap.includes("pri") || ap.includes("sip"))) ||
                    (p === "SD-WAN" && (ap.includes("sdwan") || ap.includes("sd-wan")));
                const isActive = activeProducts.some(isMatch);
                if (isActive) {
                    return `<span class="product-pill product-pill-toggle active cursor-pointer hover:opacity-80 transition-opacity ${getProductClass(p)}" data-deal-id="${dealId}" data-product="${p}" title="Remove ${p}">${p}</span>`;
                }
                return `<span class="product-pill product-pill-toggle cursor-pointer hover:bg-[var(--bg-medium)] transition-colors" data-deal-id="${dealId}" data-product="${p}" style="background-color: transparent; color: var(--text-muted); border-color: var(--border-color);" title="Add ${p}">${p}</span>`;
            }).join("")}
        </div>`;
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

    const confirmAndSwitchAccount = async (newAccountId) => {
        const switchAccount = async () => {
            state.selectedAccountId = newAccountId;
            renderAccountList();
            await loadDetailsForSelectedAccount();
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
    async function loadInitialData() {
        if (!state.currentUser) return;
        showGlobalLoader();
        try {
        const [accountsRes, dealsRes, activitiesRes, contactsRes, dealStagesRes] = await Promise.all([
            supabase.from("accounts").select("*").eq("user_id", getState().effectiveUserId),
            supabase.from("deals").select("id, account_id, stage").eq("user_id", getState().effectiveUserId),
            supabase.from("activities").select("id, account_id, contact_id, date").eq("user_id", getState().effectiveUserId),
            supabase.from("contacts").select("id, account_id, reports_to").eq("user_id", getState().effectiveUserId),
            supabase.from("deal_stages").select("*").order('sort_order')
        ]);

        if (accountsRes.error) throw accountsRes.error;
        if (dealsRes.error) throw dealsRes.error;
        if (activitiesRes.error) throw activitiesRes.error;
        if (contactsRes.error) throw contactsRes.error;
        if (dealStagesRes.error) throw dealStagesRes.error;
        
        state.accounts = accountsRes.data || [];
        state.deals = dealsRes.data || [];
        state.activities = activitiesRes.data || [];
        state.contacts = contactsRes.data || [];
        state.dealStages = dealStagesRes.data || [];

        renderAccountList();
        } finally {
            hideGlobalLoader();
        }
    }

    async function loadDetailsForSelectedAccount() {
        if (!state.selectedAccountId) return;

        if (contactListView) contactListView.innerHTML = '<ul id="account-contacts-list"><li>Loading...</li></ul>';
        if (contactOrgChartView) contactOrgChartView.innerHTML = '<p class="placeholder-text" style="text-align: center; padding: 2rem 0;">Loading...</p>';
        if (accountActivitiesList) accountActivitiesList.innerHTML = '<p class="recent-activities-empty text-sm text-[var(--text-medium)] px-4 py-6">Loading...</p>';
        if (accountDealsCards) accountDealsCards.innerHTML = '<p class="recent-activities-empty text-sm text-[var(--text-medium)] px-4 py-6">Loading...</p>';
        
        const account = state.accounts.find(a => a.id === state.selectedAccountId);
        state.selectedAccountDetails.account = account;

        const [contactsRes, dealsRes, activitiesRes, tasksRes] = await Promise.all([
            supabase.from("contacts").select("*").eq("account_id", state.selectedAccountId),
            supabase.from("deals").select("*").eq("account_id", state.selectedAccountId),
            supabase.from("activities").select("*").eq("account_id", state.selectedAccountId),
            supabase.from("tasks").select("*").eq("account_id", state.selectedAccountId)
        ]);

        if (contactsRes.error) throw contactsRes.error;
        if (dealsRes.error) throw dealsRes.error;
        if (activitiesRes.error) throw activitiesRes.error;
        if (tasksRes.error) throw tasksRes.error;

        const contactIds = (contactsRes.data || []).map(c => c.id);
        const sequencesRes = contactIds.length > 0
            ? await supabase.from("contact_sequences").select("*").in('contact_id', contactIds)
            : { data: [], error: null };

        if (sequencesRes.error) throw sequencesRes.error;

        state.selectedAccountDetails.contacts = contactsRes.data || [];
        state.selectedAccountDetails.deals = dealsRes.data || [];
        state.selectedAccountDetails.activities = activitiesRes.data || [];
        state.selectedAccountDetails.tasks = tasksRes.data || [];
        state.selectedAccountDetails.contact_sequences = sequencesRes.data || [];

        renderAccountDetails();
    }
    
    async function refreshData() {
        await loadInitialData();
        if (state.selectedAccountId) {
            await loadDetailsForSelectedAccount();
        }
    }

        
    const hideAccountDetails = (clearSelection = false) => {
        if (accountForm) {
            accountForm.reset();
            accountForm.querySelector("#account-id").value = '';
            document.getElementById("account-last-saved").textContent = "";
            if (tomSelectIndustry) tomSelectIndustry.clear();
        }
        
        if (contactListView) contactListView.innerHTML = '<p id="account-contacts-empty" class="recent-activities-empty text-sm text-[var(--text-medium)] px-4 py-6">Select an account to see contacts.</p><ul id="account-contacts-list" class="hidden"></ul>';
        if (contactOrgChartView) contactOrgChartView.innerHTML = "";
        if (accountActivitiesList) accountActivitiesList.innerHTML = '<p class="recent-activities-empty text-sm text-[var(--text-medium)] px-4 py-6">Select an account to see related activities.</p>';
        if (accountDealsCards) accountDealsCards.innerHTML = '<p class="recent-activities-empty text-sm text-[var(--text-medium)] px-4 py-6">Select an account to see deals.</p>';
        if (accountPendingTaskReminder) accountPendingTaskReminder.classList.add('hidden');

        const sfLocatorDisplay = document.getElementById("sf-locator-display");
        const sfLocatorInput = document.getElementById("sf-locator-input");
        const sfLocatorWrap = document.getElementById("sf-locator-inline-wrap");
        if (sfLocatorDisplay) sfLocatorDisplay.textContent = "Salesforce ID";
        if (sfLocatorDisplay) sfLocatorDisplay.classList.remove("has-value");
        if (sfLocatorInput) sfLocatorInput.value = "";
        if (sfLocatorWrap) sfLocatorWrap.classList.remove("edit-mode");
        const zoominfoLocatorDisplay = document.getElementById("zoominfo-locator-display");
        const zoominfoLocatorInput = document.getElementById("zoominfo-locator-input");
        const zoominfoLocatorWrap = document.getElementById("zoominfo-locator-inline-wrap");
        if (zoominfoLocatorDisplay) zoominfoLocatorDisplay.textContent = "Zoom Info Company Id";
        if (zoominfoLocatorDisplay) zoominfoLocatorDisplay.classList.remove("has-value");
        if (zoominfoLocatorInput) zoominfoLocatorInput.value = "";
        if (zoominfoLocatorWrap) zoominfoLocatorWrap.classList.remove("edit-mode");

        if (clearSelection) {
            state.selectedAccountId = null;
            state.selectedAccountDetails = { account: null, contacts: [], activities: [], deals: [], tasks: [], contact_sequences: [] };
            document.querySelectorAll(".list-item.selected").forEach(item => item.classList.remove("selected"));
            state.isFormDirty = false;
        }
    };

    // --- Render Functions ---
    const getAccountFilter = () => {
        const active = accountFilterIcons?.querySelector(".account-filter-icon.active");
        return active?.dataset.filter || "all";
    };

    const renderAccountList = () => {
        if (!accountList || !accountSearch || !accountFilterIcons) {
            console.error("Render failed: A required DOM element is missing.");
            return;
        }

        const searchTerm = accountSearch.value.toLowerCase();
        const statusFilter = getAccountFilter();
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

                i.innerHTML = `<div class="account-list-item-row"><span class="account-list-name">${account.name}</span><div class="list-item-icons">${hotIcon}${dealIcon}</div></div>`;

                if (account.id === state.selectedAccountId) {
                    i.classList.add("selected");
                }
                accountList.appendChild(i);
            });
    };

    const renderAccountDetails = () => {
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
                accountPendingTaskReminder.textContent = '';
                accountPendingTaskReminder.classList.add('hidden');
            }
        }

        accountForm.querySelector("#account-id").value = account.id;
        accountForm.querySelector("#account-name").value = account.name || "";
        
        const websiteInput = accountForm.querySelector("#account-website");
        const websiteLink = document.getElementById("account-website-link");
        websiteInput.value = account.website || "";
        
        const updateWebsiteLink = (url) => {
            if (!url || !url.trim()) { if (websiteLink) websiteLink.classList.add('hidden'); return; }
            let fullUrl = url.trim();
            if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) { fullUrl = 'https://' + fullUrl; }
            if (websiteLink) { websiteLink.href = fullUrl; websiteLink.classList.remove('hidden'); }
        };
        updateWebsiteLink(account.website);
        if (tomSelectIndustry) {
            tomSelectIndustry.setValue(account.industry || "");
        } else {
            accountForm.querySelector("#account-industry").value = account.industry || "";
        }
        accountForm.querySelector("#account-phone").value = account.phone || "";
        accountForm.querySelector("#account-address").value = account.address || "";
        accountForm.querySelector("#account-notes").value = account.notes || "";
        document.getElementById("account-last-saved").textContent = account.last_saved ? `Last Saved: ${formatDate(account.last_saved)}` : "";
        accountForm.querySelector("#account-sites").value = account.quantity_of_sites || "";
        accountForm.querySelector("#account-employees").value = account.employee_count || "";
        accountForm.querySelector("#account-is-customer").checked = account.is_customer;

        const sfLocatorDisplay = document.getElementById("sf-locator-display");
        const sfLocatorInput = document.getElementById("sf-locator-input");
        const sfLocatorWrap = document.getElementById("sf-locator-inline-wrap");
        if (sfLocatorDisplay) {
            const val = (account.sf_account_locator || "").trim();
            sfLocatorDisplay.textContent = val || "Salesforce ID";
            sfLocatorDisplay.classList.toggle("has-value", !!val);
        }
        if (sfLocatorInput) {
            sfLocatorInput.value = (account.sf_account_locator || "").trim();
        }
        if (sfLocatorWrap) {
            sfLocatorWrap.classList.remove("edit-mode");
        }
        const zoominfoLocatorDisplayZi = document.getElementById("zoominfo-locator-display");
        const zoominfoLocatorInputZi = document.getElementById("zoominfo-locator-input");
        const zoominfoLocatorWrapZi = document.getElementById("zoominfo-locator-inline-wrap");
        if (zoominfoLocatorDisplayZi) {
            const ziVal = (account.zoominfo_company_id || "").trim();
            zoominfoLocatorDisplayZi.textContent = ziVal || "Zoom Info Company Id";
            zoominfoLocatorDisplayZi.classList.toggle("has-value", !!ziVal);
        }
        if (zoominfoLocatorInputZi) {
            zoominfoLocatorInputZi.value = (account.zoominfo_company_id || "").trim();
        }
        if (zoominfoLocatorWrapZi) {
            zoominfoLocatorWrapZi.classList.remove("edit-mode");
        }

        accountDealsCards.innerHTML = "";
        if (deals.length === 0) {
            accountDealsCards.innerHTML = '<p class="recent-activities-empty text-sm text-[var(--text-medium)] px-4 py-6">No deals yet.</p>';
        } else {
            deals.forEach((deal) => {
                const stageClass = getDealStageColorClass(deal.stage);
                const notes = (deal.notes || "").trim();
                const notesEscaped = escapeNotesForHtml(notes);
                const dealId = deal.id;
                const truncate = (str, max = 30) => {
                    if (!str) return '';
                    return str.length > max ? str.substring(0, max) + '...' : str;
                };
                const safeName = (deal.name || "").replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const actionButtons = dealId === 'new'
                    ? `<div class="flex items-center gap-1"><button type="button" class="btn-icon btn-icon-sm deal-card-save-btn" data-deal-id="${dealId}" title="Save Deal"><i class="fas fa-check"></i></button><button type="button" class="btn-icon btn-icon-sm deal-card-cancel-btn" data-deal-id="${dealId}" title="Cancel"><i class="fas fa-times"></i></button></div>`
                    : '';

                const notesStatus = getDealNotesStatus(deal);
                const updatedLabel = deal.notes_last_updated ? formatSimpleDate(deal.notes_last_updated) : "—";
                const frontContent = `
                    <div class="deal-card-header">
                        <div class="deal-card-commit-row">
                            <label class="deal-card-commit-toggle" for="deal-commit-${dealId}">
                                <input type="checkbox" id="deal-commit-${dealId}" class="deal-card-commit-input commit-deal-checkbox sr-only" data-deal-id="${dealId}" ${deal.is_committed ? "checked" : ""}>
                                <span class="deal-card-commit-slider"></span>
                                <span class="deal-card-commit-label">Committed</span>
                            </label>
                            <span class="deal-card-stage deal-card-editable" data-field="stage">${deal.stage}</span>
                        </div>
                        ${actionButtons}
                        <span class="deal-card-notes-dot deal-card-notes-dot--${notesStatus.status}" title="${(notesStatus.label || "").replace(/"/g, "&quot;")}" aria-hidden="true"><span class="deal-card-notes-light deal-card-notes-light--top"></span><span class="deal-card-notes-light deal-card-notes-light--mid"></span><span class="deal-card-notes-light deal-card-notes-light--bottom"></span></span>
                    </div>
                    <div class="deal-card-value deal-card-editable" data-field="mrc">$${deal.mrc || 0}/mo</div>
                    <div class="deal-card-name deal-card-editable" data-field="name" title="${safeName}">${truncate(safeName, 30)}</div>
                    <div class="deal-card-products">${getProductPillHtml(dealId, deal.products)}</div>
                    <div class="deal-card-footer">
                        ${deal.close_month ? `<span class="deal-card-close deal-card-editable" data-field="close_month">${formatMonthYear(deal.close_month)}</span>` : '<span class="deal-card-close deal-card-empty deal-card-editable" data-field="close_month">-</span>'}
                        ${deal.term ? `<span class="deal-card-term deal-card-editable" data-field="term">Term: ${deal.term}</span>` : '<span class="deal-card-term deal-card-empty deal-card-editable" data-field="term">Term</span>'}
                    </div>
                `;
                const backContent = `
                    <div class="deal-card-back-content">
                        <div class="deal-card-back-body">${notesEscaped || '<span class="text-[var(--text-muted)]">No notes</span>'}</div>
                        <div class="deal-card-back-footer">
                            <span class="deal-card-notes-updated">Updated ${updatedLabel}</span>
                            <button type="button" class="btn-icon btn-icon-sm deal-card-back-edit" data-deal-id="${dealId}" title="Edit notes"><i class="fas fa-pen"></i></button>
                        </div>
                    </div>`;
                const card = document.createElement("div");
                card.className = `deal-card ${stageClass} deal-card-flippable`;
                card.dataset.dealId = dealId;
                card.innerHTML = `
                    <div class="deal-card-flip-inner">
                        <div class="deal-card-front">${frontContent}</div>
                        <div class="deal-card-back">${backContent}</div>
                    </div>
                `;
                accountDealsCards.appendChild(card);
                const flipInner = card.querySelector(".deal-card-flip-inner");
                const backEditBtn = card.querySelector(".deal-card-back-edit");
                flipInner.addEventListener("click", (e) => {
                    if (card.classList.contains("deal-card-editing") || card.classList.contains("deal-card-notes-editing")) return;
                    const isCommit = e.target.closest(".deal-card-commit-toggle");
                    const isBackEdit = e.target.closest(".deal-card-back-edit");
                    const isNotesSave = e.target.closest(".deal-card-notes-save");
                    const isNotesCancel = e.target.closest(".deal-card-notes-cancel");
                    const isProductPill = e.target.closest(".product-pill-toggle");
                    const inlineInput = e.target.closest(".deal-card-inline-input, .deal-card-inline-select");
                    const inlineEditable = e.target.closest(".deal-card-editable");
                    if (isProductPill) { e.stopPropagation(); handleProductPillToggle(e.target.closest(".product-pill-toggle")); return; }
                    if (isBackEdit) { e.stopPropagation(); enterNotesEditMode(card, dealId, deal.notes || ""); return; }
                    if (isNotesSave || isNotesCancel) return;
                    if (inlineInput) { e.stopPropagation(); return; }
                    if (inlineEditable && dealId !== 'new') { e.stopPropagation(); startAccountDealInlineEdit(card, inlineEditable, dealId); return; }
                    if (card.classList.contains("deal-card-flipped")) { card.classList.remove("deal-card-flipped"); return; }
                    if (isCommit) return;
                    card.classList.add("deal-card-flipped");
                });
                if (backEditBtn) {
                    backEditBtn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        enterNotesEditMode(card, dealId, deal.notes || "");
                    });
                }
            });
        }

        renderContactView();

        accountActivitiesList.innerHTML = "";
        if (activities.length === 0) {
            accountActivitiesList.innerHTML = '<p class="recent-activities-empty text-sm text-[var(--text-medium)] px-4 py-6">No activities yet.</p>';
        } else {
            activities.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach((act) => {
                const c = contacts.find((c) => c.id === act.contact_id);
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
                        <div class="activity-meta">${act.type} with ${c ? `${c.first_name} ${c.last_name}` : "Unknown"}</div>
                        <div class="activity-description">${act.description}</div>
                        <div class="activity-date">${formatDate(act.date)}</div>
                    </div>
                    <div class="activity-actions">${logSfBtnHtml}</div>
                `;
                accountActivitiesList.appendChild(item);
            });
        }

        state.isFormDirty = false;
    };

    const renderContactView = () => {
        if (!contactListView || !contactOrgChartView || !contactListBtn || !contactOrgChartBtn) {
            console.error('Contact view elements not found. Skipping render.');
            return;
        }

        if (state.contactViewMode === 'org') {
            contactListView.classList.add('hidden');
            contactOrgChartView.classList.remove('hidden');
            contactListBtn.classList.remove('active');
            contactOrgChartBtn.classList.add('active');
            if (orgChartMaximizeBtn) orgChartMaximizeBtn.classList.remove('hidden');
            renderOrgChart();
        } else {
            contactListView.classList.remove('hidden');
            contactOrgChartView.classList.add('hidden');
            contactListBtn.classList.add('active');
            contactOrgChartBtn.classList.remove('active');
            if (orgChartMaximizeBtn) orgChartMaximizeBtn.classList.add('hidden');
            renderContactList();
        }
    };

    const renderContactList = () => {
        const { contacts, contact_sequences } = state.selectedAccountDetails;
        const listElement = document.getElementById('account-contacts-list');
        const contactsEmptyEl = document.getElementById('account-contacts-empty');
        if (!listElement) return;

        if (contactsEmptyEl) contactsEmptyEl.classList.add('hidden');
        listElement.classList.remove('hidden');
        listElement.innerHTML = "";
        if (contacts.length === 0) {
            contactListView.innerHTML = '<p id="account-contacts-empty-msg" class="recent-activities-empty text-sm text-[var(--text-medium)] px-4 py-6">No contacts yet.</p><ul id="account-contacts-list" class="hidden"></ul>';
            return;
        }
        const emptyMsg = document.getElementById('account-contacts-empty-msg');
        if (emptyMsg) emptyMsg.remove();
        contacts
            .sort((a, b) => (a.first_name || "").localeCompare(b.first_name || ""))
            .forEach((c) => {
                const inSeq = contact_sequences.some((cs) => cs.contact_id === c.id && cs.status === "Active");
                const emailIcon = c.email ? '<i class="fas fa-envelope contact-attribute-icon email-icon" title="Has email"></i>' : '';
                const phoneIcon = c.phone ? '<i class="fas fa-phone contact-attribute-icon phone-icon" title="Has phone"></i>' : '';
                const sequenceIcon = inSeq ? '<span class="sequence-status-icon"><i class="fa-solid fa-paper-plane"></i></span>' : '';

                const li = document.createElement("li");
                li.className = "account-contact-item";
                li.innerHTML = `
                    <a href="contacts.html?contactId=${c.id}" class="account-contact-link" data-contact-id="${c.id}">
                        <div class="account-contact-info">
                            <div class="account-contact-name-row">
                                <span class="account-contact-name">${c.first_name} ${c.last_name}</span>
                                <div class="account-contact-icons">${emailIcon}${phoneIcon}${sequenceIcon}</div>
                            </div>
                            <small class="account-contact-title">${c.title || "No Title"}</small>
                        </div>
                    </a>
                `;
                listElement.appendChild(li);
            });
    };

    const ZOOM_CONTROLS_HTML = `<div class="org-chart-zoom-controls">
        <button type="button" id="org-chart-zoom-out-btn" class="org-chart-zoom-btn" title="Zoom out"><i class="fas fa-minus"></i></button>
        <button type="button" id="org-chart-zoom-in-btn" class="org-chart-zoom-btn" title="Zoom in"><i class="fas fa-plus"></i></button>
    </div>`;

    const renderOrgChart = (container = null) => {
        const target = container || contactOrgChartView;
        if (!target) return;

        const contacts = state.selectedAccountDetails?.contacts ?? [];
        const contactMap = new Map(contacts.map(c => [c.id, { ...c, children: [] }]));
        const tree = [];
        contactMap.forEach(contact => {
            if (contact.reports_to && contactMap.has(Number(contact.reports_to))) {
                contactMap.get(Number(contact.reports_to)).children.push(contact);
            } else {
                tree.push(contact);
            }
        });
        console.log("Org Chart Debug -> Contacts:", contacts.length, "Tree Nodes:", tree.length);

        const createNodeHtml = (contact) => {
            const sortedChildren = contact.children.sort((a, b) => (a.first_name || "").localeCompare(b.first_name || ""));
            let childrenHtml = '';
            if (sortedChildren && sortedChildren.length > 0) {
                childrenHtml = `<ul class="org-chart-children">
                    ${sortedChildren.map(child => createNodeHtml(child)).join('')}
                </ul>`;
            }
            return `<li class="org-chart-node">
                <div class="contact-card" draggable="true" data-contact-id="${contact.id}">
                    <div class="contact-card-name">${contact.first_name} ${contact.last_name}</div>
                    <div class="contact-card-title">${contact.title || 'N/A'}</div>
                </div>
                ${childrenHtml}
            </li>`;
        };

        const sortedTree = tree.sort((a, b) => (a.first_name || "").localeCompare(b.first_name || ""));
        if (sortedTree.length > 0) {
            const chartHtml = `<ul class="org-chart-root">
                ${sortedTree.map(topLevelNode => createNodeHtml(topLevelNode)).join('')}
            </ul>`;
            const viewportContent = `<div class="org-chart-viewport"><div class="org-chart-scalable">${chartHtml}</div></div>`;
            if (target === contactOrgChartView) {
                target.innerHTML = `<div class="org-chart-render-target">${viewportContent}</div>${ZOOM_CONTROLS_HTML}`;
            } else {
                target.innerHTML = viewportContent;
            }
            const viewport = target.querySelector('.org-chart-viewport');
            if (viewport) fitOrgChartInViewport(viewport);
        } else {
            const placeholder = `<p class="placeholder-text" style="text-align: center; padding: 2rem 0;">No contacts found. Start adding contacts to build your org chart.</p>`;
            if (target === contactOrgChartView) {
                target.innerHTML = `<div class="org-chart-render-target">${placeholder}</div>${ZOOM_CONTROLS_HTML}`;
            } else {
                target.innerHTML = placeholder;
            }
        }

        setupOrgChartDragDrop(target);
    };

    // --- FIXED: Population & Baller Panning ---
    function fitOrgChartInViewport(viewport, zoomFactor) {
        if (!viewport) return;
        const scalable = viewport.querySelector('.org-chart-scalable');
        if (!scalable) return;
        
        // Initialize persistent state
        if (zoomFactor !== undefined) viewport.dataset.zoomFactor = String(zoomFactor);
        if (!viewport.dataset.panX) viewport.dataset.panX = '0';
        if (!viewport.dataset.panY) viewport.dataset.panY = '0';

        const apply = () => {
            // Base scale for "V8" logic (0.7 is a good safe start)
            const baseScale = 0.7; 
            const zoom = parseFloat(viewport.dataset.zoomFactor || '1');
            const px = viewport.dataset.panX;
            const py = viewport.dataset.panY;

            // Force centering + manual pan + zoom
            scalable.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) scale(${baseScale * zoom})`;
        };

        // Force a render cycle wait
        requestAnimationFrame(() => requestAnimationFrame(apply));
        
        // Bind the click-to-drag repositioning
        setupOrgChartPanning(viewport, apply);
    }

    function setupOrgChartPanning(viewport, updateFn) {
        if (viewport._panInitialized) return;
        viewport._panInitialized = true;

        let isPanning = false;
        let startX, startY;

        viewport.addEventListener('mousedown', (e) => {
            // Prevent panning if clicking a contact card
            if (e.target.closest('.contact-card') || e.target.closest('button')) return;
            
            isPanning = true;
            viewport.style.cursor = 'grabbing';
            
            // Use the stored pan coordinates as the baseline
            startX = e.clientX - (parseInt(viewport.dataset.panX) || 0);
            startY = e.clientY - (parseInt(viewport.dataset.panY) || 0);
        });

        window.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            viewport.dataset.panX = String(e.clientX - startX);
            viewport.dataset.panY = String(e.clientY - startY);
            updateFn();
        });

        window.addEventListener('mouseup', () => {
            isPanning = false;
            viewport.style.cursor = 'grab';
        });
    }

    const setupOrgChartDragDrop = (container = null) => {
        const chartContainer = container || contactOrgChartView;
        if (!chartContainer) return;

        const isCircular = (targetId, draggedId) => {
            const contacts = state.selectedAccountDetails.contacts;
            const contactMap = new Map(contacts.map(c => [c.id, c]));

            let currentId = targetId;
            while (currentId) {
                if (currentId === draggedId) {
                    return true;
                }
                const currentContact = contactMap.get(currentId);
                currentId = currentContact && currentContact.reports_to ? Number(currentContact.reports_to) : null;
            }
            return false;
        };

        chartContainer.querySelectorAll('.contact-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                const targetCard = e.target.closest('.contact-card');
                if (!targetCard) return;
                
                draggedContactId = Number(targetCard.dataset.contactId);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', draggedContactId);
                setTimeout(() => targetCard.classList.add('dragging'), 0);
            });

            card.addEventListener('dragend', (e) => {
                const targetCard = e.target.closest('.contact-card');
                if (targetCard) targetCard.classList.remove('dragging');
                draggedContactId = null;
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                const targetCard = e.target.closest('.contact-card');
                if (targetCard && Number(targetCard.dataset.contactId) !== draggedContactId) {
                    e.dataTransfer.dropEffect = 'move';
                    targetCard.classList.add('drop-target');
                }
            });

            card.addEventListener('dragleave', (e) => {
                const targetCard = e.target.closest('.contact-card');
                if (targetCard) targetCard.classList.remove('drop-target');
            });

            card.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const targetCard = e.target.closest('.contact-card');
                if (!targetCard) return;

                const localDraggedContactId = draggedContactId;
                const targetContactId = Number(targetCard.dataset.contactId);

                targetCard.classList.remove('drop-target');

                if (localDraggedContactId && localDraggedContactId !== targetContactId) {
                    
                    if (isCircular(targetContactId, localDraggedContactId)) {
                        showModal("Invalid Move", "Cannot move a manager to report to one of their own subordinates.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                        return;
                    }

                    const { error } = await supabase.from('contacts')
                        .update({ reports_to: targetContactId })
                        .eq('id', localDraggedContactId); 

                    if (error) {
                        console.error("Error updating reporting structure:", error);
                        showModal("Error", `Could not update reporting structure: ${error.message}`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    } else {
                        state.selectedAccountDetails.contacts = state.selectedAccountDetails.contacts.map(contact =>
                            contact.id === localDraggedContactId
                                ? { ...contact, reports_to: targetContactId }
                                : contact
                        );
                        
                        refreshOrgChartViews();
                    }
                }
            });
        });

        chartContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            const targetCard = e.target.closest('.contact-card');
            if (!targetCard) {
                e.dataTransfer.dropEffect = 'move';
                chartContainer.classList.add('drop-target-background');
            }
        });
        
        chartContainer.addEventListener('dragleave', (e) => {
             if (e.target === chartContainer) {
                 chartContainer.classList.remove('drop-target-background');
             }
        });

        chartContainer.addEventListener('drop', async (e) => {
            e.preventDefault();
            chartContainer.classList.remove('drop-target-background');
            
            const localDraggedContactId = draggedContactId;

            const targetCard = e.target.closest('.contact-card');
            if (targetCard || !localDraggedContactId) {
                return;
            }

            const contact = state.selectedAccountDetails.contacts.find(c => c.id === localDraggedContactId);
            if (contact && contact.reports_to === null) {
                return;
            }
            
            const { error } = await supabase.from('contacts')
                .update({ reports_to: null })
                .eq('id', localDraggedContactId);
            
            if (error) {
                console.error("Error breaking reporting structure:", error);
                showModal("Error", `Could not update reporting structure: ${error.message}`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            } else {
                state.selectedAccountDetails.contacts = state.selectedAccountDetails.contacts.map(contact =>
                    contact.id === localDraggedContactId
                        ? { ...contact, reports_to: null }
                        : contact
                );
                
                refreshOrgChartViews();
            }
        });
    };

    const refreshOrgChartViews = () => {
        renderOrgChart();
        if (orgChartModalBackdrop && !orgChartModalBackdrop.classList.contains('hidden') && orgChartModalContent) {
            renderOrgChart(orgChartModalContent);
            setupOrgChartDragDrop(orgChartModalContent);
        }
    };


    // --- Deal Handlers ---
    async function handleCommitDeal(dealId, isCommitted) {
        if (dealId === 'new') {
            const deal = state.selectedAccountDetails.deals.find(d => d.id === 'new');
            if (deal) deal.is_committed = isCommitted;
            return;
        }
        const { error } = await supabase.from('deals').update({ is_committed: isCommitted }).eq('id', dealId);
        if (error) {
            const checkbox = document.querySelector(`.commit-deal-checkbox[data-deal-id="${dealId}"]`);
            if (checkbox) checkbox.checked = !isCommitted;
            showModal("Error", 'Error updating commit status: ' + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        } else {
            const dealMaster = state.deals.find(d => d.id === dealId);
            if (dealMaster) dealMaster.is_committed = isCommitted;
            const dealDetails = state.selectedAccountDetails.deals.find(d => d.id === dealId);
            if (dealDetails) dealDetails.is_committed = isCommitted;
        }
    }

    async function handleProductPillToggle(pillElement) {
        const dealIdRaw = pillElement.dataset.dealId;
        const dealId = dealIdRaw === "new" ? "new" : Number(dealIdRaw);
        const productName = pillElement.dataset.product;
        const deal = state.selectedAccountDetails.deals.find((d) => String(d.id) === String(dealId));
        if (!deal || !productName) return;

        const isActive = pillElement.classList.contains("active");
        let currentProducts = (deal.products || "").split(",").map((p) => p.trim()).filter((p) => p);

        if (isActive) {
            currentProducts = currentProducts.filter((p) => {
                const pLower = p.toLowerCase();
                const targetLower = productName.toLowerCase();
                if (targetLower === "pri/sip") return !pLower.includes("pri") && !pLower.includes("sip");
                if (targetLower === "sd-wan") return !pLower.includes("sdwan") && !pLower.includes("sd-wan");
                return pLower !== targetLower;
            });
        } else {
            currentProducts.push(productName);
        }

        const newProductsString = currentProducts.join(", ");
        deal.products = newProductsString;

        if (dealId === "new") {
            renderAccountDetails();
            return;
        }
        const { error } = await supabase.from("deals").update({ products: newProductsString }).eq("id", dealId);
        if (error) return;
        const dealMaster = state.deals.find((d) => d.id === dealId);
        if (dealMaster) dealMaster.products = newProductsString;
        renderAccountDetails();
    }

    async function saveAccountDealField(dealId, field, value) {
        const deal = state.selectedAccountDetails.deals.find((d) => d.id === dealId);
        if (!deal || dealId === 'new') return;

        let updateVal = value;
        if (field === 'mrc') updateVal = parseFloat(value) || 0;
        if (field === 'close_month') updateVal = value || null;
        if (field === 'name' && !String(value || '').trim()) {
            showModal("Error", "Deal name is required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        const { error } = await supabase.from('deals').update({ [field]: updateVal }).eq('id', dealId);
        if (error) {
            showModal("Error", "Error saving deal: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        const dealMaster = state.deals.find((d) => d.id === dealId);
        if (dealMaster) dealMaster[field] = updateVal;
        deal[field] = updateVal;
        renderAccountDetails();
    }

    function createAccountInlineCloseFan(options, currentVal, placeholder, onSelect) {
        const wrap = document.createElement('div');
        wrap.className = 'deal-card-stage-fan-wrap deal-card-close-fan';
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'deal-card-stage-trigger deal-card-close-fan-trigger';
        const currentLabel = options.find(o => o.value === currentVal)?.label || placeholder;
        trigger.innerHTML = `${currentLabel} <i class="fas fa-chevron-down deal-card-stage-chevron"></i>`;
        wrap.appendChild(trigger);
        const fan = document.createElement('div');
        fan.className = 'deal-card-stage-fan';
        options.forEach((opt, i) => {
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = 'deal-card-stage-pill deal-stage-default';
            pill.textContent = opt.label;
            pill.dataset.value = opt.value;
            pill.style.setProperty('--fan-i', `${i}`);
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                onSelect(opt.value, opt.label);
                trigger.innerHTML = `${opt.label} <i class="fas fa-chevron-down deal-card-stage-chevron"></i>`;
            });
            fan.appendChild(pill);
        });
        wrap.appendChild(fan);
        const closeFan = () => {
            wrap.classList.remove('open');
            document.removeEventListener('click', closeFan);
        };
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (wrap.classList.contains('open')) closeFan();
            else {
                wrap.classList.add('open');
                setTimeout(() => document.addEventListener('click', closeFan), 0);
            }
        });
        wrap.addEventListener('click', (e) => e.stopPropagation());
        fan.querySelectorAll('.deal-card-stage-pill').forEach((p) => p.addEventListener('click', () => closeFan()));
        return wrap;
    }

    function startAccountDealInlineEdit(card, el, dealId) {
        const field = el.dataset.field;
        const deal = state.selectedAccountDetails.deals.find((d) => d.id === dealId);
        if (!deal || !field || el.classList.contains('deal-card-editing')) return;

        if (field === 'stage') {
            const stages = (state.dealStages || []).sort((a, b) => a.sort_order - b.sort_order);
            const currentStage = deal.stage || '';
            const wrap = document.createElement('div');
            wrap.className = 'deal-card-stage-fan-wrap';
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.className = 'deal-card-stage-input';
            hiddenInput.dataset.field = 'stage';
            hiddenInput.value = currentStage;
            wrap.appendChild(hiddenInput);
            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = `deal-card-stage-trigger ${getDealStageColorClass(currentStage)}`;
            trigger.innerHTML = `${currentStage || 'Stage'} <i class="fas fa-chevron-down deal-card-stage-chevron"></i>`;
            wrap.appendChild(trigger);
            const fan = document.createElement('div');
            fan.className = 'deal-card-stage-fan';
            const total = stages.length;
            const spread = Math.min(120, Math.max(60, (total - 1) * 25));
            const startAngle = 90 + spread / 2;
            stages.forEach((s, i) => {
                const angle = total <= 1 ? 90 : startAngle - (spread * i) / (total - 1);
                const pill = document.createElement('button');
                pill.type = 'button';
                pill.className = `deal-card-stage-pill ${getDealStageColorClass(s.stage_name)}`;
                pill.textContent = s.stage_name;
                pill.dataset.stage = s.stage_name;
                pill.style.setProperty('--fan-angle', `${angle}deg`);
                pill.style.setProperty('--fan-i', `${i}`);
                pill.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const val = s.stage_name;
                    hiddenInput.value = val;
                    closeFan();
                    await saveAccountDealField(dealId, 'stage', val);
                    const span = document.createElement('span');
                    span.className = 'deal-card-stage deal-card-editable';
                    span.dataset.field = 'stage';
                    span.textContent = val;
                    wrap.replaceWith(span);
                    card.className = card.className.replace(/\bdeal-stage-\w+/g, '').trim();
                    card.classList.add(getDealStageColorClass(val));
                });
                fan.appendChild(pill);
            });
            wrap.appendChild(fan);
            const closeFan = () => {
                wrap.classList.remove('open');
                document.removeEventListener('click', closeFan);
            };
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                if (wrap.classList.contains('open')) closeFan();
                else {
                    wrap.classList.add('open');
                    setTimeout(() => document.addEventListener('click', closeFan), 0);
                }
            });
            wrap.addEventListener('click', (e) => e.stopPropagation());
            fan.querySelectorAll('.deal-card-stage-pill').forEach((p) => p.addEventListener('click', () => closeFan()));
            el.replaceWith(wrap);
            return;
        }

        if (field === 'close_month') {
            const closeMonthStr = (deal.close_month || '').toString();
            const [year, month] = closeMonthStr.split('-');
            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const monthOptions = monthNames.map((m, i) => ({ value: String(i + 1).padStart(2, '0'), label: m }));
            const currentYear = new Date().getFullYear();
            const yearOptions = [currentYear, currentYear + 1, currentYear + 2].map(y => ({ value: String(y), label: String(y) }));
            let selectedMonth = month || '';
            let selectedYear = year || '';
            const closeWrap = document.createElement('div');
            closeWrap.className = 'deal-card-close-picker';
            const hiddenClose = document.createElement('input');
            hiddenClose.type = 'hidden';
            hiddenClose.className = 'deal-card-close-input';
            hiddenClose.dataset.field = 'close_month';
            hiddenClose.value = deal.close_month || '';
            const syncHidden = () => {
                hiddenClose.value = (selectedYear && selectedMonth) ? `${selectedYear}-${selectedMonth}` : '';
            };
            const monthFan = createAccountInlineCloseFan(monthOptions, month, 'Mo', (val) => {
                selectedMonth = val;
                syncHidden();
            });
            monthFan.classList.add('deal-card-close-month-fan');
            const yearFan = createAccountInlineCloseFan(yearOptions, year, 'Yr', (val) => {
                selectedYear = val;
                syncHidden();
            });
            yearFan.classList.add('deal-card-close-year-fan');
            closeWrap.appendChild(monthFan);
            closeWrap.appendChild(yearFan);
            closeWrap.appendChild(hiddenClose);
            const onClose = async () => {
                document.removeEventListener('click', onClose);
                const val = hiddenClose.value || null;
                await saveAccountDealField(dealId, 'close_month', val);
                const span = document.createElement('span');
                span.className = val ? 'deal-card-close deal-card-editable' : 'deal-card-close deal-card-empty deal-card-editable';
                span.dataset.field = 'close_month';
                span.textContent = val ? formatMonthYear(val) : '-';
                closeWrap.replaceWith(span);
            };
            const openHandler = (e) => {
                if (!closeWrap.contains(e.target)) onClose();
            };
            setTimeout(() => document.addEventListener('click', openHandler), 0);
            el.replaceWith(closeWrap);
            return;
        }

        if (field === 'term') {
            const termOptions = [
                { value: '12', label: '12' },
                { value: '24', label: '24' },
                { value: '36', label: '36' },
                { value: '48', label: '48' },
                { value: '60', label: '60' }
            ];
            const termValue = (deal.term || '').replace(/\D/g, '') || '';
            const termFan = createAccountInlineCloseFan(termOptions, termValue, 'Term', async (val) => {
                await saveAccountDealField(dealId, 'term', val);
                const span = document.createElement('span');
                span.className = val ? 'deal-card-term deal-card-editable' : 'deal-card-term deal-card-empty deal-card-editable';
                span.dataset.field = 'term';
                span.textContent = val ? `Term: ${val}` : 'Term';
                termWrap.replaceWith(span);
            });
            termFan.classList.add('deal-card-close-term-fan');
            const termWrap = document.createElement('div');
            termWrap.className = 'deal-card-term-fan-wrap';
            termWrap.appendChild(termFan);
            el.replaceWith(termWrap);
            return;
        }

        let input;
        if (field === 'mrc') {
            input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.step = '0.01';
            input.value = deal.mrc || 0;
            input.className = 'deal-card-inline-input';
        } else if (field === 'name') {
            input = document.createElement('input');
            input.type = 'text';
            input.value = deal.name || '';
            input.className = 'deal-card-inline-input';
        } else {
            return;
        }

        el.classList.add('deal-card-editing');
        const originalHtml = el.innerHTML;
        el.textContent = '';
        el.appendChild(input);
        input.focus();

        const restoreDisplay = (value) => {
            el.classList.remove('deal-card-editing');
            el.textContent = '';
            if (field === 'mrc') {
                el.textContent = `$${typeof value === 'number' ? value : (parseFloat(value) || 0)}/mo`;
            } else if (field === 'name') {
                const safe = (value || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                el.textContent = safe.length > 30 ? safe.substring(0, 30) + '...' : safe;
                el.title = value || '';
            }
        };

        const save = async () => {
            let value;
            if (field === 'mrc') value = parseFloat(input.value) || 0;
            else if (field === 'name') value = input.value.trim();
            else value = input.value || '';

            if (field === 'name' && !value) {
                el.classList.remove('deal-card-editing');
                el.innerHTML = originalHtml;
                showModal("Error", "Deal name is required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                return;
            }
            restoreDisplay(value);
            await saveAccountDealField(dealId, field, value);
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') {
                evt.preventDefault();
                input.blur();
            }
            if (evt.key === 'Escape') {
                evt.preventDefault();
                el.classList.remove('deal-card-editing');
                el.innerHTML = originalHtml;
            }
        });
    }

    function enterNotesEditMode(card, dealId, currentNotes) {
        if (dealId === 'new') return;
        const backContent = card.querySelector(".deal-card-back-content");
        const backBody = card.querySelector(".deal-card-back-body");
        const backEditBtn = card.querySelector(".deal-card-back-edit");
        if (!backContent || !backBody || !backEditBtn) return;
        card.classList.add("deal-card-notes-editing");
        backBody.dataset.originalNotes = currentNotes;
        const textarea = document.createElement("textarea");
        textarea.className = "deal-card-notes-textarea";
        textarea.value = currentNotes;
        textarea.rows = 4;
        backBody.innerHTML = "";
        backBody.appendChild(textarea);
        const wrap = document.createElement("div");
        wrap.className = "deal-card-notes-edit-actions";
        wrap.innerHTML = `<button type="button" class="btn-icon btn-icon-sm deal-card-notes-cancel" title="Cancel"><i class="fas fa-times"></i></button><button type="button" class="btn-icon btn-icon-sm deal-card-notes-save" title="Save notes"><i class="fas fa-check"></i></button>`;
        backEditBtn.replaceWith(wrap);
        const saveBtn = wrap.querySelector(".deal-card-notes-save");
        const cancelBtn = wrap.querySelector(".deal-card-notes-cancel");
        const exitNotesEdit = () => {
            card.classList.remove("deal-card-notes-editing");
            const orig = backBody.dataset.originalNotes || "";
            const escaped = orig.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br>");
            backBody.removeAttribute("data-original-notes");
            backBody.innerHTML = escaped || '<span class="text-[var(--text-muted)]">No notes</span>';
            const newEditBtn = document.createElement("button");
            newEditBtn.type = "button";
            newEditBtn.className = "btn-icon btn-icon-sm deal-card-back-edit";
            newEditBtn.dataset.dealId = dealId;
            newEditBtn.title = "Edit notes";
            newEditBtn.innerHTML = "<i class=\"fas fa-pen\"></i>";
            wrap.replaceWith(newEditBtn);
        };
        saveBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const value = textarea.value.trim();
            const notesUpdatedLast = new Date().toISOString().slice(0, 10);
            let payload = { notes: value, notes_last_updated: notesUpdatedLast };
            let { error } = await supabase.from("deals").update(payload).eq("id", dealId);
            if (error) {
                const msg = (error.message || "").toLowerCase();
                if (msg.includes("notes_last_updated") || msg.includes("column") || error.code === "22P02") {
                    payload = { notes: value };
                    const retry = await supabase.from("deals").update(payload).eq("id", dealId);
                    if (retry.error) {
                        return;
                    }
                } else {
                    return;
                }
            }
            const deal = state.deals.find(d => d.id === dealId);
            if (deal) {
                deal.notes = value;
                deal.notes_last_updated = notesUpdatedLast;
            }
            const dealDetails = state.selectedAccountDetails.deals.find(d => d.id === dealId);
            if (dealDetails) {
                dealDetails.notes = value;
                dealDetails.notes_last_updated = notesUpdatedLast;
            }
            backBody.dataset.originalNotes = value;
            exitNotesEdit();
            const updatedDeal = deal || dealDetails || { notes: value, notes_last_updated: notesUpdatedLast };
            const newStatus = getDealNotesStatus(updatedDeal);
            const dot = card.querySelector(".deal-card-notes-dot");
            if (dot) {
                dot.className = `deal-card-notes-dot deal-card-notes-dot--${newStatus.status}`;
                dot.title = newStatus.label;
            }
            const updatedEl = card.querySelector(".deal-card-notes-updated");
            if (updatedEl) updatedEl.textContent = `Updated ${formatSimpleDate(notesUpdatedLast)}`;
        });
        cancelBtn.addEventListener("click", (e) => { e.stopPropagation(); exitNotesEdit(); });
    }

    function enterDealFocusMode(focusedElement) {
        if (!focusedElement) return;
        let backdrop = document.getElementById('deal-focus-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'deal-focus-backdrop';
            backdrop.className = 'deal-focus-backdrop';
            const main = document.querySelector('main');
            if (main) main.appendChild(backdrop);
        }
        focusedElement.classList.add('deal-card-focus-mode');
    }
    function exitDealFocusMode() {
        document.querySelectorAll('.deal-card-focus-mode').forEach(el => el.classList.remove('deal-card-focus-mode'));
        document.getElementById('deal-focus-backdrop')?.remove();
    }

    function enterDealEditMode(dealId) {
        const deal = state.selectedAccountDetails.deals.find(d => d.id === dealId);
        if (!deal) return;
        const card = accountDealsCards?.querySelector(`.deal-card[data-deal-id="${dealId}"]`);
        if (!card) return;
        if (card.classList.contains('deal-card-editing')) return;

        card.classList.add('deal-card-editing');
        enterDealFocusMode(card);

        const valueEl = card.querySelector('.deal-card-value');
        if (valueEl) {
            valueEl.textContent = '';
            valueEl.appendChild(document.createTextNode('$'));
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'deal-card-inline-input deal-card-value-input';
            input.dataset.field = 'mrc';
            input.value = deal.mrc || 0;
            input.min = 0;
            input.step = 0.01;
            input.placeholder = '0';
            valueEl.appendChild(input);
            valueEl.appendChild(document.createTextNode('/mo'));
        }

        const nameEl = card.querySelector('.deal-card-name');
        if (nameEl) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'deal-card-inline-input deal-card-name-input';
            input.dataset.field = 'name';
            input.value = deal.name || '';
            input.placeholder = 'Deal name';
            nameEl.textContent = '';
            nameEl.appendChild(input);
        }

        const stageEl = card.querySelector('.deal-card-stage');
        if (stageEl) {
            const stages = state.dealStages.sort((a, b) => a.sort_order - b.sort_order);
            const currentStage = deal.stage || '';
            const wrap = document.createElement('div');
            wrap.className = 'deal-card-stage-fan-wrap';
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.className = 'deal-card-stage-input';
            hiddenInput.dataset.field = 'stage';
            hiddenInput.value = currentStage;
            wrap.appendChild(hiddenInput);

            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = `deal-card-stage-trigger ${getDealStageColorClass(currentStage)}`;
            trigger.textContent = currentStage || 'Stage';
            trigger.innerHTML = `${currentStage || 'Stage'} <i class="fas fa-chevron-down deal-card-stage-chevron"></i>`;
            wrap.appendChild(trigger);

            const fan = document.createElement('div');
            fan.className = 'deal-card-stage-fan';
            const total = stages.length;
            const spread = Math.min(120, Math.max(60, (total - 1) * 25));
            const startAngle = 90 + spread / 2;
            stages.forEach((s, i) => {
                const angle = total <= 1 ? 90 : startAngle - (spread * i) / (total - 1);
                const pill = document.createElement('button');
                pill.type = 'button';
                pill.className = `deal-card-stage-pill ${getDealStageColorClass(s.stage_name)}`;
                pill.textContent = s.stage_name;
                pill.dataset.stage = s.stage_name;
                pill.style.setProperty('--fan-angle', `${angle}deg`);
                pill.style.setProperty('--fan-i', `${i}`);
                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hiddenInput.value = s.stage_name;
                    trigger.innerHTML = `${s.stage_name} <i class="fas fa-chevron-down deal-card-stage-chevron"></i>`;
                    trigger.className = `deal-card-stage-trigger ${getDealStageColorClass(s.stage_name)}`;
                });
                fan.appendChild(pill);
            });
            wrap.appendChild(fan);

            const closeFan = () => {
                wrap.classList.remove('open');
                document.removeEventListener('click', closeFan);
            };
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                if (wrap.classList.contains('open')) {
                    closeFan();
                } else {
                    wrap.classList.add('open');
                    setTimeout(() => document.addEventListener('click', closeFan), 0);
                }
            });
            wrap.addEventListener('click', (e) => e.stopPropagation());
            fan.querySelectorAll('.deal-card-stage-pill').forEach((p) => {
                p.addEventListener('click', () => closeFan());
            });
            stageEl.replaceWith(wrap);
        }

        const footerEl = card.querySelector('.deal-card-footer');
        if (footerEl) {
            const closeEl = footerEl.querySelector('.deal-card-close');
            const termEl = footerEl.querySelector('.deal-card-term');
            const closeWrap = document.createElement('div');
            closeWrap.className = 'deal-card-close-picker';
            const closeMonthStr = (deal.close_month || '').toString();
            const [year, month] = closeMonthStr.split('-');
            const hiddenClose = document.createElement('input');
            hiddenClose.type = 'hidden';
            hiddenClose.className = 'deal-card-close-input';
            hiddenClose.dataset.field = 'close_month';
            hiddenClose.value = deal.close_month || '';

            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const monthOptions = monthNames.map((m, i) => ({ value: String(i + 1).padStart(2, '0'), label: m }));
            const currentYear = new Date().getFullYear();
            const yearOptions = [currentYear, currentYear + 1, currentYear + 2].map(y => ({ value: String(y), label: String(y) }));

            let selectedMonth = month || '';
            let selectedYear = year || '';

            const createCloseFan = (options, currentVal, placeholder, onSelect) => {
                const wrap = document.createElement('div');
                wrap.className = 'deal-card-stage-fan-wrap deal-card-close-fan';
                const trigger = document.createElement('button');
                trigger.type = 'button';
                trigger.className = 'deal-card-stage-trigger deal-card-close-fan-trigger';
                const currentLabel = options.find(o => o.value === currentVal)?.label || placeholder;
                trigger.innerHTML = `${currentLabel} <i class="fas fa-chevron-down deal-card-stage-chevron"></i>`;
                wrap.appendChild(trigger);
                const fan = document.createElement('div');
                fan.className = 'deal-card-stage-fan';
                options.forEach((opt, i) => {
                    const pill = document.createElement('button');
                    pill.type = 'button';
                    pill.className = 'deal-card-stage-pill deal-stage-default';
                    pill.textContent = opt.label;
                    pill.dataset.value = opt.value;
                    pill.style.setProperty('--fan-i', `${i}`);
                    pill.addEventListener('click', (e) => {
                        e.stopPropagation();
                        onSelect(opt.value, opt.label);
                        trigger.innerHTML = `${opt.label} <i class="fas fa-chevron-down deal-card-stage-chevron"></i>`;
                    });
                    fan.appendChild(pill);
                });
                wrap.appendChild(fan);
                const closeFan = () => {
                    wrap.classList.remove('open');
                    document.removeEventListener('click', closeFan);
                };
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (wrap.classList.contains('open')) closeFan();
                    else {
                        wrap.classList.add('open');
                        setTimeout(() => document.addEventListener('click', closeFan), 0);
                    }
                });
                wrap.addEventListener('click', (e) => e.stopPropagation());
                fan.querySelectorAll('.deal-card-stage-pill').forEach((p) => p.addEventListener('click', () => closeFan()));
                return wrap;
            };

            const syncHidden = () => {
                hiddenClose.value = (selectedYear && selectedMonth) ? `${selectedYear}-${selectedMonth}` : '';
            };

            const monthFan = createCloseFan(monthOptions, month, 'Mo', (val) => {
                selectedMonth = val;
                syncHidden();
            });
            monthFan.classList.add('deal-card-close-month-fan');
            const yearFan = createCloseFan(yearOptions, year, 'Yr', (val) => {
                selectedYear = val;
                syncHidden();
            });
            yearFan.classList.add('deal-card-close-year-fan');

            closeWrap.appendChild(monthFan);
            closeWrap.appendChild(yearFan);
            closeWrap.appendChild(hiddenClose);
            if (closeEl) closeEl.replaceWith(closeWrap);
            else footerEl.insertBefore(closeWrap, footerEl.firstChild);

            const termOptions = [
                { value: '12', label: '12' },
                { value: '24', label: '24' },
                { value: '36', label: '36' },
                { value: '48', label: '48' },
                { value: '60', label: '60' }
            ];
            const termValue = (deal.term || '').replace(/\D/g, '') || '';
            const termHidden = document.createElement('input');
            termHidden.type = 'hidden';
            termHidden.className = 'deal-card-term-input';
            termHidden.dataset.field = 'term';
            termHidden.value = deal.term || '';
            const termFan = createCloseFan(termOptions, termValue, 'Term', (val) => {
                termHidden.value = val;
            });
            termFan.classList.add('deal-card-close-term-fan');
            const termWrap = document.createElement('div');
            termWrap.className = 'deal-card-term-fan-wrap';
            termWrap.appendChild(termFan);
            termWrap.appendChild(termHidden);
            if (termEl) termEl.replaceWith(termWrap);
            else footerEl.appendChild(termWrap);
        }

        const productsEl = card.querySelector('.deal-card-products');
        if (productsEl) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.className = 'deal-card-products-input';
            input.dataset.field = 'products';
            input.value = deal.products || '';
            const wrapper = document.createElement('div');
            wrapper.className = 'deal-card-products';
            wrapper.innerHTML = getProductPillHtml(dealId, deal.products);
            wrapper.appendChild(input);
            productsEl.replaceWith(wrapper);
            wrapper.addEventListener('click', (e) => {
                const pill = e.target.closest('.product-pill-toggle');
                if (!pill) return;
                e.stopPropagation();
                const pid = pill.dataset.dealId === 'new' ? 'new' : Number(pill.dataset.dealId);
                const theDeal = state.selectedAccountDetails.deals.find((d) => String(d.id) === String(pid));
                if (!theDeal) return;
                const productName = pill.dataset.product;
                let currentProducts = (theDeal.products || '').split(',').map((p) => p.trim()).filter((p) => p);
                const isActive = pill.classList.contains('active');
                if (isActive) {
                    currentProducts = currentProducts.filter((p) => {
                        const pLower = p.toLowerCase();
                        const targetLower = productName.toLowerCase();
                        if (targetLower === 'pri/sip') return !pLower.includes('pri') && !pLower.includes('sip');
                        if (targetLower === 'sd-wan') return !pLower.includes('sdwan') && !pLower.includes('sd-wan');
                        return pLower !== targetLower;
                    });
                } else {
                    currentProducts.push(productName);
                }
                const newProductsString = currentProducts.join(', ');
                theDeal.products = newProductsString;
                input.value = newProductsString;
                wrapper.innerHTML = getProductPillHtml(dealId, theDeal.products);
                wrapper.appendChild(input);
            });
        }

        const editBtn = card.querySelector('.edit-deal-btn');
        if (editBtn) {
            editBtn.classList.remove('edit-deal-btn');
            editBtn.classList.add('deal-card-save-btn');
            editBtn.dataset.dealId = dealId;
            editBtn.title = 'Save';
            editBtn.innerHTML = '<i class="fas fa-check"></i>';
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn-icon btn-icon-sm deal-card-cancel-btn';
            cancelBtn.dataset.dealId = dealId;
            cancelBtn.title = 'Cancel';
            cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
            editBtn.parentNode.insertBefore(cancelBtn, editBtn);
        }
    }

    function exitDealEditMode(dealId, refresh = false) {
        exitDealFocusMode();
        if (refresh) {
            renderAccountDetails();
            return;
        }
        if (dealId === 'new') {
            state.selectedAccountDetails.deals = state.selectedAccountDetails.deals.filter(d => d.id !== 'new');
            renderAccountDetails();
            return;
        }
        const card = accountDealsCards?.querySelector(`.deal-card[data-deal-id="${dealId}"]`);
        if (!card) return;
        card.classList.remove('deal-card-editing');
        renderAccountDetails();
    }

    async function handleSaveDeal(dealId) {
        const card = accountDealsCards?.querySelector(`.deal-card[data-deal-id="${dealId}"]`);
        if (!card) return;
        const getVal = (field) => {
            const el = card.querySelector(`[data-field="${field}"]`);
            return el ? el.value.trim() : '';
        };
        const name = getVal('name');
        if (!name) return;
        const dealData = {
            name,
            term: getVal('term'),
            stage: getVal('stage'),
            mrc: parseFloat(getVal('mrc')) || 0,
            close_month: getVal('close_month') || null,
            products: getVal('products'),
            is_committed: false
        };
        if (dealId === 'new') {
            const newDeal = state.selectedAccountDetails.deals.find(d => d.id === 'new');
            const insertData = {
                ...dealData,
                is_committed: newDeal?.is_committed ?? false,
                user_id: getState().effectiveUserId,
                account_id: state.selectedAccountId
            };
            const { data: inserted, error } = await supabase.from('deals').insert([insertData]).select('id').single();
            if (error) return;
            exitDealFocusMode();
            state.selectedAccountDetails.deals = state.selectedAccountDetails.deals.filter(d => d.id !== 'new');
            await refreshData();
            renderAccountDetails();
        } else {
            const { error } = await supabase.from('deals').update(dealData).eq('id', dealId);
            if (error) return;
            const dealMaster = state.deals.find(d => d.id === dealId);
            if (dealMaster) Object.assign(dealMaster, dealData);
            const dealDetails = state.selectedAccountDetails.deals.find(d => d.id === dealId);
            if (dealDetails) Object.assign(dealDetails, dealData);
            exitDealEditMode(dealId, true);
        }
    }

    // MODIFIED: This function is now async to await the canvas generation
    async function handlePrintBriefing() {
        const accountName = state.selectedAccountDetails.account?.name;

        // 1. Find the modal's briefing container
        const briefingContainer = document.querySelector('.ai-briefing-container');
        if (!briefingContainer) {
            alert("Please generate a briefing first.");
            return;
        }

        // --- snapdom Logic ---
        
        // 2. Clone the container to work on it
        const printClone = briefingContainer.cloneNode(true);
        
        // 3. Find the org chart *placeholder* element *within the clone*
        const chartElement = printClone.querySelector('.org-chart-print-container');
        
        // 4. Find the *live* org chart *inner div* to "screenshot"
        const sourceChartElement = briefingContainer.querySelector('#org-chart-render-target'); // <-- ORG CHART FIX 1: Target new ID
        let originalStyle = null; // Store original style here

        if (chartElement && sourceChartElement && sourceChartElement.innerHTML.trim() !== "" && !sourceChartElement.querySelector('.placeholder-text')) {
            try {
                // --- ORG CHART FIX 2: Temporarily reset zoom for a clean screenshot ---
                originalStyle = sourceChartElement.getAttribute('style');
                // Force zoom: 1, add a background (which snapdom needs), and keep padding
                sourceChartElement.setAttribute('style', 'transform-origin: top left; zoom: 1; background: var(--bg-dark, #2d3748); padding: 10px;');
                
                // 5. "Screenshot" the live org chart element at high resolution using snapdom
                const result = await snapdom(sourceChartElement, {
                    backgroundColor: '#2d3748', // Explicitly set dark background
                    scale: 1.5 // Increase scale for better resolution
                });
                const canvas = await result.toCanvas();
                const imgDataUrl = canvas.toDataURL('image/png');
                
                // --- ORG CHART FIX 3: Restore original style to the live modal ---
                if (originalStyle) sourceChartElement.setAttribute('style', originalStyle);

                // 7. Create new, simple HTML for the image
                const orgChartImageHtml = `
                    <div class="briefing-section">
                            <img src="${imgDataUrl}" style="width: 100%; max-width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px;">
                    </div>
                `;
                
                // 8. *Replace* the complex HTML chart in our clone with the simple image
                chartElement.parentNode.replaceChild(
                    document.createRange().createContextualFragment(orgChartImageHtml),
                    chartElement
                );
                
            } catch (err) {
                console.error("snapdom failed:", err);
                // If it fails, restore original style
                if (sourceChartElement && originalStyle) {
                    sourceChartElement.setAttribute('style', originalStyle);
                }
            }
        }
        
        // 9. Get the *entire* inner HTML of our modified clone
        const briefingHtml = printClone.innerHTML;
        
        // --- End of snapdom Logic ---

        // 10. Create the iframe
        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'absolute';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);

        const frameDoc = printFrame.contentWindow.document;
        frameDoc.open();
        
        // 11. Write the new content to the iframe
        frameDoc.write(`
            <html>
                <head>
                    <title>AI Briefing: ${accountName || 'Account'}</title>
                    <link rel="stylesheet" href="css/style.css">
                    
                    <style>
                        @media print {

                            /* --- FONT FIX: Force sans-serif on all text elements --- */
                            body, p, li, h1, h2, h3, h4, h5, h6, strong, div {
                                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                                color: #2d3748 !important;
                            }

                            body {
                                margin: 20px;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            @page {
                                size: auto;
                                margin: 20px;
                            }

                            /* --- Report Header Block (Your style) --- */
                            .report-header {
                                background-color: #3b82f6 !important;
                                color: #ffffff !important;
                                padding: 20px;
                                border-radius: 8px;
                                margin-bottom: 25px;
                                page-break-inside: avoid;
                            }
                            .report-header h2, .report-header h3 {
                                color: #ffffff !important;
                                margin: 0;
                            }
                            .report-header h2 { font-size: 1.75rem; font-weight: 600; }
                            .report-header h3 { font-size: 1.25rem; font-weight: 400; opacity: 0.9; margin-top: 4px; }

                            /* --- Section Headers (h4) (Your style) --- */
                            h4 {
                                font-size: 1.1rem;
                                font-weight: 600;
                                color: #3b82f6 !important;
                                border-bottom: 2px solid #3b82f6 !important;
                                padding-bottom: 6px;
                                margin-top: 30px;
                                margin-bottom: 16px;
                            }
                            
                            /* --- BORDER FIX: Added !important --- */
                            .briefing-section {
                                background-color: #f9f9f9 !important;
                                page-break-inside: avoid !important;
                                border: 1px solid #eee !important;
                                padding: 16px !important;
                                border-radius: 8px !important;
                                margin-bottom: 16px !important;
                                font-size: 0.95rem;
                                line-height: 1.6;
                            }

                            /* --- AI Recommendation Box (Your style) --- */
                            .briefing-section.recommendation {
                                background-color: #eef5ff !important;
                                border-color: #b0cfff !important;
                            }

                            /* --- BORDER/FONT FIX: Added !important --- */
                            div.briefing-pre {
                                background-color: #fff !important;
                                border: 1px solid #ddd !important;
                                white-space: pre-wrap !important;
                                word-wrap: break-word !important;
                                padding: 12px !important;
                                border-radius: 6px !important;
                                font-family: inherit !important; /* <-- Use the body's sans-serif font */
                                font-size: 0.9rem !important;
                            }
                            
                            /* --- This ensures our new canvas image looks good --- */
                            .briefing-section img {
                                width: 100%;
                                max-width: 100%;
                                height: auto;
                                border: 1px solid #ccc;
                                border-radius: 4px;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="report-header">
                        <h2>AI Reconnaissance Report</h2>
                        <h3>${accountName || 'Selected Account'}</h3>
                    </div>
                    
                    <div class="ai-briefing-container">${briefingHtml}</div>
                
                </body>
            </html>
        `);
        frameDoc.close();

        const originalTitle = document.title;
        document.title = `AI Briefing: ${accountName || 'Account'}`;

        setTimeout(() => {
            try {
                printFrame.contentWindow.focus();
                printFrame.contentWindow.print();
            } catch (e) {
                console.error("Print failed:", e);
                alert("Could not open print dialog. Please check your browser's popup settings.");
            } finally {
                if (document.body.contains(printFrame)) {
                    document.body.removeChild(printFrame);
                }
                document.title = originalTitle;
            }
        }, 250); // This timeout helps the iframe's content render
    }

    const SALESFORCE_ACCOUNT_BASE = "https://gpcom.lightning.force.com/lightning/r/Account";
    const ZOOMINFO_COMPANY_BASE = "https://app.zoominfo.com/#/apps/profile/company";

    function handleOpenZoomInfo() {
        if (!state.selectedAccountId) {
            showModal("Error", "Please select an account first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }
        const account = state.selectedAccountDetails.account;
        if (!account) return;
        const companyId = (account.zoominfo_company_id || "").trim();
        if (companyId) {
            window.open(`${ZOOMINFO_COMPANY_BASE}/${encodeURIComponent(companyId)}`, "_blank");
            return;
        }
        showModal(
            "Zoom Info Company Id",
            `<p class="text-sm text-[var(--text-medium)] mb-2">No Zoom Info Company Id is stored for this account. Enter the Company Id to open the account in ZoomInfo.</p><label for="modal-zoominfo-company-id" class="block text-sm font-medium mb-1">Zoom Info Company Id</label><input type="text" id="modal-zoominfo-company-id" placeholder="e.g. 123456789" class="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg">`,
            async () => {
                const input = document.getElementById("modal-zoominfo-company-id");
                const value = (input?.value || "").trim();
                if (!value) {
                    showModal("Error", "Please enter a Zoom Info Company Id.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }
                window.open(`${ZOOMINFO_COMPANY_BASE}/${encodeURIComponent(value)}`, "_blank");
                const { error } = await supabase.from("accounts").update({ zoominfo_company_id: value }).eq("id", account.id);
                if (!error) {
                    state.selectedAccountDetails.account = { ...account, zoominfo_company_id: value };
                    const idx = state.accounts.findIndex(a => a.id === account.id);
                    if (idx !== -1) state.accounts[idx] = { ...state.accounts[idx], zoominfo_company_id: value };
                }
                const display = document.getElementById("zoominfo-locator-display");
                if (display) {
                    display.textContent = value || "Zoom Info Company Id";
                    display.classList.toggle("has-value", !!value);
                }
                hideModal();
            },
            true,
            `<button id="modal-confirm-btn" class="btn-primary">Open</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
        );
    }

    function handleOpenSalesforce() {
        if (!state.selectedAccountId) {
            showModal("Error", "Please select an account first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }
        const account = state.selectedAccountDetails.account;
        if (!account) return;
        const locator = (account.sf_account_locator || "").trim();
        if (locator) {
            window.open(`${SALESFORCE_ACCOUNT_BASE}/${encodeURIComponent(locator)}/view`, "_blank");
            return;
        }
        showModal(
            "Salesforce Account ID",
            `<p class="text-sm text-[var(--text-medium)] mb-2">No Salesforce Account ID is stored for this account. Enter the ID to open the account in Salesforce.</p><label for="modal-sf-account-locator" class="block text-sm font-medium mb-1">Salesforce Account ID</label><input type="text" id="modal-sf-account-locator" placeholder="e.g. 001XXXXXXXXXXXX" class="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg">`,
            async () => {
                const input = document.getElementById("modal-sf-account-locator");
                const value = (input?.value || "").trim();
                if (!value) {
                    showModal("Error", "Please enter a Salesforce Account ID.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }
                window.open(`${SALESFORCE_ACCOUNT_BASE}/${encodeURIComponent(value)}/view`, "_blank");
                const { error } = await supabase.from("accounts").update({ sf_account_locator: value }).eq("id", account.id);
                if (!error) {
                    state.selectedAccountDetails.account = { ...account, sf_account_locator: value };
                    const idx = state.accounts.findIndex(a => a.id === account.id);
                    if (idx !== -1) state.accounts[idx] = { ...state.accounts[idx], sf_account_locator: value };
                }
                hideModal();
            },
            true,
            `<button id="modal-confirm-btn" class="btn-primary">Open</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
        );
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
            let orgChartText = "No hierarchy defined.";
            if (contacts.length > 0) {
                const contactMap = new Map(contacts.map(c => [c.id, { ...c, children: [] }]));
                const tree = [];
                contactMap.forEach(contact => {
                    if (contact.reports_to && contactMap.has(Number(contact.reports_to))) {
                        contactMap.get(Number(contact.reports_to)).children.push(contact);
                    } else {
                        tree.push(contact);
                    }
                });
                
                const buildTextTree = (node, prefix = "") => {
                    let text = `${prefix}- ${node.first_name} ${node.last_name} (${node.title || 'N/A'})\n`;
                    node.children
                        .sort((a, b) => (a.first_name || "").localeCompare(b.first_name || ""))
                        .forEach(child => {
                            text += buildTextTree(child, prefix + "  ");
                        });
                    return text;
                };
                orgChartText = tree
                    .sort((a, b) => (a.first_name || "").localeCompare(b.first_name || ""))
                    .map(node => buildTextTree(node)).join('');
            }

            const internalData = {
                accountName: account.name,
                contacts: contacts.map(c => ({ name: `${c.first_name || ''} ${c.last_name || ''}`.trim(), title: c.title })),
                orgChart: orgChartText,
                deals: deals.map(d => ({ name: d.name, stage: d.stage, mrc: d.mrc, close_month: d.close_month })),
                activities: activities.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map(act => {
                    const contact = contacts.find(c => c.id === act.contact_id);
                    const contactName = contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 'Account-Level';
                    return `[${formatDate(act.date)}] ${act.type} with ${contactName}: ${act.description}`;
                }).join('\n')
            };

            const { data: briefing, error } = await supabase.functions.invoke('get-account-briefing', { body: { internalData } });
            if (error) throw error;

            const keyPlayersHtml = String(briefing.key_players || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            const icebreakersHtml = String(briefing.icebreakers || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

            let orgChartDisplayHtml = '';
            if (state.contactViewMode === 'org' && contactOrgChartView && contactOrgChartView.innerHTML.trim() !== "" && !contactOrgChartView.querySelector('.placeholder-text')) {
                const chartClone = contactOrgChartView.cloneNode(true);
                chartClone.querySelectorAll('[draggable="true"]').forEach(el => el.setAttribute('draggable', 'false'));
                chartClone.querySelectorAll('.org-chart-zoom-controls').forEach(el => el.remove());
                orgChartDisplayHtml = `
                    <h4><i class="fas fa-sitemap"></i> Org Chart</h4>
                    <div class="briefing-section org-chart-print-container"
                         style="
                            max-height: 300px;
                            overflow: hidden; /* We changed this from 'auto' */
                            border: 1px solid var(--border-color);
                            background: var(--bg-dark);
                            padding: 10px;
                            border-radius: 8px;
                         ">
                        <div id="org-chart-render-target" style="zoom: 0.75; transform-origin: top left;">
                            ${chartClone.innerHTML}
                        </div>
                    </div>`;
            } else if (contacts.length > 0) {
                orgChartDisplayHtml = `
                    <h4><i class="fas fa-users"></i> Key Players in CRM</h4>
                    <div class="briefing-section">
                        <p>${keyPlayersHtml}</p>
                    </div>`;
            }

            const briefingHtml = `
                <div class="ai-briefing-container">
                    <h4><i class="fas fa-database"></i> Internal Intelligence (What We Know)</h4>
                    <div class="briefing-section">
                        <p><strong>Relationship Summary:</strong> ${briefing.summary}</p>
                        ${orgChartDisplayHtml}
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
            let orgChartText = "No hierarchy defined.";
            if (contacts.length > 0) {
                const contactMap = new Map(contacts.map(c => [c.id, { ...c, children: [] }]));
                const tree = [];
                contactMap.forEach(contact => {
                    if (contact.reports_to && contactMap.has(Number(contact.reports_to))) {
                        contactMap.get(Number(contact.reports_to)).children.push(contact);
                    } else {
                        tree.push(contact);
                    }
                });
                
                const buildTextTree = (node, prefix = "") => {
                    let text = `${prefix}- ${node.first_name} ${node.last_name} (${node.title || 'N/A'})\n`;
                    node.children
                        .sort((a, b) => (a.first_name || "").localeCompare(b.first_name || ""))
                        .forEach(child => {
                            text += buildTextTree(child, prefix + "  ");
                        });
                    return text;
                };
                orgChartText = tree
                    .sort((a, b) => (a.first_name || "").localeCompare(b.first_name || ""))
                    .map(node => buildTextTree(node)).join('');
            }

            const internalData = {
                accountName: account.name,
                contacts: contacts.map(c => ({ name: `${c.first_name || ''} ${c.last_name || ''}`.trim(), title: c.title })),
                orgChart: orgChartText,
                deals: deals.map(d => ({ name: d.name, stage: d.stage, mrc: d.mrc, close_month: d.close_month })),
                activities: activities.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map(act => {
                    const contact = contacts.find(c => c.id === act.contact_id);
                    const contactName = contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 'Account-Level';
                    return `[${formatDate(act.date)}] ${act.type} with ${contactName}: ${act.description}`;
                }).join('\n')
            };

            const { data: briefing, error } = await supabase.functions.invoke('get-account-briefing', { body: { internalData } });
            if (error) throw error;

    // --- UPDATED GLOBAL PROCESSING ---
const summaryText = flattenAIResponse(briefing.summary);

const keyPlayersHtml = flattenAIResponse(briefing.key_players)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

const pipelineText = flattenAIResponse(briefing.pipeline);

const activityHighlightsHtml = flattenAIResponse(briefing.activity_highlights);

const newsText = flattenAIResponse(briefing.news);
const newContactsText = flattenAIResponse(briefing.new_contacts);

const icebreakersHtml = flattenAIResponse(briefing.icebreakers)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

const recommendationText = flattenAIResponse(briefing.recommendation);

            let orgChartDisplayHtml = '';

            // --- THIS IS THE FIX ---
            if (state.contactViewMode === 'org' && contactOrgChartView && contactOrgChartView.innerHTML.trim() !== "" && !contactOrgChartView.querySelector('.placeholder-text')) {
                
                // 1. Get the INNER HTML from the live chart
                const chartCloneHtml = contactOrgChartView.innerHTML;
                
                // 2. Get the INNER HTML from the unassigned container
                const unassignedContainer = document.getElementById("unassigned-contacts-container");
                let unassignedCloneHtml = '';
                if (unassignedContainer) {
                    unassignedCloneHtml = unassignedContainer.innerHTML;
                }
                
                // 3. Re-wrap the HTML in the IDs/classes that our CSS file needs
                orgChartDisplayHtml = `
                    <h4><i class="fas fa-sitemap"></i> Org Chart</h4>
                    <div class="briefing-section org-chart-print-container"
                         style="
                            max-height: 300px;
                            overflow: hidden;
                            border: 1px solid var(--border-color);
                            background: var(--bg-dark);
                            padding: 10px;
                            border-radius: 8px;
                       ">
                        <div id="org-chart-render-target" style="zoom: 0.75; transform-origin: top left;">
                            
                            <div id="contact-org-chart-view">
                                ${chartCloneHtml}
                            </div>
                            <div id="unassigned-contacts-container">
                                ${unassignedCloneHtml} 
                            </div>
                            
                        </div>
                    </div>`;
                // --- END OF FIX ---
                
            } else if (contacts.length > 0) {
                orgChartDisplayHtml = `
                    <h4><i class="fas fa-users"></i> Key Players in CRM</h4>
                    <div class="briefing-section">
                        <p>${keyPlayersHtml}</p>
                    </div>`;
            }

            const briefingHtml = `
                <div class="ai-briefing-container">
                    <h4><i class="fas fa-database"></i> Internal Intelligence (What We Know)</h4>
                    <div class="briefing-section">
                        <p><strong>Relationship Summary:</strong> ${briefing.summary}</p>
                        ${orgChartDisplayHtml}
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

        if (accountIndustrySelect && !tomSelectIndustry) {
            tomSelectIndustry = initTomSelect(accountIndustrySelect, {
                placeholder: '-- Select Industry --',
                searchField: ['text'],
                dropdownParent: 'body'
            });
        }

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
        if (accountFilterIcons) {
            accountFilterIcons.addEventListener("click", (e) => {
                const btn = e.target.closest(".account-filter-icon");
                if (btn) {
                    accountFilterIcons.querySelectorAll(".account-filter-icon").forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");
                    renderAccountList();
                }
            });
        }

        if (addAccountBtn) {
            addAccountBtn.addEventListener("click", () => {
                const openNewAccountModal = () => {
                    hideAccountDetails(true);
                    showModal("New Account", `<label>Account Name</label><input type="text" id="modal-account-name" required>`,
                        async () => {
                            const name = document.getElementById("modal-account-name")?.value.trim();
                            if (!name) {
                                showModal("Error", "Account name is required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                                return false;
                            }
                            const { data: newAccountArr, error } = await supabase.from("accounts").insert([{ name, user_id: getState().effectiveUserId }]).select();
                            if (error) {
                                showModal("Error", "Error creating account: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                                return false;
                            }
                            state.isFormDirty = false;
                            await refreshData();
                            state.selectedAccountId = newAccountArr?.[0]?.id;
                            renderAccountList();
                            await loadDetailsForSelectedAccount();
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

        if (accountDealsCards) {
            accountDealsCards.addEventListener('click', (e) => {
                const saveBtn = e.target.closest('.deal-card-save-btn');
                const cancelBtn = e.target.closest('.deal-card-cancel-btn');
                const commitToggle = e.target.closest('.deal-card-commit-toggle');
                const commitCheck = commitToggle?.querySelector('.commit-deal-checkbox') || e.target.closest('.commit-deal-checkbox');
                if (saveBtn) handleSaveDeal(saveBtn.dataset.dealId === 'new' ? 'new' : Number(saveBtn.dataset.dealId));
                if (cancelBtn) exitDealEditMode(cancelBtn.dataset.dealId === 'new' ? 'new' : Number(cancelBtn.dataset.dealId));
                if (commitCheck) {
                    handleCommitDeal(commitCheck.dataset.dealId === 'new' ? 'new' : Number(commitCheck.dataset.dealId), commitCheck.checked);
                }
            });
        }

        if (accountForm) {
            accountForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const id = Number(accountForm.querySelector("#account-id")?.value);
                if (!id) return;
                const industryValue = tomSelectIndustry ? (tomSelectIndustry.getValue() || "").trim() : (accountForm.querySelector("#account-industry")?.value || "").trim();
                const data = {
                    name: accountForm.querySelector("#account-name")?.value.trim(),
                    website: accountForm.querySelector("#account-website")?.value.trim(),
                    industry: industryValue,
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
                        hideAccountDetails(true);
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
                        const existingAccountMap = new Map(state.accounts.map(acc => [String(acc.name).trim().toLowerCase(), acc]));

                        csvRecords.forEach(record => {
                            if (!record.name) return;

                            const recordName = String(record.name).trim().toLowerCase();
                            const existingAccount = existingAccountMap.get(recordName);
                            globalState = getState(); // <-- ADD THIS
                            const processedRecord = {
                                name: String(record.name).trim(),
                                website: record.website || null,
                                industry: record.industry || null,
                                phone: record.phone || null,
                                address: record.address || null,
                                quantity_of_sites: (record.quantity_of_sites === 0) ? 0 : (parseInt(record.quantity_of_sites) || null),
                                employee_count: (record.employee_count === 0) ? 0 : (parseInt(record.employee_count) || null),
                                is_customer: record.is_customer === true,
                                user_id: getState().effectiveUserId
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
                                    const updateData = Object.keys(record.changes).reduce((acc, key) => {
                                        acc[key] = record.changes[key].new;
                                        return acc;
                                    }, {});
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
                const firstStage = state.dealStages.sort((a, b) => a.sort_order - b.sort_order)[0]?.stage_name || '';
                const newDeal = {
                    id: 'new',
                    user_id: getState().effectiveUserId,
                    account_id: state.selectedAccountId,
                    name: '',
                    term: '',
                    stage: firstStage,
                    mrc: 0,
                    close_month: null,
                    products: '',
                    is_committed: false
                };
                state.selectedAccountDetails.deals.unshift(newDeal);
                renderAccountDetails();
                const card = accountDealsCards?.querySelector('.deal-card[data-deal-id="new"]');
                if (card) enterDealEditMode('new');
            });
        }

        if (contactListView) {
            contactListView.addEventListener("click", (e) => {
                const targetLink = e.target.closest(".account-contact-link");
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
                            globalState = getState(); // <-- ADD THIS
                        const newTask = {
                            user_id: getState().effectiveUserId,
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
        if (zoominfoAccountBtn) {
            zoominfoAccountBtn.addEventListener("click", handleOpenZoomInfo);
        }
        if (salesforceAccountBtn) {
            salesforceAccountBtn.addEventListener("click", handleOpenSalesforce);
        }

        const sfLocatorEditBtn = document.getElementById("sf-locator-edit-btn");
        const sfLocatorInputEl = document.getElementById("sf-locator-input");
        const sfLocatorWrapEl = document.getElementById("sf-locator-inline-wrap");
        if (sfLocatorEditBtn && sfLocatorInputEl && sfLocatorWrapEl) {
            sfLocatorEditBtn.addEventListener("click", () => {
                if (!state.selectedAccountId || !state.selectedAccountDetails.account) return;
                sfLocatorInputEl.value = (state.selectedAccountDetails.account.sf_account_locator || "").trim();
                sfLocatorWrapEl.classList.add("edit-mode");
                sfLocatorInputEl.focus();
            });
            const commitSfLocatorEdit = async () => {
                const value = sfLocatorInputEl.value.trim();
                const account = state.selectedAccountDetails.account;
                if (!account) return;
                sfLocatorWrapEl.classList.remove("edit-mode");
                const { error } = await supabase.from("accounts").update({ sf_account_locator: value || null }).eq("id", account.id);
                if (!error) {
                    state.selectedAccountDetails.account = { ...account, sf_account_locator: value || null };
                    const idx = state.accounts.findIndex(a => a.id === account.id);
                    if (idx !== -1) state.accounts[idx] = { ...state.accounts[idx], sf_account_locator: value || null };
                }
                const display = document.getElementById("sf-locator-display");
                if (display) {
                    display.textContent = value || "Salesforce ID";
                    display.classList.toggle("has-value", !!value);
                }
            };
            sfLocatorInputEl.addEventListener("blur", commitSfLocatorEdit);
            sfLocatorInputEl.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    sfLocatorInputEl.blur();
                }
            });
        }
        const zoominfoLocatorEditBtn = document.getElementById("zoominfo-locator-edit-btn");
        const zoominfoLocatorInputEl = document.getElementById("zoominfo-locator-input");
        const zoominfoLocatorWrapEl = document.getElementById("zoominfo-locator-inline-wrap");
        if (zoominfoLocatorEditBtn && zoominfoLocatorInputEl && zoominfoLocatorWrapEl) {
            zoominfoLocatorEditBtn.addEventListener("click", () => {
                if (!state.selectedAccountId || !state.selectedAccountDetails.account) return;
                zoominfoLocatorInputEl.value = (state.selectedAccountDetails.account.zoominfo_company_id || "").trim();
                zoominfoLocatorWrapEl.classList.add("edit-mode");
                zoominfoLocatorInputEl.focus();
            });
            const commitZoominfoLocatorEdit = async () => {
                const value = zoominfoLocatorInputEl.value.trim();
                const account = state.selectedAccountDetails.account;
                if (!account) return;
                zoominfoLocatorWrapEl.classList.remove("edit-mode");
                const { error } = await supabase.from("accounts").update({ zoominfo_company_id: value || null }).eq("id", account.id);
                if (!error) {
                    state.selectedAccountDetails.account = { ...account, zoominfo_company_id: value || null };
                    const idx = state.accounts.findIndex(a => a.id === account.id);
                    if (idx !== -1) state.accounts[idx] = { ...state.accounts[idx], zoominfo_company_id: value || null };
                }
                const display = document.getElementById("zoominfo-locator-display");
                if (display) {
                    display.textContent = value || "Zoom Info Company Id";
                    display.classList.toggle("has-value", !!value);
                }
            };
            zoominfoLocatorInputEl.addEventListener("blur", commitZoominfoLocatorEdit);
            zoominfoLocatorInputEl.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    zoominfoLocatorInputEl.blur();
                }
            });
        }

        document.body.addEventListener('click', (e) => {
            if (e.target.id === 'print-briefing-btn') {
                handlePrintBriefing();
            }
        });

        if (contactListBtn) {
            contactListBtn.addEventListener('click', () => {
                state.contactViewMode = 'list';
                localStorage.setItem('contact_view_mode', 'list');
                renderContactView();
            });
        }
        if (contactOrgChartBtn) {
            contactOrgChartBtn.addEventListener('click', () => {
                state.contactViewMode = 'org';
                localStorage.setItem('contact_view_mode', 'org');
                renderContactView();
            });
        }
        if (contactOrgChartView) {
            contactOrgChartView.addEventListener('click', (e) => {
                const zoomOut = e.target.closest('#org-chart-zoom-out-btn');
                const zoomIn = e.target.closest('#org-chart-zoom-in-btn');
                const viewport = contactOrgChartView.querySelector('.org-chart-viewport');
                if (!viewport) return;
                if (zoomOut) {
                    const current = parseFloat(viewport.dataset.zoomFactor || '1');
                    fitOrgChartInViewport(viewport, Math.max(0.5, current - 0.25));
                } else if (zoomIn) {
                    const current = parseFloat(viewport.dataset.zoomFactor || '1');
                    fitOrgChartInViewport(viewport, Math.min(2, current + 0.25));
                }
            });
        }
        if (orgChartMaximizeBtn) {
            orgChartMaximizeBtn.addEventListener('click', () => {
                if (!orgChartModalBackdrop || !orgChartModalContent) return;
                orgChartModalBackdrop.classList.remove('hidden');
                renderOrgChart(orgChartModalContent);
                setupOrgChartDragDrop(orgChartModalContent);
                requestAnimationFrame(() => {
                    const modalViewport = orgChartModalContent.querySelector('.org-chart-viewport');
                    if (modalViewport) fitOrgChartInViewport(modalViewport);
                });
            });
        }
        if (orgChartModalCloseBtn && orgChartModalBackdrop) {
            orgChartModalCloseBtn.addEventListener('click', () => {
                orgChartModalBackdrop.classList.add('hidden');
            });
        }
        if (orgChartModalBackdrop) {
            orgChartModalBackdrop.addEventListener('click', (e) => {
                if (e.target === orgChartModalBackdrop) {
                    orgChartModalBackdrop.classList.add('hidden');
                }
            });
        }
    }
    async function initializePage() {
        await loadSVGs();
        const appState = await initializeAppState(supabase);
        if (!appState.currentUser) {
            hideGlobalLoader();
            return;
        }
        state.currentUser = appState.currentUser;

        try {
            await loadInitialData();

            const urlParams = new URLSearchParams(window.location.search);
            const accountIdFromUrl = urlParams.get('accountId');
            
            const savedView = localStorage.getItem('contact_view_mode') || 'list';
            state.contactViewMode = savedView;

            if (accountIdFromUrl) {
                state.selectedAccountId = Number(accountIdFromUrl);
                await loadDetailsForSelectedAccount();
            } else {
                hideAccountDetails(true);
            }
            
            await setupUserMenuAndAuth(supabase, getState());
            window.addEventListener('effectiveUserChanged', loadInitialData);
            
            // --- THIS IS THE FIX ---
            // Reverted to the "known working" call, as you pointed out.
            await setupGlobalSearch(supabase); 
            // --- END OF FIX ---

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
