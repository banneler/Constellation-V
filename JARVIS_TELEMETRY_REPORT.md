# JARVIS Telemetry Sweep — Constellation CRM

Hierarchical map of major UI containers and action nodes for Iron Man / Jarvis-style AR overlay wireframes. Use container selectors for glowing wireframes; map nodes underneath for micro-tooltip glass pills.

---

## command-center.html

* **Container:** `.ai-briefing-card`
  * **Macro Text:** "Your daily RAG-powered intelligence briefing. This engine synthesizes your tasks and deals."
  * **Nodes:**
    * `anchor: '#ai-briefing-refresh-btn'` | `Hover Text: Click to regenerate the briefing with live data.`

* **Container:** `#my-tasks-card`
  * **Macro Text:** "Your task list and quick-add. Stay on top of follow-ups and linked contacts or accounts."
  * **Nodes:**
    * `anchor: '#my-tasks-hamburger'` | `Hover Text: Open the quick-add form to create a new task.`
    * `anchor: '#quick-add-task-form button[type="submit"]'` | `Hover Text: Submit to add the task and link it to a contact or account.`

* **Container:** `.dashboard-column-left .section-card` (parent of `#sequence-steps-list`)
  * **Macro Text:** "Sequence steps due or upcoming. Your outreach pipeline at a glance."
  * **Nodes:**
    * `anchor: '#sequence-toggle-due'` | `Hover Text: Show steps that are due now.`
    * `anchor: '#sequence-toggle-upcoming'` | `Hover Text: Show upcoming sequence steps.`

* **Container:** `.dashboard-column-right .section-card` (parent of `#recent-activities-list`)
  * **Macro Text:** "Down here you see your recent activities. This view should seem familiar as it tracks your historical footprint."
  * **Nodes:**
    * `anchor: '.btn-log-sf'` | `Hover Text: Look for the cloud icon to instantly log this to Salesforce.`

---

## deals.html

* **Container:** `.deals-top-section`
  * **Macro Text:** "Deal view controls and key metrics. Toggle between your deals and your team's, and between list and board."
  * **Nodes:**
    * `anchor: '#view-my-deals-btn'` | `Hover Text: Show only your deals.`
    * `anchor: '#view-all-deals-btn'` | `Hover Text: Show your team's deals.`
    * `anchor: '#list-view-btn'` | `Hover Text: Switch to list view.`
    * `anchor: '#board-view-btn'` | `Hover Text: Switch to Kanban board view.`

* **Container:** `.deals-metrics-container`
  * **Macro Text:** "Pipeline metrics: commit, best case, funnel, ARPU, and closed won."
  * **Nodes:**
    * (Metric cards are display-only; no action nodes.)

* **Container:** `.section-card` (parent of `#list-view-container` and `#kanban-board-view`)
  * **Macro Text:** "Deal pipeline. Filter by committed, stage, and close month; edit in list or drag on the board."
  * **Nodes:**
    * `anchor: '#close-month-prev'` | `Hover Text: Previous close-month filter.`
    * `anchor: '#close-month-next'` | `Hover Text: Next close-month filter.`
    * `anchor: '#deals-filters-reset'` | `Hover Text: Reset all pipeline filters.`
    * `anchor: '#show-closed-lost'` | `Hover Text: Toggle visibility of closed-lost deals.`

* **Container:** `.deals-charts-section`
  * **Macro Text:** "Deal insights: stage distribution, 30/60/90 funnel, and pipeline by product."
  * **Nodes:**
    * (Charts are display-only; no action nodes.)

---

## contacts.html

* **Container:** `.contact-picker-panel`
  * **Macro Text:** "Contact list. Search, sort, and use the toolbar to add, import, or export contacts."
  * **Nodes:**
    * `anchor: '#sort-first-last-btn'` | `Hover Text: Sort contacts by first name.`
    * `anchor: '#sort-last-first-btn'` | `Hover Text: Sort contacts by last name.`
    * `anchor: '#add-contact-btn'` | `Hover Text: Add a new contact.`
    * `anchor: '#import-contact-screenshot-btn'` | `Hover Text: Import a contact from a screenshot.`
    * `anchor: '#bulk-import-contacts-btn'` | `Hover Text: Bulk import contacts from CSV.`
    * `anchor: '#bulk-export-contacts-btn'` | `Hover Text: Export contacts to CSV.`
    * `anchor: '#take-picture-btn'` | `Hover Text: Take a picture (e.g. signature).`

