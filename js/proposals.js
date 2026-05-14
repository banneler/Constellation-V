// proposals.js – nav + SVG bootstrap only; Enterprise logic in enterprise-proposals-embed.js

import {
    injectGlobalNavigation,
    loadSVGs,
    hideGlobalLoader,
    showModal,
    hideModal,
    setupModalListeners,
    getState,
    initializeAppState,
    setupUserMenuAndAuth,
    SUPABASE_URL,
    SUPABASE_ANON_KEY
} from './shared_constants.js';

document.addEventListener('DOMContentLoaded', async () => {
    injectGlobalNavigation();
    await loadSVGs();
    // Expose modal and Supabase for enterprise-proposals-embed.js (save to account)
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await initializeAppState(supabase);
    await setupUserMenuAndAuth(supabase, getState());
    window.showModal = showModal;
    window.hideModal = hideModal;
    window.getState = getState;
    window.proposalsSupabase = supabase;
    if (document.getElementById('modal-backdrop')) setupModalListeners();
    if (typeof window.tryLoadProposalFromUrl === 'function') window.tryLoadProposalFromUrl();
    // Proposals page has no data load; keep loader visible for 1.5s for consistent UX
    setTimeout(hideGlobalLoader, 1500);
});
