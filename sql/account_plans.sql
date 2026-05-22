-- =============================================================================
-- account_plans: Strategic Account OS document (JSONB) per account
-- Run once in Supabase Dashboard → SQL Editor (after public.accounts exists).
-- Requires public.is_manager() from sql/manager_helpers.sql for manager policy.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.account_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id bigint NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
    plan jsonb NOT NULL DEFAULT '{"schema_version":1,"current_draft":{},"history":[]}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_account_plans_account_id ON public.account_plans(account_id);
CREATE INDEX IF NOT EXISTS idx_account_plans_updated_at ON public.account_plans(updated_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security: owner access via accounts.user_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.account_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_plans_select_own" ON public.account_plans;
CREATE POLICY "account_plans_select_own"
    ON public.account_plans FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.accounts a
            WHERE a.id = account_plans.account_id
              AND a.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "account_plans_insert_own" ON public.account_plans;
CREATE POLICY "account_plans_insert_own"
    ON public.account_plans FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.accounts a
            WHERE a.id = account_plans.account_id
              AND a.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "account_plans_update_own" ON public.account_plans;
CREATE POLICY "account_plans_update_own"
    ON public.account_plans FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.accounts a
            WHERE a.id = account_plans.account_id
              AND a.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.accounts a
            WHERE a.id = account_plans.account_id
              AND a.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "account_plans_delete_own" ON public.account_plans;
CREATE POLICY "account_plans_delete_own"
    ON public.account_plans FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.accounts a
            WHERE a.id = account_plans.account_id
              AND a.user_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_account_plans_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_plans_updated_at ON public.account_plans;
CREATE TRIGGER account_plans_updated_at
    BEFORE UPDATE ON public.account_plans
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_account_plans_updated_at();

-- ---------------------------------------------------------------------------
-- Manager policy: append the block below to sql/rls_managers_manage_team_crm.sql
-- ---------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "account_plans_manager_all" ON public.account_plans;
-- CREATE POLICY "account_plans_manager_all"
--   ON public.account_plans
--   FOR ALL
--   TO public
--   USING (is_manager() = true)
--   WITH CHECK (is_manager() = true);
