import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    activityConvertsAlert,
    activityEffectiveTime,
    sameAccountId,
} from '../../js/insights-cognito.mjs';

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

    it('matches same-account activity on/after the trigger', () => {
        assert.equal(
            activityConvertsAlert(alert, [{ account_id: 10, date: '2026-07-12' }]),
            true
        );
    });

    it('does not match activities before the trigger', () => {
        assert.equal(
            activityConvertsAlert(alert, [{ account_id: 10, date: '2026-07-09' }]),
            false
        );
    });

    it('counts same-calendar-day date-only activity (date-safe end-of-day)', () => {
        const compare = activityEffectiveTime('2026-07-10');
        assert.ok(compare);
        assert.equal(compare.getHours(), 23);
        assert.equal(
            activityConvertsAlert(alert, [{ account_id: 10, date: '2026-07-10' }]),
            true
        );
    });

    it('never converts Dismissed alerts', () => {
        assert.equal(
            activityConvertsAlert(
                { ...alert, status: 'Dismissed' },
                [{ account_id: 10, date: '2026-07-12' }]
            ),
            false
        );
    });

    it('allows multiple alerts on one account to share one activity', () => {
        const acts = [{ account_id: 10, date: '2026-07-20' }];
        const a1 = { ...alert, created_at: '2026-07-05T12:00:00.000Z' };
        const a2 = { ...alert, created_at: '2026-07-15T12:00:00.000Z' };
        assert.equal(activityConvertsAlert(a1, acts), true);
        assert.equal(activityConvertsAlert(a2, acts), true);
    });

    it('rejects different accounts and null account_id', () => {
        assert.equal(
            activityConvertsAlert(alert, [{ account_id: 99, date: '2026-07-12' }]),
            false
        );
        assert.equal(
            activityConvertsAlert(
                { ...alert, account_id: null },
                [{ account_id: 10, date: '2026-07-12' }]
            ),
            false
        );
    });

    it('returns false when outreach pool is empty (period pre-filter)', () => {
        // Callers pass Activities-KPI rows only; out-of-period acts never enter the pool.
        assert.equal(activityConvertsAlert(alert, []), false);
    });
});
