-- =============================================================================
-- Account 10 — timeline demo data (CRM activities + plan milestones + entry points)
-- Run in Supabase SQL Editor after account 10, its contacts, and account_plans exist.
--
-- Populates:
--   • public.activities        — historical CRM activity for Relationship Timeline (right rail)
--   • account_plans.plan       — entry_points (×3) + history milestones (left rail)
--
-- Safe to re-run: replaces account-10 seed activities; upserts plan JSON for account 10.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Historical CRM activities (account_id = 10)
-- ---------------------------------------------------------------------------
DELETE FROM public.activities
WHERE account_id = 10;

WITH contact_slots AS (
    SELECT
        c.id,
        c.first_name,
        c.last_name,
        row_number() OVER (ORDER BY c.id) AS rn
    FROM public.contacts c
    WHERE c.account_id = 10
),
contact_count AS (
    SELECT count(*)::int AS n FROM contact_slots
),
activity_seed AS (
    SELECT *
    FROM (
        VALUES
            (1, 'Email', 'Sent intro and gaming peak-traffic case study after tournament-weekend outage mention.', (now() AT TIME ZONE 'utc') - interval '74 days', false),
            (1, 'Call', 'Discovery call with VP Infrastructure — documented WAN pain and property rollout delays.', (now() AT TIME ZONE 'utc') - interval '61 days', false),
            (2, 'Meeting', 'Technical workshop with NOC leadership; reviewed baseline architecture and failure modes.', (now() AT TIME ZONE 'utc') - interval '44 days', false),
            (2, 'Email', 'Shared reference architecture tuned for multi-site gaming operations.', (now() AT TIME ZONE 'utc') - interval '31 days', false),
            (3, 'Call', 'CFO office delegate call — aligned pilot ROI framing and risk-reduction narrative.', (now() AT TIME ZONE 'utc') - interval '18 days', false),
            (1, 'Meeting', 'Pilot scoping session: flagship property SD-WAN success criteria and runbook owners.', (now() AT TIME ZONE 'utc') - interval '9 days', false),
            (2, 'Email', 'Delivered draft runbook and post-event MTTR comparison for internal review.', (now() AT TIME ZONE 'utc') - interval '3 days', false),
            (3, 'LinkedIn', 'Connected with regional ops director after industry event — informal influence path opened.', (now() AT TIME ZONE 'utc') - interval '1 day', false)
    ) AS v(slot_rn, type, description, activity_date, logged_to_sf)
)
INSERT INTO public.activities (contact_id, account_id, type, description, date, user_id, logged_to_sf)
SELECT
    cs.id,
    10,
    s.type,
    s.description,
    s.activity_date,
    a.user_id,
    s.logged_to_sf
FROM activity_seed s
CROSS JOIN contact_count cc
JOIN contact_slots cs ON cs.rn = LEAST(s.slot_rn, GREATEST(cc.n, 1))
JOIN public.accounts a ON a.id = 10
WHERE cc.n > 0;

