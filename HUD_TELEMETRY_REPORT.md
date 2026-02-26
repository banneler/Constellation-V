# HUD Telemetry Report

Deep telemetry sweep of Constellation CRM: core user-facing workflows, unique features, and DOM anchors for context-aware HUD tooltips. Excludes standard boilerplate (basic nav, simple text inputs) unless they trigger a unique custom function.

---

## Command Center (command-center.html)

* **Feature:** AI Daily Briefing (RAG-generated priorities)
  * **DOM Anchor:** `#ai-briefing-container`, `#ai-briefing-refresh-btn`, `#ai-briefing-placeholder`
  * **Description:** Edge function `get-daily-briefing` is invoked with tasks, sequences, deals, cognito alerts, and nurture data; results render as priority cards. Refresh button regenerates the briefing.

* **Feature:** Sequence Steps (Due vs Upcoming toggle)
  * **DOM Anchor:** `#sequence-steps-list`, `#sequence-toggle-due`, `#sequence-toggle-upcoming`
  * **Description:** Renders current sales sequence steps; user toggles between "Due" and "Upcoming" views and completes steps (email, LinkedIn, call, etc.) or revisits last step.

* **Feature:** My Tasks + Quick Add Task
  * **DOM Anchor:** `#my-tasks-card`, `#my-tasks-list`, `#my-tasks-hamburger`, `#quick-add-task-form`, `#quick-add-contact`, `#quick-add-account`, `#quick-add-description`, `#quick-add-due-date`
  * **Description:** Pending tasks list with inline quick-add form (description, contact/account link, due date). Hamburger expands/collapses quick-add; task actions (complete, edit, delete) and log-call modal are driven from list items.

* **Feature:** Recent Activities + Log to Salesforce
  * **DOM Anchor:** `#recent-activities-list`, `.btn-log-sf`
  * **Description:** Chronological activity feed; each item can have a "Log to SF" button that opens a pre-filled Salesforce Task create URL and marks the activity as logged.

---

## Deals (deals.html)

* **Feature:** List vs Board view toggle
  * **DOM Anchor:** `#list-view-container`, `#kanban-board-view`, `#list-view-btn`, `#board-view-btn`, `.deals-view-toggle`
  * **Description:** User switches between table list and Kanban board; charts section visibility is tied to view.

* **Feature:** Deals filters (Stage, Close Month, Committed, Closed Lost)
  * **DOM Anchor:** `#filter-stage-pills`, `#filter-close-month-pills`, `#filter-close-month-scroll`, `#close-month-prev`, `#close-month-next`, `#filter-committed-pills`, `#show-closed-lost`, `#deals-filters-reset`
  * **Description:** Filter pills and scroll control which deals appear in list, board, and all three charts; reset clears filters.

* **Feature:** Deals by Stage / Time / Product charts
  * **DOM Anchor:** `#deals-by-stage-chart`, `#chart-empty-message`, `#deals-by-time-chart`, `#time-chart-empty-message`, `#deals-by-product-chart`, `#product-chart-empty-message`, `.deals-charts-section`
  * **Description:** Chart.js bar (stage, time) and doughnut (product) charts with quota line annotation; empty states when no data.

* **Feature:** Kanban drag-and-drop pipeline
  * **DOM Anchor:** `#kanban-board-view`, `.kanban-column`, `.kanban-column-body`, `.kanban-card`, `.deal-card-flippable`
  * **Description:** Draggable deal cards; drop into another column updates deal stage in Supabase and re-renders. Cards are flippable for notes/edit on back.

* **Feature:** Deal list inline editing (stage, month, account, name, term, MRC, notes)
  * **DOM Anchor:** `#deals-table`, `.deal-cell-editable`, `.deal-list-stage-pill`, `.commit-deal-checkbox`, `.edit-deal-btn`
  * **Description:** Table cells are contenteditable or use selects; commit checkbox toggles `is_committed`; edit opens modal for full deal edit.

