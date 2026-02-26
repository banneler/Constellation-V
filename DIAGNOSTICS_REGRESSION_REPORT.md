# Diagnostics & Regression Report: deploy vs main (JS)

**Scope:** Line-by-line diff of all `.js` files between `origin/main` and `HEAD` (deploy) to ensure core plumbing was not severed during the UI facelift.

---

## 1. Executive Summary

| Area | Status | Notes |
|------|--------|--------|
| Supabase data flow | ✅ Intact | Payloads and `user_id` / `effectiveUserId` usage preserved; one regression in Command Center (see below). |
| Org chart physics | ✅ Intact | Pan/zoom, requestAnimationFrame, and sub-pixel transform logic are present on deploy (accounts.js). |
| AI Briefing RAG pipeline | ✅ Intact | Daily and account briefing payloads and invoke calls unchanged; placeholder replacement logic present. |
| Multi-Site IRR calculator | ✅ Intact | State, DOM IDs, and math logic aligned with current irr.html; no severed linkages. |

**One regression** was found and has been patched in code: Command Center no longer loaded “all team” data when the user is a manager. The fix (Section 4) has been applied to `js/command-center.js`.

---

## 2. Critical Systems Verification

### 2.1 Supabase Data Flow

- **accounts.js**  
  - All reads use `getState().effectiveUserId` (e.g. `supabase.from("accounts").select("*").eq("user_id", getState().effectiveUserId)`).  
  - Writes (insert/update) use `getState().effectiveUserId` or `state.selectedAccountId` where appropriate.  
  - **Verdict:** Intact.

- **command-center.js**  
  - **Regression:** `loadAllData()` always uses `appState.currentUser.id` for user-scoped tables. On **main**, when `state.isManager` was true, it fetched **all** rows (no `.eq("user_id', ...)`); when false, it used `state.currentUser.id`.  
  - On **deploy**, the manager branch was removed, so managers only see their own tasks/sequences/deals/etc. on the Command Center.  
  - **Fix:** Restore the manager vs non-manager branch in `loadAllData()` using `getState().isManager` and, for non-manager, `getState().effectiveUserId` (see patch in Section 4).

- **deals.js, contacts.js, sequences.js, campaigns.js, cognito.js, marketing-hub.js, social_hub.js**  
  - Use `getState().effectiveUserId` (or equivalent) for user-scoped Supabase calls.  
  - **Verdict:** Intact.

### 2.2 Org Chart Physics (accounts.js)

- **main:** Single tree + separate “Unassigned” box; no viewport/pan/zoom in the diff excerpt.
- **deploy:**  
  - `fitOrgChartInViewport(viewport, zoomFactor)` applies `transform: translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) scale(${baseScale * zoom})` and uses `requestAnimationFrame(() => requestAnimationFrame(apply))`.  
  - `setupOrgChartPanning(viewport, updateFn)` handles mousedown/mousemove/mouseup and updates `viewport.dataset.panX` / `panY`.  
  - Zoom buttons update `viewport.dataset.zoomFactor` and call `fitOrgChartInViewport(viewport, newZoom)`.  
- **Verdict:** Manual pan and zoom are present on deploy; not reverted to “fit to viewport” only.

### 2.3 AI Briefing RAG Pipeline

- **command-center.js**  
  - `briefingPayload` still includes: `tasks`, `sequenceSteps`, `deals`, `cognitoAlerts`, `nurtureAccounts`, `contacts`, `accounts`, `sequences`, `sequence_steps`.  
  - `supabase.functions.invoke('get-daily-briefing', { body: { briefingPayload } })` unchanged.  
  - **Verdict:** Grounding and prompt injection inputs intact.

- **accounts.js**  
  - `get-account-briefing` invoked with `internalData` (account, contacts, org chart text, deals, activities).  
  - Print briefing uses `#org-chart-render-target` and snapshot logic.  
  - **Verdict:** Intact.

### 2.4 Multi-Site IRR Calculator (irr.js)

