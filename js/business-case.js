document.addEventListener("DOMContentLoaded", () => {
    
    // Check if we are on the business case page
    const addLocationBtn = document.getElementById("add-location-btn");
    if (!addLocationBtn) {
        // We are not on the calculator page, do nothing.
        return;
    }

    // --- DOM Elements ---
    const locationsContainer = document.getElementById("locations-container");
    const locationTemplate = document.getElementById("location-template");
    
    // Global inputs
    const discountRateInput = document.getElementById("discount-rate");

    // Result display elements
    const npvResultEl = document.getElementById("result-npv");
    const irrResultEl = document.getElementById("result-irr");
    const paybackResultEl = document.getElementById("result-payback");

    // --- Event Listeners ---
    
    // Add a new location card
    addLocationBtn.addEventListener("click", () => {
        const newLocationCard = locationTemplate.content.cloneNode(true);
        locationsContainer.appendChild(newLocationCard);
        
        // Add event listeners to the new card's inputs and remove button
        addListenersToCard(locationsContainer.lastElementChild);
        
        // Run calculation after adding
        calculate();
    });

    // Add listeners for global inputs
    discountRateInput.addEventListener("input", calculate);

    // --- Main Functions ---
    
    /**
     * Adds event listeners to all inputs and the remove button on a location card.
     * @param {HTMLElement} card - The location card element.
     */
    function addListenersToCard(card) {
        // Trigger calculation on any input change
        card.querySelectorAll(".calc-input").forEach(input => {
            input.addEventListener("input", calculate);
        });

        // Handle removing the card
        card.querySelector(".remove-location-btn").addEventListener("click", () => {
            card.remove();
            calculate(); // Re-calculate after removing
        });
    }

    /**
     * Main calculation function. Gathers all data and updates the UI.
     * This is the "controller" that runs everything.
     */
    function calculate() {
        try {
            const locationsData = getLocationData();
            const masterCashFlow = buildMasterCashFlow(locationsData);
            
            // 1. Calculate NPV
            const discountRate = parseFloat(discountRateInput.value) / 100 || 0;
            const npv = calculateNPV(masterCashFlow, discountRate);
            npvResultEl.textContent = formatCurrency(npv);
            npvResultEl.style.color = npv >= 0 ? 'var(--success-color)' : 'var(--danger-color)';


            // 2. Calculate IRR
            // We use the *monthly* IRR and annualize it, as per your Excel formula.
            const monthlyIRR = irrSolver(masterCashFlow);
            const annualIRR = Math.pow(1 + monthlyIRR, 12) - 1;
            
            if (isNaN(annualIRR) || !isFinite(annualIRR)) {
                irrResultEl.textContent = "N/A";
                irrResultEl.style.color = 'var(--text-secondary)';
            } else {
                irrResultEl.textContent = (annualIRR * 100).toFixed(2) + "%";
                irrResultEl.style.color = annualIRR >= discountRate ? 'var(--success-color)' : 'var(--danger-color)';
            }

            // 3. Calculate Payback Period
            const payback = calculatePayback(masterCashFlow);
            paybackResultEl.textContent = payback.isPositive ? `${payback.period} Months` : "Never";
            paybackResultEl.style.color = payback.isPositive ? 'var(--text-primary)' : 'var(--text-secondary)';


        } catch (error) {
            console.error("Error during calculation:", error);
            // You could display a user-friendly error here
        }
    }

    /**
     * Gathers all data from the location cards in the DOM.
     * @returns {Array} An array of location data objects.
     */
    function getLocationData() {
        const locationCards = locationsContainer.querySelectorAll(".location-card");
        const data = [];

        locationCards.forEach(card => {
            const inputs = card.querySelectorAll(".calc-input");
            const location = {};
            inputs.forEach(input => {
                // Use data-field attribute from HTML to build the object
                location[input.dataset.field] = parseFloat(input.value) || 0;
            });
            data.push(location);
        });
        return data;
    }

    /**
     * Builds a single, consolidated cash flow array from all location data.
     * @param {Array} locationsData - Array of location objects from getLocationData().
     * @returns {Array} The master cash flow array, where index = month (index 0 = "Month 0").
     */
    function buildMasterCashFlow(locationsData) {
        let maxMonths = 0;
        
        // 1. Find the total project length by finding the last "event"
        locationsData.forEach(loc => {
            // An event is either capex or the end of billing
            const capexMonth = Math.round(loc.constructionStartMonth);
            const billingEndMonth = Math.round(loc.billingStartMonth) + Math.round(loc.term) - 1;
            
            const lastEventMonth = Math.max(capexMonth, billingEndMonth);
            
            if (lastEventMonth > maxMonths) {
                maxMonths = lastEventMonth;
            }
        });
        
        // Ensure at least 60 months (5 years) for calculation if empty
        if (maxMonths === 0) maxMonths = 60; 
        
        // Create an array of 0s, +1 length for Month 0
        const cashFlow = new Array(maxMonths + 1).fill(0); 

        // 2. Populate the cash flow array
        locationsData.forEach(loc => {
            // Add one-time Capex (as negative values)
            // We use Math.round to ensure integer array indices
            const capexMonth = Math.round(loc.constructionStartMonth);
            
            // Note: The Excel model shows capex starting in Month 1, not 0.
            // If your `constructionStartMonth` input of "1" means index 1, this is correct.
            if (capexMonth > 0 && capexMonth < cashFlow.length) {
                cashFlow[capexMonth] -= (loc.constructionCost + loc.engineeringCost);
            }

            // Add recurring cash flows
            const netMonthlyFlow = loc.monthlyRevenue - loc.monthlyRecurringCost;
            const start = Math.round(loc.billingStartMonth);
            const end = start + Math.round(loc.term);

            for (let month = start; month < end; month++) {
                if (month < cashFlow.length) {
                    cashFlow[month] += netMonthlyFlow;
                }
            }
        });

        // Per your NPV formula =NPV(..., R42:DC42)+Q42
        // This implies Q42 (Month 0) is separate.
        // If your capex can happen in month 0, we need to adjust.
        // For now, I am assuming "Start Month 1" = index 1.
        // If "Construction Start Month" can be 0, let me know.
        
        return cashFlow;
    }

    // --- Financial Calculation Functions ---

    /**
     * Calculates the Net Present Value (NPV) of a cash flow.
     * Matches your Excel formula: =NPV(monthly_rate, future_cash_flows) + initial_investment
     * @param {Array} cashFlow - Cash flow array (index 0 = Month 0).
     * @param {number} annualDiscountRate - The annual rate (e.g., 0.10 for 10%).
     * @returns {number} The calculated NPV.
     */
    function calculateNPV(cashFlow, annualDiscountRate) {
        // Convert annual rate to monthly rate, matching your formula: ((1+$C$45)^(1/12)-1)
        const monthlyRate = Math.pow(1 + annualDiscountRate, 1 / 12) - 1;
        
        if (monthlyRate === -1) { // Avoid division by zero if rate is -100%
            return cashFlow[0] || 0; 
        }

        let npv = 0;
        // Start from t=1 for future cash flows, per NPV formula
        for (let t = 1; t < cashFlow.length; t++) {
            npv += cashFlow[t] / Math.pow(1 + monthlyRate, t);
        }
        
        // Add the initial investment (Month 0), which is not discounted
        return npv + (cashFlow[0] || 0);
    }

    /**
     * Calculates the Payback Period.
     * @param {Array} cashFlow - Cash flow array.
     * @returns {object} { period: number, isPositive: boolean }
     */
    function calculatePayback(cashFlow) {
        let cumulativeFlow = 0;
        let initialInvestment = Math.abs(cashFlow.filter(c => c < 0).reduce((a, b) => a + b, 0));
        
        // If there's no investment, payback is immediate.
        if (initialInvestment === 0) {
             return { period: 0, isPositive: true };
        }

        for (let month = 1; month < cashFlow.length; month++) {
            cumulativeFlow += cashFlow[month];
            
            // Check if cumulative positive flows have "paid back" the initial investment
            if (cumulativeFlow >= initialInvestment) {
                 // Simple payback (doesn't interpolate mid-month)
                return { period: month, isPositive: true };
            }
        }
        return { period: 0, isPositive: false }; // Never paid back
    }
    
    /**
     * Iteratively finds the Internal Rate of Return (IRR) for a series of cash flows.
     * This is a solver function that finds the discount rate where NPV is zero.
     * @param {Array} cashFlow - The cash flow array.
     * @returns {number} The *monthly* IRR (e.g., 0.015 for 1.5%).
     */
    function irrSolver(cashFlow) {
        const maxIterations = 1000;
        const precision = 1e-7;
        
        // NPV calculation function specific for the solver
        const npv = (rate) => {
            let val = 0;
            for (let t = 0; t < cashFlow.length; t++) {
                val += cashFlow[t] / Math.pow(1 + rate, t);
            }
            return val;
        };

        // Check for edge cases
        const hasPositive = cashFlow.some(v => v > 0);
        const hasNegative = cashFlow.some(v => v < 0);
        if (!hasPositive || !hasNegative) {
            return NaN; // IRR is not defined
        }

        let guess = 0.01; // Start with 1% monthly guess
        let low = -0.99; // Min possible rate (-99.9...%)
        let high = 1;    // Max possible rate (100%)
        
        // Use a bisection method (safer than Newton-Raphson for weird cash flows)
        for (let i = 0; i < maxIterations; i++) {
            const npvAtGuess = npv(guess);
            
            if (Math.abs(npvAtGuess) < precision) {
                return guess; // Found a solution
            }

            const npvAtHigh = npv(high);
            
            if (npvAtGuess * npvAtHigh > 0) {
                high = guess;
            } else {
                low = guess;
            }
            
            guess = (low + high) / 2;

            if (Math.abs(high - low) < precision) {
                 return guess; // Converged
            }
        }
        
        return NaN; // Failed to converge
    }

    // --- Formatting Helpers ---

    /**
     * Formats a number as USD currency.
     * @param {number} value - The number to format.
     * @returns {string} Formatted currency string.
     */
    function formatCurrency(value) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(value);
    }
    
    // --- Initial Setup ---
    
    // Add one location card by default to get the user started
    addLocationBtn.click();
});
