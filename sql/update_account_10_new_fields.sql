-- =============================================================================
-- Demo account (account_id = 10) — populate newer SAOS plan fields
--
-- Run in Supabase SQL Editor AFTER:
--   sql/seed_account_plan_account_10.sql
--   sql/seed_account_10_timeline_entry_points.sql
--   sql/update_account_10_saos_sections.sql   (optional but recommended)
--
-- Patches `public.account_plans.plan` → current_draft.sections:
--   • pursuit_thesis.action_forcing_event  (The Big Play — Why Now?)
--   • pursuit_thesis.thesis              (stitch legacy core + cost if empty)
--   • plan_30_60_90.client_commitments   (Give/Get checklist)
--   • critical_unknowns.blindspots       (migrate from legacy unknowns blob)
--   • entry_points                       (operational_pain + conversation_wedge
--                                         merges, contact_id, strip legacy keys)
--
-- Safe to re-run: uses jsonb deep-merge and idempotent entry-point transforms.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Section-level merges (pursuit, 30/60/90, blindspots)
-- ---------------------------------------------------------------------------
UPDATE public.account_plans ap
SET
    plan = jsonb_set(
        ap.plan,
        '{current_draft,sections}',
        COALESCE(ap.plan #> '{current_draft,sections}', '{}'::jsonb)
        || jsonb_build_object(
            'pursuit_thesis',
            COALESCE(ap.plan #> '{current_draft,sections,pursuit_thesis}', '{}'::jsonb)
            || jsonb_build_object(
                'action_forcing_event',
                    COALESCE(
                        NULLIF(trim(ap.plan #>> '{current_draft,sections,pursuit_thesis,action_forcing_event}'), ''),
                        'Tournament-weekend outage elevated WAN reliability to a board topic; Q3 data-center refresh and incumbent MPLS renewal (18 months) force a credible overlay decision before procurement locks spend.'
                    ),
                'thesis',
                    COALESCE(
                        NULLIF(trim(ap.plan #>> '{current_draft,sections,pursuit_thesis,thesis}'), ''),
                        NULLIF(trim(concat_ws(
                            E'\n\n',
                            NULLIF(trim(ap.plan #>> '{current_draft,sections,pursuit_thesis,core}'), ''),
                            NULLIF(trim(ap.plan #>> '{current_draft,sections,pursuit_thesis,cost_of_standing_still}'), '')
                        )), ''),
                        trim(ap.plan #>> '{current_draft,sections,pursuit_thesis,core}')
                    )
            ),
            'plan_30_60_90',
            COALESCE(ap.plan #> '{current_draft,sections,plan_30_60_90}', '{}'::jsonb)
            || jsonb_build_object(
                'client_commitments',
                    CASE
                        WHEN jsonb_array_length(
                            COALESCE(ap.plan #> '{current_draft,sections,plan_30_60_90,client_commitments}', '[]'::jsonb)
                        ) > 0
                        THEN ap.plan #> '{current_draft,sections,plan_30_60_90,client_commitments}'
                        ELSE jsonb_build_array(
                            'VP Infrastructure signs pilot success criteria and names NOC runbook owners by Day 14.',
                            'CFO delegate receives one-page ROI (best / base / conservative) before executive readout.',
                            'Procurement agrees to 90-day overlay window without full MPLS rip-and-replace.',
                            'Regional ops director confirms property-floor change window for flagship pilot cutover.'
                        )
                    END
            ),
            'critical_unknowns',
            jsonb_build_object(
                'blindspots',
                CASE
                    WHEN jsonb_array_length(
                        COALESCE(ap.plan #> '{current_draft,sections,critical_unknowns,blindspots}', '[]'::jsonb)
                    ) > 0
                    THEN ap.plan #> '{current_draft,sections,critical_unknowns,blindspots}'
                    ELSE jsonb_build_array(
                        'Will Q3 data-center refresh budget unlock SD-WAN net-new spend, or is it locked to incumbent renewal?',
                        'Who in the CFO office has hard veto on multi-property contracts under the pilot threshold?',
                        'Does tribal gaming compliance require additional audit scope before we kick off the flagship overlay?',
                        'What is the real cost (political + operational) of running MPLS and SD-WAN in parallel during pilot overlap?'
                    )
                END
            )
        ),
        true
    ),
    updated_at = now()
WHERE ap.account_id = 10;


-- ---------------------------------------------------------------------------
-- 2) Entry points — consolidated Target Profile fields + contact_id
-- ---------------------------------------------------------------------------
WITH contact_slots AS (
    SELECT
        c.id,
        trim(both FROM format('%s %s', COALESCE(c.first_name, ''), COALESCE(c.last_name, ''))) AS full_name,
        row_number() OVER (ORDER BY c.id) AS rn
    FROM public.contacts c
    WHERE c.account_id = 10
),
migrated_entry_points AS (
    SELECT COALESCE(
        jsonb_agg(
            (ep - 'name' - 'likely_pressure' - 'what_failure_looks_like'
                 - 'best_themes' - 'narrative_openings' - 'tired_of_hearing')
            || jsonb_build_object(
                'operational_pain',
                    COALESCE(
                        NULLIF(trim(ep ->> 'operational_pain'), ''),
                        NULLIF(trim(concat_ws(
                            E'\n\n',
                            NULLIF(trim(ep ->> 'likely_pressure'), ''),
                            NULLIF(trim(ep ->> 'what_failure_looks_like'), '')
                        )), ''),
                        trim(ep ->> 'likely_pressure')
                    ),
                'conversation_wedge',
                    COALESCE(
                        NULLIF(trim(ep ->> 'conversation_wedge'), ''),
                        NULLIF(trim(concat_ws(
                            E'\n\n',
                            NULLIF(trim(ep ->> 'best_themes'), ''),
                            NULLIF(trim(ep ->> 'narrative_openings'), '')
                        )), ''),
                        trim(ep ->> 'best_themes')
                    ),
                'contact_id',
                    COALESCE(
                        NULLIF(trim(ep ->> 'contact_id'), ''),
                        (
                            SELECT cs.id::text
                            FROM contact_slots cs
                            WHERE lower(cs.full_name) = lower(trim(ep ->> 'contact_name'))
                            LIMIT 1
                        ),
                        (
                            SELECT cs.id::text
                            FROM contact_slots cs
                            WHERE cs.rn = ord
                            LIMIT 1
                        )
                    )
            )
            ORDER BY ord
        ),
        '[]'::jsonb
    ) AS payload
    FROM public.account_plans ap
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(ap.plan #> '{current_draft,sections,entry_points}', '[]'::jsonb)
    ) WITH ORDINALITY AS arr(ep, ord)
    WHERE ap.account_id = 10
)
UPDATE public.account_plans ap
SET
    plan = jsonb_set(
        ap.plan,
        '{current_draft,sections,entry_points}',
        (SELECT payload FROM migrated_entry_points),
        true
    ),
    updated_at = now()
WHERE ap.account_id = 10
  AND jsonb_array_length(COALESCE(ap.plan #> '{current_draft,sections,entry_points}', '[]'::jsonb)) > 0;


-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
SELECT
    ap.account_id,
    a.name AS account_name,
    left(ap.plan #>> '{current_draft,sections,pursuit_thesis,thesis}', 80) AS thesis_preview,
    ap.plan #>> '{current_draft,sections,pursuit_thesis,action_forcing_event}' IS NOT NULL AS has_action_forcing,
    jsonb_array_length(COALESCE(ap.plan #> '{current_draft,sections,plan_30_60_90,client_commitments}', '[]'::jsonb)) AS give_get_count,
    jsonb_array_length(COALESCE(ap.plan #> '{current_draft,sections,critical_unknowns,blindspots}', '[]'::jsonb)) AS blindspot_count,
    ap.plan #>> '{current_draft,sections,critical_unknowns,unknowns}' IS NOT NULL AS still_has_legacy_unknowns_blob
FROM public.account_plans ap
JOIN public.accounts a ON a.id = ap.account_id
WHERE ap.account_id = 10;

SELECT
    ep.ordinality,
    ep.value ->> 'contact_name' AS contact_name,
    ep.value ->> 'contact_id' AS contact_id,
    left(ep.value ->> 'operational_pain', 60) AS operational_pain_preview,
    left(ep.value ->> 'conversation_wedge', 60) AS conversation_wedge_preview,
    (ep.value ? 'likely_pressure') AS has_legacy_likely_pressure
FROM public.account_plans ap
CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(ap.plan #> '{current_draft,sections,entry_points}', '[]'::jsonb)
) WITH ORDINALITY AS ep(value, ordinality)
WHERE ap.account_id = 10
ORDER BY ep.ordinality;
