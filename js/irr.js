/**
 * IRR Calculator for Constellation CRM
 *
 * This script powers the irr.html page, providing all the logic
 * for calculating the Internal Rate of Return for fiber projects.
 *
 * It's structured to match the site's main modules (like accounts.js).
 */

// Import all shared functions and constants
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatDate,
    formatMonthYear,
    parseCsvRow,
    themes,
    setupModalListeners,
    showModal,
    hideModal,
    updateActiveNavLink,
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
        currentUser: null
        // No 'isFormDirty' needed for the calculator as it doesn't save to DB
    };

    // --- 2. Calculator-Specific Helper Functions ---
    // (These are the functions from the original irr.js)

    /**
     * Shows the results in the UI.
     * @param {number} annualIRR - The calculated annual IRR.
     * @param {number} targetIRR - The user's target IRR.
     */
    function showResults(annualIRR, targetIRR) {
        const resultsDiv = document.getElementById('results');
        const errorMessageEl = document.getElementById('errorMessage');
        const annualIRREl = document.getElementById('annualIRR');
        const decisionEl = document.getElementById('decision');

        if (!resultsDiv || !errorMessageEl || !annualIRREl || !decisionEl) return;

        resultsDiv.classList.remove('hidden');
        errorMessageEl.classList.add('hidden');

        // Format as percentage
        annualIRREl.textContent = (annualIRR * 100).toFixed(2) + '%';
        
        // Make decision and apply styles
        if (annualIRR >= targetIRR) {
            decisionEl.textContent = 'GO';
            decisionEl.style.color = 'var(--color-success, #22c55e)'; // Green
            annualIRREl.style.color = 'var(--color-success, #22c55e)';
        } else {
            decisionEl.textContent = 'NO GO';
            decisionEl.style.color = 'var(--color-danger, #ef4444)'; // Red
            annualIRREl.style.color = 'var(--color-danger, #ef4444)';
        }
    }

    /**
     * Shows an error message in the UI.
     * @param {string} message - The error message to display.
     */
    function showError(message) {
        const resultsDiv = document.getElementById('results');
        const errorMessageEl = document.getElementById('errorMessage');
        const annualIRREl = document.getElementById('annualIRR');
        const decisionEl = document.getElementById('decision');

        if (!resultsDiv || !errorMessageEl || !annualIRREl || !decisionEl) return;

        resultsDiv.classList.remove('hidden');
        errorMessageEl.classList.remove('hidden');
        errorMessageEl.textContent = message;

        // Reset results to a neutral state
        decisionEl.textContent = 'Error';
        decisionEl.style.color = 'var(--text-color-secondary, #9ca3af)';
        annualIRREl.textContent = '--%';
        annualIRREl.style.color = 'var(--text-color-secondary, #9ca3af)';
    }

    /**
     * Calculates the Net Present Value (NPV) for a series of cash flows at a given rate.
     * @param {number} rate - The discount rate.
     * @param {number[]} cashFlows - The array of cash flows.
     * @returns {number} The NPV.
     */
    function calculateNPV(rate, cashFlows) {
        let npv = 0;
        for (let i = 0; i < cashFlows.length; i++) {
            npv += cashFlows[i] / Math.pow(1 + rate, i);
        }
        return npv;
    }

    /**
     * Calculates the Internal Rate of Return (IRR) for a series of cash flows
     * using the bisection method.
     * @param {number[]} cashFlows - An array of cash flows, starting with period 0.
     * @returns {number} The monthly IRR.
     */
    function calculateIRR(cashFlows) {
        const maxIterations = 100;
        const precision = 1e-7;
        
        let minRate = -0.9999; // -99.99%
        let maxRate = 1.0;     // 100%
        let midRate = (minRate + maxRate) / 2;

        let npvAtMin = calculateNPV(minRate, cashFlows);
        let npvAtMax = calculateNPV(maxRate, cashFlows);
        
        // Try to find a valid range
        if (npvAtMin * npvAtMax > 0) {
            maxRate = 5.0; // 500%
            npvAtMax = calculateNPV(maxRate, cashFlows);
            if (npvAtMin * npvAtMax > 0) {
                 minRate = -0.999999;
                 maxRate = 20.0; // 2000%
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

    /**
     * Core calculation function that reads from DOM and calls helpers.
     */
    function runCalculation() {
        // --- Get Element References ---
        const constructionCostEl = document.getElementById('constructionCost');
        const engineeringCostEl = document.getElementById('engineeringCost');
        const nrrEl = document.getElementById('nrr');
        const mrrEl = document.getElementById('mrr');
        const monthlyCostEl = document.getElementById('monthlyCost');
        const termEl = document.getElementById('term');
        const targetIRREl = document.getElementById('targetIRR');

        // --- Get All Input Values ---
        const constructionCost = parseFloat(constructionCostEl.value) || 0;
        const engineeringCost = parseFloat(engineeringCostEl.value) || 0;
        const nrr = parseFloat(nrrEl.value) || 0;
        const mrr = parseFloat(mrrEl.value) || 0;
        const monthlyCost = parseFloat(monthlyCostEl.value) || 0;
        const term = parseInt(termEl.value) || 0;
        const targetIRR = (parseFloat(targetIRREl.value) || 0) / 100;

        // --- Create Cash Flow Array ---
        const cashFlows = [];
        const monthZeroCashFlow = nrr - (constructionCost + engineeringCost);
        cashFlows.push(monthZeroCashFlow);
        const monthlyNetCashFlow = mrr - monthlyCost;
        for (let i = 0; i < term; i++) {
            cashFlows.push(monthlyNetCashFlow);
        }

        // --- Validate Inputs ---
        if (term <= 0 || cashFlows.length <= 1) {
            showError("Please enter a valid term (at least 1 month).");
            return;
        }
        if (monthZeroCashFlow >= 0 && monthlyNetCashFlow >= 0) {
             showError("Cannot calculate IRR: Project has no negative cash flow (no investment).");
             return;
        }

        // --- Calculate IRR ---
        const monthlyIRR = calculateIRR(cashFlows);
        
        if (isNaN(monthlyIRR) || !isFinite(monthlyIRR)) {
            showError("Could not calculate IRR. The project may not have a valid return (e.g., all positive or all negative cash flows).");
            return;
        }

        // --- Annualize and Display Results ---
        const annualIRR = Math.pow(1 + monthlyIRR, 12) - 1;
        showResults(annualIRR, targetIRR);
    }

    // --- 3. Page-Specific Event Listeners ---
    function setupPageEventListeners() {
        // Setup standard modal listeners from shared_constants.js
        setupModalListeners();

        // Handle navigation clicks from the sidebar
        const navSidebar = document.querySelector(".nav-sidebar");
        if (navSidebar) {
            navSidebar.addEventListener('click', (e) => {
                const navButton = e.target.closest('a.nav-button');
                if (navButton) {
                    e.preventDefault();
                    // No dirty check needed for the calculator
                    window.location.href = navButton.href;
                }
            });
        }

        // --- Setup Calculator Listeners ---
        const calculateButton = document.getElementById('calculateButton');
        if (calculateButton) {
            calculateButton.addEventListener('click', runCalculation);
        }

        // Add listeners to all inputs to recalculate on change
        const allInputs = [
            document.getElementById('constructionCost'),
            document.getElementById('engineeringCost'),
            document.getElementById('nrr'),
            document.getElementById('mrr'),
            document.getElementById('monthlyCost'),
            document.getElementById('term'),
            document.getElementById('targetIRR')
        ];

        allInputs.forEach(input => {
            if (input) {
                input.addEventListener('input', runCalculation);
            }
        });

        // Run the calculation on page load with the default values
        runCalculation();
    }

    // --- 4. Main Page Initialization ---
    async function initializePage() {
        // Load all SVGs first
        await loadSVGs();
        
        // Check session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            console.error('Authentication failed or no session found. Redirecting to login.');
            window.location.href = "index.html"; // Redirect to login
            return;
        }
        state.currentUser = session.user;

        try {
            // Setup all the shared UI elements
            await setupUserMenuAndAuth(supabase, state);
            await setupGlobalSearch(supabase, state.currentUser);
            await checkAndSetNotifications(supabase);
            
            // Setup the specific listeners for *this* page
            setupPageEventListeners();

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

    // --- 5. Run Initialization ---
    initializePage();
});

