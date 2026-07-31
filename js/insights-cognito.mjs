/**
 * Cognito → Outreach conversion for Insights.
 *
 * Converted = each non-dismissed trigger uniquely matched 1:1 to an activity
 * in the period pool (same account, activity on/after the alert):
 *   1) Prefer activities.cognito_alert_id → that alert
 *   2) Else greedy: each unlinked activity converts at most one unused alert
 *      (nearest alert created_at ≤ activity time on that account)
 */

import { endOfLocalDay, parseInsightsDate } from './insights-period.mjs';

export function sameAccountId(a, b) {
    if (a == null || b == null) return false;
    return Number(a) === Number(b) || String(a) === String(b);
}

function isDateOnlyString(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/**
 * Effective activity timestamp for conversion compare.
 * Date-only activity.date values use local end-of-day so same-calendar-day
 * outreach after a morning alert still counts.
 */
export function activityEffectiveTime(activityDate) {
    const parsed = parseInsightsDate(activityDate);
    if (!parsed) return null;
    if (isDateOnlyString(activityDate)) return endOfLocalDay(parsed);
    return parsed;
}

function alertKey(id) {
    return String(id);
}

function activityKey(activity, index) {
    if (activity?.id != null && activity.id !== '') return `id:${activity.id}`;
    return `idx:${index}`;
}

function hasAlertLink(activity) {
    return activity?.cognito_alert_id != null && activity.cognito_alert_id !== '';
}

/**
 * Compute the set of alert ids (as strings) converted 1:1 by the outreach pool.
 * @param {object[]} alerts cognito_alerts rows already scoped to user + period
 * @param {object[]} outreachActivities activities already scoped to reportable + filter user + period
 * @returns {Set<string>}
 */
export function buildConvertedAlertIds(alerts, outreachActivities) {
    const converted = new Set();
    const alertById = new Map();
    (alerts || []).forEach((alert) => {
        if (alert?.id == null) return;
        alertById.set(alertKey(alert.id), alert);
    });

    const usedActivityKeys = new Set();
    const acts = outreachActivities || [];

    // Phase 1: explicit cognito_alert_id stamps
    acts.forEach((activity, index) => {
        if (!hasAlertLink(activity)) return;
        const alert = alertById.get(alertKey(activity.cognito_alert_id));
        if (!alert || (alert.status || '') === 'Dismissed') return;
        if (!sameAccountId(activity.account_id, alert.account_id)) return;
        const alertTime = parseInsightsDate(alert.created_at);
        const activityStamp = activityEffectiveTime(activity.date);
        if (!alertTime || !activityStamp) return;
        if (activityStamp.getTime() < alertTime.getTime()) return;
        const key = alertKey(alert.id);
        if (converted.has(key)) return;
        converted.add(key);
        usedActivityKeys.add(activityKey(activity, index));
    });

    // Phase 2: greedy 1:1 for unlinked historical activities
    const candidates = acts
        .map((activity, index) => ({ activity, index }))
        .filter(({ activity, index }) => {
            if (hasAlertLink(activity)) return false;
            if (usedActivityKeys.has(activityKey(activity, index))) return false;
            if (activity.account_id == null) return false;
            return Boolean(activityEffectiveTime(activity.date));
        })
        .sort((a, b) => {
            const aMs = activityEffectiveTime(a.activity.date).getTime();
            const bMs = activityEffectiveTime(b.activity.date).getTime();
            return aMs - bMs || a.index - b.index;
        });

    for (const { activity, index } of candidates) {
        const actMs = activityEffectiveTime(activity.date).getTime();
        let best = null;
        let bestMs = -Infinity;
        for (const alert of alerts || []) {
            if (!alert || alert.id == null) continue;
            if ((alert.status || '') === 'Dismissed') continue;
            const key = alertKey(alert.id);
            if (converted.has(key)) continue;
            if (!sameAccountId(activity.account_id, alert.account_id)) continue;
            const alertTime = parseInsightsDate(alert.created_at);
            if (!alertTime) continue;
            const alertMs = alertTime.getTime();
            if (alertMs > actMs) continue;
            if (alertMs > bestMs) {
                best = alert;
                bestMs = alertMs;
            }
        }
        if (best) {
            converted.add(alertKey(best.id));
            usedActivityKeys.add(activityKey(activity, index));
        }
    }

    return converted;
}

/** @deprecated alias — prefer buildConvertedAlertIds */
export const assignConvertedAlertIds = buildConvertedAlertIds;

/**
 * @param {object} alert cognito_alerts row
 * @param {object[]|Set<string|number>} outreachOrConvertedIds
 *   either the period activity pool, or a Set from buildConvertedAlertIds
 * @returns {boolean}
 */
export function activityConvertsAlert(alert, outreachOrConvertedIds) {
    if (!alert || alert.id == null) return false;
    if ((alert.status || '') === 'Dismissed') return false;
    if (outreachOrConvertedIds instanceof Set) {
        const key = alertKey(alert.id);
        return (
            outreachOrConvertedIds.has(key) ||
            outreachOrConvertedIds.has(Number(alert.id)) ||
            outreachOrConvertedIds.has(alert.id)
        );
    }
    return buildConvertedAlertIds([alert], outreachOrConvertedIds).has(alertKey(alert.id));
}
