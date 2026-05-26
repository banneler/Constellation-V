/**
 * Strategic Account OS — section registry (canvas, TOC, export metadata).
 */

/** @typedef {'account_snapshot' | 'composite_textarea' | 'pills_and_narrative' | 'influence_board' | 'psychology_grid' | 'momentum' | 'timeline_view' | 'triple_textarea' | 'entry_point_carousel' | 'critical_unknowns' | 'blindspots_list' | 'entrenchment' | 'pain_signals' | 'white_space_matrix' | 'interaction_log'} PlanSectionType */

/** @typedef {'none' | 'lead' | 'block'} SectionContextMode */

/**
 * @typedef {Object} PlanFieldDef
 * @property {string} key
 * @property {string} [label]
 * @property {string} [hint]
 */

/**
 * @typedef {Object} PsychologySliderDef
 * @property {string} id
 * @property {string} label
 * @property {string} [hint]
 * @property {string} lowLabel
 * @property {string} highLabel
 * @property {'inverse' | 'direct'} [colorScale] inverse = high value is red/warn; direct = high value is green/good
 */

/** @type {PsychologySliderDef[]} */
export const PSYCHOLOGY_SLIDERS = Object.freeze([
    {
        id: 'bureaucracy_level',
        label: 'Bureaucracy Level',
        hint: 'Approval load and process friction across the organization.',
        lowLabel: 'Agile',
        highLabel: 'Heavy process',
        colorScale: 'inverse',
    },
    {
        id: 'risk_appetite',
        label: 'Risk Appetite',
        hint: 'Comfort with change versus maintaining the status quo.',
        lowLabel: 'Conservative',
        highLabel: 'Bold',
        colorScale: 'direct',
    },
    {
        id: 'technical_sophistication',
        label: 'Technical Sophistication',
        hint: 'Internal engineering depth versus need for managed support.',
        lowLabel: 'Basic',
        highLabel: 'Advanced',
        colorScale: 'direct',
    },
    {
        id: 'vendor_loyalty',
        label: 'Vendor Loyalty',
        hint: 'Transactional buying versus embedded strategic partnerships.',
        lowLabel: 'Transactional',
        highLabel: 'Embedded',
        colorScale: 'direct',
    },
    {
        id: 'decision_velocity',
        label: 'Decision Velocity',
        hint: 'Length of procurement and review cycles.',
        lowLabel: 'Slow',
        highLabel: 'Fast',
        colorScale: 'direct',
    },
]);

/**
 * @typedef {Object} PillGroupDef
 * @property {string} id
 * @property {[string, string]} options
 */

/** @type {PillGroupDef[]} */
export const STRATEGIC_TENSION_GROUPS = Object.freeze([
    { id: 'scale_reliability', options: ['Scale', 'Reliability'] },
    { id: 'innovation_governance', options: ['Innovation', 'Governance/Security'] },
    { id: 'cost_agility', options: ['Cost', 'Agility'] },
    { id: 'cloud_control', options: ['Cloud', 'Control'] },
    { id: 'automation_oversight', options: ['Automation', 'Human Oversight'] },
    { id: 'speed_stability', options: ['Speed', 'Stability'] },
    { id: 'agility_compliance', options: ['Agility', 'Compliance'] },
    { id: 'centralization_flexibility', options: ['Centralization', 'Flexibility'] },
    { id: 'build_buy', options: ['Build', 'Buy'] },
]);

/** @type {readonly string[]} */
export const ACCOUNT_SNAPSHOT_TIER_OPTIONS = Object.freeze(['', 'Tier 1', 'Tier 2', 'Tier 3']);

/** @type {readonly string[]} */
export const ACCOUNT_SNAPSHOT_LEVEL_OPTIONS = Object.freeze(['', 'Low', 'Medium', 'High']);

/** @type {readonly string[]} */
export const PAIN_SIGNAL_PILLS = Object.freeze([
    'Operational fragility',
    'Security exposure',
    'Cloud cost pressure',
    'Talent / skills gap',
    'Vendor dissatisfaction',
    'Executive mandate',
    'Compliance risk',
    'Legacy debt',
]);

