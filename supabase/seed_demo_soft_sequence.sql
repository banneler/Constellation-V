-- Demo Follow-up (Soft Touch) sequence for interactive-demo gate leads.
-- Run in Sales Supabase SQL editor (or psql) after setting the lead-owner UUID.
--
-- Ops:
--   1. Replace LEAD_OWNER_USER_ID below with the same UUID as SaaS env LEAD_OWNER_USER_ID
--   2. Run this script once (idempotent by sequence name + user_id)
--   3. Optional: set SaaS DEMO_LEAD_SEQUENCE_ID to the printed sequence id
--
-- Cadence:
--   Step 1 — Email, delay 0 days  (soft thanks)
--   Step 2 — Email, delay 14 days (touch base ~2 weeks)

DO $$
DECLARE
  -- >>> REPLACE THIS UUID <<<
  v_owner uuid := '00000000-0000-0000-0000-000000000000';
  v_seq_id bigint;
  v_name text := 'Demo Follow-up (Soft Touch)';
BEGIN
  IF v_owner = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'Set v_owner to your LEAD_OWNER_USER_ID before running this seed.';
  END IF;

  SELECT id INTO v_seq_id
  FROM public.sequences
  WHERE user_id = v_owner
    AND name = v_name
  LIMIT 1;

  IF v_seq_id IS NULL THEN
    INSERT INTO public.sequences (name, description, source, user_id, is_abm)
    VALUES (
      v_name,
      'Soft post-demo nurture: thank-you now, light touch-base at ~2 weeks. No hard sell.',
      'Personal',
      v_owner,
      false
    )
    RETURNING id INTO v_seq_id;

    INSERT INTO public.sequence_steps (
      sequence_id, step_number, type, subject, message, delay_days, user_id
    ) VALUES
      (
        v_seq_id,
        1,
        'Email',
        'Thanks for exploring Constellation',
        E'Hi {{first_name}},\n\nThanks for taking a look at the Constellation demo. No rush on anything — if questions come up while you explore, just reply to this email.\n\nHappy to share a short walkthrough whenever it’s useful.\n\nBest,\nConstellation',
        0,
        v_owner
      ),
      (
        v_seq_id,
        2,
        'Email',
        'Quick touch base',
        E'Hi {{first_name}},\n\nJust a light check-in from when you tried the Constellation demo a couple of weeks ago.\n\nIf it’s still on your radar, I’m happy to answer questions or set up a brief, no-pressure conversation. If timing isn’t right, no worries at all.\n\nBest,\nConstellation',
        14,
        v_owner
      );
  END IF;

  RAISE NOTICE 'Demo soft sequence ready: id=% name=%', v_seq_id, v_name;
END $$;
