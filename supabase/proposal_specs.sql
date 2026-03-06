-- =============================================================================
-- proposal_specs: store proposal spec JSON per account (Constellation Proposals)
-- Run once in Supabase Dashboard → SQL Editor.
-- =============================================================================

-- Table: one row per saved proposal; multiple rows per account allowed (name distinguishes)
CREATE TABLE IF NOT EXISTS public.proposal_specs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id bigint NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    name text NOT NULL DEFAULT 'Proposal',
    spec jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for listing by account
CREATE INDEX IF NOT EXISTS idx_proposal_specs_account_id ON public.proposal_specs(account_id);
CREATE INDEX IF NOT EXISTS idx_proposal_specs_updated_at ON public.proposal_specs(updated_at DESC);

-- RLS: users can only read/write proposal_specs for accounts they own (accounts.user_id)
ALTER TABLE public.proposal_specs ENABLE ROW LEVEL SECURITY;

-- Select: allow if the account belongs to the current user
CREATE POLICY "proposal_specs_select_own"
ON public.proposal_specs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.id = proposal_specs.account_id
        AND a.user_id = auth.uid()
    )
);

-- Insert: allow if the account belongs to the current user
CREATE POLICY "proposal_specs_insert_own"
ON public.proposal_specs FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.id = proposal_specs.account_id
        AND a.user_id = auth.uid()
    )
);

-- Update: allow if the account belongs to the current user
CREATE POLICY "proposal_specs_update_own"
ON public.proposal_specs FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.id = proposal_specs.account_id
        AND a.user_id = auth.uid()
    )
);

-- Delete: allow if the account belongs to the current user
CREATE POLICY "proposal_specs_delete_own"
ON public.proposal_specs FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.id = proposal_specs.account_id
        AND a.user_id = auth.uid()
    )
);

-- Optional: trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_proposal_specs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proposal_specs_updated_at ON public.proposal_specs;
CREATE TRIGGER proposal_specs_updated_at
    BEFORE UPDATE ON public.proposal_specs
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_proposal_specs_updated_at();