/** @type {readonly string[]} */
export const CRITICAL_UNKNOWN_LANGUAGE_PILLS = Object.freeze([
    'Growth',
    'Resiliency',
    'Modernization',
    'Cost optimization',
    'Risk reduction',
    'Innovation',
    'Compliance',
]);

/** @type {readonly string[]} */
export const ENTRENCHMENT_MOAT_PILLS = Object.freeze([
    'Embedded integrations',
    'Multi-year contracts',
    'Operational dependency',
    'Executive sponsorship',
    'Data gravity',
    'Switching cost narrative',
]);

/** @type {readonly string[]} */
export const PSYCHOLOGY_GRAVITY_PILLS = Object.freeze(['Low', 'Medium', 'High']);

/** @type {readonly string[]} */
export const WHITE_SPACE_AREAS = Object.freeze([
    'Cloud',
    'Security',
    'AI',
    'Infrastructure',
    'SD-WAN',
    'DR',
    'UCaaS',
    'Wireless',
    'Backup',
]);

/** @type {readonly string[]} */
export const WHITE_SPACE_CONFIDENCE_OPTIONS = Object.freeze(['', 'High', 'Medium', 'Low']);

/** @type {readonly string[]} */
export const INFLUENCE_LEVEL_OPTIONS = Object.freeze(['', 'Low', 'Medium', 'High']);

/** @type {readonly string[]} */
export const INFLUENCE_RELATIONSHIP_TEMPERATURE_OPTIONS = Object.freeze(['', 'Cold', 'Warm', 'Hot']);

/** @type {readonly string[]} */
export const INFLUENCE_PERSONALITY_STYLE_OPTIONS = Object.freeze(['', 'Analytical', 'Driver', 'Amiable', 'Expressive']);

/** @deprecated Legacy combined labels — use STRATEGIC_TENSION_GROUPS */
export const STRATEGIC_TENSION_PILLS = Object.freeze(
    STRATEGIC_TENSION_GROUPS.map((group) => group.options.join(' vs. '))
);

/** @type {string[]} */
export const POSITIONING_PILLS = Object.freeze([
    'Operationally credible',
    'Highly responsive',
    'Long-term strategic partner',
    'Innovation leader',
    'Cost-efficient operator',
]);

// ---------------------------------------------------------------------------
// Strategic Ghosting + Insight Density configuration
// ---------------------------------------------------------------------------
// The sales psychology behind these constants: reps habitually treat the 30/60/90
// and Land & Expand boxes as a generic to-do list, divorced from the strategic
// contradictions ("tensions") that actually justify the pursuit. By forcing the
// active tension pills to "ghost" alongside those sections, we make it cognitively
// expensive to write an action plan that ignores the deal's underlying physics.
//
// Insight Density does the same thing for narrative boxes: reps tend to ramble in
// the Pursuit Thesis and Competitive Landscape sections. A soft 400-char nudge is
// long enough for a real "so what?" insight but short enough to discourage
// brain-dump paragraphs that downstream AI/PPTX engines cannot synthesize.
// ---------------------------------------------------------------------------

/**
 * Sections that should render the read-only "ghosted" reminder of currently
 * selected strategic_tensions pills. Kept in section metadata (not the UI layer)
 * so future developers can opt new sections in declaratively.
 *
 * @type {readonly string[]}
 */
export const TENSION_GHOST_SECTIONS = Object.freeze(['plan_30_60_90', 'land_and_expand']);

// ---------------------------------------------------------------------------
// Task 4 — Strategic Tension accountability prompt
// ---------------------------------------------------------------------------
// Sales psychology: when a tension is selected on the Strategic Tensions
// section (e.g. "Cloud" over "Control"), reps typically forget about that
// choice by the time they're drafting the Land & Expand strategy. The plan
// then drifts into a generic "build trust, expand footprint" template that
// could apply to any account.
//
// To force the rep to wire the tension THROUGH the solution, we render a
// short, direct prompt above the Land & Expand textareas whenever any
// strategic tension pill is active. The prompt is data-driven (this map)
// so future sections can be linked declaratively without touching the UI
// rendering code.
// ---------------------------------------------------------------------------

