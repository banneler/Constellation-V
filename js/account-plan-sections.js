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
 * @property {string} [placeholder]
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
        placeholder: 'Why pursue this account now? What is the core thesis?',
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'strategic_tensions',
        type: 'textarea',
        title: 'Strategic Tensions',
        placeholder: 'Forces pulling the account in different directions — budget, politics, timing…',
        exportDossier: true,
        exportExec: false,
    },
    {
        id: 'influence_mapping',
        type: 'textarea',
        title: 'Influence Mapping',
        placeholder: 'Champions, blockers, economic buyers, and reporting lines.',
        exportDossier: true,
        exportExec: false,
    },
    {
        id: 'competitive_landscape',
        type: 'textarea',
        title: 'Competitive Landscape',
        placeholder: 'Incumbent vendors, alternatives, and our differentiation.',
        exportDossier: true,
        exportExec: true,
    },
    {
        id: 'land_and_expand',
        type: 'textarea',
        title: 'Land & Expand',
        placeholder: 'Initial wedge, expansion paths, and whitespace.',
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
        placeholder: 'What is shifting in the relationship — trust, access, executive sponsorship?',
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
