import { 
    SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, 
    loadSVGs, updateActiveNavLink, initializeAppState, 
    showModal, hideModal, setupModalListeners, setupGlobalSearch 
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Engine Definitions with their hardcoded "Technical Foundations"
    const ENGINES = [
        { 
            id: 'get-daily-briefing', 
            name: 'Command Center Briefing',
            technicalPrompt: "Process the provided JSON payload containing tasks, deals, and Cognito alerts. Rank items by strategic priority (Revenue potential > Immediate tasks > Nurture). Output a JSON array with 'title' and 'reason' for the top 5 priorities."
        },
        { 
            id: 'get-account-briefing', 
            name: 'Account Recon (IRR)',
            technicalPrompt: "Analyze the account's firmographics, the provided org chart hierarchy, and recent activity logs. Summarize the relationship health and identify potential gaps in the current product suite compared to industry standards."
        },
        { 
            id: 'get-gemini-suggestion', 
            name: 'Cognito: Initial Outreach',
            technicalPrompt: "Take the specific news alert headline and summary. Cross-reference with the account name. Draft a concise outreach email. Note: The frontend will replace [FirstName] and signatures are handled by the mail client."
        },
        { 
            id: 'generate-social-post', 
            name: 'Social Hub: Article Drafter',
            technicalPrompt: "Review the provided article title and summary. Extract 3 key takeaways. Draft a professional LinkedIn post that encourages engagement. Do not include hashtags unless specifically instructed."
        }
    ];

    let state = { selectedEngineId: null, configs: [] };
    let globalState = {};

    // Selectors
    const listBody = document.getElementById("ai-engine-list-body");
    const editorForm = document.getElementById("ai-editor-form");
    const placeholder = document.getElementById("no-selection-msg");
    const saveBtn = document.getElementById("save-config-btn");

    async function loadConfigs() {
        const { data, error } = await supabase.from('ai_configs').select('*');
        if (error) { console.error("Error loading configs:", error); return; }
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

        // Populate User Fields
        document.getElementById('selected-engine-name').textContent = engine.name;
        document.getElementById('ai-persona').value = config.persona || '';
        document.getElementById('ai-voice').value = config.voice || '';
        document.getElementById('ai-custom-instructions').value = config.custom_instructions || '';

        // Populate READ-ONLY Technical Field
        document.getElementById('ai-technical-foundation').value = engine.technicalPrompt;
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
                showModal("Error", "Could not save: " + error.message);
            } else {
                showModal("Success", "AI Voice Layer updated.", null, false, 
                    `<button class="btn-primary" onclick="hideModal()">OK</button>`);
                await loadConfigs();
            }
        });
    }

    initializePage();
});
