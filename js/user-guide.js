// js/user-guide.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    setupModalListeners,
    setupUserMenuAndAuth,
    loadSVGs
} from './shared_constants.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

const state = {
    currentUser: null
};

const authContainer = document.getElementById("auth-container");
const mainAppContainer = document.getElementById("user-guide-container");
const navList = document.getElementById('user-guide-nav');
const contentPane = document.getElementById('user-guide-content');

const loadContent = (sectionId) => {
    if (!contentPane) return;
    const content = userGuideContent[sectionId] || `<h2>Content Not Found</h2>`;
    contentPane.innerHTML = content;
};

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

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await supabase.auth.signOut();
        });
    }
}

async function initializePage() {
    await loadSVGs();
    
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            state.currentUser = session.user;
            if (authContainer) authContainer.classList.add('hidden');
            if (mainAppContainer) mainAppContainer.classList.remove('hidden');
            await setupUserMenuAndAuth(supabase, state);
            
            const initialSection = navList?.querySelector('.nav-button.active');
            if (initialSection) {
                loadContent(initialSection.dataset.section);
            }
        } else {
            state.currentUser = null;
            if (authContainer) authContainer.classList.remove('hidden');
            if (mainAppContainer) mainAppContainer.classList.add('hidden');
        }
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        if (authContainer) authContainer.classList.remove('hidden');
        if (mainAppContainer) mainAppContainer.classList.add('hidden');
    }
    
    setupPageEventListeners();
}

document.addEventListener("DOMContentLoaded", initializePage);
