// js/business-case.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './shared_constants.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- AUTHENTICATION CHECK ---
// This is the code that protects your other pages.
document.addEventListener("DOMContentLoaded", async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
        console.error("Error getting session:", error);
        window.location.href = "index.html"; // Redirect to login
        return;
    }
    
    if (!session) {
        console.log("No session found, redirecting to login.");
        window.location.href = "index.html"; // Redirect to login
        return;
    }
    
    console.log("Session found, loading calculator.");
    // If we have a session, run the calculator setup.
    initializeCalculator();
});


// --- CALCULATOR LOGIC ---
// We wrap all our old code in this new function
function initializeCalculator() {
    
    // --- DOM Elements ---
    const addLocationBtn = document.getElementById("add-location-btn");
    if (!addLocationBtn) {
        console.error("Calculator elements not found. Stopping.");
        return;
    }
    
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
            const capexMonth = Math.round(loc.constructionStartMonth);
            const billingEndMonth = Math.round(loc.billingStartMonth) + Math.round(loc.term) - 1;
            const lastEventMonth = Math.max(capexMonth, billingEndMonth);
            
            if (lastEventMonth > maxMonths) {
                maxMonths = lastEventMonth;
            }
        });
        
        if (maxMonths === 0) maxMonths = 60; 
        
        const cashFlow = new Array(maxMonths + 1).fill(0); 

        // 2. Populate the cash flow array
        locationsData.forEach(loc => {
            const capexMonth = Math.round(loc.constructionStartMonth);
            
            if (capexMonth >= 0 && capexMonth < cashFlow.length) {
                cashFlow[capexMonth] -= (loc.constructionCost + loc.engineeringCost);
            }

            const netMonthlyFlow = loc.monthlyRevenue - loc.monthlyRecurringCost;
            const start = Math.round(loc.billingStartMonth);
            const end = start + Math.round(loc.term);

            for (let month = start; month < end; month++) {
                if (month >= 0 && month < cashFlow.length) {
                    cashFlow[month] += netMonthlyFlow;
                }
            }
        });
        
        return cashFlow;
    }

    // --- Financial Calculation Functions ---

    /**
     * Calculates the Net Present Value (NPV) of a cash flow.
     */
    function calculateNPV(cashFlow, annualDiscountRate) {
        const monthlyRate = Math.pow(1 + annualDiscountRate, 1 / 12) - 1;
        
        if (monthlyRate === -1) { 
            return cashFlow[0] || 0; 
        }

        let npv = 0;
        for (let t = 1; t < cashFlow.length; t++) {
            npv += cashFlow[t] / Math.pow(1 + monthlyRate, t);
        }
        
        return npv + (cashFlow[0] || 0);
    }

    /**
     * Calculates the Payback Period.
     */
    function calculatePayback(cashFlow) {
        let cumulativeFlow = 0;
        // Sum ALL negative flows (not just month 0)
        let initialInvestment = cashFlow
            .filter(c => c < 0)
            .reduce((a, b) => a + b, 0);

        // If no investment, payback is immediate.
        if (initialInvestment === 0) {
             return { period: 0, isPositive: true };
        }
        
        // Use absolute value for comparison
        initialInvestment = Math.abs(initialInvestment);

        for (let month = 1; month < cashFlow.length; month++) {
            // Only count positive flows towards payback
            if (cashFlow[month] > 0) {
                cumulativeFlow += cashFlow[month];
            }
            
            if (cumulativeFlow >= initialInvestment) {
                return { period: month, isPositive: true };
            }
        }
        return { period: 0, isPositive: false }; // Never paid back
    }
    
    /**
     * Iteratively finds the Internal Rate of Return (IRR) for a series of cash flows.
     */
    function irrSolver(cashFlow) {
        const maxIterations = 1000;
        const precision = 1e-7;
        
        const npv = (rate) => {
            let val = 0;
            for (let t = 0; t < cashFlow.length; t++) {
                val += cashFlow[t] / Math.pow(1 + rate, t);
            }
            return val;
        };

        const hasPositive = cashFlow.some(v => v > 0);
        const hasNegative = cashFlow.some(v => v < 0);
        if (!hasPositive || !hasNegative) {
            return NaN;
        }

        let guess = 0.01; 
        let low = -0.99; 
        let high = 1;    
        
        for (let i = 0; i < maxIterations; i++) {
            const npvAtGuess = npv(guess);
            
            if (Math.abs(npvAtGuess) < precision) {
                return guess; 
            }

            const npvAtHigh = npv(high);
            
            if (npvAtGuess * npvAtHigh > 0) {
                high = guess;
            } else {
                low = guess;
            }
            
            guess = (low + high) / 2;

            if (Math.abs(high - low) < precision) {
                 return guess; 
            }
        }
        
        return NaN; 
    }

    // --- Formatting Helpers ---

    function formatCurrency(value) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(value);
    }
    
    // --- Initial Setup ---
    
    // Add one location card by default to get the user started
    addLocationBtn.click();
}
