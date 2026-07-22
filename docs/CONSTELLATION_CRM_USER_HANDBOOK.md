# Constellation CRM User Handbook

## Purpose

Constellation CRM is the day-to-day operating layer for sales work. It is where reps prioritize their day, manage pipeline, work contacts and accounts, execute outreach, build business cases, prepare proposals, and turn intelligence into action.

This handbook explains the **what**, **why**, and **how** of the main Constellation CRM experience. It is written for users of the CRM, not system administrators or developers.

Admin and Marketing Hub workflows are intentionally excluded. Those areas are internal/back-end workspaces and are not part of this user handbook.

Strategic Account OS (SAOS) is also not reproduced here in full. SAOS has its own handbook because it is a deeper strategic account planning discipline. This guide explains where SAOS connects to the main CRM and when to use it.

---

## The Big Idea

Constellation is not only a system of record. It is a system of engagement.

Traditional CRMs are good at storing records: accounts, contacts, deals, tasks, and activities. Constellation is designed around the work that happens between those records:

- What should I do today?
- Which deal is real enough to commit?
- Who should I contact next?
- What intelligence should I act on?
- Which account deserves deeper strategy?
- How do I move from activity to progress?

The goal is not to add more data entry. The goal is to reduce scattered work and create a single operating rhythm for sales execution.

### Three Operating Principles

**Clarity over chaos.**  
The Command Center, filters, status icons, and AI briefings help reps see what needs attention without digging through disconnected lists.

**Automate the annoying stuff.**  
Sequences, campaigns, CSV imports, AI writing tools, and proposal/IRR exports reduce repetitive manual work.

**Intelligence is a sales advantage.**  
Cognito, AI account briefings, activity insights, and Social Hub give reps signals and language they can use in real customer conversations.

---

## How To Use This Handbook

Use this document in three ways:

- **Onboarding:** Read the first sections to understand how Constellation fits together.
- **Daily reference:** Jump to the module you are using and follow the workflow steps.
- **Quality check:** Use the "what good looks like" notes to evaluate whether your CRM work is complete and useful.

The handbook follows the actual CRM operating flow:

1. Navigate and find records.
2. Start the day in Command Center.
3. Work people and companies through Contacts and Accounts.
4. Manage pipeline through Deals.
5. Execute outreach through Campaigns and Sequences.
6. Act on intelligence through Cognito and Social Hub.
7. Build financial cases with IRR.
8. Deliver customer-facing proposals.
9. Use SAOS when an account needs a strategic plan.

---

## 1. Navigation, Search, And User Menu

### What It Is

The left navigation rail is the shared shell across the main CRM. It gives access to the core user-facing modules:

- Command Center
- Deals
- Contacts
- Accounts
- Proposals
- IRR
- Campaigns
- Sequences
- Social Hub
- Cognito

It also includes global search, notification dots, CSV templates, and logout.

### Why It Matters

The nav rail is meant to reduce context switching. Reps should be able to jump from a task to a contact, from a contact to an account, from an account to a proposal, and from anywhere back to the Command Center.

### Global Search

Global search lets you find contacts, accounts, and deals from the sidebar.

How to use it:

1. Type at least two characters into the search bar.
2. Wait for the results dropdown.
3. Click a result to open the record.

When the sidebar is collapsed, search opens in a fanout panel. The behavior is the same.

### Sidebar Collapse

Use the collapse control at the top of the nav to make more screen space. Constellation remembers the collapsed state for future sessions.

### Notification Dots

The nav can show bell indicators for:

- **Cognito:** New intelligence alerts since your last visit.
- **Social Hub:** New shareable content since your last visit.

Opening the relevant page updates your last-visited timestamp and clears the bell on the next notification refresh.

### User Menu

Open the bottom **Menu** to access:

- CSV templates for Contacts, Accounts, and Sequence Steps.
- AI Admin link, if available to your user.
- Logout.

CSV templates are only templates. The actual import workflows happen on Contacts, Accounts, or Sequences.

### First Login

If your user profile is not complete, Constellation may ask for your full name and monthly quota. This supports forecasting and user display throughout the CRM.

### Mobile Note

On mobile, the navigation collapses into a drawer. Some full-workflow modules are intentionally simplified or hidden on smaller screens.

---

## 2. Command Center: Your Daily Starting Point

### What It Is

The Command Center is the CRM home page. It brings together the work that needs attention today:

- AI Daily Briefing
- My Tasks
- Sequence Steps
- Recent Activities

On mobile, the Command Center focuses on AI Daily Briefing and My Tasks. Sequence Steps and Recent Activities are desktop-first workflows.

### Why It Matters

