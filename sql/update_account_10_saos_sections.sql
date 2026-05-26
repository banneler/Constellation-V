-- =============================================================================
-- Demo account plan upgrade — fill in the SAOS sections added after the
-- original seed (Account ID = 10, "tribal gaming" pursuit storyline).
--
-- Run in Supabase SQL Editor AFTER:
--     sql/seed_account_plan_account_10.sql
--     sql/seed_account_10_timeline_entry_points.sql
--
-- This script is a surgical PATCH (not a full reseed):
--   • Sections that didn't exist in the old seed are inserted whole:
--       account_snapshot, pain_signals, critical_unknowns, white_space,
--       entrenchment, interaction_log
--   • Sections that already exist get deep-merged so we keep the existing
--       narrative copy and only ADD the new fields the UI now expects:
--       pursuit_thesis  (+ why_account_matters, executive_narrative)
--       influence_mapping (+ technical, political_dynamics, access_path)
--       psychology      (+ gravity fields and narrative)
--
-- Safe to re-run: every section uses jsonb `||` (object merge) inside a
-- single jsonb_set at the {current_draft,sections} path, so values are
-- overwritten in-place on second run with no duplication or array growth.
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
exec_contact AS (
    SELECT id, first_name, last_name FROM contact_slots WHERE rn = 1
),
noc_contact AS (
    SELECT id, first_name, last_name FROM contact_slots WHERE rn = 2
),
cfo_contact AS (
    SELECT id, first_name, last_name FROM contact_slots WHERE rn = 3
),
section_patch AS (
    SELECT jsonb_build_object(
        -- ---------------------------------------------------------------
        -- account_snapshot — Firmographics JUDGMENTS (firmographic facts
        -- come from the CRM/accounts table; this object holds the
        -- strategic interpretation the rep is committing to).
        -- ---------------------------------------------------------------
        'account_snapshot', jsonb_build_object(
            'tier', 'Tier 1',
            'relationship_status', 'Active Pursuit',
            'ai_cloud_maturity', 'Medium',
            'strategic_patience', 'High',
            'pursuit_priority', 'High',
            'existing_providers',
                'Incumbent national carrier on MPLS (18 mo remaining); regional MSP on property firewalls; hyperscaler direct sales actively pitching SD-WAN overlay.',
            'expansion_potential',
                'Land flagship-property SD-WAN pilot, expand to 2 regional properties, then bundle SASE + centralized security policy for new property onboarding.'
        ),

        -- ---------------------------------------------------------------
        -- pain_signals — operational + strategic pain pills + context.
        -- Pill labels MUST match PAIN_SIGNAL_PILLS in
        -- js/account-plan-sections.js or the UI silently drops them.
        -- ---------------------------------------------------------------
        'pain_signals', jsonb_build_object(
            'selected', jsonb_build_array(
                'Operational fragility',
                'Security exposure',
                'Vendor dissatisfaction',
                'Legacy debt'
            ),
            'notes',
                'Tournament-weekend outage exposed brittle MPLS + property-level firewall sprawl. NOC is firefighting instead of architecting. Board surfaced reliability as a strategic risk. Incumbent carrier perceived as slow on security integration.'
        ),

        -- ---------------------------------------------------------------
        -- critical_unknowns — what we still need to learn + the language
        -- executives use when they talk about uncertainty.
        -- ---------------------------------------------------------------
        'critical_unknowns', jsonb_build_object(
            'unknowns',
                E'• Will Q3 data-center refresh budget actually unlock SD-WAN net-new spend, or is it locked to incumbent renewal?\n• Who in the CFO office has hard veto on multi-property contracts under $X?\n• Compliance posture on tribal gaming regulations — does our pilot scope require additional audit involvement?\n• What is the real cost (political + operational) of carrying both MPLS and SD-WAN during pilot overlap?',
            'executive_language_pills', jsonb_build_array(
                'Resiliency',
                'Risk reduction',
                'Modernization'
            ),
            'executive_language_notes',
                'CFO office frames the conversation as risk-adjusted modernization, not innovation. Avoid "transformation" language; lead with reliability + sequenced spend.'
        ),

        -- ---------------------------------------------------------------
        -- white_space — opportunities by framework area. Each row matches
        -- the createEmptyWhiteSpaceRow() shape exactly.
        -- ---------------------------------------------------------------
        'white_space', jsonb_build_array(
            jsonb_build_object(
                'area', 'SD-WAN',
                'opportunity', 'Flagship property pilot covering tournament-weekend traffic, with co-authored NOC runbook.',
                'operational_importance', 'High',
                'executive_visibility', 'High',
                'confidence', 'High',
                'value_notes', 'Wedge deal. Sets the reference architecture all subsequent property rollouts compound onto.'
            ),
            jsonb_build_object(
                'area', 'Security',
                'opportunity', 'Centralized SASE policy + unified firewall posture replacing per-property MSP sprawl.',
                'operational_importance', 'High',
                'executive_visibility', 'Medium',
                'confidence', 'Medium',
                'value_notes', 'Phase 2. Land on SD-WAN reliability first, then earn the right to consolidate security spend.'
            ),
            jsonb_build_object(
                'area', 'DR',
                'opportunity', 'Multi-site failover for gaming-floor systems during peak-event windows.',
                'operational_importance', 'High',
                'executive_visibility', 'Medium',
                'confidence', 'Medium',
                'value_notes', 'Natural extension once SD-WAN is in place; quantify with MTTR baseline from pilot.'
            ),
            jsonb_build_object(
                'area', 'UCaaS',
                'opportunity', 'Property-to-corporate voice consolidation; replace aging on-prem PBX at 2 regional sites.',
                'operational_importance', 'Medium',
                'executive_visibility', 'Low',
                'confidence', 'Low',
                'value_notes', 'Opportunistic. Surface during pilot QBR only if CIO raises voice as a budget item.'
            )
        ),

        -- ---------------------------------------------------------------
        -- entrenchment — incumbent moats + why they're hard to dislodge.
        -- moat_pills must match ENTRENCHMENT_MOAT_PILLS.
        -- ---------------------------------------------------------------
        'entrenchment', jsonb_build_object(
            'moat_pills', jsonb_build_array(
                'Multi-year contracts',
                'Operational dependency',
                'Switching cost narrative'
            ),
            'compound_relationships',
                'Incumbent carrier has 18 months remaining on MPLS contracts across all properties and a strong relationship with procurement. Regional MSP is embedded in property-level firewall change windows — cheap to renew, expensive to displace politically.',
            'difficult_to_remove',
                'Procurement views incumbent as the "safe" choice; CFO office is wary of overlapping spend during pilot. Property managers have direct lines to the MSP rep — the relationship is personal, not contractual. Our path is to be additive (overlay) during pilot, then earn consolidation rights.'
        ),

        -- ---------------------------------------------------------------
        -- interaction_log — recent structured relationship events.
        -- Shape matches createEmptyInteractionLogEntry() exactly:
        --   id, date, source, contact_id (string|null), interaction,
        --   key_insight, text, political_signal, relationship_energy,
        --   trust_earned, momentum_shift, next_move, activity_id.
        --
        -- contact_id is bound to the live contacts via the CTEs above;
        -- if the account has fewer contacts seeded, the COALESCE keeps
        -- the entry valid (null contact_id = unassigned in the UI).
        -- ---------------------------------------------------------------
        'interaction_log', jsonb_build_array(
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'date', to_jsonb((now() AT TIME ZONE 'utc') - interval '42 days'),
                'source', 'manual',
                'contact_id', (SELECT id::text FROM exec_contact),
                'interaction', 'Technical workshop with NOC + VP Infrastructure',
                'key_insight', 'They are tired of vendor pitch decks — they responded to packet captures and failure-mode walkthroughs. Buy psychology = engineer-first.',
                'text', 'Walked through baseline architecture, captured MTTR data from last 3 tournament weekends, agreed on pilot success criteria.',
                'political_signal', 'Positive',
                'relationship_energy', 'High',
                'trust_earned', 'Yes',
                'momentum_shift', 'Forward',
                'next_move', 'Send reference architecture tuned for gaming peak loads.',
                'activity_id', null
            ),
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'date', to_jsonb((now() AT TIME ZONE 'utc') - interval '21 days'),
                'source', 'signal',
                'contact_id', (SELECT id::text FROM noc_contact),
                'interaction', 'NOC lead asked for staffing model details before pilot kickoff',
                'key_insight', 'NOC is short-staffed for peak events. They will reject anything framed as "another pane of glass" — pitch needs to lead with reduced midnight bridge calls.',
                'text', 'Slack thread with NOC lead about pilot monitoring + on-call escalation paths.',
                'political_signal', 'Cautious',
                'relationship_energy', 'Medium',
                'trust_earned', 'Partial',
                'momentum_shift', 'Hold',
                'next_move', 'Schedule working session to finalize monitoring + escalation runbook.',
                'activity_id', null
            ),
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'date', to_jsonb((now() AT TIME ZONE 'utc') - interval '12 days'),
                'source', 'manual',
                'contact_id', (SELECT id::text FROM cfo_contact),
                'interaction', 'CFO office delegate call — ROI framing',
                'key_insight', 'CFO office wants a one-page business case with best/base/conservative scenarios BEFORE the exec readout — not after. Skipping this step kills the deal.',
                'text', 'Aligned on pilot ROI framing and risk-reduction narrative. Skeptical on TCO until they see sensitivity analysis.',
                'political_signal', 'Cautious',
                'relationship_energy', 'Medium',
                'trust_earned', 'No',
                'momentum_shift', 'Hold',
                'next_move', 'Deliver one-page ROI doc by EOW; preview with VP Infrastructure before formal submission.',
                'activity_id', null
            ),
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'date', to_jsonb((now() AT TIME ZONE 'utc') - interval '2 days'),
                'source', 'activity',
                'contact_id', null,
                'interaction', 'LinkedIn connect with regional ops director',
                'key_insight', 'Regional ops director vetoed the LAST network refresh — owning this relationship is a forcing function, not optional.',
                'text', 'Met informally at industry event; he agreed to a 30-min coffee next month. Not in IT chain of command but informal gate on property-floor changes.',
                'political_signal', 'Positive',
                'relationship_energy', 'Medium',
                'trust_earned', 'Partial',
                'momentum_shift', 'Forward',
                'next_move', 'Book coffee meeting; bring one peer reference from a similar multi-site venue.',
                'activity_id', null
            )
        )
    ) AS new_sections
)

