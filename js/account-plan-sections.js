/**
 * Strategic Account OS — section registry (canvas, TOC, export metadata).
 */

/** @typedef {'composite_textarea' | 'pills_and_narrative' | 'influence_board' | 'psychology_grid' | 'momentum' | 'triple_textarea'} PlanSectionType */

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
