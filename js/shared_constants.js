// js/shared_constants.js

// --- SHARED CONSTANTS AND FUNCTIONS ---

export const SUPABASE_URL = "https://pjxcciepfypzrfmlfchj.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeGNjaWVwZnlwenJmbWxmY2hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxMTU4NDQsImV4cCI6MjA2NzY5MTg0NH0.m_jyE0e4QFevI-mGJHYlGmA12lXf8XoMDoiljUav79c";

export const themes = ["dark", "light", "green", "blue", "corporate"];

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

export const modalBackdrop = document.getElementById("modal-backdrop");
export const modalTitle = document.getElementById("modal-title");
export const modalBody = document.getElementById("modal-body");
export const modalActions = document.getElementById("modal-actions");

let currentModalCallbacks = { onConfirm: null, onCancel: null };

export function getCurrentModalCallbacks() { return { ...currentModalCallbacks }; }
export function setCurrentModalCallbacks(callbacks) { currentModalCallbacks = { ...callbacks }; }

export function _rebindModalActionListeners() {
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const okBtn = document.getElementById('modal-ok-btn');

    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            if (currentModalCallbacks.onConfirm) {
                const result = await Promise.resolve(currentModalCallbacks.onConfirm());
                if (result !== false) hideModal();
            } else {
                hideModal();
            }
        };
    }
    if (cancelBtn) {
        cancelBtn.onclick = () => {
             if (currentModalCallbacks.onCancel) {
                 currentModalCallbacks.onCancel();
            }
            hideModal();
        };
    }
     if (okBtn) {
        okBtn.onclick = () => {
            if (currentModalCallbacks.onConfirm) {
                 currentModalCallbacks.onConfirm();
            }
             hideModal();
        };
    }
}

export function showModal(title, bodyHtml, onConfirm = null, showCancel = true, customActionsHtml = null, onCancel = null) {
    if (!modalBackdrop || !modalTitle || !modalBody || !modalActions) return;

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

    currentModalCallbacks = { onConfirm, onCancel };
    _rebindModalActionListeners();
    modalBackdrop.classList.remove("hidden");
}

export function hideModal() {
    if (modalBackdrop) modalBackdrop.classList.add("hidden");
}

function handleBackdropClick(e) { if (e.target === modalBackdrop) hideModal(); }
function handleEscapeKey(e) { if (e.key === "Escape") hideModal(); }

export function setupModalListeners() {
    if (modalBackdrop) modalBackdrop.addEventListener("click", handleBackdropClick);
    window.addEventListener("keydown", handleEscapeKey);
}

// --- USER MENU & AUTH LOGIC (CORRECTED & ENHANCED) ---
export async function setupUserMenuAndAuth(supabase, state) {
    const userMenuHeader = document.querySelector('.user-menu-header');
    if (!userMenuHeader) return;

    const userNameDisplay = document.getElementById('user-name-display');
    const userMenuPopup = document.getElementById('user-menu-popup');
    const logoutBtn = document.getElementById("logout-btn");

    if (!userMenuPopup || !userNameDisplay || !logoutBtn) {
        console.error("One or more user menu elements are missing.");
        return;
    }

    // Fetch user data including full_name, monthly_quota, and company_name
    const { data: userData, error: userError } = await supabase
        .from('user_quotas')
        .select('full_name, monthly_quota, company_name') // Include company_name
        .eq('user_id', state.currentUser.id)
        .single();

    if (userError && userError.code !== 'PGRST116') { // PGRST116 means "no rows found"
        console.error('Error fetching user data:', userError);
        userNameDisplay.textContent = "Error";
        // Set fallback values in state in case of error
        state.currentUser.full_name = "User";
        state.currentUser.company_name = "Your Company";
        state.currentUser.monthly_quota = 0; // Default or handle as needed
        attachUserMenuListeners(); // Attach listeners even on error to allow logout
        return;
    }
    
    // If user data (full_name or company_name) is missing, show welcome modal
    if (!userData || !userData.full_name || !userData.company_name) {
        const modalBodyHtml = `
            <p>Welcome to Constellation! Please enter your details to get started.</p>
            <div>
                <label for="modal-full-name">Full Name</label>
                <input type="text" id="modal-full-name" required value="${userData?.full_name || ''}">
            </div>
            <div>
                <label for="modal-company-name">Company Name</label>
                <input type="text" id="modal-company-name" required value="${userData?.company_name || 'Great Plains Communications'}">
            </div>
            <div>
                <label for="modal-monthly-quota">Monthly Quota ($)</label>
                <input type="number" id="modal-monthly-quota" required placeholder="e.g., 50000" value="${userData?.monthly_quota || ''}">
            </div>
        `;
        showModal("Welcome!", modalBodyHtml, async () => {
            const fullName = document.getElementById('modal-full-name')?.value.trim();
            const companyName = document.getElementById('modal-company-name')?.value.trim(); // Get company name
            const monthlyQuota = document.getElementById('modal-monthly-quota')?.value;

            if (!fullName || !companyName || !monthlyQuota) { // Validate all fields
                alert("Please fill out all fields.");
                return false;
            }

            const { error: upsertError } = await supabase
                .from('user_quotas')
                .upsert({
                    user_id: state.currentUser.id,
                    full_name: fullName,
                    company_name: companyName, // Save company name
                    monthly_quota: Number(monthlyQuota)
                }, { onConflict: 'user_id' });

            if (upsertError) {
                console.error("Error saving user details to user_quotas:", upsertError);
                alert("Could not save your profile details. Please try again: " + upsertError.message);
                return false;
            }

            // Update state.currentUser with the newly saved data
            state.currentUser.full_name = fullName;
            state.currentUser.company_name = companyName;
            state.currentUser.monthly_quota = Number(monthlyQuota);

            // Optionally update auth.users metadata (though user_quotas is primary source now)
            const { error: updateUserError } = await supabase.auth.updateUser({
                data: { full_name: fullName } // Only full_name is typically stored here
            });
            if (updateUserError) {
                console.warn("Could not save full_name to user metadata:", updateUserError);
            }

            userNameDisplay.textContent = fullName;
            await setupTheme(supabase, state.currentUser); // Re-apply theme in case it was default
            attachUserMenuListeners(); // Ensure listeners are attached after initial setup
            return true;

        }, false, `<button id="modal-confirm-btn" class="btn-primary">Get Started</button>`);
    
    } else {
        // If data is found, update state.currentUser and UI immediately
        state.currentUser.full_name = userData.full_name;
        state.currentUser.company_name = userData.company_name;
        state.currentUser.monthly_quota = userData.monthly_quota;
        userNameDisplay.textContent = userData.full_name || 'User';
        await setupTheme(supabase, state.currentUser);
        attachUserMenuListeners();
    }

    function attachUserMenuListeners() {
        // Prevent attaching multiple listeners
        if (userMenuHeader.dataset.listenerAttached === 'true') return;

        userMenuHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenuPopup.classList.toggle('show');
        });

        window.addEventListener('click', (e) => {
            // Hide if click is outside the menu and menu is shown
            if (userMenuPopup.classList.contains('show') && !userMenuPopup.contains(e.target) && !userMenuHeader.contains(e.target)) {
                userMenuPopup.classList.remove('show');
            }
        });

        logoutBtn.addEventListener("click", async () => {
            await supabase.auth.signOut();
            window.location.href = "index.html";
        });
        
        userMenuHeader.dataset.listenerAttached = 'true'; // Mark listener as attached
    }
}
