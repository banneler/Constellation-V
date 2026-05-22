-- =============================================================================
-- Seed a robust Strategic Account OS plan for account_id = 10
-- Run in Supabase SQL Editor (requires public.account_plans + public.accounts).
--
-- Safe to re-run: upserts on account_id. Replace narrative copy as needed.
-- Influence mapping auto-picks up to 2 contacts on the account when present.
-- =============================================================================

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
executive_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', cs.id::text,
                'notes', trim(both FROM format(
                    '%s %s — %s. Executive sponsor; focus on strategic outcomes and board-level risk.',
                    COALESCE(cs.first_name, ''),
                    COALESCE(cs.last_name, ''),
                    COALESCE(cs.title, 'Executive')
                ))
            )
            ORDER BY cs.rn
        ),
        '[]'::jsonb
    ) AS payload
    FROM contact_slots cs
    WHERE cs.rn <= 2
),
mid_level_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', cs.id::text,
                'notes', trim(both FROM format(
                    '%s %s — Operational champion. Wedge for day-to-day credibility and expansion.',
                    COALESCE(cs.first_name, ''),
                    COALESCE(cs.last_name, '')
                ))
            )
            ORDER BY cs.rn
        ),
        '[]'::jsonb
    ) AS payload
    FROM contact_slots cs
    WHERE cs.rn BETWEEN 3 AND 4
),
sample_plan AS (
    SELECT jsonb_build_object(
        'schema_version', 1,
        'current_draft', jsonb_build_object(
            'updated_at', to_jsonb(now() AT TIME ZONE 'utc'),
            'last_milestone_at', to_jsonb(now() AT TIME ZONE 'utc'),
            'sections', jsonb_build_object(
                'pursuit_thesis', jsonb_build_object(
                    'core', $pursuit_core$
Multi-site gaming operations are hitting an inflection point: legacy WAN and fragmented security are driving outage anxiety and slowing new property rollouts. Executive pressure to modernize without betting the business on a rip-and-replace creates a window for a credible operator who can prove value on one high-visibility workflow first.
$pursuit_core$,
                    'cost_of_standing_still', $cost_still$
Staying on incumbent MPLS and siloed firewalls increases fragility during peak event traffic, extends mean-time-to-recover, and compounds technical debt as each property customizes its own stack. Competitors who consolidate networking and security posture are shortening deployment cycles for new locations.
$cost_still$,
                    'timing', $timing$
FY budget planning and a planned data-center refresh in Q3 create a natural evaluation cycle. A recent minor outage during a tournament weekend elevated reliability to a board talking point — trigger event for change.
$timing$
                ),
                'strategic_tensions', jsonb_build_object(
                    'selected_pills', jsonb_build_array(
                        'Scale',
                        'Innovation',
                        'Agility',
                        'Cloud',
                        'Automation'
                    ),
                    'narrative', $tensions$
They want cloud agility and centralized visibility but must satisfy tribal gaming compliance and property-level autonomy. IT leadership is torn between standardizing on one platform vs. letting each property optimize locally.
$tensions$
                ),
                'influence_mapping', jsonb_build_object(
                    'executive', (SELECT payload FROM executive_json),
                    'mid_level', (SELECT payload FROM mid_level_json),
                    'invisible_org_chart', $invisible$
The CFO''s chief of staff shapes vendor shortlists before formal RFPs. The regional ops director (not in IT) vetoed the last network refresh — strong informal gate on anything that touches floor uptime. Security consultant on retainer influences CISO recommendations.
$invisible$
                ),
                'competitive_landscape', jsonb_build_object(
                    'incumbents', $incumbents$
Incumbent national carrier holds MPLS contracts with 18 months remaining; strong relationship with procurement but perceived as slow on security integration. Regional MSP handles property firewalls — cheap but inconsistent. Hyperscaler direct sales team actively pitching SD-WAN overlay.
$incumbents$,
                    'positioning_pills', jsonb_build_array(
                        'Operationally credible',
                        'Highly responsive',
                        'Long-term strategic partner'
                    ),
                    'narrative', $comp_narrative$
Position as the operator who de-risks peak-event networking first, then earns the right to expand into unified security and property onboarding playbooks — not a rip-and-replace vendor.
$comp_narrative$
                ),
                'land_and_expand', jsonb_build_object(
                    'initial_entry', $land_entry$
Managed SD-WAN pilot at the flagship property covering tournament weekend traffic, with 24/7 runbook co-authored with their NOC.
$land_entry$,
                    'trust_creation', $land_trust$
Deliver a clean event with zero Sev-1 network incidents and a post-mortem they can take to the board; document MTTR improvement vs. baseline.
$land_trust$,
                    'expansion_path', $land_expand$
Roll standard template to two regional properties, then bundle SASE for remote property managers, then centralize security policy for new location onboarding.
$land_expand$
                ),
                'psychology', jsonb_build_object(
                    'bureaucracy_level', 4,
                    'risk_appetite', 2,
                    'technical_sophistication', 3,
                    'vendor_loyalty', 3,
                    'decision_velocity', 2
                ),
                'relationship_momentum', jsonb_build_object(
                    'score', 4,
                    'narrative', $momentum$
Gaining access: introduced to VP Infrastructure after successful technical workshop. Trust improving after we shared a reference architecture tuned to gaming peak loads. Still need executive sponsor meeting with CFO office.
$momentum$
                ),
                'plan_30_60_90', jsonb_build_object(
                    'days_30', $days_30$
• Complete discovery workshops with NOC and security (owners: AE + SE)
• Document tournament-weekend traffic baseline and failure modes
• Secure read-only access for architecture assessment
• Align on pilot success criteria with VP Infrastructure
$days_30$,
                    'days_60', $days_60$
• Deliver pilot proposal and business case draft for flagship property
• Map compliance constraints with internal audit contact
• Introduce executive reference from similar multi-site operator
• Mid-level champions review runbook and staffing model
$days_60$,
                    'days_90', $days_90$
• Pilot kickoff (if approved) or formal RFP response
• QBR with VP + CFO delegate on ROI and risk reduction
• Publish expansion roadmap for 3-property template
• Force-commit strategic plan milestone after first operational win
$days_90$
                )
            )
        ),
        'history', jsonb_build_array(
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'committed_at', to_jsonb(now() AT TIME ZONE 'utc'),
                'reason', 'manual_force_commit',
                'label', to_char(now() AT TIME ZONE 'utc', 'Mon DD, YYYY HH12:MI AM') || ' — Manual commit (seed)',
                'snapshot', jsonb_build_object(
                    'updated_at', to_jsonb(now() AT TIME ZONE 'utc'),
                    'last_milestone_at', to_jsonb(now() AT TIME ZONE 'utc'),
                    'sections', jsonb_build_object(
                        'relationship_momentum', jsonb_build_object(
                            'score', 3,
                            'narrative', 'Initial seed snapshot — momentum warming after first workshop.'
                        )
                    )
                )
            )
        )
    ) AS plan
)
INSERT INTO public.account_plans (account_id, plan, created_by)
SELECT
    10,
    sp.plan,
    a.user_id
FROM sample_plan sp
CROSS JOIN public.accounts a
WHERE a.id = 10
ON CONFLICT (account_id) DO UPDATE
SET
    plan = EXCLUDED.plan,
    updated_at = now();

-- Verify
SELECT
    ap.account_id,
    a.name AS account_name,
    ap.updated_at,
    ap.plan -> 'current_draft' -> 'sections' -> 'pursuit_thesis' ->> 'core' AS pursuit_core_preview,
    jsonb_array_length(COALESCE(ap.plan -> 'current_draft' -> 'sections' -> 'influence_mapping' -> 'executive', '[]'::jsonb)) AS executive_contacts,
    ap.plan -> 'current_draft' -> 'sections' -> 'relationship_momentum' ->> 'score' AS momentum_score
FROM public.account_plans ap
JOIN public.accounts a ON a.id = ap.account_id
WHERE ap.account_id = 10;
