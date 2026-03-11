# Constellation CRM — Marketing & Sales Website Plan

**Purpose:** Define all product features, their value propositions, and a concrete plan to build a public-facing marketing/sales website for Constellation CRM.

---

## 1. Product positioning

Constellation is a **System of Engagement** built by an active sales leader to sit on top of legacy **Systems of Record** (e.g. Salesforce). It is the layer where reps actually work—sequences, intent data, proposals, and AI—without replacing the CRM you already use for reporting and compliance.

- **Tagline:** *"The CRM built to close deals, not just track them."*
- **Value proposition:** Constellation eliminates the "swivel-chair" effect. Reps no longer need five different tools for sequences, intent data, and proposals; everything lives in one place, on top of your existing system of record.
- **Core principles:** Clarity Over Chaos · Automate the Annoying Stuff · Intelligence is Your Superpower

### Feature hierarchy (crown jewels — lead with these)

The following are our **massive differentiators** and should appear at the very top of all feature lists and marketing:

1. **Cognito (Intent Engine)** — AI-monitored buying signals for your accounts; AI-drafted outreach and one-click log/task. Act on intent before competitors.
2. **Enterprise Proposal Builder** — Professional proposals tied to accounts, accessible from account detail. No more switching to a separate proposal tool.
3. **AI Sequence Generator** — First-draft sequences in minutes: goal, duration, step types, persona → AI generates the sequence; edit and save. Scale outreach without the busywork.

---

## 2. Feature inventory & value propositions

### 2.0 Crown jewels (lead features)

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **Cognito (Intent Engine)** | AI-monitored news and signals for your accounts; relevance scoring; Action Center with AI-drafted email, refine with custom prompt, log interaction, create task; New vs Archive. | Know when an account is in the news (funding, leadership, expansion). Turn an alert into logged outreach and follow-up in one flow. Act before competitors. |
| **Enterprise Proposal Builder** | Full proposal experience (create/edit, link to account); accessible from account detail. | Professional proposals that live in the CRM and stay linked to the account. No more separate proposal tool. |
| **AI Sequence Generator** | Goal, duration, step count, step types, persona → AI generates step list; edit and save as new sequence. Bulk assign contacts. | First-draft sequences in minutes. Scale outreach without the busywork. |

### 2.1 Command Center (Home / Dashboard)

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **AI Daily Briefing** | RAG-powered summary of tasks, sequence steps, deals, Cognito alerts, nurture accounts. Priority cards with clear next actions. | Start every day knowing exactly what matters. No more digging through lists—AI tells you what to do first. |
| **My Tasks** | Manual task list with due dates, linked to contacts/accounts. Quick-add form, complete/edit/delete, past-due highlighting. | One place for all follow-ups. Never drop a ball; tasks stay tied to the right contact or account. |
| **Sequence Steps (Due / Upcoming)** | View of automated sequence steps due today or upcoming. Action buttons (Send Email, Go to LinkedIn, etc.) and complete step. | Your sequence pipeline in one view. See what’s due, take action, and move contacts forward without leaving the dashboard. |
| **Recent Activities** | Chronological feed of logged activities. | Quick context on what you and your team did lately. |
| **Log to Salesforce** | One-click “Log to SF” on activities opens pre-filled Salesforce Task create and marks activity as logged. | Keep CRM and Salesforce in sync without double entry. |

**Module value prop:** *One screen that tells you what to do today and gives you the levers to do it.*

---