* **Container:** `.contact-details-form-card`
  * **Macro Text:** "Contact details form. Edit fields and link to ZoomInfo or Salesforce."
  * **Nodes:**
    * `anchor: '#zoominfo-contact-btn'` | `Hover Text: Search this contact in ZoomInfo.`
    * `anchor: 'form#contact-form button[type="submit"]'` | `Hover Text: Save contact changes.`
    * `anchor: '#delete-contact-btn'` | `Hover Text: Delete this contact.`

* **Container:** `.sequence-status-card`
  * **Macro Text:** "Sequence status and enrollment. Assign sequences or complete and remove."
  * **Nodes:**
    * `anchor: '#assign-sequence-select'` | `Hover Text: Assign the contact to a sequence.`
    * `anchor: '#complete-sequence-btn'` | `Hover Text: Mark the sequence as complete.`
    * `anchor: '#remove-from-sequence-btn'` | `Hover Text: Remove the contact from the sequence.`

* **Container:** `.ai-assistant-card`
  * **Macro Text:** "AI compose and activity insight. Generate emails or summarize recent activity."
  * **Nodes:**
    * `anchor: '#ai-activity-insight-btn'` | `Hover Text: Synthesize recent activity into a quick insight.`
    * `anchor: '#ai-clear-insight-btn'` | `Hover Text: Clear the insight view.`
    * `anchor: '#open-email-client-btn'` | `Hover Text: Open the draft in your email client.`
    * `anchor: '#ai-regenerate-email-btn'` | `Hover Text: Regenerate the email draft.`
    * `anchor: '#ai-new-email-btn'` | `Hover Text: Start a new email draft.`

* **Container:** `.contact-activities-card`
  * **Macro Text:** "Recent activities for this contact. Log activities or add tasks."
  * **Nodes:**
    * `anchor: '#log-activity-btn'` | `Hover Text: Log an activity.`
    * `anchor: '#add-task-contact-btn'` | `Hover Text: Add a task for this contact.`
    * `anchor: '.btn-log-sf'` | `Hover Text: Log this activity to Salesforce.`

* **Container:** `.logged-emails-card`
  * **Macro Text:** "Logged emails for this contact."
  * **Nodes:**
    * (List items may open email view modal; no dedicated header buttons.)

---

## accounts.html

* **Container:** `.account-picker-panel`
  * **Macro Text:** "Account list. Search and filter by hot, deals, customer, or prospect."
  * **Nodes:**
    * `anchor: '.account-filter-icon[data-filter="all"]'` | `Hover Text: Show all accounts.`
    * `anchor: '.account-filter-icon[data-filter="hot"]'` | `Hover Text: Show hot accounts.`
    * `anchor: '.account-filter-icon[data-filter="with_deals"]'` | `Hover Text: Show accounts with open deals.`
    * `anchor: '.account-filter-icon[data-filter="customer"]'` | `Hover Text: Show customers.`
    * `anchor: '.account-filter-icon[data-filter="prospect"]'` | `Hover Text: Show prospects.`
    * `anchor: '#add-account-btn'` | `Hover Text: Add a new account.`
    * `anchor: '#bulk-import-accounts-btn'` | `Hover Text: Bulk import accounts from CSV.`
    * `anchor: '#bulk-export-accounts-btn'` | `Hover Text: Export accounts to CSV.`

* **Container:** `.account-details-form-card`
  * **Macro Text:** "Account details. Edit fields, link to ZoomInfo and Salesforce, or generate an AI briefing."
  * **Nodes:**
    * `anchor: '#zoominfo-account-btn'` | `Hover Text: Open this account in ZoomInfo.`
    * `anchor: '#salesforce-account-btn'` | `Hover Text: Open this account in Salesforce.`
    * `anchor: '#ai-briefing-btn'` | `Hover Text: Generate an AI account briefing.`
    * `anchor: '#sf-locator-edit-btn'` | `Hover Text: Edit Salesforce ID.`
    * `anchor: '#zoominfo-locator-edit-btn'` | `Hover Text: Edit ZoomInfo company ID.`
    * `anchor: 'form#account-form button[type="submit"]'` | `Hover Text: Save account changes.`
    * `anchor: '#delete-account-btn'` | `Hover Text: Delete this account.`
    * `anchor: '#account-is-customer'` | `Hover Text: Toggle customer status.`

* **Container:** `.account-deals-card`
  * **Macro Text:** "Current deals for this account."
  * **Nodes:**
    * `anchor: '#add-deal-btn'` | `Hover Text: Create a new deal for this account.`

* **Container:** `.account-contacts-card`
  * **Macro Text:** "Associated contacts. Switch between list and org chart view."
  * **Nodes:**
    * `anchor: '#contact-list-btn'` | `Hover Text: Show contacts as a list.`
    * `anchor: '#contact-org-chart-btn'` | `Hover Text: Show contacts in org chart view.`
    * `anchor: '#org-chart-maximize-btn'` | `Hover Text: Expand org chart in a modal.`

