// js/shared_constants.js

// --- SHARED CONSTANTS AND FUNCTIONS ---
import { initHUD, openHUD } from './hud.js';

export const SUPABASE_URL = "https://pjxcciepfypzrfmlfchj.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeGNjaWVwZnlwenJmbWxmY2hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxMTU4NDQsImV4cCI6MjA2NzY5MTg0NH0.m_jyE0e4QFevI-mGJHYlGmA12lXf8XoMDoiljUav79c";

export const themes = ["dark", "light", "green", "blue", "corporate"];

// --- NEW: GLOBAL STATE MANAGEMENT ---
const appState = {
    currentUser: null,          // The actual logged-in user object
    effectiveUserId: null,      // The ID of the user whose data is being viewed
    effectiveUserFullName: null,// The name of the user being viewed
    isManager: false,           // Is the logged-in user a manager?
    managedUsers: []            // Array of users the manager can view as
};

/**
 * Returns the current application state.
 */
export function getState() {
    return { ...appState };
}

/**
 * Sets the effective user for impersonation view.
 * @param {string} userId - The UUID of the user to view as.
 * @param {string} fullName - The full name of the user to view as.
 */
export function setEffectiveUser(userId, fullName) {
    appState.effectiveUserId = userId;
    appState.effectiveUserFullName = fullName;
    console.log(`Viewing as: ${fullName} (${userId})`);
    
    // This is the key part for triggering a UI refresh.
    // We dispatch a custom event that other parts of the app can listen for.
    window.dispatchEvent(new CustomEvent('effectiveUserChanged'));
}

/**
 * Initializes the global state on application startup.
 * @param {SupabaseClient} supabase The Supabase client.
 * @returns {Promise<object>} The fully initialized state object.
 */
export async function initializeAppState(supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = "index.html";
        return; // Return early if no user
    }

    appState.currentUser = user;
    appState.effectiveUserId = user.id;

    // Fetch the current user's profile to check if they are a manager
    const { data: currentUserProfile, error: profileError } = await supabase
        .from('user_quotas')
        .select('full_name, is_manager')
        .eq('user_id', user.id)
        .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 means no row, which is a valid state
        console.error("Error fetching current user profile:", profileError);
        // Handle error case, maybe by setting default non-manager state
        appState.isManager = false;
        appState.effectiveUserFullName = 'User';
        return appState;
    }
    
    // Set the full name for the logged-in user from their profile
    // Also, update the user metadata in auth if it's not set
    if (currentUserProfile?.full_name) {
        appState.effectiveUserFullName = currentUserProfile.full_name;
        if (user.user_metadata?.full_name !== currentUserProfile.full_name) {
             supabase.auth.updateUser({ data: { full_name: currentUserProfile.full_name } });
        }
    } else {
        appState.effectiveUserFullName = 'User'; // Fallback name
    }


    // Check if the user is a manager (user_quotas or user_metadata fallback - deals uses user_metadata)
    const isManagerFromQuotas = currentUserProfile?.is_manager === true;
    const isManagerFromMetadata = user.user_metadata?.is_manager === true;
    if (isManagerFromQuotas || isManagerFromMetadata) {
        appState.isManager = true;
        
        // If they are a manager, fetch all other users to populate the impersonation dropdown
        const { data: allUsers, error: allUsersError } = await supabase
            .from('user_quotas')
            .select('user_id, full_name')
            .neq('user_id', user.id); // Exclude the manager themselves from the list of managed users

        if (allUsersError) {
            console.error("Error fetching managed users:", allUsersError);
            appState.managedUsers = [];
        } else {
            appState.managedUsers = allUsers.map(u => ({
                id: u.user_id,
                full_name: u.full_name
            }));
        }
    } else {
        appState.isManager = false;
        appState.managedUsers = [];
    }
    
    return appState;
}
// --- END NEW SECTION ---


// --- THEME MANAGEMENT ---
let currentThemeIndex = 0;

function applyTheme(themeName) {
    const themeNameSpan = document.getElementById("theme-name");
    document.body.className = '';
    document.body.classList.add(`theme-${themeName}`);
    if (themeNameSpan) {
        const capitalizedThemeName = themeName.charAt(0).toUpperCase() + themeName.slice(1);
        themeNameSpan.textContent = capitalizedThemeName;
    }
}

async function saveThemePreference(supabase, userId, themeName) {
    const { error } = await supabase
        .from('user_preferences')
        .upsert({ user_id: userId, theme: themeName }, { onConflict: 'user_id' });
    if (error) {
        console.error("Error saving theme preference:", error);
    }
    localStorage.setItem('crm-theme', themeName);
}