### 2.2 Deals (Pipeline)

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **List & Kanban views** | Toggle between sortable table and drag-and-drop board by stage. | Work the way you like: list for detail, board for pipeline flow. |
| **Metric cards** | Current commit, best case, funnel total, ARPU, closed won (MTD). Quota % and optional team totals for managers. | Forecast at a glance. Commit and best case stay clean; renewals can be excluded so numbers reflect new business. |
| **Filters** | Stage, close month, committed/uncommitted, show closed lost, show past due, hide renewals. | Slice pipeline by what you care about without leaving the page. |
| **Manager view** | “My Deals” vs “My Team’s Deals”; pipeline dropdown to view a specific rep (TomSelect). Only users with `show_in_pipeline` appear. | Managers see team pipeline and drill into any rep without separate reports. |
| **Renewal handling** | Renewal checkbox per deal (list); “Hide renewals” toggle; metrics exclude renewals by default. | Reps track renewals in the funnel; you keep forecast and metrics focused on new revenue. |
| **Deal Insights charts** | Deals by stage (bar), 30/60/90 funnel, product distribution (deal count by product). | Visual pipeline health and mix by stage, timing, and product. |
| **Inline editing** | Edit stage, close month, account, name, term, MRC, notes, committed, renewal in list or on cards. | Update deals without opening modals. |
| **Kanban drag-and-drop** | Move cards between stages; flip card for notes and quick edit. | Visual pipeline management; notes on the back for prep and context. |

**Module value prop:** *Pipeline you can see, slice, and forecast—with manager visibility and clean numbers.*

---

### 2.3 Contacts

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **Contact list + detail panel** | Searchable list; select contact for details, activities, sequence status. | Split view: find anyone fast, then work in context. |
| **Sequence enrollment** | Assign to sequence, remove, or mark complete; next step and progress visible. | Keep contacts in the right sequence and see exactly what’s next. |
| **AI Compose** | Prompt-driven AI: generate email or account insight; product/industry context. | Beat writer’s block and get first-draft emails and insights in seconds. |
| **AI Activity Insight** | Synthesize contact activities into summary and next steps; clear/reset. | Turn a long activity list into a short “what’s going on and what to do.” |
| **Ring chart** | Visual sequence progress for the selected contact. | Instant read on where they are in the journey. |
| **Email view** | Modal with thread/body and attachments for logged emails. | Read full context without leaving the CRM. |
| **Log activity / Add task** | Log activities and create tasks linked to contact. | All touchpoints and follow-ups in one timeline. |
| **Bulk import/export** | CSV import and export for contacts. | Onboard or back up data in bulk. |
| **ZoomInfo** | Link to ZoomInfo for the contact. | Enrich and verify from a single place. |

**Module value prop:** *One place for every contact: sequence, activities, AI-written outreach, and next steps.*

---

### 2.4 Accounts

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **Account list + filters** | Search and filter (All, Hot, With Deals, Customer, Prospect). Select for detail panel. | Focus on the accounts that matter for the moment. |
| **Org chart** | Visual org chart of contacts; list vs chart toggle; pan, zoom, maximize (fullscreen modal). | See reporting structure and key players at a glance. |
| **AI Account Briefing** | Edge function: internal + external intel, recommendations; optional org chart snapshot; print/download. | Pre-call or pre-meeting brief in one click—relationship summary, pipeline, activity, news, and AI recommendation. |
| **Account form + Salesforce/ZoomInfo** | Edit account fields; store and open Salesforce and ZoomInfo links. | Single source of truth with quick links to SF and ZoomInfo. |
| **Draft meeting agenda** | Build agenda from canned + custom items; AI generates meeting-invite copy; copy to clipboard. | Turn an account view into a ready-to-send meeting agenda. |
| **Account proposals** | List proposals for the account; open in proposal builder; delete. | Proposals stay tied to the account and easy to reopen. |
| **Account deals** | Flippable deal cards with notes on back; add deal, edit, commit. | Manage account pipeline and notes without leaving the account. |
| **Activities + tasks** | Activity list, pending task reminder, add deal, add task. | Full account timeline and follow-ups in one place. |

**Module value prop:** *Account-centric view: org chart, AI briefing, agendas, proposals, and deals in one screen.*

---

### 2.5 Proposals

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **Proposal builder (embed)** | Enterprise proposal experience (iframe/embed): create and edit proposals; link to account. | Professional proposals tied to accounts and accessible from account detail. |

**Module value prop:** *Proposals that live in the CRM and stay linked to the account.*

---

