# Spec: Login (seed + session)

**Intent:** `log_in`  
**Route:** `index.html`  
**Manifest:** `testing_manifest.json`

## Agent-readable flow

1. Open `/index.html` (or `/`).
2. Ensure the page is in **Login** mode: primary button reads "Login", not "Sign Up". If it shows Sign Up, click the toggle link "Have an account? Login".
3. Fill `#auth-email` with the test user email (`E2E_EMAIL`).
4. Fill `#auth-password` with `E2E_PASSWORD`.
5. Click `#auth-submit-btn` (submit login).

## Success criteria

- Browser navigates to `command-center.html` within ~45s.
- No visible error in `#auth-error` (if still on index, failure reason is usually there).

## Selectors (primary)

- `#auth-email`, `#auth-password`, `#auth-submit-btn`, `#auth-error`

## Notes for Guardian

- Loader on inner pages uses `#global-loader-overlay` (see `shared_constants.js`); login page has no global loader overlay like CRM pages.
