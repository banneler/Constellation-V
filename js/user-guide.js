// js/user-guide.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    setupModalListeners,
    setupUserMenuAndAuth,
    loadSVGs
} from './shared_constants.js';

// Initialize the Supabase client, consistent with other pages
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Object to hold the content for each section of the guide
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

// Global state for the page
const state = {
    currentUser: null
};

// DOM Element Selectors
const authContainer = document.getElementById("auth-container");
const mainAppContainer = document.getElementById("user-guide-container");
const navList = document.getElementById('user-guide-nav');
const contentPane = document.getElementById('user-guide-content');

/**
 * Loads content into the main pane based on the selected section.
 * @param {string} sectionId - The ID of the content to load.
 */
const loadContent = (sectionId) => {
    if (!contentPane) return;
    const content = userGuideContent[sectionId] || `<h2>Content Not Found</h2>`;
    contentPane.innerHTML = content;
};

/**
 * Sets up all necessary event listeners for the page.
 */
function setupPageEventListeners() {
    setupModalListeners();

    if (navList) {
        navList.addEventListener('click', (event) => {
            event.preventDefault();
            const navButton = event.target.closest('.nav-button');
            if (navButton) {
                document.querySelectorAll('#user-guide-nav .nav-button').forEach(btn => btn.classList.remove('active'));
                navButton.classList.add('active');
                const sectionId = navButton.dataset.section;
                loadContent(sectionId);
            }
        });
    }
    // Note: The logout button listener is handled within setupUserMenuAndAuth
}

/**
 * Initializes the page, checks authentication, and sets up content.
 */
async function initializePage() {
    // Ensure all SVGs are loaded first
    await loadSVGs();
    
    // Set up the authentication state listener, which is the core of the app's security
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            // User is logged in
            state.currentUser = session.user;
            if (authContainer) authContainer.classList.add('hidden');
            if (mainAppContainer) mainAppContainer.classList.remove('hidden');
            await setupUserMenuAndAuth(supabase, state);
            
            // Load the initial content section after authentication is confirmed
            const initialSection = navList?.querySelector('.nav-button.active');
            if (initialSection) {
                loadContent(initialSection.dataset.section);
            }
        } else {
            // User is not logged in
            state.currentUser = null;
            if (authContainer) authContainer.classList.remove('hidden');
            if (mainAppContainer) mainAppContainer.classList.add('hidden');
        }
    });

    // Manually check the session on initial page load
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        if (authContainer) authContainer.classList.remove('hidden');
        if (mainAppContainer) mainAppContainer.classList.add('hidden');
    }
    
    // Set up the rest of the page's interactive elements
    setupPageEventListeners();
}

// Start the initialization process once the DOM is fully loaded
document.addEventListener("DOMContentLoaded", initializePage);