### 2.6 IRR Calculator

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **Multi-site projects** | New/Load/Save project; add multiple sites; per-site inputs (costs, term, NRR, MRR). | Model complex, multi-site deals in one place. |
| **Global target IRR + results** | Target IRR dial; aggregated decision (GO/NO GO), IRR, TCV, payback, capital. | One number for the whole project; clear go/no-go. |
| **Cash flow** | Chart vs timeline settings (flip); cumulative cash flow chart; per-site timeline (construction start, billing start). | Visual and tabular view of cash flow across sites. |
| **Stress test** | CAPEX and MRR sliders to stress the model; annual table and chart update; reset. | Sensitivity analysis without rebuilding the model. |
| **Print report / Export CSV** | Print-friendly report; optional chart snapshot; export project/site data to CSV. | Share and archive decisions with stakeholders. |

**Module value prop:** *Multi-site fiber (or similar) deal modeling with IRR, payback, stress testing, and shareable outputs.*

---

### 2.7 Campaigns

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **Active vs past campaigns** | Separate lists for active and past; select for details (flippable card for email back). | Clear separation of what’s running vs what’s done. |
| **Run campaign** | Guided flow: Call Blitz or Guided Email; contact card, notes/body, log or skip; activities update. | Run blitzes and email campaigns without jumping between tools. |
| **Filters** | Customer/Prospect, Starred, Industry. | Target the right audience for each campaign. |
| **Create campaign** | Template selector, subject/body, merge pills, contact preview; confirm and create. | Reuse templates and merge fields for consistent messaging. |
| **Email template manager** | Create/edit templates inline; name, subject, body; save/cancel. | Central library of on-brand email templates. |

**Module value prop:** *Run and track campaigns (call and email) with templates and guided execution.*

---

### 2.8 Sequences

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **Sequence list + details** | Select sequence; view/edit name, description; step flow with drag-and-drop. | Build and maintain sequences in one place. |
| **AI Generate Sequence** | Goal, duration, step count, step types, persona → AI generates step list; edit and save as new sequence. | First-draft sequences in minutes instead of hours. |
| **Bulk assign contacts** | Modal with contact list and filters; select all or by row; assign to current sequence. | Enroll many contacts at once without one-by-one. |
| **Import steps (CSV)** | Import sequence steps from CSV. | Reuse or migrate sequences from spreadsheets. |
| **Import marketing sequence** | Pull in marketing-defined sequences. | Align sales and marketing sequences. |

**Module value prop:** *Design, automate, and scale outreach sequences—with AI to draft them and bulk assign to contacts.*

---

### 2.9 Social Hub

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **AI-curated content** | AI-sourced articles; “Prepare Post” opens modal with generated post text. | Content ideas and ready-to-use post copy. |
| **Marketing posts** | Posts from marketing team; prepare or dismiss. | One feed for AI and marketing content. |
| **Prepare Post modal** | Custom prompt, regenerate, copy, post to LinkedIn. | Refine and publish without leaving the CRM. |

**Module value prop:** *Never run out of social content: AI and marketing feed plus one-click prep and post to LinkedIn.*

---

### 2.10 Cognito (Intelligence)

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **Intelligence alerts** | AI-monitored news and signals for your accounts; relevance score; New vs Archive. | Know when an account is in the news (funding, leadership, expansion) so you can act in time. |
| **Filters** | Trigger type, relevance, account. | Focus on the alerts that matter. |
| **Action Center** | Open alert → AI-drafted outreach email; refine with custom prompt; select contact; log interaction, create task; send/copy. | Turn an alert into a logged outreach and follow-up in one flow. |
| **Notification dot** | Bell on Cognito nav when there are new alerts. | Don’t miss high-value signals. |

**Module value prop:** *Buying signals delivered to you, with AI-drafted outreach and one-click log/task so you act before competitors.*

---

### 2.11 Global search & navigation

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **Global search** | Search across contacts, accounts, deals from the sidebar; results link to the right record. | Find any contact, account, or deal from anywhere. |
| **Collapsible nav** | Sidebar with logo, search, main links, user menu; collapse for more space. | Consistent nav; more screen real estate when needed. |
| **User menu** | Theme toggle, CSV template downloads (contacts, accounts, sequence steps), AI Admin link, logout. | Quick access to settings, imports, and admin. |
| **Theme support** | Dark, light, green, blue, corporate. | Match your environment and preference. |

