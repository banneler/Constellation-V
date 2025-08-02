// js/auth.js (REVISED)
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    showModal,
    hideModal,
    setupModalListeners,
    loadSVGs
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await loadSVGs();
    setupModalListeners();

    // --- DOM SELECTORS ---
    const authContainer = document.getElementById("auth-container");
    const authForm = document.getElementById("auth-form");
    const authError = document.getElementById("auth-error");
    const authEmailInput = document.getElementById("auth-email");
    const authPasswordInput = document.getElementById("auth-password");
    const authSubmitBtn = document.getElementById("auth-submit-btn");
    const authToggleLink = document.getElementById("auth-toggle-link");
    const forgotPasswordLink = document.getElementById("forgot-password-link");
    const signupFields = document.getElementById("signup-fields");
    const authConfirmPasswordInput = document.getElementById("auth-confirm-password");

    let isLoginMode = true;

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
        signupFields.classList.toggle('hidden', isLoginMode);
        forgotPasswordLink.classList.toggle('hidden', !isLoginMode);
        authConfirmPasswordInput.required = !isLoginMode;
    };

    // --- EVENT LISTENERS ---
    authToggleLink.addEventListener("click", (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        updateAuthUI();
    });

    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = isLoginMode ? "Logging in..." : "Signing up...";
        clearErrorMessage();

        const email = authEmailInput.value.trim();
        const password = authPasswordInput.value.trim();

        if (isLoginMode) {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                showTemporaryMessage(error.message, false);
            }
            // SUCCESS: onAuthStateChange will handle the redirect. No redirect code needed here.
        } else {
            const confirmPassword = authConfirmPasswordInput.value.trim();
            if (password !== confirmPassword) {
                showTemporaryMessage("Passwords do not match.", false);
                authSubmitBtn.disabled = false;
                authSubmitBtn.textContent = "Sign Up";
                return;
            }
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) {
                showTemporaryMessage(error.message, false);
            } else if (data.user && data.user.identities && data.user.identities.length === 0) {
                 showTemporaryMessage("This email is already in use. Please try logging in.", false);
            } else {
                showModal("Check Your Email", "A verification link has been sent to your email address. Please verify your account before logging in.", () => {
                    isLoginMode = true;
                    updateAuthUI();
                    hideModal();
                }, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            }
        }
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = isLoginMode ? "Login" : "Sign Up";
    });

    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        // (Your existing forgot password logic using showModal is good)
    });

    // --- SINGLE SOURCE OF TRUTH FOR AUTH STATE ---
    supabase.auth.onAuthStateChange((event, session) => {
        console.log(`Auth event: ${event}`);
        if (event === "SIGNED_IN" && session) {
            // This is the ONLY place we redirect from.
            window.location.href = "command-center.html";
        }
    });

    // Initial UI setup
    updateAuthUI();
});
