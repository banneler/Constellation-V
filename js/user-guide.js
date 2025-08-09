// This file handles the logic for the user guide page.
// It is designed to match the structure and functionality of other page scripts like marketing-hub.js,
// using shared constants and a consistent approach for UI management.

// Import common helper functions and constants from the shared file.
import {
    setupModalListeners,
    setupUserMenuAndAuth,
    loadSVGs
} from './shared_constants.js';

// === User Guide Content ===
// This object will hold the content for each section of the user guide.
// The keys match the 'data-section' attributes in the HTML nav links.
const userGuideContent = {
    "link1": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">Link 1 Content</h2>
            <p>This is the placeholder content for Link 1. You can replace this with the real introduction to your user guide.</p>
            <p class="mt-4">Feel free to add lists, images, or other formatted content here.</p>
        </div>
    `,
    "link2": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">Link 2 Content</h2>
            <p>This section will contain information about the second topic in your user guide.</p>
            <ul class="list-disc list-inside mt-4 ml-4">
                <li>Key feature 1</li>
                <li>Key feature 2</li>
                <li>Key feature 3</li>
            </ul>
        </div>
    `,
    "link3": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">Link 3 Content</h2>
            <p>This is the final placeholder section. You can use it to cover more advanced topics or provide a summary.</p>
            <p class="mt-4">The dynamic loading is working correctly. Now we just need your content!</p>
        </div>
    `
    // Add more sections here with new key-value pairs.
};

// === State Management ===
// A simple state object to hold current application data.
const state = {
    currentUser: null
};

// --- DOM Element Selectors ---
const authContainer = document.getElementById("auth-container");
const mainAppContainer = document.querySelector(".page-container"); // Assuming .page-container holds the main app
const navList = document.getElementById('user-guide-nav');
const contentPane = document.getElementById('user-guide-content');

// --- Functions ---

/**
 * Loads the content for a given section ID into the main content pane.
 * @param {string} sectionId The ID of the section to load, e.g., "link1".
 */
const loadContent = (sectionId) => {
    const content = userGuideContent[sectionId];
    if (content) {
        contentPane.innerHTML = content;
    } else {
        // Display an error message if the content is not found
        contentPane.innerHTML = `
            <div class="p-8 text-center text-red-500">
                <h2 class="text-3xl font-bold mb-4">Error</h2>
                <p>Content for this section could not be found.</p>
            </div>
        `;
    }
};

/**
 * Sets up all page-specific event listeners.
 */
function setupPageEventListeners() {
    setupModalListeners();

    // Listener for clicks on the navigation list
    if (navList) {
        navList.addEventListener('click', (event) => {
            event.preventDefault();
            
            const navButton = event.target.closest('.nav-button');
            if (navButton) {
                // Remove the 'active' class from all buttons
                document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
                // Add the 'active' class to the clicked button
                navButton.classList.add('active');

                const sectionId = navButton.dataset.section;
                loadContent(sectionId);
            }
        });
    }

    if (document.getElementById("logout-btn")) {
        document.getElementById("logout-btn").addEventListener("click", async () => {
            await window.supabase.auth.signOut();
        });
    }
}

/**
 * Initializes the page by loading necessary assets and setting up auth state.
 */
async function initializePage() {
    await loadSVGs();
    
    const { data: { session } } = await window.supabase.auth.getSession();
    
    if (session) {
        state.currentUser = session.user;
        if (authContainer) authContainer.classList.add('hidden');
        if (mainAppContainer) mainAppContainer.classList.remove('hidden');
        await setupUserMenuAndAuth(window.supabase, state);
        setupPageEventListeners();
        
        // Load the content for the first link when the page first loads
        const initialSection = navList.querySelector('.nav-button.active');
        if (initialSection) {
            loadContent(initialSection.dataset.section);
        }

    } else {
        if (authContainer) authContainer.classList.remove('hidden');
        if (mainAppContainer) mainAppContainer.classList.add('hidden');
        setupPageEventListeners();
    }

    // This listener handles changes to the auth state (e.g., login, logout).
    window.supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            state.currentUser = session.user;
            if (authContainer) authContainer.classList.add('hidden');
            if (mainAppContainer) mainAppContainer.classList.remove('hidden');
            await setupUserMenuAndAuth(window.supabase, state);
        } else {
            state.currentUser = null;
            if (authContainer) authContainer.classList.remove('hidden');
            if (mainAppContainer) mainAppContainer.classList.add('hidden');
        }
    });
}

// === App Initialization ===
document.addEventListener("DOMContentLoaded", initializePage);
