// --- SHARED CONSTANTS AND FUNCTIONS ---

export const SUPABASE_URL = "https://pjxcciepfypzrfmlfchj.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeGNjaWVwZnlwenJmbWxmY2hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxMTU4NDQsImV4cCI6MjA2NzY5MTg0NH0.m_jyE0e4QFevI-mGJHYlGmA12lXf8XoMDoiljUav79c";

export const themes = ["dark", "light", "green"];

// --- SHARED UTILITY FUNCTIONS ---

export function formatDate(dateString) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
}

// js/shared_constants.js

export function formatMonthYear(dateString) {
    if (!dateString) return "N/A";
    // Split the "YYYY-MM" string to avoid timezone conversion errors
    const [year, month] = dateString.split('-');
    // Create a date in UTC to ensure it doesn't shift to the previous day
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

// --- MODAL FUNCTIONS ---

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


// --- USER MENU & AUTH LOGIC (CORRECTED) ---
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

    // --- FIX STARTS HERE ---
    // Check if listeners are already attached. If so, just update the name and exit.
    if (userMenuHeader.dataset.listenerAttached === 'true') {
        // We still might need to update the user's name if it changed, so we'll do that part.
        const userNameDisplay = document.getElementById('user-name-display');
        const { data: userData } = await supabase.from('user_quotas').select('full_name').eq('user_id', state.currentUser.id).single();
        if (userNameDisplay && userData) {
            userNameDisplay.textContent = userData.full_name || 'User';
        }
        return; // Exit to avoid re-attaching listeners
    }
    // --- END OF INITIAL CHECK ---

    const userMenuPopup = document.getElementById('user-menu-popup');
    const userNameDisplay = document.getElementById('user-name-display');
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const themeNameSpan = document.getElementById("theme-name");
    const logoutBtn = document.getElementById("logout-btn");

    if (!userMenuPopup || !userNameDisplay || !themeToggleBtn || !logoutBtn) {
        console.error("One or more user menu elements are missing on this page.");
        return;
    }

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

    // Attach listeners
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

    let currentThemeIndex = themes.indexOf(localStorage.getItem('crm-theme') || 'dark');

    function applyThemeToPage(themeName) {
        document.body.className = '';
        document.body.classList.add(`theme-${themeName}`);
        if(themeNameSpan) {
            const capitalizedThemeName = themeName.charAt(0).toUpperCase() + themeName.slice(1);
            themeNameSpan.textContent = capitalizedThemeName;
        }
        localStorage.setItem('crm-theme', themeName);
    }

    themeToggleBtn.addEventListener("click", () => {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        const newTheme = themes[currentThemeIndex];
        applyThemeToPage(newTheme);
    });

    applyThemeToPage(themes[currentThemeIndex]);
    
    // Mark the element to show that listeners have been attached
    userMenuHeader.dataset.listenerAttached = 'true';
}
// Add this function to shared_constants.js

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
        
        // Replace placeholder with the actual SVG element
        placeholder.parentNode.replaceChild(svgElement, placeholder);
      } catch (error) {
        console.error(`Could not load SVG from ${svgUrl}`, error);
        placeholder.innerHTML = '';
      }
    }
  }
}