Sales work gets noisy fast. The Command Center gives reps one place to answer:

- What should I prioritize?
- What tasks are due?
- Which sequence steps need action?
- What activity happened recently?
- What should be logged to Salesforce?

### AI Daily Briefing

The AI Daily Briefing creates priority cards from your CRM data. It can consider tasks, due sequences, deals, Cognito alerts, and accounts that need attention.

How to use it:

1. Open Command Center.
2. Review the priority cards.
3. Use the refresh control if you want to regenerate the briefing with current data.

The briefing is cached for the browser session. Logging out clears the cache.

What good looks like:

- You use the briefing to decide what to work first.
- You treat it as a prioritization aid, not a replacement for judgment.
- You refresh when you know meaningful CRM data has changed.

### My Tasks

Tasks are manual follow-ups linked to contacts and/or accounts.

How to add a task:

1. Open the quick-add form.
2. Enter a description.
3. Optionally link a contact or account.
4. Add a due date when timing matters.
5. Save the task.

How to manage tasks:

- Complete tasks when finished.
- Edit the description, due date, or linked records when plans change.
- Delete tasks only when they are no longer relevant.

Past-due tasks are highlighted. If you have more than a few open tasks, the quick-add form may be collapsed behind a plus control.

What good looks like:

- Every meaningful follow-up has a task.
- Tasks are linked to the relevant contact or account.
- Due dates are used when timing matters.

### Sequence Steps

Sequence Steps show automated outreach steps assigned to Sales.

The view has two modes:

- **Due:** Work that needs action now.
- **Upcoming:** Future sequence work.

Step types can include email, LinkedIn, call, task, or custom step types.

How to work a due email step:

1. Open the due step.
2. Review the subject and body.
3. Confirm placeholders such as `[FirstName]` and `[AccountName]` were replaced correctly.
4. Open your email client.
5. Confirm the action when successful so Constellation can log the activity and advance the sequence.

How to work a LinkedIn step:

1. Review the suggested message.
2. Copy the text and open LinkedIn.
3. Send or personalize the message in LinkedIn.
4. Confirm success in Constellation.

How to work a call step:

1. Use the phone link if available.
2. Add notes from the call.
3. Log the call to complete the step.

Marketing-assigned sequence steps are hidden from the rep's Command Center view.

### Recent Activities And Salesforce Logging

Recent Activities shows a short activity history, newest first.

Activities that are not logged to Salesforce can show a **Log to SF** action.

How to log an activity to Salesforce:

1. Click **Log to SF**.
2. Salesforce opens a pre-filled Task create page.
3. Complete the task in Salesforce.
4. Return to Constellation and confirm success.

Constellation marks the activity as logged only after confirmation.

What good looks like:

- Important completed actions are reflected in activity history.
- Salesforce logging is completed for activities that need to live in Salesforce.
- Sequence steps are advanced only when the real-world action happened.

---

## 3. Contacts: Your Relationship Hub

### What It Is

Contacts is the person-level workspace. It uses a split layout:

- Left side: searchable and sortable contact list.
- Right side: contact details, sequence status, AI tools, activities, emails, and tasks.

### Why It Matters

Sales work happens through people. Contacts connects the person, the account, the outreach history, the next step, and the relationship context.

### Key Things You Can Do

- Add and edit contacts.
- Link contacts to accounts.
- Search and sort by first or last name.
- Mark a contact as organic.
- See active sequence status.
- Assign or remove sequences.
- Log activities and tasks.
- Use AI to summarize activity history.
- Use AI to draft outreach.
- Import contacts from CSV or from a screenshot.
- Review BCC-logged emails.
- Open ZoomInfo for research.
- Log activities to Salesforce.

### Contact List Icons

Common list indicators include:

- Star: organic contact.
- Airplane: active sequence.
- Flame: recent activity.

Use these as quick context, not as a substitute for reading the record.

### Add Or Edit A Contact

How to add a contact:

1. Click the add contact control.
2. Enter first and last name.
3. Select the new contact.
4. Add email, phone, title, account, and notes.
5. Save changes.

How to maintain a contact:

1. Select the contact.
2. Update the details in the form.
3. Save before switching records.

Constellation warns when you have unsaved changes.

### Assign A Contact To A Sequence

How to assign:

1. Select the contact.
2. Choose a sequence from the sequence assignment dropdown.
3. Confirm the enrollment.
4. Watch the sequence status panel for current progress and next step.

Contacts can be removed from sequences or marked complete when the outreach path ends.

### Work Due Sequence Steps From A Contact

The Contacts page can show current sequence status and due step actions. You may see email, LinkedIn, call, or complete controls depending on the step type and due date.

