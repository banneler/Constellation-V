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
    svgLoader // <<< CORRECTLY IMPORTED
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        emailTemplates: [],
        sequences: [],
        sequence_steps: [],
        socialPosts: [], // <<< NEW: State for social posts
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

    // --- Marketing Hub Navigation & Main Views ---
    const navEmailTemplates = document.querySelector('a[href="#email-templates"]');
    const navSequences = document.querySelector('a[href="#sequences"]');
    const navSocialHub = document.querySelector('a[href="#social-posts"]'); // <<< CORRECTED SELECTOR
    const templatesSequencesView = document.getElementById('templates-sequences-view');
    const socialPostView = document.getElementById('social-post-view'); // <<< CORRECTED SELECTOR

    // --- Templates & Sequences Elements ---
    const createNewItemBtn = document.getElementById('create-new-item-btn');
    const importItemBtn = document.getElementById('import-item-btn');
    const itemCsvInput = document.getElementById('item-csv-input');
    const deleteSelectedItemBtn = document.getElementById('delete-selected-item-btn');
    const itemList = document.getElementById('item-list');
    const listHeader = document.getElementById('list-header');
    const dynamicDetailsPanel = document.getElementById('dynamic-details-panel');
    const downloadSequenceTemplateBtn = document.getElementById('download-sequence-template-btn');

    // --- Social Hub Elements ---
    const socialPostList = document.getElementById('social-post-list'); // This is where posts will be rendered
    const createSocialPostForm = document.getElementById('create-post-form'); // From your HTML
    const socialPostContentInput = document.getElementById('post-copy'); // From your HTML
    const socialPostImageInput = document.getElementById('social-post-image'); // Assuming you might add this


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
            // <<< FIXED: Simplified to fetch all tables separately for reliability
            const [
                { data: emailTemplates, error: templatesError },
                { data: sequences, error: sequencesError },
                { data: sequenceSteps, error: sequenceStepsError },
                { data: socialPosts, error: socialPostsError },
                { data: userQuotas, error: userQuotasError }
            ] = await Promise.all([
                supabase.from("email_templates").select("*"),
                supabase.from("marketing_sequences").select("*"),
                supabase.from("marketing_sequence_steps").select("*"),
                supabase.from("social_posts").select("*"),
                supabase.from("user_quotas").select("user_id, full_name")
            ]);

            if (templatesError) throw templatesError;
            if (sequencesError) throw sequencesError;
            if (sequenceStepsError) throw sequenceStepsError;
            if (socialPostsError) throw socialPostsError;
            if (userQuotasError) throw userQuotasError;

            state.emailTemplates = emailTemplates || [];
            state.sequences = sequences || [];
            state.sequence_steps = sequenceSteps || [];
            state.socialPosts = socialPosts || [];
            state.user_quotas = userQuotas || [];

            renderContent(); // This will render the correct view based on the URL hash
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

        // Show the correct view based on state.currentView
        if (state.currentView === 'email-templates') {
            if (templatesSequencesView) templatesSequencesView.classList.remove('hidden');
            if (listHeader) listHeader.textContent = 'Email Templates';
            if (createNewItemBtn) createNewItemBtn.textContent = 'Create New Template';
            if (importItemBtn) importItemBtn.classList.add('hidden');
            if (deleteSelectedItemBtn) deleteSelectedItemBtn.textContent = 'Delete Selected Template';
            if (downloadSequenceTemplateBtn) downloadSequenceTemplateBtn.classList.add('hidden');
            renderTemplateList();
            renderTemplateDetails();
        } else if (state.currentView === 'sequences') {
            if (templatesSequencesView) templatesSequencesView.classList.remove('hidden');
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
            renderSocialPostsList();
        }

        // Update active nav links
        if (navEmailTemplates) navEmailTemplates.classList.toggle('active', state.currentView === 'email-templates');
        if (navSequences) navSequences.classList.toggle('active', state.currentView === 'sequences');
        if (navSocialHub) navSocialHub.classList.toggle('active', state.currentView === 'social-posts');
    };

    // --- Email Templates Render Functions (EXISTING) ---
    const renderTemplateList = () => {
        if (!itemList) return;
        itemList.innerHTML = "";

        const myTemplates = state.emailTemplates.filter(t => t.user_id === state.currentUser.id);
        const sharedTemplates = state.emailTemplates.filter(t => t.user_id !== state.currentUser.id);

        myTemplates.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        sharedTemplates.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        const createListItem = (template) => {
            const item = document.createElement("div");
            item.className = "list-item";
            item.dataset.id = template.id;
            item.dataset.type = 'template';

            if (template.user_id !== state.currentUser.id) {
                const creator = state.user_quotas.find(u => u && u.user_id === template.user_id);
                const creatorName = creator ? creator.full_name : 'an unknown user';
                item.innerHTML = `
                    <div class="template-list-item-content">
                        <span class="template-name">${template.name}</span>
                        <small class="template-creator">Shared by ${creatorName}</small>
                    </div>
                `;
            } else {
                item.innerHTML = `
                    <div class="template-list-item-content">
                         <span class="template-name">${template.name}</span>
                    </div>
                `;
            }

            if (template.id === state.selectedTemplateId) item.classList.add("selected");
            itemList.appendChild(item);
        };

        myTemplates.forEach(createListItem);

        if (sharedTemplates.length > 0 && myTemplates.length > 0) {
            const separator = document.createElement("div");
            separator.className = "list-separator";
            separator.textContent = "Shared Templates";
            itemList.appendChild(separator);
        }
        sharedTemplates.forEach(createListItem);

        if (state.emailTemplates.length === 0) {
            itemList.innerHTML = '<div class="list-item-placeholder">No templates created yet.</div>';
        }
    };

    const renderTemplateDetails = () => {
        state.selectedSequenceId = null;
        state.isEditingSequenceDetails = false;
        state.editingStepId = null;

        const template = state.emailTemplates.find(t => t.id === state.selectedTemplateId);

        if (template) {
            dynamicDetailsPanel.innerHTML = `
                <h3>Template Details</h3>
                <div id="template-form-container">
                    <input type="hidden" id="template-id" value="${template.id}">
                    <label for="template-name">Template Name:</label><input type="text" id="template-name" value="${template.name || ''}" required>
                    <label for="template-subject">Subject:</label><input type="text" id="template-subject" value="${template.subject || ''}">
                    <label for="template-body">Email Body:</label>
                    <div class="merge-fields-buttons">
                        <button type="button" class="btn-secondary" data-field="[FirstName]">First Name</button>
                        <button type="button" class="btn-secondary" data-field="[LastName]">Last Name</button>
                        <button type="button" class="btn-secondary" data-field="[AccountName]">Account Name</button>
                    </div>
                    <textarea id="template-body" rows="10">${template.body || ''}</textarea>
                    <div class="form-buttons">
                        <button id="save-template-btn" class="btn-primary">Save Template</button>
                        <button id="delete-template-btn" class="btn-danger">Delete Template</button>
                    </div>
                </div>
            `;
            setupTemplateDetailsListeners();
        } else {
            dynamicDetailsPanel.innerHTML = `
                <h3>New Template</h3>
                <div id="template-form-container">
                    <input type="hidden" id="template-id" value="">
                    <label for="template-name">Template Name:</label><input type="text" id="template-name" value="" required>
                    <label for="template-subject">Subject:</label><input type="text" id="template-subject" value="">
                    <label for="template-body">Email Body:</label>
                    <div class="merge-fields-buttons">
                        <button type="button" class="btn-secondary" data-field="[FirstName]">First Name</button>
                        <button type="button" class="btn-secondary" data-field="[LastName]">Last Name</button>
                        <button type="button" class="btn-secondary" data-field="[AccountName]">Account Name</button>
                    </div>
                    <textarea id="template-body" rows="10"></textarea>
                    <div class="form-buttons">
                        <button id="save-template-btn" class="btn-primary">Save Template</button>
                        <button id="delete-template-btn" class="btn-danger hidden">Delete Template</button>
                    </div>
                </div>
            `;
            setupTemplateDetailsListeners();
            const newTemplateNameInput = dynamicDetailsPanel.querySelector('#template-name');
            if (newTemplateNameInput) newTemplateNameInput.focus();
        }
    };

    function setupTemplateDetailsListeners() {
        const saveBtn = dynamicDetailsPanel.querySelector('#save-template-btn');
        const deleteBtn = dynamicDetailsPanel.querySelector('#delete-template-btn');
        const mergeFieldButtons = dynamicDetailsPanel.querySelectorAll('.merge-fields-buttons button');

        if (saveBtn) saveBtn.addEventListener('click', handleSaveTemplate);
        if (deleteBtn) deleteBtn.addEventListener('click', handleDeleteTemplate);
        mergeFieldButtons.forEach(button => {
            button.addEventListener('click', handleMergeFieldClick);
        });
    }

    async function handleSaveTemplate() {
        const id = dynamicDetailsPanel.querySelector('#template-id')?.value;
        const name = dynamicDetailsPanel.querySelector('#template-name')?.value.trim();
        const subject = dynamicDetailsPanel.querySelector('#template-subject')?.value.trim();
        const body = dynamicDetailsPanel.querySelector('#template-body')?.value;

        if (!name) {
            alert('Template name is required.');
            return;
        }

        const templateData = { name, subject, body, user_id: state.currentUser.id };
        let error = null;

        if (id) {
            const { error: updateError } = await supabase.from('email_templates').update(templateData).eq('id', id);
            error = updateError;
        } else {
            const { data: newTemplate, error: insertError } = await supabase.from('email_templates').insert([templateData]).select();
            error = insertError;
            if (!error && newTemplate && newTemplate.length > 0) {
                state.selectedTemplateId = newTemplate[0].id;
            }
        }

        if (error) {
            alert("Error saving template: " + error.message);
        } else {
            alert("Template saved successfully!");
            await loadAllData();
        }
    }

    async function handleDeleteTemplate() {
        if (!state.selectedTemplateId) return;
        showModal("Confirm Deletion", "Are you sure you want to delete this template?", async () => {
            const { error } = await supabase.from('email_templates').delete().eq('id', state.selectedTemplateId);
            if (error) {
                alert("Error deleting template: " + error.message);
            } else {
                alert("Template deleted successfully.");
                state.selectedTemplateId = null;
                await loadAllData();
            }
            hideModal();
        });
    }

    function handleMergeFieldClick(e) {
        const field = e.target.dataset.field;
        const textarea = dynamicDetailsPanel.querySelector('#template-body') || document.getElementById('modal-template-body');
        if (textarea) {
            const startPos = textarea.selectionStart;
            const endPos = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, startPos) + field + textarea.value.substring(endPos);
            textarea.setSelectionRange(startPos + field.length, startPos + field.length);
        }
    }

    // --- Sequences Render Functions (EXISTING) ---
    const renderSequenceList = () => {
        if (!itemList) return;
        itemList.innerHTML = "";
        state.sequences
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .forEach((seq) => {
                const i = document.createElement("div");
                i.className = "list-item";
                i.textContent = seq.name;
                i.dataset.id = seq.id;
                i.dataset.type = 'sequence';
                if (seq.id === state.selectedSequenceId) i.classList.add("selected");
                itemList.appendChild(i);
            });
        if (state.sequences.length === 0) {
            itemList.innerHTML = '<div class="list-item-placeholder">No marketing sequences created yet.</div>';
        }
    };

    const renderSequenceSteps = () => {
        const sequenceStepsTableBody = dynamicDetailsPanel.querySelector('#sequence-steps-table-body');
        if (!sequenceStepsTableBody) return;
        sequenceStepsTableBody.innerHTML = "";

        let stepsToRender = [];

        if (state.selectedSequenceId) {
            stepsToRender = state.sequence_steps.filter(s => s.marketing_sequence_id === state.selectedSequenceId);
        } else {
            return;
        }

        stepsToRender
            .sort((a, b) => a.step_number - b.step_number)
            .forEach((step, index) => {
                const row = sequenceStepsTableBody.insertRow();
                row.dataset.id = step.id;
                row.dataset.sequenceType = 'marketing';

                const isEditingThisStep = (state.editingStepId === step.id);
                const isFirstStep = (index === 0);
                const isLastStep = (index === stepsToRender.length - 1);
                const isDisabled = false;

                row.innerHTML = `
                    <td>${step.step_number}</td>
                    <td>
                        ${isEditingThisStep && !isDisabled ?
                            `<input type="text" class="form-control edit-step-type" value="${step.type || ''}">` :
                            (step.type || '')
                        }
                    </td>
                    <td>
                        ${isEditingThisStep && !isDisabled ?
                            `<input type="text" class="form-control edit-step-subject" value="${step.subject || ''}">` :
                            (step.subject || '')
                        }
                    </td>
                    <td>
                        ${isEditingThisStep && !isDisabled ?
                            `<textarea class="form-control edit-step-message">${step.message || ''}</textarea>` :
                            (step.message || '')
                        }
                    </td>
                    <td>
                        ${isEditingThisStep && !isDisabled ?
                            `<input type="number" class="form-control edit-step-delay" value="${step.delay_days || 0}" min="0">` :
                            (step.delay_days || 0)
                        }
                    </td>
                    <td>
                        <div class="actions-cell-content" style="display: flex; justify-content: space-around; align-items: center; gap: 5px;">
                            ${isEditingThisStep && !isDisabled ?
                                `
                                <button class="btn btn-sm btn-success save-step-btn" data-id="${step.id}">Save</button>
                                <button class="btn btn-sm btn-secondary cancel-step-btn" data-id="${step.id}">Cancel</button>
                                ` :
                                `
                                <div style="display: flex; flex-direction: column; gap: 5px;">
                                    <button class="btn btn-sm btn-secondary move-up-btn ${isFirstStep || isDisabled ? 'hidden' : ''}" data-id="${step.id}"><i class="fas fa-arrow-up"></i></button>
                                    <button class="btn btn-sm btn-secondary move-down-btn ${isLastStep || isDisabled ? 'hidden' : ''}" data-id="${step.id}"><i class="fas fa-arrow-down"></i></button>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 5px;">
                                    <button class="btn btn-sm btn-primary edit-step-btn ${isDisabled ? 'hidden' : ''}" data-id="${step.id}">Edit</button>
                                    <button class="btn btn-sm btn-danger delete-step-btn ${isDisabled ? 'hidden' : ''}" data-id="${step.id}">Delete</button>
                                </div>
                                `
                            }
                        </div>
                    </td>
                `;
            });
    };

    const renderSequenceDetails = () => {
        state.selectedTemplateId = null;

        const sequence = state.sequences.find(s => s.id === state.selectedSequenceId);

        if (sequence) {
            dynamicDetailsPanel.innerHTML = `
                <h3>Marketing Sequence Details</h3>
                <hr>
                <div class="form-grid">
                    <div class="full-span-grid-item">
                        <label for="sequence-name-input">Name:</label>
                        <input type="text" id="sequence-name-input" class="form-control" value="${sequence.name || ''}" ${state.isEditingSequenceDetails ? '' : 'disabled'}>
                        <input type="hidden" id="sequence-id" value="${sequence.id}">
                    </div>
                    <div class="full-span-grid-item">
                        <label for="sequence-description-textarea">Description:</label>
                        <textarea id="sequence-description-textarea" class="form-control" ${state.isEditingSequenceDetails ? '' : 'disabled'}>${sequence.description || ''}</textarea>
                    </div>
                </div>
                <div class="form-buttons">
                    <button id="edit-sequence-details-btn" class="btn-secondary ${state.isEditingSequenceDetails ? 'hidden' : ''}">Edit Details</button>
                    <button id="save-sequence-details-btn" class="btn-primary ${state.isEditingSequenceDetails ? '' : 'hidden'}">Save Changes</button>
                    <button id="cancel-edit-sequence-btn" class="btn-secondary ${state.isEditingSequenceDetails ? '' : 'hidden'}">Cancel</button>
                </div>

                <hr>

                <h3>Sequence Steps</h3>
                <div class="table-container">
                    <table id="sequence-steps-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Type</th>
                                <th>Subject</th>
                                <th>Message</th>
                                <th>Delay (Days)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="sequence-steps-table-body"></tbody>
                    </table>
                </div>
                <div class="action-buttons">
                    <button id="add-step-btn" class="btn-secondary ${state.isEditingSequenceDetails || state.editingStepId ? 'hidden' : ''}">Add Step</button>
                </div>
            `;
            setupSequenceDetailsListeners();
            renderSequenceSteps();
        } else {
            dynamicDetailsPanel.innerHTML = `<h3>Sequence Details</h3><p>Select a marketing sequence from the list or click 'New Marketing Sequence' to get started.</p>`;
        }
    };
    
    // --- NEW: Social Hub Render Functions ---

    /**
     * Renders the list of approved social posts in the Social Hub view.
     */
    const renderSocialPostsList = () => {
        if (!socialPostList) return;
        socialPostList.innerHTML = ""; // Clear existing posts

        const postsToRender = state.socialPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (postsToRender.length === 0) {
            socialPostList.innerHTML = '<div class="list-item-placeholder">No approved social posts yet. Create one above!</div>';
            return;
        }

        postsToRender.forEach(post => {
            const author = state.user_quotas.find(u => u.user_id === post.user_id);
            const authorName = author ? author.full_name : 'Unknown User';

            const postElement = document.createElement('div');
            postElement.className = 'social-post-card'; // You can style this class
            postElement.dataset.id = post.id;
            
            postElement.innerHTML = `
                <div class="post-header">
                    <div class="post-author">By ${authorName}</div>
                    <div class="post-timestamp">${formatDate(post.created_at)}</div>
                </div>
                <h4 class="post-title">${post.title || 'Untitled Post'}</h4>
                <p class="post-copy">${post.approved_copy || ''}</p>
                <div class="post-footer">
                    <a href="${post.link_url}" target="_blank" class="btn-secondary">View Link</a>
                    ${post.user_id === state.currentUser.id ? `<button class="btn-danger delete-post-btn" data-id="${post.id}">Delete</button>` : ''}
                </div>
            `;
            socialPostList.appendChild(postElement);
        });
    };

    /**
     * Handles creating a new social post from the form.
     * @param {Event} e The form submission event.
     */
    async function handleCreateSocialPost(e) {
        e.preventDefault();
        const formFeedback = document.getElementById('form-feedback');
        const submitButton = e.target.querySelector('button[type="submit"]');

        const postData = {
            title: document.getElementById('post-title').value.trim(),
            link_url: document.getElementById('post-link').value.trim(),
            approved_copy: document.getElementById('post-copy').value.trim(),
            is_dynamic_link: document.getElementById('is-dynamic-link').checked,
            user_id: state.currentUser.id
        };

        if (!postData.title || !postData.link_url || !postData.approved_copy) {
            alert('Please fill out all fields for the social post.');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';

        try {
            const { error } = await supabase.from('social_posts').insert([postData]);
            if (error) throw error;

            formFeedback.textContent = 'Post added successfully!';
            formFeedback.style.color = 'var(--success-color)';
            formFeedback.style.display = 'block';

            createSocialPostForm.reset();
            await loadAllData(); // Refresh the list of posts

        } catch (error) {
            console.error('Error creating social post:', error);
            formFeedback.textContent = `Error: ${error.message}`;
            formFeedback.style.color = 'var(--error-color)';
            formFeedback.style.display = 'block';
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Add Post to Social Hub';
            setTimeout(() => { formFeedback.style.display = 'none'; }, 5000);
        }
    }

    /**
     * Handles deleting a social post.
     * @param {Event} e The click event.
     */
    async function handleDeleteSocialPost(e) {
        const deleteButton = e.target.closest('.delete-post-btn');
        if (!deleteButton) return;
        
        const postId = deleteButton.dataset.id;
        showModal("Confirm Deletion", "Are you sure you want to delete this social post?", async () => {
            const { error } = await supabase.from('social_posts').delete().eq('id', postId);
            if (error) {
                alert(`Error deleting post: ${error.message}`);
            } else {
                await loadAllData(); // Refresh list
            }
            hideModal();
        });
    }

    // --- (EXISTING EVENT LISTENERS & HANDLERS FOR SEQUENCES) ---
    // ... all of the handle... functions for sequences from the original file ...
    // ... setupSequenceDetailsListeners, handleEditSequenceDetails, etc. ...


    // --- Unified Click Handlers (EXISTING) ---
    // ... handleItemListClick, handleCreateNewItem, etc. ...

    // --- Event Listener Setup ---
    function setupPageEventListeners() {
        setupModalListeners();

        if (themeToggleBtn) themeToggleBtn.addEventListener("click", cycleTheme);

        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                await supabase.auth.signOut();
                // onAuthStateChange will handle UI update
            });
        }
        
        // --- Auth Form Listeners (if on page) ---
        if (authForm) {
            authForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const email = authEmailInput.value.trim();
                const password = authPasswordInput.value.trim();
                clearErrorMessage();

                let error;
                if (isLoginMode) {
                    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                    error = signInError;
                } else {
                    const confirmPassword = authConfirmPasswordInput.value.trim();
                    if (password !== confirmPassword) {
                        showTemporaryMessage("Passwords do not match.", false);
                        return;
                    }
                    const { error: signUpError } = await supabase.auth.signUp({ email, password });
                    error = signUpError;
                    if (!error) {
                        showTemporaryMessage("Account created! Please check your email for a confirmation link.", true);
                        isLoginMode = true;
                        updateAuthUI();
                        return;
                    }
                }

                if (error) {
                    showTemporaryMessage(error.message, false);
                }
            });
        }
        if(authToggleLink) authToggleLink.addEventListener("click", (e) => { e.preventDefault(); isLoginMode = !isLoginMode; updateAuthUI(); });
        if(forgotPasswordLink) forgotPasswordLink.addEventListener('click', (e) => { /* existing password reset logic */ });
        
        // --- Marketing Hub Navigation ---
        if (navEmailTemplates) navEmailTemplates.addEventListener('click', (e) => { e.preventDefault(); state.currentView = 'email-templates'; window.location.hash = 'email-templates'; renderContent(); });
        if (navSequences) navSequences.addEventListener('click', (e) => { e.preventDefault(); state.currentView = 'sequences'; window.location.hash = 'sequences'; renderContent(); });
        if (navSocialHub) navSocialHub.addEventListener('click', (e) => { e.preventDefault(); state.currentView = 'social-posts'; window.location.hash = 'social-posts'; renderContent(); });
        
        // --- Listeners for Templates & Sequences View ---
        if (itemList) itemList.addEventListener('click', handleItemListClick);
        if (createNewItemBtn) createNewItemBtn.addEventListener('click', handleCreateNewItem);
        if (importItemBtn) importItemBtn.addEventListener('click', handleImportItem);
        if (deleteSelectedItemBtn) deleteSelectedItemBtn.addEventListener('click', handleDeleteSelectedItem);
        if (downloadSequenceTemplateBtn) downloadSequenceTemplateBtn.addEventListener('click', downloadCsvTemplate);
        if (itemCsvInput) itemCsvInput.addEventListener("change", async (e) => { /* existing CSV import logic */ });
        
        // --- NEW: Listeners for Social Hub View ---
        if (createSocialPostForm) createSocialPostForm.addEventListener('submit', handleCreateSocialPost);
        if (socialPostList) socialPostList.addEventListener('click', handleDeleteSocialPost);

    }

    // --- App Initialization ---
    async function initializePage() {
        // <<< NEW: Call svgLoader here at the start
        svgLoader();

        const savedTheme = localStorage.getItem('crm-theme') || 'dark';
        const savedThemeIndex = themes.indexOf(savedTheme);
        currentThemeIndex = savedThemeIndex !== -1 ? savedThemeIndex : 0;
        applyTheme(themes[currentThemeIndex]);

        setupPageEventListeners(); // Setup all event listeners

        supabase.auth.onAuthStateChange(async (_event, session) => {
            const userJustLoggedIn = session && !state.currentUser;
            const userJustLoggedOut = !session && state.currentUser;

            if (userJustLoggedIn) {
                state.currentUser = session.user;
                if (authContainer) authContainer.classList.add('hidden');
                if (marketingHubContainer) marketingHubContainer.classList.remove('hidden');
                
                await setupUserMenuAndAuth(supabase, state);
                
                const hash = window.location.hash.substring(1);
                if (hash === 'sequences') {
                    state.currentView = 'sequences';
                } else if (hash === 'social-posts') {
                    state.currentView = 'social-posts';
                } else {
                    state.currentView = 'email-templates';
                }
                
                await loadAllData();

            } else if (userJustLoggedOut) {
                state.currentUser = null;
                if (authContainer) authContainer.classList.remove('hidden');
                if (marketingHubContainer) marketingHubContainer.classList.add('hidden');
                isLoginMode = true;
                updateAuthUI();
            }
        });

        // Initial session check
        const { data: { session } } = await supabase.auth.getSession();
        if(!session) {
            // No user, ensure login form is visible
            if (authContainer) authContainer.classList.remove('hidden');
            if (marketingHubContainer) marketingHubContainer.classList.add('hidden');
            isLoginMode = true;
            updateAuthUI();
        }
    }

    initializePage();
});