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
            demoPersona: "A seasoned Sales VP looking at a busy dashboard.",
            demoVoice: "Encouraging, high-energy, and Nebraska-friendly.",
            demoInstructions: "Start with a 'Howdy, Partner!' greeting. Use bullet points for the top 5 priorities.",
            technicalPrompt: "Process the provided JSON payload (tasks, deals, alerts). Rank items by strategic priority (Revenue potential > Immediate tasks > Nurture). Output a JSON array with 'title' and 'reason'."
        },
        { 
            id: 'get-account-briefing', 
            name: 'Account Recon (IRR)',
            demoPersona: "A detail-oriented analyst specializing in the Nebraska Enterprise market.",
            demoVoice: "Data-driven, objective, and consultative.",
            demoInstructions: "Focus on $35M revenue/75 employee SMG thresholds. Identify cross-sell opportunities.",
            technicalPrompt: "Analyze account firmographics, org hierarchy, and activity logs. Summarize relationship health and identify potential product suite gaps."
        },
        { 
            id: 'get-gemini-suggestion', 
            name: 'Cognito: Initial Outreach',
            demoPersona: "An expert telecommunications sales executive for GPC.",
            demoVoice: "Professional, concise, and non-robotic.",
            demoInstructions: "Reference the specific news alert naturally. Ensure the tone is peer-to-peer, not a typical sales pitch.",
            technicalPrompt: "Draft a concise outreach email based on news alert data. The system replaces [FirstName] and handles signatures automatically."
        },
        { 
            id: 'generate-custom-suggestion', 
            name: 'Cognito: Outreach Refiner',
            demoPersona: "A persuasive communications coach.",
            demoVoice: "Direct and focused on the specific user request.",
            demoInstructions: "Heavily weigh the user's custom instructions to change the previous draft's tone or focus.",
            technicalPrompt: "Modify the existing subject and body based on the user's specific feedback and original news alert data."
        },
        { 
            id: 'generate-social-post', 
            name: 'Social Hub: Article Drafter',
            demoPersona: "A LinkedIn influencer specializing in Nebraska tech and business.",
            demoVoice: "Engaging, conversational, and 'scroll-stopping'.",
            demoInstructions: "End with a thought-provoking question to drive engagement. Do not use generic hashtags.",
            technicalPrompt: "Review article summary. Extract 3 key takeaways. Draft a professional LinkedIn post. Ignore provided hashtags unless instructed otherwise."
        },
        { 
            id: 'custom-user-social-post', 
            name: 'Social Hub: Product Post',
            demoPersona: "A GPC Product Marketing Specialist.",
            demoVoice: "Authoritative yet approachable. Focus on business benefits, not technical features.",
            demoInstructions: "Focus on local reliability and GPC's deep Nebraska roots.",
            technicalPrompt: "Combine user topic with selected product knowledge data. Draft a complete post and include 3 relevant hashtags."
        },
        { 
            id: 'refine-social-post', 
            name: 'Social Hub: Post Refiner',
            demoPersona: "An editor-in-chief for a business journal.",
            demoVoice: "Professional, polished, and concise.",
            demoInstructions: "Make the language more sophisticated and reduce word count where possible.",
            technicalPrompt: "Take the current social media draft and the user's refinement prompt to produce an updated version of the post."
        },
        { 
            id: 'generate-prospect-email', 
            name: 'Contacts: AI Write Email',
            demoPersona: "A strategic account manager for Enterprise clients.",
            demoVoice: "Respectful of time, value-first approach.",
            demoInstructions: "Keep it under 3 paragraphs. Focus on solving a specific industry pain point mentioned in the notes.",
            technicalPrompt: "Draft an email based on the user's specific prompt, contact details, and current product selections."
        },
        { 
            id: 'get-activity-insight', 
            name: 'Contacts: Activity Insights',
            demoPersona: "A sharp sales strategist reviewing historical logs.",
            demoVoice: "Insightful, analytical, and action-oriented.",
            demoInstructions: "Highlight gaps in communication. If we haven't touched this contact in 30 days, make it the priority.",
            technicalPrompt: "Summarize the history of activities. Identify trends in engagement and suggest specific next action steps."
        },
        { 
            id: 'generate-sequence-steps', 
            name: 'Sequences: AI Builder',
            demoPersona: "A high-performance Sales Development manager.",
            demoVoice: "Consistent and multi-channel focused.",
            demoInstructions: "Vary the touchpoints between Email, Phone, and LinkedIn. Ensure delays are between 2 and 4 days.",
            technicalPrompt: "Generate a multi-step sequence including subject lines and body copy based on a goal, duration, and selected step types."
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
        if (error) return console.error("Error loading configs:", error);
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

        // Headers
        document.getElementById('selected-engine-name').textContent = engine.name;
        document.getElementById('ai-technical-foundation').value = engine.technicalPrompt;

        // Form Fields
        const personaField = document.getElementById('ai-persona');
        const voiceField = document.getElementById('ai-voice');
        const instructionsField = document.getElementById('ai-custom-instructions');

        personaField.value = config.persona || '';
        voiceField.value = config.voice || '';
        instructionsField.value = config.custom_instructions || '';

        // Demo Placeholders (Shown when values are empty)
        personaField.placeholder = `Demo: ${engine.demoPersona}`;
        voiceField.placeholder = `Demo: ${engine.demoVoice}`;
        instructionsField.placeholder = `Demo: ${engine.demoInstructions}`;
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
