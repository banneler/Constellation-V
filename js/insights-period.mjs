/**
 * Insights period presets — local-calendar semantics.
 * Shared so Cognito / activities / deals all use the same range bounds.
 */

export function startOfLocalDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfLocalDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/**
 * Parse Insights date values.
 * Date-only strings (YYYY-MM-DD) use local midnight so they are not shifted
 * a day earlier via UTC parsing (e.g. activity.date).
 */
export function parseInsightsDate(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    const str = String(value).trim();
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (dateOnly) {
        const year = Number(dateOnly[1]);
        const month = Number(dateOnly[2]) - 1;
        const day = Number(dateOnly[3]);
        const local = new Date(year, month, day);
        return Number.isNaN(local.getTime()) ? null : local;
    }
    const parsed = new Date(str);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * @param {string} rangeKey
 * @param {Date} [now]
 * @returns {{ startDate: Date, endDate: Date }}
 */
export function getDateRange(rangeKey, now = new Date()) {
    let startDate;
    let endDate = endOfLocalDay(now);

    switch (rangeKey) {
        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'last_month': {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            // Day 0 of current month = last calendar day of previous month.
            endDate = endOfLocalDay(new Date(now.getFullYear(), now.getMonth(), 0));
            break;
        }
        case 'last_2_months':
            // Current month + previous month (2 calendar months).
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            break;
        case 'this_fiscal_year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        case 'last_365_days':
            startDate = startOfLocalDay(now);
            startDate.setDate(startDate.getDate() - 365);
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { startDate, endDate };
}

/** Inclusive local-calendar / timestamp compare against getDateRange bounds. */
export function inDateRange(value, startDate, endDate) {
    const itemDate = parseInsightsDate(value);
    if (!itemDate) return false;
    return itemDate >= startDate && itemDate <= endDate;
}

/** Months of quota covered by the selected Insights period. */
export function getMonthsInRange(startDate, endDate) {
    if (startDate.getDate() === 1) {
        const startMonths = startDate.getFullYear() * 12 + startDate.getMonth();
        const endMonths = endDate.getFullYear() * 12 + endDate.getMonth();
        return Math.max(1, endMonths - startMonths + 1);
    }
    const avgMonthMs = 30.437 * 24 * 60 * 60 * 1000;
    return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / avgMonthMs));
}

/**
 * Earliest Instant Insights may need (wider of FY start vs 365 days ago).
 * Used to bound server fetches when paginating large tables.
 */
export function getInsightsFetchFloor(now = new Date()) {
    const fy = getDateRange('this_fiscal_year', now).startDate;
    const days365 = getDateRange('last_365_days', now).startDate;
    return fy.getTime() <= days365.getTime() ? fy : days365;
}