export async function setupTheme(supabase, user) {
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    if (!themeToggleBtn) return;

    const { data, error } = await supabase
        .from('user_preferences')
        .select('theme')
        .eq('user_id', user.id)
        .single();

    let currentTheme = 'dark';
    if (error && error.code !== 'PGRST116') {
        console.error("Error fetching theme:", error);
    } else if (data) {
        currentTheme = data.theme;
    } else {
        await saveThemePreference(supabase, user.id, currentTheme);
    }
    
    currentThemeIndex = themes.indexOf(currentTheme);
    if (currentThemeIndex === -1) currentThemeIndex = 0;
    applyTheme(themes[currentThemeIndex]);
    localStorage.setItem('crm-theme', themes[currentThemeIndex]);

    if (themeToggleBtn.dataset.listenerAttached !== 'true') {
        themeToggleBtn.addEventListener("click", () => {
            currentThemeIndex = (currentThemeIndex + 1) % themes.length;
            const newTheme = themes[currentThemeIndex];
            applyTheme(newTheme);
            saveThemePreference(supabase, user.id, newTheme);
        });
        themeToggleBtn.dataset.listenerAttached = 'true';
    }
}

// --- SHARED UTILITY FUNCTIONS ---

export function formatDate(dateString) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatMonthYear(dateString) {
    if (!dateString) return "N/A";
    const [year, month] = dateString.split('-');
    const date = new Date(Date.UTC(year, month - 1, 2));  
    return date.toLocaleDateString("en-US", { year: 'numeric', month: 'long', timeZone: 'UTC' });
}

export function formatSimpleDate(dateString) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
    return adjustedDate.toLocaleDateString("en-US");
}

export function formatCurrency(value) {
    if (typeof value !== 'number') return '$0';
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatCurrencyK(value) {
    if (typeof value !== 'number') return '$0';
    if (Math.abs(value) >= 1000) {
        return `$${(value / 1000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}K`;
    }
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function parseCsvRow(row) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

export function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Opens a pre-filled Salesforce Task create page in a new tab (Single Exhaust / manual log).
 * @param {object} activity - Activity object with subject, notes (or body), type, created_at (or date), and optional sf_account_locator (Salesforce Account Id for WhatId).
 */
export function logToSalesforce(activity) {
    if (!activity) return;
    // TODO: should eventually come from user settings
    const sfBaseUrl = "https://gpcom.lightning.force.com";
    const subjectRaw = activity.subject || activity.description || activity.type || "Activity";
    const typeLower = (activity.type || "").toLowerCase();
    const subjectPrefix = typeLower.includes("email") ? "Email: " : "Call: ";
    const subject = subjectPrefix + subjectRaw;
    const description = activity.notes || activity.body || activity.description || "";
    const status = "Completed";
    const dateVal = activity.created_at || activity.date;
    const d = dateVal ? new Date(dateVal) : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const activityDate = `${year}-${month}-${day}`;
    let inner = "Subject=" + encodeURIComponent(subject) + ",Description=" + encodeURIComponent(description) + ",Status=" + encodeURIComponent(status) + ",ActivityDate=" + encodeURIComponent(activityDate);
    const locator = (activity.sf_account_locator || "").trim();
    if (locator) inner += ",WhatId=" + encodeURIComponent(locator);
    const finalUrl = sfBaseUrl + "/lightning/o/Task/new?defaultFieldValues=" + encodeURIComponent(inner);
    window.open(finalUrl, "_blank");
}

export function updateActiveNavLink() {
    const currentPage = window.location.pathname.split("/").pop();
    document.querySelectorAll(".nav-sidebar .nav-button").forEach(link => {
        const linkPage = link.getAttribute("href");
        if(linkPage) {
            link.classList.toggle("active", linkPage === currentPage);
        }
    });
}

// --- MODAL FUNCTIONS ---
const modalBackdrop = document.getElementById("modal-backdrop");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const modalActions = document.getElementById("modal-actions");
let currentModalCallbacks = { onConfirm: null, onCancel: null };

export function getCurrentModalCallbacks() { return { ...currentModalCallbacks }; }
export function setCurrentModalCallbacks(callbacks) { currentModalCallbacks = { ...callbacks }; }

export function showModal(title, bodyHtml, onConfirm = null, showCancel = true, customActionsHtml = null, onCancel = null) {
    if (!modalBackdrop || !modalTitle || !modalBody || !modalActions) {
        console.error("Modal elements are missing from the DOM.");
        return;
    }
    
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    
    if (customActionsHtml) {
        modalActions.innerHTML = customActionsHtml;
    } else {
        modalActions.innerHTML = `
            <button id="modal-confirm-btn" class="btn-primary">Confirm</button>
            ${showCancel ? '<button id="modal-cancel-btn" class="btn-secondary">Cancel</button>' : ''}
        `;
    }

    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const okBtn = document.getElementById('modal-ok-btn');
    
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            if (onConfirm) {
                const result = await Promise.resolve(onConfirm(modalBody)); // Pass modalBody reference
                if (result !== false) hideModal();
            } else {
                hideModal();
            }
        };
    }
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            if (onCancel) {
                onCancel();
            }
            hideModal();
        };
    }
    if (okBtn) {
        okBtn.onclick = () => {
            hideModal();
        };
    }

    modalBackdrop.classList.remove("hidden");
    return modalBody; // Return the modal body for use in contacts.js
}

export function hideModal() {
    if (modalBackdrop) modalBackdrop.classList.add("hidden");
}

function handleBackdropClick(e) { if (e.target === modalBackdrop) hideModal(); }
function handleEscapeKey(e) { if (e.key === "Escape") hideModal(); }