* **Feature:** Deal metrics (Commit, Best Case, Funnel, Closed Won, quota %)
  * **DOM Anchor:** `#metric-current-commit`, `#metric-best-case`, `#metric-funnel`, `#metric-closed-won`, `#commit-total-quota`, `#best-case-total-quota`, `#view-my-deals-btn`, `#view-all-deals-btn`
  * **Description:** Aggregated metrics and My/All view toggle for managers; quota percentages and ARPU in metrics.

---

## Contacts (contacts.html)

* **Feature:** Contact list + detail panel (split view)
  * **DOM Anchor:** `#contact-list`, `#contact-form`, `#contact-search`, `#contact-activities-list`
  * **Description:** Searchable list and form; selecting a contact loads details and activities; account row and sequence enrollment UI update accordingly.

* **Feature:** Assign to sequence / Remove from sequence / Complete sequence
  * **DOM Anchor:** `#assign-sequence-select`, `#remove-from-sequence-btn`, `#complete-sequence-btn`, `#sequence-enrollment-text`, `#sequence-next-step-wrapper`
  * **Description:** Dropdown to enroll contact in a sequence; buttons to remove or mark sequence complete; next step block shows current step info.

* **Feature:** AI Compose (email/insight from prompt)
  * **DOM Anchor:** `#ai-write-form`, `#ai-email-prompt`, `#ai-email-subject`, `#ai-email-body`, `#ai-generate-email-btn`, `#ai-product-pickers`, `#ai-industry-select`, `#ai-email-response`, `#ai-insight-view`, `#ai-insight-summary`, `#ai-insight-next-steps`
  * **Description:** User enters a prompt; AI generates email or account insight; product/industry pickers and response/insight panels are toggled by mode.

* **Feature:** AI Activity Insight + Clear
  * **DOM Anchor:** `#ai-activity-insight-btn`, `#ai-clear-insight-btn`, `#ai-assistant-content`, `#organic-star-indicator`, `#ai-toast-container`
  * **Description:** Synthesizes activities into insight; clear resets; star and toasts used for feedback.

* **Feature:** Contact ring chart (sequence progress)
  * **DOM Anchor:** `#ring-chart`, `#ring-chart-progress`, `#ring-chart-text`
  * **Description:** Visual progress indicator for contact’s sequence completion.

* **Feature:** Email view modal (thread/body + attachments)
  * **DOM Anchor:** `#contact-emails-list`, `#email-view-modal-backdrop`, `#email-view-close-btn`, `#email-view-subject`, `#email-view-body-content`, `#email-view-attachments-container`
  * **Description:** Clicking an email opens a modal with subject, from/to, date, body, and attachments.

* **Feature:** Log activity, Add task, Bulk import/export, ZoomInfo
  * **DOM Anchor:** `#log-activity-btn`, `#add-task-contact-btn`, `#bulk-import-contacts-btn`, `#bulk-export-contacts-btn`, `#contact-csv-input`, `#zoominfo-contact-btn`
  * **Description:** Log activity and add task open modals; bulk import/export use CSV input; ZoomInfo button opens external link.

---

## Accounts (accounts.html)

* **Feature:** Account list + filter icons (All, Hot, With Deals, Customer, Prospect)
  * **DOM Anchor:** `#account-list`, `#account-search`, `#account-filter-icons`, `.account-filter-icon.active`
  * **Description:** Search and filter icons drive which accounts appear in the list; selection loads detail panel.

* **Feature:** Org Chart (pan, zoom, sub-pixel transform)
  * **DOM Anchor:** `#contact-org-chart-view`, `#contact-list-view`, `#contact-list-btn`, `#contact-org-chart-btn`, `#org-chart-render-target`, `.org-chart-viewport`, `.org-chart-scalable`, `#org-chart-zoom-in-btn`, `#org-chart-zoom-out-btn`, `#org-chart-maximize-btn`, `#org-chart-modal-backdrop`, `#org-chart-modal-content`, `#org-chart-modal-close-btn`
  * **Description:** Toggle between list and org chart; viewport uses requestAnimationFrame, pan (mousedown/move/up), and zoom buttons; maximize opens fullscreen modal with same chart; scalable layer gets translate/scale transform.

