// js/marketing-hub.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatDate,
    parseCsvRow,
    addDays,
    themes,
    setupModalListeners,
    showModal,
    hideModal,
    setupUserMenuAndAuth,
    loadSVGs
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        emailTemplates: [],
        sequences: [],
        sequence_steps: [],
        user_quotas: [],
        selectedTemplateId: null,
        selectedSequenceId: null,
        isEditingSequenceDetails: false,
        originalSequenceName: '',
        originalSequenceDescription: '',
        editingStepId: null,
        originalStepValues: {},
        currentView: 'email-templates'
    };

    let isLoginMode = true;

    // --- DOM Element Selectors ---
    const authContainer = document.getElementById("auth-container");
    const marketingHubContainer = document.getElementById("marketing-hub-container");
    const authForm = document.getElementById("auth-form");
    const authError = document.getElementById("auth-error");
    const authEmailInput = document.getElementById("auth-email");
    const authPasswordInput = document.getElementById("auth-password");
    const authSubmitBtn = document.getElementById("auth-submit-btn");
    const forgotPasswordLink = document.getElementById("forgot-password-link");
    const authToggleLink = document.getElementById("auth-toggle-link");
    const signupFields = document.getElementById("signup-fields");
    const authConfirmPasswordInput = document.getElementById("auth-confirm-password");

    const navEmailTemplates = document.querySelector('a[href="#email-templates"]');
    const navSequences = document.querySelector('a[href="#sequences"]');
    const navSocialPosts = document.querySelector('a[href="#social-posts"]');

    const createNewItemBtn = document.getElementById('create-new-item-btn');
    const importItemBtn = document.getElementById('import-item-btn');
    const itemCsvInput = document.getElementById('item-csv-input');
    const deleteSelectedItemBtn = document.getElementById('delete-selected-item-btn');
    const itemList = document.getElementById('item-list');
    const listHeader = document.getElementById('list-header');
    const dynamicDetailsPanel = document.getElementById('dynamic-details-panel');
    const downloadSequenceTemplateBtn = document.getElementById('download-sequence-template-btn');

    const templatesSequencesView = document.getElementById('templates-sequences-view');
    const socialPostView = document.getElementById('social-post-view');
    
    const createPostForm = document.getElementById('create-post-form');
    const submitPostBtn = document.getElementById('submit-post-btn');
    const formFeedback = document.getElementById('form-feedback');

    // --- All original helper functions (showTemporaryMessage, clearErrorMessage, updateAuthUI, theme logic) go here ---
    // (This code is unchanged from your original file)

    // --- Data Fetching ---
    async function loadAllData() {
        if (!state.currentUser) return;

        try {
            const [
                { data: emailTemplates, error: templatesError },
                { data: sequences, error: sequencesError },
                { data: sequenceSteps, error: sequenceStepsError },
                { data: userQuotas, error: userQuotasError }
            ] = await Promise.all([
                supabase.from("email_templates").select("*"),
                supabase.from("marketing_sequences").select("*"),
                supabase.from("marketing_sequence_steps").select("*"),
                supabase.from("user_quotas").select("user_id, full_name")
            ]);

            if (templatesError) throw templatesError;
            if (sequencesError) throw sequencesError;
            if (sequenceStepsError) throw sequenceStepsError;
            if (userQuotasError) throw userQuotasError;

            state.emailTemplates = emailTemplates || [];
            state.sequences = sequences || [];
            state.sequence_steps = sequenceSteps || [];
            state.user_quotas = userQuotas || [];

            renderContent();
        } catch (error) {
            console.error("Error loading data:", error.message);
            alert("Failed to load data. Please try refreshing the page. Error: " + error.message);
        }
    }

    // --- Render Content Based on View (CORRECTED) ---
    const renderContent = () => {
        const isSocialView = state.currentView === 'social-posts';

        // Toggle visibility of the main view containers
        if (templatesSequencesView) templatesSequencesView.classList.toggle('hidden', isSocialView);
        if (socialPostView) socialPostView.classList.toggle('hidden', !isSocialView);
        
        // Toggle active state on navigation buttons
        if (navEmailTemplates) navEmailTemplates.classList.toggle('active', state.currentView === 'email-templates');
        if (navSequences) navSequences.classList.toggle('active', state.currentView === 'sequences');
        if (navSocialPosts) navSocialPosts.classList.toggle('active', isSocialView);

        // If we are in the templates/sequences view, render its content and set button text
        if (!isSocialView) {
            if (state.currentView === 'email-templates') {
                if (listHeader) listHeader.textContent = 'Email Templates';
                if (createNewItemBtn) createNewItemBtn.textContent = 'Create New Template';
                if (importItemBtn) importItemBtn.classList.add('hidden');
                if (deleteSelectedItemBtn) deleteSelectedItemBtn.textContent = 'Delete Selected Template';
                if (downloadSequenceTemplateBtn) downloadSequenceTemplateBtn.classList.add('hidden');
                renderTemplateList();
                renderTemplateDetails();
            } else if (state.currentView === 'sequences') {
                if (listHeader) listHeader.textContent = 'Marketing Sequences';
                if (createNewItemBtn) createNewItemBtn.textContent = 'New Marketing Sequence';
                if (importItemBtn) importItemBtn.classList.remove('hidden');
                if (importItemBtn) importItemBtn.textContent = 'Import Steps from CSV';
                if (deleteSelectedItemBtn) deleteSelectedItemBtn.textContent = 'Delete Selected Sequence';
                if (downloadSequenceTemplateBtn) downloadSequenceTemplateBtn.classList.remove('hidden');
                renderSequenceList();
                renderSequenceDetails();
            }
        }
    };
    
    // --- All your original Template & Sequence render functions and handlers go here ---
    // (renderTemplateList, renderTemplateDetails, handleSaveTemplate, renderSequenceList, etc.)
    // (This code is unchanged from your original file)
    
    // --- Event Listener Setup ---
    function setupPageEventListeners() {
        setupModalListeners();
        
        const themeToggleBtn = document.getElementById("theme-toggle-btn");
        if (themeToggleBtn) themeToggleBtn.addEventListener("click", cycleTheme);

        const logoutBtn = document.getElementById("logout-btn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                await supabase.auth.signOut();
                window.location.href = "marketing-hub.html";
            });
        }

        // --- Auth Listeners ---
        if (authForm) { /* ... Your existing auth form listener ... */ }
        if (authToggleLink) { /* ... Your existing auth toggle listener ... */ }
        if (forgotPasswordLink) { /* ... Your existing forgot password listener ... */ }

        // --- Navigation Listeners ---
        if (navEmailTemplates) {
            navEmailTemplates.addEventListener('click', (e) => {
                e.preventDefault();
                state.currentView = 'email-templates';
                state.selectedTemplateId = null;
                renderContent();
            });
        }
        if (navSequences) {
            navSequences.addEventListener('click', (e) => {
                e.preventDefault();
                state.currentView = 'sequences';
                state.selectedSequenceId = null;
                renderContent();
            });
        }
        if (navSocialPosts) {
            navSocialPosts.addEventListener('click', (e) => {
                e.preventDefault();
                state.currentView = 'social-posts';
                renderContent();
            });
        }
        
        // --- Social Post Form Listener ---
        if (createPostForm) {
            createPostForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                submitPostBtn.disabled = true;
                submitPostBtn.textContent = 'Submitting...';
                formFeedback.style.display = 'none';

                const newPost = {
                    type: 'marketing_post',
                    title: document.getElementById('post-title').value.trim(),
                    link: document.getElementById('post-link').value.trim(),
                    approved_copy: document.getElementById('post-copy').value.trim(),
                    is_dynamic_link: document.getElementById('is-dynamic-link').checked,
                    source_name: 'Marketing Team',
                    status: 'new'
                };

                try {
                    const { error } = await supabase.from('social_hub_posts').insert(newPost);
                    if (error) throw error;
                    formFeedback.textContent = '✅ Success! The post has been added to the Social Hub.';
                    formFeedback.style.color = 'var(--success-color)';
                    createPostForm.reset();
                } catch (error) {
                    formFeedback.textContent = `❌ Error: ${error.message}`;
                    formFeedback.style.color = 'var(--danger-red)';
                } finally {
                    formFeedback.style.display = 'block';
                    submitPostBtn.disabled = false;
                    submitPostBtn.textContent = 'Add Post to Social Hub';
                }
            });
        }

        // --- Item List & Button Listeners ---
        if (itemList) itemList.addEventListener('click', handleItemListClick);
        if (createNewItemBtn) createNewItemBtn.addEventListener('click', handleCreateNewItem);
        if (importItemBtn) importItemBtn.addEventListener('click', handleImportItem);
        if (deleteSelectedItemBtn) deleteSelectedItemBtn.addEventListener('click', handleDeleteSelectedItem);
        if (downloadSequenceTemplateBtn) downloadSequenceTemplateBtn.addEventListener('click', downloadCsvTemplate);
        if (itemCsvInput) { /* ... your existing CSV input listener ... */ }
    }

    // --- App Initialization ---
    async function initializePage() {
        await loadSVGs(); // Load SVGs first
        
        const savedTheme = localStorage.getItem('crm-theme') || 'dark';
        const savedThemeIndex = themes.indexOf(savedTheme);
        currentThemeIndex = savedThemeIndex !== -1 ? savedThemeIndex : 0;
        applyTheme(themes[currentThemeIndex]);

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            state.currentUser = session.user;
            if (authContainer) authContainer.classList.add('hidden');
            if (marketingHubContainer) marketingHubContainer.classList.remove('hidden');
            await setupUserMenuAndAuth(supabase, state);
            setupPageEventListeners();
            
            // Set initial view based on URL hash
            const hash = window.location.hash;
            if (hash === '#sequences') {
                state.currentView = 'sequences';
            } else if (hash === '#social-posts') {
                state.currentView = 'social-posts';
            } else {
                state.currentView = 'email-templates';
            }
            await loadAllData(); // This calls renderContent at the end
        } else {
            if (authContainer) authContainer.classList.remove('hidden');
            if (marketingHubContainer) marketingHubContainer.classList.add('hidden');
            isLoginMode = true;
            updateAuthUI();
            setupPageEventListeners();
        }

        supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                state.currentUser = session.user;
                if (authContainer) authContainer.classList.add('hidden');
                if (marketingHubContainer) marketingHubContainer.classList.remove('hidden');
                await setupUserMenuAndAuth(supabase, state);
                
                const hash = window.location.hash;
                 if (hash === '#sequences') {
                    state.currentView = 'sequences';
                } else if (hash === '#social-posts') {
                    state.currentView = 'social-posts';
                } else {
                    state.currentView = 'email-templates';
                }
                await loadAllData();
            } else {
                state.currentUser = null;
                if (authContainer) authContainer.classList.remove('hidden');
                if (marketingHubContainer) marketingHubContainer.classList.add('hidden');
                isLoginMode = true;
                updateAuthUI();
            }
        });
    }

    initializePage();
});
