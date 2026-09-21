/**
 * Timezone and calendar regression tests for the shared date helpers.
 *
 * Why this file exists: `bun test` starts every run at UTC offset 0 on this
 * machine, even though the OS is set to UK time, so the whole suite always ran
 * as UTC. The extension itself runs in VS Code's extension host, which DOES
 * honour the OS timezone. That gap hid a real bug: formatDate used
 * toISOString() (a UTC date) on dates built at LOCAL midnight, so anywhere east
 * of UTC every result was a day early -- in the UK, for all of British Summer
 * Time. "tomorrow" returned today and a +1 day shift did nothing.
 *
 * Bun does honour process.env.TZ assigned at RUNTIME, so each test here pins a
 * zone explicitly and afterEach restores the original. Without the restore,
 * every later test in the run would silently execute in Tokyo time.
 *
 * These tests were checked against the pre-fix code and fail there.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { formatDate, shiftDate, parseNaturalDate, addMonths, todayDate } from '../patternsUtils';
import { ageInDays } from '../itemAgeParser';
import { nextOccurrence } from '../recurrenceParser';

const ORIGINAL_TZ = process.env.TZ;
const setZone = (tz: string) => { process.env.TZ = tz; };

beforeEach(() => setZone('UTC'));
afterEach(() => {
    if (ORIGINAL_TZ === undefined) { delete process.env.TZ; } else { process.env.TZ = ORIGINAL_TZ; }
});

/** Zones either side of UTC, including the UK in summer (BST, UTC+1). */
const ZONES = ['UTC', 'Europe/London', 'Europe/Prague', 'Asia/Tokyo', 'America/New_York'];

describe('the test harness can really change timezone', () => {
    // Guard against this file silently measuring nothing, which is exactly how
    // the original bug went unnoticed.
    it('reports a non-zero offset once a zone is set', () => {
        setZone('Asia/Tokyo');
        expect(-new Date(2026, 5, 15).getTimezoneOffset()).toBe(540);
        setZone('Europe/London');
        expect(-new Date(2026, 5, 15).getTimezoneOffset()).toBe(60);
    });
});

describe('formatDate uses the local calendar date', () => {
    for (const tz of ZONES) {
        it(`keeps local midnight on its own day in ${tz}`, () => {
            setZone(tz);
            expect(formatDate(new Date(2026, 5, 15))).toBe('2026-06-15');
        });

        it(`keeps late evening on its own day in ${tz}`, () => {
            setZone(tz);
            expect(formatDate(new Date(2026, 5, 15, 23, 59))).toBe('2026-06-15');
        });
    }

    it('pads single-digit months and days', () => {
        expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('todayDate matches the local calendar', () => {
        setZone('Asia/Tokyo');
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        expect(todayDate()).toBe(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    });
});

describe('shiftDate', () => {
    for (const tz of ZONES) {
        it(`moves forward exactly one day in ${tz}`, () => {
            setZone(tz);
            expect(shiftDate('2026-06-15', 1)).toBe('2026-06-16');
        });
    }

    it('moves backwards', () => {
        setZone('Europe/London');
        expect(shiftDate('2026-06-15', -3)).toBe('2026-06-12');
    });

    it('crosses the UK spring clock change', () => {
        setZone('Europe/London');
        expect(shiftDate('2026-03-28', 1)).toBe('2026-03-29');
        expect(shiftDate('2026-03-29', 1)).toBe('2026-03-30');
    });
});

describe('parseNaturalDate', () => {
    const from = () => new Date(2026, 5, 15, 10, 0);   // 15 June 2026, 10:00 local

    for (const tz of ZONES) {
        it(`resolves "tomorrow" to the next day in ${tz}`, () => {
            setZone(tz);
            expect(parseNaturalDate('tomorrow', from())).toBe('2026-06-16');
        });
    }

    it('resolves "next month" from the 31st without skipping a month', () => {
        setZone('Europe/London');
        expect(parseNaturalDate('next month', new Date(2026, 0, 31, 10))).toBe('2026-02-28');
    });
});

describe('addMonths', () => {
    const iso = (d: Date) => formatDate(d);

    it('keeps the day when the target month is long enough', () => {
        expect(iso(addMonths(new Date(2026, 0, 15), 1))).toBe('2026-02-15');
    });

    it('clamps the 31st to the end of February', () => {
        expect(iso(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28');
    });

    it('clamps to 29 February in a leap year', () => {
        expect(iso(addMonths(new Date(2024, 0, 31), 1))).toBe('2024-02-29');
    });

    it('clamps into a 30-day month', () => {
        expect(iso(addMonths(new Date(2026, 2, 31), 1))).toBe('2026-04-30');
    });

    it('crosses a year boundary', () => {
        expect(iso(addMonths(new Date(2026, 11, 31), 1))).toBe('2027-01-31');
    });

    it('adds several months at once', () => {
        expect(iso(addMonths(new Date(2026, 0, 31), 3))).toBe('2026-04-30');
    });

    it('does not mutate its input', () => {
        const d = new Date(2026, 0, 31);
        addMonths(d, 1);
        expect(iso(d)).toBe('2026-01-31');
    });
});

describe('ageInDays across daylight-saving changes', () => {
    it('counts whole days across the UK spring change', () => {
        setZone('Europe/London');
        // Clocks go forward 01:00 on Sunday 29 March 2026: that local day is 23 hours.
        expect(ageInDays('2026-03-28', new Date(2026, 2, 30, 12))).toBe(2);
        expect(ageInDays('2026-03-29', new Date(2026, 2, 30, 12))).toBe(1);
    });

    it('counts whole days across the UK autumn change', () => {
        setZone('Europe/London');
        // Clocks go back 02:00 on Sunday 25 October 2026: that local day is 25 hours.
        expect(ageInDays('2026-10-24', new Date(2026, 9, 26, 12))).toBe(2);
        expect(ageInDays('2026-10-25', new Date(2026, 9, 26, 12))).toBe(1);
    });

    it('is zero on the same day', () => {
        setZone('Europe/London');
        expect(ageInDays('2026-06-15', new Date(2026, 5, 15, 23, 30))).toBe(0);
    });
});

describe('nextOccurrence in non-UTC zones', () => {
    for (const tz of ZONES) {
        it(`advances a daily item by exactly one day in ${tz}`, () => {
            setZone(tz);
            expect(nextOccurrence('2026-06-15', 'daily')).toBe('2026-06-16');
        });
    }
});