* **Feature:** AI Account Briefing (print + org chart snapshot)
  * **DOM Anchor:** `#ai-briefing-btn`, `.ai-briefing-container`, `#org-chart-render-target`
  * **Description:** Invokes account briefing with org chart; print view includes snapshot of org chart and briefing sections.

* **Feature:** Account details form + Salesforce/ZoomInfo locators
  * **DOM Anchor:** `#account-form`, `#sf-locator-display`, `#sf-locator-input`, `#zoominfo-locator-display`, `#zoominfo-locator-input`, `#zoominfo-account-btn`, `#salesforce-account-btn`
  * **Description:** Form for account fields; inline edit for SF and ZoomInfo IDs; buttons open Salesforce/ZoomInfo in new tab.

* **Feature:** Account deals cards (flippable, notes on back)
  * **DOM Anchor:** `#account-deals-cards`, `.deal-card-flip-inner`, `.deal-card-back-edit`, `.deal-card-notes-save`
  * **Description:** Deal cards with flip-to-back for notes and edit; save persists to Supabase.

* **Feature:** Account activities, pending task reminder, add deal, add task
  * **DOM Anchor:** `#account-activities-list`, `#account-pending-task-reminder`, `#add-deal-btn`, `#add-task-account-btn`
  * **Description:** Activity list and task reminder; buttons open modals to create deal or task linked to account.

---

## IRR Calculator (irr.html)

* **Feature:** Project/site management (New, Load, Save, Add Site)
  * **DOM Anchor:** `#new-project-btn`, `#load-project-btn`, `#save-project-btn`, `#add-site-btn`, `#project-name`, `#load-project-modal-backdrop`, `#load-project-list`, `#site-tabs-container`, `#site-forms-container`, `#site-form-template`
  * **Description:** New project resets state and adds one site; load opens modal to pick saved project; save persists to Supabase; add site clones template and appends tab + form.

* **Feature:** Global target IRR dial
  * **DOM Anchor:** `#global-target-irr`, `.irr-dial-fill`
  * **Description:** Input and SVG dial show target IRR %; dial fill and color update from value.

* **Feature:** Global results (Decision, IRR, TCV, Payback, Capital Investment)
  * **DOM Anchor:** `#global-decision`, `#global-annual-irr`, `#global-tcv`, `#global-payback`, `#global-capital-investment`, `#global-error-message`
  * **Description:** Aggregated multi-site decision, IRR, TCV, payback, and capital investment; error message on invalid/global error.

* **Feature:** Cash flow flip card (Chart ↔ Timeline settings)
  * **DOM Anchor:** `#cashflow-flip-card`, `#flip-to-settings-btn`, `#flip-to-chart-btn`, `#save-settings-flip-btn`, `#timeline-table-container`, `#cashflow-chart`
  * **Description:** Flip between Chart.js cumulative cash flow chart and per-site timeline table (construction start, billing start); chart uses per-site timeline offsets.

* **Feature:** Stress test (CAPEX / MRR sliders)
  * **DOM Anchor:** `#stress-flip-card`, `#flip-to-stress-btn`, `#flip-to-annual-table-btn`, `#stress-capex`, `#stress-mrr`, `#stress-capex-value`, `#stress-mrr-value`, `#stress-reset-btn`, `#annual-cashflow-table-container`
  * **Description:** Sliders apply stress modifiers to CAPEX and MRR for sensitivity; annual table and chart reflect stressed flows; reset restores 100%.

