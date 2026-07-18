import { 
    SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, 
    loadSVGs, updateActiveNavLink, initializeAppState, 
    setupModalListeners, setupGlobalSearch, checkAndSetNotifications,
    injectGlobalNavigation, hideGlobalLoader
} from './shared_constants.js';
import { AI_FUNCTION_IDS } from './ai-memory.js';

const AI_FUNCTION_LABELS = {
    [AI_FUNCTION_IDS.COGNITO_OUTREACH]: 'Cognito Outreach',
    [AI_FUNCTION_IDS.CONTACTS_EMAIL]: 'Contacts Email Drafts',
    [AI_FUNCTION_IDS.CONTACTS_ACTIVITY_INSIGHT]: 'Contacts Activity Insights',
    [AI_FUNCTION_IDS.SOCIAL_POST]: 'Social Posts',
    [AI_FUNCTION_IDS.SOCIAL_POST_REFINE]: 'Social Post Refinement',
    [AI_FUNCTION_IDS.SEQUENCE_GENERATION]: 'Sequence Generation',
    [AI_FUNCTION_IDS.ACCOUNT_BRIEFING]: 'Account Briefings',
    [AI_FUNCTION_IDS.DAILY_BRIEFING]: 'Daily Briefings',
    [AI_FUNCTION_IDS.AGENDA_GENERATION]: 'Agenda Generation',
    [AI_FUNCTION_IDS.PRESENTATION_HIGHLIGHT]: 'Presentation Highlights',
    'legacy-general': 'Legacy / Unscoped Feedback',
    global: 'Global Guidance'
};

