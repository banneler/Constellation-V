import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    TIMELINE_SPAN_MIN,
    toUnixSeconds,
    timedEventLocalMinutes,
    clampToTimeline,
    packOverlapColumns,
    columnPlacement,
    normalizeEventColor,
    colorFromGoogleColorId,
    deterministicColorFromKey,
} from '../../js/cc-calendar-geometry.mjs';

function dayKeyFromDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

describe('cc-calendar-geometry duration parse', () => {
    it('treats exclusive end_time as true duration (2:00–2:45 → 45 min)', () => {
        // Local noon-ish: build 14:00–14:45 on a fixed local day.
        const start = new Date(2026, 6, 30, 14, 0, 0);
        const end = new Date(2026, 6, 30, 14, 45, 0);
        const ev = {
            startTime: Math.floor(start.getTime() / 1000),
            endTime: Math.floor(end.getTime() / 1000),
            allDay: false,
        };
        const mins = timedEventLocalMinutes(ev, dayKeyFromDate(start), { dayKeyFromDate });
        assert.ok(mins);
        assert.equal(Math.round(mins.durationMin), 45);
        assert.equal(Math.round(mins.startMin), 14 * 60);
        assert.equal(Math.round(mins.endMin), 14 * 60 + 45);

        const clamped = clampToTimeline(mins.startMin, mins.endMin);
        assert.ok(clamped);
        assert.equal(Math.round(clamped.durationMin), 45);
        // 45 / 660 of the 7am–6pm track
        assert.ok(Math.abs(clamped.heightPct - (45 / TIMELINE_SPAN_MIN) * 100) < 0.001);
        // Top at 2pm = (840-420)/660
        assert.ok(Math.abs(clamped.topPct - ((14 * 60 - 7 * 60) / TIMELINE_SPAN_MIN) * 100) < 0.001);
    });

    it('accepts ms timestamps and ISO strings via toUnixSeconds', () => {
        const sec = 1785441600;
        assert.equal(toUnixSeconds(sec), sec);
        assert.equal(toUnixSeconds(sec * 1000), sec);
        assert.equal(toUnixSeconds('2026-07-30T18:00:00.000Z'), Math.floor(Date.parse('2026-07-30T18:00:00.000Z') / 1000));
    });

    it('defaults missing endTime to +60 minutes', () => {
        const start = new Date(2026, 6, 30, 9, 0, 0);
        const ev = { startTime: Math.floor(start.getTime() / 1000), endTime: null };
        const mins = timedEventLocalMinutes(ev, dayKeyFromDate(start), { dayKeyFromDate });
        assert.equal(Math.round(mins.durationMin), 60);
    });
});

describe('cc-calendar-geometry packOverlapColumns', () => {
    it('places non-overlapping events in a single column', () => {
        const layout = packOverlapColumns([
            { id: 'a', startMin: 9 * 60, endMin: 9 * 60 + 30 },
            { id: 'b', startMin: 13 * 60, endMin: 14 * 60 },
            { id: 'c', startMin: 14 * 60, endMin: 14 * 60 + 45 },
        ]);
        assert.equal(layout.get('a').columnCount, 1);
        assert.equal(layout.get('b').columnCount, 1);
        assert.equal(layout.get('c').columnCount, 1);
        assert.equal(layout.get('a').columnIndex, 0);
    });

    it('packs concurrent intervals side by side', () => {
        const layout = packOverlapColumns([
            { id: 'early', startMin: 14 * 60, endMin: 15 * 60 },
            { id: 'overlap', startMin: 14 * 60 + 15, endMin: 14 * 60 + 45 },
            { id: 'later', startMin: 16 * 60, endMin: 17 * 60 },
        ]);
        assert.equal(layout.get('early').columnCount, 2);
        assert.equal(layout.get('overlap').columnCount, 2);
        assert.notEqual(layout.get('early').columnIndex, layout.get('overlap').columnIndex);
        assert.equal(layout.get('later').columnCount, 1);
    });

    it('reuses a column when the prior event has ended (half-open)', () => {
        const layout = packOverlapColumns([
            { id: 'a', startMin: 10 * 60, endMin: 11 * 60 },
            { id: 'b', startMin: 11 * 60, endMin: 12 * 60 },
        ]);
        assert.equal(layout.get('a').columnCount, 1);
        assert.equal(layout.get('b').columnCount, 1);
        assert.equal(layout.get('a').columnIndex, 0);
        assert.equal(layout.get('b').columnIndex, 0);
    });

    it('columnPlacement leaves a small gap between columns', () => {
        const a = columnPlacement(0, 2);
        const b = columnPlacement(1, 2);
        assert.ok(a.widthFrac < 0.5);
        assert.ok(b.leftFrac > a.leftFrac + a.widthFrac - 0.001);
        assert.ok(a.leftFrac + a.widthFrac + b.widthFrac < 1.01);
    });
});

describe('cc-calendar-geometry colors', () => {
    it('normalizes and uppercases hex', () => {
        assert.equal(normalizeEventColor('7bd148'), '#7BD148');
        assert.equal(normalizeEventColor('#f83a22'), '#F83A22');
    });

    it('maps Google color_id palette', () => {
        assert.equal(colorFromGoogleColorId('9'), '#5484ED');
        assert.equal(colorFromGoogleColorId(null), null);
    });

    it('deterministicColorFromKey keeps Work and Stuff distinct', () => {
        const work = deterministicColorFromKey('work-cal');
        const stuff = deterministicColorFromKey('stuff-cal');
        assert.ok(work);
        assert.ok(stuff);
        assert.notEqual(work, stuff);
        assert.equal(work, deterministicColorFromKey('work-cal'));
    });
});
