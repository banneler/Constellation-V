// js/user-guide.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    loadSVGs,
    setupTheme // We only need setupTheme, not the full user menu
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- APP INITIALIZATION ---
    async function initializePage() {
        await loadSVGs(); // This will now correctly find the logo placeholder

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            // Since there's no user menu on this page, we just need to load the theme.
            // We pass a mock user object to setupTheme.
            await setupTheme(supabase, session.user);
        } else {
            // If no session, redirect to login
            window.location.href = "index.html";
        }
    }

    initializePage();
});
