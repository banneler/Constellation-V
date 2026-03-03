# Constellation CRM — Stabilization Plan

This document outlines step-by-step plans to fix four architectural bugs/risks in the codebase. **No code has been executed yet.** Await approval before implementing.

---

## 1. The Modal ID Collision Trap (Cognito)

### Confirmed Issue

- **`cognito.html`** (lines 75–136): The `#modal-body` div contains a hardcoded Action Center layout with IDs such as `#outreach-subject`, `#send-email-btn`, `#contact-selector`, `#outreach-body`, `#refine-suggestion-btn`, `#custom-prompt-input`, `#custom-outreach-subject`, `#custom-outreach-body`, `#copy-custom-btn`, `#send-email-custom-btn`, `#log-interaction-notes`, `#log-interaction-btn`, `#create-task-desc`, `#create-task-due-date`, `#create-task-btn`, `#no-contact-message`, `#relevance-score-display`, `#relevance-fire-emoji`.
- **`js/cognito.js`** (lines 291–346): `showActionCenter` builds a `modalBodyContent` string with the same IDs and passes it to `showModal('Action Center', modalBodyContent, ...)`.
- **`showModal`** (in `shared_constants.js` line 306): `modalBody.innerHTML = bodyHtml` replaces the content of `#modal-body` with the injected HTML.

So at runtime the hardcoded HTML is replaced, but the duplication is confusing and fragile. If any code path shows the modal without the full injection, or if `showModal` is called with different content, the old markup could cause ID collisions or unexpected behavior.

### Plan

1. **Remove hardcoded Action Center content from `cognito.html`**
   - Keep the modal structure:
     - `#modal-backdrop`
     - `#modal-content`
     - `#modal-title`
     - `#modal-body` (empty)
     - `#modal-actions`
   - **Delete** lines 76–136 (the entire `<div class="action-center-content">` through its closing `</div>` and everything inside `#modal-body`).
   - Replace with an empty `<div id="modal-body"></div>` so the modal body is a placeholder.

2. **Verify `cognito.js`**
   - Keep the current behavior: `showActionCenter` calls `showModal('Action Center', modalBodyContent, ...)` with the full `modalBodyContent` string.
   - No changes needed here; the JS is already the single source of truth for the Action Center content.

3. **Optional: add a comment**
   - In `cognito.html`, add a comment above `#modal-body` such as:  
     `<!-- Modal body is populated by JS (showActionCenter in cognito.js) -->`

### Files to Modify

| File | Action |
|------|--------|
| `cognito.html` | Remove lines 76–136; replace with empty `#modal-body` (and optional comment) |

---

## 2. Silent Failures in AI Edge Functions (Cognito)

### Confirmed Issue

- **`generateOutreachCopy`** (lines 373–386): On error, the `catch` block returns `{ subject: ..., body: "..." }` with a fallback body that includes `[Could not generate AI suggestion. Please write your message here.]`. The app continues and shows the modal with this text.
- **`generateCustomOutreachCopy`** (lines 388–402): `catch` returns `{ subject: ..., body: "..." }` with `[Failed to generate custom AI suggestion: ${error.message}]`. Same behavior.

In both cases, the user sees an error message in the email draft and can still send it, which is not acceptable.

### Plan

1. **Add `toast-container` to `cognito.html`**
   - Cognito does not currently have a toast container. Add one before the closing `</body>` tag (e.g. after the modal, before the theme script):
   ```html
   <div id="toast-container" class="toast-container" aria-live="polite"></div>
   ```
   - Use the same structure as other pages (e.g. `deals.html` line 43).

2. **Import `showToast` in `cognito.js`**
   - Add `showToast` to the imports from `shared_constants.js` (line 2).

3. **Change `generateOutreachCopy` and `generateCustomOutreachCopy`**
   - On error, do **not** return a fallback object.
   - Instead: **throw** (or return a sentinel) so the caller can treat it as failure.
   - Option A: `throw error` in the catch block.
   - Option B: Return `null` and have the caller check for it.

4. **Update `showActionCenter`**
   - After `await generateOutreachCopy(...)`:
     - If the result is `null` or an error is thrown:
       - Call `showToast('AI Generation Failed', 'error')` (or equivalent).
       - Call `setCardLoadingState(sourceCard, false)`.
       - `return` without calling `showModal()`.
   - For `generateCustomOutreachCopy` (inside the `generateCustomBtn` click handler):
     - If the result is `null` or an error is thrown:
       - Call `showToast('AI Generation Failed', 'error')`.
       - Restore `generateCustomBtn` text and disabled state.
       - Clear `customOutreachSubjectInput` and `customOutreachBodyTextarea` or show placeholder text.
       - Do **not** show the custom suggestion output.

### Recommended Implementation

**Option A – Return `null` on failure (recommended)**

- In `generateOutreachCopy` and `generateCustomOutreachCopy`, the `catch` block should:
  - `console.error(...)` (keep existing logging).
  - `return null` (no fallback object).
