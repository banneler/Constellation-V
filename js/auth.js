// auth.js
console.log("auth.js script started parsing.");
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    showModal,
    hideModal,
    setupModalListeners
    // Removed direct import of modal DOM elements like modalBackdrop, modalTitle, etc.
    // These are now handled internally by showModal and hideModal.
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOMContentLoaded fired for auth.js.");

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- Ensure modal listeners are set up FIRST ---
    // These are global listeners for backdrop click and escape key
    setupModalListeners();

    // --- DOM Element Selectors (Auth specific) ---
    const authContainer = document.getElementById("auth-container");
    const authForm = document.getElementById("auth-form");
    const authError = document.getElementById("auth-error");
    const authEmailInput = document.getElementById("auth-email");
    const authPasswordInput = document.getElementById("auth-password");
    const authSubmitBtn = document.getElementById("auth-submit-btn");
    const authToggleLink = document.getElementById("auth-toggle-link");
    const forgotPasswordLink = document.getElementById("forgot-password-link");
    const returnToLoginLink = document.getElementById("return-to-login-link");

    // Selectors for signup-specific fields container and inputs
    const signupFields = document.getElementById("signup-fields");
    const authConfirmPasswordInput = document.getElementById("auth-confirm-password");

    console.log("Auth Container:", authContainer);
    console.log("Auth Form:", authForm);
    console.log("Auth Email Input:", authEmailInput);
    console.log("Auth Password Input:", authPasswordInput);
    console.log("Auth Confirm Password Input:", authConfirmPasswordInput);
    console.log("Signup Fields Container:", signupFields);
    console.log("Auth Submit Button:", authSubmitBtn);
    console.log("Auth Toggle Link:", authToggleLink);
    console.log("Forgot Password Link:", forgotPasswordLink);
    console.log("Return to Login Link:", returnToLoginLink);

    let isLoginMode = true; // Initial state is login

    const showTemporaryMessage = (message, isSuccess = true) => {
        authError.textContent = message;
        authError.style.color = isSuccess ? 'var(--success-color)' : 'var(--error-color)';
        authError.style.display = 'block';
    };

    const clearErrorMessage = () => {
        authError.textContent = "";
        authError.style.display = 'none';
    };

    const updateAuthUI = () => {
        authSubmitBtn.textContent = isLoginMode ? "Login" : "Sign Up";
        authToggleLink.textContent = isLoginMode ? "Need an account? Sign Up" : "Have an account? Login";
        clearErrorMessage();
        authForm.reset();

        if (signupFields) {
            if (isLoginMode) {
                signupFields.classList.add('hidden');
                authConfirmPasswordInput.removeAttribute('required');
            } else {
                signupFields.classList.remove('hidden');
                authConfirmPasswordInput.setAttribute('required', 'required');
            }
        }

        if (forgotPasswordLink) {
            if (isLoginMode) {
                forgotPasswordLink.classList.remove('hidden');
            } else {
                forgotPasswordLink.classList.add('hidden');
            }
        }

        if (returnToLoginLink) {
            if (isLoginMode) {
                returnToLoginLink.classList.add('hidden');
            } else {
                returnToLoginLink.classList.remove('hidden');
            }
        }
    };


    // --- Event Listener Setup (Auth specific) ---
    authToggleLink.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("Auth Toggle link clicked.");
        isLoginMode = !isLoginMode;
        updateAuthUI();
    });

    if (returnToLoginLink) {
        returnToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Return to Login link clicked.");
            isLoginMode = true;
            updateAuthUI();
        });
    }

    console.log("Attaching form submit listener to:", authForm);
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("Auth form submitted! Mode:", isLoginMode ? "Login" : "Sign Up");
        const email = authEmailInput.value.trim();
        const password = authPasswordInput.value.trim();
        clearErrorMessage();

        console.log("Attempting auth with email:", email);

        let error;
        if (isLoginMode) {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            error = signInError;
            if (!error) {
                console.log("Login successful. Redirecting to command-center.html.");
                authForm.reset();
                window.location.href = "command-center.html";
            }
        } else {
            const confirmPassword = authConfirmPasswordInput.value.trim();

            if (password !== confirmPassword) {
                authError.textContent = "Passwords do not match.";
                authError.style.color = 'var(--error-color)';
                authError.style.display = 'block';
                return;
            }

            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password
            });
            error = signUpError;

            if (!error) {
                console.log("Sign up successful. Displaying message and redirecting.");
                showTemporaryMessage("Account created successfully! Redirecting to login...", true);
                authForm.reset();

                setTimeout(() => {
                    isLoginMode = true;
                    updateAuthUI();
                }, 2000);
            }
        }

        if (error) {
            console.error("Supabase Auth Error:", error.message);
            showTemporaryMessage(error.message, false);
        }
    });

    // Refactored Forgot password link functionality to use showModal
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();

            const resetPasswordBody = `
                <p>Enter your email to receive a password reset link.</p>
                <input type="email" id="reset-email" placeholder="Email" required>
            `;

            showModal(
                'Reset Password',
                resetPasswordBody,
                async () => { // onConfirm callback for "Send Reset Link"
                    const resetEmailInput = document.getElementById('reset-email');
                    const resetEmail = resetEmailInput ? resetEmailInput.value.trim() : '';

                    if (!resetEmail) {
                        // Re-render modal content with error, but do NOT close the modal
                        showModal(
                            'Reset Password',
                            `<p style="color: var(--error-color);">Please enter your email.</p>${resetPasswordBody}`,
                            // Pass back the same confirm callback to keep functionality
                            async () => { // Nested onConfirm
                                const nestedEmailInput = document.getElementById('reset-email');
                                const nestedEmail = nestedEmailInput ? nestedEmailInput.value.trim() : '';
                                if (!nestedEmail) {
                                    showModal('Reset Password', `<p style="color: var(--error-color);">Please enter your email.</p>${resetPasswordBody}`, arguments.callee); // Re-call self to keep prompt
                                    return false;
                                }
                                // Proceed with sending email
                                const { error: nestedError } = await supabase.auth.resetPasswordForEmail(nestedEmail, {
                                    redirectTo: 'https://banneler.github.io/Constellation-IV/reset-password.html',
                                });
                                if (nestedError) {
                                    showModal('Reset Password', `<p style="color: var(--error-color);">Error: ${nestedError.message}</p>${resetPasswordBody}`, arguments.callee);
                                    return false;
                                } else {
                                    showModal(
                                        'Reset Password',
                                        `<p style="color: var(--success-color);">Password reset link sent to ${nestedEmail}. Check your inbox!</p>`,
                                        null, // No confirm action needed
                                        false, // No cancel button
                                        `<button id="modal-ok-btn" class="btn-primary">Close</button>`
                                    );
                                    return true; // Close the intermediate modal
                                }
                            },
                            true, // Show cancel button
                            `<button id="modal-confirm-btn" class="btn-primary">Send Reset Link</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
                        );
                        return false; // Keep initial modal open
                    }

                    const currentConfirmBtn = document.getElementById('modal-confirm-btn');
                    if (currentConfirmBtn) {
                        currentConfirmBtn.disabled = true;
                        currentConfirmBtn.textContent = 'Sending...';
                    }

                    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                        redirectTo: 'https://banneler.github.io/Constellation-IV/reset-password.html',
                    });

                    if (error) {
                        showModal(
                            'Reset Password',
                            `<p style="color: var(--error-color);">Error: ${error.message}</p>${resetPasswordBody}`,
                            arguments.callee, // Use arguments.callee to refer to this anonymous function
                            true,
                            `<button id="modal-confirm-btn" class="btn-primary">Send Reset Link</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
                        );
                        return false; // Keep modal open on error
                    } else {
                        showModal(
                            'Reset Password',
                            `<p style="color: var(--success-color);">Password reset link sent to ${resetEmail}. Check your inbox!</p>`,
                            null, // No confirm action needed
                            false, // No cancel button
                            `<button id="modal-ok-btn" class="btn-primary">Close</button>`
                        );
                        return true; // Close the current modal (confirm button was clicked successfully)
                    }
                },
                true, // showCancel = true for the initial modal
                `<button id="modal-confirm-btn" class="btn-primary">Send Reset Link</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`, // customActionsHtml
                () => { // onCancel callback for the initial modal
                    return true; // Allow modal to close on cancel
                }
            );
        });
    }

    // --- App Initialization (Auth Page) ---
    // This runs once when the page loads to set the initial UI state and handle redirects
    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth event fired on auth page:", event);
        if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
            console.log("User is signed in or has an initial session. Redirecting.");
            window.location.href = "command-center.html";
        }
    });

    // Initial UI setup when the script loads
    updateAuthUI();
});