/**
 * Section IDs that should display the contextual "How does this resolve
 * the identified tension?" prompt above their primary edit surface, keyed
 * by the human-readable section label used inside the prompt template.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const TENSION_LINKAGE_PROMPTS = Object.freeze({
    land_and_expand: 'Land & Expand',
});

/**
 * Build the contextual prompt sentence shown above a tension-linked
 * section. Centralized here so AI/export layers can reuse the exact same
 * phrasing if they ever want to forward this insight into a slide deck.
 *
 * @param {string} sectionLabel — pretty label, e.g. 'Land & Expand'
 * @param {string[]} selectedTensions — array of pill values (already
 *   filtered to truthy strings by the caller)
 * @returns {string}
 */
export function buildTensionLinkagePromptText(sectionLabel, selectedTensions) {
    const list = (selectedTensions || []).filter(Boolean);
    if (list.length === 0) return '';
    // Single tension → name it directly. Multiple → comma-join in
    // selection order so the rep visually pairs the prompt back to the
    // pill row above.
    const joined = list.length === 1 ? list[0] : list.join(', ');
    return `How does our ${sectionLabel} strategy resolve your identified tension: ${joined}?`;
}

/**
 * Sections whose composite textareas should display the soft "Insight Density"
 * border cue once a single box exceeds the synthesize-or-cut threshold below.
 *
 * @type {readonly string[]}
 */
export const INSIGHT_DENSITY_SECTIONS = Object.freeze(['pursuit_thesis', 'competitive_landscape']);

/**
 * Soft character ceiling per individual textarea before the Insight Density cue
 * fires. Chosen empirically — ~400 chars equals roughly 60-80 words, which is
 * enough room for a tight executive insight but actively hostile to fluff.
 */
export const INSIGHT_DENSITY_SOFT_LIMIT = 400;

/** @type {readonly { key: string, badge: string, title: string, hint: string }[]} */
export const PLAN_306090_HORIZONS = Object.freeze([
    {
        key: 'days_30',
        badge: '30',
        title: 'Next 30 Days',
        hint: 'Immediate actions, meetings, and deliverables to create momentum.',
    },
    {
        key: 'days_60',
        badge: '60',
        title: 'Day 31–60',
        hint: 'Build on early wins; expand access and operational proof points.',
    },
    {
        key: 'days_90',
        badge: '90',
        title: 'Day 61–90',
        hint: 'Consolidate gains and tee up the next strategic phase.',
    },
]);

export const MAX_ENTRY_POINTS = 5;

/** @type {readonly string[]} */
export const ENTRY_POINT_TRUST_LEVELS = Object.freeze(['', 'Cold', 'Warm', 'Trusted']);

/** @type {readonly string[]} */
export const ENTRY_POINT_LEVEL_OPTIONS = Object.freeze(['', 'Low', 'Medium', 'High']);

/** @type {readonly string[]} */
export const ENTRY_POINT_COMM_STYLES = Object.freeze(['', 'Concise', 'Strategic', 'Conversational', 'Analytical']);

// ---------------------------------------------------------------------------
// Target Profile (Entry Point) export labels — post-consolidation
// ---------------------------------------------------------------------------
// Sales psychology: the previous 9-textarea interrogation generated
// framework fatigue. Reps were answering the same question (operational
// pain) twice under different banners ("Likely Pressure" + "What Failure
// Looks Like"), and similarly for narrative angles ("Best Themes" +
// "Narrative Openings"). The merged keys force a single, sharper answer
// per dimension — which is what an executive actually responds to in a
// discovery call.
//
// `tired_of_hearing` is gone entirely. It was a fishing prompt that
// yielded "vendor pitches" 90% of the time and never made it into a
// real strategy. `human_context` is preserved but is now rendered at
// the bottom of the profile UI rather than in its own "Human
// Intelligence" subsection.
// ---------------------------------------------------------------------------