export function setupModalListeners() {
    window.addEventListener("keydown", handleEscapeKey);
    if (modalBackdrop) modalBackdrop.addEventListener("click", handleBackdropClick);
}

// --- GLOBAL LOADING OVERLAY ---
const GLOBAL_LOADER_ID = 'global-loader-overlay';

export function showGlobalLoader() {
    const el = document.getElementById(GLOBAL_LOADER_ID);
    if (el) {
        el.classList.add('active');
        el.setAttribute('aria-busy', 'true');
    }
}

export function hideGlobalLoader() {
    const el = document.getElementById(GLOBAL_LOADER_ID);
    if (el) {
        el.classList.remove('active');
        el.setAttribute('aria-busy', 'false');
    }
}

// --- TOAST NOTIFICATIONS ---
export function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 4000); 
}


// js/shared_constants.js

// ... (keep all other functions like SUPABASE_URL, formatDate, initializeAppState, etc., the same)

/**
 * Returns first name only from a full name (e.g. "John Doe" -> "John").
 * @param {string} fullName - Full name
 * @returns {string}
 */
function getFirstName(fullName) {
    if (!fullName || typeof fullName !== 'string') return 'User';
    const trimmed = fullName.trim();
    if (!trimmed) return 'User';
    const first = trimmed.split(/\s+/)[0];
    return first || 'User';
}

/**
 * Scales the user name font size down until it fits within its container.
 * @param {HTMLElement} el - The #user-name-display element
 */
function fitUserNameToContainer(el) {
    if (!el || !el.parentElement) return;
    const MIN_FONT_PX = 12;
    const MAX_FONT_PX = 18;
    el.style.fontSize = '';
    el.style.fontSize = `${MAX_FONT_PX}px`;
    const parent = el.parentElement;
    const icon = parent.querySelector('.user-icon, [data-svg-loader]');
    const iconWidth = icon ? icon.offsetWidth : 80;
    const gap = 10;
    const maxWidth = parent.clientWidth - iconWidth - gap;
    if (maxWidth <= 0) return;
    while (el.scrollWidth > maxWidth && parseInt(getComputedStyle(el).fontSize) > MIN_FONT_PX) {
        const current = parseInt(getComputedStyle(el).fontSize);
        el.style.fontSize = `${Math.max(MIN_FONT_PX, current - 1)}px`;
    }
}

// --- USER MENU & AUTH LOGIC (UPDATED FOR IMPERSONATION) ---
/**
 * @param {object} supabase - Supabase client
 * @param {object} appState - App state (use getState() for full manager/impersonation support)
 * @param {{ skipImpersonation?: boolean }} options - skipImpersonation: true to hide the View As dropdown (e.g. on Deals which has its own team toggle)
 */