* **Container:** `.account-activities-card`
  * **Macro Text:** "Related activities for this account."
  * **Nodes:**
    * `anchor: '#add-task-account-btn'` | `Hover Text: Add a task for this account.`
    * `anchor: '.btn-log-sf'` | `Hover Text: Log this activity to Salesforce.`

---

## irr.html

* **Container:** `.section-card` (main IRR card containing `#global-results-container` and `#site-forms-container`)
  * **Macro Text:** "Multi-site IRR calculator. Set target IRR, add sites, and see global and per-site results."
  * **Nodes:**
    * `anchor: '#new-project-btn'` | `Hover Text: Start a new project (discards current).`
    * `anchor: '#load-project-btn'` | `Hover Text: Load a saved project.`
    * `anchor: '#save-project-btn'` | `Hover Text: Save the current project.`
    * `anchor: '#add-site-btn'` | `Hover Text: Add a new site to the project.`
    * `anchor: '#print-report-btn'` | `Hover Text: Print the report.`
    * `anchor: '#export-csv-btn'` | `Hover Text: Export to CSV.`
    * `anchor: '#global-target-irr'` | `Hover Text: Set the global target IRR percentage.`
    * `anchor: '#tab-scroll-left'` | `Hover Text: Scroll site tabs left.`
    * `anchor: '#tab-scroll-right'` | `Hover Text: Scroll site tabs right.`
    * `anchor: '.delete-site-btn'` | `Hover Text: Remove this site from the project.`

* **Container:** `#cashflow-flip-card` (flip-card front/back)
  * **Macro Text:** "Cash flow projection and per-site timeline settings. Flip to adjust construction and billing start months."
  * **Nodes:**
    * `anchor: '#flip-to-settings-btn'` | `Hover Text: Flip to advanced timeline settings.`
    * `anchor: '#flip-to-chart-btn'` | `Hover Text: Flip back to the chart.`
    * `anchor: '#save-settings-flip-btn'` | `Hover Text: Save timeline settings and view chart.`

* **Container:** `#stress-flip-card` (stress / annual table)
  * **Macro Text:** "Stress test and annual cash flow table. Adjust CapEx and MRR stress or view the annual table."
  * **Nodes:**
    * `anchor: '#flip-to-annual-table-btn'` | `Hover Text: Flip to annual cash flow table.`
    * `anchor: '#flip-to-stress-btn'` | `Hover Text: Flip back to stress test.`
    * `anchor: '#stress-capex'` | `Hover Text: CapEx stress slider (±20%).`
    * `anchor: '#stress-mrr'` | `Hover Text: MRR stress slider (±20%).`
    * `anchor: '#stress-reset-btn'` | `Hover Text: Reset stress sliders to zero.`

---

## campaigns.html

* **Container:** `.campaign-picker-panel`
  * **Macro Text:** "Campaign list. Active and past campaigns for selection."
  * **Nodes:**
    * (Campaign rows are clickable; no dedicated header buttons.)

* **Container:** `#campaign-tools-card`
  * **Macro Text:** "Create or manage campaigns. Flip to manage email templates."
  * **Nodes:**
    * `anchor: '#campaign-tools-flip-btn'` | `Hover Text: Flip to manage templates.`
    * `anchor: '#create-campaign-confirm-yes'` | `Hover Text: Confirm and create the campaign.`
    * `anchor: '#create-campaign-confirm-cancel'` | `Hover Text: Cancel campaign creation.`
    * `anchor: '#template-form-save-btn'` | `Hover Text: Save the template.`
    * `anchor: '#template-form-cancel-btn'` | `Hover Text: Cancel template edit.`
    * `anchor: '#template-delete-yes-btn'` | `Hover Text: Confirm template deletion.`
    * `anchor: '#template-delete-cancel-btn'` | `Hover Text: Cancel template deletion.`

* **Container:** `.campaign-details-card`
  * **Macro Text:** "Campaign details and email preview. Flip to see the email template."
  * **Nodes:**
    * `anchor: '#campaign-details-back-btn'` | `Hover Text: Back to details from email preview.`
    * `anchor: '#show-email-details-btn'` | `Hover Text: Flip to view the email template.`
    * `anchor: '#delete-campaign-details-btn'` | `Hover Text: Delete this campaign.`

