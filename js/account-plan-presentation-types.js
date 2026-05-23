/** @typedef {{ label: string, insight: string }} PresentationCallout */

/** @typedef {{ headline: string, bullets: string[] }} PresentationHorizonBlock */

/** @typedef {{ name: string, headline: string, hook: string, badges: string }} PresentationEntryPoint */

/** @typedef {{ date_label: string, headline: string }} PresentationSignal */

/** @typedef {{ tier: string, priority: string }} PresentationAccountContext */

/** @typedef {{ headline: string, bullets: string[] }} PresentationSignalBlock */

/** @typedef {{ headline: string, opportunity: string }} PresentationWhiteSpaceHook */

/**
 * @typedef {Object} PresentationHighlight
 * @property {string} generated_at
 * @property {string | null} model
 * @property {string} account_name
 * @property {Object} slides
 * @property {Object} slides.situation
 * @property {string} slides.situation.headline
 * @property {string} slides.situation.subheadline
 * @property {PresentationAccountContext} slides.situation.account_context
 * @property {PresentationHorizonBlock & { headline: string }} slides.situation.pursuit_thesis
 * @property {string} slides.situation.executive_narrative
 * @property {PresentationSignalBlock} slides.situation.pain_signals
 * @property {PresentationSignalBlock} slides.situation.critical_unknowns
 * @property {{ insight: string }} slides.situation.momentum
 * @property {{ headline: string, callouts: PresentationCallout[] }} slides.situation.psychology
 * @property {Object} slides.battlefield
 * @property {string} slides.battlefield.headline
 * @property {PresentationHorizonBlock} slides.battlefield.competitive
 * @property {PresentationWhiteSpaceHook} slides.battlefield.white_space
 * @property {{ executive_hook: string, champions_hook: string, access_path_hook: string }} slides.battlefield.influence
 * @property {PresentationEntryPoint[]} slides.battlefield.entry_points
 * @property {Object} slides.execution
 * @property {string} slides.execution.headline
 * @property {PresentationHorizonBlock} slides.execution.plan_30
 * @property {PresentationHorizonBlock} slides.execution.plan_60
 * @property {PresentationHorizonBlock} slides.execution.plan_90
 * @property {string} slides.execution.entrenchment_moat
 * @property {PresentationSignal[]} slides.execution.signals
 */

export const MOMENTUM_LABELS = Object.freeze(['Stalled', 'Cooling', 'Neutral', 'Warming', 'Champion']);