* **Feature:** Per-site form (inputs + individual results)
  * **DOM Anchor:** `.site-form-wrapper`, `.site-name-input`, `.construction-cost-input`, `.engineering-cost-input`, `.term-input`, `.nrr-input`, `.mrr-input`, `.individual-results-container`, `.individual-decision`, `.individual-annual-irr`, `.individual-payback`
  * **Description:** Each site has inputs for costs, term, NRR, MRR; individual results show GO/NO GO, IRR, payback; state drives global calculation.

* **Feature:** Print report + Export CSV
  * **DOM Anchor:** `#print-report-btn`, `#export-csv-btn`
  * **Description:** Print builds HTML report (optional chart snapshot via snapdom); export CSV outputs project/site data.

---

## Campaigns (campaigns.html)

* **Feature:** Active vs Past campaigns + Campaign details panel
  * **DOM Anchor:** `#campaign-list-active`, `#campaign-list-past`, `#campaign-details`, `#campaign-details-content`, `#campaign-details-flippable`, `#campaign-details-email-back`
  * **Description:** Two lists and a detail panel; flippable card for email back; run campaign flow uses summary and layout.

* **Feature:** Run Campaign (Call Blitz / Guided Email)
  * **DOM Anchor:** `#run-campaign-body`, `#rc-summary`, `#rc-layout`, `#rc-contact-card`, `#rc-middle-panel`, `#rc-activities-list`, `#contact-name-call-blitz`, `#call-notes`, `#log-call-btn`, `#skip-call-btn`, `#email-to-address`, `#email-body-textarea`, `#open-email-client-btn`, `#skip-email-btn`
  * **Description:** Guided flow: contact card, call notes or email body, log/skip actions; activities list and middle panel update as user progresses.

* **Feature:** Campaign type + filters (Customer/Prospect, Starred, Industry)
  * **DOM Anchor:** `#campaign-type`, `#filter-starred-btn`, `#filter-industry`, `.customer-filter-customer.active`, `.customer-filter-prospect.active`
  * **Description:** Type and filters determine campaign audience and contact preview.

* **Feature:** Create New Campaign (templates, merge pills, preview)
  * **DOM Anchor:** `#new-campaign-form-container`, `#campaign-tools-flippable`, `#campaign-tools-card`, `#campaign-tools-flip-btn`, `#template-selector`, `#campaign-email-subject`, `#campaign-email-body`, `#create-campaign-merge-pills`, `#contact-preview-container`, `#create-campaign-submit-btn`, `#create-campaign-confirm`
  * **Description:** Flip card to form; template selector, subject/body, merge pills, and contact preview; submit and confirm create campaign.

* **Feature:** Email template manager (inline create/edit)
  * **DOM Anchor:** `#template-manager-container`, `#create-new-template-btn`, `#template-form-inline`, `#template-name`, `#template-subject`, `#template-body`, `#template-form-save-btn`, `#template-form-cancel-btn`
  * **Description:** List of templates; inline form for create/edit; save/cancel persist or discard.

---

## Sequences (sequences.html)

* **Feature:** Sequence list + details panel + steps flow
  * **DOM Anchor:** `#sequence-list`, `#sequence-details`, `#sequence-name`, `#sequence-description`, `#sequence-steps-flow`, `#sequence-steps-drop-zones-row`, `#add-step-btn`, `#sequence-step-edit-panel`, `#sequence-step-edit-form`
  * **Description:** Select sequence loads details and draggable step flow; add step and step edit panel for reorder and edit.

* **Feature:** AI Generate Sequence (goal, duration, step types, persona)
  * **DOM Anchor:** `#sequence-ai-card`, `#sequence-ai-card-collapse-btn`, `#ai-sequence-goal`, `#ai-total-duration`, `#ai-num-steps`, `#ai-step-type-pills`, `#ai-step-type-other-pill`, `#ai-persona-prompt`, `#ai-generate-sequence-btn`, `#ai-generated-sequence-preview`, `#ai-generated-sequence-form`, `#save-ai-sequence-btn`, `#cancel-ai-sequence-btn`, `#ai-generated-steps-table-body`
  * **Description:** User sets goal, duration, step count, step type pills, and persona; generate produces a preview table; user can edit steps then save as new sequence or cancel.

