import { 
    SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, 
    loadSVGs, updateActiveNavLink, initializeAppState, 
    showModal, hideModal, setupModalListeners, setupGlobalSearch, checkAndSetNotifications 
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const ENGINES = [
        { id: 'get-daily-briefing', name: 'Command Center Briefing', demoPersona: "Seasoned Sales VP", demoVoice: "Encouraging, high-energy", demoInstructions: "Greeting: 'Howdy, Partner!'", technicalPrompt: "Rank items by strategic priority. Output JSON array." },
        { id: 'get-account-briefing', name: 'Account Recon (IRR)', demoPersona: "Enterprise Analyst", demoVoice: "Consultative", demoInstructions: "Focus on revenue thresholds.", technicalPrompt: "Summarize firmographics and pipeline health." },
        { id: 'get-gemini-suggestion', name: 'Cognito: Outreach', demoPersona: "Expert Sales Exec", demoVoice: "Professional, non-robotic", demoInstructions: "Peer-to-peer tone.", technicalPrompt: "Draft outreach email based on alert headline." },
        { id: 'generate-custom-suggestion', name: 'Cognito: Refiner', demoPersona: "Persuasive Coach", demoVoice: "Direct", demoInstructions: "Follow user instruction exactly.", technicalPrompt: "Refine draft based on user prompt." },
        { id: 'generate-social-post', name: 'Social Hub: Article', demoPersona: "Tech Influencer", demoVoice: "Engaging", demoInstructions: "End with a question.", technicalPrompt: "Extract takeaways and draft LinkedIn post." },
        { id: 'custom-user-social-post', name: 'Social Hub: Product', demoPersona: "Product Specialist", demoVoice: "Authoritative", demoInstructions: "Highlight local reliability.", technicalPrompt: "Combine topic with product data." },
        { id: 'refine-social-post', name: 'Social Hub: Refiner', demoPersona: "Editor-in-Chief", demoVoice: "Polished", demoInstructions: "Simplify language.", technicalPrompt: "Refine draft based on feedback." },
        { id: 'generate-prospect-email', name: 'Contacts: AI Email', demoPersona: "Strategic Lead", demoVoice: "Respectful", demoInstructions: "Keep under 3 paragraphs.", technicalPrompt: "Draft email using product selections." },
        { id: 'get-activity-insight', name: 'Contacts: Insights', demoPersona: "Sales Strategist", demoVoice: "Action-oriented", demoInstructions: "Flag 30-day gaps.", technicalPrompt: "Summarize activities and suggest next steps." },
        { id: 'generate-sequence-steps', name: 'Sequences: Builder', demoPersona: "SDR Manager", demoVoice: "Persistent", demoInstructions: "Vary touchpoints.", technicalPrompt: "Generate multi-channel sequence JSON." }
    ];

    let state = { selectedEngineId: null, configs: [] };

    const tabContainer = document.getElementById("ai-engine-tabs");
    const editorForm = document.getElementById("ai-editor-form");
    const placeholder = document.getElementById("no-selection-msg");
    const saveBtn = document.getElementById("save-config-btn");

    async function loadConfigs() {
        const { data, error } = await supabase.from('ai_configs').select('*');
        if (error) return console.error("Error loading AI configs:", error);
        state.configs = data || [];
        renderTabs();
    }

    function renderTabs() {
        tabContainer.innerHTML = ENGINES.map(e => {
            const isSelected = state.selectedEngineId === e.id;
            return `
                <button class="irr-tab ${isSelected ? 'active' : ''}" data-id="${e.id}">
                    ${e.name}
                </button>
            `;
        }).join('');
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
        instructionsField.placeholder = `Demo: ${engine.demoInstructions}`;
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
                } else {
                    showModal("Error", "Could not save updates: " + error.message, null, false, `<button class="btn-primary" onclick="hideModal()">OK</button>`);
                }
            });
        }
    }

    initializePage();
});
