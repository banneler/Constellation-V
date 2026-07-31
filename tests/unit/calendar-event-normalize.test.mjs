import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    parseUnixSeconds,
    normalizeHexColor,
    colorFromGoogleColorId,
    colorFromGoogleCalendarColorId,
    deterministicColorFromKey,
    parseEventWhen,
    normalizeCalendarEvent,
    buildCalendarColorMap,
    extractCalendarHexColor,
} = require('../../api/_lib/calendar-event-normalize.js');

describe('calendar-event-normalize when parse', () => {
    it('reads timespan start_time/end_time as exclusive unix seconds', () => {
        const start = 1785441600; // arbitrary
        const end = start + 45 * 60;
        const parsed = parseEventWhen({
            object: 'timespan',
            start_time: start,
            end_time: end,
        });
        assert.equal(parsed.allDay, false);
        assert.equal(parsed.startTime, start);
        assert.equal(parsed.endTime, end);
        assert.equal(parsed.endTime - parsed.startTime, 45 * 60);
    });

    it('falls back to endTime camelCase and ISO strings', () => {
        const startIso = '2026-07-30T18:00:00.000Z';
        const endIso = '2026-07-30T18:45:00.000Z';
        const parsed = parseEventWhen({ startTime: startIso, endTime: endIso });
        assert.equal(parsed.startTime, Math.floor(Date.parse(startIso) / 1000));
        assert.equal(parsed.endTime, Math.floor(Date.parse(endIso) / 1000));
        assert.equal(parsed.endTime - parsed.startTime, 45 * 60);
    });

    it('does not confuse all-day datespan with timed fields', () => {
        const parsed = parseEventWhen({ start_date: '2026-07-30', end_date: '2026-07-31' });
        assert.equal(parsed.allDay, true);
        assert.ok(parsed.startTime != null);
    });

    it('tolerates ms timestamps in parseUnixSeconds', () => {
        assert.equal(parseUnixSeconds(1785441600000), 1785441600);
        assert.equal(parseUnixSeconds(1785441600), 1785441600);
    });
});

describe('calendar-event-normalize colors', () => {
    it('prefers calendar map hex_color over missing event color', () => {
        const colorByCalendarId = buildCalendarColorMap({
            data: [
                { id: 'cal-1', hex_color: '#a4bdfc', is_primary: true },
                { id: 'cal-2', hex_color: '#f83a22' },
            ],
        });
        assert.equal(colorByCalendarId.get('primary'), '#A4BDFC');
        const ev = normalizeCalendarEvent(
            {
                id: 'e1',
                title: 'Discovery call - Acme Corp',
                calendar_id: 'cal-2',
                when: { start_time: 1000, end_time: 1000 + 45 * 60 },
            },
            { calendarColor: '#A4BDFC', colorByCalendarId }
        );
        assert.equal(ev.color, '#F83A22');
        assert.equal(ev.endTime - ev.startTime, 45 * 60);
    });

    it('normalizeHexColor accepts 3-digit and bare hex', () => {
        assert.equal(normalizeHexColor('f00'), '#FF0000');
        assert.equal(normalizeHexColor('#039BE5'), '#039BE5');
        assert.equal(normalizeHexColor('039be5'), '#039BE5');
    });

    it('maps Google color_id over calendar label color', () => {
        assert.equal(colorFromGoogleColorId('11'), '#DC2127');
        assert.equal(colorFromGoogleColorId(4), '#FF887C');
        const colorByCalendarId = buildCalendarColorMap({
            data: [{ id: 'cal-1', hex_color: '#a4bdfc', is_primary: true }],
        });
        const ev = normalizeCalendarEvent(
            {
                id: 'e-color',
                title: 'Tomato event',
                calendar_id: 'cal-1',
                color_id: '11',
                when: { start_time: 1000, end_time: 1900 },
            },
            { colorByCalendarId }
        );
        assert.equal(ev.color, '#DC2127');
        assert.equal(ev.colorId, '11');
    });

    it('maps Google calendar-list colorId when hex_color is null', () => {
        assert.equal(colorFromGoogleCalendarColorId('3'), '#F83A22');
        assert.equal(colorFromGoogleCalendarColorId('16'), '#4986E7');
        assert.equal(
            extractCalendarHexColor({ id: 'work', name: 'Work', hex_color: null, color_id: '3' }),
            '#F83A22'
        );
    });

    it('does not paint Work/Stuff with primary color when their hex is missing', () => {
        // Primary hex chosen outside the deterministic fallback palette.
        const primaryHex = '#112233';
        const colorByCalendarId = buildCalendarColorMap(
            {
                data: [
                    { id: 'primary-cal', hex_color: primaryHex, is_primary: true },
                    { id: 'work-cal', name: 'Work', hex_color: null },
                    { id: 'stuff-cal', name: 'Stuff', hex_color: null },
                ],
            },
            { fillMissing: false }
        );
        assert.equal(colorByCalendarId.get('primary-cal'), primaryHex);
        assert.equal(colorByCalendarId.get('work-cal'), undefined);

        const workEv = normalizeCalendarEvent(
            {
                id: 'e-work',
                title: 'Work meeting',
                calendar_id: 'work-cal',
                when: { start_time: 1000, end_time: 1900 },
            },
            {
                // Bug regress: old code passed primary hex as calendarColor for every cal.
                calendarColor: null,
                colorByCalendarId,
            }
        );
        const stuffEv = normalizeCalendarEvent(
            {
                id: 'e-stuff',
                title: 'Stuff block',
                calendar_id: 'stuff-cal',
                when: { start_time: 2000, end_time: 2900 },
            },
            { calendarColor: null, colorByCalendarId }
        );
        const primaryEv = normalizeCalendarEvent(
            {
                id: 'e-pri',
                title: 'Primary',
                calendar_id: 'primary-cal',
                when: { start_time: 3000, end_time: 3900 },
            },
            { calendarColor: primaryHex, colorByCalendarId }
        );

        assert.equal(primaryEv.color, primaryHex);
        assert.notEqual(workEv.color, primaryHex);
        assert.notEqual(stuffEv.color, primaryHex);
        assert.notEqual(workEv.color, stuffEv.color);
        assert.equal(workEv.color, deterministicColorFromKey('work-cal'));
        assert.equal(stuffEv.color, deterministicColorFromKey('stuff-cal'));
    });

    it('fillMissing assigns stable distinct colors for Work/Stuff', () => {
        const map = buildCalendarColorMap({
            data: [
                { id: 'work-cal', name: 'Work', hex_color: null },
                { id: 'stuff-cal', name: 'Stuff', hex_color: null },
            ],
        });
        assert.ok(map.get('work-cal'));
        assert.ok(map.get('stuff-cal'));
        assert.notEqual(map.get('work-cal'), map.get('stuff-cal'));
    });
});