UPDATE public.account_plans ap
SET
    plan = jsonb_set(
        ap.plan,
        '{current_draft,sections}',
        COALESCE(ap.plan #> '{current_draft,sections}', '{}'::jsonb)
        -- shallow-merge the new whole-object sections
        || (SELECT new_sections FROM section_patch)
        -- deep-merge pursuit_thesis (preserve existing core/cost/timing copy)
        || jsonb_build_object(
            'pursuit_thesis',
            COALESCE(ap.plan #> '{current_draft,sections,pursuit_thesis}', '{}'::jsonb)
            || jsonb_build_object(
                'why_account_matters',
                    'Flagship multi-site gaming logo with peer-influence across the tribal gaming consortium. Winning the wedge here creates a reference architecture story we can reuse across the segment and unlocks 2-3 follow-on property rollouts inside 12 months.',
                'executive_narrative',
                    'Executives talk about modernization in terms of board-level uptime risk and the cost of standing still — not innovation theater. Mirror their language: phased de-risking, measurable MTTR gains, no rip-and-replace.'
            )
        )
        -- deep-merge influence_mapping (preserve executive + mid_level + invisible_org_chart)
        || jsonb_build_object(
            'influence_mapping',
            COALESCE(ap.plan #> '{current_draft,sections,influence_mapping}', '{}'::jsonb)
            || jsonb_build_object(
                'technical', COALESCE(
                    ap.plan #> '{current_draft,sections,influence_mapping,technical}',
                    '[]'::jsonb
                ),
                'political_dynamics',
                    'Two factions: VP Infrastructure (wants modernization, owns reliability narrative) vs. CFO office (wants spend discipline, anchored on incumbent renewal). NOC lead is the credibility bridge — winning him neutralizes CFO friction. Regional ops director is the informal gate on property-floor changes; failing to engage him sank the last refresh.',
                'access_path', jsonb_build_object(
                    'current', 'Direct access to VP Infrastructure and NOC lead via technical workshop track.',
                    'desired', 'Executive sponsor meeting with CFO office (delegate or principal); seat at the Q3 refresh planning table.',
                    'bridge', 'NOC lead can introduce CFO delegate after pilot scoping is signed off. Regional ops director can vouch for property-floor impact.',
                    'strategy', 'Earn CFO access by arriving with a one-page ROI in their language (risk-adjusted, phased, sensitivity-tested) — do NOT ask VP Infrastructure to forward us. Use the post-workshop momentum to request the readout directly.'
                )
            )
        )
        -- deep-merge psychology (preserve the 5 slider values)
        || jsonb_build_object(
            'psychology',
            COALESCE(ap.plan #> '{current_draft,sections,psychology}', '{}'::jsonb)
            || jsonb_build_object(
                'organizational_gravity', 'High',
                'consensus_requirement', 'High',
                'procurement_friction', 'High',
                'innovation_friction', 'Medium',
                'narrative',
                    'Heavy consensus-driven org with strong procurement gravity. Innovation is tolerated only when it can be framed as risk-adjusted modernization. Decisions require executive cover from VP Infrastructure plus CFO office sign-off; bypassing either path stalls the deal.'
            )
        ),
        true
    ),
    updated_at = now()
WHERE ap.account_id = 10;


-- ---------------------------------------------------------------------------
-- Strip any legacy `name` field from existing entry points.
--
-- Entry points are about contacts, not opportunities — the carousel tabs
-- read off contact_name (with an "Entry Point N" numeric fallback). An
-- earlier iteration patched a `name` field onto each entry point; this
-- block removes it so the saved demo data matches the simplified schema.
-- Safe to re-run: if `name` is already absent the `-` operator is a no-op.
-- ---------------------------------------------------------------------------
UPDATE public.account_plans ap
SET plan = jsonb_set(
    ap.plan,
    '{current_draft,sections,entry_points}',
    COALESCE(
        (
            SELECT jsonb_agg((ep - 'name') ORDER BY ord)
            FROM jsonb_array_elements(
                COALESCE(ap.plan #> '{current_draft,sections,entry_points}', '[]'::jsonb)
            ) WITH ORDINALITY AS arr(ep, ord)
        ),
        '[]'::jsonb
    ),
    true
),
updated_at = now()
WHERE ap.account_id = 10
  AND jsonb_array_length(COALESCE(ap.plan #> '{current_draft,sections,entry_points}', '[]'::jsonb)) > 0;


-- ---------------------------------------------------------------------------
-- Verify — confirms which of the new sections now resolve to non-null/non-empty
-- ---------------------------------------------------------------------------
SELECT
    ap.account_id,
    a.name AS account_name,
    ap.updated_at,
    jsonb_array_length(COALESCE(ap.plan #> '{current_draft,sections,white_space}', '[]'::jsonb)) AS white_space_rows,
    jsonb_array_length(COALESCE(ap.plan #> '{current_draft,sections,interaction_log}', '[]'::jsonb)) AS interaction_log_rows,
    jsonb_array_length(COALESCE(ap.plan #> '{current_draft,sections,pain_signals,selected}', '[]'::jsonb)) AS pain_pills,
    jsonb_array_length(COALESCE(ap.plan #> '{current_draft,sections,critical_unknowns,executive_language_pills}', '[]'::jsonb)) AS critical_unknowns_pills,
    jsonb_array_length(COALESCE(ap.plan #> '{current_draft,sections,entrenchment,moat_pills}', '[]'::jsonb)) AS moat_pills,
    ap.plan #>> '{current_draft,sections,account_snapshot,tier}' AS snapshot_tier,
    ap.plan #>> '{current_draft,sections,psychology,organizational_gravity}' AS gravity,
    ap.plan #>> '{current_draft,sections,influence_mapping,political_dynamics}' IS NOT NULL AS has_political_dynamics,
    ap.plan #>> '{current_draft,sections,pursuit_thesis,why_account_matters}' IS NOT NULL AS has_why_account_matters
FROM public.account_plans ap
JOIN public.accounts a ON a.id = ap.account_id
WHERE ap.account_id = 10;

-- Entry points — carousel labels read off contact_name; numeric fallback if blank.
SELECT
    ep.ordinality AS entry_point_num,
    ep.value ->> 'contact_name' AS contact_name,
    ep.value ->> 'trust_level' AS trust_level,
    ep.value ? 'name' AS has_legacy_name_field
FROM public.account_plans ap
CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(ap.plan -> 'current_draft' -> 'sections' -> 'entry_points', '[]'::jsonb)
) WITH ORDINALITY AS ep(value, ordinality)
WHERE ap.account_id = 10
ORDER BY ep.ordinality;
