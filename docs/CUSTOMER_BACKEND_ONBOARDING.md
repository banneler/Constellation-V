# Constellation — Customer Backend Onboarding

Operational checklist for standing up a **stock** Constellation CRM instance for a new customer.

This covers the backend / infra path we established with **Constellation Sales** (`sales.constellation-crm.com`). It does **not** cover product prompts, AI personalization playbooks, or ICB custom apps — those belong in the larger technical gathering doc.

**Model:** one codebase (`Constellation-V`) → one Vercel project + one Supabase project + one subdomain + one Gemini API key per customer.

---

## 0. Gather inputs

Before you start, collect:

| Input | Example (Sales) | Notes |
|---|---|---|
| Customer short name | `sales` / `acme` | Used for subdomain, Vercel project, API key label |
| Approved signup email domains | `constellation-crm.com` | Comma-separated if multiple |
| Primary admin email | `ba@constellation-crm.com` | Must match an approved domain if autoconfirm + allow-list are on |
| Region preference | West US / Canada Central | Prefer same region as other stock instances when possible |
| DNS access | stableserver / registrar | Need CNAME for subdomain |
| GCP project | `gen-lang-client-0549538203` (Constellation) | Shared AI project; **per-customer keys** |

---

## 1. Supabase project (data plane)

### 1.1 Create empty project

1. Supabase Dashboard → Organization **Constellation**
2. **New project**
   - Name: `Constellation - {Customer}` (e.g. `Constellation - Sales`)
   - Generate a strong DB password → store in 1Password
   - Region: choose deliberately (Sales used West US / Oregon; GPC is Canada Central)
3. Wait until project is healthy
4. Copy:
   - Project URL → `https://{ref}.supabase.co`
   - `anon` key
   - `service_role` key
   - Project ref (`{ref}`)

### 1.2 Apply stock schema (structure only — no GPC data)

Do **not** use “Restore to a new project” from GPC (that copies customer data).

From a machine with Supabase CLI + `libpq` (`pg_dump` / `psql`):

```bash
# Dump schema-only from live stock source (GPC Constellation)
cd /path/to/Constellation-V
supabase link --project-ref pjxcciepfypzrfmlfchj   # if needed

# Preferred: supabase db dump --linked (requires Docker)
# Fallback used for Sales: dry-run for temp login + local pg_dump --schema-only
# Save to /tmp/constellation-schema.sql (exclude auth/storage/realtime platform schemas)

# Apply to the NEW project
export PGPASSWORD='{new-db-password}'
psql "postgresql://postgres@db.{NEW_REF}.supabase.co:5432/postgres" \
  -v ON_ERROR_STOP=0 \
  -f /tmp/constellation-schema.sql
```

Expect some harmless `grant options cannot be granted back to your own grantor` errors.

**Verify:**

```sql
-- ~33 public tables, RLS enabled, policies present
select count(*) from pg_tables where schemaname = 'public';
select count(*) from pg_policies where schemaname = 'public';
```

### 1.3 Signup domain allow-list + Auth hook

Apply stock migration (if not already in the dump):

`supabase/migrations/20260729160000_signup_email_domain_allowlist.sql`

Then seed domains:

```sql
insert into public.signup_email_domains (domain, type, reason)
values
  ('acme.com', 'allow', 'Customer approved domain')
on conflict (domain) do update
set type = 'allow', reason = excluded.reason;
```

Enable the hook (Management API or Dashboard → Authentication → Hooks):

- Hook: **Before User Created**
- URI: `pg-functions://postgres/public/hook_restrict_signup_by_email_domain`

### 1.4 Auth email templates + Site URL

Push branded templates from the stock repo:

```bash
cd /path/to/Constellation-V
node scripts/push-auth-email-templates.js \
  --project-ref {NEW_REF} \
  --site-url https://{customer}.constellation-crm.com
```

Dashboard check:

- Authentication → URL configuration  
  - **Site URL:** `https://{customer}.constellation-crm.com`  
  - Redirect allow list: that origin `/**`, plus `https://{vercel-alias}.vercel.app/**`, localhost for debug

### 1.5 Email delivery (required for invites / resets)

Supabase built-in mail is ~**2 emails/hour**. For production:

1. Configure **custom SMTP** (Dashboard → Auth → SMTP), preferably the customer’s transactional sender or a Constellation-managed sender
2. Raise **Rate limit for sending emails** after SMTP is set

Until SMTP is ready, `mailer_autoconfirm = true` is acceptable for closed allow-list instances, but password reset / invite still need SMTP.

