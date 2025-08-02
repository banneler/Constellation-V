// js/auth.js
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

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verified') === 'true') {
        showTemporaryMessage("Email successfully verified! Please log in.", true);
        // Clean the URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

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
                // ** THIS IS THE CHANGED PART **
                showTemporaryMessage("Account created! Please check your email for a verification link.", true);
                setTimeout(() => {
                    isLoginMode = true;
                    updateAuthUI();
                }, 3000); // Give user time to read the message before flipping to login
            }
        }
        if (isLoginMode) { // Only re-enable if we didn't start the timeout
             authSubmitBtn.disabled = false;
             authSubmitBtn.textContent = "Login";
        }
    });

    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        const resetPasswordBody = `
            <p>Enter your email to receive a password reset link.</p>
            <input type="email" id="reset-email" placeholder="Email" required>
        `;
        showModal('Reset Password', resetPasswordBody, async () => {
            const email = document.getElementById('reset-email').value;
            // ... your existing password reset logic
        });
    });

    // --- AUTH STATE CHANGE HANDLER ---
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session) {
            window.location.href = "command-center.html";
        }
    });

    updateAuthUI();
});
