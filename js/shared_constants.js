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

    themeToggleBtn.addEventListener("click", () => {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        const newTheme = themes[currentThemeIndex];
        applyTheme(newTheme);
        saveThemePreference(supabase, user.id, newTheme);
    });
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

let currentModalCallbacks = { onConfirm: null, onCancel: null };

export function getCurrentModalCallbacks() { return { ...currentModalCallbacks }; }
export function setCurrentModalCallbacks(callbacks) { currentModalCallbacks = { ...callbacks }; }

export function _rebindModalActionListeners() {
    // This function remains the same as before
}

export function showModal(title, bodyHtml, onConfirm = null, showCancel = true, customActionsHtml = null, onCancel = null) {
    // This function remains the same as before
}

export function hideModal() {
    // This function remains the same as before
}

export function setupModalListeners() {
    // This function remains the same as before
}

// --- USER MENU & AUTH LOGIC (CORRECTED) ---
export async function setupUserMenuAndAuth(supabase, state) {
    const userMenuHeader = document.querySelector('.user-menu-header');
    if (!userMenuHeader) return; // Exit if not on a CRM page

    const userNameDisplay = document.getElementById('user-name-display');
    const userMenuPopup = document.getElementById('user-menu-popup');
    const logoutBtn = document.getElementById("logout-btn");

    if (!userMenuPopup || !userNameDisplay || !logoutBtn) {
        console.error("One or more user menu elements are missing.");
        return;
    }

    // --- FETCH USER DATA ---
    const { data: userData, error: userError } = await supabase
        .from('user_quotas')
        .select('full_name, monthly_quota')
        .eq('user_id', state.currentUser.id)
        .single();

    if (userError && userError.code !== 'PGRST116') {
        console.error('Error fetching user data:', userError);
        userNameDisplay.textContent = "Error";
        return;
    }
    
    // --- ONBOARDING FOR NEW USERS ---
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

            // 1. FIRST, save the user's essential details.
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
            }
            
            // 2. NOW that the user has a record, safely set up their theme.
            userNameDisplay.textContent = fullName;
            await setupTheme(supabase, state.currentUser);
            
            // 3. Attach menu listeners now that setup is complete.
            attachUserMenuListeners();
            return true;

        }, false, `<button id="modal-confirm-btn" class="btn-primary">Get Started</button>`);
    
    } else {
        // --- SETUP FOR EXISTING USERS ---
        userNameDisplay.textContent = userData.full_name || 'User';
        await setupTheme(supabase, state.currentUser);
        attachUserMenuListeners();
    }

    function attachUserMenuListeners() {
        if (userMenuHeader.dataset.listenerAttached === 'true') return;

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
        
        // Add classes for styling if needed
        if (svgUrl.includes('logo.svg')) {
            svgElement.classList.add('nav-logo');
        } else if (svgUrl.includes('user-icon.svg')) {
            svgElement.classList.add('user-icon');
        }

        placeholder.replaceWith(svgElement);

      } catch (error) {
        console.error(`Could not load SVG from ${svgUrl}`, error);
        placeholder.innerHTML = ''; // Clear placeholder on error
      }
    }
  }
}