Use this when you are already in the contact record. Use Command Center when you want a consolidated queue across all contacts.

### AI Activity Insight

AI Activity Insight summarizes past activity and suggests next steps.

How to use it:

1. Select a contact with activity history.
2. Click the activity insight action.
3. Review the summary and suggested next steps.
4. Clear the insight when you want to return to the email writer.

What good looks like:

- Use the summary before outreach or meeting prep.
- Validate AI suggestions against your own knowledge.
- Add missing activity history when the summary feels thin.

### AI Email Drafting

The contact AI panel can draft an email using your prompt, selected products, and context.

How to draft:

1. Select a contact with an email address.
2. Enter what you want to accomplish.
3. Optionally choose product or industry context.
4. Generate the draft.
5. Review the subject and body.
6. Open your email client and send from there.

AI-generated email activity can be logged back to the contact.

### Import From Screenshot Or Business Card

Constellation can extract contact data from an image such as an email signature or business card.

How to use it:

1. Click the import contact screenshot control.
2. Paste a screenshot or use the mobile camera option.
3. Let the AI extract fields.
4. Review the populated contact form.
5. Save after correcting anything needed.

The system attempts to match the company name to an existing account.

### Bulk Import And Export

Contacts can be imported from CSV using the template from the user menu.

The contacts template includes fields such as first name, last name, email, phone, title, and company.

During import, Constellation can preview insert/update actions and suggest account matches.

Contact export downloads core contact fields. It may not include every relationship field shown in the UI.

### Logged Emails And BCC Logging

Constellation supports automatic email logging by BCC.

Use:

`bcc@constellation-crm.com`

When an outbound email is BCC'd to that address, Constellation can match recipients to contacts and store the email in the contact history.

What good looks like:

- Important outbound emails are captured.
- Contact activity history is current enough for AI insight to be useful.
- Reps do not rely only on memory or inbox search.

---

## 4. Accounts: Your 360-Degree Company View

### What It Is

Accounts is the company-level workspace. It brings together firmographic details, contacts, org chart, deals, proposals, activities, tasks, AI briefing, meeting agenda tools, and strategic account planning entry points.

### Why It Matters

Accounts answer the broader sales questions:

- What is happening at this company?
- Who do we know?
- What deals are open?
- What have we done recently?
- What proposal work exists?
- What should we say in the next meeting?
- Does this account need a strategic plan?

### Key Things You Can Do

- Add and edit accounts.
- Filter by tier, hot activity, open deals, customer, or prospect.
- Store Salesforce and ZoomInfo IDs.
- Open Salesforce or ZoomInfo directly.
- Generate an AI account briefing.
- Draft a meeting agenda.
- Create and edit account deals.
- Open linked proposals.
- View contacts as a list or org chart.
- Log tasks and activities.
- Promote activity into SAOS when appropriate.
- Toggle into Strategic Account OS.

### Account List And Filters

Use search to find an account by name.

Use filters to narrow by:

- Strategic tier.
- Hot activity.
- Open deals.
- Customer.
- Prospect.

Tier filters can reflect SAOS account plan tiering when a plan has been saved.

### Add Or Maintain An Account

How to add:

1. Click the add account control.
2. Enter account name.
3. Fill website, industry, phone, address, sites, employees, and notes.
4. Mark Customer when applicable.
5. Save changes.

### Salesforce And ZoomInfo Links

Accounts can store Salesforce and ZoomInfo locators.

How to use them:

1. Select an account.
2. Add or edit the Salesforce ID and ZoomInfo company ID.
3. Use the header buttons to open the account in the external system.

When activities are logged to Salesforce, the account Salesforce locator can be used as the Salesforce Task `WhatId`.

### AI Account Briefing

The AI account briefing creates a reconnaissance-style report from internal CRM context and external intelligence.

It can include:

- Account summary.
- Org chart snapshot.
- Pipeline context.
- Recent activities.
- External signals.
- Recommended next move.

How to use it:

1. Select an account.
2. Click the AI briefing action.
3. Review the generated report.
4. Print or download if needed for meeting prep.

What good looks like:

- Use it before first meetings, QBRs, major follow-ups, or account reviews.
- Treat it as prep support, not final truth.
- Update missing contacts, activities, or deals when the briefing reveals gaps.

### Draft A Meeting Agenda

The agenda builder helps turn account context into meeting invite language.

How to use it:

1. Select an account.
2. Open the meeting agenda tool.
3. Choose relevant standard agenda items.
4. Add custom items if needed.
5. Drag to reorder.
6. Add optional context.
7. Generate and copy the invite language.

