import { 
    SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, 
    loadSVGs, updateActiveNavLink, initializeAppState, 
    showModal, hideModal, setupModalListeners, setupGlobalSearch, checkAndSetNotifications 
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const ENGINES = [
        { id: 'get-daily-briefing', name: 'Command Center', demoPersona: "Sales VP", demoVoice: "Encouraging", technicalPrompt: "Process JSON and output top 5 priorities." },
        { id: 'get-account-briefing', name: 'Account Recon', demoPersona: "Analyst", demoVoice: "Consultative", technicalPrompt: "Summarize firmographics and health." },
        { id: 'get-gemini-suggestion', name: 'Cognito Suggestion', demoPersona: "Sales Exec", demoVoice: "Professional", technicalPrompt: "Draft outreach email for [FirstName]." },
        { id: 'generate-custom-suggestion', name: 'Cognito Refiner', demoPersona: "Coach", demoVoice: "Direct", technicalPrompt: "Modify draft based on user feedback." },
        { id: 'generate-social-post', name: 'Social Article', demoPersona: "Influencer", demoVoice: "Engaging", technicalPrompt: "Draft LinkedIn post from article." },
        { id: 'custom-user-social-post', name: 'Product Post', demoPersona: "Marketer", demoVoice: "Authoritative", technicalPrompt: "Draft post using product knowledge data." },
        { id: 'refine-social-post', name: 'Post Refiner', demoPersona: "Editor", demoVoice: "Polished", technicalPrompt: "Update post based on specific prompts." },
        { id: 'generate-prospect-email', name: 'Contact Email', demoPersona: "Manager", demoVoice: "Respectful", technicalPrompt: "Draft email using product selections." },
        { id: 'get-activity-insight', name: 'Activity Insights', demoPersona: "Strategist", demoVoice: "Action-oriented", technicalPrompt: "Suggest next steps from logs." },
        { id: 'generate-sequence-steps', name: 'Sequence Builder', demoPersona: "SDR Lead", demoVoice: "Persistent", technicalPrompt: "Generate multi-channel sequence JSON." }
    ];

    let state = { selectedEngineId: null, configs: [] };

    const tabContainer = document.getElementById("ai-engine-tabs");
    const editorForm = document.getElementById("ai-editor-form");
    const placeholder = document.getElementById("no-selection-msg");
    const saveBtn = document.getElementById("save-config-btn");

    async function loadConfigs() {
        const { data, error } = await supabase.from('ai_configs').select('*');
        if (error) return console.error("Error loading configs:", error);
        state.configs = data || [];
        renderTabs();
    }

    function renderTabs() {
        tabContainer.innerHTML = ENGINES.map(e => `
            <button class="irr-tab ${state.selectedEngineId === e.id ? 'active' : ''}" data-id="${e.id}">
                ${e.name}
            </button>
        `).join('');
    }

    function selectEngine(id) {
        state.selectedEngineId = id;
        const engine = ENGINES.find(e => e.id === id);
        const config = state.configs.find(c => c.function_id === id) || {};

        renderTabs();
        placeholder.classList.add('hidden');
        editorForm.classList.remove('hidden');
        saveBtn.classList.remove('hidden');

        document.getElementById('selected-engine-name').textContent = engine.name;
        document.getElementById('ai-technical-foundation').value = engine.technicalPrompt;

        const personaField = document.getElementById('ai-persona');
        const voiceField = document.getElementById('ai-voice');
        const instructionsField = document.getElementById('ai-custom-instructions');

        personaField.value = config.persona || '';
        voiceField.value = config.voice || '';
        instructionsField.value = config.custom_instructions || '';

        personaField.placeholder = `Demo: ${engine.demoPersona}`;
        voiceField.placeholder = `Demo: ${engine.demoVoice}`;
    }

    async function initializePage() {
        await loadSVGs();
        const globalState = await initializeAppState(supabase); 
        
        if (globalState.currentUser) {
            await setupUserMenuAndAuth(supabase, globalState); 
            await setupGlobalSearch(supabase);
            await checkAndSetNotifications(supabase);
            updateActiveNavLink();
            setupModalListeners();
            await loadConfigs();

            tabContainer.addEventListener('click', (e) => {
                const tab = e.target.closest('.irr-tab');
                if (tab) selectEngine(tab.dataset.id);
            });

            saveBtn.addEventListener('click', async () => {
                const data = {
                    function_id: state.selectedEngineId,
                    persona: document.getElementById('ai-persona').value,
                    voice: document.getElementById('ai-voice').value,
                    custom_instructions: document.getElementById('ai-custom-instructions').value,
                    updated_at: new Date().toISOString()
                };

                const { error } = await supabase.from('ai_configs').upsert(data, { onConflict: 'function_id' });
                if (!error) {
                    showModal("Success", "AI Voice Layer updated.", null, false, `<button class="btn-primary" onclick="hideModal()">OK</button>`);
                    await loadConfigs();
                }
            });
        }
    }

    initializePage();
});