* **Feature:** Bulk assign contacts (filters + select all)
  * **DOM Anchor:** `#bulk-assign-btn`, `#bulk-assign-contact-list`, `#filter-title`, `#filter-company`, `#filter-industry`, `#filter-activity`, `#select-all-checkbox`
  * **Description:** Modal with contact list and filters; select all or per-row; assign enrolls selected contacts in the current sequence.

* **Feature:** Import sequence steps (CSV), Import marketing sequence, Delete sequence
  * **DOM Anchor:** `#bulk-import-sequence-steps-btn`, `#sequence-steps-csv-input`, `#import-marketing-sequence-btn`, `#delete-sequence-btn`
  * **Description:** CSV import for steps; import marketing sequence and delete sequence trigger distinct flows.

---

## Social Hub (social_hub.html)

* **Feature:** AI vs Marketing posts containers
  * **DOM Anchor:** `#ai-articles-container`, `#marketing-posts-container`
  * **Description:** Two containers for AI-curated articles and marketing posts; each card can have prepare/dismiss actions.

* **Feature:** Prepare Post modal (custom prompt, regenerate, copy, post to LinkedIn)
  * **DOM Anchor:** `#modal-backdrop`, `#modal-title`, `#modal-article-link`, `#post-text`, `#custom-prompt-input`, `#generate-custom-btn`, `#copy-text-btn`, `#post-to-linkedin-btn`, `#modal-close-btn`
  * **Description:** Modal shows article link and generated post text; user can refine with custom prompt and regenerate; copy or open LinkedIn to post.

* **Feature:** Card actions (Prepare Post, Dismiss)
  * **DOM Anchor:** `.prepare-post-btn`, `.dismiss-post-btn`
  * **Description:** Buttons on each card open prepare modal or dismiss the post (data-post-id).

---

## Cognito (cognito.html)

* **Feature:** View mode toggle (New vs Archive)
  * **DOM Anchor:** `#view-mode-toggle-btn`, `#alerts-container`, `#cognito-view`
  * **Description:** Toggle switches alert list between new and archived; alerts container is repopulated accordingly.

* **Feature:** Filters (Trigger Type, Relevance, Account)
  * **DOM Anchor:** `#filter-trigger-type`, `#filter-relevance`, `#filter-account`, `#clear-filters-btn`
  * **Description:** Dropdowns filter alerts; clear resets all filters.

* **Feature:** Alert detail modal (AI suggestion, refine, custom prompt, actions)
  * **DOM Anchor:** `#contact-selector`, `#initial-ai-suggestion-section`, `#refine-suggestion-btn`, `#outreach-subject`, `#outreach-body`, `#custom-prompt-section`, `#custom-prompt-input`, `#generate-custom-btn`, `#cancel-custom-btn`, `#custom-suggestion-output`, `#send-email-btn`, `#copy-btn`, `#log-interaction-btn`, `#create-task-btn`, `#relevance-score-display`
  * **Description:** Modal shows contact selector, initial AI suggestion, refine button, and custom prompt section; user can send email, copy, log interaction, or create task; relevance score displayed.

---

## Marketing Hub (marketing-hub.html)

* **Feature:** View tabs (ABM Center, Email Templates, Sequences, Social Posts)
  * **DOM Anchor:** `#abm-center-view`, `#templates-sequences-view`, `#social-post-view`, `a[href="#abm-center"]`, `a[href="#email-templates"]`, `a[href="#sequences"]`, `a[href="#social-posts"]`
  * **Description:** Hash-based view switching; ABM Center shows tasks; templates/sequences view shows list and dynamic details panel.

* **Feature:** ABM tasks (Due, Upcoming, Completed)
  * **DOM Anchor:** `#abm-tasks-due-table-body`, `#abm-tasks-upcoming-table-body`, `#abm-tasks-completed-table-body`
  * **Description:** Three tables for ABM sequence tasks by status; data from abm-sequences and Supabase.

