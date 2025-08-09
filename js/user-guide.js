// js/user-guide.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    loadSVGs,
    setupTheme 
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- SMOOTH SCROLL FOR GUIDE NAVIGATION ---
    function setupGuideNav() {
        const navLinks = document.querySelectorAll('.guide-nav a');
        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    // --- APP INITIALIZATION ---
    async function initializePage() {
        await loadSVGs(); // This will now find and load the logo correctly

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            // We don't need the full user menu, just the theme
            await setupTheme(supabase, session.user);
            setupGuideNav(); // Activate smooth scrolling
        } else {
            window.location.href = "index.html";
        }
    }

    initializePage();
});
