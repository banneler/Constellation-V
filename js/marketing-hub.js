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


    // --- Helper functions ---
    const showTemporaryMessage = (message, isSuccess = true) => {
        if (authError) {
            authError.textContent = message;
            authError.style.color = isSuccess ? 'var(--success-color)' : 'var(--error-color)';
            authError.style.display = 'block';
        }
    };

    const clearErrorMessage = () => {
        if (authError) {
            authError.textContent = "";
            authError.style.display = 'none';
        }
    };

    const updateAuthUI = () => {
        if (authSubmitBtn) authSubmitBtn.textContent = isLoginMode ? "Login" : "Sign Up";
        if (authToggleLink) {
            authToggleLink.textContent = isLoginMode ? "Need an account? Sign Up" : "Have an account? Login";
        }
        clearErrorMessage();
        if (authForm) authForm.reset();

        if (signupFields) {
            if (isLoginMode) {
                signupFields.classList.add('hidden');
                if (authConfirmPasswordInput) authConfirmPasswordInput.removeAttribute('required');
            } else {
                signupFields.classList.remove('hidden');
                if (authConfirmPasswordInput) authConfirmPasswordInput.setAttribute('required', 'required');
            }
        }

        if (forgotPasswordLink) {
            if (isLoginMode) {
                forgotPasswordLink.classList.remove('hidden');
            } else {
                forgotPasswordLink.classList.add('hidden');
            }
        }
    };

    // --- Theme Logic ---
    let currentThemeIndex = 0;
    function applyTheme(themeName) {
        document.body.className = '';
        document.body.classList.add(`theme-${themeName}`);
        const themeNameSpan = document.getElementById("theme-name");
        if (themeNameSpan) {
            const capitalizedThemeName = themeName.charAt(0).toUpperCase() + themeName.slice(1);
            themeNameSpan.textContent = capitalizedThemeName;
        }
        localStorage.setItem('crm-theme', themeName);
    }
    function cycleTheme() {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        const newTheme = themes[currentThemeIndex];
        applyTheme(newTheme);
    }

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

    // --- Render Content Based on View ---
    const renderContent = () => {
        // Hide all main views first
        if (templatesSequencesView) templatesSequencesView.classList.add('hidden');
        if (socialPostView) socialPostView.classList.add('hidden');
        
        // De-activate all nav buttons
        if (navEmailTemplates) navEmailTemplates.classList.remove('active');
        if (navSequences) navSequences.classList.remove('active');
        if (navSocialPosts) navSocialPosts.classList.remove('active');
        
        // Show the correct view based on state
        if (state.currentView === 'email-templates') {
            if (templatesSequencesView) templatesSequencesView.classList.remove('hidden');
            if (navEmailTemplates) navEmailTemplates.classList.add('active');
            if (listHeader) listHeader.textContent = 'Email Templates';
            if (createNewItemBtn) createNewItemBtn.textContent = 'Create New Template';
            if (importItemBtn) importItemBtn.classList.add('hidden');
            if (deleteSelectedItemBtn) deleteSelectedItemBtn.textContent = 'Delete Selected Template';
            if (downloadSequenceTemplateBtn) downloadSequenceTemplateBtn.classList.add('hidden');
            renderTemplateList();
            renderTemplateDetails();
        } else if (state.currentView === 'sequences') {
            if (templatesSequencesView) templatesSequencesView.classList.remove('hidden');
            if (navSequences) navSequences.classList.add('active');
            if (listHeader) listHeader.textContent = 'Marketing Sequences';
            if (createNewItemBtn) createNewItemBtn.textContent = 'New Marketing Sequence';
            if (importItemBtn) importItemBtn.classList.remove('hidden');
            if (importItemBtn) importItemBtn.textContent = 'Import Steps from CSV';
            if (deleteSelectedItemBtn) deleteSelectedItemBtn.textContent = 'Delete Selected Sequence';
            if (downloadSequenceTemplateBtn) downloadSequenceTemplateBtn.classList.remove('hidden');
            renderSequenceList();
            renderSequenceDetails();
        } else if (state.currentView === 'social-posts') {
            if (socialPostView) socialPostView.classList.remove('hidden');
            if (navSocialPosts) navSocialPosts.classList.add('active');
        }
    };

    // --- All Template & Sequence Functions (renderTemplateList, handleSaveTemplate, etc.) go here ---
    // (These are unchanged from your original file)
    
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
        
        // --- Auth Form Listeners ---
        if (authForm) { /* ... existing auth form listeners ... */ }
        if (authToggleLink) { /* ... existing auth toggle listener ... */ }
        if (forgotPasswordLink) { /* ... existing forgot password listener ... */ }
        
        // --- Item List & Button Listeners ---
        if (itemList) itemList.addEventListener('click', handleItemListClick);
        if (createNewItemBtn) createNewItemBtn.addEventListener('click', handleCreateNewItem);
        if (importItemBtn) importItemBtn.addEventListener('click', handleImportItem);
        if (deleteSelectedItemBtn) deleteSelectedItemBtn.addEventListener('click', handleDeleteSelectedItem);
        if (downloadSequenceTemplateBtn) downloadSequenceTemplateBtn.addEventListener('click', downloadCsvTemplate);
        if (itemCsvInput) { /* ... existing CSV input listener ... */ }
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
            if (authContainer) authContainer.classList.remove('hidden');
            if (marketingHubContainer) marketingHubContainer.classList.add('hidden');
            isLoginMode = true;
            updateAuthUI();
            setupPageEventListeners();
        }

        supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                // ... existing auth state change logic for logged in users
            } else {
                // ... existing auth state change logic for logged out users
            }
        });
    }

    initializePage();
});
