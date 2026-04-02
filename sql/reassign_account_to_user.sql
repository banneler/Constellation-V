-- Run in Supabase SQL Editor (once). Manager-only RPC to move an account + contacts to a new owner,
-- with optional reassignment of activities, deals, and tasks (user_id) for that account.
-- Aligns with RLS: "Users can manage their own …" on activities/deals/tasks.
--
-- Manager check (either is enough; matches app: initializeAppState uses quotas OR user_metadata):
--   1) user_quotas.is_manager for auth.uid()
--   2) auth.jwt() -> user_metadata -> is_manager (boolean/string/number), same signal as deals.js
-- TODO: converge on user_quotas as single source of truth and drop JWT branch when ready.

CREATE OR REPLACE FUNCTION public.reassign_account_to_user(
    p_account_id bigint,
    p_to_user_id uuid,
    p_include_activities boolean DEFAULT false,
    p_include_deals boolean DEFAULT false,
    p_include_tasks boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_manager_quotas boolean;
    v_is_manager_jwt boolean;
    v_user_meta jsonb;
BEGIN
    SELECT COALESCE(uq.is_manager, false)
    INTO v_is_manager_quotas
    FROM public.user_quotas uq
    WHERE uq.user_id = auth.uid();

    v_user_meta := auth.jwt() -> 'user_metadata';
    IF v_user_meta IS NULL OR jsonb_typeof(v_user_meta) <> 'object' THEN
        v_is_manager_jwt := false;
    ELSE
        v_is_manager_jwt := CASE COALESCE(jsonb_typeof(v_user_meta -> 'is_manager'), 'null')
            WHEN 'boolean' THEN (v_user_meta -> 'is_manager') = 'true'::jsonb
            WHEN 'string' THEN lower(trim(v_user_meta ->> 'is_manager')) IN ('true', 't', '1', 'yes')
            WHEN 'number' THEN (v_user_meta ->> 'is_manager')::numeric <> 0
            ELSE false
        END;
    END IF;

    IF NOT COALESCE(v_is_manager_quotas, false) AND NOT COALESCE(v_is_manager_jwt, false) THEN
        RAISE EXCEPTION 'Only managers can reassign accounts';
    END IF;

    IF p_to_user_id IS NULL THEN
        RAISE EXCEPTION 'Target user is required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_account_id) THEN
        RAISE EXCEPTION 'Account not found';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.user_quotas WHERE user_id = p_to_user_id) THEN
        RAISE EXCEPTION 'Target user must exist in user_quotas';
    END IF;

    UPDATE public.accounts
    SET user_id = p_to_user_id
    WHERE id = p_account_id;

    UPDATE public.contacts
    SET user_id = p_to_user_id
    WHERE account_id = p_account_id;

    IF p_include_activities THEN
        UPDATE public.activities
        SET user_id = p_to_user_id
        WHERE account_id = p_account_id;
    END IF;

    IF p_include_deals THEN
        UPDATE public.deals
        SET user_id = p_to_user_id
        WHERE account_id = p_account_id;
    END IF;

    IF p_include_tasks THEN
        UPDATE public.tasks
        SET user_id = p_to_user_id
        WHERE account_id = p_account_id;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'account_id', p_account_id,
        'to_user_id', p_to_user_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.reassign_account_to_user(bigint, uuid, boolean, boolean, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.reassign_account_to_user(bigint, uuid, boolean, boolean, boolean) TO authenticated;