### 1.6 Create admin user

1. Sign up (or Admin API create) with an **approved-domain** email
2. Confirm / autoconfirm as configured
3. First login completes `user_quotas` profile (or seed via SQL/service role)
4. Record `user_id` (UUID) — needed for lead capture, Cognito/Social Hub `TARGET_USER_ID`, etc.

```sql
-- Optional seed
insert into public.user_quotas (user_id, full_name, monthly_quota, is_manager, show_in_pipeline)
values ('{ADMIN_USER_UUID}', 'Admin Name', 100000, true, true)
on conflict (user_id) do update set is_manager = true;
```

### 1.7 Stock seed content (as needed)

Minimum for a usable sales motion:

- Personal / Marketing sequences + steps (e.g. Website Lead Follow-up)
- Activity types / deal stages if not already in schema defaults
- Optional: empty starter email templates

---

## 2. Vercel app (compute plane)

### 2.1 Create project from the same GitHub repo

1. Vercel team **constellation-crm**
2. **Add project** from `banneler/Constellation-V` (do **not** fork for stock)
3. Name: `constellation-{customer}` (e.g. `constellation-sales`)
4. Production branch: usually `main` (or your release branch policy)

CLI pattern used for Sales:

```bash
npx vercel project add constellation-{customer}
npx vercel link --project constellation-{customer} --yes --scope constellation-crm
```

### 2.2 Environment variables

Set at least:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | New project URL |
| `SUPABASE_ANON_KEY` | Client key (build inject) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server / cron |
| `APPROVED_SIGNUP_DOMAINS` | e.g. `acme.com,acme.co` (client UX; server hook is source of truth) |
| `GEMINI_API_KEY` | **Per-customer** Google AI key (see §3) |
| `GEMINI_SYNTHESIS_MODEL` | Optional; match stock default |
| `CRON_SECRET` | Unique per project |

Legacy aliases if still referenced: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Build uses `npm run build` → `scripts/inject-env.js` → writes `js/env.config.js`.

### 2.3 Deploy

```bash
npx vercel --prod --yes
```

Confirm `https://{project}.vercel.app/js/env.config.js` shows the **new** Supabase URL and approved domains (not GPC).

---

## 3. Google AI key (usage isolation)

Use the shared GCP project **Constellation** (`gen-lang-client-0549538203`), but create a **dedicated API key per customer** so usage/quotas can be monitored.

```bash
gcloud config set project gen-lang-client-0549538203

gcloud services api-keys create \
  --display-name="Constellation {Customer}" \
  --annotations=generative-language=enabled,organization=constellation-{customer} \
  --api-target=service=generativelanguage.googleapis.com \
  --format=json
```

- Restrict to `generativelanguage.googleapis.com` (same pattern as existing Constellation keys)
- Put `keyString` into Vercel `GEMINI_API_KEY`
- Redeploy the customer Vercel project
- Store key id / display name in the customer runbook sheet

---

## 4. DNS + subdomain

### 4.1 Attach domain on Vercel

```bash
npx vercel domains add {customer}.constellation-crm.com constellation-{customer}
```

### 4.2 DNS at registrar

Add **CNAME**:

| Host | Value |
|---|---|
| `{customer}` | Vercel-recommended target (e.g. `….vercel-dns-017.com` or `cname.vercel-dns.com`) |

Verify:

```bash
npx vercel domains verify {customer}.constellation-crm.com
dig +short {customer}.constellation-crm.com CNAME
curl -I https://{customer}.constellation-crm.com
```

Password reset links use `window.location.origin` (stock) — once DNS works, Auth Site URL must match.

---

## 5. Marketing site → CRM lead capture (optional, Sales-shaped)

Only for instances that should receive website inquiries (today: **Constellation Sales**).

On Vercel project **`constellation-saa-s`** (www):

| Variable | Meaning |
|---|---|
| `SALES_SUPABASE_URL` | Customer Supabase URL |
| `SALES_SUPABASE_SERVICE_ROLE_KEY` | Service role |
| `LEAD_OWNER_USER_ID` | Admin `user_id` UUID |
| `LEAD_SEQUENCE_ID` | Website lead sequence id |

`/api/send-contact` will:

1. Email support inbox  
2. Upsert account + contact  
3. Enroll **new** contacts in the lead sequence  
4. Send a **CRITICAL** email if the contact already exists (no re-enroll)

Redeploy www after env changes.

---

## 6. Mac mini automation (Social Hub + Cognito)

