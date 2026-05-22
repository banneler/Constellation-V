/**
 * Strategic Account OS — section registry (canvas, TOC, export metadata).
 */

/** @typedef {'composite_textarea' | 'pills_and_narrative' | 'influence_board' | 'psychology_grid' | 'momentum' | 'triple_textarea' | 'entry_point_carousel'} PlanSectionType */

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
]);

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

/** @type {readonly { key: string, label: string }[]} */
export const ENTRY_POINT_EXPORT_LABELS = Object.freeze([
    { key: 'trust_level', label: 'Trust Level' },
    { key: 'responsiveness', label: 'Responsiveness' },
    { key: 'political_influence', label: 'Political Influence' },
    { key: 'comm_style', label: 'Comm Style' },
    { key: 'compound_potential', label: 'Compound Potential' },
    { key: 'why_they_matter', label: 'Why They Matter' },
    { key: 'likely_pressure', label: 'Likely Pressure' },
    { key: 'what_failure_looks_like', label: 'What Failure Looks Like' },
    { key: 'best_themes', label: 'Best Themes' },
    { key: 'narrative_openings', label: 'Narrative Openings' },
    { key: 'tired_of_hearing', label: 'Tired of Hearing' },
    { key: 'next_move', label: 'Next Move' },
    { key: 'human_context', label: 'Human Context' },
    { key: 'mutual_connections', label: 'Mutual Connections' },
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
 * @property {boolean} [exportDossier]
 * @property {boolean} [exportExec]
 */

/** @type {PlanSectionDef[]} */
export const PLAN_SECTIONS = Object.freeze([
    {
        id: 'pursuit_thesis',
        type: 'composite_textarea',
        title: 'Pursuit Thesis',
        contextMode: 'none',
        fields: [
            {
                key: 'core',
                label: 'Core Thesis',
                hint: 'Why they might change — operational pain, executive pressure, vendor dissatisfaction, cloud modernization.',
            },
            {
                key: 'cost_of_standing_still',
                label: 'Cost of Standing Still',
                hint: 'Fragility, scaling bottlenecks, and accumulating tech debt.',
            },
            {
                key: 'timing',
                label: 'Strategic Timing',
                hint: 'Trigger events and timing factors that make now the right moment.',
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
        id: 'influence_mapping',
        type: 'influence_board',
        title: 'Influence Mapping',
        contextMode: 'none',
        columnHints: {
            bench: 'Contacts not yet mapped to a leadership tier.',
            executive: 'Executive leadership — strategic priorities and relationship temperature.',
            mid_level: 'Mid-level champions — operational influence and personal ambition.',
            invisible_org_chart: 'Who influences decisions quietly, outside the formal org chart?',
        },
        exportDossier: true,
        exportExec: false,
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