export async function setupUserMenuAndAuth(supabase, appState, options = {}) {
    const userMenuPopup = document.getElementById('user-menu-popup');
    const logoutBtn = document.getElementById("logout-btn");

    if (!userMenuPopup || !logoutBtn) {
        console.error("One or more user menu elements are missing.");
        return;
    }

    // --- Manager Impersonation Dropdown Logic ---
    // Use getState() when passed state lacks manager fields (ensures dropdown shows if any page initialized it)
    const stateForMenu = appState?.isManager !== undefined ? appState : getState();
    const debugOverride = typeof URLSearchParams !== 'undefined' && new URLSearchParams(window.location.search).get('impersonation') === '1';
    const showImpersonation = !options.skipImpersonation && (stateForMenu.isManager || debugOverride);
    if (stateForMenu.currentUser && !options.skipImpersonation) {
        console.log('[Impersonation] isManager:', stateForMenu.isManager, 'managedUsers:', stateForMenu.managedUsers?.length ?? 0, 'showDropdown:', showImpersonation);
    }

    const existingWrap = document.getElementById('manager-view-select-wrap');
    const existingDropdown = document.getElementById('manager-view-select');
    if (existingWrap) existingWrap.remove();
    else if (existingDropdown) existingDropdown.parentElement?.removeChild(existingDropdown);

    if (showImpersonation) {
        const wrap = document.createElement('div');
        wrap.id = 'manager-view-select-wrap';
        wrap.className = 'impersonation-dropdown-wrap';
        wrap.style.marginBottom = '8px';
        const label = document.createElement('label');
        label.textContent = 'View as:';
        label.style.display = 'block';
        label.style.fontSize = '0.75rem';
        label.style.color = 'var(--text-medium)';
        label.style.marginBottom = '4px';
        const viewSelect = document.createElement('select');
        viewSelect.id = 'manager-view-select';
        viewSelect.className = 'nav-button';
        viewSelect.setAttribute('aria-label', 'View as user');

        const managerName = stateForMenu.currentUser.user_metadata?.full_name || 'Me';
        let options = `<option value="${stateForMenu.currentUser.id}">${managerName}</option>`;
        options += (stateForMenu.managedUsers || []).map(user =>
            `<option value="${user.id}">${user.full_name}</option>`
        ).join('');

        viewSelect.innerHTML = options;
        viewSelect.value = stateForMenu.effectiveUserId || stateForMenu.currentUser.id;

        wrap.appendChild(label);
        wrap.appendChild(viewSelect);
        userMenuPopup.insertBefore(wrap, userMenuPopup.firstChild);

        const handleChange = (selectedUserId) => {
            const selectedUser = (stateForMenu.managedUsers || []).find(u => u.id === selectedUserId) || {
                id: stateForMenu.currentUser.id,
                full_name: managerName
            };
            setEffectiveUser(selectedUserId, selectedUser.full_name);
        };

        if (typeof window.TomSelect !== 'undefined') {
            try {
                const ts = viewSelect.tomselect;
                if (ts) ts.destroy();
                const tom = new window.TomSelect(viewSelect, {
                    create: false,
                    placeholder: 'View as...',
                    dropdownParent: 'body',
                    controlInput: null,
                    searchField: [],
                    plugins: ['input_autogrow'],
                    onDropdownOpen() {
                        const d = this.dropdown;
                        if (d) d.className = 'ts-dropdown tom-select-no-search';
                    },
                    render: {
                        dropdown: () => {
                            const d = document.createElement('div');
                            d.className = 'ts-dropdown tom-select-no-search';
                            return d;
                        }
                    },
                    onChange: (val) => handleChange(val)
                });
                tom.setValue(stateForMenu.effectiveUserId || stateForMenu.currentUser.id, true);
            } catch (err) {
                console.warn('[Impersonation] Tom Select init failed, using native select:', err);
                viewSelect.addEventListener('change', (e) => handleChange(e.target.value));
            }
        } else {
            viewSelect.addEventListener('change', (e) => handleChange(e.target.value));
        }
    }
    // --- END NEW LOGIC ---

    const { data: userData, error: userError } = await supabase
        .from('user_quotas')
        .select('full_name, monthly_quota')
        .eq('user_id', appState.currentUser.id) // Use the actual logged-in user
        .single();

    if (userError && userError.code !== 'PGRST116') {
        console.error('Error fetching user data:', userError);
        return;
    }
    
    if (!userData || !userData.full_name) {
        const modalBodyHtml = `
            <p>Welcome to Constellation! Please enter your details to get started.</p>
            <div>
                <label for="modal-full-name">Full Name</label>
                <input type="text" id="modal-full-name" required>
            </div>
            <div>
                <label for="modal-monthly-quota">Monthly Quota ($)</label>
                <input type="number" id="modal-monthly-quota" required placeholder="e.g., 50000">
            </div>
        `;
        showModal("Welcome!", modalBodyHtml, async () => {
            const fullName = document.getElementById('modal-full-name')?.value.trim();
            const monthlyQuota = document.getElementById('modal-monthly-quota')?.value;

            if (!fullName || !monthlyQuota) {
                alert("Please fill out all fields.");
                return false;
            }

            const { error: upsertError } = await supabase
                .from('user_quotas')
                .upsert({
                    user_id: appState.currentUser.id,
                    full_name: fullName,
                    monthly_quota: Number(monthlyQuota)
                }, { onConflict: 'user_id' });

            if (upsertError) {
                console.error("Error saving user details to user_quotas:", upsertError);
                alert("Could not save your profile details. Please try again: " + upsertError.message);
                return false;
            }

            const { error: updateUserError } = await supabase.auth.updateUser({
                data: { full_name: fullName }
            });

            if (updateUserError) {
                console.warn("Could not save full_name to user metadata:", updateUserError);
            }
            
            await initializeAppState(supabase);
            await setupUserMenuAndAuth(supabase, getState());

            return true;

        }, false, `<button id="modal-confirm-btn" class="btn-primary">Get Started</button>`);
    
    } else {
        await setupTheme(supabase, appState.currentUser);
        attachUserMenuListeners();
    }

    function attachUserMenuListeners() {
        const userMenu = document.querySelector('.user-menu');
        if (userMenu?.dataset.listenerAttached === 'true') return;

        logoutBtn.addEventListener("click", async () => {
            sessionStorage.removeItem('crm-briefing-generated');
            sessionStorage.removeItem('crm-briefing-html');
            await supabase.auth.signOut();
            window.location.href = "index.html";
        });

        if (userMenu) userMenu.dataset.listenerAttached = 'true';
    }
}
export async function loadSVGs() {
    const svgPlaceholders = document.querySelectorAll('[data-svg-loader]');
    
    for (const placeholder of svgPlaceholders) {
        const svgUrl = placeholder.dataset.svgLoader;
        if (svgUrl) {
            try {
                const response = await fetch(svgUrl);
                if (!response.ok) throw new Error(`Failed to load SVG: ${response.statusText}`);
                
                const svgText = await response.text();
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
                const svgElement = svgDoc.documentElement;

                if (svgElement.querySelector('parsererror')) {
                    console.error(`Error parsing SVG from ${svgUrl}`);
                    continue;
                }
                
                if (svgUrl.includes('logo.svg') || svgUrl.includes('c-logo.svg') || svgUrl.includes('constellation-logo')) {
                    svgElement.classList.add(placeholder.closest('#auth-container') ? 'auth-logo' : 'nav-logo');
                    if (placeholder.classList.contains('nav-logo-expanded')) svgElement.classList.add('nav-logo-expanded');
                    if (placeholder.classList.contains('nav-logo-collapsed')) svgElement.classList.add('nav-logo-collapsed');
                    if (placeholder.classList.contains('constellation-main-logo')) svgElement.classList.add('constellation-main-logo');
                } else if (svgUrl.includes('user-icon.svg')) {
                    svgElement.classList.add('user-icon');
                }

                placeholder.replaceWith(svgElement);

            } catch (error) {
                console.error(`Could not load SVG from ${svgUrl}`, error);
                placeholder.innerHTML = '';
            }
        }
    }
}

