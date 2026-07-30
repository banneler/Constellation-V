-- Add soft-deactivation metadata for CRM users and expose it in Admin.
-- Login disabling is handled by the Vercel admin API route via Supabase Auth Admin.

ALTER TABLE public.user_quotas
    ADD COLUMN IF NOT EXISTS exclude_from_reporting boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
    ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS deactivation_reason text;

CREATE INDEX IF NOT EXISTS idx_user_quotas_deactivated_at
    ON public.user_quotas (deactivated_at);

DROP FUNCTION IF EXISTS public.get_admin_users();

CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (
    user_id uuid,
    email text,
    full_name text,
    last_login timestamptz,
    monthly_quota numeric,
    is_manager boolean,
    exclude_from_reporting boolean,
    show_in_pipeline boolean,
    deactivated_at timestamptz,
    deactivated_by uuid,
    deactivation_reason text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT
        au.id AS user_id,
        au.email::text AS email,
        uq.full_name,
        au.last_sign_in_at AS last_login,
        uq.monthly_quota::numeric AS monthly_quota,
        COALESCE(uq.is_manager, false) AS is_manager,
        COALESCE(uq.exclude_from_reporting, false) AS exclude_from_reporting,
        COALESCE(uq.show_in_pipeline, false) AS show_in_pipeline,
        uq.deactivated_at,
        uq.deactivated_by,
        uq.deactivation_reason
    FROM auth.users au
    LEFT JOIN public.user_quotas uq ON uq.user_id = au.id
    ORDER BY COALESCE(uq.full_name, au.email);
$$;

REVOKE ALL ON FUNCTION public.get_admin_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;
