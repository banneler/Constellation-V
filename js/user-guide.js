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
            <p>Welcome to Constellation, your intelligent sales execution platform. Constellation is designed to streamline your workflow, automate outreach, and provide you with AI-powered insights to close deals faster.</p>
            <p>This guide will walk you through the key features of the platform, from managing your core CRM data to leveraging our most advanced AI capabilities.</p>
        </div>
    `,
    "getting-started": `
        <div>
            <h2>Getting Started</h2>
            <h4>The Interface</h4>
            <p>The Constellation interface is designed for simplicity and efficiency. It consists of two main parts:</p>
            <ul>
                <li><strong>Navigation Sidebar (Left):</strong> This is your primary way to move between different sections of the application, such as the Command Center, Contacts, Deals, and more.</li>
                <li><strong>Content Area (Right):</strong> This is the main workspace where all the information and tools for the selected section are displayed.</li>
            </ul>
            <h4>User Menu</h4>
            <p>In the bottom-left corner, you'll find the user menu. Click on your name to open it. From here, you can toggle between Light and Dark themes or log out of your account.</p>
            <h4>Global Search</h4>
            <p>At the top of the sidebar, the global search bar allows you to quickly find any Contact, Account, or Deal in your database by name.</p>
        </div>
    `,
    "contacts-accounts": `
        <div>
            <h2>Managing Contacts & Accounts</h2>
            <p>Contacts and Accounts are the foundation of your CRM. An <strong>Account</strong> is a company you do business with, and a <strong>Contact</strong> is an individual person who works at that company.</p>
            <h4>Creating and Managing</h4>
            <p>You can add, edit, and delete records on both the Accounts and Contacts pages. It is best practice to always associate a Contact with an existing Account to keep your data organized.</p>
            <h4>Key Features</h4>
            <ul>
                <li><strong>CSV Import/Export:</strong> Use the "More Actions" menu to bulk import new records from a CSV file or export your existing data. Templates are provided to ensure correct formatting.</li>
                <li><strong>Organic Star (<i class="fas fa-star" style="color: #4CAF50;"></i>):</strong> Mark an Account as "Organic" to signify that it was sourced through inbound marketing efforts rather than direct sales outreach.</li>
                <li><strong>AI Insights:</strong> Click the "Get Insights" button on an Account's detail page to generate an AI-powered summary of the company, its recent activities, and potential talking points for your next call or email.</li>
            </ul>
        </div>
    `,
    "deals-funnel": `
        <div>
            <h2>Working with Deals & Your Funnel</h2>
            <p>The Deals page provides a high-level overview of your entire sales pipeline and key performance metrics.</p>
            <h4>The Funnel</h4>
            <p>The sales funnel visualizes how many deals are currently in each stage of your sales process, from "Prospecting" to "Closed Won".</p>
            <h4>Key Metrics</h4>
            <ul>
                <li><strong>Total Value:</strong> The combined value of all deals currently in the funnel.</li>
                <li><strong>Conversion Rate:</strong> The percentage of deals that have been moved to "Closed Won".</li>
                <li><strong>Average Deal Size:</strong> The average value of your successfully closed deals.</li>
            </ul>
            <p>You can add new deals and manage their progression through the funnel directly from this page.</p>
        </div>
    `,
    "sequences-campaigns": `
        <div>
            <h2>Automating Outreach with Sequences & Campaigns</h2>
            <p>Constellation's automation tools help you engage with prospects at scale while maintaining a personal touch.</p>
            <h4>Sequences</h4>
            <p>A <strong>Sequence</strong> is an automated series of emails sent to a contact over a period of time. This is perfect for nurturing leads or re-engaging cold contacts.</p>
            <ul>
                <li><strong>Creating Steps:</strong> Build your sequence by adding multiple email steps. You can set a specific delay (in days) between each step.</li>
                <li><strong>AI Assist:</strong> Use the "AI Assist" button to generate compelling email copy for each step based on a simple prompt.</li>
                <li><strong>Enrolling Contacts:</strong> You can enroll contacts into a sequence directly from the Contacts or Accounts pages.</li>
            </ul>
            <h4>Campaigns</h4>
            <p>A <strong>Campaign</strong> is a one-time email blast sent to a curated list of contacts. This is ideal for announcements, newsletters, or special promotions. Like sequences, campaigns also feature an "AI Assist" button to help you craft the perfect message.</p>
        </div>
    `,
    "cognito-social": `
        <div>
            <h2>Using AI Features: Cognito & Social Hub</h2>
            <p>These are Constellation's most powerful features, designed to give you a competitive edge by leveraging real-time, AI-driven intelligence.</p>
            <h4>Cognito</h4>
            <p><strong>Cognito</strong> is your personal intelligence feed. It constantly scans the web for news and events related to your target accounts and alerts you to actionable opportunities, such as:</p>
            <ul>
                <li>C-Suite leadership changes</li>
                <li>New funding rounds or acquisitions</li>
                <li>Major company announcements or product launches</li>
            </ul>
            <p>Click "Action" on any alert to open the <strong>Action Center</strong>, where our AI will provide a suggested outreach email and allow you to log interactions or create follow-up tasks in Constellation instantly.</p>
            <h4>Social Hub</h4>
            <p>The <strong>Social Hub</strong> is a curated feed of relevant news articles and pre-approved marketing content. Use it to easily find and share valuable content on your professional social media networks (like LinkedIn).</p>
            <p>Click "Prepare Post" on any item, and our AI will generate a suggested social media post for you. You can use it as-is or use the "Refine" feature to customize the tone and style.</p>
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