Use this when you want a clear customer-facing meeting structure instead of a vague calendar invite.

### Account Deals

The account page includes deal cards tied to the selected company.

You can:

- Add a new deal.
- Edit stage, MRC, close month, term, name, products, and notes.
- Toggle committed forecast status.
- Flip cards to work notes.

Use account deal cards when you are working a specific customer. Use the Deals page when you need the whole pipeline view.

### Proposals On An Account

Linked proposals appear on the account record.

You can:

- Open an existing proposal.
- Create a new proposal linked to the account.
- Delete a proposal when appropriate.

Proposal authoring happens in the Enterprise Proposal Builder.

### Contacts And Org Chart

Accounts can show associated contacts as either:

- A list.
- An org chart.

The org chart is built from contact reporting relationships.

How to use the org chart:

1. Switch from list view to org chart view.
2. Drag contacts to set reporting relationships.
3. Use zoom controls when the chart is large.
4. Expand the chart for full-screen editing.

What good looks like:

- Important stakeholders are connected to the account.
- Reporting relationships are accurate enough to explain influence.
- Orphaned or unknown contacts are cleaned up over time.

### Activities And Tasks

The account activity feed shows account-level history. You can add tasks or review recent activity.

Some activities can be:

- Logged to Salesforce.
- Promoted into SAOS as strategic relationship signal context.

### SAOS Pointer

Use Strategic Account OS when the account requires a formal strategic plan: pursuit thesis, influence strategy, expansion logic, relationship momentum, 30/60/90 plan, and executive exports.

Open SAOS from the account mode toggle.

For full SAOS guidance, use:

`docs/saos/SAOS_USER_HANDBOOK.md`

---

## 5. Deals: Pipeline, Forecasting, And Board View

### What It Is

Deals is the pipeline workspace. It helps reps and managers manage opportunities, forecast current month revenue, update deal details, and inspect pipeline health.

### Why It Matters

The Deals page answers:

- What am I committing?
- What is best case?
- What is in the funnel?
- Which deals are stale?
- Which stage or product mix needs attention?
- What does my team pipeline look like?

### Key Things You Can Do

- Switch between My Deals and team views when allowed.
- Filter by committed status, stage, close month, closed lost, past due, or renewals.
- Toggle list view and board view.
- Create deals directly.
- Inline edit deal fields.
- Drag board cards between stages.
- Flip cards to update notes.
- Review metrics and charts.

### Forecast Definitions

**Current Commit** is the value of open deals you have marked committed for the current close month.

**Best Case** includes open deals closing in the current month, committed or not.

**Funnel** is the broader open pipeline view.

Renewals can exist in the pipeline but are excluded from forecast metric calculations so new-business numbers stay clean.

### List View

Use list view when you need detail and editing precision.

Common actions:

- Sort columns.
- Edit name, stage, MRC, term, notes, account, or close month.
- Toggle product families.
- Toggle committed.
- Toggle renewal.

### Board View

Use board view when you want to manage motion by stage.

Common actions:

- Drag a card into another stage column.
- Edit fields inline.
- Flip a card to see or update notes.
- Use the note freshness indicator to spot stale opportunities.

### Filters

Use filters to focus the pipeline:

- Committed vs uncommitted.
- Stage.
- Close month.
- Closed lost visibility.
- Past due visibility.
- Renewals hidden or shown.

Reset filters when you want to return to the full working view.

### Create A Deal

How to create from Deals:

1. Click the new deal control.
2. Choose the account.
3. Add name, MRC, stage, close month, term, and products.
4. Save.

You can also create deals from the Account page when working a specific account.

### Manager Pipeline View

Managers can toggle to team pipeline views and may drill into a specific rep's pipeline.

Use this to inspect team forecast health without asking each rep to export a separate report.

### What Good Looks Like

- Current-month deals have accurate close months.
- Committed deals are truly committed, not hopeful.
- Renewals are flagged.
- Closed lost deals are moved to Closed Lost, not deleted.
- Notes are current enough for another leader to understand deal status.

---

## 6. Campaigns: Curated Outreach Sprints

### What It Is

Campaigns is a guided workspace for short, intentional outreach runs. Reps build a named list of specific contacts and then work through the list as a call blitz or guided email campaign.

Campaigns are not broad list blasts. They are curated outreach sprints.

### Why It Matters

Campaigns help reps create structure around bursts of prospecting or customer outreach. They keep the target list, execution queue, notes, and completion status in one workflow.

### Campaign Types

Current user-facing campaign creation supports:

- Call Blitz.
- Guided Email.

Email Merge is retired in the current workflow.

### The Cart

Campaign creation uses a cart model.

