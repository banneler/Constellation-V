-- Security Advisor fixes (apply after db pull; save as a new migration or run in SQL Editor)
-- See: Dashboard → Database → Security Advisor

-- 1. RLS disabled in public (ERROR): Enable RLS on social_hub_posts_tw
ALTER TABLE IF EXISTS public.social_hub_posts_tw ENABLE ROW LEVEL SECURITY;

-- Add a policy so the table is not completely locked. Adjust to your app's needs (e.g. restrict by user_id).
CREATE POLICY "Allow authenticated read/write social_hub_posts_tw"
  ON public.social_hub_posts_tw
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Auth users exposed (ERROR): Stop exposing admin_users_view to anon
REVOKE ALL ON public.admin_users_view FROM anon;

-- 3. Security definer views (ERROR): Use invoker so RLS runs as the querying user (Postgres 15+)
ALTER VIEW IF EXISTS public.admin_users_view SET (security_invoker = on);
ALTER VIEW IF EXISTS public.admin_script_logs_view SET (security_invoker = on);
ALTER VIEW IF EXISTS public.admin_activity_log_view SET (security_invoker = on);
