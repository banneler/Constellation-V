/**
 * Multi-Site IRR Calculator for Constellation CRM
 *
 * This script powers the irr.html page, managing multiple sites
 * as tabs and calculating a global IRR.
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
        sites: [], 
        nextSiteId: 1,
        activeSiteId: null
    };

    // --- 2. DOM Element References ---
    const siteTabsContainer = document.getElementById('site-tabs-container');
    const siteFormsContainer = document.getElementById('site-forms-container');
    const siteFormTemplate = document.getElementById('site-form-template');
    const addSiteBtn = document.getElementById('add-site-btn');
    const printReportBtn = document.getElementById('print-report-btn');
    const projectNameInput = document.getElementById('project-name'); // <-- ADDED

    // Global Results Elements
    const globalDecisionEl = document.getElementById('global-decision');
    const globalAnnualIRREl = document.getElementById('global-annual-irr');
    const globalErrorMessageEl = document.getElementById('global-error-message');

    // --- 3. Core Site Management Functions ---

    function addNewSite() {
        const newSiteId = state.nextSiteId++;
        const siteName = `Site ${newSiteId}`;

        const templateClone = siteFormTemplate.content.cloneNode(true);
        const newFormWrapper = templateClone.querySelector('.site-form-wrapper');
        
        newFormWrapper.dataset.siteId = newSiteId;
        newFormWrapper.querySelector('.site-name-input').value = siteName;
        
        siteFormsContainer.appendChild(templateClone);

        const newSite = {
            id: newSiteId,
            name: siteName,
            inputs: {
                constructionCost: 100000,
                engineeringCost: 20000,
                nrr: 5000,
                mrr: 3000,
                monthlyCost: 500,
                term: 60,
                targetIRR: 0.15 // Store as decimal
            },
            result: {
                annualIRR: null,
                decision: '--',
                error: null
            }
        };
        // Set targetIRR from the form default
        newSite.inputs.targetIRR = (parseFloat(newFormWrapper.querySelector('.target-irr-input').value) || 0) / 100;
        
        state.sites.push(newSite);

        attachFormListeners(newFormWrapper);

        // Run calculation for the new site *before* rendering tabs
        runSiteCalculation(newSiteId, false); // Don't run global calc yet

        renderTabs();
        setActiveSite(newSiteId);
        runGlobalCalculation(); // Now run global calc
    }

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
    }

    function setActiveSite(siteId) {
        state.activeSiteId = siteId;

        siteTabsContainer.querySelectorAll('.irr-tab').forEach(tab => {
            tab.classList.toggle('active', Number(tab.dataset.siteId) === siteId);
        });

        siteFormsContainer.querySelectorAll('.site-form-wrapper').forEach(form => {
            form.classList.toggle('active', Number(form.dataset.siteId) === siteId);
        });
    }

    function renderTabs() {
        siteTabsContainer.innerHTML = ''; 

        state.sites.forEach(site => {
            const tab = document.createElement('button');
            tab.className = 'irr-tab';
            tab.dataset.siteId = site.id;

            let resultClass = '';
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

        const formWrapper = siteFormsContainer.querySelector(`.site-form-wrapper[data-site-id="${siteId}"]`);
        if (!formWrapper) return;

        // Get individual UI elements
        const resultsContainer = formWrapper.querySelector('.individual-results-container');
        const decisionEl = resultsContainer.querySelector('.individual-decision');
        const annualIRREl = resultsContainer.querySelector('.individual-annual-irr');
        const errorMessageEl = resultsContainer.querySelector('.individual-error-message');

        // Read values from form and update state
        site.name = formWrapper.querySelector('.site-name-input').value || `Site ${site.id}`;
        site.inputs.constructionCost = parseFloat(formWrapper.querySelector('.construction-cost-input').value) || 0;
        site.inputs.engineeringCost = parseFloat(formWrapper.querySelector('.engineering-cost-input').value) || 0;
        site.inputs.nrr = parseFloat(formWrapper.querySelector('.nrr-input').value) || 0;
        site.inputs.mrr = parseFloat(formWrapper.querySelector('.mrr-input').value) || 0;
        site.inputs.monthlyCost = parseFloat(formWrapper.querySelector('.monthly-cost-input').value) || 0;
        site.inputs.term = parseInt(formWrapper.querySelector('.term-input').value) || 0;
        site.inputs.targetIRR = (parseFloat(formWrapper.querySelector('.target-irr-input').value) || 0) / 100;

        const { cashFlows, error: validationError } = getCashFlowsForSite(site.inputs);

        if (validationError) {
            site.result.error = validationError;
            site.result.annualIRR = null;
            site.result.decision = 'Error';
            showSiteError(errorMessageEl, decisionEl, annualIRREl, validationError);
        } else {
            const monthlyIRR = calculateIRR(cashFlows);
            if (isNaN(monthlyIRR) || !isFinite(monthlyIRR)) {
                site.result.error = "Could not calculate IRR. Check inputs.";
                site.result.annualIRR = null;
                site.result.decision = 'Error';
                showSiteError(errorMessageEl, decisionEl, annualIRREl, site.result.error);
            } else {
                site.result.error = null;
                site.result.annualIRR = Math.pow(1 + monthlyIRR, 12) - 1;
                site.result.decision = site.result.annualIRR >= site.inputs.targetIRR ? 'GO' : 'NO GO';
                showSiteResults(errorMessageEl, decisionEl, annualIRREl, site.result.annualIRR, site.result.decision);
            }
        }
        
        renderTabs();
        setActiveSite(site.id); // Re-assert active tab
        
        if (runGlobal) {
            runGlobalCalculation();
        }
    }

    /**
     * Calculates the combined IRR for *all* sites.
     */
    function runGlobalCalculation() {
        let globalCashFlows = [0]; 
        let maxTerm = 0;
        let globalTargetIRR = 0; 
        
        if (state.sites.length === 0) {
            showGlobalResults(NaN, 0); 
            return;
        }

        // Use the active site's target IRR for the global decision
        const activeSite = state.sites.find(s => s.id === state.activeSiteId);
        globalTargetIRR = activeSite ? activeSite.inputs.targetIRR : state.sites[0].inputs.targetIRR;

        state.sites.forEach(site => {
            if (site.inputs.term > maxTerm) {
                maxTerm = site.inputs.term;
            }
        });
        
        globalCashFlows = new Array(maxTerm + 1).fill(0);

        for (const site of state.sites) {
            // Note: We re-calculate cash flows here, NOT using stored results
            // This ensures global calc is always in sync with inputs
            const { cashFlows, error } = getCashFlowsForSite(site.inputs);
            if (!error) {
                for (let i = 0; i < cashFlows.length; i++) {
                    if (i < globalCashFlows.length) {
                        globalCashFlows[i] += cashFlows[i];
                    }
                }
            }
        }

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
        showGlobalResults(globalMonthlyIRR, globalTargetIRR);
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
            return { cashFlows: [], error: "No investment" };
        }
        
        cashFlows.push(monthZeroCashFlow);
        for (let i = 0; i < term; i++) {
            cashFlows.push(monthlyNetCashFlow);
        }
        
        return { cashFlows, error: null };
    }

    // --- 5. UI Update Functions ---

    /**
     * Updates the UI for *individual site* results
     */
    function showSiteResults(errorMessageEl, decisionEl, annualIRREl, annualIRR, decision) {
        errorMessageEl.classList.add('hidden');
        annualIRREl.textContent = (annualIRR * 100).toFixed(2) + '%';
        decisionEl.textContent = decision;

        if (decision === 'GO') {
            decisionEl.style.color = 'var(--color-success, #22c55e)';
            annualIRREl.style.color = 'var(--color-success, #22c55e)';
        } else {
            decisionEl.style.color = 'var(--color-danger, #ef4444)';
            annualIRREl.style.color = 'var(--color-danger, #ef4444)';
        }
    }

    /**
     * Updates the UI for an *individual site* error
     */
    function showSiteError(errorMessageEl, decisionEl, annualIRREl, message) {
        errorMessageEl.classList.remove('hidden');
        errorMessageEl.textContent = message;
        
        decisionEl.textContent = 'Error';
        decisionEl.style.color = 'var(--text-color-secondary, #9ca3af)';
        annualIRREl.textContent = '--%';
        annualIRREl.style.color = 'var(--text-color-secondary, #9ca3af)';
    }

    /**
     * Updates the UI for *global* results
     */
    function showGlobalResults(monthlyIRR, targetIRR) {
        if (isNaN(monthlyIRR) || !isFinite(monthlyIRR)) {
            showGlobalError("Could not calculate Global IRR. Check inputs.");
            return;
        }

        globalErrorMessageEl.classList.add('hidden');
        const annualIRR = Math.pow(1 + monthlyIRR, 12) - 1;

        globalAnnualIRREl.textContent = (annualIRR * 100).toFixed(2) + '%';
        
        if (annualIRR >= targetIRR) {
            globalDecisionEl.textContent = 'GO';
            globalDecisionEl.style.color = 'var(--color-success, #22c55e)';
            globalAnnualIRREl.style.color = 'var(--color-success, #22c55e)';
        } else {
            globalDecisionEl.textContent = 'NO GO';
            globalDecisionEl.style.color = 'var(--color-danger, #ef4444)';
            globalAnnualIRREl.style.color = 'var(--color-danger, #ef4444)';
        }
    }

    /**
     * Updates the UI for a *global* error
     */
    function showGlobalError(message) {
        globalDecisionEl.textContent = 'Error';
        globalDecisionEl.style.color = 'var(--text-color-secondary, #9ca3af)';
        globalAnnualIRREl.textContent = '--%';
        globalAnnualIRREl.style.color = 'var(--text-color-secondary, #9ca3af)';
        
        globalErrorMessageEl.textContent = message;
        globalErrorMessageEl.classList.remove('hidden');
    }

    // --- 6. Print Function ---

    function handlePrintReport() {
        // <-- UPDATED: Read the project name from the new input -->
        const projectName = projectNameInput.value.trim() || "IRR Project Approval Report";

        let reportHtml = `
            <style>
                body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; background: #fff; color: #000; }
                h1 { color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; }
                h2 { color: #111; margin-top: 30px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f4f4f4; }
                .go { color: #16a34a; font-weight: bold; }
                .nogo { color: #dc2626; font-weight: bold; }
                .error { color: #6b7280; }
                .global-results { margin-top: 30px; padding: 15px; border: 2px solid #3b82f6; border-radius: 8px; background-color: #f9faff; }
                .global-results h2 { margin-top: 0; border: none; }
                .global-irr { font-size: 2rem; font-weight: bold; margin: 0; }
                .global-decision { font-size: 2.5rem; font-weight: bold; margin-bottom: 10px; }
            </style>
            <!-- UPDATED: Use the dynamic project name -->
            <h1>${projectName}</h1>
        `;

        // Add Global Results FIRST
        const globalDecision = globalDecisionEl.textContent;
        const globalDecisionClass = globalDecision === 'GO' ? 'go' : (globalDecision === 'NO GO' ? 'nogo' : 'error');
        
        reportHtml += `
            <div class="global-results">
                <h2>Global Project Results (All Sites)</h2>
                <p class="global-decision ${globalDecisionClass}">${globalDecision}</p>
                <p style="margin:0; color: #555;">Calculated Global Annual IRR</p>
                <p class="global-irr ${globalDecisionClass}">${globalAnnualIRREl.textContent}</p>
            </div>
        `;

        // Add Site Summary Table
        reportHtml += `
            <h2>Site Summary</h2>
            <table>
                <thead>
                    <tr>
                        <th>Site Name</th>
                        <th>Construction ($)</th>
                        <th>Eng. ($)</th>
                        <th>NRR ($)</th>
                        <th>MRR ($)</th>
                        <th>Term (Mos)</th>
                        <th>Target IRR</th>
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
                    <td>${inputs.constructionCost.toLocaleString()}</td>
                    <td>${inputs.engineeringCost.toLocaleString()}</td>
                    <td>${inputs.nrr.toLocaleString()}</td>
                    <td>${inputs.mrr.toLocaleString()}</td>
                    <td>${inputs.term}</td>
                    <td>${(inputs.targetIRR * 100).toFixed(0)}%</td>
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
        // <-- UPDATED: Use dynamic project name in <title> -->
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

    function attachFormListeners(formWrapper) {
        const siteId = Number(formWrapper.dataset.siteId);

        formWrapper.addEventListener('input', (e) => {
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

    function setupPageEventListeners() {
        setupModalListeners(); 

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

        if (addSiteBtn) {
            addSiteBtn.addEventListener('click', addNewSite);
        }
        
        if (printReportBtn) {
            printReportBtn.addEventListener('click', handlePrintReport);
        }

        if (siteTabsContainer) {
            siteTabsContainer.addEventListener('click', (e) => {
                const tab = e.target.closest('.irr-tab');
                if (tab) {
                    setActiveSite(Number(tab.dataset.siteId));
                }
            });
        }
    }

    // --- 8. Main Page Initialization ---
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

    // --- 10. Run Initialization ---
    initializePage();
});

