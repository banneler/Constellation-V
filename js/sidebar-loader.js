// js/sidebar-loader.js
import { updateActiveNavLink, setupUserMenuAndAuth } from './shared_constants.js';

/**
 * Loads the sidebar HTML dynamically and attaches its event listeners.
 * @param {object} supabase - The Supabase client instance.
 * @param {object} state - The application state object containing currentUser.
 */
export async function loadSidebar(supabase, state) {
    const sidebarElement = document.querySelector('nav.nav-sidebar'); // Target the existing <nav class="nav-sidebar"> element

    if (!sidebarElement) {
        console.error('Error: Main nav sidebar element (nav.nav-sidebar) not found in the HTML. Cannot load sidebar content.');
        return;
    }

    try {
        const response = await fetch('sidebar.html');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const sidebarHtmlContent = await response.text();
        
        // Inject the fetched HTML content (which is the *children* of the <nav> tag)
        sidebarElement.innerHTML = sidebarHtmlContent;

        // Re-attach listeners and setup
        // setupUserMenuAndAuth handles theme toggle, logout, and user name display
        await setupUserMenuAndAuth(supabase, state); 
        updateActiveNavLink(); // Ensure active nav link is set AFTER everything is loaded and listeners are attached

    } catch (error) {
        console.error("Failed to load sidebar.html or inject content:", error);
    }
}
