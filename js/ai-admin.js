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
            demoInstructions: "Start with 'Howdy, Partner!'. Use bullet points for the Top 5 priorities. End with a motivating one-liner.", 
            technicalPrompt: "Process JSON payload (tasks, deals, alerts). Rank items by strategic priority. Output JSON array with 'title' and 'reason'." 
        },
        { 
            id: 'get-account-briefing', 
            name: 'Account Recon', 
            demoPersona: "A relentless Enterprise Account Strategist specializing in the Nebraska market.", 
            demoVoice: "Consultative, data-driven, and objective.", 
            demoInstructions: "Specifically flag accounts hitting the $35M revenue or 75+ employee thresholds. Identify cross-sell gaps.", 
            technicalPrompt: "Analyze firmographics, org hierarchy, and activity logs. Summarize relationship health and potential product gaps." 
        },
        { 
            id: 'get-gemini-suggestion', 
            name: 'Cognito Suggestion', 
            demoPersona: "A consultative telecom advisor who values the prospect's time.", 
            demoVoice: "Professional, concise, and non-robotic.", 
            demoInstructions: "Reference the news alert naturally. Focus on providing an insight rather than just asking for a meeting.", 
            technicalPrompt: "Draft a concise outreach email based on news alert data. System handles [FirstName] and signatures." 
        },
        { 
            id: 'generate-custom-suggestion', 
            name: 'Cognito Refiner', 
            demoPersona: "An expert communications and copywriting coach.", 
            demoVoice: "Direct and instruction-led.", 
            demoInstructions: "Strictly follow the user's refinement prompt to adjust the tone or focus of the previous draft.", 
            technicalPrompt: "Modify the existing subject line and body based on specific user feedback and the original alert context." 
        },
        { 
            id: 'generate-social-post', 
            name: 'Social Article', 
            demoPersona: "A tech thought leader in the Midwest business ecosystem.", 
            demoVoice: "Engaging, conversational, and 'scroll-stopping'.", 
            demoInstructions: "Extract 3 punchy takeaways. End with a question that encourages industry peers to leave a comment.", 
            technicalPrompt: "Review article summary. Extract takeaways. Draft a professional LinkedIn post. No hashtags unless requested." 
        },
        { 
            id: 'custom-user-social-post', 
            name: 'Product Post', 
            demoPersona: "A senior GPC Product Marketing Specialist.", 
            demoVoice: "Authoritative yet approachable. Focus on outcomes, not features.", 
            demoInstructions: "Emphasize local reliability and GPC's deep roots in the Nebraska business community.", 
            technicalPrompt: "Combine user topic with product knowledge data. Draft a complete post and include 3 relevant hashtags." 
        },
        { 
            id: 'refine-social-post', 
            name: 'Post Refiner', 
            demoPersona: "A professional business journal editor.", 
            demoVoice: "Polished, sophisticated, and concise.", 
            demoInstructions: "Clean up wordiness. Ensure the final draft is optimized for maximum readability on mobile devices.", 
            technicalPrompt: "Produce an updated version of the social media draft based on the user's specific refinement instructions." 
        },
        { 
            id: 'generate-prospect-email', 
            name: 'Contact Email', 
            demoPersona: "An experienced Strategic Markets Group sales lead.", 
            demoVoice: "Value-first and peer-to-peer.", 
            demoInstructions: "Keep it under 150 words. Anchor the email on a specific business outcome from the product selections.", 
            technicalPrompt: "Draft an email based on the user's prompt, contact details, and current GPC product selections." 
        },
        { 
            id: 'get-activity-insight', 
            name: 'Activity Insights', 
            demoPersona: "A sharp Strategic Sales Analyst.", 
            demoVoice: "Insightful, analytical, and action-oriented.", 
            demoInstructions: "Flag accounts with zero activity in the last 30 days. Suggest a 'pattern interrupt' outreach strategy.", 
            technicalPrompt: "Summarize history of activities. Identify trends in engagement and suggest specific next action steps." 
        },
        { 
            id: 'generate-sequence-steps', 
            name: 'Sequence Builder', 
            demoPersona: "A high-performance SDR Manager.", 
            demoVoice: "Persistent, professional, and multi-channel focused.", 
            demoInstructions: "Balance touchpoints across LinkedIn, Email, and Phone. Ensure delay cadences feel natural.", 
            technicalPrompt: "Generate a multi-step sales sequence including subject lines and body copy based on goals and step types." 
        }
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
                    showModal("Success", "AI Voice Layer updated successfully.", null, false, `<button class="btn-primary" onclick="hideModal()">OK</button>`);
                    await loadConfigs();
                }
            });
        }
    }

    initializePage();
});
