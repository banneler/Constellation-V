import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDateRange } from '../../js/insights-period.mjs';
import {
    activityConvertsAlert,
    activityTimeForCompare,
    sameAccountId,
} from '../../js/insights-cognito.mjs';

const NOW = new Date(2026, 6, 30, 17, 39, 0); // Jul 30, 2026 local
const { startDate, endDate } = getDateRange('this_month', NOW);

describe('insights-cognito sameAccountId', () => {
    it('rejects nulls and matches string/number ids', () => {
        assert.equal(sameAccountId(null, 1), false);
        assert.equal(sameAccountId(12, '12'), true);
        assert.equal(sameAccountId(1, 2), false);
    });
});

describe('insights-cognito activityConvertsAlert', () => {
    const alert = {
        account_id: 10,
        created_at: '2026-07-10T14:00:00.000Z',
        status: 'New',
    };

    it('requires in-period activity on same account on/after trigger', () => {
        assert.equal(
            activityConvertsAlert(
                alert,
                [{ account_id: 10, date: '2026-07-12' }],
                startDate,
                endDate
            ),
            true
        );
    });

    it('does not match activities outside the selected period', () => {
        assert.equal(
            activityConvertsAlert(
                alert,
                [{ account_id: 10, date: '2026-06-20' }],
                startDate,
                endDate
            ),
            false
        );
        assert.equal(
            activityConvertsAlert(
                alert,
                [{ account_id: 10, date: '2026-08-01' }],
                startDate,
                endDate
            ),
            false
        );
    });

    it('does not match activities before the trigger', () => {
        assert.equal(
            activityConvertsAlert(
                alert,
                [{ account_id: 10, date: '2026-07-09' }],
                startDate,
                endDate
            ),
            false
        );
    });

    it('counts same-calendar-day date-only activity (date-safe)', () => {
        // Local Jul 10 end-of-day is after 14:00Z on Jul 10 in US timezones
        // and still on the alert calendar day for local date-only semantics.
        const compare = activityTimeForCompare('2026-07-10');
        assert.ok(compare);
        assert.equal(
            activityConvertsAlert(
                alert,
                [{ account_id: 10, date: '2026-07-10' }],
                startDate,
                endDate
            ),
            true
        );
    });

    it('never converts Dismissed alerts', () => {
        assert.equal(
            activityConvertsAlert(
                { ...alert, status: 'Dismissed' },
                [{ account_id: 10, date: '2026-07-12' }],
                startDate,
                endDate
            ),
            false
        );
    });

    it('allows multiple alerts on one account to share one activity', () => {
        const acts = [{ account_id: 10, date: '2026-07-20' }];
        const a1 = { ...alert, created_at: '2026-07-05T12:00:00.000Z' };
        const a2 = { ...alert, created_at: '2026-07-15T12:00:00.000Z' };
        assert.equal(activityConvertsAlert(a1, acts, startDate, endDate), true);
        assert.equal(activityConvertsAlert(a2, acts, startDate, endDate), true);
    });

    it('rejects different accounts and null account_id', () => {
        assert.equal(
            activityConvertsAlert(
                alert,
                [{ account_id: 99, date: '2026-07-12' }],
                startDate,
                endDate
            ),
            false
        );
        assert.equal(
            activityConvertsAlert(
                { ...alert, account_id: null },
                [{ account_id: 10, date: '2026-07-12' }],
                startDate,
                endDate
            ),
            false
        );
    });
});