**Module value prop:** *One search, one nav, fewer context switches.*

---

### 2.12 Admin

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **User management** | Table: quota, manager flag, exclude reporting; bulk reassign (from user → to user). | Control who sees what and who owns data after role changes. |
| **Content management** | Manage content records. | Central control of shared content. |
| **Analytics & logs** | Rep and date filters; metric cards and charts; activity and script logs. | Visibility into usage and issues. |
| **Deal stages / Activity types** | Add and manage deal stages and activity types. | Configure pipeline and activity taxonomy. |
| **System settings** | Central settings view. | One place for system configuration. |

**Module value prop:** *Configure users, pipeline, content, and see how the system is used.*

---

### 2.13 AI Admin

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **AI engine config** | Per-engine tabs (e.g. Daily Briefing, Account Recon, Cognito Suggestion, Product Post); edit technical foundation, persona, voice, custom instructions; save/reset. | Tune AI tone, focus, and behavior without code. |

**Module value prop:** *Make Constellation’s AI sound and behave like your company.*

---

### 2.14 Marketing Hub (internal marketing)

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **ABM Command Center** | Tasks due, upcoming, completed for ABM/marketing sequences. | Marketing stays aligned with ABM execution. |
| **Email templates / Sequences / Social posts** | Same template and sequence concepts as main app; create post form. | Shared content and sequences for sales and marketing. |

**Module value prop:** *Dedicated hub for marketing to manage templates, sequences, and social posts (internal use).*

---

### 2.15 User guide

| Feature | Description | Value proposition |
|--------|-------------|-------------------|
| **Section-based guide** | Nav sections (Introduction, Global Search, Command Center, Deals, Contacts, Accounts, Campaigns, Sequences, Social Hub, Cognito, User Menu); content pane with how-tos and screenshots. | Self-serve onboarding and reference so reps get value fast. |

**Module value prop:** *Built-in help so adoption doesn’t depend on live training alone.*

---

### 2.16 Integrations & data

| Area | Description | Value proposition |
|------|-------------|-------------------|
| **Salesforce** | Log activity to SF (pre-filled Task URL); optional Salesforce account/contact links. | Keep Salesforce as system of record while working in Constellation. |
| **ZoomInfo** | Links to ZoomInfo for contacts and accounts. | Enrich and verify data where you already work. |
| **Supabase** | Auth, database, RLS, edge functions. | Secure, scalable backend with real-time and serverless AI. |
| **CSV import/export** | Contacts, accounts, sequence steps; template downloads. | Bulk data in/out and standardized templates. |

---

## 3. Target audience (for the marketing site)

- **Primary:** Sales leaders and ops (VP Sales, Director of Sales Ops) in SMB/mid-market (e.g. telecom, technology, professional services) who want pipeline clarity, rep productivity, and AI that fits their process.
- **Secondary:** Individual reps and team leads who want a single place for tasks, sequences, and intelligence without tool sprawl.
- **Tertiary:** Marketing leads interested in campaigns, sequences, and social content tied to the same CRM.

---

## 4. Marketing site structure (recommended)

### 4.1 Pages

| Page | Goal | Main content |
|------|------|--------------|
| **Home** | Convey “mission control” and three pillars (clarity, automation, intelligence). Hero + social proof + feature teasers + CTA. | Hero with tagline; 3 value pillars; “See how it works” (video or demo CTA); testimonial or logo strip; primary CTA (demo / start trial). |
| **Features** | Deep-dive on capabilities. | Sections per module (Command Center, Deals, Contacts, Accounts, Cognito, Sequences, Campaigns, Social Hub, Proposals, IRR, Admin). Each: headline, 2–3 bullets, optional screenshot or short GIF. |
| **AI & intelligence** | Differentiate on AI. | Cognito (alerts + Action Center), AI Daily Briefing, AI Account Briefing, AI Compose, AI sequences; “Your data, your voice” (AI Admin). |
| **Integrations** | Trust and fit. | Salesforce, ZoomInfo, CSV; “Built on Supabase” for technical buyers. |
| **Pricing** | Convert. | Tiers or “Contact for pricing”; optional calculator or “per seat” hint. |
| **Resources** | SEO and nurture. | User guide overview, blog/docs links, CSV templates, “How to get started.” |
| **Contact / Demo** | Lead capture. | Form (name, email, company, role, message); optional Calendly or “Book a demo.” |
| **Login** | Existing customers. | Link to app login (e.g. app.constellationcrm.com or your domain). |
| **Legal** | Compliance. | Privacy policy, Terms of use (links in footer). |