Social Hub posts and Cognito alerts are **not** generated inside Vercel. They are written by Python jobs that run on the Mac mini (Tailscale host historically used for mini sync: `100.76.189.26`, user `ba`).

### 6.1 Script locations (current)

Canonical working copies today live outside the git repos (iCloud / on-mini paths), e.g.:

- `cognito_constellation_ai.py` + `run_cognito.sh`
- `social_hub.py` + `run_social_hub.sh`
- On-mini expected root: `/Users/ba/Documents/Constellation-CRM/` (venv + scripts + `logs/`)

> Gap to close later: move these into a proper repo with env-based config (no hardcoded service keys).

### 6.2 Per-customer clone checklist

For each new customer instance:

1. **Copy** the Cognito + Social Hub script pair into a customer-specific folder on the mini  
   e.g. `/Users/ba/Documents/Constellation-CRM/customers/{customer}/`
2. Point env / shell exports at the **new** Supabase project:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (prefer env file over hardcoded)
3. Set `TARGET_USER_ID` to the customer admin (or the user whose accounts should be monitored)
4. Configure Google Custom Search + Gemini credentials (prefer the **customer’s** Gemini key from §3 where the script supports it)
5. Customer-specific prompt / CSE id as required
6. Schedule via **launchd** or cron on the mini (separate plist per customer, or one orchestrator with a customer list)
7. Confirm writes land in that project’s `cognito_alerts` / `social_hub_posts` / `script_run_logs`
8. Confirm the customer app Social Hub + Cognito pages show the new rows

### 6.3 Do not

- Point a new customer’s mini job at the GPC Supabase project
- Share one Gemini key across all customers if you care about usage attribution
- Commit service role keys into iCloud-synced script files

---

## 7. Edge Functions + cron

### 7.1 Supabase Edge Functions

From `Constellation-V/supabase/functions/`, deploy to the **new** project any functions the stock app needs (e.g. admin user deactivation, agenda / presentation helpers). Set function secrets (`GEMINI_API_KEY`, etc.) per project.

### 7.2 Vercel cron

`vercel.json` schedules `/api/cron/synthesize-ai-profiles`. Ensure `CRON_SECRET` and service role are set on the customer Vercel project so weekly synthesis hits the correct DB.

---

## 8. Smoke test checklist

- [ ] `https://{customer}.constellation-crm.com` loads and `env.config.js` points at the new Supabase  
- [ ] Signup with **non-approved** domain is rejected  
- [ ] Signup with **approved** domain succeeds  
- [ ] Login as admin → Command Center loads; `user_quotas` row exists  
- [ ] Create a test account + contact  
- [ ] AI action (e.g. email assist) works and usage appears against the **customer** Gemini key  
- [ ] Password reset email sends (after SMTP) and returns to the customer subdomain  
- [ ] Cognito job writes an alert for a test account  
- [ ] Social Hub job writes a post  
- [ ] (If applicable) Website contact form creates account/contact/sequence under `LEAD_OWNER_USER_ID`

---

## 9. Handoff record (fill per customer)

| Field | Value |
|---|---|
| Customer name | |
| Subdomain | `{customer}.constellation-crm.com` |
| Vercel project | `constellation-{customer}` |
| Supabase ref | |
| Supabase URL | |
| Approved domains | |
| Admin email / user UUID | |
| Gemini API key display name | `Constellation {Customer}` |
| Gemini key UID | |
| SMTP configured | Y/N |
| Mac mini job path | |
| launchd/cron label | |
| Website lead capture | Y/N |
| Date live | |
| Operator | |

---

## 10. Reference: Constellation Sales (first stock tenant)

| Item | Value |
|---|---|
| Subdomain | `sales.constellation-crm.com` |
| Vercel | `constellation-sales` |
| Supabase | `Constellation - Sales` / `iudcdraytwduxkoromut` |
| Approved domain | `constellation-crm.com` |
| Admin | `ba@constellation-crm.com` |
| Gemini key | `Constellation Sales` (GCP Constellation project) |
| Lead capture | www `constellation-saa-s` → Sales Supabase |
| Schema source | Live GPC `Constellation` (`pjxcciepfypzrfmlfchj`) schema-only dump |

---

## Related stock assets in repo

- `scripts/inject-env.js` — build-time client config  
- `scripts/push-auth-email-templates.js` + `supabase/email-templates/` — Auth emails  
- `supabase/migrations/20260729160000_signup_email_domain_allowlist.sql` — signup allow-list + hook function  
- `vercel.json` — AI profile synthesis cron  