/** @type {readonly { key: string, label: string }[]} */
export const ENTRY_POINT_EXPORT_LABELS = Object.freeze([
    { key: 'trust_level', label: 'Trust Level' },
    { key: 'responsiveness', label: 'Responsiveness' },
    { key: 'political_influence', label: 'Political Influence' },
    { key: 'comm_style', label: 'Comm Style' },
    { key: 'compound_potential', label: 'Compound Potential' },
    { key: 'why_they_matter', label: 'Why They Matter' },
    // Merge of legacy `likely_pressure` + `what_failure_looks_like`.
    { key: 'operational_pain', label: 'Operational Pain' },
    // Merge of legacy `best_themes` + `narrative_openings`.
    { key: 'conversation_wedge', label: 'Conversation Wedge' },
    { key: 'next_move', label: 'Next Move' },
    { key: 'mutual_connections', label: 'Mutual Connections' },
    // Relocated — now appended at the bottom of the individual Target
    // Profile UI as a final colour-commentary field.
    { key: 'human_context', label: 'Human Context' },
]);

/**
 * @typedef {Object} PlanSectionDef
 * @property {string} id
 * @property {PlanSectionType} type
 * @property {string} title
 * @property {SectionContextMode} [contextMode]
 * @property {string} [description]
 * @property {string[]} [tips]
 * @property {string} [pillHint]
 * @property {Record<string, string>} [columnHints]
 * @property {PlanFieldDef[]} [fields]
 * @property {string[]} [pills]
 * @property {PillGroupDef[]} [pillGroups]
 * @property {'multi' | 'either_or'} [pillMode]
 * @property {string} [pillField]
 * @property {PlanFieldDef[]} [textFields]
 * @property {'stack' | 'split'} [pillNarrativeLayout]
 * @property {readonly { key: string, badge: string, title: string, hint: string }[]} [horizons]
 * @property {PsychologySliderDef[]} [sliders]
 * @property {PlanFieldDef[]} [gravityFields]
 * @property {boolean} [exportDossier]
 * @property {boolean} [exportExec]
 */