let matrixProtocolActive = false;

// --- GLOBAL NAVIGATION (central template, no theme picker) ---
const GLOBAL_NAV_TEMPLATE = `
<div class="nav-mobile-bar">
    <a href="command-center.html" class="nav-mobile-logo" aria-label="Home"><div data-svg-loader="assets/constellation-logo-full.svg" class="constellation-main-logo"></div></a>
    <button type="button" id="nav-mobile-menu-btn" class="nav-mobile-menu-btn" aria-label="Open menu" title="Menu">
        <i class="fa-solid fa-bars"></i>
    </button>
</div>
<div class="nav-mobile-overlay hidden" id="nav-mobile-overlay" aria-hidden="true"></div>
<div id="nav-search-fanout" class="nav-search-fanout hidden" aria-hidden="true">
    <div class="nav-search-fanout-inner">
        <i class="fa-solid fa-search nav-search-fanout-icon"></i>
        <input type="text" id="global-search-fanout-input" placeholder="Search..." class="nav-search-fanout-input" aria-label="Search">
        <button type="button" id="nav-search-fanout-close" class="nav-search-fanout-close" aria-label="Close"><i class="fa-solid fa-times"></i></button>
    </div>
    <div id="global-search-fanout-results" class="global-search-results hidden"></div>
</div>
<div class="nav-drawer-content" id="nav-drawer-content">
<div class="nav-top-section">
    <button type="button" id="nav-collapse-toggle" class="nav-collapse-toggle" title="Collapse sidebar" aria-label="Collapse sidebar">
        <i class="fa-solid fa-chevron-left nav-collapse-icon"></i>
    </button>
    <div class="nav-logo-wrap">
        <div class="nav-logo-expanded constellation-main-logo" data-svg-loader="assets/constellation-logo-full.svg"></div>
        <div class="nav-logo-collapsed constellation-main-logo" data-svg-loader="assets/constellation-logo-c.svg"></div>
    </div>
    <div class="global-search-container">
        <button type="button" id="nav-search-trigger" class="nav-search-trigger" title="Search" aria-label="Search"><i class="fa-solid fa-search global-search-trigger-icon"></i></button>
        <div class="global-search-input-wrapper">
            <i class="fa-solid fa-search global-search-icon"></i>
            <input type="text" id="global-search-input" placeholder="Search..." class="nav-search-input">
        </div>
        <div id="global-search-results" class="global-search-results hidden"></div>
    </div>
</div>
<div class="nav-links-section">
    <a href="command-center.html" class="nav-button"><i class="fa-solid fa-gauge-high nav-icon"></i><span class="nav-label-text">Command Center</span></a>
    <a href="deals.html" class="nav-button"><i class="fa-solid fa-handshake nav-icon"></i><span class="nav-label-text">Deals</span></a>
    <a href="contacts.html" class="nav-button"><i class="fa-solid fa-address-book nav-icon"></i><span class="nav-label-text">Contacts</span></a>
    <a href="accounts.html" class="nav-button"><i class="fa-solid fa-building nav-icon"></i><span class="nav-label-text">Accounts</span></a>
    <a href="proposals.html" class="nav-button"><i class="fa-solid fa-file-lines nav-icon"></i><span class="nav-label-text">Proposals</span></a>
    <a href="irr.html" class="nav-button"><i class="fa-solid fa-calculator nav-icon"></i><span class="nav-label-text">IRR</span></a>
    <a href="campaigns.html" class="nav-button"><i class="fa-solid fa-bullhorn nav-icon"></i><span class="nav-label-text">Campaigns</span></a>
    <a href="sequences.html" class="nav-button"><i class="fa-solid fa-arrows-rotate nav-icon"></i><span class="nav-label-text">Sequences</span></a>
    <a href="social_hub.html" class="nav-button"><i class="fa-solid fa-share-nodes nav-icon"></i><span class="nav-label-text">Social Hub</span> <i class="fa-solid fa-bell nav-notification-dot hidden" id="social_hub-notification"></i></a>
</div>
<div class="nav-cognito-wrap">
    <a href="cognito.html" class="nav-button cognito-nav-btn" title="Cognito">
        <span class="cognito-icon-collapsed"><i class="fa-solid fa-magnifying-glass nav-icon"></i></span>
        <span class="nav-label-text cognito-text"><h1>C<svg class="cognito-logo-magnifying-glass" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="glassGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#60a5fa;"></stop><stop offset="100%" style="stop-color:#3b82f6;"></stop></linearGradient></defs><g fill="none" stroke="url(#glassGradient)" stroke-width="5" stroke-linecap="round"><path d="M32.2,32.2 L45,45"></path><circle cx="20" cy="20" r="15"></circle></g></svg>gnito</h1></span>
    </a>
    <i class="fa-solid fa-bell nav-notification-dot hidden" id="cognito-notification"></i>
</div>
<div class="nav-bottom-section">
    <div class="user-menu">
        <button type="button" id="nav-menu-toggle" class="nav-button nav-menu-toggle" title="Menu" aria-label="Menu" aria-expanded="false">
            <i class="fa-solid fa-bars nav-icon"></i>
            <span class="nav-label-text">Menu</span>
            <i class="fa-solid fa-chevron-down nav-menu-chevron"></i>
        </button>
        <div id="user-menu-popup" class="user-menu-content user-menu-collapsed">
            <button type="button" id="user-menu-hud-toggle" class="nav-button" style="width: 100%; text-align: left; background: none; border: none; cursor: pointer;"><i class="fa-solid fa-lightbulb nav-icon"></i><span class="nav-label-text">Page Tips & Tricks</span></button>
            <a href="ai-admin.html" class="nav-button"><i class="fa-solid fa-robot nav-icon"></i><span class="nav-label-text">AI Admin</span></a>
            <div class="user-menu-downloads">
                <span class="user-menu-downloads-label">CSV Templates</span>
                <a href="contacts_template.csv" class="user-menu-download-link" download>Contacts</a>
                <a href="accounts_template.csv" class="user-menu-download-link" download>Accounts</a>
                <a href="sequence_steps_template.csv" class="user-menu-download-link" download>Sequence Steps</a>
            </div>
            <button id="logout-btn" class="nav-button nav-button-logout"><i class="fa-solid fa-right-from-bracket nav-icon"></i><span class="nav-label-text">Logout</span></button>
        </div>
    </div>
</div>
</div>
`;

