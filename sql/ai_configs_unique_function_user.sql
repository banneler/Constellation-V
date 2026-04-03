-- Fix ai_configs so AI Admin can save per-user overrides alongside global defaults (user_id IS NULL).
-- Problem: UNIQUE(function_id) alone blocks a second row with the same function_id even when user_id differs.
--
-- Requires PostgreSQL 15+ (Supabase) for UNIQUE ... NULLS NOT DISTINCT so only ONE global row
-- exists per function_id (NULL = NULL for uniqueness), while each user can still have their own row.
--
-- Run once in Supabase SQL editor (safe to re-run).

-- Remove ANY legacy single-column unique on function_id (names vary by migration history).
ALTER TABLE public.ai_configs
  DROP CONSTRAINT IF EXISTS ai_configs_function_id_key,
  DROP CONSTRAINT IF EXISTS unique_function_id;

DROP INDEX IF EXISTS ai_configs_function_id_key;
DROP INDEX IF EXISTS unique_function_id;

-- If a previous attempt left the new constraint, skip add.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'ai_configs'
      AND c.conname = 'ai_configs_function_id_user_id_key'
  ) THEN
    RAISE NOTICE 'Constraint ai_configs_function_id_user_id_key already exists; skipping add.';
  ELSE
    ALTER TABLE public.ai_configs
      ADD CONSTRAINT ai_configs_function_id_user_id_key
      UNIQUE NULLS NOT DISTINCT (function_id, user_id);
  END IF;
END
$migration$;

COMMENT ON CONSTRAINT ai_configs_function_id_user_id_key ON public.ai_configs IS
  'One global default per function_id (user_id null) plus one override per user.';

-- PostgreSQL 14 or older: use two partial unique indexes instead of NULLS NOT DISTINCT, e.g.:
-- CREATE UNIQUE INDEX IF NOT EXISTS ai_configs_one_global_per_function
--   ON public.ai_configs (function_id) WHERE user_id IS NULL;
-- CREATE UNIQUE INDEX IF NOT EXISTS ai_configs_one_override_per_user
--   ON public.ai_configs (function_id, user_id) WHERE user_id IS NOT NULL;
-- Then adjust Supabase upsert to target the partial index columns (may require an RPC).

-- ----- If personal saves still fail with duplicate key on function_id, inspect what is left: -----
-- SELECT c.conname, pg_get_constraintdef(c.oid) AS def
-- FROM pg_constraint c
-- JOIN pg_class t ON c.conrelid = t.oid
-- JOIN pg_namespace n ON t.relnamespace = n.oid
-- WHERE n.nspname = 'public' AND t.relname = 'ai_configs' AND c.contype = 'u';
--
-- SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'ai_configs';
--
-- Drop any UNIQUE that is ONLY on (function_id) after the composite constraint exists (use the name from above):
-- ALTER TABLE public.ai_configs DROP CONSTRAINT IF EXISTS <name>;