* **Container:** `.campaign-engine-card`
  * **Macro Text:** "Run campaign. Call blitz or guided email flow through contacts."
  * **Nodes:**
    * `anchor: '#log-call-btn'` | `Hover Text: Log call and advance to next.`
    * `anchor: '#skip-call-btn'` | `Hover Text: Skip and advance to next.`
    * `anchor: '#open-email-client-btn'` (in run campaign context) | `Hover Text: Open in email client and next.`
    * `anchor: '#skip-email-btn'` | `Hover Text: Skip email and next.`
    * `anchor: '#export-txt-btn'` | `Hover Text: Download email template as .txt.`
    * `anchor: '#export-csv-btn'` | `Hover Text: Download contacts as .csv.`

---

## marketing-hub.html

* **Container:** `#auth-container`
  * **Macro Text:** "Marketing Hub login. Sign in to access templates, sequences, and social posts."
  * **Nodes:**
    * `anchor: '#auth-submit-btn'` | `Hover Text: Submit login.`
    * `anchor: '#auth-toggle-link'` | `Hover Text: Switch to sign up.`
    * `anchor: '#forgot-password-link'` | `Hover Text: Forgot password.`

* **Container:** `#abm-center-view`
  * **Macro Text:** "ABM Command Center. Marketing ABM tasks due, upcoming, and recently completed."
  * **Nodes:**
    * (Table rows may have action buttons; no dedicated container-level nodes.)

* **Container:** `#templates-sequences-view`
  * **Macro Text:** "Email templates and sequences. Create, import, or select an item to view details."
  * **Nodes:**
    * `anchor: '#create-new-item-btn'` | `Hover Text: Create a new template or sequence.`
    * `anchor: '#import-item-btn'` | `Hover Text: Import from CSV.`
    * `anchor: '#download-sequence-template-btn'` | `Hover Text: Download sequence template.`
    * `anchor: '#delete-selected-item-btn'` | `Hover Text: Delete the selected item.`

* **Container:** `#dynamic-details-panel`
  * **Macro Text:** "Details for the selected email template or sequence."
  * **Nodes:**
    * (Dynamic content; save/delete/edit buttons rendered by JS.)

* **Container:** `#create-post-form-container`
  * **Macro Text:** "Create a shared social post for the Social Hub."
  * **Nodes:**
    * `anchor: '#submit-post-btn'` | `Hover Text: Add post to Social Hub.`

* **Container:** `.user-menu`
  * **Macro Text:** "User menu. Theme and logout."
  * **Nodes:**
    * `anchor: '#theme-toggle-btn'` | `Hover Text: Change theme.`
    * `anchor: '#logout-btn'` | `Hover Text: Log out.`

---

## admin.html

* **Container:** `#user-management-view`
  * **Macro Text:** "User management. Users table and bulk data reassignment."
  * **Nodes:**
    * `anchor: '#reassign-from-user'` | `Hover Text: Select user to reassign records from.`
    * `anchor: '#reassign-to-user'` | `Hover Text: Select user to reassign records to.`
    * `anchor: '#reassign-btn'` | `Hover Text: Run bulk reassignment.`
    * (Table action buttons for each user are dynamic.)

* **Container:** `#content-management-view`
  * **Macro Text:** "Content management. Shared email templates and marketing sequences."
  * **Nodes:**
    * `anchor: '#view-templates-btn'` | `Hover Text: View email templates.`
    * `anchor: '#view-sequences-btn'` | `Hover Text: View marketing sequences.`

* **Container:** `#analytics-view`
  * **Macro Text:** "System analytics. Charts and activity log."
  * **Nodes:**
    * `anchor: '#analytics-rep-filter'` | `Hover Text: Filter by rep.`
    * `anchor: '#analytics-date-filter'` | `Hover Text: Filter by date range.`
    * `anchor: '#view-combined-btn'` | `Hover Text: Combined chart view.`
    * `anchor: '#view-individual-btn'` | `Hover Text: Individual chart view.`
    * `anchor: '.chart-toggle-btn'` | `Hover Text: Toggle chart vs table for this metric.`

* **Container:** `#script-logs-view`
  * **Macro Text:** "Script logs. Run history for automated data scripts."
  * **Nodes:**
    * (Table is display-only.)

* **Container:** `#settings-view`
  * **Macro Text:** "System settings. Deal stages and activity types."
  * **Nodes:**
    * `anchor: '#new-deal-stage-name'` | `Hover Text: Enter new deal stage name.`
    * `anchor: '#add-deal-stage-btn'` | `Hover Text: Add deal stage.`
    * `anchor: '#new-activity-type-name'` | `Hover Text: Enter new activity type name.`
    * `anchor: '#add-activity-type-btn'` | `Hover Text: Add activity type.`

---

*End of Jarvis Telemetry Report*