-- ---------------------------------------------------------------------------
-- 2) Strategic plan — 3 entry points + milestone history for timeline
-- ---------------------------------------------------------------------------
WITH contact_slots AS (
    SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.title,
        row_number() OVER (ORDER BY c.id) AS rn
    FROM public.contacts c
    WHERE c.account_id = 10
),
entry_points_json AS (
    SELECT COALESCE(
        (
            SELECT jsonb_agg(entry_obj ORDER BY rn)
            FROM (
                SELECT
                    cs.rn,
                    jsonb_build_object(
                        'contact_name', trim(both FROM format('%s %s', COALESCE(cs.first_name, ''), COALESCE(cs.last_name, ''))),
                        'why_they_matter', CASE cs.rn
                            WHEN 1 THEN 'Executive sponsor for infrastructure modernization; owns board narrative on uptime and new property rollouts.'
                            WHEN 2 THEN 'NOC lead and day-to-day operational champion; gatekeeper for runbook adoption and pilot execution.'
                            ELSE 'CFO office influencer on vendor spend; shapes ROI threshold before formal RFP.'
                        END,
                        'likely_pressure', CASE cs.rn
                            WHEN 1 THEN 'Tournament-weekend outages elevated reliability to a board topic; must show de-risked path without rip-and-replace.'
                            WHEN 2 THEN 'Staffing gaps during peak events; firefighting leaves no bandwidth for architecture projects.'
                            ELSE 'Capital constraints and scrutiny on any contract that touches all properties at once.'
                        END,
                        'trust_level', CASE cs.rn WHEN 1 THEN 'Trusted' WHEN 2 THEN 'Warm' ELSE 'Cold' END,
                        'responsiveness', CASE cs.rn WHEN 1 THEN 'High' WHEN 2 THEN 'Medium' ELSE 'Low' END,
                        'political_influence', CASE cs.rn WHEN 1 THEN 'High' WHEN 2 THEN 'Medium' ELSE 'High' END,
                        'best_themes', CASE cs.rn
                            WHEN 1 THEN 'Operational credibility, phased modernization, measurable MTTR gains'
                            WHEN 2 THEN 'Runbook co-authorship, faster triage, fewer midnight bridge calls'
                            ELSE 'Risk-adjusted ROI, phased spend, avoid stranded MPLS overlap costs'
                        END,
                        'narrative_openings', CASE cs.rn
                            WHEN 1 THEN 'Reference the recent event weekend and ask what “good” looks like before the Q3 refresh decision.'
                            WHEN 2 THEN 'Offer to shadow one tournament weekend and document top three failure modes together.'
                            ELSE 'Lead with cost-of-standing-still on outage exposure vs. incremental pilot investment.'
                        END,
                        'human_context', CASE cs.rn
                            WHEN 1 THEN 'Pragmatic operator; responds to peer references over vendor pitch decks.'
                            WHEN 2 THEN 'Detail-oriented; trusts engineers who show up prepared with packet captures and timelines.'
                            ELSE 'Numbers-first; wants one-page business case with sensitivity analysis.'
                        END,
                        'mutual_connections', CASE cs.rn
                            WHEN 1 THEN 'Former colleague now at regional tribal gaming consortium.'
                            WHEN 2 THEN 'Shared SE contact from prior MSP evaluation.'
                            ELSE 'Audit partner recommended our operator at another multi-site venue.'
                        END,
                        'tired_of_hearing', CASE cs.rn
                            WHEN 1 THEN 'Generic SD-WAN slides without gaming-specific peak-load proof.'
                            WHEN 2 THEN '“We’ll automate everything” without staffing model clarity.'
                            ELSE 'Five-year TCO models without assumptions spelled out.'
                        END,
                        'next_move', CASE cs.rn
                            WHEN 1 THEN 'Secure 45-min executive readout with CFO delegate present.'
                            WHEN 2 THEN 'Schedule NOC working session to finalize pilot monitoring and escalation paths.'
                            ELSE 'Deliver one-page pilot business case with best/base/conservative scenarios.'
                        END,
                        'comm_style', CASE cs.rn WHEN 1 THEN 'Strategic' WHEN 2 THEN 'Concise' ELSE 'Analytical' END,
                        'compound_potential', CASE cs.rn WHEN 1 THEN 'High' WHEN 2 THEN 'High' ELSE 'Medium' END,
                        'what_failure_looks_like', CASE cs.rn
                            WHEN 1 THEN 'Pilot stalls in procurement while incumbent renews MPLS for 18 months.'
                            WHEN 2 THEN 'NOC team rejects overlay as “another pane of glass.”'
                            ELSE 'Budget locked before pilot proof; project deferred to next fiscal year.'
                        END
                    ) AS entry_obj
                FROM contact_slots cs
                WHERE cs.rn <= 3
            ) entries
        ),
        jsonb_build_array(
            jsonb_build_object(
                'contact_name', 'Alex Rivera',
                'why_they_matter', 'Placeholder — add contacts on account 10 to auto-populate.',
                'likely_pressure', 'Board pressure on uptime.',
                'trust_level', 'Warm', 'responsiveness', 'Medium', 'political_influence', 'High',
                'best_themes', 'Operational credibility', 'narrative_openings', 'Reference recent outage.',
                'human_context', 'Pragmatic operator.', 'mutual_connections', '',
                'tired_of_hearing', 'Generic pitch decks.', 'next_move', 'Book executive readout.',
                'comm_style', 'Strategic', 'compound_potential', 'High',
                'what_failure_looks_like', 'Pilot deferred to next fiscal year.'
            ),
            jsonb_build_object(
                'contact_name', 'Jordan Lee',
                'why_they_matter', 'NOC champion for pilot execution.',
                'likely_pressure', 'Peak-event staffing gaps.',
                'trust_level', 'Warm', 'responsiveness', 'High', 'political_influence', 'Medium',
                'best_themes', 'Runbook co-authorship', 'narrative_openings', 'Shadow tournament weekend.',
                'human_context', 'Detail-oriented engineer.', 'mutual_connections', '',
                'tired_of_hearing', 'Vague automation promises.', 'next_move', 'Finalize monitoring paths.',
                'comm_style', 'Concise', 'compound_potential', 'High',
                'what_failure_looks_like', 'Rejected as another pane of glass.'
            ),
            jsonb_build_object(
                'contact_name', 'Sam Ortiz',
                'why_they_matter', 'CFO office ROI gatekeeper.',
                'likely_pressure', 'Capital constraints across properties.',
                'trust_level', 'Cold', 'responsiveness', 'Low', 'political_influence', 'High',
                'best_themes', 'Phased ROI', 'narrative_openings', 'Cost of standing still.',
                'human_context', 'Numbers-first.', 'mutual_connections', '',
                'tired_of_hearing', 'Opaque TCO models.', 'next_move', 'Deliver one-page business case.',
                'comm_style', 'Analytical', 'compound_potential', 'Medium',
                'what_failure_looks_like', 'Budget locked before pilot proof.'
            )
        )
    ) AS payload
),
plan_patch AS (
    SELECT jsonb_build_object(
        'entry_points', (SELECT payload FROM entry_points_json),
        'history', jsonb_build_array(
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'committed_at', to_jsonb((now() AT TIME ZONE 'utc') - interval '52 days'),
                'reason', 'manual_force_commit',
                'label', to_char((now() AT TIME ZONE 'utc') - interval '52 days', 'Mon DD, YYYY HH12:MI AM') || ' — Manual commit (initial strategy)',
                'snapshot', jsonb_build_object(
                    'updated_at', to_jsonb((now() AT TIME ZONE 'utc') - interval '52 days'),
                    'last_milestone_at', to_jsonb((now() AT TIME ZONE 'utc') - interval '52 days'),
                    'sections', jsonb_build_object(
                        'relationship_momentum', jsonb_build_object(
                            'score', 2,
                            'narrative', 'Early discovery — limited executive access; credibility building through technical workshops.'
                        )
                    )
                )
            ),
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'committed_at', to_jsonb((now() AT TIME ZONE 'utc') - interval '29 days'),
                'reason', 'auto_milestone',
                'label', to_char((now() AT TIME ZONE 'utc') - interval '29 days', 'Mon DD, YYYY HH12:MI AM') || ' — Auto milestone',
                'snapshot', jsonb_build_object(
                    'updated_at', to_jsonb((now() AT TIME ZONE 'utc') - interval '29 days'),
                    'last_milestone_at', to_jsonb((now() AT TIME ZONE 'utc') - interval '29 days'),
                    'sections', jsonb_build_object(
                        'relationship_momentum', jsonb_build_object(
                            'score', 3,
                            'narrative', 'Workshop complete; NOC engagement strong. Executive sponsor meeting still pending.'
                        )
                    )
                )
            ),
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'committed_at', to_jsonb((now() AT TIME ZONE 'utc') - interval '12 days'),
                'reason', 'auto_milestone',
                'label', to_char((now() AT TIME ZONE 'utc') - interval '12 days', 'Mon DD, YYYY HH12:MI AM') || ' — Auto milestone',
                'snapshot', jsonb_build_object(
                    'updated_at', to_jsonb((now() AT TIME ZONE 'utc') - interval '12 days'),
                    'last_milestone_at', to_jsonb((now() AT TIME ZONE 'utc') - interval '12 days'),
                    'sections', jsonb_build_object(
                        'relationship_momentum', jsonb_build_object(
                            'score', 4,
                            'narrative', 'VP Infrastructure engaged post-workshop; pilot scoping underway.'
                        )
                    )
                )
            ),
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'committed_at', to_jsonb(now() AT TIME ZONE 'utc'),
                'reason', 'manual_force_commit',
                'label', to_char(now() AT TIME ZONE 'utc', 'Mon DD, YYYY HH12:MI AM') || ' — Manual commit (pilot phase)',
                'snapshot', jsonb_build_object(
                    'updated_at', to_jsonb(now() AT TIME ZONE 'utc'),
                    'last_milestone_at', to_jsonb(now() AT TIME ZONE 'utc'),
                    'sections', jsonb_build_object(
                        'relationship_momentum', jsonb_build_object(
                            'score', 4,
                            'narrative', 'Pilot criteria aligned; runbook draft in review with NOC. CFO readout scheduled.'
                        )
                    )
                )
            )
        )
    ) AS patch
)
UPDATE public.account_plans ap
SET plan = jsonb_set(
    jsonb_set(
        ap.plan,
        '{current_draft,sections,entry_points}',
        (SELECT patch -> 'entry_points' FROM plan_patch),
        true
    ),
    '{history}',
    (SELECT patch -> 'history' FROM plan_patch),
    true
)
WHERE ap.account_id = 10;

