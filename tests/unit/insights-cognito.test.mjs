import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    activityConvertsAlert,
    activityEffectiveTime,
    assignConvertedAlertIds,
    sameAccountId,
} from '../../js/insights-cognito.mjs';

describe('insights-cognito sameAccountId', () => {
    it('rejects nulls and matches string/number ids', () => {
        assert.equal(sameAccountId(null, 1), false);
        assert.equal(sameAccountId(12, '12'), true);
        assert.equal(sameAccountId(1, 2), false);
    });
});

describe('insights-cognito activityConvertsAlert / 1:1 assignment', () => {
    const alert = {
        id: 1,
        account_id: 10,
        created_at: '2026-07-10T14:00:00.000Z',
        status: 'New',
    };

    it('matches same-account activity on/after the trigger', () => {
        assert.equal(
            activityConvertsAlert(alert, [{ id: 'a1', account_id: 10, date: '2026-07-12' }]),
            true
        );
    });

    it('does not match activities before the trigger', () => {
        assert.equal(
            activityConvertsAlert(alert, [{ id: 'a1', account_id: 10, date: '2026-07-09' }]),
            false
        );
    });

    it('counts same-calendar-day date-only activity (date-safe end-of-day)', () => {
        const compare = activityEffectiveTime('2026-07-10');
        assert.ok(compare);
        assert.equal(compare.getHours(), 23);
        assert.equal(
            activityConvertsAlert(alert, [{ id: 'a1', account_id: 10, date: '2026-07-10' }]),
            true
        );
    });

    it('never converts Dismissed alerts', () => {
        assert.equal(
            activityConvertsAlert(
                { ...alert, status: 'Dismissed' },
                [{ id: 'a1', account_id: 10, date: '2026-07-12' }]
            ),
            false
        );
    });

    it('one activity converts at most one alert on the same account (greedy 1:1)', () => {
        const acts = [{ id: 'a1', account_id: 10, date: '2026-07-20' }];
        const a1 = { ...alert, id: 101, created_at: '2026-07-05T12:00:00.000Z' };
        const a2 = { ...alert, id: 102, created_at: '2026-07-15T12:00:00.000Z' };
        const converted = assignConvertedAlertIds([a1, a2], acts);
        assert.equal(converted.size, 1);
        // Nearest alert created_at ≤ activity wins (a2).
        assert.equal(converted.has(102), true);
        assert.equal(converted.has(101), false);
    });

    it('Best Buy case: 1 email converts 1 of 11 in-period alerts, not all 11', () => {
        const alerts = Array.from({ length: 11 }, (_, i) => ({
            id: 200 + i,
            account_id: 10,
            created_at: `2026-07-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`,
            status: 'New',
        }));
        const acts = [{ id: 'email-1', account_id: 10, date: '2026-07-20T16:00:00.000Z' }];
        const converted = assignConvertedAlertIds(alerts, acts);
        assert.equal(converted.size, 1);
    });

    it('prefers explicit cognito_alert_id over greedy account match', () => {
        const early = { ...alert, id: 301, created_at: '2026-07-05T12:00:00.000Z' };
        const late = { ...alert, id: 302, created_at: '2026-07-15T12:00:00.000Z' };
        const acts = [
            {
                id: 'a1',
                account_id: 10,
                date: '2026-07-20',
                cognito_alert_id: 301,
            },
        ];
        const converted = assignConvertedAlertIds([early, late], acts);
        assert.deepEqual([...converted], [301]);
    });

    it('two activities convert two distinct alerts (not the same one twice)', () => {
        const a1 = { ...alert, id: 401, created_at: '2026-07-05T12:00:00.000Z' };
        const a2 = { ...alert, id: 402, created_at: '2026-07-15T12:00:00.000Z' };
        const acts = [
            { id: 'e1', account_id: 10, date: '2026-07-10' },
            { id: 'e2', account_id: 10, date: '2026-07-20' },
        ];
        const converted = assignConvertedAlertIds([a1, a2], acts);
        assert.equal(converted.size, 2);
        assert.equal(converted.has(401), true);
        assert.equal(converted.has(402), true);
    });

    it('rejects different accounts and null account_id', () => {
        assert.equal(
            activityConvertsAlert(alert, [{ id: 'a1', account_id: 99, date: '2026-07-12' }]),
            false
        );
        assert.equal(
            activityConvertsAlert(
                { ...alert, account_id: null },
                [{ id: 'a1', account_id: 10, date: '2026-07-12' }]
            ),
            false
        );
    });

    it('returns false when outreach pool is empty (period pre-filter)', () => {
        assert.equal(activityConvertsAlert(alert, []), false);
    });
});