* **Feature:** Dynamic details panel (templates vs sequences)
  * **DOM Anchor:** `#dynamic-details-panel`, `#template-name`, `#template-subject`, `#template-body`, `#save-template-btn`, `#sequence-name-input`, `#sequence-steps-table-body`, `#edit-sequence-details-btn`, `#add-step-btn`
  * **Description:** Selecting a template or sequence loads different inline forms; templates use subject/body; sequences use steps table and add-step; ABM sequence editor can be initialized in this panel.

* **Feature:** Item list + create/import/delete
  * **DOM Anchor:** `#item-list`, `#list-header`, `#create-new-item-btn`, `#import-item-btn`, `#item-csv-input`, `#delete-selected-item-btn`, `#download-sequence-template-btn`
  * **Description:** List shows templates or sequences; create/import/delete and download template trigger distinct flows.

* **Feature:** Create post form (Social Posts view)
  * **DOM Anchor:** `#create-post-form`, `#submit-post-btn`, `#post-title`, `#post-link`, `#post-copy`, `#is-dynamic-link`, `#form-feedback`
  * **Description:** Form to add a social post with title, link, copy, and dynamic link flag; submit persists and shows feedback.

---

## Admin (admin.html)

* **Feature:** Deal stages + Activity types (add/settings)
  * **DOM Anchor:** `#deal-stages-list`, `#activity-types-list`, `#add-deal-stage-btn`, `#add-activity-type-btn`, `#new-deal-stage-name`, `#new-activity-type-name`, `#settings-view`
  * **Description:** Lists of deal stages and activity types; add buttons open inline add; settings view contains these sections.

* **Feature:** User management table (quota, manager, exclude reporting)
  * **DOM Anchor:** `#user-management-table`, `.user-name-input`, `.user-quota-input`, `.is-manager-checkbox`, `.exclude-reporting-checkbox`
  * **Description:** Table of users with editable quota and checkboxes; changes are saved to Supabase.

* **Feature:** Reassign (from user → to user)
  * **DOM Anchor:** `#reassignment-section`, `#reassign-from-user`, `#reassign-to-user`, `#reassign-btn`
  * **Description:** Dropdowns select source and target user; reassign button moves data (e.g. deals/tasks) from one to the other.

* **Feature:** Analytics (rep filter, date filter, chart/table toggle)
  * **DOM Anchor:** `#analytics-rep-filter`, `#analytics-date-filter`, `#analytics-chart-view-toggle`, `#analytics-charts-container`, `.analytics-metric-card`, `.chart-wrapper`, `.chart-toggle-btn`, `.chart-table-view`, `#activities-metric`, `#sequences-metric`, `#campaigns-metric`, `#tasks-metric`, `#new-deals-metric`, `#closed-won-metric`
  * **Description:** Rep and date filters scope metrics and charts; container holds metric cards and chart wrappers; toggle switches chart vs table view per chart.

* **Feature:** Content management table
  * **DOM Anchor:** `#content-management-table`
  * **Description:** Table for content records; change/click handlers drive edit or state updates.

* **Feature:** Activity log + Script logs tables
  * **DOM Anchor:** `#activity-log-table`, `#script-logs-table`
  * **Description:** Read-only tables for activity and script logs.

---

## AI Admin (ai-admin.html)

* **Feature:** AI engine tabs + config editor
  * **DOM Anchor:** `#ai-engine-tabs`, `#ai-editor-form`, `#no-selection-msg`, `#save-config-btn`, `#selected-engine-name`, `#ai-technical-foundation`, `#ai-persona`, `#ai-voice`, `#ai-custom-instructions`, `#config-status-badge`, `#reset-config-btn`
  * **Description:** Tab per AI engine; selecting an engine loads technical foundation, persona, voice, and custom instructions; save and reset update or revert config (e.g. for get-daily-briefing and other Edge functions).