- In `showActionCenter`:
  - `const initialOutreachCopy = await generateOutreachCopy(...);`
  - `if (!initialOutreachCopy) { showToast('AI Generation Failed', 'error'); setCardLoadingState(sourceCard, false); return; }`
- In the `generateCustomBtn` handler:
  - `const customOutreachCopy = await generateCustomOutreachCopy(...);`
  - `if (!customOutreachCopy) { showToast('AI Generation Failed', 'error'); /* restore button state */; return; }`

### Files to Modify

| File | Action |
|------|--------|
| `cognito.html` | Add `#toast-container` div |
| `js/cognito.js` | Import `showToast`; change `generateOutreachCopy` and `generateCustomOutreachCopy` to return `null` on error; add null checks and `showToast` in `showActionCenter` and in the custom suggestion handler |

---

## 3. Fragile Proposal Checkbox Targeting (Proposals)

### Confirmed Issue

- **`proposals.html`** (`#module-list`): Custom modules have checkbox IDs (`toggle-cover-letter`, `toggle-custom-text`, `toggle-impact-roi`, `toggle-references`, `toggle-pricing`, `toggle-custom-pdf`, `toggle-usac`). Stock PDFs (e.g. Title Page, Why GPC?, About GPC, DIA, SIA, etc.) have no IDs or `data-*` attributes on their checkboxes.
- **`enterprise-proposals-embed.js`**:
  - `getPayload()` (lines 396–408): Iterates `#module-list li`, uses `li.getAttribute('data-filename')` and `li.querySelector('.slide-toggle')`. This works because each `li` has one checkbox.
  - `toggleSection()` (lines 166–174): Uses `getElementById(checkboxId)` for custom modules.
  - `loadProject()` (lines 354–365): Uses `li[data-filename="${m.filename}"]` to find the `li`, then `li.querySelector('input.slide-toggle')` for the checkbox.

The current logic is mostly robust because `data-filename` on the `li` identifies each module. However, stock checkboxes have no explicit identifier, and relying on `.slide-toggle` alone could be brittle if structure changes. Adding `data-pdf-id` (or equivalent) to every checkbox makes selection deterministic and future-proof.

### Plan

1. **Add `data-pdf-id` to every checkbox in `proposals.html`**
   - Use the same value as `data-filename` on the parent `li`.
   - Map each `li` to its checkbox ID or `data-pdf-id`:

   | Module | `data-filename` (on li) | Add to checkbox |
   |--------|-------------------------|-----------------|
   | Title Page | `01_Title_Page.pdf` | `data-pdf-id="01_Title_Page.pdf"` |
   | Cover Letter | `CUSTOM_COVER` | Already has `id="toggle-cover-letter"`; add `data-pdf-id="CUSTOM_COVER"` |
   | Custom Page | `CUSTOM_TEXT` | Add `data-pdf-id="CUSTOM_TEXT"` |
   | Impact & ROI | `CUSTOM_IMPACT` | Add `data-pdf-id="CUSTOM_IMPACT"` |
   | Why GPC? | `02_Why_GPC.pdf` | `data-pdf-id="02_Why_GPC.pdf"` |
   | About GPC | `03_About_GPC.pdf` | `data-pdf-id="03_About_GPC.pdf"` |
   | References | `CUSTOM_REFERENCES` | Add `data-pdf-id="CUSTOM_REFERENCES"` |
   | Proposed Pricing | `CUSTOM_PRICING` | Add `data-pdf-id="CUSTOM_PRICING"` |
   | 24-Hour NOC | `04_NOC_Monitoring.pdf` | `data-pdf-id="04_NOC_Monitoring.pdf"` |
   | DIA | `05_DIA.pdf` | `data-pdf-id="05_DIA.pdf"` |
   | SIA | `06_SIA.pdf` | `data-pdf-id="06_SIA.pdf"` |
   | Boys Town Case Study | `07_CaseStudy.pdf` | `data-pdf-id="07_CaseStudy.pdf"` |
   | SPIN ID Number | `08_SPIN.pdf` | `data-pdf-id="08_SPIN.pdf"` |
   | Project Implementation | `09_Project.pdf` | `data-pdf-id="09_Project.pdf"` |
   | Senior Leadership | `10_Leadership.pdf` | `data-pdf-id="10_Leadership.pdf"` |
   | Escalation Process | `11_Escalation.pdf` | `data-pdf-id="11_Escalation.pdf"` |
   | Upload Custom PDF | `CUSTOM_PDF` | Add `data-pdf-id="CUSTOM_PDF"` |
   | USAC Original RFP | `USAC_RFP` | Add `data-pdf-id="USAC_RFP"` |

