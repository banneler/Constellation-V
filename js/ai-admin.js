import { 
    SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, 
    loadSVGs, updateActiveNavLink, initializeAppState, 
    showModal, hideModal, setupModalListeners, setupGlobalSearch 
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const ENGINES = [
        { 
            id: 'get-daily-briefing', 
            name: 'Command Center Briefing',
            demoPersona: "You are a seasoned Sales VP looking at a busy dashboard.",
            demoVoice: "Encouraging, high-energy, and Nebraska-friendly.",
            demoInstructions: "Start with a 'Howdy, Partner!' greeting. Use bullet points for the top 5 priorities.",
            technicalPrompt: "Process the provided JSON payload (tasks, deals, alerts). Rank by strategic priority. Output a JSON array with 'title' and 'reason'."
        },
        { 
            id: 'get-account-briefing', 
            name: 'Account Recon (IRR)',
            demoPersona: "You are a detail-oriented analyst specializing in the Nebraska Enterprise market.",
            demoVoice: "Data-driven, objective, and consultative.",
            demoInstructions: "Look for trends in the $35M revenue/75 employee SMG thresholds. Identify cross-sell opportunities.",
            technicalPrompt: "Analyze account firmographics, org hierarchy, and activity logs. Summarize health and gaps."
        },
        { 
            id: 'get-gemini-suggestion', 
            name: 'Cognito: Initial Outreach',
            demoPersona: "You are an expert telecommunications sales executive for GPC.",
            demoVoice: "Professional, concise, and non-robotic.",
            demoInstructions: "Reference the specific news alert naturally. Ensure the tone is peer-to-peer, not salesperson-to-prospect.",
            technicalPrompt: "Draft a concise outreach email based on news alerts. replace [FirstName] and ignore signatures."
        }
    ];

    let state = { selectedEngineId: null, configs: [] };

    // Selectors
    const listBody = document.getElementById("ai-engine-list-body");
    const editorForm = document.getElementById("ai-editor-form");
    const placeholder = document.getElementById("no-selection-msg");
    const saveBtn = document.getElementById("save-config-btn");

    async function loadConfigs() {
        const { data, error } = await supabase.from('ai_configs').select('*');
        if (error) return console.error("Error loading configs:", error);
        state.configs = data || [];
        renderList();
    }

    function renderList() {
        listBody.innerHTML = ENGINES.map(e => `
            <tr class="list-item ${state.selectedEngineId === e.id ? 'selected' : ''}" data-id="${e.id}">
                <td style="padding: 15px; cursor: pointer;">${e.name}</td>
            </tr>
        `).join('');
    }

    function selectEngine(id) {
        state.selectedEngineId = id;
        const engine = ENGINES.find(e => e.id === id);
        const config = state.configs.find(c => c.function_id === id) || {};

        renderList();
        placeholder.classList.add('hidden');
        editorForm.classList.remove('hidden');
        saveBtn.classList.remove('hidden');

        // Set Headings & Read-Only Technical Prompt
        document.getElementById('selected-engine-name').textContent = engine.name;
        document.getElementById('ai-technical-foundation').value = engine.technicalPrompt;

        // Set Values
        const personaField = document.getElementById('ai-persona');
        const voiceField = document.getElementById('ai-voice');
        const instructionsField = document.getElementById('ai-custom-instructions');

        personaField.value = config.persona || '';
        voiceField.value = config.voice || '';
        instructionsField.value = config.custom_instructions || '';

        // Apply Demo Text as Placeholders
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
            updateActiveNavLink();
            setupModalListeners();
            await loadConfigs();
            
            listBody.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                if (row) selectEngine(row.dataset.id);
            });

            saveBtn.addEventListener('click', async () => {
                const data = {
                    function_id: state.selectedEngineId,
                    persona: personaField.value,
                    voice: voiceField.value,
                    custom_instructions: instructionsField.value,
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