Filters help you find accounts and contacts, but they do not automatically define the audience. Contacts are included only when you add them to the cart.

This matters because it keeps campaigns intentional.

### Create A Campaign

How to create:

1. Open Campaigns.
2. Choose Create mode.
3. Enter campaign name.
4. Choose Call Blitz or Guided Email.
5. For Guided Email, enter subject and body.
6. Use account and contact discovery filters to find targets.
7. Add individual contacts, or add all contacts from an account, to the cart.
8. Save the campaign.

### Run A Call Blitz

How to run:

1. Switch to Run mode.
2. Select an active call campaign.
3. Call the current contact.
4. Enter notes.
5. Click Log Call and Next.
6. Skip contacts when needed.

Call notes are required when logging a call. Skipping does not create an activity.

### Run A Guided Email Campaign

How to run:

1. Select an active guided email campaign.
2. Review the merged email for the current contact.
3. Edit the body if needed.
4. Open the email client and advance.
5. Skip contacts when needed.

Merge fields such as `[FirstName]`, `[LastName]`, and `[AccountName]` support personalization.

### Completion

When every campaign member is completed or skipped, the campaign moves to Past.

Past campaigns show completed results, including engaged and skipped contacts.

### What Good Looks Like

- Campaigns have a specific purpose.
- The cart is curated, not dumped from a broad filter.
- Call notes capture useful outcomes.
- Guided emails are reviewed before sending.
- Completed campaigns show what was worked and what was skipped.

---

## 7. Sequences: Multi-Touch Playbooks

### What It Is

Sequences are reusable outreach playbooks. A sequence defines a series of steps, delays, messages, owners, and step types.

You build sequences on the Sequences page. You execute due sequence steps from Command Center or Contacts.

### Why It Matters

Sequences create follow-up discipline. They prevent reps from relying on memory and help keep outreach consistent across multiple touches.

### Key Things You Can Do

- Create personal sequences.
- Add, edit, delete, and reorder steps.
- Assign step owners.
- Import shared Marketing or ABM sequences.
- Import sequence steps from CSV.
- Generate sequences with AI.
- Bulk assign contacts.
- Review active enrollment and success percentage.

### Create A Sequence Manually

How to create:

1. Click Add Sequence.
2. Enter a sequence name.
3. Add a description if useful.
4. Add steps.
5. For each step, define type, delay, assigned-to owner, subject, and message.
6. Save.

### Step Types And Delay

Steps can include:

- Email.
- Call.
- LinkedIn.
- Task.
- Custom types.

Delay controls when the step becomes due after the previous step.

### Reorder Or Edit Steps

The current sequence builder uses visual step cards.

Common actions:

- Drag cards to reorder steps.
- Drag or open a step to edit.
- Delete steps after confirmation.

Finish or cancel active edits before switching sequences or importing new steps.

### Import A Shared Sequence

How to import:

1. Click Import Marketing Sequence.
2. Select a shared Marketing or ABM sequence.
3. Import it as your own editable copy.

Deleting an imported copy removes your copy, not the original shared template.

### Bulk Import Steps From CSV

Use the Sequence Steps CSV template from the user menu.

Expected fields include step number, type, subject, message, and delay days.

Imported steps append to the selected sequence.

### AI Generate A Sequence

How to use AI:

1. Enter the goal.
2. Add persona or voice guidance.
3. Choose number of steps and total duration.
4. Select step types.
5. Generate the sequence.
6. Review and edit the preview.
7. Save the generated sequence with a unique name.

What good looks like:

- AI gives you a first draft, not a final strategy.
- You edit the language to fit the account, product, and market.
- Step timing makes sense for the buying motion.

### Bulk Assign Contacts

How to bulk assign:

1. Select a sequence with steps.
2. Open Bulk Assign.
3. Filter contacts by title, company, industry, or activity.
4. Select contacts.
5. Assign selected contacts.

Contacts already in active sequences may be excluded from the list.

### Campaigns Versus Sequences

Campaigns are one-time curated outreach sprints. They are worked directly inside the Campaigns page.

Sequences are reusable multi-touch playbooks. You build them once, enroll contacts, and work due steps over time from Command Center or Contacts.

---

## 8. Cognito Intelligence: Turn Account News Into Outreach

### What It Is

Cognito is the CRM intelligence inbox. It surfaces news and buying-signal alerts tied to your accounts and helps you turn those alerts into outreach, logged activities, and tasks.

### Why It Matters

Timing matters in sales. Cognito helps reps act when an account has a meaningful signal, such as leadership change, expansion, technology partnership, or financial update.

### Key Things You Can Do

