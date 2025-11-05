import { SUPABASE_URL, SUPABASE_ANON_KEY, setupModalListeners, showModal, hideModal, setupUserMenuAndAuth, loadSVGs, setupGlobalSearch, checkAndSetNotifications } from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    // --- Supabase Client ---
    // The Supabase client is loaded from the shared constants.
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- State Management ---
    let state = {
        currentUser: null,
        activeSiteId: null,
        sites: [], // This will hold all site data objects
        currentProjectId: null, // ID of the saved project
        isDirty: false, // Tracks unsaved changes
    };

    // --- DOM Element Selectors ---
    const navSidebar = document.querySelector(".nav-sidebar");
    const projectNameInput = document.getElementById("project-name");
    const globalTargetIrrInput = document.getElementById("global-target-irr");
    const globalDecisionEl = document.getElementById("global-decision");
    const globalAnnualIRREl = document.getElementById("global-annual-irr");
    const globalTcvEl = document.getElementById("global-tcv");
    const globalErrorEl = document.getElementById("global-error-message");

    const siteTabsContainer = document.getElementById("site-tabs-container");
    const siteFormsContainer = document.getElementById("site-forms-container");
    const siteFormTemplate = document.getElementById("site-form-template");

    // Project Control Buttons
    const newProjectBtn = document.getElementById("new-project-btn");
    const saveProjectBtn = document.getElementById("save-project-btn");
    const loadProjectBtn = document.getElementById("load-project-btn");
    const addSiteBtn = document.getElementById("add-site-btn");
    const printReportBtn = document.getElementById("print-report-btn");
    const exportCsvBtn = document.getElementById("export-csv-btn");

    // Load Modal
    const loadProjectModal = document.getElementById("load-project-modal-backdrop");
    const loadProjectList = document.getElementById("load-project-list");
    const loadProjectModalCloseBtn = document.getElementById("load-project-modal-close-btn");

    // --- Core Logic ---

    /**
     * Resets the entire calculator to a fresh, new project state.
     */
    function initializeNewProject() {
        projectNameInput.value = "New Project";
        globalTargetIrrInput.value = "15";
        state.sites = [];
        state.currentProjectId = null;
        state.isDirty = false;
        siteTabsContainer.innerHTML = "";
        siteFormsContainer.innerHTML = "";
        
        addNewSite(true); // Add the first "Site 1"
        runGlobalCalculation();
        
        // This is now considered the "saved" state
        state.isDirty = false;
        updateSaveButtonState();
    }

    /**
     * Adds a new site tab and form to the page.
     * @param {boolean} [isFirstSite=false] - If true, won't show the delete button.
     */
    function addNewSite(isFirstSite = false) {
        const siteId = `site_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;
        const siteNumber = state.sites.length + 1;
        
        const newSiteData = {
            id: siteId,
            inputs: {
                siteName: `Site ${siteNumber}`,
                constructionCost: 100000,
                engineeringCost: 20000,
                nrr: 5000,
                mrr: 3000,
                monthlyCost: 500,
                term: 60,
            },
            results: {
                irr: 0,
                tcv: 0,
                decision: '...',
                isValid: false
            }
        };

        // Add to state
        state.sites.push(newSiteData);
        state.isDirty = true;

        // --- Create Tab ---
        const tab = document.createElement("button");
        tab.className = "irr-tab";
        tab.dataset.tabId = siteId;
        tab.innerHTML = `
            <span class="tab-site-name">${newSiteData.inputs.siteName}</span>
            <span class="irr-tab-results">--%</span>
        `;
        
        // Add delete button (but not for the very first site)
        if (!isFirstSite) {
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "delete-site-btn";
            deleteBtn.innerHTML = "&times;";
            deleteBtn.title = "Delete this site";
            tab.appendChild(deleteBtn);
        }

        siteTabsContainer.appendChild(tab);

        // --- Create Form ---
        const templateClone = siteFormTemplate.content.cloneNode(true);
        const formWrapper = templateClone.querySelector(".site-form-wrapper");
        formWrapper.dataset.siteId = siteId;

        // Set default values in the form
        const form = formWrapper.querySelector(".irr-form");
        form.querySelector(".site-name-input").value = newSiteData.inputs.siteName;
        form.querySelector(".construction-cost-input").value = newSiteData.inputs.constructionCost;
        form.querySelector(".engineering-cost-input").value = newSiteData.inputs.engineeringCost;
        form.querySelector(".nrr-input").value = newSiteData.inputs.nrr;
        form.querySelector(".mrr-input").value = newSiteData.inputs.mrr;
        form.querySelector(".monthly-cost-input").value = newSiteData.inputs.monthlyCost;
        form.querySelector(".term-input").value = newSiteData.inputs.term;

        // Hide delete button on form if it's the first site
        if (isFirstSite) {
            formWrapper.querySelector(".delete-site-btn").classList.add("hidden");
        }

        siteFormsContainer.appendChild(templateClone);

        // Activate the new tab
        setActiveTab(siteId);
        runSiteCalculation(siteId, false); // Run initial calc
        updateSaveButtonState();
    }

    /**
     * Sets the active tab and shows the corresponding form.
     * @param {string} siteId - The ID of the site to activate.
     */
    function setActiveTab(siteId) {
        state.activeSiteId = siteId;

        // Update tabs
        siteTabsContainer.querySelectorAll(".irr-tab").forEach(tab => {
            tab.classList.toggle("active", tab.dataset.tabId === siteId);
        });

        // Update forms
        siteFormsContainer.querySelectorAll(".site-form-wrapper").forEach(form => {
            form.classList.toggle("active", form.dataset.siteId === siteId);
        });
    }

    /**
     * Deletes a site from the state and the DOM.
     * @param {string} siteId - The ID of the site to delete.
     */
    function deleteSite(siteId) {
        // Prevent deleting the last site
        if (state.sites.length <= 1) {
            showModal("Cannot Delete", "You must have at least one site.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        // Find and remove from state
        state.sites = state.sites.filter(site => site.id !== siteId);
        state.isDirty = true;

        // Find and remove tab
        const tab = siteTabsContainer.querySelector(`.irr-tab[data-tab-id="${siteId}"]`);
        if (tab) tab.remove();

        // Find and remove form
        const form = siteFormsContainer.querySelector(`.site-form-wrapper[data-site-id="${siteId}"]`);
        if (form) form.remove();

        // If we deleted the active site, set a new active one
        if (state.activeSiteId === siteId) {
            setActiveTab(state.sites[0].id);
        }
        
        runGlobalCalculation();
        updateSaveButtonState();
    }

    /**
     * Runs the IRR and TCV calculation for a single site and updates its UI.
     * @param {string} siteId - The ID of the site to calculate.
     * @param {boolean} [runGlobal=true] - Whether to trigger a global recalculation.
     */
    function runSiteCalculation(siteId, runGlobal = true) {
        const site = state.sites.find(s => s.id === siteId);
        if (!site) return;

        const formWrapper = siteFormsContainer.querySelector(`.site-form-wrapper[data-site-id="${siteId}"]`);
        if (!formWrapper) return;
        
        const form = formWrapper.querySelector('.irr-form');
        const resultsContainer = formWrapper.querySelector('.individual-results-container');
        if (!form || !resultsContainer) return;

        // Find all UI elements for this site's results
        const decisionEl = resultsContainer.querySelector(".individual-decision");
        const irrEl = resultsContainer.querySelector(".individual-annual-irr");
        const tcvEl = resultsContainer.querySelector(".individual-tcv");
        const errorEl = resultsContainer.querySelector(".individual-error-message");

        // 1. Get Inputs from form
        const constCost = parseFloat(form.querySelector(".construction-cost-input").value) || 0;
        const engCost = parseFloat(form.querySelector(".engineering-cost-input").value) || 0;
        const nrr = parseFloat(form.querySelector(".nrr-input").value) || 0;
        const mrr = parseFloat(form.querySelector(".mrr-input").value) || 0;
        const monthlyCost = parseFloat(form.querySelector(".monthly-cost-input").value) || 0;
        const term = parseInt(form.querySelector(".term-input").value) || 0;
        const siteName = form.querySelector(".site-name-input").value.trim() || "Untitled Site";
        
        const globalTargetIRR = (parseFloat(globalTargetIrrInput.value) || 15) / 100;

        // 2. Store inputs in state
        site.inputs = { siteName, constCost, engCost, nrr, mrr, monthlyCost, term };
        
        // 3. Update Site Name in Tab
        const tab = siteTabsContainer.querySelector(`.irr-tab[data-tab-id="${siteId}"] .tab-site-name`);
        if (tab) tab.textContent = siteName;

        // 4. Validate Inputs
        if (term <= 0) {
            updateSiteUI(site, errorEl, irrEl, tcvEl, decisionEl, 0, 0, 'Term must be > 0');
            if (runGlobal) runGlobalCalculation();
            return;
        }

        const upfrontCost = constCost + engCost;
        const netUpfront = nrr - upfrontCost;
        const netMonthly = mrr - monthlyCost;

        if (netUpfront >= 0 && netMonthly >= 0) {
            updateSiteUI(site, errorEl, irrEl, tcvEl, decisionEl, Infinity, (mrr * term) + nrr, 'Infinite IRR', globalTargetIRR);
            if (runGlobal) runGlobalCalculation();
            return;
        }
        if (netUpfront <= 0 && netMonthly <= 0) {
            updateSiteUI(site, errorEl, irrEl, tcvEl, decisionEl, -1, (mrr * term) + nrr, 'Negative IRR', globalTargetIRR);
            if (runGlobal) runGlobalCalculation();
            return;
        }

        // 5. Build Cash Flow
        const cashFlows = [netUpfront];
        for (let i = 0; i < term; i++) {
            cashFlows.push(netMonthly);
        }

        // 6. Calculate IRR
        const monthlyIRR = calculateIRR(cashFlows);
        let annualIRR;

        if (monthlyIRR === null || !isFinite(monthlyIRR)) {
            annualIRR = 0; // Treat calculation errors as 0
        } else {
            annualIRR = Math.pow(1 + monthlyIRR, 12) - 1;
        }
        
        if (annualIRR > 500) annualIRR = Infinity; // Cap at 50000%
        if (annualIRR < -1) annualIRR = -1; // Floor at -100%

        // 7. Calculate TCV
        const tcv = (mrr * term) + nrr;

        // 8. Update UI
        updateSiteUI(site, errorEl, irrEl, tcvEl, decisionEl, annualIRR, tcv, null, globalTargetIRR);

        // 9. Update Global
        if (runGlobal) {
            runGlobalCalculation();
        }
        
        state.isDirty = true;
        updateSaveButtonState();
    }

    /**
     * Updates the UI elements for a single site's results.
     */
    function updateSiteUI(site, errorEl, irrEl, tcvEl, decisionEl, annualIRR, tcv, errorMessage, targetIRR) {
        // Find tab result element
        const tabResultEl = siteTabsContainer.querySelector(`.irr-tab[data-tab-id="${site.id}"] .irr-tab-results`);
        
        // --- Store Results in State ---
        site.results.irr = annualIRR;
        site.results.tcv = tcv;
        site.results.isValid = !errorMessage;

        if (errorMessage) {
            errorEl.textContent = errorMessage;
            errorEl.classList.remove("hidden");
            irrEl.textContent = "--%";
            tcvEl.textContent = "$0.00";
            decisionEl.textContent = "Error";
            decisionEl.className = "individual-decision error";
            if (tabResultEl) {
                tabResultEl.textContent = "Error";
                tabResultEl.className = "irr-tab-results error";
            }
            site.results.decision = 'Error';
            return;
        }

        errorEl.classList.add("hidden");

        // Format and display TCV
        tcvEl.textContent = formatCurrency(tcv);

        // Format and display IRR
        let irrText, tabIrrText;
        if (annualIRR === Infinity) {
            irrText = "Infinite";
            tabIrrText = "Inf%";
        } else if (annualIRR === -1) {
            irrText = "-100.00%";
            tabIrrText = "-100%";
        } else {
            irrText = (annualIRR * 100).toFixed(2) + "%";
            tabIrrText = (annualIRR * 100).toFixed(1) + "%";
        }
        irrEl.textContent = irrText;
        if (tabResultEl) tabResultEl.textContent = tabIrrText;


        // Make decision
        const isGo = annualIRR >= targetIRR;
        const decision = isGo ? "GO" : "NO GO";
        site.results.decision = decision;

        decisionEl.textContent = decision;
        decisionEl.className = isGo ? "individual-decision go" : "individual-decision nogo";
        
        if(tabResultEl) {
            tabResultEl.className = isGo ? "irr-tab-results go" : "irr-tab-results nogo";
        }
    }


    /**
     * Calculates IRR using the Newton-Raphson method.
     * @param {number[]} cashFlows - Array of cash flows, starting with index 0.
     * @returns {number|null} The monthly internal rate of return, or null if not found.
     */
    function calculateIRR(cashFlows) {
        const maxIterations = 1000;
        const tolerance = 1e-6;
        let guess = 0.1; // 10%

        for (let i = 0; i < maxIterations; i++) {
            let npv = 0;
            let dNpv = 0; // Derivative of NPV

            for (let t = 0; t < cashFlows.length; t++) {
                npv += cashFlows[t] / Math.pow(1 + guess, t);
                dNpv -= t * cashFlows[t] / Math.pow(1 + guess, t + 1);
            }

            const newGuess = guess - npv / dNpv;

            if (Math.abs(newGuess - guess) < tolerance) {
                return newGuess;
            }
            guess = newGuess;
        }
        return null; // Failed to converge
    }

    /**
     * Runs the calculation for the entire project (all sites combined).
     */
    function runGlobalCalculation() {
        const totalSites = state.sites.length;
        if (totalSites === 0) {
            updateGlobalUI(0, 0, "Add a site to begin", 0);
            return;
        }

        let maxTerm = 0;
        let globalTCV = 0;
        let allValid = true;

        state.sites.forEach(site => {
            if (site.inputs.term > maxTerm) {
                maxTerm = site.inputs.term;
            }
            globalTCV += site.results.tcv;
            if (!site.results.isValid) {
                allValid = false;
            }
        });

        if (!allValid) {
            updateGlobalUI(0, globalTCV, "One or more sites have errors", 0);
            return;
        }

        if (maxTerm === 0) {
            updateGlobalUI(0, globalTCV, "Project term must be > 0", 0);
            return;
        }

        // Create a combined cash flow array
        const globalCashFlows = new Array(maxTerm + 1).fill(0);

        state.sites.forEach(site => {
            // Add upfront
            globalCashFlows[0] += (site.inputs.nrr - (site.inputs.constCost + site.inputs.engCost));
            
            // Add monthly
            const netMonthly = site.inputs.mrr - site.inputs.monthlyCost;
            for (let t = 1; t <= site.inputs.term; t++) {
                globalCashFlows[t] += netMonthly;
            }
        });

        // Check for edge cases
        const netUpfront = globalCashFlows[0];
        const netMonthlyTotal = globalCashFlows.slice(1).reduce((a, b) => a + b, 0); // Simplified check

        if (netUpfront >= 0 && netMonthlyTotal >= 0) {
            updateGlobalUI(Infinity, globalTCV, null, parseFloat(globalTargetIrrInput.value) / 100);
            return;
        }
        if (netUpfront <= 0 && netMonthlyTotal <= 0 && (netUpfront !== 0 || netMonthlyTotal !== 0)) {
            updateGlobalUI(-1, globalTCV, null, parseFloat(globalTargetIrrInput.value) / 100);
            return;
        }

        // Calculate Global IRR
        const globalMonthlyIRR = calculateIRR(globalCashFlows);
        let globalAnnualIRR;

        if (globalMonthlyIRR === null || !isFinite(globalMonthlyIRR)) {
            globalAnnualIRR = 0;
        } else {
            globalAnnualIRR = Math.pow(1 + globalMonthlyIRR, 12) - 1;
        }
        
        if (globalAnnualIRR > 500) globalAnnualIRR = Infinity;
        if (globalAnnualIRR < -1) globalAnnualIRR = -1;

        updateGlobalUI(globalAnnualIRR, globalTCV, null, parseFloat(globalTargetIrrInput.value) / 100);
    }

    /**
     * Updates the UI elements for the global results section.
     */
    function updateGlobalUI(annualIRR, tcv, errorMessage, targetIRR) {
        if (errorMessage) {
            globalErrorEl.textContent = errorMessage;
            globalErrorEl.classList.remove("hidden");
            globalAnnualIRREl.textContent = "--%";
            globalTcvEl.textContent = "$0.00";
            globalDecisionEl.textContent = "Error";
            globalDecisionEl.className = "nogo";
            return;
        }

        globalErrorEl.classList.add("hidden");

        // Format and display TCV
        globalTcvEl.textContent = formatCurrency(tcv);

        // Format and display IRR
        let irrText;
        if (annualIRR === Infinity) {
            irrText = "Infinite";
        } else if (annualIRR === -1) {
            irrText = "-100.00%";
        } else {
            irrText = (annualIRR * 100).toFixed(2) + "%";
        }
        globalAnnualIRREl.textContent = irrText;

        // Make decision
        const isGo = annualIRR >= targetIRR;
        const decision = isGo ? "GO" : "NO GO";
        globalDecisionEl.textContent = decision;
        globalDecisionEl.className = isGo ? "go" : "nogo";
    }

    /**
     * Generates a clean, printable report in a new window.
     */
    function handlePrintReport() {
        const projectName = projectNameInput.value.trim() || "IRR Project";
        const globalTargetIRR = (parseFloat(globalTargetIrrInput.value) || 15);

        let sitesHtml = "";
        state.sites.forEach(site => {
            const { inputs, results } = site;
            sitesHtml += `
                <tr>
                    <td>${escapeHTML(inputs.siteName)}</td>
                    <td>${formatCurrency(results.tcv)}</td>
                    <td>${formatCurrency(inputs.constCost)}</td>
                    <td>${formatCurrency(inputs.engCost)}</td>
                    <td>${formatCurrency(inputs.nrr)}</td>
                    <td>${formatCurrency(inputs.mrr)}</td>
                    <td>${inputs.term}</td>
                    <td>${(results.irr * 100).toFixed(2)}%</td>
                    <td class="${results.decision === 'GO' ? 'go' : 'nogo'}">${results.decision}</td>
                </tr>
            `;
        });

        const reportHtml = `
            <html>
            <head>
                <title>IRR Report: ${escapeHTML(projectName)}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 2rem; color: #333; }
                    h1 { color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
                    h2 { color: #111; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 2rem; }
                    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background-color: #f9f9f9; }
                    tr:nth-child(even) { background-color: #fcfcfc; }
                    .global-results { background-color: #f4f8ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; }
                    .global-results h2 { margin-top: 0; }
                    .global-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
                    .global-grid div { text-align: center; }
                    .global-grid .decision { font-size: 2.5rem; font-weight: 700; }
                    .global-grid .irr { font-size: 2rem; font-weight: 600; color: #3b82f6; }
                    .global-grid .tcv { font-size: 2rem; font-weight: 600; }
                    .go { color: #16a34a; font-weight: 700; }
                    .nogo { color: #dc2626; font-weight: 700; }
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        h1, h2 { page-break-after: avoid; }
                        table { page-break-inside: auto; }
                        tr { page-break-inside: avoid; page-break-after: auto; }
                        .global-results { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <h1>IRR Project Report: ${escapeHTML(projectName)}</h1>
                
                <div class="global-results">
                    <h2>Global Project Results (All Sites)</h2>
                    <div class="global-grid">
                        <div>
                            <div class="decision ${globalDecisionEl.className}">${globalDecisionEl.textContent}</div>
                            <div>Global Decision</div>
                        </div>
                        <div>
                            <div class="irr">${globalAnnualIRREl.textContent}</div>
                            <div>Calculated Global Annual IRR</div>
                        </div>
                        <div>
                            <div class="tcv">${globalTcvEl.textContent}</div>
                            <div>Global TCV ($)</div>
                        </div>
                    </div>
                    <p style="text-align: center; margin-top: 1.5rem; font-size: 1.1rem; font-weight: 500;">
                        Global Target IRR: ${globalTargetIRR.toFixed(2)}%
                    </p>
                </div>
                
                <h2>Site Summary</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Site Name</th>
                            <th>TCV ($)</th>
                            <th>Construction ($)</th>
                            <th>Eng. ($)</th>
                            <th>NRR ($)</th>
                            <th>MRR ($)</th>
                            <th>Term (Mos)</th>
                            <th>Calculated IRR</th>
                            <th>Decision</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sitesHtml}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const reportWindow = window.open("", "_blank");
        reportWindow.document.write(reportHtml);
        reportWindow.document.close();
        setTimeout(() => reportWindow.print(), 500);
    }
    
    // --- Database Functions ---

    /**
     * Saves the current project state to Supabase.
     */
    async function handleSaveProject() {
        if (!state.currentUser) {
            showModal("Error", "You must be logged in to save.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        const projectName = projectNameInput.value.trim() || "Untitled Project";
        const projectData = {
            project_name: projectName,
            global_target_irr: parseFloat(globalTargetIrrInput.value) || 15,
            sites: state.sites,
            user_id: state.currentUser.id
        };

        let result;
        if (state.currentProjectId) {
            // Update existing project
            result = await supabase
                .from("irr_projects")
                .update({ project_data: projectData })
                .eq("id", state.currentProjectId)
                .select();
        } else {
            // Create new project
            result = await supabase
                .from("irr_projects")
                .insert({ project_data: projectData })
                .select();
        }

        const { data, error } = result;
        if (error) {
            console.error("Error saving project:", error);
            showModal("Error", `Could not save project: ${error.message}`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        } else if (data) {
            state.currentProjectId = data[0].id;
            projectNameInput.value = projectData.project_name; // Sync name
            state.isDirty = false;
            updateSaveButtonState();
            showModal("Success", "Project saved successfully!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        }
    }

    /**
     * Shows the modal to load a saved project.
     */
    async function showLoadProjectModal() {
        if (state.isDirty) {
            showModal("Unsaved Changes", "You have unsaved changes. Are you sure you want to load a new project? Your current changes will be lost.",
                () => {
                    hideModal();
                    fetchAndDisplayProjects(); // Proceed to load
                },
                true,
                `<button id="modal-confirm-btn" class="btn-primary">Discard & Load</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
            );
        } else {
            fetchAndDisplayProjects();
        }
    }

    /**
     * Fetches the list of projects and displays them in the modal.
     */
    async function fetchAndDisplayProjects() {
        const { data, error } = await supabase
            .from("irr_projects")
            .select("id, created_at, project_data->project_name, auth_user_email")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching projects:", error);
            showModal("Error", `Could not load projects: ${error.message}`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        loadProjectList.innerHTML = ""; // Clear list
        if (data.length === 0) {
            loadProjectList.innerHTML = "<li>No saved projects found.</li>";
        } else {
            data.forEach(project => {
                const li = document.createElement("li");
                li.className = "list-item";
                li.dataset.projectId = project.id;
                li.innerHTML = `
                    <div class="load-project-name">${escapeHTML(project.project_name || 'Untitled Project')}</div>
                    <div class="load-project-meta">
                        Saved by: ${escapeHTML(project.auth_user_email || 'Unknown')} on ${new Date(project.created_at).toLocaleDateString()}
                    </div>
                `;
                loadProjectList.appendChild(li);
            });
        }
        
        loadProjectModal.classList.remove("hidden");
    }

    /**
     * Loads a selected project's data into the calculator.
     * @param {string} projectId - The ID of the project to load.
     */
    async function loadProject(projectId) {
        const { data, error } = await supabase
            .from("irr_projects")
            .select("project_data")
            .eq("id", projectId)
            .single();

        if (error) {
            console.error("Error loading project:", error);
            showModal("Error", `Could not load project: ${error.message}`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        const projectData = data.project_data;
        
        // --- Clear existing state ---
        siteTabsContainer.innerHTML = "";
        siteFormsContainer.innerHTML = "";

        // --- Load new state ---
        state.currentProjectId = projectId;
        state.sites = projectData.sites || [];
        projectNameInput.value = projectData.project_name || "Loaded Project";
        globalTargetIrrInput.value = projectData.global_target_irr || 15;
        
        if (state.sites.length === 0) {
            // Handle case of empty project
            initializeNewProject();
            return;
        }

        // --- Rebuild UI from state ---
        state.sites.forEach((siteData, index) => {
            // --- Create Tab ---
            const tab = document.createElement("button");
            tab.className = "irr-tab";
            tab.dataset.tabId = siteData.id;
            tab.innerHTML = `
                <span class="tab-site-name">${escapeHTML(siteData.inputs.siteName)}</span>
                <span class="irr-tab-results">--%</span>
            `;
            
            if (index > 0) { // Add delete button if not the first tab
                const deleteBtn = document.createElement("button");
                deleteBtn.className = "delete-site-btn";
                deleteBtn.innerHTML = "&times;";
                deleteBtn.title = "Delete this site";
                tab.appendChild(deleteBtn);
            }
            siteTabsContainer.appendChild(tab);

            // --- Create Form ---
            const templateClone = siteFormTemplate.content.cloneNode(true);
            const formWrapper = templateClone.querySelector(".site-form-wrapper");
            formWrapper.dataset.siteId = siteData.id;

            const form = formWrapper.querySelector(".irr-form");
            form.querySelector(".site-name-input").value = siteData.inputs.siteName;
            form.querySelector(".construction-cost-input").value = siteData.inputs.constCost;
            form.querySelector(".engineering-cost-input").value = siteData.inputs.engCost;
            form.querySelector(".nrr-input").value = siteData.inputs.nrr;
            form.querySelector(".mrr-input").value = siteData.inputs.mrr;
            form.querySelector(".monthly-cost-input").value = siteData.inputs.monthlyCost;
            form.querySelector(".term-input").value = siteData.inputs.term;

            if (index === 0) { // Hide delete button on first form
                formWrapper.querySelector(".delete-site-btn").classList.add("hidden");
            }
            
            siteFormsContainer.appendChild(templateClone);
            
            // Run calculation to populate results
            runSiteCalculation(siteData.id, false);
        });

        // Set first site as active
        setActiveTab(state.sites[0].id);
        runGlobalCalculation();
        
        state.isDirty = false; // Freshly loaded, not dirty
        updateSaveButtonState();
        loadProjectModal.classList.add("hidden");
    }

    /**
     * Generates a CSV file with live formulas and triggers a download.
     */
    function handleExportCSV() {
        const projectName = projectNameInput.value.trim() || "IRR Project";
        const globalTargetIRR = (parseFloat(globalTargetIrrInput.value) || 15) / 100;
        
        // --- FIX: Defined the helper function here, at the top of the function scope ---
        const createCsvFormula = (baseFormula) => {
            // Escape internal quotes by doubling them up
            const escapedFormula = baseFormula.replace(/"/g, '""');
            // Prepend '=' and wrap the whole thing in quotes
            return `"=${escapedFormula}"`;
        };
        
        let csvContent = [];

        // --- Header Info ---
        csvContent.push(`Project Name:,${escapeCSV(projectName)}`);
        csvContent.push(`Global Target IRR:,${globalTargetIRR}`); // This will be read by formulas
        csvContent.push(""); // Spacer row
        
        // --- Table Header ---
        const headers = [
            "Site Name", "Construction Cost", "Engineering Cost", "NRR (Upfront)", "Monthly Recurring Revenue", 
            "Monthly Costs", "Project Term (Months)", "TCV (Formula)", "Calculated IRR (Formula)", "Decision (Formula)"
        ];
        csvContent.push(headers.join(","));

        // --- Table Rows (Site Data) ---
        const startRow = 5; // CSV row 5 (1-indexed)
        state.sites.forEach((site, index) => {
            const rowNum = startRow + index;
            const { inputs } = site;
            
            // 1. Base Formulas
            const tcvFormulaBase = `(E${rowNum}*G${rowNum})+D${rowNum}`;
            const irrFormulaBase = `IFERROR((1+RATE(G${rowNum}, F${rowNum}-E${rowNum}, (B${rowNum}+C${rowNum})-D${rowNum}))^12-1, "Error")`;
            const decisionFormulaBase = `IF(I${rowNum}="Error", "Error", IF(I${rowNum}>=B$2, "GO", "NO GO"))`;

            // 2. Helper to finalize the formula string for CSV
            // --- REMOVED: Definition was moved to the top ---

            const row = [
                escapeCSV(inputs.siteName),
                inputs.constCost,
                inputs.engCost,
                inputs.nrr,
                inputs.mrr,
                inputs.monthlyCost,
                inputs.term,
                createCsvFormula(tcvFormulaBase),
                createCsvFormula(irrFormulaBase),
                createCsvFormula(decisionFormulaBase)
            ];
            csvContent.push(row.join(","));
        });

        // --- Global Summary ---
        if (state.sites.length > 0) {
            const lastRow = startRow + state.sites.length - 1;
            csvContent.push(""); // Spacer row
            
            // Define summary row numbers
            const globalTcvRow = lastRow + 3; // +1 for spacer, +1 for 1-indexing, +1 for new row
            const globalIrrRow = globalTcvRow + 1;
            const globalDecisionRow = globalIrrRow + 1;

            // --- 1. Global TCV (Always a formula) ---
            const globalTcvFormulaBase = `SUM(H${startRow}:H${lastRow})`;
            // --- FIX: Use the createCsvFormula helper ---
            csvContent.push(`Global TCV (Formula):,,${createCsvFormula(globalTcvFormulaBase)}`);
            
            // --- 2. Global IRR (Conditional Formula) ---
            const firstTerm = state.sites[0]?.inputs.term;
            const allTermsSame = state.sites.every(s => s.inputs.term === firstTerm);

            if (allTermsSame && firstTerm > 0) {
                // ALL terms are the same. We can use a single, powerful RATE formula.
                const firstTermCell = `G${startRow}`; // e.g., G5
                const pmtRange = `F${startRow}:F${lastRow}`;
                const mrrRange = `E${startRow}:E${lastRow}`;
                const constRange = `B${startRow}:B${lastRow}`;
                const engRange = `C${startRow}:C${lastRow}`;
                const nrrRange = `D${startRow}:D${lastRow}`;

                const globalIrrFormulaBase = `IFERROR((1+RATE(${firstTermCell}, SUM(${pmtRange})-SUM(${mrrRange}), SUM(${constRange})+SUM(${engRange})-SUM(${nrrRange})))^12-1, "Error")`;
                // --- FIX: Use the createCsvFormula helper ---
                csvContent.push(`Global IRR (Formula):,,${createCsvFormula(globalIrrFormulaBase)}`);
            } else {
                // Terms are different. Fall back to calculated value.
                const globalIRRValue = globalAnnualIRREl.textContent;
                csvContent.push(`Global IRR (Calculated):,,${escapeCSV(globalIRRValue)}`);
                csvContent.push(`Note:, "Global IRR is a calculated value because site terms are not identical."`);
            }
            
            // --- 3. Global Decision (Always a formula) ---
            // This formula references the cell where the Global IRR was just placed (C + globalIrrRow)
            const globalDecisionFormulaBase = `IF(C${globalIrrRow}="Error", "Error", IF(C${globalIrrRow}>=B$2, "GO", "NO GO"))`;
            // --- FIX: Use the createCsvFormula helper ---
            csvContent.push(`Global Decision (Formula):,,${createCsvFormula(globalDecisionFormulaBase)}`);
        }

        // --- Download Logic ---
        const csvString = csvContent.join("\n");
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `${projectName.replace(/[^a-z0-9]/gi, '_')}_IRR_Export.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- Helper Functions ---

    /**
     * Updates the save button state (enabled/disabled) based on isDirty flag.
     */
    function updateSaveButtonState() {
        if (state.isDirty) {
            saveProjectBtn.disabled = false;
            saveProjectBtn.textContent = "Save Project *";
        } else {
            saveProjectBtn.disabled = true;
            saveProjectBtn.textContent = "Saved";
        }
    }

    function formatCurrency(value) {
        return (value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }

    function escapeHTML(str) {
        return (str || '').replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
    }

    function escapeCSV(str) {
        if (str == null) return '""';
        str = String(str);
        const needsQuotes = str.includes(',') || str.includes('"') || str.includes('\n');
        if (needsQuotes) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }
    
    // --- Event Listener Setup ---
    function setupPageEventListeners() {
        setupModalListeners(); // From shared_constants

        // --- Project Controls ---
        newProjectBtn.addEventListener("click", () => {
            if (state.isDirty) {
                showModal("Unsaved Changes", "You have unsaved changes. Are you sure you want to create a new project? Your current changes will be lost.",
                    () => {
                        hideModal();
                        initializeNewProject();
                    },
                    true,
                    `<button id="modal-confirm-btn" class="btn-primary">Discard & Create New</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
                );
            } else {
                initializeNewProject();
            }
        });
        
        saveProjectBtn.addEventListener("click", handleSaveProject);
        loadProjectBtn.addEventListener("click", showLoadProjectModal);
        addSiteBtn.addEventListener("click", () => addNewSite(false));
        printReportBtn.addEventListener("click", handlePrintReport);
        exportCsvBtn.addEventListener("click", handleExportCSV);

        // --- Global Inputs ---
        projectNameInput.addEventListener("input", () => {
            state.isDirty = true;
            updateSaveButtonState();
        });
        
        globalTargetIrrInput.addEventListener("input", () => {
            // Recalculate all individual sites AND global
            state.sites.forEach(site => runSiteCalculation(site.id, false));
            runGlobalCalculation();
            state.isDirty = true;
            updateSaveButtonState();
        });

        // --- Tab Bar ---
        siteTabsContainer.addEventListener("click", (e) => {
            const tab = e.target.closest(".irr-tab");
            const deleteBtn = e.target.closest(".delete-site-btn");

            if (deleteBtn) {
                e.stopPropagation(); // Prevent tab from activating
                const siteId = tab.dataset.tabId;
                showModal("Confirm Deletion", "Are you sure you want to delete this site?",
                    () => {
                        deleteSite(siteId);
                        hideModal();
                    },
                    true,
                    `<button id="modal-confirm-btn" class="btn-danger">Delete</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
                );
            } else if (tab) {
                setActiveTab(tab.dataset.tabId);
            }
        });

        // --- Site Forms (Event Delegation) ---
        siteFormsContainer.addEventListener("input", (e) => {
            const formWrapper = e.target.closest(".site-form-wrapper");
            if (!formWrapper) return;
            
            runSiteCalculation(formWrapper.dataset.siteId);
        });

        siteFormsContainer.addEventListener("click", (e) => {
            const deleteBtn = e.target.closest(".delete-site-btn");
            if (deleteBtn) {
                const formWrapper = e.target.closest(".site-form-wrapper");
                const siteId = formWrapper.dataset.siteId;
                showModal("Confirm Deletion", "Are you sure you want to delete this site?",
                    () => {
                        deleteSite(siteId);
                        hideModal();
                    },
                    true,
                    `<button id="modal-confirm-btn" class="btn-danger">Delete</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
                );
            }
        });
        
        // --- Load Modal ---
        loadProjectModalCloseBtn.addEventListener("click", () => {
            loadProjectModal.classList.add("hidden");
        });
        
        loadProjectList.addEventListener("click", (e) => {
            const listItem = e.target.closest(".list-item");
            if (listItem) {
                loadProject(listItem.dataset.projectId);
            }
        });
        
        // --- Navigation ---
        navSidebar.addEventListener('click', (e) => {
            const navButton = e.target.closest('a.nav-button');
            if (navButton && !navButton.classList.contains("active")) {
                e.preventDefault();
                handleNavigation(navButton.href);
            }
        });
    }

    /**
     * Handles navigation away from the page, checking for unsaved changes.
     * @param {string} url - The URL to navigate to.
     */
    function handleNavigation(url) {
        if (state.isDirty) {
            showModal("Unsaved Changes", "You have unsaved changes that will be lost. Are you sure you want to leave?", () => {
                state.isDirty = false;
                window.location.href = url;
            }, true, `<button id="modal-confirm-btn" class="btn-primary">Discard & Leave</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
        } else {
            window.location.href = url;
        }
    }

    /**
     * Warns user before unload if there are unsaved changes.
     */
    window.addEventListener('beforeunload', (event) => {
        if (state.isDirty) {
            event.preventDefault();
            event.returnValue = '';
        }
    });

    // --- Page Initialization ---
    async function initializePage() {
        await loadSVGs();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
            console.error('Authentication failed or no session found. Redirecting to login.');
            window.location.href = "index.html"; // Redirect to login
            return;
        }
        state.currentUser = session.user;

        try {
            await setupUserMenuAndAuth(supabase, state); // from shared_constants
            await setupGlobalSearch(supabase, state.currentUser); // from shared_constants
            await checkAndSetNotifications(supabase); // from shared_constants
            setupPageEventListeners();
            
            // Start with a fresh project on load
            initializeNewProject();
        } catch (error) {
            console.error("Critical error during page initialization:", error);
            showModal("Loading Error", "There was a problem loading the page. Please refresh.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        }
    }

    initializePage();
});