/** @type {PlanSectionDef[]} */
export const PLAN_SECTIONS = Object.freeze([
    {
        id: 'account_snapshot',
        type: 'account_snapshot',
        title: 'Account Snapshot',
        contextMode: 'none',
        description: 'Strategic pursuit context — firmographics from CRM; judgments stored in the plan.',
        fields: [
            { key: 'tier', label: 'Strategic Tier' },
            { key: 'relationship_status', label: 'Relationship Status' },
            { key: 'ai_cloud_maturity', label: 'AI / Cloud Maturity' },
            { key: 'strategic_patience', label: 'Strategic Patience' },
            { key: 'pursuit_priority', label: 'Pursuit Priority' },
            { key: 'existing_providers', label: 'Existing Providers' },
            { key: 'expansion_potential', label: 'Expansion Potential' },
        ],
        exportDossier: true,
        exportExec: true,
    },
    {
        // ----------------------------------------------------------------
        // Pursuit Strategy (Task 2 — consolidation)
        // ----------------------------------------------------------------
        // Sales psychology behind the merge: in infrastructure / telecom
        // pursuits, the "core thesis" and the "cost of standing still"
        // are almost never two distinct stories — the thesis IS the pain
        // of inaction. Splitting them into two boxes encouraged reps to
        // produce duplicate prose (often a near-verbatim restatement)
        // and diluted the message that downstream AI and PPTX engines
        // try to synthesize.
        //
        // The merged `thesis` field is intentionally framed as a single
        // forcing question — "Why is their status quo broken, and why
        // are we the only logical fix right now?" — to compel a sharper,
        // more confrontational answer.
        //
        // `why_account_matters`, `timing`, and `executive_narrative` are
        // preserved because they answer materially different questions
        // (account selection, trigger events, and executive language)
        // that a thesis box on its own cannot.
        // ----------------------------------------------------------------
        id: 'pursuit_thesis',
        type: 'composite_textarea',
        title: 'Pursuit Strategy',
        contextMode: 'none',
        fields: [
            {
                key: 'thesis',
                label: 'Pursuit Thesis',
                hint: 'Why is their status quo broken, and why are we the only logical fix right now?',
            },
            {
                key: 'why_account_matters',
                label: 'Why This Account Matters',
                hint: 'Strategic importance to our business — logo, reference, expansion, or competitive displacement.',
            },
            {
                key: 'timing',
                label: 'Strategic Timing',
                hint: 'Trigger events and timing factors that make now the right moment.',
            },
            {
                key: 'executive_narrative',
                label: 'Executive Narrative',
                hint: 'How executives talk about change — growth, resiliency, modernization, cost.',
            },
        ],
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'strategic_tensions',
        type: 'pills_and_narrative',
        title: 'Strategic Tensions',
        contextMode: 'lead',
        description: 'What contradictions are they managing?',
        pillGroups: STRATEGIC_TENSION_GROUPS,
        pillMode: 'either_or',
        pillField: 'selected_pills',
        pillNarrativeLayout: 'split',
        textFields: [{ key: 'narrative', hint: 'Additional context on the tensions you selected.' }],
        exportDossier: true,
        exportExec: false,
    },
    {
        id: 'pain_signals',
        type: 'pain_signals',
        title: 'Pain Signals',
        contextMode: 'lead',
        description: 'Watchlist of operational and strategic pain indicators.',
        pills: PAIN_SIGNAL_PILLS,
        pillField: 'selected',
        textFields: [{ key: 'notes', hint: 'Context on the pain signals you selected.' }],
        exportDossier: true,
        exportExec: false,
    },
    {
        // ----------------------------------------------------------------
        // The Blindspots (Task 3 — formerly "Critical Unknowns")
        // ----------------------------------------------------------------
        // Sales psychology behind this refactor: a giant paragraph
        // textarea for "what we don't know" is a fluff trap. Reps either
        // leave it blank or write meandering anxieties. By forcing each
        // unknown into a single line in a rapid-fire bulleted list —
        // with an explicit Add button — we get a discovery-call
        // checklist instead of a journal entry. The UI shape ("a strict
        // checklist of questions they must answer on their next
        // discovery call") is designed to feel actionable, not academic.
        //
        // We deliberately keep section.id === 'critical_unknowns' for
        // downstream compatibility (AI engine, PPTX, exports). The
        // user-facing rename to "The Blindspots" lives in the title
        // field, and the data shape under sections.critical_unknowns
        // collapses to { blindspots: string[] }.
        // ----------------------------------------------------------------
        id: 'critical_unknowns',
        type: 'blindspots_list',
        title: 'The Blindspots',
        contextMode: 'lead',
        description: 'A strict checklist of questions you must answer on your next discovery call.',
        exportDossier: true,
        exportExec: false,
    },
    {
        id: 'influence_mapping',
        type: 'influence_board',
        title: 'Influence Mapping',
        contextMode: 'none',
        columnHints: {
            bench: 'Contacts not yet mapped to a leadership tier.',
            executive: 'Executive leadership — strategic priorities and relationship temperature.',
            mid_level: 'Mid-level champions — operational influence and personal ambition.',
            technical: 'Technical / operational influencers — architecture and day-to-day credibility.',
            invisible_org_chart: 'Who influences decisions quietly, outside the formal org chart?',
            political_dynamics: 'Political dynamics, factions, and informal power shifts.',
            access_path: 'Current access, desired access, bridge contacts, and strategy.',
        },
        exportDossier: true,
        exportExec: false,
    },
    {
        id: 'white_space',
        type: 'white_space_matrix',
        title: 'White Space',
        contextMode: 'lead',
        description: 'Revenue and expansion opportunities by framework area.',
        pills: WHITE_SPACE_AREAS,
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'competitive_landscape',
        type: 'pills_and_narrative',
        title: 'Competitive Landscape',
        contextMode: 'none',
        pills: POSITIONING_PILLS,
        pillField: 'positioning_pills',
        pillHint: 'How do we want to be perceived over time?',
        textFields: [
            { key: 'incumbents', hint: 'Competitor strengths, weaknesses, and entrenchment level.' },
            { key: 'narrative', hint: 'Narrative positioning beyond the selected perception pills.' },
        ],
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'entrenchment',
        type: 'entrenchment',
        title: 'Entrenchment',
        contextMode: 'lead',
        description: 'Incumbent moats and compound relationships that raise switching cost.',
        pills: ENTRENCHMENT_MOAT_PILLS,
        pillField: 'moat_pills',
        textFields: [
            { key: 'compound_relationships', hint: 'Relationships and dependencies that compound over time.' },
            { key: 'difficult_to_remove', hint: 'Why incumbents are difficult to displace.' },
        ],
        exportDossier: true,
        exportExec: false,
    },
    {
        id: 'land_and_expand',
        type: 'composite_textarea',
        title: 'Land & Expand',
        contextMode: 'none',
        fields: [
            { key: 'initial_entry', hint: 'The initial entry opportunity and wedge.' },
            { key: 'trust_creation', hint: 'Why this wedge creates trust.' },
            { key: 'expansion_path', hint: 'Expansion path and strategic outcome.' },
        ],
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'entry_points',
        type: 'entry_point_carousel',
        title: 'Strategic Entry Points',
        contextMode: 'lead',
        description: 'Define specific individuals to leverage, how to approach them, and the exact narratives to use.',
        exportDossier: true,
        exportExec: false,
    },
    {
        id: 'psychology',
        type: 'psychology_grid',
        title: 'Account Psychology',
        contextMode: 'none',
        sliders: PSYCHOLOGY_SLIDERS,
        gravityFields: [
            { key: 'organizational_gravity', label: 'Organizational Gravity' },
            { key: 'consensus_requirement', label: 'Consensus Requirement' },
            { key: 'procurement_friction', label: 'Procurement Friction' },
            { key: 'innovation_friction', label: 'Innovation Friction' },
            { key: 'narrative', label: 'Gravity Narrative' },
        ],
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'relationship_momentum',
        type: 'momentum',
        title: 'Relationship Momentum',
        contextMode: 'block',
        description: 'What is shifting in the relationship?',
        tips: [
            'Are we gaining or losing executive access?',
            'Has trust been earned through a recent operational win or lost through an outage?',
        ],
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'interaction_log',
        type: 'interaction_log',
        title: 'Interaction Log',
        contextMode: 'lead',
        description: 'Structured relationship events and strategic signals.',
        // Excluded from the PDF dossier — the Relationship Timeline is the
        // canonical client-facing view of signals + activities. The form
        // remains in the canvas so reps can capture new signals.
        exportDossier: false,
        exportExec: false,
    },
    {
        id: 'momentum_timeline',
        type: 'timeline_view',
        title: 'Relationship Timeline',
        contextMode: 'lead',
        description: 'A unified chronological view of CRM activities and strategic plan milestones.',
        exportDossier: true,
        exportExec: false,
    },
    {
        id: 'plan_30_60_90',
        type: 'triple_textarea',
        title: '30 / 60 / 90 Plan',
        contextMode: 'lead',
        description: 'Define the immediate tactical steps to advance the strategic pursuit.',
        horizons: PLAN_306090_HORIZONS,
        exportDossier: true,
        exportExec: true,
    },
]);

/**
 * @param {string} sectionId
 * @returns {PlanSectionDef | undefined}
 */
export function getPlanSection(sectionId) {
    return PLAN_SECTIONS.find((section) => section.id === sectionId);
}
