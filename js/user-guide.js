// js/user-guide.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    setupUserMenuAndAuth,
    loadSVGs,
    updateActiveNavLink
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
        await loadSVGs();
        updateActiveNavLink(); // This won't highlight anything, which is correct for a guide page

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const state = { currentUser: session.user };
            await setupUserMenuAndAuth(supabase, state);
            setupGuideNav();
        } else {
            // If no session, redirect to login
            window.location.href = "index.html";
        }
    }

    initializePage();
});
