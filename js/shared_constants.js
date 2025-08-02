// js/shared_constants.js

// --- SHARED CONSTANTS AND FUNCTIONS ---

export const SUPABASE_URL = "https://pjxcciepfypzrfmlfchj.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeGNjaWVwZnlwenJmbWxmY2hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxMTU4NDQsImV4cCI6MjA2NzY5MTg0NH0.m_jyE0e4QFevI-mGJHYlGmA12lXf8XoMDoiljUav79c";

export const themes = ["dark", "light", "green", "neon", "corporate"]; // Added blue & corporate back

// --- NEW: Centralized, Database-Driven Theme Management ---
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
    // New: Save to localStorage as well for instant loading
    localStorage.setItem('crm-theme', themeName);
}

export async function setupTheme(supabase, user) {
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    if (!themeToggleBtn) return;

    // 1. Load user's theme from the database
    const { data, error } = await supabase
        .from('user_preferences')
        .select('theme')
        .eq('user_id', user.id)
        .single();

    let currentTheme = localStorage.getItem('crm-theme') || 'dark'; // Use localStorage value as default
    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine
        console.error("Error fetching theme:", error);
    } else if (data) {
        currentTheme = data.theme;
    } else {
        // If no preference exists, save the default one for the user
        await saveThemePreference(supabase, user.id, currentTheme);
    }
    
    // 2. Apply the loaded theme and update local storage if needed
    currentThemeIndex = themes.indexOf(currentTheme);
    if (currentThemeIndex === -1) currentThemeIndex = 0; // Fallback if theme isn't in our list
    applyTheme(themes[currentThemeIndex]);
    localStorage.setItem('crm-theme', themes[currentThemeIndex]);

    // 3. Setup the click listener to cycle and save the theme
    themeToggleBtn.addEventListener("click", () => {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        const newTheme = themes[currentThemeIndex];
        applyTheme(newTheme);
        saveThemePreference(supabase, user.id, newTheme);
    });
}
// --- END OF NEW THEME LOGIC ---


// --- EXISTING SHARED UTILITY FUNCTIONS (PRESERVED FROM YOUR FILE) ---

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
    return date.toLocaleDateString("en-US");
}