- Review new alerts.
- Filter by trigger type, relevance, or account.
- Open source articles.
- Dismiss irrelevant alerts.
- Act on alerts through the Action Center.
- Use AI-drafted outreach.
- Refine outreach with custom prompts.
- Log an interaction.
- Create a follow-up task.
- Mark alerts completed.
- Review the archive.

### Review New Alerts

How to review:

1. Open Cognito.
2. Start in New Alerts.
3. Focus first on high relevance scores.
4. Use filters to narrow by account or trigger type.
5. Open the source link when you need the full article.

### Dismiss An Alert

Dismiss alerts that are irrelevant or not actionable.

Dismissed alerts move to the archive.

### Act On An Alert

How to use the Action Center:

1. Click Action on an alert.
2. Wait for the AI outreach suggestion.
3. Choose a suggested contact with an email address.
4. Review the subject and body.
5. Use Copy or Open Email Client.
6. Optionally refine the message with a custom prompt.
7. Log an interaction.
8. Create a task when follow-up is needed.
9. Mark Completed when the alert has been handled.

Closing the modal without marking completed leaves the alert in New Alerts.

### Contact Requirement

Cognito needs at least one contact with an email on the account to support email sending, logging, and task creation from the Action Center.

If an account has no email-ready contacts, add or update contacts first.

### Archive

The archive shows actioned and dismissed alerts. It is for reference. Archived alerts cannot be reopened in the Action Center from the current UI.

### Notifications

A bell on the Cognito nav item means new intelligence arrived since your last Cognito visit.

### What Good Looks Like

- High-relevance alerts are reviewed quickly.
- Outreach is tied to the right contact.
- Real action is logged.
- Follow-up tasks are created when needed.
- Completed alerts are marked completed.

---

## 9. Social Hub: Share Curated Content On LinkedIn

### What It Is

Social Hub is a rep-facing content-sharing workspace. It gives reps a feed of AI-curated news and marketing-approved posts, then helps draft LinkedIn-ready copy.

### Why It Matters

Social selling works best when reps share timely, relevant content consistently. Social Hub reduces the effort required to find something useful, write a caption, and share it.

### Two Content Feeds

**AI Content** shows AI-curated news articles.

**Marketing** shows pre-approved campaign assets from the marketing team.

Marketing content can include a link to the content image library for post graphics.

### Prepare A Post

How to share AI-curated news:

1. Open Social Hub.
2. Use the AI Content tab.
3. Choose a News Article.
4. Click Prepare Post.
5. Review the AI-generated draft.
6. Edit manually if needed.
7. Use a custom prompt and Regenerate if you want a different tone.
8. Click Copy Text.
9. Click Post to LinkedIn.
10. Paste the copied text into LinkedIn.

How to share marketing content:

1. Switch to Marketing.
2. Choose a Campaign Asset.
3. Click Prepare Post.
4. Review the pre-approved copy.
5. Optionally refine it.
6. Copy text and open LinkedIn.

Important: Constellation opens LinkedIn with the link only. It does not automatically post the caption. You must paste the copied text into LinkedIn.

### Dismiss Content

Click Dismiss to remove a post from your feed.

Dismissal is per user and permanent in the current UI. There is no visible undo.

### Dynamic Link Indicator

A sparkle indicator means the link is configured to create a richer LinkedIn preview. LinkedIn controls the final preview behavior.

### Notifications

A bell on Social Hub means new content arrived since your last visit.

### What Good Looks Like

- Share relevant content regularly.
- Edit AI copy so it sounds like you.
- Use Marketing copy when you want approved campaign language.
- Dismiss content that does not fit your audience.

---

## 10. Multi-Site IRR Calculator: Modeling, Approval, And Exports

### What It Is

The IRR Calculator models multi-site project economics. It helps reps evaluate construction costs, revenue, payback, IRR, and cash flow across one or more sites.

### Why It Matters

Large network opportunities often need financial justification before approval. IRR gives sales and finance a common model for deciding whether a project works.

### Key Things You Can Do

- Create and save projects.
- Load saved projects.
- Add multiple sites.
- Enter cost and revenue assumptions.
- Set target IRR.
- Set discount rate.
- Adjust construction and billing timelines.
- Stress test CapEx and MRR.
- Import Salesforce CSV data.
- Export PDF reports.
- Export CSV with Excel-friendly formulas.

### Start A Project

How to start:

1. Click New Project.
2. Enter project name.
3. Set the target IRR.
4. Enter discount rate if needed.
5. Add one or more sites.
6. Fill cost and revenue fields for each site.

### Read Results

The global results summarize the whole project.

Site tabs show whether each site is Go or No-Go against the target IRR.