---

## Proposals (proposals.html)

* **Feature:** Proposals embed (enterprise iframe / bootstrap)
  * **DOM Anchor:** (Page primarily loads `enterprise-proposals-embed.js`; main DOM is injected by that script or minimal wrapper in HTML.)
  * **Description:** Proposals experience is driven by the embed script; no additional high-value CRM-specific anchors in the base HTML for HUD tooltips beyond any wrapper container the embed targets.

---

## User Guide (user-guide.html)

* **Feature:** Section nav + content pane
  * **DOM Anchor:** `#user-guide-nav`, `#user-guide-content`, `.nav-button.active`
  * **Description:** Side nav selects section; content pane renders the selected guide section (no complex workflows; informational only).

---

## Input Nodes (Buttons, Toggles, Data Inputs)

Primary action nodes and data inputs for HUD wireframe tooltips. Use these anchors to attach hover pills and to ensure input/select fields receive the appropriate highlight style (e.g. `.hud-node-lock` inner-glow).

### command-center.html
| Type | Selector | Notes |
|------|----------|--------|
| Button | `#ai-briefing-refresh-btn` | Regenerate briefing |
| Button | `#my-tasks-hamburger` | Toggle quick-add |
| Button | `#sequence-toggle-due`, `#sequence-toggle-upcoming` | Sequence view |
| Button | `form#quick-add-task-form button[type="submit"]` | Submit task |
| Button | `.btn-log-sf` | Log to Salesforce |
| Input | `#quick-add-description` | Task description |
| Select | `#quick-add-contact`, `#quick-add-account` | Link to contact/account |
| Input | `#quick-add-due-date` | Due date |

### deals.html
| Type | Selector | Notes |
|------|----------|--------|
| Button | `#list-view-btn`, `#board-view-btn` | List/board view |
| Button | `#view-my-deals-btn`, `#view-all-deals-btn` | My/team deals |
| Button | `#close-month-prev`, `#close-month-next`, `#deals-filters-reset` | Filter controls |
| Toggle | `.deals-filter-toggle`, `#show-closed-lost` | Closed lost visibility |
| Element | `.deals-filters` | Filter row (group) |
| Element | `#kanban-board-view .kanban-column:first-child .kanban-column-body .kanban-card:first-child` | Sample deal card (drag tip) |

### contacts.html
| Type | Selector | Notes |
|------|----------|--------|
| Input | `#contact-search` | Search contacts |
| Button | `#sort-first-last-btn`, `#sort-last-first-btn` | Sort order |
| Button | `#add-contact-btn`, `#import-contact-screenshot-btn`, `#bulk-import-contacts-btn`, `#bulk-export-contacts-btn`, `#take-picture-btn` | Toolbar |
| Input | `#contact-first-name`, `#contact-last-name`, `#contact-email`, `#contact-phone`, `#contact-title`, `#contact-notes` | Form fields |
| Select | `#contact-account-name`, `#assign-sequence-select` | Account, sequence |
| Button | `#zoominfo-contact-btn`, `form#contact-form button[type="submit"]`, `#delete-contact-btn` | Actions |
| Button | `#complete-sequence-btn`, `#remove-from-sequence-btn` | Sequence actions |
| Button | `#ai-activity-insight-btn`, `#ai-clear-insight-btn`, `#open-email-client-btn`, `#ai-regenerate-email-btn`, `#ai-new-email-btn` | AI assistant |
| Textarea | `#ai-email-prompt`, `#ai-email-body` | AI compose |
| Input | `#ai-email-subject` | Email subject |
| Button | `#log-activity-btn`, `#add-task-contact-btn` | Activity/task |