export function formatCurrency(value) {
    if (typeof value !== 'number') return '$0';
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatCurrencyK(value) {
    if (typeof value !== 'number') return '$0';
    if (value >= 1000) {
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
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

export function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

export function updateActiveNavLink() {
    const currentPage = window.location.pathname.split("/").pop();
    document.querySelectorAll(".nav-button").forEach(link => {
        link.classList.remove("active");
        if (link.getAttribute("href") === currentPage) {
            link.classList.add("active");
        }
    });
}

// --- MODAL FUNCTIONS (PRESERVED FROM YOUR FILE) ---

export const modalBackdrop = document.getElementById("modal-backdrop");
export const modalTitle = document.getElementById("modal-title");
export const modalBody = document.getElementById("modal-body");
export const modalActions = document.getElementById("modal-actions");

let currentModalCallbacks = {
    onConfirm: null,
    onCancel: null
};

export function getCurrentModalCallbacks() {
    return { ...currentModalCallbacks };
}

export function setCurrentModalCallbacks(callbacks) {
    currentModalCallbacks = { ...callbacks };
}

export function _rebindModalActionListeners() {
    const modalActionsDiv = document.getElementById("modal-actions");
    if (!modalActionsDiv) {
        console.warn("modal-actions div not found for rebinding.");
        return;
    }

    ['modal-confirm-btn', 'modal-cancel-btn', 'modal-ok-btn', 'modal-return-btn', 'modal-exit-btn'].forEach(id => {
        const btn = modalActionsDiv.querySelector(`#${id}`);
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.replaceWith(newBtn);
        }
    });

    const confirmBtn = modalActionsDiv.querySelector('#modal-confirm-btn');
    const cancelBtn = modalActionsDiv.querySelector('#modal-cancel-btn');
    const okBtn = modalActionsDiv.querySelector('#modal-ok-btn');
    const returnBtn = modalActionsDiv.querySelector('#modal-return-btn');
    const exitBtn = modalActionsDiv.querySelector('#modal-exit-btn');


    if (confirmBtn) {
        confirmBtn.addEventListener("click", async () => {
            if (currentModalCallbacks.onConfirm) {
                const result = await Promise.resolve(currentModalCallbacks.onConfirm());
                if (result !== false) {
                    hideModal();
                }
            } else {
                hideModal();
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener("click", async () => {
            if (currentModalCallbacks.onCancel) {
                const result = await Promise.resolve(currentModalCallbacks.onCancel());
                if (result !== false) {
                    hideModal();
                }
            } else {
                hideModal();
            }
        });
    }

    if (okBtn) {
        okBtn.addEventListener("click", async () => {
            if (currentModalCallbacks.onConfirm) {
                const result = await Promise.resolve(currentModalCallbacks.onConfirm());
                if (result !== false) {
                    hideModal();
                }
            } else {
                hideModal();
            }
        });
    }

    if (returnBtn) {
        returnBtn.addEventListener("click", () => {
            // Logic handled in campaigns.js
        });
    }

    if (exitBtn) {
        exitBtn.addEventListener("click", hideModal);
    }
}


export function showModal(title, bodyHtml, onConfirm = null, showCancel = true, customActionsHtml = null, onCancel = null) {
    if (!modalBackdrop || !modalTitle || !modalBody || !modalActions) {
        console.error("Modal elements not found in DOM for showModal.");
        return;
    }

    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;

    modalActions.innerHTML = '';
    if (customActionsHtml) {
        modalActions.innerHTML = customActionsHtml;
    } else {
        modalActions.innerHTML = `
            <button id="modal-confirm-btn" class="btn-primary">Confirm</button>
            ${showCancel ? '<button id="modal-cancel-btn" class="btn-secondary">Cancel</button>' : ''}
        `;
    }

    currentModalCallbacks.onConfirm = onConfirm;
    currentModalCallbacks.onCancel = onCancel;

    _rebindModalActionListeners();

    modalBackdrop.classList.remove("hidden");
    modalBackdrop.style.display = 'flex';
}

export function hideModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.add("hidden");
    modalBackdrop.style.display = 'none';
    currentModalCallbacks = { onConfirm: null, onCancel: null };
}

export function setupModalListeners() {
    if (modalBackdrop) {
        modalBackdrop.removeEventListener("click", handleBackdropClick);
        modalBackdrop.addEventListener("click", handleBackdropClick);
    }
    window.removeEventListener("keydown", handleEscapeKey);
    window.addEventListener("keydown", handleEscapeKey);

    _rebindModalActionListeners();
}

function handleBackdropClick(e) {
    if (e.target === modalBackdrop) {
        hideModal();
    }
}

function handleEscapeKey(e) {
    if (e.key === "Escape") {
        hideModal();
    }
}


// --- USER MENU & AUTH LOGIC (MODIFIED) ---
export async function setupUserMenuAndAuth(supabase, state) {
    const userMenuHeader = document.querySelector('.user-menu-header');

    if (!userMenuHeader) {
        const oldLogoutBtn = document.getElementById('logout-btn');
        if (oldLogoutBtn) {
            oldLogoutBtn.addEventListener("click", async () => {
                await supabase.auth.signOut();
                window.location.href = "index.html";
            });
        }
        return;
    }

    if (userMenuHeader.dataset.listenerAttached === 'true') {
        const userNameDisplay = document.getElementById('user-name-display');
        const { data: userData } = await supabase.from('user_quotas').select('full_name').eq('user_id', state.currentUser.id).single();
        if (userNameDisplay && userData) {
            userNameDisplay.textContent = userData.full_name || 'User';
        }
        return; 
    }

    const userMenuPopup = document.getElementById('user-menu-popup');
    const userNameDisplay = document.getElementById('user-name-display');
    const logoutBtn = document.getElementById("logout-btn");

    if (!userMenuPopup || !userNameDisplay || !logoutBtn) {
        console.error("One or more user menu elements are missing on this page.");
        return;
    }

    // Call the new centralized theme setup function
    await setupTheme(supabase, state.currentUser);

    const { data: userData, error: userError } = await supabase
        .from('user_quotas')
        .select('full_name, monthly_quota')
        .eq('user_id', state.currentUser.id)
        .single();

    if (userError && userError.code !== 'PGRST116') {
        console.error('Error fetching user data:', userError);
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
                    user_id: state.currentUser.id,
                    full_name: fullName,
                    monthly_quota: Number(monthlyQuota)
                }, { onConflict: 'user_id' });

            if (upsertError) {
                console.error("Error saving user details:", upsertError);
                alert("Could not save your details. Please try again: " + upsertError.message);
                return false;
            } else {
                userNameDisplay.textContent = fullName;
                return true;
            }
        }, false);
    } else {
        userNameDisplay.textContent = userData.full_name || 'User';
    }

    userMenuHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenuPopup.classList.toggle('show');
    });

    window.addEventListener('click', () => {
        if (userMenuPopup.classList.contains('show')) {
            userMenuPopup.classList.remove('show');
        }
    });

    logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "index.html";
    });
    
    userMenuHeader.dataset.listenerAttached = 'true';
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
        const svgElement = new DOMParser().parseFromString(svgText, "image/svg+xml").documentElement;
        
        placeholder.parentNode.replaceChild(svgElement, placeholder);
      } catch (error) {
        console.error(`Could not load SVG from ${svgUrl}`, error);
        placeholder.innerHTML = '';
      }
    }
  }
}

