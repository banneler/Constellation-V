import { 
    SUPABASE_URL, SUPABASE_ANON_KEY, setupUserMenuAndAuth, 
    loadSVGs, updateActiveNavLink, initializeAppState, 
    setupModalListeners, setupGlobalSearch, checkAndSetNotifications 
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
            technicalPrompt: "This engine acts as a strategic filter for your CRM. It is hardcoded to ingest a massive payload of raw data—including pending tasks, active deals, Cognito news alerts, and contact engagement logs. Its primary logic is to rank this data by 'Strategic Weight.' It is programmed to always prioritize Cognito Intelligence (buying signals) and Late-Stage Deals (immediate revenue) over general admin tasks. Finally, it enforces a strict data structure to ensure the information is returned in a clean, prioritized list that the dashboard can display without errors." 
        },
        { 
            id: 'get-account-briefing', 
            name: 'Account Recon', 
            demoPersona: "A relentless Enterprise Account Strategist specializing in the Nebraska market.", 
            demoVoice: "Consultative, data-driven, and objective.", 
            demoInstructions: "Flag accounts hitting $35M revenue or 75+ employee thresholds. Identify cross-sell gaps.", 
            technicalPrompt: "Analyze firmographics, org hierarchy, and activity logs. Summarize relationship health." 
        },
        { 
            id: 'get-gemini-suggestion', 
            name: 'Cognito Suggestion', 
            demoPersona: "A consultative telecom advisor who values the prospect's time.", 
            demoVoice: "Professional, concise, and non-robotic.", 
            demoInstructions: "Reference news alerts naturally. Focus on insights rather than just asking for a meeting.", 
            technicalPrompt: "Draft outreach email based on news alerts. System handles [FirstName] and signatures." 
        },
        { 
            id: 'generate-custom-suggestion', 
            name: 'Cognito Refiner', 
            demoPersona: "An expert communications and copywriting coach.", 
            demoVoice: "Direct and instruction-led.", 
            demoInstructions: "Strictly follow user feedback to adjust the tone or focus of the previous draft.", 
            technicalPrompt: "This engine acts as a 'Professional Editor' and Revisionist. It is technically unique because it processes the current state of an outreach draft alongside a user's feedback. It has a 'Recursive Memory' logic—it looks at what was originally written, understands the strategic alert data, and then applies specific user corrections to the tone, length, or focus. It ensures that even after multiple edits, the output remains a structured JSON object compatible with the Cognito interface."
        },
        { 
            id: 'generate-social-post', 
            name: 'Social Article', 
            demoPersona: "A tech thought leader in the Midwest business ecosystem.", 
            demoVoice: "Engaging, conversational, and 'scroll-stopping'.", 
            demoInstructions: "Extract 3 punchy takeaways. End with a question to drive engagement.", 
            technicalPrompt: "Review article summary. Extract takeaways. Draft professional LinkedIn post. No hashtags." 
        },
        { 
            id: 'custom-user-social-post', 
            name: 'Product Post', 
            demoPersona: "A senior GPC Product Marketing Specialist.", 
            demoVoice: "Authoritative yet approachable. Focus on outcomes, not features.", 
            demoInstructions: "Emphasize local reliability and GPC's deep roots in the Nebraska business community.", 
            technicalPrompt: "This engine is the 'Product Specialist' of the Social Hub. Unlike a general article summary, this tool is technically wired to reach out to the GPC Product database to pull in 'Verbiage Context.' It takes your raw topic, identifies the products you've selected, and blends them together. Its hardcoded foundation ensures that the output is formatted with LinkedIn-specific spacing and always includes a curated string of niche hashtags to ensure the post reaches the right business audience."
        },
        { 
            id: 'refine-social-post', 
            name: 'Post Refiner', 
            demoPersona: "A professional business journal editor.", 
            demoVoice: "Polished, sophisticated, and concise.", 
            demoInstructions: "Clean up wordiness. Optimize for mobile readability on LinkedIn.", 
            technicalPrompt: "Update the social media draft based on the user's specific refinement instructions." 
        },
        { 
            id: 'generate-prospect-email', 
            name: 'Contact Email', 
            demoPersona: "An experienced Strategic Markets Group sales lead.", 
            demoVoice: "Value-first and peer-to-peer.", 
            demoInstructions: "Keep it under 150 words. Anchor on a specific business outcome from the product selections.", 
            technicalPrompt: "This engine acts as a 'Strategic Outreach Architect.' It is technically unique because it performs a 'triple-join' of data: it identifies the specific GPC user's name and title, it pulls in verified product verbiage context, and it analyzes the prospect's industry. Its hardcoded logic ensures that the email is structured for high-conversion sales standards—concise body, professional line breaks, and a clean handoff to the UI's signature system. It prevents the AI from over-explaining and forces it to focus on the user's specific outreach goal." 
        },
        { 
            id: 'get-activity-insight', 
            name: 'Activity Insights', 
            demoPersona: "A sharp Strategic Sales Analyst.", 
            demoVoice: "Insightful, analytical, and action-oriented.", 
            demoInstructions: "Flag accounts with zero activity in 30 days. Suggest outreach pattern interrupts.", 
            technicalPrompt: "Summarize activity history. Identify engagement trends and suggest next actions." 
        },
            ];

    let state = { selectedEngineId: null, configs: [] };

    const tabContainer = document.getElementById("ai-engine-tabs");
    const editorForm = document.getElementById("ai-editor-form");
    const placeholder = document.getElementById("no-selection-msg");
    const saveBtn = document.getElementById("save-config-btn");

    function showToast(message, type = 'success') {
        const existingToast = document.querySelector('.constellation-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = `constellation-toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

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
                
                if (error) {
                    showToast(`Save Error: ${error.message}`, 'error');
                } else {
                    showToast("AI Voice Settings Updated Successfully!");
                    await loadConfigs();
                }
            });
        }
    }

    initializePage();
});
