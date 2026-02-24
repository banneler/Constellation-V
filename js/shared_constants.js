// js/shared_constants.js

// --- SHARED CONSTANTS AND FUNCTIONS ---

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


    // Check if the user is a manager
    if (currentUserProfile && currentUserProfile.is_manager === true) {
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
export async function setupUserMenuAndAuth(supabase, appState) { // Takes the global appState now
    const userMenuPopup = document.getElementById('user-menu-popup');
    const logoutBtn = document.getElementById("logout-btn");

    if (!userMenuPopup || !logoutBtn) {
        console.error("One or more user menu elements are missing.");
        return;
    }

    // --- NEW: Manager Impersonation Dropdown Logic ---
    // Remove any existing impersonation dropdown before adding a new one
    const existingDropdown = document.getElementById('manager-view-select');
    if (existingDropdown) {
        existingDropdown.parentElement.removeChild(existingDropdown);
    }

    if (appState.isManager) {
        const viewSelect = document.createElement('select');
        viewSelect.id = 'manager-view-select';
        viewSelect.className = 'nav-button'; // Style it like other nav buttons
        viewSelect.style.marginBottom = '5px';

        // Add the manager themself to the list
        let options = `<option value="${appState.currentUser.id}">${appState.currentUser.user_metadata.full_name} (My View)</option>`;

        // Add managed users
        options += appState.managedUsers.map(user =>
            `<option value="${user.id}">${user.full_name}</option>`
        ).join('');

        viewSelect.innerHTML = options;
        viewSelect.value = appState.effectiveUserId; // Set the current view

        // Insert the dropdown at the top of the popup menu
        userMenuPopup.insertBefore(viewSelect, userMenuPopup.firstChild);

        // Add event listener to trigger impersonation
        viewSelect.addEventListener('change', (e) => {
            const selectedUserId = e.target.value;
            const selectedUser = appState.managedUsers.find(u => u.id === selectedUserId) || {
                id: appState.currentUser.id,
                full_name: appState.currentUser.user_metadata.full_name
            };
            // This function from shared_constants triggers the 'effectiveUserChanged' event
            setEffectiveUser(selectedUserId, selectedUser.full_name);
        });
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
                
                if (svgUrl.includes('logo.svg')) {
                    svgElement.classList.add(placeholder.closest('#auth-container') ? 'auth-logo' : 'nav-logo');
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
<div class="nav-top-section">
    <div data-svg-loader="assets/logo.svg"></div>
    <div class="global-search-container">
        <div class="global-search-input-wrapper">
            <i class="fa-solid fa-magnifying-glass global-search-icon"></i>
            <input type="text" id="global-search-input" placeholder="Search...">
        </div>
        <div id="global-search-results" class="global-search-results hidden"></div>
    </div>
</div>
<div class="nav-links-section">
    <a href="command-center.html" class="nav-button"><i class="fa-solid fa-gauge-high nav-icon"></i>Command Center</a>
    <a href="deals.html" class="nav-button"><i class="fa-solid fa-handshake nav-icon"></i>Deals</a>
    <a href="contacts.html" class="nav-button"><i class="fa-solid fa-address-book nav-icon"></i>Contacts</a>
    <a href="accounts.html" class="nav-button"><i class="fa-solid fa-building nav-icon"></i>Accounts</a>
    <a href="campaigns.html" class="nav-button"><i class="fa-solid fa-bullhorn nav-icon"></i>Campaigns</a>
    <a href="sequences.html" class="nav-button"><i class="fa-solid fa-arrows-rotate nav-icon"></i>Sequences</a>
    <a href="social_hub.html" class="nav-button"><i class="fa-solid fa-share-nodes nav-icon"></i>Social Hub <i class="fa-solid fa-bell nav-notification-dot hidden" id="social_hub-notification"></i></a>
</div>
<div class="nav-bottom-section">
    <div style="position: relative;">
        <a href="cognito.html" class="nav-button cognito-nav-link">
            <h1>
                C<svg class="cognito-logo-magnifying-glass" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="glassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#60a5fa;"></stop>
                            <stop offset="100%" style="stop-color:#3b82f6;"></stop>
                        </linearGradient>
                    </defs>
                    <g fill="none" stroke="url(#glassGradient)" stroke-width="5" stroke-linecap="round">
                        <path d="M32.2,32.2 L45,45"></path>
                        <circle cx="20" cy="20" r="15"></circle>
                    </g>
                </svg>gnito
            </h1>
        </a>
        <i class="fa-solid fa-bell nav-notification-dot hidden" id="cognito-notification"></i>
    </div>
    <div class="user-menu">
        <div id="user-menu-popup" class="user-menu-content">
            <a href="user-guide.html" class="nav-button"><i class="fa-solid fa-book nav-icon"></i>User Guide</a>
            <div class="user-menu-downloads">
                <span class="user-menu-downloads-label">CSV Templates</span>
                <a href="contacts_template.csv" class="user-menu-download-link" download>Contacts</a>
                <a href="accounts_template.csv" class="user-menu-download-link" download>Accounts</a>
                <a href="sequence_steps_template.csv" class="user-menu-download-link" download>Sequence Steps</a>
            </div>
            <button id="logout-btn" class="nav-button nav-button-logout"><i class="fa-solid fa-right-from-bracket nav-icon"></i>Logout</button>
        </div>
    </div>
</div>
`;

export function injectGlobalNavigation() {
    const container = document.getElementById('global-nav-container');
    if (!container) return;

    container.innerHTML = GLOBAL_NAV_TEMPLATE;

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
    let searchTimeout;

    if (!searchInput || !searchResultsContainer) {
        console.warn("Global search elements not found on this page.");
        return;
    }

    // Easter egg trigger: \"matrix\" => Matrix Protocol
    searchInput.addEventListener('input', (event) => {
        const value = event.target.value.trim().toLowerCase();
        if (value === 'matrix' && !matrixProtocolActive) {
            // Clear, blur, and trigger the protocol
            event.target.value = '';
            event.target.blur();
            triggerMatrixProtocol();
        }
    });

    searchInput.addEventListener('keyup', (e) => {
        clearTimeout(searchTimeout);
        const searchTerm = e.target.value.trim();

        if (searchTerm.length < 2) {
            searchResultsContainer.classList.add('hidden');
            return;
        }

        searchTimeout = setTimeout(() => {
            performSearch(searchTerm);
        }, 300);
    });

    async function performSearch(term) {
        searchResultsContainer.innerHTML = '<div class="search-result-item">Searching...</div>';
        searchResultsContainer.classList.remove('hidden');

        try {
            const { data: results, error } = await supabase.functions.invoke('global-search', {
                body: { searchTerm: term }
            });

            if (error) {
                throw error;
            }

            renderResults(results || []);

        } catch (error) {
            console.error("Error invoking global-search function:", error);
            searchResultsContainer.innerHTML = `<div class="search-result-item">Error: ${error.message}</div>`;
        }
    }

    function renderResults(results) {
        if (results.length === 0) {
            searchResultsContainer.innerHTML = '<div class="search-result-item">No results found.</div>';
            return;
        }

        searchResultsContainer.innerHTML = results.map(result => `
            <a href="${result.url}" class="search-result-item">
                <span class="result-type">${result.type}</span>
                <span class="result-name">${result.name}</span>
            </a>
        `).join('');
    }

    // This is the corrected event listener.
    document.addEventListener('click', (e) => {
        const searchContainer = document.querySelector('.global-search-container');
        if (searchContainer && !searchContainer.contains(e.target)) {
            searchResultsContainer.classList.add('hidden');
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



