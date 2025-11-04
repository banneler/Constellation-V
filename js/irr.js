/**
 * Multi-Site IRR Calculator for Constellation CRM (v3)
 *
 * This script powers the irr.html page, managing multiple sites
 * as tabs and calculating a global IRR.
 *
 * Key features:
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
    checkAndSetNotifications
} from './shared_constants.js';

// Wait for the DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', async () => {

    // --- 1. Initialize Supabase and State ---
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    let state = {
        currentUser: null,
        sites: [], // Array to hold all site data objects
        nextSiteId: 1, // Simple counter for unique IDs
        activeSiteId: null // The ID of the currently viewed site
    };

    // --- 2. DOM Element References ---
    const siteTabsContainer = document.getElementById('site-tabs-container');
    const siteFormsContainer = document.getElementById('site-forms-container');
    const siteFormTemplate = document.getElementById('site-form-template');
    const addSiteBtn = document.getElementById('add-site-btn');
    const printReportBtn = document.getElementById('print-report-btn');
    const projectNameInput = document.getElementById('project-name');

    // NEW: Global Target IRR Input
    const globalTargetIrrInput = document.getElementById('global-target-irr');

    // Global Results Elements
    const globalDecisionEl = document.getElementById('global-decision');
    const globalAnnualIRREl = document.getElementById('global-annual-irr');
    const globalTcvEl = document.getElementById('global-tcv'); // NEW: Global TCV
    const globalErrorMessageEl = document.getElementById('global-error-message');

    // --- 3. Core Site Management Functions ---

    /**
     * Creates a new site, adds it to state, and renders it.
     */
    function addNewSite() {
        const newSiteId = state.nextSiteId++;
        const siteName = `Site ${newSiteId}`;

        // Clone the template
        const templateClone = siteFormTemplate.content.cloneNode(true);
        const newFormWrapper = templateClone.querySelector('.site-form-wrapper');
        
        // Set unique data-id and default name
        newFormWrapper.dataset.siteId = newSiteId;
        newFormWrapper.querySelector('.site-name-input').value = siteName;
        
        // Add the new form to the DOM
        siteFormsContainer.appendChild(templateClone);

        // Create the new site object in our state
        const newSite = {
            id: newSiteId,
            name: siteName,
            inputs: { // Default values from the template
                constructionCost: 100000,
                engineeringCost: 20000,
                nrr: 5000,
                mrr: 3000,
                monthlyCost: 500,
                term: 60,
                // targetIRR is now global, not stored per-site
            },
            result: {
                annualIRR: null,
                tcv: 0, // NEW: TCV result
                decision: '--',
                error: null
            }
        };
        
        state.sites.push(newSite);

        // Attach event listeners to the new form
        attachFormListeners(newFormWrapper);

        // Run calculation for the new site *before* rendering tabs
        // Set runGlobal to false to prevent double-calculation
        runSiteCalculation(newSiteId, false); 

        renderTabs();
        setActiveSite(newSiteId);
        runGlobalCalculation(); // Now run global calc once
    }

    /**
     * Deletes a site from state and the DOM.
     * @param {number} siteId - The ID of the site to delete.
     */
    function deleteSite(siteId) {
        if (state.sites.length <= 1) {
            showModal("Action Not Allowed", "You must have at least one site.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        // Remove from state
        state.sites = state.sites.filter(site => site.id !== siteId);

        // Remove from DOM
        const formWrapper = siteFormsContainer.querySelector(`.site-form-wrapper[data-site-id="${siteId}"]`);
        if (formWrapper) formWrapper.remove();
        
        renderTabs();
        
        // If we deleted the active site, activate the first site in the list
        if (state.activeSiteId === siteId) {
            setActiveSite(state.sites[0].id); 
        }

        runGlobalCalculation();
    }

    /**
     * Hides all site forms and shows only the one with the matching ID.
     * @param {number} siteId - The ID of the site to make active.
     */
    function setActiveSite(siteId) {
        state.activeSiteId = siteId;

        // Update tabs
        siteTabsContainer.querySelectorAll('.irr-tab').forEach(tab => {
            tab.classList.toggle('active', Number(tab.dataset.siteId) === siteId);
        });

        // Update forms
        siteFormsContainer.querySelectorAll('.site-form-wrapper').forEach(form => {
            form.classList.toggle('active', Number(form.dataset.siteId) === siteId);
        });
    }

    /**
     * Re-draws the entire tab bar based on the current state.
     */
    function renderTabs() {
        siteTabsContainer.innerHTML = ''; // Clear existing tabs

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

    // --- 4. Calculation Functions ---

    /**
     * Calculates IRR for a single site, updates its state, and updates its UI.
     * @param {number} siteId - The ID of the site to calculate
     * @param {boolean} [runGlobal=true] - Whether to trigger a global recalculation
     */
    function runSiteCalculation(siteId, runGlobal = true) {
        const site = state.sites.find(s => s.id === siteId);
        if (!site) return;

        // 1. Get the single Global Target IRR
        const globalTargetIRR = (parseFloat(globalTargetIrrInput.value) || 0) / 100;

        // 2. Find the correct form wrapper
        const formWrapper = siteFormsContainer.querySelector(`.site-form-wrapper[data-site-id="${siteId}"]`);
        if (!formWrapper) {
            console.error(`runSiteCalculation: Could not find formWrapper for siteId ${siteId}`);
            return; 
        }

        // 3. Find the UI elements *within that specific wrapper*
        const resultsContainer = formWrapper.querySelector('.individual-results-container');
        if (!resultsContainer) {
            console.error(`runSiteCalculation: Could not find .individual-results-container in formWrapper for siteId ${siteId}`);
            return;
        }
        
        const decisionEl = resultsContainer.querySelector('.individual-decision');
        const annualIRREl = resultsContainer.querySelector('.individual-annual-irr');
        const tcvEl = resultsContainer.querySelector('.individual-tcv'); // NEW TCV element
        const errorMessageEl = resultsContainer.querySelector('.individual-error-message');

        if (!decisionEl || !annualIRREl || !tcvEl || !errorMessageEl) {
            console.error(`runSiteCalculation: Missing results elements for siteId ${siteId}`);
            return;
        }

        // 4. Read values from form and update state
        site.name = formWrapper.querySelector('.site-name-input').value || `Site ${site.id}`;
        site.inputs.constructionCost = parseFloat(formWrapper.querySelector('.construction-cost-input').value) || 0;
        site.inputs.engineeringCost = parseFloat(formWrapper.querySelector('.engineering-cost-input').value) || 0;
        site.inputs.nrr = parseFloat(formWrapper.querySelector('.nrr-input').value) || 0;
        site.inputs.mrr = parseFloat(formWrapper.querySelector('.mrr-input').value) || 0;
        site.inputs.monthlyCost = parseFloat(formWrapper.querySelector('.monthly-cost-input').value) || 0;
        site.inputs.term = parseInt(formWrapper.querySelector('.term-input').value) || 0;
        
        // 5. NEW: Calculate TCV
        // TCV = (MRR * Term) + NRR
        const siteTCV = (site.inputs.mrr * site.inputs.term) + site.inputs.nrr;
        site.result.tcv = siteTCV;

        // 6. Perform IRR calculation
        const { cashFlows, error: validationError } = getCashFlowsForSite(site.inputs);

        if (validationError) {
            site.result.error = validationError;
            site.result.annualIRR = null;
            site.result.decision = 'Error';
            // 7. Update UI (with correct elements)
            showSiteError(errorMessageEl, decisionEl, annualIRREl, tcvEl, validationError);
        } else {
            const monthlyIRR = calculateIRR(cashFlows);
            if (isNaN(monthlyIRR) || !isFinite(monthlyIRR)) {
                site.result.error = "Could not calculate IRR. Check inputs.";
                site.result.annualIRR = null;
                site.result.decision = 'Error';
                // 7. Update UI
                showSiteError(errorMessageEl, decisionEl, annualIRREl, tcvEl, site.result.error);
            } else {
                site.result.error = null;
                site.result.annualIRR = Math.pow(1 + monthlyIRR, 12) - 1;
                // 7. Update UI (using GLOBAL target)
                site.result.decision = site.result.annualIRR >= globalTargetIRR ? 'GO' : 'NO GO';
                showSiteResults(errorMessageEl, decisionEl, annualIRREl, tcvEl, site.result.annualIRR, site.result.decision, site.result.tcv);
            }
        }
        
        // 8. Update tabs and global results
        renderTabs();
        setActiveSite(site.id); // Re-assert active tab
        
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

        // 1. Get the single Global Target IRR
        const globalTargetIRR = (parseFloat(globalTargetIrrInput.value) || 0) / 100;

        state.sites.forEach(site => {
            if (site.inputs.term > maxTerm) {
                maxTerm = site.inputs.term;
            }
            // 2. Sum the TCV from each site's results
            globalTCV += site.result.tcv || 0;
        });
        
        globalCashFlows = new Array(maxTerm + 1).fill(0);

        // Combine cash flows from all sites
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
        
        // 3. Update Global TCV UI
        globalTcvEl.textContent = `$${globalTCV.toLocaleString()}`;
        globalTcvEl.classList.remove('pending');

        // 4. Validate combined cash flows
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

        // 5. Calculate and show results
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
        
        // This is a common scenario: all cash flows are positive (e.g., big NRR).
        // IRR is not meaningful in this case, but it's not an "error".
        if (monthZeroCashFlow >= 0 && monthlyNetCashFlow >= 0) {
            return { cashFlows: [], error: "No investment. All cash flows are positive." };
        }
        
        cashFlows.push(monthZeroCashFlow);
        for (let i = 0; i < term; i++) {
            cashFlows.push(monthlyNetCashFlow);
        }
        
        return { cashFlows, error: null };
    }

    // --- 5. UI Update Functions ---

    // Helper to set text and color for a result element
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

    /**
     * Updates the UI for *individual site* results
     */
    function showSiteResults(errorMessageEl, decisionEl, annualIRREl, tcvEl, annualIRR, decision, tcv) {
        errorMessageEl.classList.add('hidden');
        
        const decisionState = decision === 'GO' ? 'go' : 'nogo';
        setResultUI(decisionEl, decision, decisionState);
        setResultUI(annualIRREl, (annualIRR * 100).toFixed(2) + '%', decisionState);
        
        // TCV is always primary color
        setResultUI(tcvEl, `$${tcv.toLocaleString()}`, 'tcv');
        tcvEl.style.color = 'var(--color-primary, #3b82f6)';
    }

    /**
     * Updates the UI for an *individual site* error
     */
    function showSiteError(errorMessageEl, decisionEl, annualIRREl, tcvEl, message) {
        errorMessageEl.classList.remove('hidden');
        errorMessageEl.textContent = message;
        
        setResultUI(decisionEl, 'Error', 'error');
        setResultUI(annualIRREl, '--%', 'error');
        setResultUI(tcvEl, '$0', 'error');
    }

    /**
     * Updates the UI for *global* results
     */
    function showGlobalResults(monthlyIRR, targetIRR, tcv) {
        globalErrorMessageEl.classList.add('hidden');
        
        // Update TCV
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

    /**
     * Updates the UI for a *global* error
     */
    function showGlobalError(message) {
        setResultUI(globalDecisionEl, 'Error', 'error');
        setResultUI(globalAnnualIRREl, '--%', 'error');
        setResultUI(globalTcvEl, '$0', 'error');
        
        globalErrorMessageEl.textContent = message;
        globalErrorMessageEl.classList.remove('hidden');
    }

    // --- 6. Print Function ---

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

        // Add Global Results
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

        // Add Site Summary Table
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

        // Print setup
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


    // --- 7. Event Listener Setup ---

    /**
     * Attaches all necessary event listeners to a newly created site form.
     * @param {HTMLElement} formWrapper - The .site-form-wrapper element.
     */
    function attachFormListeners(formWrapper) {
        const siteId = Number(formWrapper.dataset.siteId);

        // Listen for *any* input on the form
        formWrapper.addEventListener('input', (e) => {
            if (e.target.classList.contains('site-name-input')) {
                // If only the name changed, just update the state and tab
                const site = state.sites.find(s => s.id === siteId);
                if (site) site.name = e.target.value || `Site ${siteId}`;
                renderTabs(); 
                setActiveSite(siteId); // Re-set active to keep focus
            } else {
                // If any other input changed, run the full calculation
                runSiteCalculation(siteId);
            }
        });

        // Listen for the delete button click
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
        setupModalListeners(); // From shared_constants.js

        // Sidebar navigation
        const navSidebar = document.querySelector(".nav-sidebar");
        if (navSidebar) {
            navSidebar.addEventListener('click', (e) => {
                const navButton = e.target.closest('a.nav-button');
                if (navButton) {
                    e.preventDefault();
                    window.location.href = navButton.href;
                }
            });
        }

        // "Add Site" button
        if (addSiteBtn) {
            addSiteBtn.addEventListener('click', addNewSite);
        }
        
        // "Print Report" button
        if (printReportBtn) {
            printReportBtn.addEventListener('click', handlePrintReport);
        }

        // Tab bar click delegation
        if (siteTabsContainer) {
            siteTabsContainer.addEventListener('click', (e) => {
                const tab = e.target.closest('.irr-tab');
                if (tab) {
                    setActiveSite(Number(tab.dataset.siteId));
                }
            });
        }
        
        // NEW: Listener for the Global Target IRR
        if (globalTargetIrrInput) {
            globalTargetIrrInput.addEventListener('input', () => {
                // When global target changes, recalculate everything
                // 1. Recalculate all individual sites (don't run global calc in the loop)
                state.sites.forEach(site => runSiteCalculation(site.id, false)); 
                // 2. Run the global calculation once at the end
                runGlobalCalculation(); 
            });
        }
    }

    // --- 8. Main Page Initialization ---
    async function initializePage() {
        await loadSVGs();
        
        // Check authentication
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            console.error('Authentication failed or no session found. Redirecting to login.');
            window.location.href = "index.html";
            return;
        }
        state.currentUser = session.user;

        try {
            // Setup shared UI components
            await setupUserMenuAndAuth(supabase, state);
            await setupGlobalSearch(supabase, state.currentUser);
            await checkAndSetNotifications(supabase);
            
            // Setup page-specific listeners
            setupPageEventListeners();

            // Start the user with one site
            addNewSite();

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

    // --- 9. Financial Calculation (Pure Functions) ---

    /**
     * Calculates the Net Present Value (NPV) of a series of cash flows.
     */
    function calculateNPV(rate, cashFlows) {
        let npv = 0;
        for (let i = 0; i < cashFlows.length; i++) {
            npv += cashFlows[i] / Math.pow(1 + rate, i);
        }
        return npv;
    }

    /**
     * Finds the Internal Rate of Return (IRR) for a series of cash flows using the bisection method.
     */
    function calculateIRR(cashFlows) {
        const maxIterations = 100;
        const precision = 1e-7;
        
        let minRate = -0.9999; // Minimum possible rate (to avoid division by zero at -1)
        let maxRate = 1.0;     // Start with a reasonable upper guess (100% monthly)
        let midRate = (minRate + maxRate) / 2;

        let npvAtMin = calculateNPV(minRate, cashFlows);
        let npvAtMax = calculateNPV(maxRate, cashFlows);
        
        // Try to find a valid bracket (one NPV positive, one negative)
        if (npvAtMin * npvAtMax > 0) {
            // If both are same sign, widen the bracket.
            // This is common for very high or low IRRs.
            maxRate = 5.0; // 500% monthly
            npvAtMax = calculateNPV(maxRate, cashFlows);
            if (npvAtMin * npvAtMax > 0) {
                 minRate = -0.999999;
                 maxRate = 20.0; // 2000% monthly
                 npvAtMin = calculateNPV(minRate, cashFlows);
                 npvAtMax = calculateNPV(maxRate, cashFlows);
                 // If still no valid bracket, the cash flow is likely problematic (e.g., all positive)
                 if (npvAtMin * npvAtMax > 0) return NaN; 
            }
        }

        // Bisection method
        for (let i = 0; i < maxIterations; i++) {
            midRate = (minRate + maxRate) / 2;
            let npvAtMid = calculateNPV(midRate, cashFlows);

            if (Math.abs(npvAtMid) < precision) {
                // Found a rate close enough to zero
                return midRate;
            } else if (npvAtMid * npvAtMin > 0) {
                // NPV at mid has same sign as NPV at min
                // so, new min is mid
                minRate = midRate;
                npvAtMin = npvAtMid;
            } else {
                // NPV at mid has different sign
                // so, new max is mid
                maxRate = midRate;
            }
        }
        
        // Return the best guess if we run out of iterations
        return midRate;
    }

    // --- 10. Run Initialization ---
    initializePage();
});

