import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getDateRange,
    inDateRange,
    parseInsightsDate,
    getInsightsFetchFloor,
    getMonthsInRange,
    formatLocalDate,
} from '../../js/insights-period.mjs';

const NOW = new Date(2026, 6, 30, 17, 39, 0); // Jul 30, 2026 local

describe('insights-period getDateRange', () => {
    it('this_month is local Jul 1 start through end of today', () => {
        const { startDate, endDate } = getDateRange('this_month', NOW);
        assert.equal(startDate.getFullYear(), 2026);
        assert.equal(startDate.getMonth(), 6);
        assert.equal(startDate.getDate(), 1);
        assert.equal(startDate.getHours(), 0);
        assert.equal(endDate.getFullYear(), 2026);
        assert.equal(endDate.getMonth(), 6);
        assert.equal(endDate.getDate(), 30);
        assert.equal(endDate.getHours(), 23);
        assert.equal(endDate.getMinutes(), 59);
    });

    it('last_month covers full previous calendar month through local end-of-day', () => {
        const { startDate, endDate } = getDateRange('last_month', NOW);
        assert.equal(startDate.toDateString(), new Date(2026, 5, 1).toDateString());
        assert.equal(endDate.getFullYear(), 2026);
        assert.equal(endDate.getMonth(), 5);
        assert.equal(endDate.getDate(), 30);
        assert.equal(endDate.getHours(), 23);
        assert.equal(endDate.getMinutes(), 59);
        // Local evening on the last day — must not be cut off by wall-clock "now" time.
        const lateLastDay = new Date(2026, 5, 30, 22, 15, 0);
        assert.ok(inDateRange(lateLastDay, startDate, endDate));
    });

    it('last_2_months is Jun 1 through end of today', () => {
        const { startDate, endDate } = getDateRange('last_2_months', NOW);
        assert.equal(startDate.toDateString(), new Date(2026, 5, 1).toDateString());
        assert.equal(endDate.getDate(), 30);
        assert.equal(getMonthsInRange(startDate, endDate), 2);
    });

    it('this_fiscal_year starts Jan 1 local', () => {
        const { startDate } = getDateRange('this_fiscal_year', NOW);
        assert.equal(startDate.toDateString(), new Date(2026, 0, 1).toDateString());
    });

    it('last_365_days starts 365 local days before today', () => {
        const { startDate } = getDateRange('last_365_days', NOW);
        assert.equal(startDate.toDateString(), new Date(2025, 6, 30).toDateString());
    });
});

describe('insights-period inDateRange vs Cognito created_at', () => {
    it('mid-July 2026 alert matches this_month / last_2_months / FY / 365', () => {
        const midJuly = '2026-07-15T15:30:00.000Z';
        for (const key of ['this_month', 'last_2_months', 'this_fiscal_year', 'last_365_days']) {
            const { startDate, endDate } = getDateRange(key, NOW);
            assert.equal(inDateRange(midJuly, startDate, endDate), true, key);
        }
        const lastMonth = getDateRange('last_month', NOW);
        assert.equal(inDateRange(midJuly, lastMonth.startDate, lastMonth.endDate), false);
    });

    it('date-only activity strings use local calendar (not UTC shift)', () => {
        const { startDate, endDate } = getDateRange('this_month', NOW);
        assert.equal(parseInsightsDate('2026-07-01').getDate(), 1);
        assert.equal(inDateRange('2026-07-01', startDate, endDate), true);
        assert.equal(inDateRange('2026-07-30', startDate, endDate), true);
    });
});

describe('insights-period fetch floor', () => {
    it('uses the earlier of FY start and 365-day start', () => {
        const floor = getInsightsFetchFloor(NOW);
        const fy = getDateRange('this_fiscal_year', NOW).startDate;
        const d365 = getDateRange('last_365_days', NOW).startDate;
        assert.equal(floor.getTime(), Math.min(fy.getTime(), d365.getTime()));
        assert.equal(floor.toDateString(), d365.toDateString());
        assert.equal(formatLocalDate(floor), '2025-07-30');
    });
});