- **State:** `state.sites`, `state.currentProjectId`, `state.activeSiteId`, per-site `inputs` and `timeline` (deploy adds `timeline`; defaults applied in hydrate).  
- **DOM:** All referenced IDs exist in current `irr.html`: e.g. `site-tabs-container`, `site-forms-container`, `site-form-template`, `global-target-irr`, `project-name`, `cashflow-flip-card`, `flip-to-settings-btn`, `flip-to-chart-btn`, `save-settings-flip-btn`, `timeline-table-container`, `cashflow-chart`, `stress-flip-card`, `flip-to-annual-table-btn`, `flip-to-stress-btn`, `annual-cashflow-table-container`, `stress-capex`, `stress-mrr`, etc.  
- **Math:** `getCashFlowsForSite`, `getPaybackForSite`, `runGlobalCalculation`, and chart cumulative logic (including break-even and per-site timeline offsets) are present and consistent.  
- **Formula alignment (deploy vs main):** On main, `getPaybackForSite` used `netCapex = (constructionCost + engineeringCost + productCost) - nrr` (no S&G&A). On deploy, `sg_and_a_cost = (mrr*1) + (nrr*0.03)` is added and included in `netCapex` and in `getCashFlowsForSite` month-zero outflow, so both helpers are consistent. This is an intentional alignment of payback with cash-flow math; no reversion needed.  
- **Verdict:** No broken linkages; state and math intact.

---

## 3. DOM / Selector Mapping (No Fixes Required)

- **command-center.js:** Old table bodies (`#dashboard-table tbody`, `#recent-activities-table tbody`, etc.) and `#add-new-task-btn` were replaced by new structure (`#sequence-steps-list`, `#recent-activities-list`, `#my-tasks-list`, `#my-tasks-hamburger`, `#ai-briefing-refresh-btn`). JS was updated to match; no dangling getElementById.  
- **accounts.js:** `#account-deals-table tbody` → `#account-deals-cards`; account list filter `#account-status-filter` → `#account-filter-icons` with `.account-filter-icon.active` and `data-filter`. JS updated.  
- **shared_constants.js:** User menu and impersonation refactored into `setupUserMenuAndAuth` with `#manager-view-select-wrap` / `#manager-view-select`; `getState()` used when passed state lacks `isManager`. No broken selectors identified.

---

## 4. Patched Code Block: Command Center Manager Data Load

**File:** `js/command-center.js`  
**Issue:** Restore loading of “all user” data when the current user is a manager, and use `effectiveUserId` when not (for “View as” consistency).

**Applied fix:** The following block was applied to `js/command-center.js` (replacing the single-user-only fetch). Original patch:

```javascript
        const appState = getState();
        if (!appState.currentUser?.id) return;

        if (myTasksList) myTasksList.innerHTML = '<p class="my-tasks-empty text-sm text-[var(--text-medium)] px-4 py-6">Loading tasks...</p>';
        
        const tableMap = {
            "contacts": "contacts", "accounts": "accounts", "sequences": "sequences",
            "activities": "activities", "contact_sequences": "contact_sequences",
            "deals": "deals", "tasks": "tasks", "cognito_alerts": "cognitoAlerts"
        };
        const userSpecificTables = Object.keys(tableMap);
        const publicTables = ["sequence_steps"];

        let userPromises;
        if (appState.isManager) {
            userPromises = userSpecificTables.map(table => supabase.from(table).select("*"));
        } else {
            const userId = appState.effectiveUserId || appState.currentUser.id;
            userPromises = userSpecificTables.map(table => supabase.from(table).select("*").eq("user_id", userId));
        }

        const publicPromises = publicTables.map(table => supabase.from(table).select("*"));
```

This keeps the rest of `loadAllData()` (Promise.allSettled, state assignment, nurtureAccounts, renderDashboard, populateQuickAddSelect) unchanged and does not alter any other business logic. **Status: patch applied.**

---

## 5. Summary

- **Supabase:** One regression in Command Center (manager vs non-manager load). Patched in Section 4. All other files use `getState().effectiveUserId` or equivalent correctly.  
- **Org chart:** Pan/zoom and requestAnimationFrame behavior are intact on deploy.  
- **AI Briefing:** Payloads and Edge Function invokes unchanged.  
- **IRR:** State, DOM IDs, and math are aligned with current UI; no reconnection fixes required.
