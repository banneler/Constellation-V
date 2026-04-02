-- Run in Supabase SQL editor (before or with reassign_account_to_user.sql).
-- Single definition of "manager" for JWT claims: user_metadata and/or app_metadata.
-- Used by public.is_manager() (RLS) and reassign_account_to_user (RPC).

CREATE OR REPLACE FUNCTION public.is_manager_from_jwt_meta(meta jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN meta IS NULL OR jsonb_typeof(meta) <> 'object' THEN false
    ELSE CASE COALESCE(jsonb_typeof(meta -> 'is_manager'), 'null')
      WHEN 'boolean' THEN (meta -> 'is_manager') = 'true'::jsonb
      WHEN 'string' THEN lower(trim(meta ->> 'is_manager')) IN ('true', 't', '1', 'yes')
      WHEN 'number' THEN (meta ->> 'is_manager')::numeric <> 0
      ELSE false
    END
  END;
$$;

REVOKE ALL ON FUNCTION public.is_manager_from_jwt_meta(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_manager_from_jwt_meta(jsonb) TO authenticated, anon;

-- RLS policies reference is_manager() with no args. Align with app + RPC: quotas OR JWT claims.
-- SECURITY INVOKER: uses caller session (auth.uid() / auth.jwt() = the signed-in user).
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      (SELECT uq.is_manager FROM public.user_quotas uq WHERE uq.user_id = auth.uid()),
      false
    )
    OR public.is_manager_from_jwt_meta(auth.jwt() -> 'user_metadata')
    OR public.is_manager_from_jwt_meta(auth.jwt() -> 'app_metadata');
$$;

REVOKE ALL ON FUNCTION public.is_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated, anon;
