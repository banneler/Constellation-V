import { 
    SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, 
    loadSVGs, updateActiveNavLink, initializeAppState, 
    showModal, hideModal, setupModalListeners, setupGlobalSearch, checkAndSetNotifications 
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const ENGINES = [
        { id: 'get-daily-briefing', name: 'Daily Briefing', demoPersona: "Sales VP", demoVoice: "Nebraska-friendly", demoInstructions: "Greet with 'Howdy, Partner!'", technicalPrompt: "Rank JSON payload by priority." },
        { id: 'get-account-briefing', name: 'Account Recon', demoPersona: "Analyst", demoVoice: "Consultative", demoInstructions: "Focus on $35M revenue marks.", technicalPrompt: "Summarize firmographics/org chart." },
        { id: 'get-gemini-suggestion', name: 'Cognito Suggestion', demoPersona: "Sales Exec", demoVoice: "Concise", demoInstructions: "Reference the news alert naturally.", technicalPrompt: "Draft outreach for [FirstName]." },
        { id: 'generate-custom-suggestion', name: 'Cognito Refiner', demoPersona: "Coach", demoVoice: "Direct", demoInstructions: "Prioritize user refinement prompt.", technicalPrompt: "Modify existing subject/body." },
        { id: 'generate-social-post', name: 'Social Hub Drafter', demoPersona: "Influencer", demoVoice: "Engaging", demoInstructions: "Include 3 key takeaways.", technicalPrompt: "Summarize article into LinkedIn post." },
        { id: 'custom-user-social-post', name: 'Product Poster', demoPersona: "Product Specialist", demoVoice: "Authoritative", demoInstructions: "Highlight Managed Wi-Fi benefits.", technicalPrompt: "Draft post using product data." },
        { id: 'refine-social-post', name: 'Social Hub Refiner', demoPersona: "Editor", demoVoice: "Polished", demoInstructions: "Simplify complex language.", technicalPrompt: "Take draft + feedback to update." },
        { id: 'generate-prospect-email', name: 'Contact AI Email', demoPersona: "Account Manager", demoVoice: "Respectful", demoInstructions: "Limit to 3 paragraphs.", technicalPrompt: "Draft email based on selections." },
        { id: 'get-activity-insight', name: 'Activity Insights', demoPersona: "Strategist", demoVoice: "Action-oriented", demoInstructions: "Suggest follow-up cadences.", technicalPrompt: "Analyze log for trends/next steps." },
        { id: 'generate-sequence-steps', name: 'Sequence Builder', demoPersona: "SDR Manager", demoVoice: "Persistent", demoInstructions: "Vary Email/Call/LinkedIn.", technicalPrompt: "Generate sequence JSON structure." }
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
        // Using the exact 'irr-tab' class pattern from your IRR page
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

        const pField = document.getElementById('ai-persona');
        const vField = document.getElementById('ai-voice');
        const iField = document.getElementById('ai-custom-instructions');

        pField.value = config.persona || '';
        vField.value = config.voice || '';
        iField.value = config.custom_instructions || '';

        pField.placeholder = `Demo: ${engine.demoPersona}`;
        vField.placeholder = `Demo: ${engine.demoVoice}`;
        iField.placeholder = `Demo: ${engine.demoInstructions}`;
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
