import { 
    SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, 
    loadSVGs, updateActiveNavLink, initializeAppState, 
    setupModalListeners, setupGlobalSearch, checkAndSetNotifications,
    injectGlobalNavigation, hideGlobalLoader, showToast
} from './shared_constants.js';
import { AI_FUNCTION_IDS } from './ai-memory.js';
import {
    clearIntegrationStateCache,
    disconnectIntegration,
    getIntegrationState,
    handleIntegrationsQueryToast,
    startConnect,
} from './integrations.js';

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

const SETTINGS_RETURN_TO = '/ai-admin.html?tab=integrations';

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
    const settingsTabs = document.getElementById("user-settings-tabs");
    const tabIntegrationsBtn = document.getElementById("tab-integrations");
    const integrationsStatusText = document.getElementById("integrations-status-text");
    const integrationsActions = document.getElementById("integrations-actions");
    const emailSignatureInput = document.getElementById("email-signature-input");
    const saveSignatureBtn = document.getElementById("save-signature-btn");
    let orgIntegrationsEnabled = false;

    function setActiveTab(tabId) {
        const requested = tabId === 'ai-admin' ? 'ai-admin' : 'integrations';
        const next = !orgIntegrationsEnabled || requested === 'ai-admin' ? 'ai-admin' : 'integrations';
        settingsTabs?.querySelectorAll('[data-settings-tab]').forEach((btn) => {
            const active = btn.dataset.settingsTab === next;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        document.getElementById('settings-tab-integrations')?.toggleAttribute('hidden', next !== 'integrations');
        document.getElementById('settings-tab-ai-admin')?.toggleAttribute('hidden', next !== 'ai-admin');

        const url = new URL(window.location.href);
        if (next === 'integrations') url.searchParams.delete('tab');
        else url.searchParams.set('tab', next);
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    function applyIntegrationsTabVisibility() {
        if (tabIntegrationsBtn) tabIntegrationsBtn.hidden = !orgIntegrationsEnabled;
        if (settingsTabs) {
            // Single section when org integrations are off — no tab chrome needed.
            settingsTabs.hidden = !orgIntegrationsEnabled;
        }
        if (!orgIntegrationsEnabled) {
            document.getElementById('settings-tab-integrations')?.setAttribute('hidden', '');
        }
    }

    async function initTabs() {
        try {
            const integrationState = await getIntegrationState(supabase);
            orgIntegrationsEnabled = Boolean(integrationState?.orgEnabled);
        } catch (error) {
            console.warn('Could not load integration state for settings tabs:', error);
            orgIntegrationsEnabled = false;
        }

        applyIntegrationsTabVisibility();

        const params = new URLSearchParams(window.location.search);
        const requested = params.get('tab');
        if (!orgIntegrationsEnabled) {
            setActiveTab('ai-admin');
        } else {
            setActiveTab(requested === 'ai-admin' ? 'ai-admin' : 'integrations');
        }

        settingsTabs?.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-settings-tab]');
            if (!btn) return;
            if (!orgIntegrationsEnabled && btn.dataset.settingsTab === 'integrations') return;
            setActiveTab(btn.dataset.settingsTab);
        });
    }

    async function renderIntegrationsPanel() {
        if (!integrationsStatusText || !integrationsActions) return;

        let integrationState;
        try {
            integrationState = await getIntegrationState(supabase, { force: true });
        } catch (error) {
            console.error('Integrations state load failed:', error);
            integrationsStatusText.textContent = 'Unable to load integration status.';
            integrationsActions.innerHTML = '';
            return;
        }

        if (!integrationState.orgEnabled) {
            integrationsStatusText.textContent =
                'Email & calendar integrations are turned off for this organization. Ask an admin to enable them under Admin → System Settings.';
            integrationsActions.innerHTML = '';
            return;
        }

        const providerLabel =
            integrationState.provider === 'microsoft'
                ? 'Outlook'
                : integrationState.provider === 'google'
                    ? 'Google'
                    : '';
        integrationsStatusText.textContent = integrationState.connected
            ? `Connected${providerLabel ? ` via ${providerLabel}` : ''}${integrationState.email ? ` · ${integrationState.email}` : ''}`
            : 'Not connected — choose a provider to authorize Constellation.';

        if (integrationState.connected) {
            integrationsActions.innerHTML = `
                <button type="button" class="btn-danger" id="settings-integrations-disconnect-btn">
                    <i class="fas fa-link-slash" aria-hidden="true"></i>
                    <span>Disconnect</span>
                </button>
            `;
            integrationsActions.querySelector('#settings-integrations-disconnect-btn')?.addEventListener('click', async () => {
                if (!confirm('Disconnect your email & calendar account?')) return;
                try {
                    await disconnectIntegration(supabase);
                    clearIntegrationStateCache();
                    showToast('Disconnected email & calendar.', 'success');
                    await renderIntegrationsPanel();
                } catch (error) {
                    showToast(error.message || 'Could not disconnect.', 'error');
                }
            });
            return;
        }

        integrationsActions.innerHTML = `
            <button type="button" class="btn-primary" id="settings-connect-google-btn">
                <i class="fa-brands fa-google" aria-hidden="true"></i>
                <span>Connect Google</span>
            </button>
            <button type="button" class="btn-secondary" id="settings-connect-outlook-btn">
                <i class="fa-brands fa-microsoft" aria-hidden="true"></i>
                <span>Connect Outlook</span>
            </button>
        `;
        integrationsActions.querySelector('#settings-connect-google-btn')?.addEventListener('click', async () => {
            try {
                await startConnect(supabase, 'google', SETTINGS_RETURN_TO);
            } catch (error) {
                showToast(error.message || 'Could not start Google connection.', 'error');
            }
        });
        integrationsActions.querySelector('#settings-connect-outlook-btn')?.addEventListener('click', async () => {
            try {
                await startConnect(supabase, 'microsoft', SETTINGS_RETURN_TO);
            } catch (error) {
                showToast(error.message || 'Could not start Outlook connection.', 'error');
            }
        });
    }

    async function loadEmailSignature() {
        if (!state.currentUser || !emailSignatureInput) return;
        const { data, error } = await supabase
            .from('user_settings')
            .select('email_signature')
            .eq('user_id', state.currentUser.id)
            .maybeSingle();
        if (error) {
            console.error('Email signature load failed:', error);
            showToast('Unable to load email signature.', 'error');
            return;
        }
        emailSignatureInput.value = data?.email_signature || '';
    }

    async function saveEmailSignature() {
        if (!state.currentUser || !emailSignatureInput) return;
        const signature = emailSignatureInput.value ?? '';
        saveSignatureBtn.disabled = true;
        try {
            const { error } = await supabase
                .from('user_settings')
                .upsert(
                    {
                        user_id: state.currentUser.id,
                        email_signature: signature,
                    },
                    { onConflict: 'user_id' }
                );
            if (error) throw error;
            showToast('Email signature saved.', 'success');
        } catch (error) {
            console.error('Email signature save failed:', error);
            showToast(error.message || 'Could not save signature.', 'error');
        } finally {
            saveSignatureBtn.disabled = false;
        }
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
            await initTabs();
            handleIntegrationsQueryToast(showToast);

            memoryFunctionSelect?.addEventListener('change', () => {
                renderSelectedFunction(state.scopedMemory || new Map());
            });
            if (orgIntegrationsEnabled) {
                saveSignatureBtn?.addEventListener('click', () => {
                    saveEmailSignature().catch((error) => {
                        console.error(error);
                        showToast('Could not save signature.', 'error');
                    });
                });
            }

            hideGlobalLoader();

            if (orgIntegrationsEnabled) {
                await Promise.all([
                    renderIntegrationsPanel(),
                    loadEmailSignature(),
                ]);
            }

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
