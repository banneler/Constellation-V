/**
 * Multi-Site IRR Calculator for Constellation CRM (v4)
 *
 * This script powers the irr.html page, managing multiple sites
 * as tabs and calculating a global IRR.
 *
 * Key features:
 * - Saves/Loads projects to/from Supabase 'irr_projects' table.
 * - Uses a single GLOBAL Target IRR for all calculations.
 * - Calculates and displays TCV for sites and the global project.
 * - Retains the layout from irr.html (global results at top, then tabs).
 */

// Import all shared functions and constants
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    setupModalListeners,
    showModal,
    hideModal,
    setupUserMenuAndAuth,
    loadSVGs,
    setupGlobalSearch,
    checkAndSetNotifications,
    formatDate // <-- Added for formatting dates in the load modal
} from './shared_constants.js';

// Wait for the DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', async () => {

    // --- 1. Initialize Supabase and State ---
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const IRR_TABLE = 'irr_projects'; // Public table for all users
    
    let state = {
        currentUser: null,
        sites: [], // Array to hold all site data objects
        nextSiteId: 1, // Simple counter for unique IDs
        activeSiteId: null, // The ID of the currently viewed site
        currentProjectId: null, // null = new project, otherwise DB 'id'
        isFormDirty: false // Track unsaved changes
    };

    // --- 2. DOM Element References ---
    // Project Controls
    const newProjectBtn = document.getElementById('new-project-btn');
    const loadProjectBtn = document.getElementById('load-project-btn');
    const saveProjectBtn = document.getElementById('save-project-btn');
    const addSiteBtn = document.getElementById('add-site-btn');
    const printReportBtn = document.getElementById('print-report-btn');
    
    // Project Inputs
    const projectNameInput = document.getElementById('project-name');
    const globalTargetIrrInput = document.getElementById('global-target-irr');

    // Site Containers
    const siteTabsContainer = document.getElementById('site-tabs-container');
    const siteFormsContainer = document.getElementById('site-forms-container');
    const siteFormTemplate = document.getElementById('site-form-template');

    // Global Results Elements
    const globalDecisionEl = document.getElementById('global-decision');
    const globalAnnualIRREl = document.getElementById('global-annual-irr');
    const globalTcvEl = document.getElementById('global-tcv');
    const globalErrorMessageEl = document.getElementById('global-error-message');

    // Load Modal Elements
    const loadProjectModal = document.getElementById('load-project-modal-backdrop');
    const loadProjectList = document.getElementById('load-project-list');
    const loadProjectCancelBtn = document.getElementById('load-project-cancel-btn');

    // --- 3. Core Project/Site Management Functions ---

    /**
     * Resets the entire page to a blank, new project.
     * Asks for confirmation if there are unsaved changes.
     */
    function handleNewProject() {
        const createNew = () => {
            state.currentProjectId = null;
            state.sites = [];
            state.nextSiteId = 1;
            state.activeSiteId = null;
            state.isFormDirty = false;

            projectNameInput.value = '';
            globalTargetIrrInput.value = '15';

            siteFormsContainer.innerHTML = '';
            siteTabsContainer.innerHTML = '';

            addNewSite(); // Adds one default site
            runGlobalCalculation();
            hideModal();
        };

        if (state.isFormDirty) {
            showModal("Unsaved Changes", "You have unsaved changes that will be lost. Are you sure you want to create a new project?",
                createNew, true,
                `<button id="modal-confirm-btn" class="btn-danger">Discard & Create New</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
            );
        } else {
            createNew();
        }
    }

    /**
     * Creates a new site, adds it to state, and renders it.
     */
    function addNewSite() {
        const newSiteId = state.nextSiteId++;
        const siteName = `Site ${newSiteId}`;

        const templateClone = siteFormTemplate.content.cloneNode(true);
        const newFormWrapper = templateClone.querySelector('.site-form-wrapper');
        
        newFormWrapper.dataset.siteId = newSiteId;
        newFormWrapper.querySelector('.site-name-input').value = siteName;
        
        siteFormsContainer.appendChild(templateClone);

        const newSite = {
            id: newSiteId, // This is a local-to-project ID
            name: siteName,
            inputs: {
                constructionCost: 100000,
                engineeringCost: 20000,
                nrr: 5000,
                mrr: 3000,
                monthlyCost: 500,
                term: 60,
            },
            result: {
                annualIRR: null,
                tcv: 0,
                decision: '--',
                error: null
            }
        };
        
        state.sites.push(newSite);
        attachFormListeners(newFormWrapper);

        runSiteCalculation(newSiteId, false); 
        renderTabs();
        setActiveSite(newSiteId);
        runGlobalCalculation();
        state.isFormDirty = true;
    }

    /**
     * Deletes a site from state and the DOM.
     */
    function deleteSite(siteId) {
        if (state.sites.length <= 1) {
            showModal("Action Not Allowed", "You must have at least one site.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        state.sites = state.sites.filter(site => site.id !== siteId);

        const formWrapper = siteFormsContainer.querySelector(`.site-form-wrapper[data-site-id="${siteId}"]`);
        if (formWrapper) formWrapper.remove();
        
        renderTabs();
        
        if (state.activeSiteId === siteId) {
            setActiveSite(state.sites[0].id); 
        }

        runGlobalCalculation();
        state.isFormDirty = true;
    }

    /**
     * Hides all site forms and shows only the one with the matching ID.
     */
    function setActiveSite(siteId) {
        state.activeSiteId = siteId;

        siteTabsContainer.querySelectorAll('.irr-tab').forEach(tab => {
            tab.classList.toggle('active', Number(tab.dataset.siteId) === siteId);
        });

        siteFormsContainer.querySelectorAll('.site-form-wrapper').forEach(form => {
            form.classList.toggle('active', Number(form.dataset.siteId) === siteId);
        });
    }

    /**
     * Re-draws the entire tab bar based on the current state.
     */
    function renderTabs() {
        siteTabsContainer.innerHTML = ''; 

        state.sites.forEach(site => {
            const tab = document.createElement('button');
            tab.className = 'irr-tab';
            tab.dataset.siteId = site.id;

            let resultClass = 'pending';
            let resultText = '--%';
            
            if (site.result.error) {
                resultClass = 'error';
                resultText = 'Error';
            } else if (site.result.annualIRR !== null) {
                resultClass = site.result.decision === 'GO' ? 'go' : 'nogo';
                resultText = `${site.result.decision} (${(site.result.annualIRR * 100).toFixed(2)}%)`;
            }

            tab.innerHTML = `
                ${site.name}
                <span class="irr-tab-results ${resultClass}">${resultText}</span>
            `;

            siteTabsContainer.appendChild(tab);
        });
    }

    // --- 4. Calculation Functions (Unchanged) ---
    // ... (All calculation logic from v3 is retained here) ...
        /**
     * Calculates IRR for a single site, updates its state, and updates its UI.
     * @param {number} siteId - The ID of the site to calculate
     * @param {boolean} [runGlobal=true] - Whether to trigger a global recalculation
     */
    function runSiteCalculation(siteId, runGlobal = true) {
        const site = state.sites.find(s => s.id === siteId);
        if (!site) return;

        const globalTargetIRR = (parseFloat(globalTargetIrrInput.value) || 0) / 100;

        const formWrapper = siteFormsContainer.querySelector(`.site-form-wrapper[data-site-id="${siteId}"]`);
        if (!formWrapper) {
            console.error(`runSiteCalculation: Could not find formWrapper for siteId ${siteId}`);
            return; 
        }

        const resultsContainer = formWrapper.querySelector('.individual-results-container');
        if (!resultsContainer) {
            console.error(`runSiteCalculation: Could not find .individual-results-container in formWrapper for siteId ${siteId}`);
            return;
        }
        
        const decisionEl = resultsContainer.querySelector('.individual-decision');
        const annualIRREl = resultsContainer.querySelector('.individual-annual-irr');
        const tcvEl = resultsContainer.querySelector('.individual-tcv'); 
        const errorMessageEl = resultsContainer.querySelector('.individual-error-message');

        if (!decisionEl || !annualIRREl || !tcvEl || !errorMessageEl) {
            console.error(`runSiteCalculation: Missing results elements for siteId ${siteId}`);
            return;
        }

        site.name = formWrapper.querySelector('.site-name-input').value || `Site ${site.id}`;
        site.inputs.constructionCost = parseFloat(formWrapper.querySelector('.construction-cost-input').value) || 0;
        site.inputs.engineeringCost = parseFloat(formWrapper.querySelector('.engineering-cost-input').value) || 0;
        site.inputs.nrr = parseFloat(formWrapper.querySelector('.nrr-input').value) || 0;
        site.inputs.mrr = parseFloat(formWrapper.querySelector('.mrr-input').value) || 0;
        site.inputs.monthlyCost = parseFloat(formWrapper.querySelector('.monthly-cost-input').value) || 0;
        site.inputs.term = parseInt(formWrapper.querySelector('.term-input').value) || 0;
        
        const siteTCV = (site.inputs.mrr * site.inputs.term) + site.inputs.nrr;
        site.result.tcv = siteTCV;

        const { cashFlows, error: validationError } = getCashFlowsForSite(site.inputs);

        if (validationError) {
            site.result.error = validationError;
            site.result.annualIRR = null;
            site.result.decision = 'Error';
            showSiteError(errorMessageEl, decisionEl, annualIRREl, tcvEl, validationError);
        } else {
            const monthlyIRR = calculateIRR(cashFlows);
            if (isNaN(monthlyIRR) || !isFinite(monthlyIRR)) {
                site.result.error = "Could not calculate IRR. Check inputs.";
                site.result.annualIRR = null;
                site.result.decision = 'Error';
                showSiteError(errorMessageEl, decisionEl, annualIRREl, tcvEl, site.result.error);
            } else {
                site.result.error = null;
                site.result.annualIRR = Math.pow(1 + monthlyIRR, 12) - 1;
                site.result.decision = site.result.annualIRR >= globalTargetIRR ? 'GO' : 'NO GO';
                showSiteResults(errorMessageEl, decisionEl, annualIRREl, tcvEl, site.result.annualIRR, site.result.decision, site.result.tcv);
            }
        }
        
        renderTabs();
        setActiveSite(site.id); 
        
        if (runGlobal) {
            runGlobalCalculation();
        }
    }

    /**
     * Calculates the combined IRR and TCV for *all* sites.
     */
    function runGlobalCalculation() {
        let globalCashFlows = [0]; 
        let maxTerm = 0;
        let globalTCV = 0;
        
        if (state.sites.length === 0) {
            showGlobalResults(NaN, 0, 0); 
            return;
        }

        const globalTargetIRR = (parseFloat(globalTargetIrrInput.value) || 0) / 100;

        state.sites.forEach(site => {
            if (site.inputs.term > maxTerm) {
                maxTerm = site.inputs.term;
            }
            globalTCV += site.result.tcv || 0;
        });
        
        globalCashFlows = new Array(maxTerm + 1).fill(0);

        for (const site of state.sites) {
            const { cashFlows, error } = getCashFlowsForSite(site.inputs);
            if (!error) {
                for (let i = 0; i < cashFlows.length; i++) {
                    if (i < globalCashFlows.length) {
                        globalCashFlows[i] += cashFlows[i];
                    }
                }
            }
        }
        
        globalTcvEl.textContent = `$${globalTCV.toLocaleString()}`;
        globalTcvEl.classList.remove('pending');

        const monthZero = globalCashFlows[0];
        const positiveFlow = globalCashFlows.slice(1).some(cf => cf > 0);
        
        if (monthZero >= 0 && !globalCashFlows.slice(1).some(cf => cf < 0)) {
            showGlobalError("Global project has no negative cash flow (no investment).");
            return;
        }
         if (monthZero <= 0 && !positiveFlow) {
            showGlobalError("Global project has no positive cash flow.");
            return;
        }

        const globalMonthlyIRR = calculateIRR(globalCashFlows);
        showGlobalResults(globalMonthlyIRR, globalTargetIRR, globalTCV);
    }

    /**
     * Helper to get a cash flow array from a site's inputs
     */
    function getCashFlowsForSite(inputs) {
        const { nrr, constructionCost, engineeringCost, mrr, monthlyCost, term } = inputs;
        const cashFlows = [];
        
        const monthZeroCashFlow = nrr - (constructionCost + engineeringCost);
        const monthlyNetCashFlow = mrr - monthlyCost;

        if (term <= 0) return { cashFlows: [], error: "Term must be > 0" };
        
        if (monthZeroCashFlow >= 0 && monthlyNetCashFlow >= 0) {
            return { cashFlows: [], error: "No investment. All cash flows are positive." };
        }
        
        cashFlows.push(monthZeroCashFlow);
        for (let i = 0; i < term; i++) {
            cashFlows.push(monthlyNetCashFlow);
        }
        
        return { cashFlows, error: null };
    }


    // --- 5. UI Update Functions (Unchanged) ---
    // ... (All UI update functions from v3 are retained here) ...
    function setResultUI(el, text, state) { // state: 'go', 'nogo', 'error', 'pending'
        el.textContent = text;
        el.classList.remove('go', 'nogo', 'error', 'pending');
        
        switch (state) {
            case 'go':
                el.style.color = 'var(--color-success, #22c55e)';
                break;
            case 'nogo':
                el.style.color = 'var(--color-danger, #ef4444)';
                break;
            case 'error':
                el.style.color = 'var(--color-warning, #f97316)';
                break;
            case 'pending':
            default:
                el.style.color = 'var(--text-color-secondary, #9ca3af)';
                break;
        }
    }

    function showSiteResults(errorMessageEl, decisionEl, annualIRREl, tcvEl, annualIRR, decision, tcv) {
        errorMessageEl.classList.add('hidden');
        const decisionState = decision === 'GO' ? 'go' : 'nogo';
        setResultUI(decisionEl, decision, decisionState);
        setResultUI(annualIRREl, (annualIRR * 100).toFixed(2) + '%', decisionState);
        setResultUI(tcvEl, `$${tcv.toLocaleString()}`, 'tcv');
        tcvEl.style.color = 'var(--color-primary, #3b82f6)';
    }

    function showSiteError(errorMessageEl, decisionEl, annualIRREl, tcvEl, message) {
        errorMessageEl.classList.remove('hidden');
        errorMessageEl.textContent = message;
        setResultUI(decisionEl, 'Error', 'error');
        setResultUI(annualIRREl, '--%', 'error');
        setResultUI(tcvEl, '$0', 'error');
    }

    function showGlobalResults(monthlyIRR, targetIRR, tcv) {
        globalErrorMessageEl.classList.add('hidden');
        setResultUI(globalTcvEl, `$${tcv.toLocaleString()}`, 'tcv');
        globalTcvEl.style.color = 'var(--color-primary, #3b82f6)';
        
        if (isNaN(monthlyIRR) || !isFinite(monthlyIRR)) {
            showGlobalError("Could not calculate Global IRR. Check inputs.");
            return;
        }

        const annualIRR = Math.pow(1 + monthlyIRR, 12) - 1;
        
        if (annualIRR >= targetIRR) {
            setResultUI(globalDecisionEl, 'GO', 'go');
            setResultUI(globalAnnualIRREl, (annualIRR * 100).toFixed(2) + '%', 'go');
        } else {
            setResultUI(globalDecisionEl, 'NO GO', 'nogo');
            setResultUI(globalAnnualIRREl, (annualIRR * 100).toFixed(2) + '%', 'nogo');
        }
    }

    function showGlobalError(message) {
        setResultUI(globalDecisionEl, 'Error', 'error');
        setResultUI(globalAnnualIRREl, '--%', 'error');
        setResultUI(globalTcvEl, '$0', 'error');
        globalErrorMessageEl.textContent = message;
        globalErrorMessageEl.classList.remove('hidden');
    }

    // --- 6. Print Function (Unchanged) ---
    // ... (The print function from v3 is retained here) ...
    function handlePrintReport() {
        const projectName = projectNameInput.value.trim() || "IRR Project Approval Report";
        const globalTargetIRR = (parseFloat(globalTargetIrrInput.value) || 0) / 100;

        let reportHtml = `
            <style>
                body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; background: #fff; color: #000; }
                h1 { color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; font-size: 2rem; }
                h2 { color: #111; margin-top: 30px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f4f4f4; }
                .go { color: #16a34a; font-weight: bold; }
                .nogo { color: #dc2626; font-weight: bold; }
                .error { color: #f97316; font-weight: bold; }
                .global-results { margin-top: 20px; padding: 15px; border: 2px solid #3b82f6; border-radius: 8px; background-color: #f9faff; page-break-inside: avoid; }
                .global-results h2 { margin-top: 0; border: none; font-size: 1.5rem; }
                .global-results-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
                .global-results-grid p { margin: 0; color: #555; font-size: 0.9rem; }
                .global-results-grid .value { font-size: 1.75rem; font-weight: bold; margin-top: 5px; }
            </style>
            <h1>${projectName}</h1>
        `;

        const globalDecision = globalDecisionEl.textContent;
        const globalDecisionClass = globalDecision === 'GO' ? 'go' : (globalDecision === 'NO GO' ? 'nogo' : 'error');
        
        reportHtml += `
            <div class="global-results">
                <h2>Global Project Results (All Sites)</h2>
                <div class="global-results-grid">
                    <div>
                        <p>Global Decision</p>
                        <div class="value ${globalDecisionClass}">${globalDecision}</div>
                    </div>
                    <div>
                        <p>Calculated Global Annual IRR</p>
                        <div class="value ${globalDecisionClass}">${globalAnnualIRREl.textContent}</div>
                    </div>
                    <div>
                        <p>Global TCV ($)</p>
                        <div class="value" style="color: #3b82f6;">${globalTcvEl.textContent}</div>
                    </div>
                </div>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="margin: 0;"><strong>Global Target IRR:</strong> ${(globalTargetIRR * 100).toFixed(2)}%</p>
            </div>
        `;

        reportHtml += `
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
        `;

        state.sites.forEach(site => {
            const inputs = site.inputs;
            const res = site.result;
            const irrText = res.error ? 'Error' : `${(res.annualIRR * 100).toFixed(2)}%`;
            const decisionClass = res.decision === 'GO' ? 'go' : (res.decision === 'NO GO' ? 'nogo' : 'error');

            reportHtml += `
                <tr>
                    <td>${site.name}</td>
                    <td>$${(res.tcv || 0).toLocaleString()}</td>
                    <td>${inputs.constructionCost.toLocaleString()}</td>
                    <td>${inputs.engineeringCost.toLocaleString()}</td>
                    <td>${inputs.nrr.toLocaleString()}</td>
                    <td>${inputs.mrr.toLocaleString()}</td>
                    <td>${inputs.term}</td>
                    <td class="${decisionClass}">${irrText}</td>
                    <td class="${decisionClass}">${res.decision}</td>
                </tr>
            `;
        });

        reportHtml += `</tbody></table>`;

        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'absolute';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);

        const frameDoc = printFrame.contentWindow.document;
        frameDoc.open();
        frameDoc.write(`<html><head><title>${projectName}</title></head><body>`);
        frameDoc.write(reportHtml);
        frameDoc.write('</body></html>');
        frameDoc.close();

        setTimeout(() => {
            try {
                printFrame.contentWindow.focus();
                printFrame.contentWindow.print();
            } catch (e) {
                console.error("Print failed:", e);
                showModal("Error", "Could not open print dialog. Please check browser settings.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            } finally {
                if (document.body.contains(printFrame)) {
                    document.body.removeChild(printFrame);
                }
            }
        }, 250);
    }

    // --- 7. NEW: Database (Save/Load) Functions ---

    /**
     * Saves the current project state to Supabase.
     * Inserts if new (state.currentProjectId is null), updates if existing.
     */
    async function handleSaveProject() {
        const projectName = projectNameInput.value.trim();
        if (!projectName) {
            showModal("Cannot Save", "Please enter a Project Name before saving.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        // Show loading modal
        showModal("Saving...", `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">Saving project to database...</p>`, null, false, ``);

        const projectData = {
            project_name: projectName,
            global_target_irr: parseFloat(globalTargetIrrInput.value) || 15,
            sites: state.sites, // Save the entire sites array as JSON
            user_id: state.currentUser.id,
            last_saved: new Date().toISOString()
        };

        let result;
        if (state.currentProjectId) {
            // Update existing project
            result = await supabase.from(IRR_TABLE)
                .update(projectData)
                .eq('id', state.currentProjectId)
                .select();
        } else {
            // Insert new project
            result = await supabase.from(IRR_TABLE)
                .insert(projectData)
                .select();
        }

        if (result.error) {
            console.error("Error saving project:", result.error);
            showModal("Error", `Could not save project: ${result.error.message}`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        } else {
            // Success! Update state with new ID (if it was an insert)
            if (result.data && result.data[0]) {
                state.currentProjectId = result.data[0].id;
            }
            state.isFormDirty = false;
            // Show success message
            showModal("Success!", "Project saved successfully.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        }
    }

    /**
     * Fetches the list of saved projects and displays the load modal.
     */
    async function handleLoadProject() {
        loadProjectList.innerHTML = `<li class="placeholder-text">Loading...</li>`;
        loadProjectModal.classList.remove('hidden');

        const { data, error } = await supabase
            .from(IRR_TABLE)
            .select('id, project_name, last_saved, user_id') // We can add user_id if we want to show who saved it
            .order('last_saved', { ascending: false });

        if (error) {
            console.error("Error fetching projects:", error);
            loadProjectList.innerHTML = `<li class="placeholder-text error">Could not load projects.</li>`;
            return;
        }

        if (data.length === 0) {
            loadProjectList.innerHTML = `<li class="placeholder-text">No saved projects found.</li>`;
            return;
        }

        // Render the list
        loadProjectList.innerHTML = '';
        data.forEach(project => {
            const li = document.createElement('li');
            li.dataset.projectId = project.id;
            li.innerHTML = `
                <span class="project-name">${project.project_name}</span>
                <span class="project-date">Saved: ${formatDate(project.last_saved)}</span>
            `;
            loadProjectList.appendChild(li);
        });
    }

    /**
     * Loads a full project from the database by its ID.
     * @param {string} projectId - The UUID of the project to load.
     */
    async function loadProjectFromList(projectId) {
        const loadProject = async () => {
            // 1. Hide load modal, show loading modal
            loadProjectModal.classList.add('hidden');
            showModal("Loading...", `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">Loading project...</p>`, null, false, ``);
            
            // 2. Fetch full project data
            const { data, error } = await supabase
                .from(IRR_TABLE)
                .select('*')
                .eq('id', projectId)
                .single();

            if (error) {
                console.error("Error loading project:", error);
                showModal("Error", `Could not load project: ${error.message}`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                return;
            }

            // 3. Hydrate state and DOM from loaded data
            hydrateState(data);
            
            // 4. Hide loading modal
            hideModal();
            state.isFormDirty = false;
        };
        
        if (state.isFormDirty) {
             showModal("Unsaved Changes", "You have unsaved changes that will be lost. Are you sure you want to load a different project?",
                loadProject, true,
                `<button id="modal-confirm-btn" class="btn-danger">Discard & Load</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
            );
        } else {
            loadProject();
        }
    }

    /**
     * Rebuilds the entire page (state and DOM) from a loaded project object.
     * @param {object} projectData - The full project object from Supabase.
     */
    function hydrateState(projectData) {
        // 1. Clear existing DOM
        siteFormsContainer.innerHTML = '';
        siteTabsContainer.innerHTML = '';

        // 2. Set global state
        state.currentProjectId = projectData.id;
        state.sites = projectData.sites || [];
        state.activeSiteId = state.sites.length > 0 ? state.sites[0].id : null;
        // Ensure nextSiteId is higher than any loaded ID
        state.nextSiteId = state.sites.length > 0 
            ? Math.max(...state.sites.map(s => s.id)) + 1 
            : 1;

        // 3. Set global inputs
        projectNameInput.value = projectData.project_name || '';
        globalTargetIrrInput.value = projectData.global_target_irr || 15;
        
        // 4. Rebuild DOM for each site
        state.sites.forEach(site => {
            const templateClone = siteFormTemplate.content.cloneNode(true);
            const newFormWrapper = templateClone.querySelector('.site-form-wrapper');
            
            newFormWrapper.dataset.siteId = site.id;
            
            // Populate all inputs from saved data
            newFormWrapper.querySelector('.site-name-input').value = site.name;
            const inputs = site.inputs || {};
            newFormWrapper.querySelector('.construction-cost-input').value = inputs.constructionCost || 0;
            newFormWrapper.querySelector('.engineering-cost-input').value = inputs.engineeringCost || 0;
            newFormWrapper.querySelector('.nrr-input').value = inputs.nrr || 0;
            newFormWrapper.querySelector('.mrr-input').value = inputs.mrr || 0;
            newFormWrapper.querySelector('.monthly-cost-input').value = inputs.monthlyCost || 0;
            newFormWrapper.querySelector('.term-input').value = inputs.term || 0;
            
            siteFormsContainer.appendChild(templateClone);
            attachFormListeners(newFormWrapper);
            
            // Recalculate this site's results (don't trigger global calc yet)
            runSiteCalculation(site.id, false);
        });

        // 5. Run final calculations and renders
        runGlobalCalculation(); // Run global calc once
        renderTabs(); // Render all tabs
        if (state.activeSiteId) {
            setActiveSite(state.activeSiteId); // Activate the first tab
        }
    }


    // --- 8. Event Listener Setup ---

    /**
     * Attaches all necessary event listeners to a newly created site form.
     */
    function attachFormListeners(formWrapper) {
        const siteId = Number(formWrapper.dataset.siteId);

        formWrapper.addEventListener('input', (e) => {
            state.isFormDirty = true; // Mark as dirty
            if (e.target.classList.contains('site-name-input')) {
                const site = state.sites.find(s => s.id === siteId);
                if (site) site.name = e.target.value || `Site ${siteId}`;
                renderTabs(); 
                setActiveSite(siteId);
            } else {
                runSiteCalculation(siteId);
            }
        });

        formWrapper.querySelector('.delete-site-btn').addEventListener('click', () => {
            const site = state.sites.find(s => s.id === siteId);
            showModal("Confirm Deletion", `Are you sure you want to delete "${site ? site.name : 'this site'}"?`,
                () => {
                    deleteSite(siteId);
                    hideModal();
                }, true, 
                `<button id="modal-confirm-btn" class="btn-danger">Delete</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
            );
        });
    }

    /**
     * Sets up all global, non-site-specific event listeners.
     */
    function setupPageEventListeners() {
        setupModalListeners(); 

        // Handle sidebar navigation with dirty check
        const navSidebar = document.querySelector(".nav-sidebar");
        if (navSidebar) {
            navSidebar.addEventListener('click', (e) => {
                const navButton = e.target.closest('a.nav-button');
                if (navButton) {
                    e.preventDefault();
                    const url = navButton.href;
                    if (state.isFormDirty) {
                        showModal("Unsaved Changes", "You have unsaved changes that will be lost. Are you sure you want to leave?", 
                            () => {
                                state.isFormDirty = false; 
                                window.location.href = url;
                            }, true, 
                            `<button id="modal-confirm-btn" class="btn-danger">Discard & Leave</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
                        );
                    } else {
                        window.location.href = url;
                    }
                }
            });
        }
        
        // Beforeunload confirmation (browser native)
        window.addEventListener('beforeunload', (event) => {
            if (state.isFormDirty) {
                event.preventDefault();
                event.returnValue = ''; // Required for legacy browsers
            }
        });

        // Project Control Buttons
        if (newProjectBtn) newProjectBtn.addEventListener('click', handleNewProject);
        if (loadProjectBtn) loadProjectBtn.addEventListener('click', handleLoadProject);
        if (saveProjectBtn) saveProjectBtn.addEventListener('click', handleSaveProject);
        if (addSiteBtn) addSiteBtn.addEventListener('click', addNewSite);
        if (printReportBtn) printReportBtn.addEventListener('click', handlePrintReport);
        
        // Tab bar click delegation
        if (siteTabsContainer) {
            siteTabsContainer.addEventListener('click', (e) => {
                const tab = e.target.closest('.irr-tab');
                if (tab) {
                    setActiveSite(Number(tab.dataset.siteId));
                }
            });
        }
        
        // Global Target IRR listener
        if (globalTargetIrrInput) {
            globalTargetIrrInput.addEventListener('input', () => {
                state.isFormDirty = true;
                state.sites.forEach(site => runSiteCalculation(site.id, false)); 
                runGlobalCalculation(); 
            });
        }
        
        // Project Name listener
        if (projectNameInput) {
            projectNameInput.addEventListener('input', () => {
                state.isFormDirty = true;
            });
        }

        // Load Modal Listeners
        if (loadProjectCancelBtn) {
            loadProjectCancelBtn.addEventListener('click', () => {
                loadProjectModal.classList.add('hidden');
            });
        }
        if (loadProjectList) {
            loadProjectList.addEventListener('click', (e) => {
                const li = e.target.closest('li[data-project-id]');
                if (li) {
                    loadProjectFromList(li.dataset.projectId);
                }
            });
        }
    }

    // --- 9. Main Page Initialization ---
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
            await setupUserMenuAndAuth(supabase, state);
            await setupGlobalSearch(supabase, state.currentUser);
            await checkAndSetNotifications(supabase);
            
            setupPageEventListeners();

            // Start the user with one site
            handleNewProject(); // This will set up the first default site
            state.isFormDirty = false; // It's not "dirty" on first load

        } catch (error) {
            console.error("Critical error during page initialization:", error);
            showModal(
                "Loading Error",
                "There was a problem loading the page. Please refresh to try again.",
                null, false,
                `<button id="modal-ok-btn" class="btn-primary">OK</button>`
            );
        }
    }

    // --- 10. Financial Calculation (Pure Functions - Unchanged) ---

    function calculateNPV(rate, cashFlows) {
        let npv = 0;
        for (let i = 0; i < cashFlows.length; i++) {
            npv += cashFlows[i] / Math.pow(1 + rate, i);
        }
        return npv;
    }

    function calculateIRR(cashFlows) {
        const maxIterations = 100;
        const precision = 1e-7;
        
        let minRate = -0.9999; 
        let maxRate = 1.0;     
        let midRate = (minRate + maxRate) / 2;

        let npvAtMin = calculateNPV(minRate, cashFlows);
        let npvAtMax = calculateNPV(maxRate, cashFlows);
        
        if (npvAtMin * npvAtMax > 0) {
            maxRate = 5.0; 
            npvAtMax = calculateNPV(maxRate, cashFlows);
            if (npvAtMin * npvAtMax > 0) {
                 minRate = -0.999999;
                 maxRate = 20.0; 
                 npvAtMin = calculateNPV(minRate, cashFlows);
                 npvAtMax = calculateNPV(maxRate, cashFlows);
                 if (npvAtMin * npvAtMax > 0) return NaN; 
            }
        }

        for (let i = 0; i < maxIterations; i++) {
            midRate = (minRate + maxRate) / 2;
            let npvAtMid = calculateNPV(midRate, cashFlows);

            if (Math.abs(npvAtMid) < precision) {
                return midRate;
            } else if (npvAtMid * npvAtMin > 0) {
                minRate = midRate;
                npvAtMin = npvAtMid;
            } else {
                maxRate = midRate;
            }
        }
        
        return midRate;
    }

    // --- 11. Run Initialization ---
    initializePage();
});