### 4.2 Navigation (suggested)

- **Main:** Home · Features · AI & intelligence · Integrations · Pricing · Resources · Contact  
- **Footer:** Repeat key links + Login + Privacy · Terms · (optional) Status

---

## 5. Messaging guidelines

- **Tone:** Confident, clear, practical. Avoid hype; focus on outcomes (time saved, pipeline visible, actions clear).
- **Headlines:** Lead with benefit, not feature (“Know what to do today” not “AI Daily Briefing”).
- **Proof:** Use “Reps see…”, “Managers get…”, “Your pipeline…” to keep it persona-led.
- **Differentiators to stress:**  
  - One home base (Command Center) that prioritizes the day.  
  - AI that drafts outreach and briefings from your data.  
  - Sequences and campaigns in the same place as pipeline and contacts.  
  - Optional: “Built for teams that already use Salesforce and ZoomInfo.”

---

## 6. Technical approach for the marketing site

- **Stack:** Static or simple static-site generator (e.g. 11ty, Astro, or plain HTML/CSS/JS) for speed and hosting cost. No app backend required.
- **Hosting:** Vercel, Netlify, or Cloudflare Pages; custom domain (e.g. constellationcrm.com).
- **Design:** Reuse Constellation visual language (logo, colors, type) from the app for consistency; ensure contrast and accessibility (WCAG 2.1 AA).
- **Analytics:** Lightweight analytics (e.g. Plausible, Fathom, or GA4) for traffic and conversion (demo requests, contact form).
- **Lead capture:** Form on Contact/Demo page; store in Supabase (simple `leads` table) or send to email/CRM; optional Zapier/Make to push to Salesforce.
- **SEO:** Meta titles/descriptions per page; optional blog for “Constellation CRM”, “sales pipeline”, “AI for sales” etc.
- **App link:** Clear “Log in” in nav and footer pointing to the existing Constellation app (same or subdomain).

---

## 7. Content checklist (before launch)

- [ ] Home: hero copy, 3 pillars, 1–2 testimonials or placeholder, CTA.
- [ ] Features: one subsection per major module (from §2); at least headline + 3 bullets each.
- [ ] AI page: Cognito, Daily Briefing, Account Briefing, Compose, Sequences, AI Admin.
- [ ] Integrations: Salesforce, ZoomInfo, CSV; one sentence each.
- [ ] Pricing: structure (or “Contact us”).
- [ ] Contact/Demo: form fields and submit handling.
- [ ] Legal: Privacy and Terms (can start minimal).
- [ ] Favicon and OG image for sharing.
- [ ] All internal links and “Log in” target verified.

---

## 8. Summary

Constellation CRM is a full-stack sales platform: **Command Center** (AI briefing, tasks, sequence steps, activities, Salesforce log), **Deals** (list/board, metrics, filters, manager view, renewals, charts), **Contacts** (sequences, AI compose, activity insight, emails), **Accounts** (org chart, AI briefing, agendas, proposals, deals), **Proposals**, **IRR Calculator**, **Campaigns**, **Sequences** (with AI generation and bulk assign), **Social Hub**, **Cognito** (alerts + Action Center), **Admin** and **AI Admin**, plus **global search**, **themes**, and **user guide**.

The marketing site should present Constellation as **mission control for sales**—emphasizing clarity, automation, and intelligence—with a clear feature set, a dedicated AI page, integrations, pricing, and a simple path to demo or login. This plan and the value-proposition table above are the single source of truth for what to build and what to say on the site.
