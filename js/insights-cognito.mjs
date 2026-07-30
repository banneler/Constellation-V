/**
 * Cognito → Outreach conversion heuristic for Insights.
 * Converted = trigger (alert) has ≥1 matching activity by the same reportable
 * rep, in the selected period, on the same account, on/after the alert day.
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

/**
 * @param {object} alert cognito_alerts row
 * @param {object[]} outreachActivities already scoped to reportable + filter user + period
 * @returns {boolean}
 */
export function activityConvertsAlert(alert, outreachActivities) {
    if (!alert || (alert.status || '') === 'Dismissed') return false;
    const alertTime = parseInsightsDate(alert.created_at);
    if (!alertTime) return false;
    const alertMs = alertTime.getTime();
    return (outreachActivities || []).some((activity) => {
        if (!sameAccountId(activity.account_id, alert.account_id)) return false;
        const activityStamp = activityEffectiveTime(activity.date);
        if (!activityStamp) return false;
        return activityStamp.getTime() >= alertMs;
    });
}
