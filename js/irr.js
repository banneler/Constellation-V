/**
 * IRR Calculator for Constellation CRM
 *
 * This script powers the irr.html page, providing all the logic
 * for calculating the Internal Rate of Return for fiber projects.
 */

// Wait for the DOM to be fully loaded before attaching listeners
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Get Element References ---
    // Inputs
    const constructionCostEl = document.getElementById('constructionCost');
    const engineeringCostEl = document.getElementById('engineeringCost');
    const nrrEl = document.getElementById('nrr');
    const mrrEl = document.getElementById('mrr');
    const monthlyCostEl = document.getElementById('monthlyCost');
    const termEl = document.getElementById('term');
    const targetIRREl = document.getElementById('targetIRR');
    
    // Button
    const calculateButton = document.getElementById('calculateButton');
    
    // Outputs
    const resultsDiv = document.getElementById('results');
    const decisionEl = document.getElementById('decision');
    const annualIRREl = document.getElementById('annualIRR');
    const errorMessageEl = document.getElementById('errorMessage');

    // --- 2. Attach Event Listeners ---
    if (calculateButton) {
        calculateButton.addEventListener('click', runCalculation);
    }

    // Add listeners to all inputs to recalculate on change for a live feel
    // (This is optional but a nice UX touch)
    const allInputs = [
        constructionCostEl, engineeringCostEl, nrrEl, 
        mrrEl, monthlyCostEl, termEl, targetIRREl
    ];
    allInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', runCalculation);
        }
    });

    // --- 3. Core Calculation Function ---
    function runCalculation() {
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
        
        // Month 0: Initial Investment
        const monthZeroCashFlow = nrr - (constructionCost + engineeringCost);
        cashFlows.push(monthZeroCashFlow);

        // Months 1 to Term
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

        // --- 4. Calculate IRR ---
        const monthlyIRR = calculateIRR(cashFlows);
        
        if (isNaN(monthlyIRR) || !isFinite(monthlyIRR)) {
            showError("Could not calculate IRR. The project may not have a valid return (e.g., all positive or all negative cash flows).");
            return;
        }

        // --- 5. Annualize and Display Results ---
        const annualIRR = Math.pow(1 + monthlyIRR, 12) - 1;
        showResults(annualIRR, targetIRR);
    }

    // --- 4. Helper Functions ---

    /**
     * Shows the results in the UI.
     * @param {number} annualIRR - The calculated annual IRR.
     * @param {number} targetIRR - The user's target IRR.
     */
    function showResults(annualIRR, targetIRR) {
        resultsDiv.classList.remove('hidden');
        errorMessageEl.classList.add('hidden');

        // Format as percentage
        annualIRREl.textContent = (annualIRR * 100).toFixed(2) + '%';
        
        // Make decision and apply styles
        // Using var() to pull from your site's CSS variables
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
            // If both are same sign, the bisection method won't work.
            // Let's try expanding the search range.
            maxRate = 5.0; // 500%
            npvAtMax = calculateNPV(maxRate, cashFlows);
            if (npvAtMin * npvAtMax > 0) {
                 minRate = -0.999999;
                 maxRate = 20.0; // 2000%
                 npvAtMin = calculateNPV(minRate, cashFlows);
                 npvAtMax = calculateNPV(maxRate, cashFlows);
                 
                 // If still failing, return NaN
                 if (npvAtMin * npvAtMax > 0) return NaN;
            }
        }

        for (let i = 0; i < maxIterations; i++) {
            midRate = (minRate + maxRate) / 2;
            let npvAtMid = calculateNPV(midRate, cashFlows);

            if (Math.abs(npvAtMid) < precision) {
                // Solution found
                return midRate;
            } else if (npvAtMid * npvAtMin > 0) {
                // Same sign as min, so move min to mid
                minRate = midRate;
                npvAtMin = npvAtMid;
            } else {
                // Opposite sign, so move max to mid
                maxRate = midRate;
            }
        }
        
        // Return the best guess after max iterations
        return midRate;
    }

    // --- 5. Initial Run ---
    // Run the calculation on page load with the default values
    runCalculation();
});