const NAV_COLLAPSED_KEY = 'crm-nav-collapsed';

export function injectGlobalNavigation() {
    const container = document.getElementById('global-nav-container');
    if (!container) return;

    container.innerHTML = GLOBAL_NAV_TEMPLATE;

    initHUD();
    const userMenuHudToggle = document.getElementById('user-menu-hud-toggle');
    if (userMenuHudToggle) {
        userMenuHudToggle.addEventListener('click', (e) => {
            e.preventDefault();
            openHUD();
        });
    }

    const navSidebar = container.closest('.nav-sidebar');
    const toggleBtn = document.getElementById('nav-collapse-toggle');

    const setCollapsed = (collapsed) => {
        if (!navSidebar) return;
        if (collapsed) {
            navSidebar.classList.add('nav-sidebar-collapsed');
            try { localStorage.setItem(NAV_COLLAPSED_KEY, '1'); } catch (_) {}
        } else {
            navSidebar.classList.remove('nav-sidebar-collapsed');
            try { localStorage.removeItem(NAV_COLLAPSED_KEY); } catch (_) {}
        }
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('.nav-collapse-icon');
            if (icon) icon.className = `fa-solid ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'} nav-collapse-icon`;
            toggleBtn.setAttribute('title', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
            toggleBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
        }
    };

    const isCollapsed = () => {
        try { return localStorage.getItem(NAV_COLLAPSED_KEY) === '1'; } catch (_) { return false; }
    };

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => setCollapsed(!navSidebar?.classList.contains('nav-sidebar-collapsed')));
    }

    if (navSidebar && isCollapsed()) {
        setCollapsed(true);
    }

    const searchTrigger = document.getElementById('nav-search-trigger');
    const searchFanout = document.getElementById('nav-search-fanout');
    const searchFanoutInput = document.getElementById('global-search-fanout-input');
    const searchFanoutClose = document.getElementById('nav-search-fanout-close');
    const openSearchFanout = () => {
        if (searchFanout) { searchFanout.classList.remove('hidden'); searchFanout.setAttribute('aria-hidden', 'false'); }
        if (searchFanoutInput) { searchFanoutInput.value = ''; searchFanoutInput.focus(); }
        if (navSidebar?.classList.contains('nav-sidebar-collapsed')) {
            navSidebar.classList.add('search-fanout-open');
            if (searchTrigger && searchFanout) {
                const rect = searchTrigger.getBoundingClientRect();
                searchFanout.style.top = `${rect.top}px`;
                searchFanout.style.bottom = 'auto';
            }
        }
    };
    const closeSearchFanout = () => {
        if (searchFanout) {
            searchFanout.classList.add('hidden');
            searchFanout.setAttribute('aria-hidden', 'true');
            searchFanout.style.top = '';
            searchFanout.style.bottom = '';
        }
        if (searchFanoutInput) searchFanoutInput.value = '';
        const fanoutResults = document.getElementById('global-search-fanout-results');
        if (fanoutResults) fanoutResults.classList.add('hidden');
        navSidebar?.classList.remove('search-fanout-open');
    };
    const menuToggle = document.getElementById('nav-menu-toggle');
    const userMenuContent = document.getElementById('user-menu-popup');
    const userMenu = document.querySelector('.user-menu');
    const closeUserMenu = () => {
        if (userMenuContent && !userMenuContent.classList.contains('user-menu-collapsed')) {
            userMenuContent.classList.add('user-menu-collapsed');
            menuToggle?.setAttribute('aria-expanded', 'false');
            const chevron = menuToggle?.querySelector('.nav-menu-chevron');
            if (chevron) chevron.className = 'fa-solid fa-chevron-down nav-menu-chevron';
            navSidebar?.classList.remove('user-menu-open');
        }
    };
    if (menuToggle && userMenuContent) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenuContent.classList.toggle('user-menu-collapsed');
            const isOpen = !userMenuContent.classList.contains('user-menu-collapsed');
            menuToggle.setAttribute('aria-expanded', isOpen);
            const chevron = menuToggle.querySelector('.nav-menu-chevron');
            if (chevron) chevron.className = `fa-solid fa-chevron-${isOpen ? 'up' : 'down'} nav-menu-chevron`;
            navSidebar?.classList.toggle('user-menu-open', isOpen);
        });
        document.addEventListener('click', (e) => {
            if (userMenu && !userMenu.contains(e.target)) closeUserMenu();
        });
    }

    if (searchTrigger) searchTrigger.addEventListener('click', (e) => { e.stopPropagation(); openSearchFanout(); });
    if (searchFanoutClose) searchFanoutClose.addEventListener('click', closeSearchFanout);
    if (searchFanout) {
        searchFanout.addEventListener('click', (e) => { if (e.target === searchFanout) closeSearchFanout(); });
        document.addEventListener('click', (e) => {
            if (navSidebar?.classList.contains('search-fanout-open') && !searchFanout?.contains(e.target) && !searchTrigger?.contains(e.target)) closeSearchFanout();
        });
        const fanoutResultsEl = document.getElementById('global-search-fanout-results');
        if (fanoutResultsEl) fanoutResultsEl.addEventListener('click', (e) => { if (e.target.closest('a')) closeSearchFanout(); });
        searchFanoutInput?.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSearchFanout(); });
    }

    const mobileMenuBtn = document.getElementById('nav-mobile-menu-btn');
    const mobileOverlay = document.getElementById('nav-mobile-overlay');
    const navDrawer = document.getElementById('nav-drawer-content');
    const openMobileMenu = () => {
        navSidebar?.classList.add('nav-mobile-open');
        if (mobileOverlay) { mobileOverlay.classList.remove('hidden'); mobileOverlay.setAttribute('aria-hidden', 'false'); }
        if (mobileMenuBtn) {
            const icon = mobileMenuBtn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-times';
            mobileMenuBtn.setAttribute('aria-label', 'Close menu');
        }
    };
    const closeMobileMenu = () => {
        navSidebar?.classList.remove('nav-mobile-open');
        if (mobileOverlay) { mobileOverlay.classList.add('hidden'); mobileOverlay.setAttribute('aria-hidden', 'true'); }
        if (mobileMenuBtn) {
            const icon = mobileMenuBtn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-bars';
            mobileMenuBtn.setAttribute('aria-label', 'Open menu');
        }
    };
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => navSidebar?.classList.contains('nav-mobile-open') ? closeMobileMenu() : openMobileMenu());
    if (mobileOverlay) mobileOverlay.addEventListener('click', closeMobileMenu);
    if (navDrawer) {
        navDrawer.querySelectorAll('a.nav-button[href]').forEach((a) => a.addEventListener('click', closeMobileMenu));
        const logoutBtn = navDrawer.querySelector('#logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', closeMobileMenu);
    }

    const currentPage = (window.location.pathname || '').split('/').pop() || window.location.href;
    container.querySelectorAll('a.nav-button[href]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        const linkPage = href.split('/').pop();
        if (linkPage && (currentPage === linkPage || currentPage.endsWith(linkPage))) {
            a.classList.add('active');
        }
    });
}