-- If no plan row exists yet, run sql/seed_account_plan_account_10.sql first, then re-run this script.

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
SELECT
    'activities' AS source,
    count(*) AS row_count,
    min(a.date) AS oldest,
    max(a.date) AS newest
FROM public.activities a
WHERE a.account_id = 10

UNION ALL

SELECT
    'plan_milestones' AS source,
    jsonb_array_length(COALESCE(ap.plan -> 'history', '[]'::jsonb)) AS row_count,
    NULL::timestamptz,
    NULL::timestamptz
FROM public.account_plans ap
WHERE ap.account_id = 10

UNION ALL

SELECT
    'entry_points' AS source,
    jsonb_array_length(COALESCE(ap.plan -> 'current_draft' -> 'sections' -> 'entry_points', '[]'::jsonb)) AS row_count,
    NULL::timestamptz,
    NULL::timestamptz
FROM public.account_plans ap
WHERE ap.account_id = 10;

SELECT
    ep.ordinality AS entry_point_num,
    ep.value ->> 'contact_name' AS contact_name,
    ep.value ->> 'trust_level' AS trust_level,
    ep.value ->> 'next_move' AS next_move
FROM public.account_plans ap
CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(ap.plan -> 'current_draft' -> 'sections' -> 'entry_points', '[]'::jsonb)
) WITH ORDINALITY AS ep(value, ordinality)
WHERE ap.account_id = 10
ORDER BY ep.ordinality;

SELECT
    h.value ->> 'committed_at' AS committed_at,
    h.value ->> 'reason' AS reason,
    h.value ->> 'label' AS label
FROM public.account_plans ap
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ap.plan -> 'history', '[]'::jsonb)) AS h(value)
WHERE ap.account_id = 10
ORDER BY (h.value ->> 'committed_at') DESC;
