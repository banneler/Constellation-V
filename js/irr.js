/**
 * Multi-Site IRR Calculator for Constellation CRM (v7.3 - Product Cost Update)
 *
 * This script powers the irr.html page, managing multiple sites
 * as tabs and calculating a global IRR and Payback.
 *
 * Key features:
 * - Saves/Loads projects to/from Supabase 'irr_projects' table (includes business_case_start YYYY-MM; see sql/add_business_case_start_to_irr_projects.sql).
 * - Uses a single GLOBAL Target IRR for all calculations.
 * - Calculates and displays TCV, IRR, Payback, and Capital Investment.
 * - Exports a CSV with LIVE EXCEL FORMULAS for TCV, IRR, and Decision.
 * - Factors in SG&A (Commission) to all IRR calculations.
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
    formatDate,
    injectGlobalNavigation,
    updateActiveNavLink,
    showGlobalLoader,
    hideGlobalLoader
} from './shared_constants.js';

// Wait for the DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', async () => {

    // --- 1. Initialize Supabase and State ---
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const IRR_TABLE = 'irr_projects';
    
    let state = {
        currentUser: null,
        sites: [],
        nextSiteId: 1,
        activeSiteId: null,
        currentProjectId: null,
        isFormDirty: false
    };

    // --- 2. DOM Element References ---
    // Project Controls
    const newProjectBtn = document.getElementById('new-project-btn');
    const loadProjectBtn = document.getElementById('load-project-btn');
    const saveProjectBtn = document.getElementById('save-project-btn');
    const addSiteBtn = document.getElementById('add-site-btn');
    const printReportBtn = document.getElementById('print-report-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    
    // Project Inputs
    const projectNameInput = document.getElementById('project-name');
    const globalTargetIrrInput = document.getElementById('global-target-irr');
    const globalDiscountRateInput = document.getElementById('global-discount-rate');

    // Site Containers
    const siteTabsContainer = document.getElementById('site-tabs-container');
    const siteFormsContainer = document.getElementById('site-forms-container');
    const siteFormTemplate = document.getElementById('site-form-template');

    // Global Results Elements
    const globalAnnualIRREl = document.getElementById('global-annual-irr');
    const globalTcvEl = document.getElementById('global-tcv');
    const globalPaybackEl = document.getElementById('global-payback'); 
    const globalCapitalInvestmentEl = document.getElementById('global-capital-investment');
    const globalNpvEl = document.getElementById('global-npv');
    const globalErrorMessageEl = document.getElementById('global-error-message');

    // Load Modal Elements
    const loadProjectModal = document.getElementById('load-project-modal-backdrop');
    const loadProjectList = document.getElementById('load-project-list');
    const loadProjectCancelBtn = document.getElementById('load-project-cancel-btn');

    // Chart & Flip Card Elements
    const cashflowFlipCard = document.getElementById('cashflow-flip-card');
    const flipToSettingsBtn = document.getElementById('flip-to-settings-btn');
    const flipToChartBtn = document.getElementById('flip-to-chart-btn');
    const saveSettingsFlipBtn = document.getElementById('save-settings-flip-btn');
    const stressFlipCard = document.getElementById('stress-flip-card');
    const flipToAnnualTableBtn = document.getElementById('flip-to-annual-table-btn');
    const flipToStressBtn = document.getElementById('flip-to-stress-btn');
    const timelineTableContainer = document.getElementById('timeline-table-container');
    const annualCashflowTableContainer = document.getElementById('annual-cashflow-table-container');
    const stressCapexSlider = document.getElementById('stress-capex');
    const stressMrrSlider = document.getElementById('stress-mrr');
    const stressCapexValueEl = document.getElementById('stress-capex-value');
    const stressMrrValueEl = document.getElementById('stress-mrr-value');
    const stressResetBtn = document.getElementById('stress-reset-btn');
    const cashflowChartCanvas = document.getElementById('cashflow-chart');
    let cashflowChartInstance = null;

    /** Stress test modifiers: applied only during chart/table render; do not mutate state.sites */
    let stressModifiers = { capex: 1.0, mrr: 1.0 };

    function defaultBusinessCaseStartStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    const CALENDAR_MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    function buildMonthOptionsHtml(selectedTwoDigitMM) {
        const sel = (selectedTwoDigitMM && String(selectedTwoDigitMM).length === 2)
            ? selectedTwoDigitMM
            : String(new Date().getMonth() + 1).padStart(2, '0');
        return CALENDAR_MONTH_NAMES.map((name, i) => {
            const v = String(i + 1).padStart(2, '0');
            return `<option value="${v}"${v === sel ? ' selected' : ''}>${name}</option>`;
        }).join('');
    }

    function yyyyMmToMonthYearParts(iso) {
        const p = parseBusinessCaseStartMonth(String(iso || '').trim());
        const d = new Date();
        if (!p) {
            return { mm: String(d.getMonth() + 1).padStart(2, '0'), yyyy: d.getFullYear() };
        }
        return { mm: String(p.monthIndex0 + 1).padStart(2, '0'), yyyy: p.year };
    }

    /** Reads business case start from month name select + year field (stored/saved as YYYY-MM). */
    function getBusinessCaseStartStr() {
        const mEl = document.getElementById('business-case-start-month');
        const yEl = document.getElementById('business-case-start-year');
        if (!mEl || !yEl) return defaultBusinessCaseStartStr();
        const mm = (mEl.value || '').trim();
        const y = parseInt(yEl.value, 10);
        if (!/^(0[1-9]|1[0-2])$/.test(mm) || !Number.isFinite(y) || y < 2000 || y > 2100) {
            return defaultBusinessCaseStartStr();
        }
        return `${y}-${mm}`;
    }

    function setBusinessCaseStartFromYYYYMM(yyyyMm) {
        const p = parseBusinessCaseStartMonth(String(yyyyMm || '').trim())
            || parseBusinessCaseStartMonth(defaultBusinessCaseStartStr());
        const mEl = document.getElementById('business-case-start-month');
        const yEl = document.getElementById('business-case-start-year');
        if (mEl) mEl.value = String(p.monthIndex0 + 1).padStart(2, '0');
        if (yEl) yEl.value = String(p.year);
    }

    function parseBusinessCaseStartMonth(str) {
        if (!str || typeof str !== 'string') return null;
        const m = str.match(/^(\d{4})-(\d{2})$/);
        if (!m) return null;
        const year = parseInt(m[1], 10);
        const monthNum = parseInt(m[2], 10);
        if (monthNum < 1 || monthNum > 12) return null;
        return { year, monthIndex0: monthNum - 1 };
    }

    /** Model month 0 = Roger column Q; drives calendar-year rollups and print timeline labels. */
    function getBusinessCaseStartParsed() {
        const parsed = parseBusinessCaseStartMonth(getBusinessCaseStartStr());
        if (parsed) return parsed;
        return parseBusinessCaseStartMonth(defaultBusinessCaseStartStr());
    }

    function sumMonthlySeriesIntoCalendarYearMap(monthlySeries, maxMonthIndex, baseYear, baseMonth0) {
        const map = new Map();
        for (let mi = 0; mi <= maxMonthIndex; mi++) {
            const d = new Date(baseYear, baseMonth0 + mi, 1);
            const calYear = d.getFullYear();
            const v = monthlySeries[mi] || 0;
            map.set(calYear, (map.get(calYear) || 0) + v);
        }
        return map;
    }

    function sortedCalendarYearsFromMap(map) {
        return Array.from(map.keys()).sort((a, b) => a - b);
    }

    function formatModelMonthAsCalendarLabel(baseYear, baseMonth0, modelMonthOffset) {
        const mo = Math.max(0, parseInt(modelMonthOffset, 10) || 0);
        const d = new Date(baseYear, baseMonth0 + mo, 1);
        const mon = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return `${mon} (M${mo})`;
    }

    /** Shift YYYY-MM by delta months (calendar). */
    function addMonthsToYYYYMM(yyyyMm, deltaMonths) {
        const p = parseBusinessCaseStartMonth(yyyyMm);
        if (!p) return defaultBusinessCaseStartStr();
        const d = new Date(p.year, p.monthIndex0 + deltaMonths, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    function totalMonthsSinceYearZero(y, monthIndex0) {
        return y * 12 + monthIndex0;
    }

    /**
     * Maps timeline (calendar month pickers + duration) to 0-based model month indices vs business case start.
     * Prefers constructionStartMonthISO / billingStartMonthISO; falls back to legacy numeric indices.
     */
    function resolveTimelineToModelMonths(timeline, businessCaseStartStr) {
        const bcs = parseBusinessCaseStartMonth(String(businessCaseStartStr || '').trim())
            || parseBusinessCaseStartMonth(defaultBusinessCaseStartStr());
        const bcsTm = totalMonthsSinceYearZero(bcs.year, bcs.monthIndex0);

        let constructionStartMonth;
        const cIso = timeline?.constructionStartMonthISO?.trim();
        if (cIso && parseBusinessCaseStartMonth(cIso)) {
            const t = parseBusinessCaseStartMonth(cIso);
            constructionStartMonth = totalMonthsSinceYearZero(t.year, t.monthIndex0) - bcsTm;
        } else {
            constructionStartMonth = Math.max(0, parseInt(timeline?.constructionStartMonth, 10) || 0);
        }

        let billingStartMonth;
        const bIso = timeline?.billingStartMonthISO?.trim();
        if (bIso && parseBusinessCaseStartMonth(bIso)) {
            const t = parseBusinessCaseStartMonth(bIso);
            billingStartMonth = totalMonthsSinceYearZero(t.year, t.monthIndex0) - bcsTm;
        } else {
            billingStartMonth = Math.max(0, parseInt(timeline?.billingStartMonth, 10) || 0);
        }

        const constructionDurationMonths = Math.max(
            1,
            parseInt(timeline?.constructionDurationMonths, 10) || Math.max(1, billingStartMonth - constructionStartMonth)
        );

        if (constructionStartMonth < 0) {
            return {
                constructionStartMonth: 0,
                billingStartMonth: 0,
                constructionDurationMonths,
                error: 'Construction start must be on or after the business case start month.',
            };
        }
        if (billingStartMonth < 0) {
            return {
                constructionStartMonth,
                billingStartMonth: 0,
                constructionDurationMonths,
                error: 'Billing start must be on or after the business case start month.',
            };
        }
        if (billingStartMonth < constructionStartMonth) {
            return {
                constructionStartMonth,
                billingStartMonth,
                constructionDurationMonths,
                error: 'Billing start must be on or after construction start.',
            };
        }

        return { constructionStartMonth, billingStartMonth, constructionDurationMonths, error: null };
    }

    /** For loaded projects: derive month pickers from legacy numeric indices + business case start. */
    function ensureSiteTimelineISOFromLegacy(site, businessCaseStartStr) {
        if (!site.timeline) {
            site.timeline = { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 };
        }
        const bcs = parseBusinessCaseStartMonth(String(businessCaseStartStr || '').trim())
            || parseBusinessCaseStartMonth(defaultBusinessCaseStartStr());
        const baseStr = `${bcs.year}-${String(bcs.monthIndex0 + 1).padStart(2, '0')}`;
        if (!site.timeline.constructionStartMonthISO || !parseBusinessCaseStartMonth(site.timeline.constructionStartMonthISO)) {
            site.timeline.constructionStartMonthISO = addMonthsToYYYYMM(
                baseStr,
                Math.max(0, parseInt(site.timeline.constructionStartMonth, 10) || 0)
            );
        }
        if (!site.timeline.billingStartMonthISO || !parseBusinessCaseStartMonth(site.timeline.billingStartMonthISO)) {
            site.timeline.billingStartMonthISO = addMonthsToYYYYMM(
                baseStr,
                Math.max(0, parseInt(site.timeline.billingStartMonth, 10) || 0)
            );
        }
    }

    function formatTimelineMonthISOForDisplay(yyyyMm) {
        const p = parseBusinessCaseStartMonth(String(yyyyMm || '').trim());
        if (!p) return '—';
        const d = new Date(p.year, p.monthIndex0, 1);
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    // Dial elements
    const dialFill = document.querySelector('.irr-dial-fill');
    const DIAL_CIRCUMFERENCE = 2 * Math.PI * 52; // r=52

    function updateDialVisual() {
        if (!dialFill) return;
        const val = Math.min(Math.max(parseFloat(globalTargetIrrInput?.value) || 0, 0), 100);
        const offset = DIAL_CIRCUMFERENCE * (1 - val / 100);
        dialFill.style.strokeDashoffset = offset;
        if (val >= 20) {
            dialFill.style.stroke = 'var(--completed-color)';
        } else if (val >= 10) {
            dialFill.style.stroke = 'var(--primary-blue)';
        } else {
            dialFill.style.stroke = 'var(--danger-red)';
        }
    }

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
            if (globalDiscountRateInput) globalDiscountRateInput.value = '15';
            setBusinessCaseStartFromYYYYMM(defaultBusinessCaseStartStr());
            updateDialVisual();

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
            id: newSiteId,
            name: siteName,
            inputs: {
                constructionCost: 100000,
                engineeringCost: 20000,
                productCost: 0,
                monthlyCost: 500,
                nrr: 5000,
                mrr: 3000,
                term: 60,
            },
            timeline: (() => {
                const bcs = getBusinessCaseStartStr();
                const bp = parseBusinessCaseStartMonth(bcs) || parseBusinessCaseStartMonth(defaultBusinessCaseStartStr());
                const baseStr = `${bp.year}-${String(bp.monthIndex0 + 1).padStart(2, '0')}`;
                return {
                    constructionStartMonth: 0,
                    billingStartMonth: 1,
                    constructionDurationMonths: 3,
                    constructionStartMonthISO: baseStr,
                    billingStartMonthISO: addMonthsToYYYYMM(baseStr, 1),
                };
            })(),
            result: {
                annualIRR: null,
                npv: null,
                tcv: 0,
                payback: null,
                paybackRogerMonth: null,
                paybackRatio: null,
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
                const hurdle = (parseFloat(globalTargetIrrInput?.value) || 0) / 100;
                resultClass = site.result.annualIRR >= hurdle ? 'go' : 'nogo';
                resultText = `${(site.result.annualIRR * 100).toFixed(2)}%`;
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
     * Calculates IRR & Payback for a single site, updates its state, and updates its UI.
     * @param {number} siteId - The ID of the site to calculate
     * @param {boolean} [runGlobal=true] - Whether to trigger a global recalculation
     */
    function runSiteCalculation(siteId, runGlobal = true) {
        const site = state.sites.find(s => s.id === siteId);
        if (!site) return;

        const globalTargetIRR = (parseFloat(globalTargetIrrInput.value) || 0) / 100;
        const globalDiscountRate = (parseFloat(globalDiscountRateInput?.value) || 15) / 100;

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
        
        const annualIRREl = resultsContainer.querySelector('.individual-annual-irr');
        const tcvEl = resultsContainer.querySelector('.individual-tcv');
        const npvEl = resultsContainer.querySelector('.individual-npv');
        const paybackEl = resultsContainer.querySelector('.individual-payback');
        const errorMessageEl = resultsContainer.querySelector('.individual-error-message');

        if (!annualIRREl || !tcvEl || !npvEl || !errorMessageEl || !paybackEl) {
            console.error(`runSiteCalculation: Missing results elements for siteId ${siteId}`);
            return;
        }

        // 1. Read inputs from DOM and save to state
        site.name = formWrapper.querySelector('.site-name-input').value || `Site ${site.id}`;
        site.inputs.term = parseInt(formWrapper.querySelector('.term-input').value) || 0; // <-- MOVED
        site.inputs.constructionCost = parseFloat(formWrapper.querySelector('.construction-cost-input').value) || 0;
        site.inputs.engineeringCost = parseFloat(formWrapper.querySelector('.engineering-cost-input').value) || 0;
        site.inputs.productCost = parseFloat(formWrapper.querySelector('.product-cost-input').value) || 0; // <-- NEW
        site.inputs.monthlyCost = parseFloat(formWrapper.querySelector('.monthly-cost-input').value) || 0;
        site.inputs.nrr = parseFloat(formWrapper.querySelector('.nrr-input').value) || 0;
        site.inputs.mrr = parseFloat(formWrapper.querySelector('.mrr-input').value) || 0;
        
        // 2. Calculate TCV
        const siteTCV = (site.inputs.mrr * site.inputs.term) + site.inputs.nrr;
        site.result.tcv = siteTCV;

        // 3. Calculate Payback
        if (!site.timeline) {
            site.timeline = { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 };
        }

        const { paybackMonths, paybackRogerMonth, paybackRatio, error: paybackError } = getPaybackForSite(site.inputs, site.timeline);
            site.result.payback = paybackMonths;
            site.result.paybackRogerMonth = paybackRogerMonth;
            site.result.paybackRatio = paybackRatio;

        // 4. Calculate IRR
        const { cashFlows, error: validationError } = getCashFlowsForSite(site.inputs, site.timeline);

        // 5. Update State & UI
        const combinedError = validationError || paybackError;
        if (combinedError) {
            site.result.error = combinedError;
            site.result.annualIRR = null;
            site.result.npv = null;
            site.result.paybackRogerMonth = null;
            showSiteError(errorMessageEl, annualIRREl, tcvEl, npvEl, paybackEl, combinedError);
        } else {
            const monthlyIRR = calculateIRR(cashFlows);
            if (isNaN(monthlyIRR) || !isFinite(monthlyIRR)) {
                site.result.error = "Could not calculate IRR. Check inputs.";
                site.result.annualIRR = null;
                site.result.npv = null;
                site.result.paybackRogerMonth = null;
                showSiteError(errorMessageEl, annualIRREl, tcvEl, npvEl, paybackEl, site.result.error);
            } else {
                site.result.error = null;
                site.result.annualIRR = Math.pow(1 + monthlyIRR, 12) - 1;
                site.result.npv = calculateNPV(globalDiscountRate, cashFlows);
                const irrDisplayState = site.result.annualIRR >= globalTargetIRR ? 'go' : 'nogo';
                showSiteResults(
                    errorMessageEl, annualIRREl, tcvEl, npvEl, paybackEl,
                    site.result.annualIRR, irrDisplayState, site.result.tcv,
                    site.result.npv, site.result.payback, site.inputs.term, site.result.paybackRatio,
                    site.result.paybackRogerMonth
                );
            }
        }
        
        renderTabs();
        setActiveSite(site.id);  
        
        if (runGlobal) {
            runGlobalCalculation();
        }
    }

    /**
     * Calculates the combined IRR, TCV, and Payback for *all* sites.
     */
    function runGlobalCalculation() {
        let maxTerm = 0;
        let maxFlowLength = 0;
        let globalTCV = 0;
        let totalGlobalConstructionCost = 0;
        let totalGlobalEngineeringCost = 0;
        let totalGlobalProductCost = 0;

        if (state.sites.length === 0) {
            showGlobalResults(NaN, 0, 0, null, null, 0, null, 0, null);
            return;
        }

        const globalTargetIRR = (parseFloat(globalTargetIrrInput.value) || 0) / 100;
        const globalDiscountRate = (parseFloat(globalDiscountRateInput?.value) || 15) / 100;
        const siteCashFlowBundles = [];

        for (const site of state.sites) {
            if (!site.timeline) {
                site.timeline = { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 };
            }
            if (site.inputs.term > maxTerm) {
                maxTerm = site.inputs.term;
            }
            globalTCV += site.result.tcv || 0;
            totalGlobalConstructionCost += site.inputs.constructionCost || 0;
            totalGlobalEngineeringCost += site.inputs.engineeringCost || 0;
            totalGlobalProductCost += site.inputs.productCost || 0;

            const flowResult = getCashFlowsForSite(site.inputs, site.timeline);
            if (flowResult.error) {
                showGlobalError(flowResult.error);
                setPaybackUI(globalPaybackEl, null, maxTerm, null, null);
                return;
            }
            siteCashFlowBundles.push(flowResult.cashFlows);
            if (flowResult.cashFlows.length > maxFlowLength) {
                maxFlowLength = flowResult.cashFlows.length;
            }
        }

        const totalGlobalCapitalInvestment = totalGlobalConstructionCost + totalGlobalEngineeringCost + totalGlobalProductCost;
        const globalCashFlows = new Array(Math.max(maxFlowLength, 1)).fill(0);
        for (const flows of siteCashFlowBundles) {
            for (let i = 0; i < flows.length; i++) {
                globalCashFlows[i] += flows[i];
            }
        }

        const { paybackMonths: globalPaybackMonths, paybackRogerMonth: globalPaybackRogerMonth, paybackRatio: globalPaybackRatio } =
            getPaybackFromCashFlows(globalCashFlows, maxTerm);

        const hasNegative = globalCashFlows.some(cf => cf < 0);
        const hasPositive = globalCashFlows.some(cf => cf > 0);
        if (!hasNegative || !hasPositive) {
            showGlobalError("Global project must include at least one investment outflow and one positive inflow.");
            setPaybackUI(globalPaybackEl, globalPaybackMonths, maxTerm, globalPaybackRatio, globalPaybackRogerMonth);
            return;
        }

        const globalMonthlyIRR = calculateIRR(globalCashFlows);
        const globalNPV = calculateNPV(globalDiscountRate, globalCashFlows);

        showGlobalResults(
            globalMonthlyIRR,
            globalTargetIRR,
            globalTCV,
            globalPaybackMonths,
            globalPaybackRogerMonth,
            maxTerm,
            globalPaybackRatio,
            totalGlobalCapitalInvestment,
            globalNPV
        );

        renderCashflowChart();
        renderAnnualTable();
    }

    /**
     * Renders the per-site timeline settings table on the flip card back.
     */
    function renderTimelineTable() {
        if (!timelineTableContainer) return;
        if (state.sites.length === 0) {
            timelineTableContainer.innerHTML = '<p style="color: var(--text-medium); text-align: center;">No sites yet.</p>';
            return;
        }

        const bcsMin = getBusinessCaseStartStr();

        let html = `<table class="timeline-table">
            <thead><tr>
                <th>Site</th>
                <th>Construction start</th>
                <th>Duration (mo)</th>
                <th>Billing start</th>
            </tr></thead><tbody>`;

        state.sites.forEach(site => {
            if (!site.timeline) site.timeline = { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 };
            if (!site.timeline.constructionDurationMonths || site.timeline.constructionDurationMonths < 1) {
                site.timeline.constructionDurationMonths = 3;
            }
            ensureSiteTimelineISOFromLegacy(site, bcsMin);
            const cParts = yyyyMmToMonthYearParts(site.timeline.constructionStartMonthISO);
            const bParts = yyyyMmToMonthYearParts(site.timeline.billingStartMonthISO);
            html += `<tr>
                <td class="site-name-cell" title="${site.name}">${site.name}</td>
                <td class="timeline-split-cell">
                    <div class="timeline-date-split">
                        <select class="timeline-cal-month" data-site-id="${site.id}" data-cal-kind="construction" aria-label="Construction start month">${buildMonthOptionsHtml(cParts.mm)}</select>
                        <input type="number" class="timeline-cal-year" data-site-id="${site.id}" data-cal-kind="construction" min="2000" max="2100" step="1" value="${cParts.yyyy}" aria-label="Construction start year">
                    </div>
                </td>
                <td><input type="number" min="1" value="${site.timeline.constructionDurationMonths}" data-site-id="${site.id}" data-field="constructionDurationMonths" aria-label="Construction duration months"></td>
                <td class="timeline-split-cell">
                    <div class="timeline-date-split">
                        <select class="timeline-cal-month" data-site-id="${site.id}" data-cal-kind="billing" aria-label="Billing start month">${buildMonthOptionsHtml(bParts.mm)}</select>
                        <input type="number" class="timeline-cal-year" data-site-id="${site.id}" data-cal-kind="billing" min="2000" max="2100" step="1" value="${bParts.yyyy}" aria-label="Billing start year">
                    </div>
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
        timelineTableContainer.innerHTML = html;

        function syncTimelineIndicesFromISO(site) {
            const r = resolveTimelineToModelMonths(site.timeline, getBusinessCaseStartStr());
            if (!r.error) {
                site.timeline.constructionStartMonth = r.constructionStartMonth;
                site.timeline.billingStartMonth = r.billingStartMonth;
                site.timeline.constructionDurationMonths = r.constructionDurationMonths;
            }
        }

        function readCalISOFromRow(row, kind) {
            if (!row) return null;
            const sel = row.querySelector(`select.timeline-cal-month[data-cal-kind="${kind}"]`);
            const yIn = row.querySelector(`input.timeline-cal-year[data-cal-kind="${kind}"]`);
            if (!sel || !yIn) return null;
            const mm = (sel.value || '').trim();
            const y = parseInt(yIn.value, 10);
            if (!/^(0[1-9]|1[0-2])$/.test(mm) || !Number.isFinite(y) || y < 2000 || y > 2100) return null;
            return `${y}-${mm}`;
        }

        timelineTableContainer.addEventListener('change', (e) => {
            const t = e.target;
            if (t.matches?.('select.timeline-cal-month')) {
                const row = t.closest('tr');
                const siteId = Number(t.dataset.siteId);
                const kind = t.dataset.calKind;
                const site = state.sites.find(s => s.id === siteId);
                if (!site) return;
                if (!site.timeline) site.timeline = { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 };
                const iso = readCalISOFromRow(row, kind);
                if (iso) {
                    if (kind === 'construction') site.timeline.constructionStartMonthISO = iso;
                    else if (kind === 'billing') site.timeline.billingStartMonthISO = iso;
                }
                syncTimelineIndicesFromISO(site);
                state.isFormDirty = true;
                runSiteCalculation(siteId, true);
            }
            if (t.matches?.('input.timeline-cal-year')) {
                const row = t.closest('tr');
                const siteId = Number(t.dataset.siteId);
                const kind = t.dataset.calKind;
                const site = state.sites.find(s => s.id === siteId);
                if (!site) return;
                if (!site.timeline) site.timeline = { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 };
                const iso = readCalISOFromRow(row, kind);
                if (iso) {
                    if (kind === 'construction') site.timeline.constructionStartMonthISO = iso;
                    else if (kind === 'billing') site.timeline.billingStartMonthISO = iso;
                }
                syncTimelineIndicesFromISO(site);
                state.isFormDirty = true;
                runSiteCalculation(siteId, true);
            }
            if (t.matches?.('input[data-field="constructionDurationMonths"]')) {
                const siteId = Number(t.dataset.siteId);
                const site = state.sites.find(s => s.id === siteId);
                if (site) {
                    if (!site.timeline) site.timeline = { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 };
                    site.timeline.constructionDurationMonths = Math.max(1, parseInt(t.value, 10) || 1);
                    syncTimelineIndicesFromISO(site);
                    state.isFormDirty = true;
                    runSiteCalculation(siteId, true);
                }
            }
        });

        timelineTableContainer.addEventListener('input', (e) => {
            const t = e.target;
            if (!t.matches?.('input.timeline-cal-year')) return;
            const row = t.closest('tr');
            const siteId = Number(t.dataset.siteId);
            const kind = t.dataset.calKind;
            const site = state.sites.find(s => s.id === siteId);
            if (!site) return;
            if (!site.timeline) site.timeline = { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 };
            const iso = readCalISOFromRow(row, kind);
            if (iso) {
                if (kind === 'construction') site.timeline.constructionStartMonthISO = iso;
                else if (kind === 'billing') site.timeline.billingStartMonthISO = iso;
            }
            syncTimelineIndicesFromISO(site);
            state.isFormDirty = true;
            runSiteCalculation(siteId, true);
        });
    }

    function buildCashFlowComponentsForSite(inputs, timeline = { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 }) {
        const {
            nrr = 0,
            constructionCost = 0,
            engineeringCost = 0,
            productCost = 0,
            mrr = 0,
            monthlyCost = 0,
            term = 0
        } = inputs || {};

        const termMonths = parseInt(term, 10) || 0;
        const bcsStr = getBusinessCaseStartStr();
        const resolved = resolveTimelineToModelMonths(timeline, bcsStr);
        if (resolved.error) return { error: resolved.error };

        const { constructionStartMonth, billingStartMonth, constructionDurationMonths } = resolved;
        if (termMonths <= 0) return { error: "Term must be > 0" };

        const capexTotal = (constructionCost || 0) + (engineeringCost || 0) + (productCost || 0);
        // Keep requested SG&A model: 3% of NRR + 1x MRR.
        const sgaTotal = ((nrr || 0) * 0.03) + (mrr || 0);
        const constructionMonths = constructionDurationMonths;
        // SG&A is split across two model months (Roger-style); when billing starts at month 0,
        // still use months 0 and 1 — not 100% in 0 — so length may need at least 2 even for term 1.
        let minSeriesTail = billingStartMonth + termMonths;
        if (sgaTotal !== 0 && billingStartMonth === 0) {
            minSeriesTail = Math.max(minSeriesTail, 2);
        }
        const requiredLength = Math.max(
            constructionStartMonth + constructionMonths,
            minSeriesTail,
            billingStartMonth + 1
        );

        const revenue = new Array(requiredLength).fill(0);
        const cos = new Array(requiredLength).fill(0);
        const sga = new Array(requiredLength).fill(0);
        const capex = new Array(requiredLength).fill(0);

        if (capexTotal !== 0) {
            const capexPerMonth = capexTotal / constructionMonths;
            for (let month = constructionStartMonth; month < constructionStartMonth + constructionMonths; month++) {
                capex[month] += capexPerMonth;
            }
        }

        if (sgaTotal !== 0) {
            if (billingStartMonth > 0) {
                sga[billingStartMonth - 1] += sgaTotal / 2;
                sga[billingStartMonth] += sgaTotal / 2;
            } else {
                sga[0] += sgaTotal / 2;
                sga[1] += sgaTotal / 2;
            }
        }

        // NRC/NRR is recognized in billing start month in Roger's workbook model.
        revenue[billingStartMonth] += (nrr || 0);
        for (let month = billingStartMonth; month < billingStartMonth + termMonths; month++) {
            revenue[month] += (mrr || 0);
            cos[month] += (monthlyCost || 0);
        }

        const cashFlows = new Array(requiredLength).fill(0);
        for (let month = 0; month < requiredLength; month++) {
            cashFlows[month] = revenue[month] - cos[month] - sga[month] - capex[month];
        }

        const hasNegative = cashFlows.some(cf => cf < 0);
        const hasPositive = cashFlows.some(cf => cf > 0);
        if (!hasNegative || !hasPositive) {
            return { revenue, cos, sga, capex, cashFlows, error: "Cash flows must include both investment outflow and positive inflow." };
        }

        return { revenue, cos, sga, capex, cashFlows, error: null };
    }

    /**
     * Shared Chart.js data/options for on-screen chart and print export (same series as global NPV).
     * @returns {{ chartData: object, chartOptions: object } | null}
     */
    function getCashflowChartPayload() {
        if (state.sites.length === 0) return null;

        let maxMonth = 0;
        const siteFlowArrays = [];
        const chartBcs = getBusinessCaseStartStr();
        state.sites.forEach(site => {
            ensureSiteTimelineISOFromLegacy(site, chartBcs);
            const tl = site.timeline || { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 };
            const { cashFlows, error } = getStressedCashFlowsForSite(site.inputs || {}, tl);
            if (error || cashFlows.length === 0) return;
            siteFlowArrays.push(cashFlows);
            maxMonth = Math.max(maxMonth, cashFlows.length - 1);
        });

        if (siteFlowArrays.length === 0) return null;

        const monthlyTotals = new Array(maxMonth + 1).fill(0);
        for (let m = 0; m <= maxMonth; m++) {
            siteFlowArrays.forEach(flows => {
                monthlyTotals[m] += (flows[m] || 0);
            });
        }

        const labels = [];
        const cumulativeData = [];
        let cumulative = 0;
        for (let m = 0; m <= maxMonth; m++) {
            labels.push(m);
            cumulative += (monthlyTotals[m] || 0);
            cumulativeData.push(cumulative);
        }

        const breakEvenMonth = cumulativeData.findIndex(v => v >= 0);
        const textMedium = getComputedStyle(document.body).getPropertyValue('--text-medium').trim() || '#6b7280';

        const pointColors = cumulativeData.map((v, i) => {
            if (i === breakEvenMonth) return '#22c55e';
            return v < 0 ? '#ef4444' : '#22c55e';
        });

        const chartData = {
            labels,
            datasets: [{
                label: 'Cumulative Cash Flow ($)',
                data: cumulativeData,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: pointColors,
                borderWidth: 2,
            }]
        };

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const raw = items[0]?.label;
                            const modelMonth = Number(raw);
                            if (!Number.isFinite(modelMonth)) return `Month ${raw}`;
                            const bcs = getBusinessCaseStartParsed();
                            const d = new Date(bcs.year, bcs.monthIndex0 + modelMonth, 1);
                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                            const yy = String(d.getFullYear() % 100).padStart(2, '0');
                            return `Month ${modelMonth} · ${mm}/${yy}`;
                        },
                        label: (item) => `Cash Flow: $${item.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    }
                },
                annotation: {
                    annotations: {
                        zeroLine: {
                            type: 'line', yMin: 0, yMax: 0,
                            borderColor: 'rgba(107, 114, 128, 0.5)', borderWidth: 2, borderDash: [6, 4],
                            label: {
                                content: 'Break Even',
                                display: breakEvenMonth > 0,
                                position: 'start',
                                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                                font: { size: 11 }
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Month', color: textMedium },
                    ticks: { color: textMedium, maxTicksLimit: 12 },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                y: {
                    title: { display: true, text: 'Cumulative ($)', color: textMedium },
                    ticks: { color: textMedium, callback: (val) => '$' + val.toLocaleString() },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                }
            }
        };

        return { chartData, chartOptions };
    }

    function cashflowPrintDataUrlLooksValid(url) {
        if (typeof url !== 'string') return false;
        if (!/^data:image\/png(;|$)/i.test(url)) return false;
        const base64 = url.split(',')[1] || '';
        return base64.replace(/\s/g, '').length > 80;
    }

    /**
     * Plain Canvas2D cumulative line when Chart.js export fails (still a readable print chart).
     */
    function drawCumulativeCashflowFallbackOnCanvas(canvas, cumulativeData) {
        const W = canvas.width;
        const H = canvas.height;
        const ctx = canvas.getContext('2d');
        if (!ctx || !cumulativeData?.length) return false;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        const padL = 56;
        const padR = 24;
        const padT = 40;
        const padB = 52;
        const plotW = W - padL - padR;
        const plotH = H - padT - padB;
        let minY = Math.min(0, ...cumulativeData);
        let maxY = Math.max(0, ...cumulativeData);
        if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return false;
        if (Math.abs(maxY - minY) < 1e-9) {
            minY -= 1;
            maxY += 1;
        }
        const n = cumulativeData.length;
        const xAt = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
        const yAt = (v) => padT + (1 - (v - minY) / (maxY - minY)) * plotH;
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        const zy = yAt(0);
        if (zy >= padT && zy <= padT + plotH) {
            ctx.beginPath();
            ctx.moveTo(padL, zy);
            ctx.lineTo(padL + plotW, zy);
            ctx.stroke();
        }
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const x = xAt(i);
            const y = yAt(cumulativeData[i]);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.font = '14px system-ui,sans-serif';
        ctx.fillText('Cumulative cash flow ($)', padL, 26);
        return true;
    }

    function cumulativeSeriesToPngDataUrl(cumulativeData) {
        if (!cumulativeData?.length) return '';
        const W = 1280;
        const H = 600;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        if (!drawCumulativeCashflowFallbackOnCanvas(canvas, cumulativeData)) return '';
        try {
            const url = canvas.toDataURL('image/png');
            return cashflowPrintDataUrlLooksValid(url) ? url : '';
        } catch (_) {
            return '';
        }
    }

    /**
     * Renders the same series as the UI chart on a fixed-size off-DOM canvas — avoids flip-card
     * flex sizing (often 0×0 bitmap) breaking canvas.toDataURL for PDF/print.
     */
    async function captureCashflowChartForPrintDataUrl() {
        const payload = getCashflowChartPayload();
        if (!payload || typeof Chart === 'undefined') return '';

        const W = 1280;
        const H = 600;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        canvas.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0.01;pointer-events:none';
        const chartExportSink = document.getElementById('irr-offscreen-chart-export');
        (chartExportSink || document.body).appendChild(canvas);

        const srcPlugins = payload.chartOptions.plugins || {};
        const exportPlugins = { ...srcPlugins, tooltip: { enabled: false }, legend: { display: false } };
        delete exportPlugins.annotation;
        const exportOptions = {
            ...payload.chartOptions,
            plugins: exportPlugins,
            responsive: false,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            transitions: { active: { animation: { duration: 0 } } },
            devicePixelRatio: 1,
        };

        let exportChart = null;
        try {
            exportChart = new Chart(canvas, {
                type: 'line',
                data: payload.chartData,
                options: exportOptions,
            });
            exportChart.update('none');
            await new Promise((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            });
            await new Promise((r) => setTimeout(r, 120));
            let url = '';
            try {
                url = canvas.toDataURL('image/png');
            } catch (e1) {
                console.warn('Print chart: canvas.toDataURL failed:', e1);
            }
            if (!cashflowPrintDataUrlLooksValid(url) && typeof exportChart.toBase64Image === 'function') {
                try {
                    const b64 = exportChart.toBase64Image('image/png', 1);
                    if (cashflowPrintDataUrlLooksValid(b64)) url = b64;
                } catch (e2) {
                    console.warn('Print chart: toBase64Image failed:', e2);
                }
            }
            if (cashflowPrintDataUrlLooksValid(url)) return url;

            try {
                exportChart.destroy();
            } catch (_) { /* ignore */ }
            exportChart = null;
            if (drawCumulativeCashflowFallbackOnCanvas(canvas, payload.chartData.datasets[0].data)) {
                try {
                    url = canvas.toDataURL('image/png');
                    if (cashflowPrintDataUrlLooksValid(url)) return url;
                } catch (e3) {
                    console.warn('Print chart: fallback toDataURL failed:', e3);
                }
            }
            console.warn('Print chart: export produced no usable PNG (Chart + fallback).');
            return '';
        } catch (e) {
            console.warn('Offscreen cashflow chart export failed:', e);
            try {
                if (drawCumulativeCashflowFallbackOnCanvas(canvas, payload.chartData.datasets[0].data)) {
                    const url = canvas.toDataURL('image/png');
                    if (cashflowPrintDataUrlLooksValid(url)) return url;
                }
            } catch (_) { /* ignore */ }
            return '';
        } finally {
            if (exportChart) {
                try {
                    exportChart.destroy();
                } catch (_) { /* ignore */ }
            }
            canvas.remove();
        }
    }

    /**
     * Builds cumulative cash flow data using per-site timeline offsets,
     * then renders or updates the Chart.js line chart.
     */
    function renderCashflowChart() {
        if (!cashflowChartCanvas) return;
        const payload = getCashflowChartPayload();
        if (!payload) return;

        const { chartData, chartOptions } = payload;
        if (cashflowChartInstance) {
            cashflowChartInstance.data = chartData;
            cashflowChartInstance.options = chartOptions;
            cashflowChartInstance.update('none');
        } else {
            cashflowChartInstance = new Chart(cashflowChartCanvas, { type: 'line', data: chartData, options: chartOptions });
        }
    }

    /**
     * Builds annual cash flow table HTML from stressed monthly flows (same logic as on-screen table).
     * @param {{ compact?: boolean }} options - compact: shorter headers + classes for narrow print column
     * @returns {string} Full <table> markup, or '' if nothing to show.
     */
    function getAnnualCashflowTableHtml(options = {}) {
        const compact = options.compact === true;
        if (state.sites.length === 0) return '';

        let maxMonth = 0;
        const componentSets = [];
        const annualBcs = getBusinessCaseStartStr();
        state.sites.forEach(site => {
            ensureSiteTimelineISOFromLegacy(site, annualBcs);
            const tl = site.timeline || { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 };
            const stressedInputs = {
                ...site.inputs,
                constructionCost: (site.inputs.constructionCost || 0) * stressModifiers.capex,
                engineeringCost: (site.inputs.engineeringCost || 0) * stressModifiers.capex,
                productCost: (site.inputs.productCost || 0) * stressModifiers.capex,
                mrr: (site.inputs.mrr || 0) * stressModifiers.mrr
            };
            const components = buildCashFlowComponentsForSite(stressedInputs, tl);
            if (components.error || !components.cashFlows?.length) return;
            componentSets.push(components);
            maxMonth = Math.max(maxMonth, components.cashFlows.length - 1);
        });

        if (componentSets.length === 0) return '';

        const monthlyIn = new Array(maxMonth + 1).fill(0);
        const monthlyOut = new Array(maxMonth + 1).fill(0);
        const monthlyNet = new Array(maxMonth + 1).fill(0);

        for (let m = 0; m <= maxMonth; m++) {
            componentSets.forEach(components => {
                const revenue = components.revenue[m] || 0;
                const costs = (components.cos[m] || 0) + (components.sga[m] || 0) + (components.capex[m] || 0);
                monthlyIn[m] += revenue;
                monthlyOut[m] += costs;
                monthlyNet[m] += (components.cashFlows[m] || 0);
            });
        }

        const { year: bcy, monthIndex0: bcm } = getBusinessCaseStartParsed();
        const inByY = sumMonthlySeriesIntoCalendarYearMap(monthlyIn, maxMonth, bcy, bcm);
        const outByY = sumMonthlySeriesIntoCalendarYearMap(monthlyOut, maxMonth, bcy, bcm);
        const netByY = sumMonthlySeriesIntoCalendarYearMap(monthlyNet, maxMonth, bcy, bcm);
        const calendarYears = sortedCalendarYearsFromMap(netByY);
        const rows = [];
        let cumulative = 0;
        for (const calYear of calendarYears) {
            const yearIn = inByY.get(calYear) || 0;
            const yearOut = outByY.get(calYear) || 0;
            const yearNet = netByY.get(calYear) || 0;
            cumulative += yearNet;
            rows.push({ year: calYear, cashIn: yearIn, cashOut: yearOut, net: yearNet, cumulative });
        }

        const tableClass = compact
            ? 'annual-telemetry-table irr-print-annual-table irr-print-annual-table--compact'
            : 'annual-telemetry-table irr-print-annual-table';
        const headRow = compact
            ? '<tr><th>Year</th><th>Cash&nbsp;in</th><th>Cash&nbsp;out</th><th>Net</th><th>Cumulative</th></tr>'
            : '<tr><th>Year</th><th>Total Cash In</th><th>Total Cash Out</th><th>Net Position</th><th>Cumulative Cash</th></tr>';
        const rowCount = rows.length;
        const tableAttr = compact ? ` style="--annual-tbody-rows:${rowCount}"` : '';
        let html = `<table class="${tableClass}"${tableAttr}><thead>${headRow}</thead><tbody>`;
        rows.forEach(r => {
            const netClass = r.net >= 0 ? 'annual-net-positive' : 'annual-net-negative';
            html += `<tr><td>${r.year}</td><td class="annual-currency">$${r.cashIn.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td><td class="annual-currency">$${r.cashOut.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td><td class="annual-currency ${netClass}">$${r.net.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td><td class="annual-currency">$${r.cumulative.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td></tr>`;
        });
        html += '</tbody></table>';
        return html;
    }

    /**
     * Builds annual cash flow table from stressed monthly flows; injects into #annual-cashflow-table-container.
     */
    function renderAnnualTable() {
        if (!annualCashflowTableContainer) return;
        annualCashflowTableContainer.innerHTML = getAnnualCashflowTableHtml();
    }

    /**
     * Returns cash flows with stress modifiers applied. Does not mutate state; builds a copy of inputs.
     */
    function getStressedCashFlowsForSite(siteInputs, timeline = { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 }) {
        const stressedInputs = {
            ...siteInputs,
            constructionCost: (siteInputs.constructionCost || 0) * stressModifiers.capex,
            engineeringCost: (siteInputs.engineeringCost || 0) * stressModifiers.capex,
            productCost: (siteInputs.productCost || 0) * stressModifiers.capex,
            mrr: (siteInputs.mrr || 0) * stressModifiers.mrr
        };
        return getCashFlowsForSite(stressedInputs, timeline);
    }

    /**
     * Helper to get a cash flow array from a site's inputs
     */
    function getCashFlowsForSite(inputs, timeline = { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 }) {
        const { cashFlows, error } = buildCashFlowComponentsForSite(inputs, timeline);
        return { cashFlows: cashFlows || [], error };
    }

    /**
     * Payback: Roger breakeven =IFERROR(INDEX(Q10:DC10,MATCH(1,(Q198:DC198<0)*(R198:DC198>=0),0)+1),...)
     * i.e. first month-end where prior cumulative is strictly negative and current >= 0.
     * paybackRogerMonth matches INDEX row-10 style: 0-based month index when cumulative first reaches >= 0
     * after that crossing (same as the loop index `month`). Interpolated paybackMonths still drives paybackRatio.
     */
    function getPaybackFromCashFlows(cashFlows, term) {
        let paybackMonths = Infinity;
        let paybackRogerMonth = null;
        let paybackRatio = Infinity;

        if (!Array.isArray(cashFlows) || cashFlows.length === 0) {
            return { paybackMonths, paybackRogerMonth, paybackRatio, error: "No cash flows available." };
        }
        if (term <= 0) {
            return { paybackMonths, paybackRogerMonth, paybackRatio, error: "Term must be > 0" };
        }

        let cumulative = cashFlows[0] || 0;
        let sawNegativeCumulative = cumulative < 0;

        for (let month = 1; month < cashFlows.length; month++) {
            const prevCumulative = cumulative;
            cumulative += cashFlows[month];
            if (cumulative < 0) sawNegativeCumulative = true;
            if (sawNegativeCumulative && prevCumulative < 0 && cumulative >= 0) {
                paybackRogerMonth = month;
                const delta = cumulative - prevCumulative;
                if (Math.abs(delta) < 1e-9) {
                    paybackMonths = month;
                } else {
                    const fraction = (0 - prevCumulative) / delta;
                    paybackMonths = (month - 1) + fraction;
                }
                paybackRatio = paybackMonths / term;
                return { paybackMonths, paybackRogerMonth, paybackRatio, error: null };
            }
        }

        return { paybackMonths, paybackRogerMonth, paybackRatio, error: null };
    }

    function getPaybackForSite(inputs, timeline = { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 }) {
        const { cashFlows, error } = getCashFlowsForSite(inputs, timeline);
        if (error) {
            return { paybackMonths: Infinity, paybackRogerMonth: null, paybackRatio: Infinity, error };
        }
        return getPaybackFromCashFlows(cashFlows, inputs.term);
    }


    // --- 5. UI Update Functions ---

    function setResultUI(el, text, state) { // state: 'go', 'nogo', 'error', 'pending', 'default'
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
            case 'default':
                el.style.color = 'var(--text-color, #fff)';
                break;
            case 'pending':
            default:
                el.style.color = 'var(--text-color-secondary, #9ca3af)';
                break;
        }
    }

    function setPaybackUI(element, paybackMonths, term, ratio, paybackRogerMonth) {
        element.classList.remove('pending', 'payback-green', 'payback-yellow', 'payback-red');
        
        if (ratio === null || !isFinite(paybackMonths) || term <= 0) {
            element.textContent = "-- / --";
            element.classList.add('pending');
            element.style.color = 'var(--text-color-secondary, #9ca3af)';
        } else if (!isFinite(ratio)) { // Catches Infinity
            element.textContent = `Never / ${term}`;
            element.classList.add('payback-red');
        } else {
            const displayMonth = (paybackRogerMonth != null && Number.isFinite(paybackRogerMonth))
                ? paybackRogerMonth
                : paybackMonths;
            element.textContent = `${displayMonth} / ${term}`;
            if (ratio <= 0.5) {
                element.classList.add('payback-green');
            } else if (ratio < 1) {
                element.classList.add('payback-yellow');
            } else { // ratio >= 1
                element.classList.add('payback-red');
            }
        }
    }

    function showSiteResults(errorMessageEl, annualIRREl, tcvEl, npvEl, paybackEl, annualIRR, irrDisplayState, tcv, npv, paybackMonths, term, paybackRatio, paybackRogerMonth) {
        errorMessageEl.classList.add('hidden');
        setResultUI(annualIRREl, (annualIRR * 100).toFixed(2) + '%', irrDisplayState);
        setResultUI(tcvEl, `$${tcv.toLocaleString()}`, 'tcv');
        tcvEl.style.color = 'var(--color-primary, #3b82f6)';
        setResultUI(npvEl, `$${(npv || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'default');
        npvEl.style.color = 'var(--text-light, #333)';
        
        setPaybackUI(paybackEl, paybackMonths, term, paybackRatio, paybackRogerMonth);
    }

    function showSiteError(errorMessageEl, annualIRREl, tcvEl, npvEl, paybackEl, message) {
        errorMessageEl.classList.remove('hidden');
        errorMessageEl.textContent = message;
        setResultUI(annualIRREl, '--%', 'error');
        setResultUI(tcvEl, '$0', 'error');
        setResultUI(npvEl, '$0', 'error');
        
        setPaybackUI(paybackEl, null, null, null, null);
    }

    function showGlobalResults(monthlyIRR, targetIRR, tcv, globalPaybackMonths, globalPaybackRogerMonth, globalTerm, globalPaybackRatio, totalCapitalInvestment, npv) {
        globalErrorMessageEl.classList.add('hidden');
        
        setResultUI(globalTcvEl, `$${tcv.toLocaleString()}`, 'tcv');
        globalTcvEl.style.color = 'var(--color-primary, #3b82f6)';
        
        setResultUI(globalCapitalInvestmentEl, `$${(totalCapitalInvestment || 0).toLocaleString()}`, 'default');
        globalCapitalInvestmentEl.style.color = 'var(--text-light, #333)';
        setResultUI(globalNpvEl, `$${(npv || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'default');
        globalNpvEl.style.color = 'var(--text-light, #333)';

        setPaybackUI(globalPaybackEl, globalPaybackMonths, globalTerm, globalPaybackRatio, globalPaybackRogerMonth);

        if (isNaN(monthlyIRR) || !isFinite(monthlyIRR)) {
            showGlobalError("Could not calculate Global IRR. Check inputs.");
            return;
        }

        const annualIRR = Math.pow(1 + monthlyIRR, 12) - 1;
        
        if (annualIRR >= targetIRR) {
            setResultUI(globalAnnualIRREl, (annualIRR * 100).toFixed(2) + '%', 'go');
        } else {
            setResultUI(globalAnnualIRREl, (annualIRR * 100).toFixed(2) + '%', 'nogo');
        }
    }

    function showGlobalError(message) {
        setResultUI(globalAnnualIRREl, '--%', 'error');
        setResultUI(globalTcvEl, '$0', 'error');
        setResultUI(globalCapitalInvestmentEl, '$0', 'error');
        setResultUI(globalNpvEl, '$0', 'error');
        
        globalErrorMessageEl.textContent = message;
        globalErrorMessageEl.classList.remove('hidden');
    }
    
    // --- 6. Report PDF (snapdom + pdf-lib; same HTML as legacy print) ---

    function escapeHtmlForPrint(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** PDF/print KPIs: match on-screen colors (theme + IRR/payback state) via resolved computed color. */
    function irrKpiComputedColorAttr(el) {
        if (!el) return '';
        try {
            const c = getComputedStyle(el).color;
            if (!c || c === 'rgba(0, 0, 0, 0)') return '';
            return ` style="color:${c}"`;
        } catch (_) {
            return '';
        }
    }

    /**
     * Shared print/PDF report styles. PDF capture adds shadow/filter stripping on the capture root.
     * @param {boolean} includePrintPageRules - @page rules for browser print; omit for snapdom PDF raster.
     */
    function buildIrrReportStylesheet(includePrintPageRules) {
        const pageBlock = includePrintPageRules ? `
            @page { size: letter portrait; margin: 0.5in; }
            @page irr-site-landscape { size: letter landscape; margin: 0.35in; }
` : '';
        const shadowKill = includePrintPageRules ? '' : `
            .irr-pdf-capture-root, .irr-pdf-capture-root * {
                box-shadow: none !important;
                text-shadow: none !important;
                filter: none !important;
            }
`;
        return `${pageBlock}${shadowKill}
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body, .irr-pdf-capture-root { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1e293b; line-height: 1.3; }
            .irr-pdf-capture-root { overflow: visible; }
            
            .page-1-wrapper { width: 7.5in; margin: 0 auto; }
            
            .report-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; border-bottom: 3px solid #3b82f6; padding-bottom: 8px; margin-bottom: 12px; overflow: visible; }
            .report-header h1 { flex: 1; min-width: 0; font-size: 1.25rem; color: #1e293b; margin: 0; line-height: 1.2; }
            .report-header-meta { flex: 0 1 auto; max-width: 58%; text-align: right; line-height: 1.35; overflow: visible; min-width: 0; }
            .report-header-meta-row { font-size: 7pt; color: #64748b; white-space: nowrap; overflow: visible; }
            
            .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; background: #f8fafc; }
            .summary-card h2 { font-size: 0.9rem; color: #3b82f6; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
            
            .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; text-align: center; }
            .kpi-item .kpi-label { font-size: 7.5pt; color: #64748b; text-transform: uppercase; }
            .kpi-item .kpi-value { font-size: 1.25rem; font-weight: 700; margin-top: 2px; }
            
            .summary-financials-grid { width: 100%; border-collapse: collapse; font-size: 8pt; }
            .summary-financials-grid th { background: #eff6ff; color: #1d4ed8; padding: 4px; border-bottom: 1px solid #bfdbfe; font-size: 8pt; text-transform: uppercase; }
            .summary-financials-grid td { padding: 4px; border-bottom: 1px solid #e5e7eb; text-align: right; }
            .summary-bold-row td { font-weight: 700; background: #f1f5f9; border-top: 1px solid #cbd5e1; }
            
            .chart-print-img-wrap { width: 100%; text-align: center; }
            .chart-print-img-wrap img { max-width: 100%; height: 300px; border: 1px solid #e2e8f0; border-radius: 4px; object-fit: contain; }
            
            table.irr-print-annual-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; margin-top: 0; }
            table.irr-print-annual-table th { background: #f1f5f9; padding: 4px; border-bottom: 2px solid #e2e8f0; text-align: right; }
            table.irr-print-annual-table th:first-child { text-align: center; }
            table.irr-print-annual-table td { padding: 4px; border-bottom: 1px solid #f1f5f9; text-align: right; }
            table.irr-print-annual-table td:first-child { text-align: center; }

            .irr-print-landscape-section {
                page: irr-site-landscape;
                page-break-before: always;
                break-before: page;
                break-inside: avoid;
                width: 100%;
                max-width: 100%;
            }
            .irr-print-landscape-section h2 { font-size: 1.05rem; color: #3b82f6; text-transform: uppercase; margin-bottom: 8px; }
            .site-breakdown-print-table {
                width: 100%;
                table-layout: fixed;
                border-collapse: collapse;
                font-size: 5.5pt;
            }
            .site-breakdown-print-table col.site-bd-col-site { width: 14%; }
            .site-breakdown-print-table col.site-bd-col-num { width: 6.692307%; }
            .site-breakdown-print-table th {
                background: #f1f5f9;
                padding: 3px 2px;
                border-bottom: 2px solid #e2e8f0;
                text-align: center;
                white-space: normal;
                word-wrap: break-word;
                overflow-wrap: break-word;
                font-weight: 600;
                font-size: 5pt;
                line-height: 1.15;
            }
            .site-breakdown-print-table th:first-child { text-align: left; }
            .site-breakdown-print-table td {
                padding: 2px 1px;
                border-bottom: 1px solid #f1f5f9;
                text-align: center;
                word-wrap: break-word;
                overflow-wrap: break-word;
                vertical-align: top;
                line-height: 1.2;
            }
            .site-breakdown-print-table td:first-child {
                text-align: left;
                font-weight: 600;
                word-break: normal;
                overflow-wrap: break-word;
            }
            .site-breakdown-print-table td.site-bd-date-cell {
                white-space: normal;
                word-break: break-word;
                overflow-wrap: anywhere;
                line-height: 1.25;
                hyphens: auto;
            }
            
            .go { color: #16a34a; font-weight: 700; }
            .nogo { color: #dc2626; font-weight: 700; }
            .warn { color: #d97706; font-weight: 700; }
            .error { color: #f97316; font-weight: 700; }
            .annual-net-positive { color: #16a34a; font-weight: 700; }
            .annual-net-negative { color: #dc2626; font-weight: 700; }
`;
    }

    async function handlePrintReport() {
        const projectName = projectNameInput.value.trim() || "IRR Project Approval Report";
        const globalTargetIRR = (parseFloat(globalTargetIrrInput.value) || 0) / 100;
        const globalDiscountRate = (parseFloat(globalDiscountRateInput?.value) || 15) / 100;
        const npvDiscountPctPrint = (() => {
            const pct = globalDiscountRate * 100;
            if (!Number.isFinite(pct)) return '15';
            return Math.abs(pct - Math.round(pct)) < 1e-6 ? String(Math.round(pct)) : pct.toFixed(1);
        })();
        const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const printBcs = getBusinessCaseStartParsed();
        const businessCaseStartLabel = new Date(printBcs.year, printBcs.monthIndex0, 1).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        // --- 1. Capture Chart First ---
        let chartImgSrc = '';
        try {
            chartImgSrc = await captureCashflowChartForPrintDataUrl();
        } catch (e) {
            console.warn('Print chart capture failed:', e);
        }

        // --- 2. Aggregate Data ---
        let maxCashflowLength = 0;
        let maxSummaryMonth = 0;
        const globalCashFlows = [];
        const monthlyRevenue = [];
        const monthlyCos = [];
        const monthlySga = [];
        const monthlyCapex = [];
        const printBcsForFlows = getBusinessCaseStartStr();

        state.sites.forEach(site => {
            const inp = site.inputs || {};
            ensureSiteTimelineISOFromLegacy(site, printBcsForFlows);
            const tl = site.timeline || { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 };
            const components = buildCashFlowComponentsForSite(inp, tl);
            if (!components.error && components.cashFlows?.length) {
                const { cashFlows, revenue, cos, sga, capex } = components;
                if (cashFlows.length > maxCashflowLength) maxCashflowLength = cashFlows.length;
                if (cashFlows.length - 1 > maxSummaryMonth) maxSummaryMonth = cashFlows.length - 1;
                globalCashFlows.push(cashFlows);
                for (let i = 0; i < cashFlows.length; i++) {
                    monthlyRevenue[i] = (monthlyRevenue[i] || 0) + (revenue[i] || 0);
                    monthlyCos[i] = (monthlyCos[i] || 0) + (cos[i] || 0);
                    monthlySga[i] = (monthlySga[i] || 0) + (sga[i] || 0);
                    monthlyCapex[i] = (monthlyCapex[i] || 0) + (capex[i] || 0);
                }
            }
        });

        const aggregatedCashFlows = new Array(Math.max(maxCashflowLength, 1)).fill(0);
        globalCashFlows.forEach(flows => {
            for (let i = 0; i < flows.length; i++) aggregatedCashFlows[i] += flows[i];
        });

        if (!chartImgSrc && globalCashFlows.length > 0) {
            const cum = [];
            let c = 0;
            for (let i = 0; i < aggregatedCashFlows.length; i++) {
                c += aggregatedCashFlows[i] || 0;
                cum.push(c);
            }
            chartImgSrc = cumulativeSeriesToPngDataUrl(cum);
        }

        // --- 3. Build Tables ---
        const annualTableHtml = getAnnualCashflowTableHtml({ compact: true });
        
        const summaryMaxM = Math.max(0, maxSummaryMonth);
        const revByCalY = sumMonthlySeriesIntoCalendarYearMap(monthlyRevenue, summaryMaxM, printBcs.year, printBcs.monthIndex0);
        const cosByCalY = sumMonthlySeriesIntoCalendarYearMap(monthlyCos, summaryMaxM, printBcs.year, printBcs.monthIndex0);
        const sgaByCalY = sumMonthlySeriesIntoCalendarYearMap(monthlySga, summaryMaxM, printBcs.year, printBcs.monthIndex0);
        const capexByCalY = sumMonthlySeriesIntoCalendarYearMap(monthlyCapex, summaryMaxM, printBcs.year, printBcs.monthIndex0);
        
        // Cap the summary years to 6 to prevent layout overflow
        let summaryCalendarYears = sortedCalendarYearsFromMap(revByCalY);
        if (summaryCalendarYears.length > 6) {
            summaryCalendarYears = summaryCalendarYears.slice(0, 6);
        }

        const buildSummaryRow = (label, values, rowClass = '') => `
            <tr class="${rowClass}">
                <td style="text-align:left; font-weight:600;">${label}</td>
                ${values.map(v => `<td>${(Math.round((v || 0) / 1000)).toLocaleString()}</td>`).join('')}
            </tr>`;

        let siteRows = '';
        state.sites.forEach(site => {
            const inp = site.inputs || {};
            const res = site.result;
            ensureSiteTimelineISOFromLegacy(site, getBusinessCaseStartStr());
            const timeline = site.timeline || { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 };
            const irrText = res.error ? 'Error' : `${(res.annualIRR * 100).toFixed(2)}%`;
            const irrClass = res.error ? 'error' : (res.annualIRR >= globalTargetIRR ? 'go' : 'nogo');

            let pText = '-- / --';
            let pClass = '';
            if (!isFinite(res.paybackRatio)) {
                pText = `Never / ${inp.term}`;
                pClass = 'nogo';
            } else if (res.paybackRatio !== null && isFinite(res.payback)) {
                pText = `${(res.paybackRogerMonth != null ? res.paybackRogerMonth : res.payback.toFixed(1))} / ${inp.term}`;
                if (res.paybackRatio <= 0.5) pClass = 'go';
                else if (res.paybackRatio < 1) pClass = 'warn';
                else pClass = 'nogo';
            }

            siteRows += `<tr>
                <td style="text-align:left;font-weight:600;">${escapeHtmlForPrint(site.name)}</td>
                <td class="${irrClass}">${irrText}</td>
                <td>$${(res.tcv || 0).toLocaleString()}</td>
                <td>$${(inp.constructionCost || 0).toLocaleString()}</td>
                <td>$${(inp.engineeringCost || 0).toLocaleString()}</td>
                <td>$${(inp.productCost || 0).toLocaleString()}</td>
                <td>$${(inp.nrr || 0).toLocaleString()}</td>
                <td>$${(inp.mrr || 0).toLocaleString()}</td>
                <td>$${(inp.monthlyCost || 0).toLocaleString()}</td>
                <td class="site-bd-date-cell">${escapeHtmlForPrint(formatTimelineMonthISOForDisplay(timeline.constructionStartMonthISO))}</td>
                <td>${Math.max(1, parseInt(timeline.constructionDurationMonths, 10) || 3)}</td>
                <td>${escapeHtmlForPrint(formatTimelineMonthISOForDisplay(timeline.billingStartMonthISO))}</td>
                <td>${inp.term}</td>
                <td class="${pClass}">${pText}</td>
            </tr>`;
        });

        /* Blob URL helps snapdom serialize chart PNGs; huge data: URIs sometimes paint as 0×0 until too late */
        let chartSrcForPdf = chartImgSrc || '';
        const pdfBlobUrlsToRevoke = [];
        if (chartImgSrc && chartImgSrc.startsWith('data:image')) {
            try {
                const blob = await (await fetch(chartImgSrc)).blob();
                const u = URL.createObjectURL(blob);
                pdfBlobUrlsToRevoke.push(u);
                chartSrcForPdf = u;
            } catch (e) {
                console.warn('IRR PDF: could not use blob URL for chart, using data URL:', e);
                chartSrcForPdf = chartImgSrc;
            }
        }

        // --- 4. Same HTML structure as legacy print; PDF = snapdom raster + pdf-lib (page 2 always landscape) ---
        const npvDiscountPctForPrint = String(npvDiscountPctPrint).replace(/%\s*$/, '');
        const page1InnerHtml = `
                <div class="report-header">
                    <h1>${escapeHtmlForPrint(projectName)}</h1>
                    <div class="report-header-meta">
                        <div class="report-header-meta-row">Generated ${reportDate}</div>
                        <div class="report-header-meta-row">Start: <strong>${escapeHtmlForPrint(businessCaseStartLabel)}</strong> · Target <strong>${(globalTargetIRR * 100).toFixed(1)}%</strong></div>
                        <div class="report-header-meta-row">NPV discount <strong>${npvDiscountPctForPrint}%</strong></div>
                    </div>
                </div>

                <div class="summary-card">
                    <div class="kpi-grid">
                        <div class="kpi-item"><div class="kpi-label">Annual IRR</div><div class="kpi-value"${irrKpiComputedColorAttr(globalAnnualIRREl)}>${globalAnnualIRREl.textContent}</div></div>
                        <div class="kpi-item"><div class="kpi-label">Total CapEx</div><div class="kpi-value"${irrKpiComputedColorAttr(globalCapitalInvestmentEl)}>${globalCapitalInvestmentEl.textContent}</div></div>
                        <div class="kpi-item"><div class="kpi-label">Total TCV</div><div class="kpi-value"${irrKpiComputedColorAttr(globalTcvEl)}>${globalTcvEl.textContent}</div></div>
                        <div class="kpi-item"><div class="kpi-label">Project NPV</div><div class="kpi-value"${irrKpiComputedColorAttr(globalNpvEl)}>${globalNpvEl.textContent}</div></div>
                        <div class="kpi-item"><div class="kpi-label">Payback / Term</div><div class="kpi-value"${irrKpiComputedColorAttr(globalPaybackEl)}>${globalPaybackEl.textContent}</div></div>
                    </div>
                </div>

                <div class="summary-card">
                    <h2>Summary Financials ($000s)</h2>
                    <table class="summary-financials-grid">
                        <thead><tr><th style="text-align:left;">Metric</th>${summaryCalendarYears.map(y => `<th style="text-align:right;">${y}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${buildSummaryRow('Revenue', summaryCalendarYears.map(y => revByCalY.get(y)))}
                            ${buildSummaryRow('COS', summaryCalendarYears.map(y => -cosByCalY.get(y)))}
                            ${buildSummaryRow('SG&amp;A', summaryCalendarYears.map(y => -sgaByCalY.get(y)))}
                            ${buildSummaryRow('EBITDA', summaryCalendarYears.map(y => (revByCalY.get(y) || 0) - (cosByCalY.get(y) || 0) - (sgaByCalY.get(y) || 0)), 'summary-bold-row')}
                            ${buildSummaryRow('CapEx', summaryCalendarYears.map(y => -capexByCalY.get(y)))}
                            ${buildSummaryRow('Cash Flow', summaryCalendarYears.map(y => (revByCalY.get(y) || 0) - (cosByCalY.get(y) || 0) - (sgaByCalY.get(y) || 0) - (capexByCalY.get(y) || 0)), 'summary-bold-row')}
                        </tbody>
                    </table>
                </div>

                ${chartSrcForPdf ? `
                <div class="summary-card">
                    <h2>Cash Flow Projection</h2>
                    <div class="chart-print-img-wrap"><img src="${chartSrcForPdf}" alt="Cash flow chart" /></div>
                </div>` : ''}

                ${annualTableHtml ? `
                <div class="summary-card" style="margin-bottom:0;">
                    <h2>Annual Cash Flow</h2>
                    ${annualTableHtml}
                </div>` : ''}`;

        const page2InnerHtml = `
            <div class="irr-print-landscape-section">
                <h2>Site Breakdown Detail</h2>
                <table class="site-breakdown-print-table">
                    <colgroup>
                        <col class="site-bd-col-site" />
                        <col class="site-bd-col-num" /><col class="site-bd-col-num" /><col class="site-bd-col-num" /><col class="site-bd-col-num" /><col class="site-bd-col-num" /><col class="site-bd-col-num" /><col class="site-bd-col-num" /><col class="site-bd-col-num" /><col class="site-bd-col-num" /><col class="site-bd-col-num" /><col class="site-bd-col-num" /><col class="site-bd-col-num" /><col class="site-bd-col-num" />
                    </colgroup>
                    <thead><tr>
                        <th>Site</th>
                        <th>IRR</th>
                        <th>TCV</th>
                        <th>Construction</th>
                        <th>Engineering</th>
                        <th>Product</th>
                        <th>NRR</th>
                        <th>MRR</th>
                        <th>MCOS</th>
                        <th>Const. Start</th>
                        <th>Duration</th>
                        <th>Billing start</th>
                        <th>Term</th>
                        <th>Payback</th>
                    </tr></thead>
                    <tbody>${siteRows}</tbody>
                </table>
            </div>`;

        const stylesheetPdf = buildIrrReportStylesheet(false);
        const PX = 96;
        const portraitContentPx = 7.5 * PX;
        /* Letter landscape printable width ≈ 10in @ 96dpi after PDF margins — keeps table on one row */
        const landscapeContentPx = 10 * PX;

        try {
            if (typeof PDFLib === 'undefined') {
                throw new Error('PDF library not loaded. Refresh the page and try again.');
            }
            const snapdomFn = globalThis.snapdom;
            if (typeof snapdomFn !== 'function') {
                throw new Error('snapdom not loaded.');
            }

            const snapOpts = {
                scale: 2,
                backgroundColor: '#ffffff',
                outerShadows: false,
                outerTransforms: false
            };

            /**
             * Data URLs and large PNGs often report complete before decode(); naturalWidth stays 0 briefly.
             * snapdom then captures an empty image — especially the cashflow chart.
             */
            async function waitReportImages(root) {
                const imgs = Array.from(root.querySelectorAll('img'));
                for (const img of imgs) {
                    try {
                        if (typeof img.decode === 'function') {
                            await img.decode();
                        }
                    } catch (_) { /* broken src; still wait below */ }
                    if (img.naturalWidth > 0) continue;
                    await new Promise((resolve) => {
                        const done = () => resolve();
                        if (img.complete) {
                            done();
                            return;
                        }
                        img.addEventListener('load', done, { once: true });
                        img.addEventListener('error', done, { once: true });
                        setTimeout(done, 5000);
                    });
                    for (let i = 0; i < 40 && img.naturalWidth === 0; i++) {
                        await new Promise((r) => requestAnimationFrame(r));
                    }
                }
            }

            function getPdfSnapIframe() {
                let iframe = document.getElementById('irr-pdf-snap-iframe');
                if (!iframe) {
                    iframe = document.createElement('iframe');
                    iframe.id = 'irr-pdf-snap-iframe';
                    iframe.setAttribute('aria-hidden', 'true');
                    iframe.title = '';
                    iframe.style.cssText =
                        'position:fixed;border:0;width:0;height:0;left:0;top:0;opacity:0;pointer-events:none;visibility:hidden';
                    iframe.src = 'about:blank';
                    document.body.appendChild(iframe);
                }
                return iframe;
            }

            function blankPdfSnapIframe(iframe) {
                const doc = iframe.contentDocument;
                if (!doc) return;
                doc.open();
                doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>');
                doc.close();
            }

            /**
             * Rasterize in a hidden same-origin iframe so tall report DOM + fonts.ready + snapdom
             * never touch the main document (avoids visible layout jitter / scrollbar thrash).
             */
            async function captureHtmlViaSnapIframe(widthPx, innerBodyHtml) {
                const iframe = getPdfSnapIframe();
                const doc = iframe.contentDocument;
                if (!doc) {
                    throw new Error('PDF snap iframe has no document.');
                }
                const fontHref =
                    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${fontHref}"><style>${stylesheetPdf}</style></head><body style="margin:0;background:#fff;"><div class="irr-pdf-capture-root" style="width:${widthPx}px;background:#fff;">${innerBodyHtml}</div></body></html>`;
                try {
                    doc.open();
                    doc.write(html);
                    doc.close();
                    const root = doc.querySelector('.irr-pdf-capture-root');
                    if (!root) {
                        throw new Error('PDF capture root missing in iframe.');
                    }
                    try {
                        if (doc.fonts && doc.fonts.ready) {
                            await doc.fonts.ready;
                        }
                    } catch (_) { /* ignore */ }
                    await waitReportImages(root);
                    if (chartSrcForPdf) {
                        await new Promise((r) => setTimeout(r, 50));
                    }
                    await new Promise((r) => requestAnimationFrame(r));
                    await new Promise((r) => requestAnimationFrame(r));
                    const capture = await snapdomFn(root, snapOpts);
                    return capture.toCanvas();
                } finally {
                    blankPdfSnapIframe(iframe);
                }
            }

            async function capturePdfFragment(widthPx, innerHtml) {
                const innerBodyHtml = `<div class="page-1-wrapper" style="width:100%;max-width:100%;">${innerHtml}</div>`;
                return captureHtmlViaSnapIframe(widthPx, innerBodyHtml);
            }

            async function captureLandscapeFragment(widthPx, innerHtml) {
                return captureHtmlViaSnapIframe(widthPx, innerHtml);
            }

            const canvas1 = await capturePdfFragment(portraitContentPx, page1InnerHtml);
            const canvas2 = await captureLandscapeFragment(landscapeContentPx, page2InnerHtml);
            pdfBlobUrlsToRevoke.forEach((u) => {
                try { URL.revokeObjectURL(u); } catch (_) { /* ignore */ }
            });

            const { PDFDocument } = PDFLib;
            const pdfDoc = await PDFDocument.create();
            const marginPt = 36;
            const embedFromCanvas = (canvas) => pdfDoc.embedPng(canvas.toDataURL('image/png'));

            const png1 = await embedFromCanvas(canvas1);
            const pagePortrait = pdfDoc.addPage([612, 792]);
            const uW1 = 612 - 2 * marginPt;
            const uH1 = 792 - 2 * marginPt;
            const d1 = png1.scaleToFit(uW1, uH1);
            pagePortrait.drawImage(png1, {
                x: (612 - d1.width) / 2,
                y: (792 - d1.height) / 2,
                width: d1.width,
                height: d1.height
            });

            const png2 = await embedFromCanvas(canvas2);
            const pageLandscape = pdfDoc.addPage([792, 612]);
            const uW2 = 792 - 2 * marginPt;
            const uH2 = 612 - 2 * marginPt;
            const d2 = png2.scaleToFit(uW2, uH2);
            /* Top-align site table: pdf-lib y is bottom of image; page top y = 612 */
            const x2 = (792 - d2.width) / 2;
            const y2Top = 612 - marginPt - d2.height;
            pageLandscape.drawImage(png2, {
                x: x2,
                y: Math.max(marginPt, y2Top),
                width: d2.width,
                height: d2.height
            });

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${projectName.replace(/\s+/g, '_')}_IRR_Report.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (err) {
            console.error('IRR PDF export failed:', err);
            pdfBlobUrlsToRevoke.forEach((u) => {
                try { URL.revokeObjectURL(u); } catch (_) { /* ignore */ }
            });
            hideModal();
            showModal("Error", (err && err.message) ? err.message : "Could not generate PDF.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        }
    }
    
    // --- 7. CSV Export Function ---

    /**
     * Helper function to escape CSV cell content.
     */
    function escapeCSV(content) {
        let str = String(content);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    /**
     * Generates a CSV file with live formulas and triggers a download.
     */
    function handleExportCSV() {
        const projectName = projectNameInput.value.trim() || "IRR Project";
        const globalDiscountRate = (parseFloat(globalDiscountRateInput?.value) || 15) / 100;
        const headers = [
            "Site Name",
            "Address",
            "Term",
            "Est. CapEx",
            "MCOS",
            "SG&A",
            "Payback",
            "MRC",
            "NRC",
            "Billing start (YYYY-MM)",
            "TCV",
            "IRR",
            "NPV"
        ];
        const csvContent = [headers.join(',')];

        const csvBcs = getBusinessCaseStartStr();
        state.sites.forEach(site => {
            const i = site.inputs || {};
            ensureSiteTimelineISOFromLegacy(site, csvBcs);
            const t = site.timeline || { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 };
            const capex = (i.constructionCost || 0) + (i.engineeringCost || 0) + (i.productCost || 0);
            const sga = ((i.mrr || 0) * 1) + ((i.nrr || 0) * 0.03);
            const tcv = ((i.mrr || 0) * (i.term || 0)) + (i.nrr || 0);

            const { cashFlows, error } = getCashFlowsForSite(i, t);
            let annualIrrText = '';
            let npvText = '';
            let paybackText = 'Never';
            if (!error) {
                const monthlyIrr = calculateIRR(cashFlows);
                const annualIrr = (isFinite(monthlyIrr) && !isNaN(monthlyIrr)) ? (Math.pow(1 + monthlyIrr, 12) - 1) : null;
                const npv = calculateNPV(globalDiscountRate, cashFlows);
                const { paybackMonths, paybackRogerMonth: csvRogerPb } = getPaybackFromCashFlows(cashFlows, i.term || 0);
                annualIrrText = annualIrr === null ? '' : (annualIrr * 100).toFixed(6);
                npvText = isFinite(npv) ? npv.toFixed(2) : '';
                paybackText = isFinite(paybackMonths)
                    ? (csvRogerPb != null ? String(csvRogerPb) : paybackMonths.toFixed(1))
                    : 'Never';
            }

            const row = [
                escapeCSV(site.name || ''),
                escapeCSV(site.note || site.name || ''),
                i.term || 0,
                capex.toFixed(2),
                (i.monthlyCost || 0).toFixed(2),
                sga.toFixed(2),
                paybackText,
                (i.mrr || 0).toFixed(2),
                (i.nrr || 0).toFixed(2),
                escapeCSV(t.billingStartMonthISO || ''),
                tcv.toFixed(2),
                annualIrrText,
                npvText
            ];
            csvContent.push(row.join(','));
        });

        const csvString = csvContent.join('\n');
        const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvString);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${projectName.replace(/ /g, "_")}_Deal_Summary.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- 8. Database (Save/Load) Functions ---

    /**
     * Saves the current project state to Supabase.
     */
    async function handleSaveProject() {
        const projectName = projectNameInput.value.trim();
        if (!projectName) {
            showModal("Cannot Save", "Please enter a Project Name before saving.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        showModal("Saving...", `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">Saving project to database...</p>`, null, false, ``);

        const projectData = {
            project_name: projectName,
            global_target_irr: parseFloat(globalTargetIrrInput.value) || 15,
            global_discount_rate: parseFloat(globalDiscountRateInput?.value) || 15,
            business_case_start: (getBusinessCaseStartStr()),
            sites: state.sites,
            user_id: state.currentUser.id,
            last_saved: new Date().toISOString()
        };

        let result;
        if (state.currentProjectId) {
            // Update
            result = await supabase.from(IRR_TABLE)
                .update(projectData)
                .eq('id', state.currentProjectId)
                .select();
        } else {
            // Insert
            result = await supabase.from(IRR_TABLE)
                .insert(projectData)
                .select();
        }

        if (result.error) {
            console.error("Error saving project:", result.error);
            showModal("Error", `Could not save project: ${result.error.message}`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        } else {
            if (result.data && result.data[0]) {
                state.currentProjectId = result.data[0].id;
            }
            state.isFormDirty = false;
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
            .select('id, project_name, last_saved, user_id')
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
        state.nextSiteId = state.sites.length > 0 
            ? Math.max(...state.sites.map(s => s.id)) + 1 
            : 1;

        // 3. Set global inputs
        projectNameInput.value = projectData.project_name || '';
        globalTargetIrrInput.value = projectData.global_target_irr || 15;
        if (globalDiscountRateInput) {
            globalDiscountRateInput.value = projectData.global_discount_rate || 15;
        }
        const loadedBcs = projectData.business_case_start;
        setBusinessCaseStartFromYYYYMM(
            (loadedBcs && parseBusinessCaseStartMonth(String(loadedBcs).trim()))
                ? String(loadedBcs).trim()
                : defaultBusinessCaseStartStr()
        );
        updateDialVisual();
        
        // 4. Rebuild DOM for each site
        state.sites.forEach(site => {
            const templateClone = siteFormTemplate.content.cloneNode(true);
            const newFormWrapper = templateClone.querySelector('.site-form-wrapper');
            
            newFormWrapper.dataset.siteId = site.id;
            
            // Populate all inputs from saved data
            newFormWrapper.querySelector('.site-name-input').value = site.name;
            const inputs = site.inputs || {};
            newFormWrapper.querySelector('.term-input').value = inputs.term || 0; // <-- MODIFIED
            newFormWrapper.querySelector('.construction-cost-input').value = inputs.constructionCost || 0;
            newFormWrapper.querySelector('.engineering-cost-input').value = inputs.engineeringCost || 0;
            newFormWrapper.querySelector('.product-cost-input').value = inputs.productCost || 0; // <-- NEW
            newFormWrapper.querySelector('.monthly-cost-input').value = inputs.monthlyCost || 0;
            newFormWrapper.querySelector('.nrr-input').value = inputs.nrr || 0;
            newFormWrapper.querySelector('.mrr-input').value = inputs.mrr || 0;
            
            if (!site.timeline) site.timeline = { constructionStartMonth: 0, billingStartMonth: 1, constructionDurationMonths: 3 };
            if (!site.timeline.constructionDurationMonths || site.timeline.constructionDurationMonths < 1) {
                site.timeline.constructionDurationMonths = 3;
            }
            const bcsH = getBusinessCaseStartStr();
            ensureSiteTimelineISOFromLegacy(site, bcsH);
            const resH = resolveTimelineToModelMonths(site.timeline, bcsH);
            if (!resH.error) {
                site.timeline.constructionStartMonth = resH.constructionStartMonth;
                site.timeline.billingStartMonth = resH.billingStartMonth;
                site.timeline.constructionDurationMonths = resH.constructionDurationMonths;
            }

            siteFormsContainer.appendChild(templateClone);
            attachFormListeners(newFormWrapper);
            
            runSiteCalculation(site.id, false);
        });

        // 5. Run final calculations and renders
        runGlobalCalculation();
        renderTabs();
        if (state.activeSiteId) {
            setActiveSite(state.activeSiteId);
        }
    }


    // --- 9. Event Listener Setup ---

    /**
     * Attaches all necessary event listeners to a newly created site form.
     */
    function attachFormListeners(formWrapper) {
        const siteId = Number(formWrapper.dataset.siteId);

        formWrapper.addEventListener('input', (e) => {
            state.isFormDirty = true;
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

        // Sidebar navigation
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
        
        // Beforeunload confirmation
        window.addEventListener('beforeunload', (event) => {
            if (state.isFormDirty) {
                event.preventDefault();
                event.returnValue = '';
            }
        });

        // Project Control Buttons
        if (newProjectBtn) newProjectBtn.addEventListener('click', handleNewProject);
        if (loadProjectBtn) loadProjectBtn.addEventListener('click', handleLoadProject);
        if (saveProjectBtn) saveProjectBtn.addEventListener('click', handleSaveProject);
        if (addSiteBtn) addSiteBtn.addEventListener('click', addNewSite);
        if (printReportBtn) printReportBtn.addEventListener('click', handlePrintReport);
        if (exportCsvBtn) exportCsvBtn.addEventListener('click', handleExportCSV);
        
        // Tab bar click delegation + scroll arrows
        if (siteTabsContainer) {
            siteTabsContainer.addEventListener('click', (e) => {
                const tab = e.target.closest('.irr-tab');
                if (tab) {
                    setActiveSite(Number(tab.dataset.siteId));
                }
            });
        }
        const tabScrollLeft = document.getElementById('tab-scroll-left');
        const tabScrollRight = document.getElementById('tab-scroll-right');
        if (tabScrollLeft) {
            tabScrollLeft.addEventListener('click', () => {
                siteTabsContainer.scrollBy({ left: -150, behavior: 'smooth' });
            });
        }
        if (tabScrollRight) {
            tabScrollRight.addEventListener('click', () => {
                siteTabsContainer.scrollBy({ left: 150, behavior: 'smooth' });
            });
        }
        
        // Global Target IRR listener
        if (globalTargetIrrInput) {
            globalTargetIrrInput.addEventListener('input', () => {
                state.isFormDirty = true;
                updateDialVisual();
                state.sites.forEach(site => runSiteCalculation(site.id, false));  
                runGlobalCalculation();  
            });
        }
        if (globalDiscountRateInput) {
            globalDiscountRateInput.addEventListener('input', () => {
                state.isFormDirty = true;
                state.sites.forEach(site => runSiteCalculation(site.id, false));
                runGlobalCalculation();
            });
        }
        updateDialVisual();
        
        // Project Name listener
        if (projectNameInput) {
            projectNameInput.addEventListener('input', () => {
                state.isFormDirty = true;
            });
        }
        function onBusinessCaseStartChanged() {
            state.isFormDirty = true;
            state.sites.forEach((site) => {
                const r = resolveTimelineToModelMonths(site.timeline, getBusinessCaseStartStr());
                if (!r.error) {
                    site.timeline.constructionStartMonth = r.constructionStartMonth;
                    site.timeline.billingStartMonth = r.billingStartMonth;
                    site.timeline.constructionDurationMonths = r.constructionDurationMonths;
                }
                runSiteCalculation(site.id, false);
            });
            runGlobalCalculation();
            renderTimelineTable();
            renderAnnualTable();
        }
        const bcsMonthEl = document.getElementById('business-case-start-month');
        const bcsYearEl = document.getElementById('business-case-start-year');
        bcsMonthEl?.addEventListener('change', onBusinessCaseStartChanged);
        bcsYearEl?.addEventListener('input', onBusinessCaseStartChanged);
        bcsYearEl?.addEventListener('change', onBusinessCaseStartChanged);

        // Flip Card Toggle Listeners
        if (flipToSettingsBtn) {
            flipToSettingsBtn.addEventListener('click', () => {
                renderTimelineTable();
                cashflowFlipCard.classList.add('flipped');
            });
        }
        if (flipToChartBtn) {
            flipToChartBtn.addEventListener('click', () => {
                cashflowFlipCard.classList.remove('flipped');
                renderCashflowChart();
            });
        }
        if (saveSettingsFlipBtn) {
            saveSettingsFlipBtn.addEventListener('click', () => {
                cashflowFlipCard.classList.remove('flipped');
                state.sites.forEach(site => runSiteCalculation(site.id, false));
                runGlobalCalculation();
                renderCashflowChart();
            });
        }

        // Stress test sliders: -20..20 → multiplier 0.8..1.2; apply at render only
        function applyStressFromSliders() {
            const capexVal = stressCapexSlider ? parseInt(stressCapexSlider.value, 10) : 0;
            const mrrVal = stressMrrSlider ? parseInt(stressMrrSlider.value, 10) : 0;
            stressModifiers.capex = 1 + capexVal / 100;
            stressModifiers.mrr = 1 + mrrVal / 100;
            if (stressCapexValueEl) stressCapexValueEl.textContent = capexVal + '%';
            if (stressMrrValueEl) stressMrrValueEl.textContent = mrrVal + '%';
            renderCashflowChart();
            renderAnnualTable();
        }
        if (stressCapexSlider) {
            stressCapexSlider.addEventListener('input', applyStressFromSliders);
        }
        if (stressMrrSlider) {
            stressMrrSlider.addEventListener('input', applyStressFromSliders);
        }
        if (stressResetBtn) {
            stressResetBtn.addEventListener('click', () => {
                stressModifiers = { capex: 1.0, mrr: 1.0 };
                if (stressCapexSlider) { stressCapexSlider.value = 0; }
                if (stressMrrSlider) { stressMrrSlider.value = 0; }
                if (stressCapexValueEl) stressCapexValueEl.textContent = '0%';
                if (stressMrrValueEl) stressMrrValueEl.textContent = '0%';
                renderCashflowChart();
                renderAnnualTable();
            });
        }

        if (flipToAnnualTableBtn && stressFlipCard) {
            flipToAnnualTableBtn.addEventListener('click', () => stressFlipCard.classList.add('flipped'));
        }
        if (flipToStressBtn && stressFlipCard) {
            flipToStressBtn.addEventListener('click', () => stressFlipCard.classList.remove('flipped'));
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

    // --- 10. Main Page Initialization ---
    async function initializePage() {
        showGlobalLoader();
        injectGlobalNavigation();
        await loadSVGs();
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            hideGlobalLoader();
            console.error('Authentication failed or no session found. Redirecting to login.');
            window.location.href = "index.html";
            return;
        }
        state.currentUser = session.user;

        try {
            await setupUserMenuAndAuth(supabase, state);
            await setupGlobalSearch(supabase, state.currentUser);
            await checkAndSetNotifications(supabase);
            updateActiveNavLink();
            setupPageEventListeners();

            // Start the user with one site
            handleNewProject();
            state.isFormDirty = false;
            hideGlobalLoader();

        } catch (error) {
            hideGlobalLoader();
            console.error("Critical error during page initialization:", error);
            showModal(
                "Loading Error",
                "There was a problem loading the page. Please refresh to try again.",
                null, false,
                `<button id="modal-ok-btn" class="btn-primary">OK</button>`
            );
        }
    }

    // --- 11. Financial Calculation (Pure Functions) ---

    /** Same as Excel: CF0 + NPV(rate, CF1..n) with CF_i discounted by (1+rate)^i. */
    function calculateNPVAtRate(rate, cashFlows) {
        let npv = 0;
        for (let i = 0; i < cashFlows.length; i++) {
            npv += cashFlows[i] / Math.pow(1 + rate, i);
        }
        return npv;
    }

    /**
     * Roger template parity: =NPV(((1+$C$200)^(1/12)-1),R197:DC197)+Q197
     * — effective monthly discount (1+r_annual)^(1/12)-1; first month in the array
     * is Q197 (t=0), then R..DC at t=1..n. App discount rate must match C200 (e.g. 0.15).
     * A small NPV gap vs Excel can remain if row 197 is built from rounded component cells;
     * IRR/NPV here share the same full-precision monthly series.
     */
    function calculateNPV(annualRate, cashFlows) {
        const a = annualRate || 0;
        const monthlyRate = a === 0 ? 0 : Math.pow(1 + a, 1 / 12) - 1;
        return calculateNPVAtRate(monthlyRate, cashFlows);
    }

    function calculateIRR(cashFlows) {
        const maxIterations = 100;
        const precision = 1e-7;
        
        let minRate = -0.9999;  
        let maxRate = 1.0;     
        let midRate = (minRate + maxRate) / 2;

        let npvAtMin = calculateNPVAtRate(minRate, cashFlows);
        let npvAtMax = calculateNPVAtRate(maxRate, cashFlows);
        
        if (npvAtMin * npvAtMax > 0) {
            maxRate = 5.0;
            npvAtMax = calculateNPVAtRate(maxRate, cashFlows);
            if (npvAtMin * npvAtMax > 0) {
                 minRate = -0.999999;
                 maxRate = 20.0;
                 npvAtMin = calculateNPVAtRate(minRate, cashFlows);
                 npvAtMax = calculateNPVAtRate(maxRate, cashFlows);
                 if (npvAtMin * npvAtMax > 0) return NaN;  
            }
        }

        for (let i = 0; i < maxIterations; i++) {
            midRate = (minRate + maxRate) / 2;
            let npvAtMid = calculateNPVAtRate(midRate, cashFlows);

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

    // --- 12. Run Initialization ---
    initializePage();
});
