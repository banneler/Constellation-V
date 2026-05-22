/**
 * Strategic Account OS — section registry (canvas, TOC, export metadata).
 */

/** @typedef {'composite_textarea' | 'pills_and_narrative' | 'influence_board' | 'psychology_grid' | 'momentum' | 'triple_textarea'} PlanSectionType */

/**
 * @typedef {Object} PlanFieldDef
 * @property {string} key
 * @property {string} label
 */

/**
 * @typedef {Object} PsychologySliderDef
 * @property {string} id
 * @property {string} label
 * @property {string} lowLabel
 * @property {string} highLabel
 * @property {'inverse' | 'direct'} [colorScale] inverse = high value is red/warn; direct = high value is green/good
 */

/** @type {PsychologySliderDef[]} */
export const PSYCHOLOGY_SLIDERS = Object.freeze([
    {
        id: 'bureaucracy_level',
        label: 'Bureaucracy Level',
        lowLabel: 'Agile',
        highLabel: 'Heavy process',
        colorScale: 'inverse',
    },
    {
        id: 'risk_appetite',
        label: 'Risk Appetite',
        lowLabel: 'Conservative',
        highLabel: 'Bold',
        colorScale: 'direct',
    },
    {
        id: 'technical_sophistication',
        label: 'Technical Sophistication',
        lowLabel: 'Basic',
        highLabel: 'Advanced',
        colorScale: 'direct',
    },
    {
        id: 'vendor_loyalty',
        label: 'Vendor Loyalty',
        lowLabel: 'Transactional',
        highLabel: 'Embedded',
        colorScale: 'direct',
    },
    {
        id: 'decision_velocity',
        label: 'Decision Velocity',
        lowLabel: 'Slow',
        highLabel: 'Fast',
        colorScale: 'direct',
    },
]);

/** @type {string[]} */
export const STRATEGIC_TENSION_PILLS = Object.freeze([
    'Scale vs. Reliability',
    'Innovation vs. Governance/Security',
    'Cost vs. Agility',
    'Cloud vs. Control',
    'Automation vs. Human Oversight',
]);

/** @type {string[]} */
export const POSITIONING_PILLS = Object.freeze([
    'Operationally credible',
    'Highly responsive',
    'Long-term strategic partner',
    'Innovation leader',
    'Cost-efficient operator',
]);

/**
 * @typedef {Object} PlanSectionDef
 * @property {string} id
 * @property {PlanSectionType} type
 * @property {string} title
 * @property {string} [description]
 * @property {string[]} [tips]
 * @property {PlanFieldDef[]} [fields]
 * @property {string[]} [pills]
 * @property {string} [pillField]
 * @property {PlanFieldDef[]} [textFields]
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
        description: 'Why pursue this account now? What is the core thesis?',
        tips: [
            'Why they might change (Operational pain, executive pressure, vendor dissatisfaction, cloud modernization).',
            'Cost of standing still (Fragility, scaling bottlenecks, tech debt).',
            'Strategic timing factors & trigger events.',
        ],
        fields: [
            { key: 'core', label: 'Core Thesis' },
            { key: 'cost_of_standing_still', label: 'Cost of Standing Still' },
            { key: 'timing', label: 'Strategic Timing' },
        ],
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'strategic_tensions',
        type: 'pills_and_narrative',
        title: 'Strategic Tensions',
        description: 'What contradictions are they managing?',
        tips: [
            'Scale vs. Reliability',
            'Innovation vs. Governance/Security',
            'Cost vs. Agility',
            'Cloud vs. Control',
            'Automation vs. Human Oversight',
        ],
        pills: STRATEGIC_TENSION_PILLS,
        pillField: 'selected_pills',
        textFields: [{ key: 'narrative', label: 'Narrative Context' }],
        exportDossier: true,
        exportExec: false,
    },
    {
        id: 'influence_mapping',
        type: 'influence_board',
        title: 'Influence Mapping',
        description: 'Map the formal and invisible organizational influence.',
        tips: [
            'Executive Leadership (Strategic priorities, relationship temp).',
            'Mid-Level Champions (Operational influence, personal ambition).',
            'The Invisible Org Chart (Who influences decisions quietly?).',
        ],
        exportDossier: true,
        exportExec: false,
    },
    {
        id: 'competitive_landscape',
        type: 'pills_and_narrative',
        title: 'Competitive Landscape',
        description: 'Assess incumbent vendors, alternatives, and our narrative positioning.',
        tips: [
            'Competitor strengths, weaknesses, and entrenchment level.',
            'How do we want to be perceived over time? (e.g., Operationally credible, highly responsive, long-term strategic partner).',
        ],
        pills: POSITIONING_PILLS,
        pillField: 'positioning_pills',
        textFields: [
            { key: 'incumbents', label: 'Incumbents & Alternatives' },
            { key: 'narrative', label: 'Narrative Positioning' },
        ],
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'land_and_expand',
        type: 'composite_textarea',
        title: 'Land & Expand',
        description: 'Define the initial wedge and the path to broader entrenchment.',
        tips: [
            'Initial Entry Opportunity.',
            'Why it creates trust.',
            'Expansion Path & Strategic Outcome.',
        ],
        fields: [
            { key: 'initial_entry', label: 'Initial Entry Opportunity' },
            { key: 'trust_creation', label: 'Why It Creates Trust' },
            { key: 'expansion_path', label: 'Expansion Path & Strategic Outcome' },
        ],
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'psychology',
        type: 'psychology_grid',
        title: 'Account Psychology',
        description: 'Map the enterprise gravity and operational mindset of the organization.',
        tips: [
            'Bureaucracy: Agile (few approvals) vs. Heavy process (massive red tape).',
            'Risk Appetite: Conservative (fears change) vs. Bold (early adopter).',
            'Tech Sophistication: Basic (needs full managed support) vs. Advanced (deep internal engineering).',
            'Vendor Loyalty: Transactional (price-shopper) vs. Embedded (strategic partner).',
            'Decision Velocity: Slow (months of review) vs. Fast (agile procurement).',
        ],
        sliders: PSYCHOLOGY_SLIDERS,
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'relationship_momentum',
        type: 'momentum',
        title: 'Relationship Momentum',
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
        description: 'Define the immediate tactical steps to advance the strategic pursuit.',
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