const DEFAULT_FUNCTION_ORDER = [
    AI_FUNCTION_IDS.CONTACTS_EMAIL,
    AI_FUNCTION_IDS.COGNITO_OUTREACH,
    AI_FUNCTION_IDS.SEQUENCE_GENERATION,
    AI_FUNCTION_IDS.SOCIAL_POST,
    AI_FUNCTION_IDS.SOCIAL_POST_REFINE,
    AI_FUNCTION_IDS.CONTACTS_ACTIVITY_INSIGHT,
    AI_FUNCTION_IDS.ACCOUNT_BRIEFING,
    AI_FUNCTION_IDS.DAILY_BRIEFING,
    AI_FUNCTION_IDS.AGENDA_GENERATION,
    AI_FUNCTION_IDS.PRESENTATION_HIGHLIGHT,
    'legacy-general',
    'global'
];

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
    const memoryFunctionSelect = document.getElementById("memory-function-select");
    const memoryScopeSummary = document.getElementById("memory-scope-summary");

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

    function formatFunctionLabel(functionId) {
        return AI_FUNCTION_LABELS[functionId] || String(functionId || 'Unknown Function')
            .split('-')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    function emptyStats(functionId) {
        return {
            functionId,
            totalCount: 0,
            ratedCount: 0,
            pendingCount: 0,
            latestFeedbackAt: null,
            profileUpdatedAt: null,
            dynamicPrompt: ''
        };
    }

    function buildScopedMemory(feedbackRows = [], profileRows = []) {
        const memory = new Map();
        const ensure = (functionId) => {
            const id = String(functionId || 'legacy-general').trim() || 'legacy-general';
            if (!memory.has(id)) memory.set(id, emptyStats(id));
            return memory.get(id);
        };

        DEFAULT_FUNCTION_ORDER.forEach(ensure);

        for (const row of feedbackRows || []) {
            const stats = ensure(row.function_id);
            stats.totalCount += 1;
            if (row.rating != null) stats.ratedCount += 1;
            if (row.processed === false) stats.pendingCount += 1;
            if (row.updated_at && (!stats.latestFeedbackAt || new Date(row.updated_at) > new Date(stats.latestFeedbackAt))) {
                stats.latestFeedbackAt = row.updated_at;
            }
        }

        for (const row of profileRows || []) {
            const stats = ensure(row.function_id);
            stats.dynamicPrompt = row.dynamic_prompt || '';
            stats.profileUpdatedAt = row.updated_at || null;
        }

        return memory;
    }

    function populateFunctionSelect(memory) {
        if (!memoryFunctionSelect) return;
        const currentValue = memoryFunctionSelect.value;
        const functionIds = Array.from(memory.keys()).sort((a, b) => {
            const ai = DEFAULT_FUNCTION_ORDER.indexOf(a);
            const bi = DEFAULT_FUNCTION_ORDER.indexOf(b);
            if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
            return formatFunctionLabel(a).localeCompare(formatFunctionLabel(b));
        });

        memoryFunctionSelect.innerHTML = functionIds.map((functionId) => {
            const stats = memory.get(functionId) || emptyStats(functionId);
            const suffix = stats.totalCount > 0 || stats.dynamicPrompt ? ` (${stats.totalCount})` : '';
            return `<option value="${escapeHtml(functionId)}">${escapeHtml(formatFunctionLabel(functionId) + suffix)}</option>`;
        }).join('');

        if (currentValue && memory.has(currentValue)) {
            memoryFunctionSelect.value = currentValue;
        } else {
            const firstWithData = functionIds.find((id) => {
                const stats = memory.get(id);
                return stats && (stats.totalCount > 0 || stats.dynamicPrompt);
            });
            memoryFunctionSelect.value = firstWithData || AI_FUNCTION_IDS.CONTACTS_EMAIL;
        }
    }

    function renderSelectedFunction(memory) {
        const functionId = memoryFunctionSelect?.value || AI_FUNCTION_IDS.CONTACTS_EMAIL;
        const stats = memory.get(functionId) || emptyStats(functionId);

        if (dynamicPromptPreview) dynamicPromptPreview.value = stats.dynamicPrompt || '';
        if (memoryTotalCount) memoryTotalCount.textContent = String(stats.totalCount || 0);
        if (memoryRatedCount) memoryRatedCount.textContent = String(stats.ratedCount || 0);
        if (memoryPendingCount) memoryPendingCount.textContent = String(stats.pendingCount || 0);

        const profileUpdated = stats.profileUpdatedAt ? `Profile updated ${formatDateTime(stats.profileUpdatedAt)}.` : 'No synthesized profile for this function yet.';
        const latestFeedback = stats.latestFeedbackAt ? `Latest feedback ${formatDateTime(stats.latestFeedbackAt)}.` : 'No feedback captured for this function yet.';
        if (memoryLatestUpdate) memoryLatestUpdate.textContent = `${profileUpdated} ${latestFeedback}`;
        if (memoryScopeSummary) {
            memoryScopeSummary.textContent = `${formatFunctionLabel(functionId)} has ${stats.totalCount || 0} captured response${stats.totalCount === 1 ? '' : 's'} and ${stats.pendingCount || 0} pending synthesis row${stats.pendingCount === 1 ? '' : 's'}.`;
        }
    }

    async function loadMemoryOverview() {
        if (!state.currentUser) return;

        const [
            { data: profiles, error: profileError },
            { data: feedbackRows, error: feedbackError }
        ] = await Promise.all([
            supabase
                .from('user_ai_profiles')
                .select('function_id, dynamic_prompt, updated_at')
                .eq('user_id', state.currentUser.id),
            supabase
                .from('personal_context')
                .select('function_id, rating, processed, updated_at')
                .eq('user_id', state.currentUser.id)
                .order('updated_at', { ascending: false })
        ]);

        const errors = [profileError, feedbackError].filter(Boolean);
        if (errors.length) {
            console.error('AI memory overview load failed:', errors);
            showToast('Unable to load AI memory overview.', 'error');
            return;
        }

        state.scopedMemory = buildScopedMemory(feedbackRows || [], profiles || []);
        populateFunctionSelect(state.scopedMemory);
        renderSelectedFunction(state.scopedMemory);
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
            memoryFunctionSelect?.addEventListener('change', () => {
                renderSelectedFunction(state.scopedMemory || new Map());
            });
            hideGlobalLoader();
            loadMemoryOverview().catch((error) => {
                console.error('AI memory overview load failed:', error);
                showToast('Unable to load AI memory overview.', 'error');
            });

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

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
