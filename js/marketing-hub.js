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
    const createNewItemBtn = document.getElementById('create-new-item-btn');
    const importItemBtn = document.getElementById('import-item-btn');
    const itemCsvInput = document.getElementById('item-csv-input');
    const deleteSelectedItemBtn = document.getElementById('delete-selected-item-btn');
    const itemList = document.getElementById('item-list');
    const listHeader = document.getElementById('list-header');
    const dynamicDetailsPanel = document.getElementById('dynamic-details-panel');
    const downloadSequenceTemplateBtn = document.getElementById('download-sequence-template-btn');

    // === NEW SELECTORS FOR SOCIAL POST FORM ===
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
        // ... (existing auth UI logic)
    };

    // --- Theme Logic ---
    let currentThemeIndex = 0;
    function applyTheme(themeName) {
        // ... (existing theme logic)
    }
    function cycleTheme() {
        // ... (existing theme logic)
    }

    // --- Data Fetching ---
    async function loadAllData() {
        // ... (existing data fetching logic)
    }

    // --- Render Content Based on View ---
    const renderContent = () => {
        // ... (existing render logic)
    };

    // --- Email Templates & Sequences Functions ---
    // ... (All of your existing functions for rendering and handling templates/sequences go here)
    // renderTemplateList, renderTemplateDetails, setupTemplateDetailsListeners, handleSaveTemplate,
    // handleDeleteTemplate, handleMergeFieldClick, renderSequenceList, renderSequenceSteps,
    // renderSequenceDetails, setupSequenceDetailsListeners, etc. all remain the same.

    // --- Event Listener Setup ---
    function setupPageEventListeners() {
        setupModalListeners();
        // ... (all existing event listeners for templates, sequences, auth, etc.)

        // === NEW: LOGIC FOR THE "CREATE SOCIAL POST" FORM ===
        if (createPostForm) {
            createPostForm.addEventListener('submit', async (event) => {
                event.preventDefault();

                submitPostBtn.disabled = true;
                submitPostBtn.textContent = 'Submitting...';
                formFeedback.style.display = 'none';

                // 1. Get data from the form
                const postTitle = document.getElementById('post-title').value.trim();
                const postLink = document.getElementById('post-link').value.trim();
                const postCopy = document.getElementById('post-copy').value.trim();
                const isDynamic = document.getElementById('is-dynamic-link').checked;

                // 2. Prepare the object for Supabase
                const newPost = {
                    type: 'marketing_post',
                    title: postTitle,
                    link: postLink,
                    approved_copy: postCopy,
                    source_name: 'Marketing Team',
                    is_dynamic_link: isDynamic,
                    status: 'new'
                };

                // 3. Insert into the database
                try {
                    const { error } = await supabase.from('social_hub_posts').insert(newPost);
                    if (error) throw error;

                    formFeedback.textContent = '✅ Success! The post has been added to the Social Hub.';
                    formFeedback.style.color = 'var(--success-color)';
                    formFeedback.style.display = 'block';
                    createPostForm.reset();

                } catch (error) {
                    console.error('Error submitting post:', error);
                    formFeedback.textContent = `❌ Error: ${error.message}`;
                    formFeedback.style.color = 'var(--danger-red)';
                    formFeedback.style.display = 'block';
                } finally {
                    submitPostBtn.disabled = false;
                    submitPostBtn.textContent = 'Add Post to Social Hub';
                }
            });
        }
    }

    // --- App Initialization ---
    async function initializePage() {
        await loadSVGs(); // Call this first to load icons

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
            setupPageEventListeners(); // This will now include the new form listener
            const hash = window.location.hash;
            if (hash === '#sequences') {
                state.currentView = 'sequences';
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
            // ... (existing auth state change logic)
        });
    }

    initializePage();
});
