import { 
    SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, 
    loadSVGs, updateActiveNavLink, initializeAppState, getState, 
    showModal, hideModal, setupModalListeners, setupGlobalSearch 
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const ENGINES = [
        { id: 'get-daily-briefing', name: 'Command Center Briefing', placeholders: ['tasks', 'deals', 'accounts', 'cognitoAlerts'] },
        { id: 'get-account-briefing', name: 'Account Recon (IRR)', placeholders: ['accountName', 'orgChart', 'deals', 'activities'] },
        { id: 'get-gemini-suggestion', name: 'Cognito: Initial Outreach', placeholders: ['FirstName', 'headline', 'summary', 'accountName'] },
        { id: 'generate-social-post', name: 'Social: News Drafter', placeholders: ['title', 'summary', 'link'] }
    ];

    let state = { selectedEngineId: null, configs: [] };
    let globalState = {};

    const listBody = document.getElementById("ai-engine-list-body");
    const editorForm = document.getElementById("ai-editor-form");
    const placeholder = document.getElementById("no-selection-msg");
    const saveBtn = document.getElementById("save-all-configs-btn");

    async function loadConfigs() {
        const { data, error } = await supabase.from('ai_configs').select('*');
        if (error) { console.error("Error loading configs:", error); return; }
        state.configs = data || [];
        renderList();
    }

    function renderList() {
        listBody.innerHTML = ENGINES.map(e => `
            <tr class="list-item ${state.selectedEngineId === e.id ? 'selected' : ''}" data-id="${e.id}">
                <td>${e.name}</td>
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
        document.getElementById('ai-prompt-template').value = config.prompt_template || '';

        document.getElementById('placeholder-chips').innerHTML = engine.placeholders.map(p => 
            `<button class="btn-secondary merge-field-btn" data-tag="{{${p}}}">{{${p}}}</button>`
        ).join('');
    }

    async function initializePage() {
        await loadSVGs();
        globalState = await initializeAppState(supabase); // Use the logic from shared_constants
        
        if (globalState.currentUser) {
            await setupUserMenuAndAuth(supabase, globalState); // This now has all HTML elements it needs
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

        document.getElementById('placeholder-chips').addEventListener('click', (e) => {
            if (e.target.classList.contains('merge-field-btn')) {
                const tag = e.target.dataset.tag;
                const area = document.getElementById('ai-prompt-template');
                area.setRangeText(tag, area.selectionStart, area.selectionEnd, 'end');
                area.focus();
            }
        });

        saveBtn.addEventListener('click', async () => {
            const data = {
                function_id: state.selectedEngineId,
                persona: document.getElementById('ai-persona').value,
                voice: document.getElementById('ai-voice').value,
                prompt_template: document.getElementById('ai-prompt-template').value,
                updated_at: new Date().toISOString()
            };
            const { error } = await supabase.from('ai_configs').upsert(data, { onConflict: 'function_id' });
            if (error) {
                showModal("Error", error.message);
            } else {
                showModal("Success", "Configuration Saved!", null, false, `<button class="btn-primary" onclick="hideModal()">OK</button>`);
                await loadConfigs();
            }
        });
    }

    initializePage();
});
