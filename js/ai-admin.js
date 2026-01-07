import { 
    SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, 
    loadSVGs, updateActiveNavLink, initializeAppState, getState, 
    showModal, hideModal, setupModalListeners, setupGlobalSearch 
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Engine IDs that match your Edge Function invocations
    const ENGINES = [
        { id: 'get-daily-briefing', name: 'Command Center Briefing' },
        { id: 'get-account-briefing', name: 'Account Recon (IRR)' },
        { id: 'get-gemini-suggestion', name: 'Cognito: Initial Outreach' },
        { id: 'generate-social-post', name: 'Social Hub: Article Drafter' },
        { id: 'custom-user-social-post', name: 'Social Hub: Product Post' }
    ];

    let state = { selectedEngineId: null, configs: [] };
    let globalState = {};

    const listBody = document.getElementById("ai-engine-list-body");
    const editorForm = document.getElementById("ai-editor-form");
    const placeholder = document.getElementById("no-selection-msg");
    const saveBtn = document.getElementById("save-config-btn");

    async function loadConfigs() {
        const { data, error } = await supabase.from('ai_configs').select('*');
        if (error) { 
            console.error("Error loading configs:", error); 
            // If the table doesn't exist, we should inform the user
            if (error.code === '42P01') {
                showModal("Table Missing", "The 'ai_configs' table has not been created in Supabase yet.");
            }
            return; 
        }
        state.configs = data || [];
        renderList();
    }

    function renderList() {
        listBody.innerHTML = ENGINES.map(e => `
            <tr class="list-item ${state.selectedEngineId === e.id ? 'selected' : ''}" data-id="${e.id}">
                <td style="padding: 15px; cursor: pointer; border-bottom: 1px solid var(--border-color);">${e.name}</td>
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

        document.getElementById('selected-engine-name').textContent = engine.name;
        document.getElementById('ai-persona').value = config.persona || '';
        document.getElementById('ai-voice').value = config.voice || '';
        document.getElementById('ai-custom-instructions').value = config.custom_instructions || '';
    }

    async function initializePage() {
        await loadSVGs();
        globalState = await initializeAppState(supabase); 
        
        if (globalState.currentUser) {
            await setupUserMenuAndAuth(supabase, globalState); 
            await setupGlobalSearch(supabase);
            updateActiveNavLink();
            setupModalListeners();
            await loadConfigs();
            setupPageListeners();
        }
    }

    function setupPageListeners() {
        listBody.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row) selectEngine(row.dataset.id);
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
            
            if (error) {
                showModal("Error", "Could not save configuration: " + error.message);
            } else {
                showModal("Success", "AI Voice Layer updated successfully.", null, false, 
                    `<button class="btn-primary" onclick="hideModal()">OK</button>`);
                await loadConfigs();
            }
        });
    }

    initializePage();
});
