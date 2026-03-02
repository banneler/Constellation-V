# Supabase – Constellation database

## Pull current schema and RLS from remote

To pull down the current RLS and schema from your Constellation project:

1. **Link the project** (one-time; you’ll be prompted for your database password):

   ```bash
   supabase link --project-ref pjxcciepfypzrfmlfchj
   ```

   Use the database password from your Supabase project (Dashboard → Project Settings → Database).

2. **Pull the remote schema** into a new migration:

   ```bash
   supabase db pull
   ```

   This creates a new file under `supabase/migrations/` with the current remote schema (tables, RLS policies, views, functions, etc.).

3. **Optional – non-interactive link** (e.g. CI): set `SUPABASE_ACCESS_TOKEN` and, if needed, provide the DB password via the prompt or a linked project that already has it stored.

After pulling, you’ll have the current schema and RLS in `supabase/migrations/`.

**Security Advisor fixes**

- The SQL for the **ERROR** items is in `supabase/security_advisor_fixes_manual.sql`. After a successful `db pull`, add it as a new migration (timestamp after the one(s) pull created) and run `supabase db push`, or run it in the Dashboard SQL editor to address the **ERROR** items:
  - Enable RLS on `public.social_hub_posts_tw` and add an authenticated policy (tune as needed).
  - Revoke `anon` access to `public.admin_users_view` (auth.users exposure).
  - Set admin views to `security_invoker = on` so they run with the caller’s permissions.


Then re-run the Security Advisor and address **WARN** items via the dashboard remediation links.
