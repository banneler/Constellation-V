/**
 * Strategic Account OS — section registry (canvas, TOC, export metadata).
 */

/** @typedef {'textarea' | 'psychology_grid' | 'momentum' | 'triple_textarea'} PlanSectionType */

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

/**
 * @typedef {Object} PlanSectionDef
 * @property {string} id
 * @property {PlanSectionType} type
 * @property {string} title
 * @property {string} [description]
 * @property {string[]} [tips]
 * @property {PsychologySliderDef[]} [sliders]
 * @property {boolean} [exportDossier]
 * @property {boolean} [exportExec]
 */

/** @type {PlanSectionDef[]} */
export const PLAN_SECTIONS = Object.freeze([
    {
        id: 'pursuit_thesis',
        type: 'textarea',
        title: 'Pursuit Thesis',
        description: 'Why pursue this account now? What is the core thesis?',
        tips: [
            'Why they might change (Operational pain, executive pressure, vendor dissatisfaction, cloud modernization).',
            'Cost of standing still (Fragility, scaling bottlenecks, tech debt).',
            'Strategic timing factors & trigger events.',
        ],
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'strategic_tensions',
        type: 'textarea',
        title: 'Strategic Tensions',
        description: 'What contradictions are they managing?',
        tips: [
            'Scale vs. Reliability',
            'Innovation vs. Governance/Security',
            'Cost vs. Agility',
            'Cloud vs. Control',
            'Automation vs. Human Oversight',
        ],
        exportDossier: true,
        exportExec: false,
    },
    {
        id: 'influence_mapping',
        type: 'textarea',
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
        type: 'textarea',
        title: 'Competitive Landscape',
        description: 'Assess incumbent vendors, alternatives, and our narrative positioning.',
        tips: [
            'Competitor strengths, weaknesses, and entrenchment level.',
            'How do we want to be perceived over time? (e.g., Operationally credible, highly responsive, long-term strategic partner).',
        ],
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'land_and_expand',
        type: 'textarea',
        title: 'Land & Expand',
        description: 'Define the initial wedge and the path to broader entrenchment.',
        tips: [
            'Initial Entry Opportunity.',
            'Why it creates trust.',
            'Expansion Path & Strategic Outcome.',
        ],
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'psychology',
        type: 'psychology_grid',
        title: 'Account Psychology',
        sliders: PSYCHOLOGY_SLIDERS,
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'relationship_momentum',
        type: 'momentum',
        title: 'Relationship Momentum',
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'plan_30_60_90',
        type: 'triple_textarea',
        title: '30 / 60 / 90 Plan',
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