Common outputs include:

- Annual IRR.
- Total CapEx.
- TCV.
- NPV.
- Run-rate payback.
- Cash flow break-even.

### Timeline Settings

Use timeline settings when construction and billing do not start in month zero.

How to set timing:

1. Open the cash flow settings.
2. Set business case start month.
3. Set construction start and duration by site.
4. Set billing start by site.
5. Save and return to chart.

### Stress Test

Stress testing lets you adjust CapEx and MRR assumptions without changing saved site inputs.

Use this to understand sensitivity before presenting a case.

### Import From Salesforce CSV

IRR supports Salesforce CSV import when the report has the expected columns for solution site and financial fields.

Review imported values before saving.

### Export

Use PDF export for approval-ready reports.

Use CSV export when finance needs spreadsheet formulas and auditable project data.

### What Good Looks Like

- Each site has realistic cost and revenue assumptions.
- Timelines reflect construction and billing reality.
- Stress testing is used before borderline approvals.
- PDF or CSV exports are shared when a decision needs documentation.

---

## 11. Enterprise Proposal Builder: Modules, Pricing, And PDF Delivery

### What It Is

The Enterprise Proposal Builder assembles customer-ready proposal PDFs from reusable GPC sections, custom pages, cover letter content, pricing tables, references, impact/ROI content, and uploaded PDFs.

### Why It Matters

Proposals need to be consistent, professional, accurate, and fast. The proposal builder replaces manual document assembly with a repeatable workflow.

### Key Things You Can Do

- Set proposal properties.
- Choose proposal modules.
- Reorder modules.
- Preview stock PDFs.
- Write a cover letter.
- Insert snippets.
- Build pricing options.
- Import pricing from Salesforce CSV.
- Add custom PDFs or pages.
- Add references.
- Add impact and ROI content.
- Compile and generate a final PDF.
- Save `.spec` files.
- Save proposals to an account.
- Send for proofing.

### Proposal Properties

Start with core proposal metadata:

- RFP name.
- Business name.
- Sales rep.
- Presentation date.
- Project start and completion dates.

Keep names concise because they are used in generated proposal output.

### Proposal Elements

Select the sections you need, such as:

- Title Page.
- Why GPC.
- DIA.
- NOC.
- SIA.
- About GPC.
- Escalation.
- Project Plan.
- SPIN.
- Leadership.
- Cover Letter.
- Table of Contents.
- Proposed Pricing.
- Custom Pages.
- References.
- Impact and ROI.
- Uploaded PDFs.

Drag modules to reorder them.

### Cover Letter And Custom Text

Use snippets to speed up common language, but edit the final letter for the customer.

Before compiling, replace bracketed placeholders such as `[customer name]` or `[insert detail]`.

The builder can block compile/proofing when placeholders remain.

### Pricing

The pricing engine supports:

- Multiple pricing options.
- Locations.
- Product lines.
- Quantities.
- NRC and MRC.
- Promotions.
- Location subtotals.
- Decimal display settings.
- Contract terms.
- Solution IDs.

### Import Pricing From Salesforce

How to import:

1. Run the expected Salesforce report.
2. Export details-only CSV.
3. Drop the CSV into the proposal import zone.
4. Review populated locations and product lines.

Bulk Salesforce import fills pricing option 1. Additional pricing options have their own import workflow.

### Compile And Generate

The PDF workflow has two stages:

1. **Compile Proposal:** Prepares assets and validates content.
2. **Generate PDF:** Creates the downloadable final proposal.

Think compile first, generate second.

Common blockers:

- Bracketed placeholder text remains.
- A selected custom PDF is missing.
- A selected custom page has incomplete content.
- Table of Contents module is selected but titles are missing.

### Save And Resume

You can save work in two ways:

- Save a local `.spec` file.
- Save to an account so the proposal appears on the account record.

Use `.spec` files when sharing draft work or resuming locally. Use account-linked save when the proposal belongs to a customer record.

### Send For Proofing

Send for Proofing downloads the `.spec` and opens a proofing email workflow. Attach the spec file so the reviewer can load the proposal state.

### What Good Looks Like

- Proposal modules match the customer need.
- Cover letter is customer-specific.
- Pricing is reviewed after import.
- Placeholders are removed.
- PDF is generated only after compile checks pass.
- A copy is saved to the related account when appropriate.

---

## 12. Strategic Account OS: When To Leave The Main CRM

### What It Is

Strategic Account OS is a planning layer embedded inside the Accounts page.

The main CRM captures tactical execution: contacts, deals, tasks, activities, proposals, and account facts.

