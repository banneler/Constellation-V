import { 
    SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, 
    loadSVGs, updateActiveNavLink, initializeAppState, 
    showModal, hideModal, setupModalListeners, setupGlobalSearch, checkAndSetNotifications 
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const ENGINES = [
        { 
            id: 'get-daily-briefing', 
            name: 'Command Center', 
            demoPersona: "A high-performance Sales Director focused on momentum and revenue.", 
            demoVoice: "Encouraging, high-energy, and Nebraska-friendly.", 
            demoInstructions: "Start with 'Howdy, Partner!'. Use bullet points for the Top 5 priorities.", 
            technicalPrompt: "Process JSON payload. Rank items by strategic priority. Output JSON array." 
        },
        { 
            id: 'get-account-briefing', 
            name: 'Account Recon', 
            demoPersona: "A relentless Enterprise Account Strategist.", 
            demoVoice: "Consultative, data-driven, and objective.", 
            demoInstructions: "Flag accounts hitting $35M revenue or 75+ employees. Identify cross-sell gaps.", 
            technicalPrompt: "Analyze firmographics, org hierarchy, and activity logs." 
        },
        { 
            id: 'get-gemini-suggestion', 
            name: 'Cognito Suggestion', 
            demoPersona: "A consultative telecom advisor who values the prospect's time.", 
            demoVoice: "Professional, concise, and non-robotic.", 
            demoInstructions: "Reference the news alert naturally. Provide an insight rather than just a pitch.", 
            technicalPrompt: "Draft concise outreach email based on news alerts. Uses [FirstName]." 
        },
        { 
            id: 'generate-custom-suggestion', 
            name: 'Cognito Refiner', 
            demoPersona: "An expert communications and copywriting coach.", 
            demoVoice: "Direct and instruction-led.", 
            demoInstructions: "Strictly follow user refinement prompts to adjust tone or focus.", 
            technicalPrompt: "Modify existing subject and body based on user feedback." 
        },
        { 
            id: 'generate-social-post', 
            name: 'Social Article', 
            demoPersona: "A tech thought leader in the Midwest business ecosystem.", 
            demoVoice: "Engaging, conversational, and 'scroll-stopping'.", 
            demoInstructions: "Extract 3 punchy takeaways. End with a question for engagement.", 
            technicalPrompt: "Summarize article into a professional LinkedIn post." 
        },
        { 
            id: 'custom-user-social-post', 
            name: 'Product Post', 
            demoPersona: "A senior GPC Product Marketing Specialist.", 
            demoVoice: "Authoritative yet approachable.", 
            demoInstructions: "Emphasize local reliability and GPC's deep roots in Nebraska.", 
            technicalPrompt: "Combine user topic with product knowledge data for a post." 
        },
        { 
            id: 'refine-social-post', 
            name: 'Post Refiner', 
            demoPersona: "A professional business journal editor.", 
            demoVoice: "Polished, sophisticated, and concise.", 
            demoInstructions: "Optimize for mobile readability. Reduce wordiness.", 
            technicalPrompt: "Update social media draft based on refinement instructions." 
        },
        { 
            id: 'generate-prospect-email', 
            name: 'Contact Email', 
            demoPersona: "An experienced Strategic Markets Group sales lead.", 
            demoVoice: "Value-first and peer-to-peer.", 
            demoInstructions: "Keep under 150 words. Anchor on a specific business outcome.", 
            technicalPrompt: "Draft email based on prompt and GPC product selections." 
        },
        { 
            id: 'get-activity-insight', 
            name: 'Activity Insights', 
            demoPersona: "A sharp Strategic Sales Analyst.", 
            demoVoice: "Insightful, analytical, and action-oriented.", 
            demoInstructions: "Flag accounts with zero activity in 30 days. Suggest outreach strategy.", 
            technicalPrompt: "Summarize history of activities and suggest next steps." 
        },
        { 
            id: 'generate-sequence-steps', 
            name: 'Sequence Builder', 
            demoPersona: "A high-performance SDR Manager.", 
            demoVoice: "Persistent, professional, and multi-channel.", 
            demoInstructions: "Balance touchpoints across LinkedIn, Email, and Phone.", 
            technicalPrompt: "Generate multi-step sales sequence JSON structure." 
        }
    ];

    let state = { selectedEngineId: null, configs: [] };

    const tabContainer = document.getElementById("ai-engine-tabs");
    const editorForm = document.getElementById("ai-editor-form");
    const placeholder = document.getElementById("no-selection-msg");
    const saveBtn = document.getElementById("save-config-btn");

    async function loadConfigs() {
        const { data, error } = await supabase.from('ai_configs').select('*');
        if (error) {
            console.error("Error loading configs:", error);
            return;
        }
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

        const pField = document.getElementById('ai-persona');
        const vField = document.getElementById('ai-voice');
        const iField = document.getElementById('ai-custom-instructions');

        pField.value = config.persona || '';
        vField.value = config.voice || '';
        iField.value = config.custom_instructions || '';

        // Strategic Placeholders
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

            // FIXED: Added error catching to display feedback if save fails
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
                    console.error("Save Error:", error);
                    showModal("Save Failed", `Error: ${error.message}. Ensure function_id unique index exists.`);
                } else {
                    showModal("Success", "AI Voice Layer updated.", null, false, `<button class="btn-primary" onclick="hideModal()">OK</button>`);
                    await loadConfigs();
                }
            });
        }
    }

    initializePage();
});
