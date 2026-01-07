import { 
    SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, 
    loadSVGs, updateActiveNavLink, showModal, hideModal 
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Definitions based on repository usage
    const ENGINES = [
        { id: 'get-daily-briefing', name: 'Command Center Briefing', placeholders: ['tasks', 'deals', 'accounts', 'cognitoAlerts'] },
        { id: 'get-account-briefing', name: 'Account Recon (IRR)', placeholders: ['accountName', 'orgChart', 'deals', 'activities'] },
        { id: 'get-gemini-suggestion', name: 'Cognito: Initial Outreach', placeholders: ['FirstName', 'headline', 'summary', 'accountName'] },
        { id: 'generate-social-post', name: 'Social: News Drafter', placeholders: ['title', 'summary', 'link'] }
    ];

    let state = {
        currentUser: null,
        selectedEngineId: null,
        configs: []
    };

    const engineListBody = document.querySelector("#ai-engine-list tbody");
    const editorForm = document.getElementById("ai-editor-form");
    const noSelectionMsg = document.getElementById("no-selection-msg");
    const saveBtn = document.getElementById("save-all-configs-btn");

    async function loadConfigs() {
        const { data, error } = await supabase.from('ai_configs').select('*');
        if (error) console.error("Error loading configs:", error);
        state.configs = data || [];
        renderEngineList();
    }

    function renderEngineList() {
        engineListBody.innerHTML = ENGINES.map(engine => `
            <tr class="list-item ${state.selectedEngineId === engine.id ? 'selected' : ''}" data-id="${engine.id}">
                <td>${engine.name}</td>
            </tr>
        `).join('');
    }

    function selectEngine(id) {
        state.selectedEngineId = id;
        const engine = ENGINES.find(e => e.id === id);
        const config = state.configs.find(c => c.function_id === id) || {};

        renderEngineList();
        noSelectionMsg.classList.add('hidden');
        editorForm.classList.remove('hidden');
        saveBtn.classList.remove('hidden');

        document.getElementById('selected-engine-name').textContent = engine.name;
        document.getElementById('ai-persona').value = config.persona || '';
        document.getElementById('ai-voice').value = config.voice || '';
        document.getElementById('ai-prompt-template').value = config.prompt_template || '';

        const chipContainer = document.getElementById('placeholder-chips');
        chipContainer.innerHTML = engine.placeholders.map(p => 
            `<button class="btn-secondary merge-field-btn" data-tag="{{${p}}}">{{${p}}}</button>`
        ).join('');
    }

    async function initializePage() {
        await loadSVGs();
        updateActiveNavLink();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            state.currentUser = session.user;
            await setupUserMenuAndAuth(supabase, state);
            await loadConfigs();
            setupEventListeners();
        } else {
            window.location.href = "index.html";
        }
    }

    function setupEventListeners() {
        engineListBody.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row) selectEngine(row.dataset.id);
        });

        document.getElementById('placeholder-chips').addEventListener('click', (e) => {
            if (e.target.classList.contains('merge-field-btn')) {
                const tag = e.target.dataset.tag;
                const template = document.getElementById('ai-prompt-template');
                const start = template.selectionStart;
                template.value = template.value.substring(0, start) + tag + template.value.substring(template.selectionEnd);
                template.focus();
            }
        });

        saveBtn.addEventListener('click', async () => {
            const configData = {
                function_id: state.selectedEngineId,
                persona: document.getElementById('ai-persona').value,
                voice: document.getElementById('ai-voice').value,
                prompt_template: document.getElementById('ai-prompt-template').value,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.from('ai_configs').upsert(configData, { onConflict: 'function_id' });
            if (error) {
                showModal("Error", error.message, null, false, `<button class="btn-primary" onclick="hideModal()">OK</button>`);
            } else {
                showModal("Success", "AI Configuration Saved.", null, false, `<button class="btn-primary" onclick="hideModal()">OK</button>`);
                await loadConfigs();
            }
        });
    }

    initializePage();
});