// --- GLOBAL SEARCH FUNCTION ---
export async function setupGlobalSearch(supabase) {
    const searchInput = document.getElementById('global-search-input');
    const searchResultsContainer = document.getElementById('global-search-results');
    const fanoutInput = document.getElementById('global-search-fanout-input');
    const fanoutResults = document.getElementById('global-search-fanout-results');
    let searchTimeout;

    const inputs = [searchInput, fanoutInput].filter(Boolean);
    const resultContainers = [searchResultsContainer, fanoutResults].filter(Boolean);

    if (inputs.length === 0 || !searchResultsContainer) {
        console.warn("Global search elements not found on this page.");
        return;
    }

    function attachSearchListeners(inputEl, resultsEl) {
        if (!inputEl || !resultsEl) return;
        inputEl.addEventListener('input', (event) => {
            const value = event.target.value.trim().toLowerCase();
            if (value === 'matrix' && !matrixProtocolActive) {
                event.target.value = '';
                event.target.blur();
                triggerMatrixProtocol();
            }
        });
        inputEl.addEventListener('keyup', (e) => {
            clearTimeout(searchTimeout);
            const searchTerm = e.target.value.trim();
            if (searchTerm.length < 2) {
                resultsEl.classList.add('hidden');
                return;
            }
            searchTimeout = setTimeout(() => performSearch(searchTerm, resultsEl), 300);
        });
    }

    async function performSearch(term, resultsContainer) {
        const target = resultsContainer || searchResultsContainer;
        target.innerHTML = '<div class="search-result-item">Searching...</div>';
        target.classList.remove('hidden');
        try {
            const { data: results, error } = await supabase.functions.invoke('global-search', { body: { searchTerm: term } });
            if (error) throw error;
            if (results.length === 0) {
                target.innerHTML = '<div class="search-result-item">No results found.</div>';
            } else {
                target.innerHTML = results.map(r => `<a href="${r.url}" class="search-result-item"><span class="result-type">${r.type}</span><span class="result-name">${r.name}</span></a>`).join('');
            }
        } catch (error) {
            console.error("Error invoking global-search function:", error);
            target.innerHTML = `<div class="search-result-item">Error: ${error.message}</div>`;
        }
    }

    attachSearchListeners(searchInput, searchResultsContainer);
    if (fanoutInput && fanoutResults) attachSearchListeners(fanoutInput, fanoutResults);

    document.addEventListener('click', (e) => {
        const searchContainer = document.querySelector('.global-search-container');
        const fanout = document.getElementById('nav-search-fanout');
        if (searchContainer && !searchContainer.contains(e.target) && !fanout?.contains(e.target)) {
            resultContainers.forEach(rc => rc?.classList.add('hidden'));
        }
    });
}

