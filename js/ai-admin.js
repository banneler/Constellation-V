import { 
    SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, 
    loadSVGs, updateActiveNavLink, initializeAppState, getState, 
    showModal, hideModal 
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Core Engine Definitions (Based on your repository)
    const ENGINES = [
        { id: 'daily-briefing', name: 'Command Center Briefing', placeholders: ['tasks', 'deals', 'accounts', 'cognitoAlerts'] },
        { id: 'account-recon', name: 'Account Recon (IRR)', placeholders: ['accountName', 'orgChart', 'deals', 'activities'] },
        { id: 'cognito-outreach', name: 'Cognito: Outreach', placeholders: ['FirstName', 'headline', 'summary', 'accountName'] },
        { id: 'social-news', name: 'Social: News Drafter', placeholders: ['title', 'summary', 'link'] },
        { id: 'social-custom', name: 'Social: Product Post', placeholders: ['userPrompt', 'product_names', 'industry'] }
    ];

    let globalState = {};
    let localState = {
        selectedEngineId: null,
        configs: [],
        isDirty: false
    };

    // --- DOM Elements ---
    const engineList = document.getElementById('ai-function-list');
    const editorPanel = document.getElementById('ai-editor-panel');
    const placeholderView = document.getElementById('no-selection-placeholder');
    const saveBtn = document.getElementById('save-config-btn');

    async function initializePage() {
        await loadSVGs();
        globalState = await initializeAppState(supabase); //
        
        if (!globalState.currentUser) return;

        updateActiveNavLink();
        await loadAllConfigs();
        renderEngineList();
        setupEventListeners();
    }

    async function loadAllConfigs() {
        const { data, error } = await supabase.from('ai_configs').select('*');
        if (error) console.error("Error loading configs:", error);
        localState.configs = data || [];
    }

    function renderEngineList() {
        engineList.innerHTML = ENGINES.map(engine => {
            const isSelected = localState.selectedEngineId === engine.id;
            return `
                <div class="list-item ${isSelected ? 'selected' : ''}" data-id="${engine.id}">
                    <div class="item-main">
                        <span class="engine-name">${engine.name}</span>
                        <small class="engine-id">${engine.id}</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    function selectEngine(id) {
        localState.selectedEngineId = id;
        const engine = ENGINES.find(e => e.id === id);
        const config = localState.configs.find(c => c.function_id === id) || { persona: '', voice: '', prompt_template: '' };

        // UI Updates
        renderEngineList();
        placeholderView.classList.add('hidden');
        editorPanel.classList.remove('hidden');
        saveBtn.classList.remove('hidden');

        document.getElementById('current-function-title').textContent = engine.name;
        document.getElementById('ai-persona').value = config.persona;
        document.getElementById('ai-voice').value = config.voice;
        document.getElementById('ai-template').value = config.prompt_template;

        // Render Chip Placeholders
        const chipContainer = document.getElementById('placeholder-chips');
        chipContainer.innerHTML = engine.placeholders.map(p => 
            `<button type="button" class="chip" data-tag="{{${p}}}">{{${p}}}</button>`
        ).join('');

        localState.isDirty = false;
    }

    function setupEventListeners() {
        engineList.addEventListener('click', (e) => {
            const item = e.target.closest('.list-item');
            if (item) selectEngine(item.dataset.id);
        });

        // Add "Click to insert" logic for chips
        document.getElementById('placeholder-chips').addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (chip) {
                const tag = chip.dataset.tag;
                const templateArea = document.getElementById('ai-template');
                const start = templateArea.selectionStart;
                const end = templateArea.selectionEnd;
                templateArea.value = templateArea.value.substring(0, start) + tag + templateArea.value.substring(end);
                templateArea.focus();
            }
        });

        saveBtn.addEventListener('click', async () => {
            const configData = {
                function_id: localState.selectedEngineId,
                persona: document.getElementById('ai-persona').value,
                voice: document.getElementById('ai-voice').value,
                prompt_template: document.getElementById('ai-template').value,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.from('ai_configs').upsert(configData, { onConflict: 'function_id' });

            if (error) {
                showModal("Save Error", error.message);
            } else {
                showModal("Success", "AI Logic Updated.", () => {
                    hideModal();
                    loadAllConfigs();
                }, false, `<button class="btn-primary" id="modal-ok-btn">OK</button>`);
            }
        });
    }

    initializePage();
});
