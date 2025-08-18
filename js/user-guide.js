// js/user-guide.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    setupModalListeners,
    showModal,
    hideModal,
    setupUserMenuAndAuth,
    loadSVGs
} from './shared_constants.js';

// === USER GUIDE CONTENT ===
// This object holds the content for each section. 
// Simply replace the placeholder text with your content from the PDF.
const userGuideContent = {
    "introduction": `
        <div>
            <h2>Introduction to Constellation</h2>
            <p>This is the placeholder content for the Introduction. Here you would explain the purpose of Constellation CRM.</p>
        </div>
    `,
    "getting-started": `
        <div>
            <h2>Getting Started</h2>
            <p>This section covers the basics of logging in, navigating the interface, and setting up your profile.</p>
        </div>
    `,
    "contacts-accounts": `
        <div>
            <h2>Managing Contacts & Accounts</h2>
            <p>Content about creating, importing, and managing your contacts and accounts will go here.</p>
        </div>
    `,
    "deals-funnel": `
        <div>
            <h2>Working with Deals & Your Funnel</h2>
            <p>Explain the deals dashboard, metrics, and how to manage the sales pipeline.</p>
        </div>
    `,
    "sequences-campaigns": `
        <div>
            <h2>Automating Outreach with Sequences & Campaigns</h2>
            <p>Details about setting up automated email sequences and one-off campaigns.</p>
        </div>
    `,
    "cognito-social": `
        <div>
            <h2>Using AI Features: Cognito & Social Hub</h2>
            <p>An overview of the AI-powered intelligence feeds and how to leverage them for sales.</p>
        </div>
    `
};

// === State Management ===
const state = {
    currentUser: null
};

// --- DOM Element Selectors ---
const mainAppContainer = document.getElementById("user-guide-container");
const navList = document.getElementById('user-guide-nav');
const contentPane = document.getElementById('user-guide-content');

// --- Functions ---

/**
 * Loads the content for a given section ID into the main content pane.
 * @param {string} sectionId The ID of the section to load, e.g., "introduction".
 */
const loadContent = (sectionId) => {
    if (!contentPane) return;
    const content = userGuideContent[sectionId];
    if (content) {
        contentPane.innerHTML = content;
    } else {
        contentPane.innerHTML = `<h2>Content Not Found</h2><p>The content for this section has not been defined yet.</p>`;
    }
};

/**
 * Sets up all page-specific event listeners.
 */
function setupPageEventListeners() {
    setupModalListeners();

    if (navList) {
        navList.addEventListener('click', (event) => {
            event.preventDefault();
            const navButton = event.target.closest('.nav-button');
            if (navButton) {
                document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
                navButton.classList.add('active');
                const sectionId = navButton.dataset.section;
                loadContent(sectionId);
            }
        });
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        });
    }
}

/**
 * Initializes the page.
 */
async function initializePage() {
    await loadSVGs();
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        state.currentUser = session.user;
        if (mainAppContainer) mainAppContainer.classList.remove('hidden');
        await setupUserMenuAndAuth(supabase, state);
        setupPageEventListeners();
        
        const initialSection = navList?.querySelector('.nav-button.active');
        if (initialSection) {
            loadContent(initialSection.dataset.section);
        }
    } else {
        // If no session, redirect to the login page.
        window.location.href = 'index.html';
    }
}

// === App Initialization ===
document.addEventListener("DOMContentLoaded", initializePage);
