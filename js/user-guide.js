/**
 * user-guide.js
 * This script provides the basic structure for the User Guide page,
 * handling authentication and layout, creating a blank canvas to build upon.
 */
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    setupUserMenuAndAuth,
    loadSVGs
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    // Initialize Supabase client
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Minimal state for the page
    let state = {
        currentUser: null,
    };

    // --- DOM Element Selectors ---
    const authContainer = document.getElementById("auth-container");
    const userGuideContainer = document.getElementById("user-guide-container");
    const userGuideContent = document.getElementById("user-guide-content");

    // --- App Initialization ---
    async function initializePage() {
        // Load SVG icons used in the layout
        await loadSVGs();

        // Check for an existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            state.currentUser = session.user;
            // If logged in, show the main app container
            if (authContainer) authContainer.classList.add('hidden');
            if (userGuideContainer) userGuideContainer.classList.remove('hidden');
            // Setup user menu (logout, theme toggle)
            await setupUserMenuAndAuth(supabase, state);
            
            // Render the initial blank canvas
            renderBlankCanvas();

        } else {
            // If not logged in, show the auth container
            if (authContainer) authContainer.classList.remove('hidden');
            if (userGuideContainer) userGuideContainer.classList.add('hidden');
        }

        // Listen for authentication state changes (login/logout)
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                state.currentUser = session.user;
                if (authContainer) authContainer.classList.add('hidden');
                if (userGuideContainer) userGuideContainer.classList.remove('hidden');
                await setupUserMenuAndAuth(supabase, state);
                
                // Render the blank canvas on login
                renderBlankCanvas();
            } else {
                state.currentUser = null;
                if (authContainer) authContainer.classList.remove('hidden');
                if (userGuideContainer) userGuideContainer.classList.add('hidden');
            }
        });
    }

    /**
     * Renders a placeholder message in the main content area.
     * This creates the "blank canvas" for us to build on.
     */
    function renderBlankCanvas() {
        if (userGuideContent) {
            userGuideContent.innerHTML = `
                <div class="placeholder-text" style="text-align: center; padding-top: 50px;">
                    <h2>Welcome to the User Guide</h2>
                    <p>Content will be loaded here.</p>
                </div>
            `;
        }
    }

    // Start the page initialization process
    initializePage();
});