SAOS captures strategic judgment: why the account matters, why it may change, who matters politically, where expansion could happen, what risks exist, and what the next 30/60/90 plan should be.

### When To Use SAOS

Use SAOS when:

- The account is strategically important.
- Multiple stakeholders influence the decision.
- The path to change is unclear.
- Expansion potential matters.
- Leadership needs a clear account plan.
- You need an executive PDF or PowerPoint export.

Do not use SAOS as a dumping ground for every routine CRM activity.

### How It Connects

From the Account page, use the mode toggle to enter Strategic Account OS.

CRM account data, contacts, activities, and relationship context can support the plan. Some tactical activity can be promoted into strategic context, but SAOS exports intentionally focus on strategic signals and manual insights.

Full guide:

`docs/saos/SAOS_USER_HANDBOOK.md`

---

## 13. Import, Export, And External Systems

### CSV Templates

Templates are available from the nav user menu:

- Contacts.
- Accounts.
- Sequence Steps.

Use templates to avoid formatting errors during bulk import.

### Contacts Import

Use for adding or updating contact records. Review preview rows before confirming.

### Accounts Import

Use for adding or updating account records. Account name is required.

### Sequence Steps Import

Use to append step rows to the selected sequence.

### Salesforce

Constellation connects to Salesforce in several user workflows:

- Activity logging from Command Center, Contacts, and Accounts.
- Salesforce account links from Accounts.
- Salesforce CSV import into IRR.
- Salesforce CSV import into Proposals.

Salesforce activity logging opens a pre-filled Salesforce Task. Constellation marks the activity logged only after the user confirms success.

### ZoomInfo

ZoomInfo links help reps research contacts and accounts.

Account-level ZoomInfo links can be stored as company IDs. Contact-level ZoomInfo behavior may open ZoomInfo search rather than a stored contact profile.

### LinkedIn

LinkedIn is used in:

- Sequence steps.
- Social Hub post sharing.

Constellation can open LinkedIn and copy suggested text, but the user completes the LinkedIn action.

---

## 14. What Good CRM Usage Looks Like

Good Constellation usage is not about filling every field. It is about keeping the operating picture current enough to drive action.

### Daily

- Review AI Daily Briefing.
- Clear urgent tasks.
- Work due sequence steps.
- Log meaningful activity.
- Act on high-value Cognito alerts.

### Weekly

- Review current-month commit and best case.
- Update stale deal notes.
- Clean up past-due deals.
- Check account filters for hot accounts and open opportunities.
- Review campaigns and sequence enrollments.

### Before Customer Meetings

- Open the Account record.
- Review contacts, org chart, activities, deals, and proposals.
- Generate an AI account briefing when useful.
- Draft a clear agenda.
- Use SAOS for strategic accounts.

### Before Forecast Or Pipeline Review

- Confirm committed deals are real.
- Update close months.
- Flag renewals.
- Move losses to Closed Lost.
- Review notes freshness.
- Check team view if you are a manager.

### Before Proposal Delivery

- Verify proposal properties.
- Confirm pricing after Salesforce import.
- Remove placeholders.
- Compile before generating.
- Save the final spec or account-linked proposal.

---

## 15. Common Questions

### Is Constellation replacing Salesforce?

No. Constellation is the operating layer where sales work gets organized and executed. Salesforce remains important for official records, reporting, and downstream business process. Constellation helps reduce double work by opening pre-filled Salesforce tasks where supported.

### Should every contact be in a sequence?

No. Sequences are for structured outreach paths. Some relationships require manual follow-up, campaign execution, or account-specific strategy instead.

### Should every account have SAOS?

No. SAOS is for accounts that deserve strategic planning. Routine accounts can remain in the standard tactical CRM view.

### Why do some Social Hub or Cognito notifications disappear after I visit the page?

The notification bell is based on whether new content arrived since your last visit. Visiting the page updates your last-visited timestamp.

### Does Social Hub post to LinkedIn for me?

No. It opens LinkedIn with the link and copies text for you. You paste and post manually.

### Why do I need to confirm after opening email, LinkedIn, or Salesforce?

Constellation cannot know whether you completed the external action. Confirmation tells the CRM whether to log the activity, advance the sequence, or mark Salesforce logging complete.

### Why does the old guide look different?

The legacy user guide and PDF predate several current workflows: IRR, Proposals, board-style Deals, richer account AI, Cognito Action Center details, Social Hub tabs, ABM campaign cart, and the current Sequences builder.

---

## Closing Principle

The best CRM usage creates a clear next action.

If a record does not help you decide what happened, what matters, who is involved, what should change, or what to do next, it is just storage. Constellation is most valuable when it turns sales data into sales movement.
