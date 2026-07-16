import { 
    SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, 
    loadSVGs, updateActiveNavLink, initializeAppState, 
    setupModalListeners, setupGlobalSearch, checkAndSetNotifications,
    injectGlobalNavigation, hideGlobalLoader
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = { 
        currentUser: null 
    };

    const refreshMemoryBtn = document.getElementById("refresh-memory-btn");
    const dynamicPromptPreview = document.getElementById("dynamic-prompt-preview");
    const memoryTotalCount = document.getElementById("memory-total-count");
    const memoryRatedCount = document.getElementById("memory-rated-count");
    const memoryPendingCount = document.getElementById("memory-pending-count");
    const memoryLatestUpdate = document.getElementById("memory-latest-update");

    function showToast(message, type = 'success') {
        const existingToast = document.querySelector('.constellation-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = `constellation-toast toast-${type}`;
        const icon = document.createElement('i');
        icon.className = `fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`;
        icon.setAttribute('aria-hidden', 'true');
        const span = document.createElement('span');
        span.className = 'toast-message';
        span.textContent = String(message ?? '');
        toast.appendChild(icon);
        toast.appendChild(span);
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    async function loadMemoryOverview() {
        if (!state.currentUser) return;

        const [
            { data: profile, error: profileError },
            { count: totalCount, error: totalError },
            { count: ratedCount, error: ratedError },
            { count: pendingCount, error: pendingError },
            { data: latestRows, error: latestError }
        ] = await Promise.all([
            supabase
                .from('user_ai_profiles')
                .select('dynamic_prompt, updated_at')
                .eq('user_id', state.currentUser.id)
                .maybeSingle(),
            supabase
                .from('personal_context')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', state.currentUser.id),
            supabase
                .from('personal_context')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', state.currentUser.id)
                .not('rating', 'is', null),
            supabase
                .from('personal_context')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', state.currentUser.id)
                .eq('processed', false),
            supabase
                .from('personal_context')
                .select('updated_at')
                .eq('user_id', state.currentUser.id)
                .order('updated_at', { ascending: false })
                .limit(1)
        ]);

        const errors = [profileError, totalError, ratedError, pendingError, latestError].filter(Boolean);
        if (errors.length) {
            console.error('AI memory overview load failed:', errors);
            showToast('Unable to load AI memory overview.', 'error');
            return;
        }

        if (dynamicPromptPreview) dynamicPromptPreview.value = profile?.dynamic_prompt || '';
        if (memoryTotalCount) memoryTotalCount.textContent = String(totalCount || 0);
        if (memoryRatedCount) memoryRatedCount.textContent = String(ratedCount || 0);
        if (memoryPendingCount) memoryPendingCount.textContent = String(pendingCount || 0);

        const profileUpdated = profile?.updated_at ? `Profile updated ${formatDateTime(profile.updated_at)}.` : 'No synthesized profile yet.';
        const latestFeedback = latestRows?.[0]?.updated_at ? `Latest feedback ${formatDateTime(latestRows[0].updated_at)}.` : 'No feedback captured yet.';
        if (memoryLatestUpdate) memoryLatestUpdate.textContent = `${profileUpdated} ${latestFeedback}`;
    }

    function formatDateTime(value) {
        try {
            return new Date(value).toLocaleString();
        } catch {
            return String(value || '');
        }
    }

    async function initializePage() {
        injectGlobalNavigation();
        await loadSVGs();
        const globalState = await initializeAppState(supabase); 
        
        if (globalState.currentUser) {
            state.currentUser = globalState.currentUser;
            await setupUserMenuAndAuth(supabase, globalState); 
            await setupGlobalSearch(supabase);
            await checkAndSetNotifications(supabase);
            updateActiveNavLink();
            setupModalListeners();
            await loadMemoryOverview();
            hideGlobalLoader();

            refreshMemoryBtn?.addEventListener('click', async () => {
                refreshMemoryBtn.disabled = true;
                refreshMemoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Refreshing</span>';
                try {
                    await loadMemoryOverview();
                    showToast('AI memory overview refreshed.');
                } finally {
                    refreshMemoryBtn.disabled = false;
                    refreshMemoryBtn.innerHTML = '<i class="fas fa-rotate"></i><span>Refresh</span>';
                }
            });
        } else {
            hideGlobalLoader();
            window.location.href = "index.html";
        }
    }

    initializePage();
});