2. **Update `enterprise-proposals-embed.js` to use `data-pdf-id`**
   - **`getPayload()`** (lines 397–401): Change from:
     ```js
     document.querySelectorAll('#module-list li').forEach(li => {
         if (li.querySelector('.slide-toggle').checked) activeSlides.push(li.getAttribute('data-filename'));
     });
     ```
     To:
     ```js
     document.querySelectorAll('#module-list li').forEach(li => {
         const pdfId = li.getAttribute('data-filename');
         const cb = li.querySelector(`input[data-pdf-id="${pdfId}"]`);
         if (cb && cb.checked) activeSlides.push(pdfId);
     });
     ```
   - **`saveProject()`** (lines 297–304): Change from:
     ```js
     const cb = li.querySelector('input.slide-toggle');
     projectData.modules.push({ filename: li.getAttribute('data-filename'), checked: cb ? cb.checked : false });
     ```
     To:
     ```js
     const pdfId = li.getAttribute('data-filename');
     const cb = li.querySelector(`input[data-pdf-id="${pdfId}"]`);
     projectData.modules.push({ filename: pdfId, checked: cb ? cb.checked : false });
     ```
   - **`loadProject()`** (lines 354–365): Change from:
     ```js
     const li = document.querySelector(`#module-list li[data-filename="${m.filename}"]`);
     const cb = li.querySelector('input.slide-toggle');
     if (cb) cb.checked = !!m.checked;
     ```
     To:
     ```js
     const li = document.querySelector(`#module-list li[data-filename="${m.filename}"]`);
     const cb = li ? li.querySelector(`input[data-pdf-id="${m.filename}"]`) : null;
     if (cb) cb.checked = !!m.checked;
     ```

3. **Keep `toggleSection` as-is**
   - It uses `getElementById` for custom modules; those checkboxes already have IDs. Adding `data-pdf-id` does not conflict.

### Files to Modify

| File | Action |
|------|--------|
| `proposals.html` | Add `data-pdf-id="<value>"` to every checkbox in `#module-list`, matching the parent `li`’s `data-filename` |
| `js/enterprise-proposals-embed.js` | Update `getPayload`, `saveProject`, and `loadProject` to select checkboxes via `data-pdf-id` |

---

## 4. The TomSelect Desync Loop (Cognito)

### Confirmed Issue

- **`initCognitoTomSelects`** (lines 84–104) and the modal contact TomSelect (lines 281–291) both use:
  ```js
  onChange: function (value) {
      this.setValue(value || '', true);
      this.input?.dispatchEvent(new Event('change', { bubbles: true }));
  }
  ```

- The filter listeners (lines 684–696) are attached to the native `<select>` elements (`filterTriggerTypeSelect`, `filterRelevanceSelect`, `filterAccountSelect`) and read `e.target.value` to update state and call `renderAlerts()`.
- TomSelect wraps the native select; when the user changes the value, TomSelect’s `onChange` runs. The manual `dispatchEvent` on `this.input` may be intended to trigger listeners that expect a native `change` event. If any listener updates the TomSelect instance (e.g. via `setValue`), that could trigger `onChange` again and create a loop.

### Plan

1. **Determine if the dispatch is needed**
   - TomSelect usually syncs the underlying select and may fire a native `change` event. The manual dispatch might be redundant.
   - Test: Temporarily remove the `dispatchEvent` line and verify that:
     - Filter changes (Trigger Type, Relevance, Account) still update the alert list.
     - The Clear Filters button still works.
     - The modal contact selector still triggers `handleContactChange` when the user selects a contact.

2. **If the dispatch is required**
   - Add a guard to avoid re-entrancy:
     - Use a module-level flag, e.g. `let _tomSelectChangeInProgress = false`.
     - In `onChange`: if `_tomSelectChangeInProgress` is true, return immediately.
     - Set `_tomSelectChangeInProgress = true` at the start of `onChange`.
     - After `setValue` and `dispatchEvent`, set `_tomSelectChangeInProgress = false` (in a `setTimeout(..., 0)` or `requestAnimationFrame` to ensure it runs after any synchronous handlers).

3. **If the dispatch is not required**
   - Remove the `dispatchEvent` line from both `initCognitoTomSelects` and the modal contact TomSelect config.
   - Simplify `onChange` to:
     ```js
     onChange: function (value) {
         this.setValue(value || '', true);
     }
     ```
   - Or remove the `onChange` override entirely if TomSelect’s default behavior is sufficient.

4. **Recommended order**
   - First try removing the dispatch and run manual tests.
   - If filters or contact selection break, restore the dispatch and add the re-entrancy guard.

### Files to Modify

| File | Action |
|------|--------|
| `js/cognito.js` | In `initCognitoTomSelects` (lines 96–99) and in the modal TomSelect config (lines 285–288): either remove `dispatchEvent` or add a re-entrancy guard around it |

---

## Summary

| # | Issue | Primary Files | Risk Level |
|---|-------|---------------|-------------|
| 1 | Modal ID Collision | `cognito.html` | Medium (maintainability) |
| 2 | Silent AI Failures | `cognito.html`, `js/cognito.js` | High (user could send error text) |
| 3 | Proposal Checkbox Targeting | `proposals.html`, `js/enterprise-proposals-embed.js` | Medium (fragility on reorder) |
| 4 | TomSelect Desync Loop | `js/cognito.js` | Low–Medium (potential loop) |

---

**Awaiting approval before implementing any changes.**