### accounts.html
| Type | Selector | Notes |
|------|----------|--------|
| Input | `#account-search` | Search accounts |
| Button | `.account-filter-icon[data-filter="…"]`, `#add-account-btn`, `#bulk-import-accounts-btn`, `#bulk-export-accounts-btn` | Filters, import/export |
| Input | `#sf-locator-input`, `#zoominfo-locator-input` | Salesforce/ZoomInfo IDs |
| Button | `#zoominfo-account-btn`, `#salesforce-account-btn`, `#ai-briefing-btn`, `#sf-locator-edit-btn`, `#zoominfo-locator-edit-btn` | External links, briefing |
| Input | `#account-name`, `#account-website`, `#account-address`, `#account-phone`, `#account-sites`, `#account-employees`, `#account-notes` | Form fields |
| Select | `#account-industry` | Industry |
| Input | `#account-is-customer` | Customer toggle |
| Button | `form#account-form button[type="submit"]`, `#delete-account-btn` | Save, delete |
| Button | `#add-deal-btn`, `#contact-list-btn`, `#contact-org-chart-btn`, `#org-chart-maximize-btn`, `#add-task-account-btn` | Deals, contacts, tasks |
| Button | `.btn-log-sf` | Log to Salesforce |

### irr.html
| Type | Selector | Notes |
|------|----------|--------|
| Button | `#new-project-btn`, `#load-project-btn`, `#save-project-btn`, `#add-site-btn`, `#print-report-btn`, `#export-csv-btn` | Project/site actions |
| Input | `#project-name` | Project name |
| Input | `#global-target-irr` | Target IRR % |
| Button | `#tab-scroll-left`, `#tab-scroll-right` | Tab scroll |
| Button | `#flip-to-settings-btn`, `#flip-to-chart-btn`, `#save-settings-flip-btn` | Cash flow card |
| Button | `#flip-to-annual-table-btn`, `#flip-to-stress-btn`, `#stress-reset-btn` | Stress card |
| Input | `#stress-capex`, `#stress-mrr` | Stress sliders |
| Input | `.site-name-input`, `.term-input`, `.construction-cost-input`, `.engineering-cost-input`, `.product-cost-input`, `.monthly-cost-input`, `.nrr-input`, `.mrr-input` | Per-site inputs |
| Button | `.delete-site-btn` | Remove site |

### campaigns.html, sequences.html, marketing-hub.html, admin.html, cognito.html
| Page | Type | Examples |
|------|------|----------|
| campaigns | Buttons/inputs | `#log-call-btn`, `#skip-call-btn`, `#open-email-client-btn`, `#skip-email-btn`, `#call-notes`, `#email-body-textarea`, `#template-selector`, `#campaign-email-subject`, `#campaign-email-body`, `#create-campaign-submit-btn` |
| sequences | Buttons/inputs | `#add-step-btn`, `#ai-sequence-goal`, `#ai-total-duration`, `#ai-num-steps`, `#ai-persona-prompt`, `#ai-generate-sequence-btn`, `#bulk-assign-btn`, `#filter-title`, `#filter-company`, `#sequence-steps-csv-input` |
| marketing-hub | Buttons/inputs | `#auth-email`, `#auth-password`, `#auth-submit-btn`, `#create-new-item-btn`, `#import-item-btn`, `#item-csv-input`, `#submit-post-btn`, `#post-title`, `#post-link`, `#is-dynamic-link` |
| admin | Buttons/selects | `#reassign-from-user`, `#reassign-to-user`, `#reassign-btn`, `#view-templates-btn`, `#view-sequences-btn`, `#analytics-rep-filter`, `#analytics-date-filter`, `#new-deal-stage-name`, `#add-deal-stage-btn`, `#new-activity-type-name`, `#add-activity-type-btn` |
| cognito | Buttons/selects | `#view-mode-toggle-btn`, `#filter-trigger-type`, `#filter-relevance`, `#filter-account`, `#clear-filters-btn`, `#refine-suggestion-btn`, `#outreach-subject`, `#outreach-body`, `#send-email-btn` |

---

*End of HUD Telemetry Report. Use these DOM anchors to attach context-aware tooltips in the HUD.*