// --- MATRIX PROTOCOL (Easter Egg) ---
function triggerMatrixProtocol() {
    matrixProtocolActive = true;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.zIndex = '9999';
    canvas.style.backgroundColor = 'black';
    canvas.style.pointerEvents = 'none';

    document.body.appendChild(canvas);

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resizeCanvas();

    // Simple Matrix rain setup
    const fontSize = 16;
    const letters = 'アァカサタナハマヤャラワ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let columns = Math.floor(canvas.width / fontSize);
    let drops = Array.from({ length: columns }, () => 0);

    window.addEventListener('resize', () => {
        resizeCanvas();
        columns = Math.floor(canvas.width / fontSize);
        drops = Array.from({ length: columns }, () => 0);
    }, { once: true });

    function drawFrame() {
        // Fading trail
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#0F0';
        ctx.font = `${fontSize}px monospace`;

        for (let i = 0; i < drops.length; i++) {
            const text = letters.charAt(Math.floor(Math.random() * letters.length));
            const x = i * fontSize;
            const y = drops[i] * fontSize;
            ctx.fillText(text, x, y);

            if (y > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            } else {
                drops[i]++;
            }
        }
    }

    let animationFrameId;
    function loop() {
        drawFrame();
        animationFrameId = requestAnimationFrame(loop);
    }

    loop();

    // After 3 seconds, switch to theme-green and fade out
    setTimeout(() => {
        cancelAnimationFrame(animationFrameId);
        document.body.classList.add('theme-green');

        canvas.style.transition = 'opacity 0.5s ease';
        canvas.style.opacity = '0';

        setTimeout(() => {
            if (canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
            matrixProtocolActive = false;
        }, 550);
    }, 3000);
}

// --- NOTIFICATION FUNCTIONS (FINAL) ---

/**
 * Updates the visit timestamp for a page in the background.
 * This is a "fire and forget" operation.
 * @param {SupabaseClient} supabase The Supabase client instance.
 * @param {string} pageName The name of the page being visited.
 */
export function updateLastVisited(supabase, pageName) {
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase.from('user_page_visits')
            .upsert({
                user_id: user.id,
                page_name: pageName,
                last_visited_at: new Date().toISOString()
            }, { onConflict: 'user_id, page_name' })
            .then(({ error }) => {
                if (error) console.error(`Error updating visit for ${pageName}:`, error);
            });
    });
}


/**
 * Checks for new content on all pages and updates the bells.
 * This is now an async function that can be awaited for predictable execution.
 * @param {SupabaseClient} supabase The Supabase client instance.
 */
export async function checkAndSetNotifications(supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const pagesToCheck = [
        { name: 'social_hub', table: 'social_hub_posts' },
        { name: 'cognito', table: 'cognito_alerts' }
    ];

    const { data: visits } = await supabase
        .from('user_page_visits')
        .select('page_name, last_visited_at')
        .eq('user_id', user.id);

    const lastVisits = new Map(visits ? visits.map(v => [v.page_name, new Date(v.last_visited_at).getTime()]) : []);

    for (const page of pagesToCheck) {
        const { data: latestItem } = await supabase
            .from(page.table)
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        const notificationDot = document.getElementById(`${page.name}-notification`);
        if (notificationDot && latestItem) {
            const lastVisitTime = lastVisits.get(page.name) || 0;
            const lastContentTime = new Date(latestItem.created_at).getTime();
            const hasNewContent = lastContentTime > lastVisitTime;
            
            notificationDot.classList.toggle('hidden', !hasNewContent);

        } else if (notificationDot) {
            notificationDot.classList.add('hidden');
        }
    }
}



