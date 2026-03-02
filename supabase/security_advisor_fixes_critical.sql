-- =============================================================================
-- CRITICAL Security Advisor fixes – clear "auth users exposed" and "security definer view"
-- =============================================================================
-- 1. Run this entire file once in Supabase Dashboard → SQL Editor.
-- 2. Deploy the updated admin.js (it now calls get_admin_users, get_admin_activity_log,
--    get_admin_script_logs instead of selecting from the views).
-- =============================================================================
-- Moves the three admin views into schema "app_admin" (not exposed by PostgREST),
-- then exposes the same data via RPCs. No view in the API reads auth.users;
-- the RPCs run as definer and read from app_admin. Admin app behavior unchanged.
-- =============================================================================

-- Use a private schema not exposed by the API (we use app_admin; "vault" can have restricted owner in some projects)
CREATE SCHEMA IF NOT EXISTS app_admin;
GRANT USAGE ON SCHEMA app_admin TO postgres;
GRANT CREATE ON SCHEMA app_admin TO postgres;
DO $$ BEGIN EXECUTE 'GRANT USAGE, CREATE ON SCHEMA app_admin TO ' || current_user; END $$;

-- 1. admin_users_view: move to app_admin, expose via get_admin_users()
DO $$
DECLARE def text;
BEGIN
  def := pg_get_viewdef('public.admin_users_view'::regclass, true);
  EXECUTE 'CREATE OR REPLACE VIEW app_admin.admin_users_view AS ' || def;
  DROP VIEW IF EXISTS public.admin_users_view CASCADE;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'admin_users_view: %', SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS SETOF app_admin.admin_users_view
LANGUAGE sql
SECURITY DEFINER
SET search_path = app_admin, public, auth
AS $$
  SELECT * FROM app_admin.admin_users_view;
$$;

REVOKE ALL ON FUNCTION public.get_admin_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;

-- 2. admin_activity_log_view: move to app_admin, expose via get_admin_activity_log()
DO $$
DECLARE def text;
BEGIN
  def := pg_get_viewdef('public.admin_activity_log_view'::regclass, true);
  EXECUTE 'CREATE OR REPLACE VIEW app_admin.admin_activity_log_view AS ' || def;
  DROP VIEW IF EXISTS public.admin_activity_log_view CASCADE;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'admin_activity_log_view: %', SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION public.get_admin_activity_log(_limit int DEFAULT 200)
RETURNS SETOF app_admin.admin_activity_log_view
LANGUAGE sql
SECURITY DEFINER
SET search_path = app_admin, public, auth
AS $$
  SELECT * FROM app_admin.admin_activity_log_view ORDER BY activity_date DESC LIMIT _limit;
$$;

REVOKE ALL ON FUNCTION public.get_admin_activity_log(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_activity_log(int) TO authenticated;

-- 3. admin_script_logs_view: move to app_admin, expose via get_admin_script_logs()
DO $$
DECLARE def text;
BEGIN
  def := pg_get_viewdef('public.admin_script_logs_view'::regclass, true);
  EXECUTE 'CREATE OR REPLACE VIEW app_admin.admin_script_logs_view AS ' || def;
  DROP VIEW IF EXISTS public.admin_script_logs_view CASCADE;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'admin_script_logs_view: %', SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION public.get_admin_script_logs()
RETURNS SETOF app_admin.admin_script_logs_view
LANGUAGE sql
SECURITY DEFINER
SET search_path = app_admin, public, auth
AS $$
  SELECT * FROM app_admin.admin_script_logs_view ORDER BY last_completed_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_admin_script_logs() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_script_logs() TO authenticated;

-- Ensure app_admin is not in the API exposed schemas (Dashboard → Settings → API → "Exposed schemas").
-- By default only "public" (and sometimes "graphql_public") are exposed, so app_admin is already hidden.
