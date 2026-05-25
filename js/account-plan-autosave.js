/**
 * Strategic Account OS — debounced autosave engine (2s) with milestone integration.
 */

import {
    applyDraftToPlan,
    deepClonePlan,
    savePlanDraft,
    sanitizeDraftSectionsForPersistence,
} from './account-plan-data.js';

/** @typedef {'idle' | 'pending' | 'saving' | 'saved' | 'error'} AutosaveStatus */

const DEBOUNCE_MS = 2000;

/**
 * @typedef {Object} AutosaveContext
 * @property {string} planRowId
 * @property {import('./account-plan-data.js').AccountPlanDocument} plan
 * @property {Record<string, unknown>} draftSections
 * @property {{ forceCommit?: boolean }} [options]
 */

/**
 * Create an autosave controller bound to a Supabase client.
 *
 * @param {object} supabase
 * @param {{ onStatusChange?: (status: AutosaveStatus, detail?: { error?: string, updated_at?: string }) => void }} [config]
 */
export function createAccountPlanAutosave(supabase, config = {}) {
    /** @type {AutosaveStatus} */
    let status = 'idle';
    /** @type {ReturnType<typeof setTimeout> | null} */
    let debounceTimer = null;
    /** @type {Promise<void> | null} */
    let inFlight = null;
    /** @type {AutosaveContext | null} */
    let pendingContext = null;
    let suppress = false;

    /**
     * @param {AutosaveStatus} next
     * @param {{ error?: string, updated_at?: string }} [detail]
     */
    function setStatus(next, detail) {
        status = next;
        if (typeof config.onStatusChange === 'function') {
            config.onStatusChange(next, detail);
        }
    }

    /**
     * @returns {AutosaveStatus}
     */
    function getAutosaveStatus() {
        return status;
    }

    function clearDebounceTimer() {
        if (debounceTimer != null) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
    }

    /**
     * Cancel pending debounced save without writing. Use when switching accounts or leaving strategic mode.
     */
    function cancelAutosave() {
        clearDebounceTimer();
        pendingContext = null;
        if (!inFlight) {
            setStatus('idle');
        }
    }

    /**
     * Temporarily block scheduling (e.g. while restoring history snapshot).
     * @param {boolean} value
     */
    function setAutosaveSuppressed(value) {
        suppress = !!value;
        if (suppress) {
            cancelAutosave();
        }
    }

    /**
     * @param {AutosaveContext} context
     */
    async function executeSave(context) {
        if (!supabase || !context.planRowId) {
            setStatus('error', { error: 'Autosave not configured.' });
            return null;
        }

        setStatus('saving');

        // Task 4 — Hardening for the AI/PPTX engines.
        // The debounce timer just fired; this is the last opportunity to scrub
        // the payload before it leaves the browser. We do NOT mutate the caller's
        // draftSections (autosave callers reuse the live state) — sanitizer
        // returns a shallow clone with only the fragile fields fixed.
        const sanitizedDraftSections = sanitizeDraftSectionsForPersistence(
            context.draftSections
        );

        const planToSave = applyDraftToPlan(
            context.plan,
            sanitizedDraftSections,
            {
                forceCommit: !!(context.options && context.options.forceCommit),
            }
        );

        const result = await savePlanDraft(supabase, context.planRowId, planToSave);

        if (!result.ok) {
            setStatus('error', { error: result.error || 'Save failed.' });
            return null;
        }

        setStatus('saved', { updated_at: result.updated_at, plan: planToSave });
        return {
            plan: planToSave,
            updated_at: result.updated_at,
        };
    }

    /**
     * Immediately run a pending or explicit save. Returns the saved plan on success.
     *
     * @param {AutosaveContext} [contextOverride]
     * @returns {Promise<{ plan: import('./account-plan-data.js').AccountPlanDocument, updated_at?: string } | null>}
     */
    async function flushAutosave(contextOverride) {
        clearDebounceTimer();

        const context = contextOverride || pendingContext;
        pendingContext = null;

        if (!context) {
            if (!inFlight) {
                setStatus('idle');
            }
            return null;
        }

        const run = async () => executeSave(context);

        if (inFlight) {
            await inFlight.catch(() => null);
        }

        inFlight = run();
        try {
            return await inFlight;
        } finally {
            inFlight = null;
        }
    }

    /**
     * Queue a debounced autosave (2000ms after the last call).
     *
     * @param {AutosaveContext} context
     */
    function scheduleAutosave(context) {
        if (suppress) return;
        if (!context || !context.planRowId || !context.plan) {
            setStatus('error', { error: 'Invalid autosave context.' });
            return;
        }

        pendingContext = {
            planRowId: context.planRowId,
            plan: deepClonePlan(context.plan),
            draftSections: context.draftSections && typeof context.draftSections === 'object'
                ? { ...context.draftSections }
                : {},
            options: context.options ? { ...context.options } : {},
        };

        setStatus('pending');
        clearDebounceTimer();

        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            flushAutosave();
        }, DEBOUNCE_MS);
    }

    /**
     * Manual milestone + immediate save (Force Commit).
     *
     * @param {Omit<AutosaveContext, 'options'> & { options?: { forceCommit?: boolean } }} context
     */
    async function forceCommitAutosave(context) {
        cancelAutosave();
        return flushAutosave({
            ...context,
            plan: deepClonePlan(context.plan),
            options: { forceCommit: true },
        });
    }

    /**
     * Replace in-memory plan baseline after external load (account switch / fetch).
     *
     * @param {string} planRowId
     * @param {import('./account-plan-data.js').AccountPlanDocument} plan
     */
    function setAutosaveBaseline(planRowId, plan) {
        cancelAutosave();
        pendingContext = null;
        if (planRowId && plan) {
            setStatus('idle');
        }
    }

    return {
        scheduleAutosave,
        flushAutosave,
        cancelAutosave,
        forceCommitAutosave,
        getAutosaveStatus,
        setAutosaveSuppressed,
        setAutosaveBaseline,
    };
}
