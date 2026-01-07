import { SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, loadSVGs } from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // 1. Define the internal map of what currently exists in the codebase
    const AI_FUNCTIONS = [
        { 
            id: 'get-daily-briefing', 
            name: 'Daily Briefing', 
            placeholders: ['tasks', 'deals', 'accounts', 'cognitoAlerts'],
            desc: 'Generates the morning priority list in Command Center.'
        },
        { 
            id: 'get-account-briefing', 
            name: 'Account Recon (IRR)', 
            placeholders: ['accountName', 'orgChart', 'deals', 'activities'],
            desc: 'The deep-dive report generated on the Accounts page.'
        },
        { 
            id: 'get-gemini-suggestion', 
            name: 'Cognito: Initial Outreach', 
            placeholders: ['FirstName', 'headline', 'summary', 'accountName'],
            desc: 'The first email draft suggested for a new news alert.'
        },
        { 
            id: 'generate-social-post', 
            name: 'Social: News Poster', 
            placeholders: ['title', 'summary', 'link'],
            desc: 'Drafts LinkedIn posts from curated news articles.'
        }
    ];

    let state = {
        selectedFunctionId: null,
        configs: [] // Loaded from 'ai_configs' table
    };

    // --- Selectors ---
    const functionList = document.getElementById('ai-function-list');
    const editorPanel = document.getElementById('ai-editor-panel');
    const placeholderView = document.getElementById('no-selection-placeholder');

    async function initialize() {
        await loadSVGs();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await setupUserMenuAndAuth(supabase, session.user);
            await loadConfigs();
            renderFunctionList();
        }
    }

    async function loadConfigs() {
        const { data, error } = await supabase.from('ai_configs').select('*');
        if (error) console.error("Error loading AI configs:", error);
        state.configs = data || [];
    }

    function renderFunctionList() {
        functionList.innerHTML = AI_FUNCTIONS.map(f => `
            <div class="list-item ${state.selectedFunctionId === f.id ? 'selected' : ''}" data-id="${f.id}">
                <div class="item-name">${f.name}</div>
                <div class="item-subtext">${f.id}</div>
            </div>
        `).join('');

        functionList.querySelectorAll('.list-item').forEach(item => {
            item.addEventListener('click', () => selectFunction(item.dataset.id));
        });
    }

    function selectFunction(id) {
        state.selectedFunctionId = id;
        const config = state.configs.find(c => c.function_id === id) || {
            function_id: id,
            persona: '',
            voice: '',
            prompt_template: ''
        };

        const metadata = AI_FUNCTIONS.find(f => f.id === id);
        
        // Show Editor
        placeholderView.classList.add('hidden');
        editorPanel.classList.remove('hidden');
        renderFunctionList();

        // Populate Fields
        document.getElementById('current-function-title').textContent = metadata.name;
        document.getElementById('ai-persona').value = config.persona;
        document.getElementById('ai-voice').value = config.voice;
        document.getElementById('ai-template').value = config.prompt_template;

        // Render Chip Placeholders
        const chipContainer = document.getElementById('placeholder-chips');
        chipContainer.innerHTML = metadata.placeholders.map(p => 
            `<span class="chip" onclick="copyToClipboard('{{${p}}}')">{{${p}}}</span>`
        ).join('');
    }

    // --- Save Logic ---
    document.getElementById('save-all-configs-btn').addEventListener('click', async () => {
        const id = state.selectedFunctionId;
        const configData = {
            function_id: id,
            persona: document.getElementById('ai-persona').value,
            voice: document.getElementById('ai-voice').value,
            prompt_template: document.getElementById('ai-template').value,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('ai_configs')
            .upsert(configData, { onConflict: 'function_id' });

        if (error) {
            alert("Save failed: " + error.message);
        } else {
            alert("AI Configuration Updated Successfully!");
            await loadConfigs();
        }
    });

    initialize();
});
