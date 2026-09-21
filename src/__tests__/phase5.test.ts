import { describe, it, expect } from 'bun:test';
import { parseNote, getNoteLineForItem, buildNoteLine } from '../noteParser';
import { parseRecurrence, nextOccurrence, collectRecurringItems } from '../recurrenceParser';
import { parseWordCountGoal, headerNameWithoutGoal } from '../wordGoalParser';
import type { LineReader } from '../types';

function makeDoc(lines: string[]): LineReader {
    return { lineCount: lines.length, lineAt: (i: number) => ({ text: lines[i] }) };
}

describe('parseNote', () => {
    it('parses a note line', () => {
        const r = parseNote('>> > This is a note');
        expect(r?.note).toBe('This is a note');
        expect(r?.chevrons).toBe('>>');
    });
    it('returns null for a regular bullet line', () => {
        expect(parseNote('>> - regular item')).toBeNull();
    });
    it('returns null for a header', () => {
        expect(parseNote('> Header')).toBeNull();
    });
    it('works at deeper nesting', () => {
        expect(parseNote('>>> > deep note')?.chevrons).toBe('>>>');
    });
});

describe('getNoteLineForItem', () => {
    it('returns the note line index when a note follows an item', () => {
        const doc = makeDoc(['>> - item', '>> > note']);
        expect(getNoteLineForItem(doc, 0)).toBe(1);
    });
    it('returns -1 when no note follows', () => {
        const doc = makeDoc(['>> - item', '>> - another']);
        expect(getNoteLineForItem(doc, 0)).toBe(-1);
    });
});

describe('buildNoteLine', () => {
    it('builds a well-formed note line', () => {
        expect(buildNoteLine('>>', 'My note')).toBe('>> > My note');
    });
});

describe('parseRecurrence', () => {
    it('parses @weekly', () => {
        expect(parseRecurrence('review docs @weekly')?.type).toBe('weekly');
    });
    it('parses @daily', () => {
        expect(parseRecurrence('standup @daily')?.type).toBe('daily');
    });
    it('parses @monthly', () => {
        expect(parseRecurrence('billing check @monthly')?.type).toBe('monthly');
    });
    it('is case-insensitive', () => {
        expect(parseRecurrence('task @WEEKLY')?.type).toBe('weekly');
    });
    it('strips the marker from contentWithout', () => {
        expect(parseRecurrence('review @weekly')?.contentWithout).toBe('review');
    });
    it('returns null for no recurrence marker', () => {
        expect(parseRecurrence('plain item')).toBeNull();
    });
});

describe('nextOccurrence', () => {
    it('advances daily by 1 day', () => {
        expect(nextOccurrence('2026-03-20', 'daily')).toBe('2026-03-21');
    });
    it('advances weekly by 7 days', () => {
        expect(nextOccurrence('2026-03-20', 'weekly')).toBe('2026-03-27');
    });
    it('advances monthly by 1 month', () => {
        expect(nextOccurrence('2026-03-20', 'monthly')).toBe('2026-04-20');
    });
    // This test previously asserted '2026-03-03' -- it had pinned the Date#setMonth
    // overflow bug as "correct" under a title claiming the opposite. A monthly item
    // due on the 31st skipped February entirely. The day now clamps to the target
    // month's length.
    it('clamps the 31st to the end of a shorter month', () => {
        expect(nextOccurrence('2026-01-31', 'monthly')).toBe('2026-02-28');
    });
    it('clamps to 29 February in a leap year', () => {
        expect(nextOccurrence('2024-01-31', 'monthly')).toBe('2024-02-29');
    });
    it('clamps into a 30-day month instead of skipping it', () => {
        expect(nextOccurrence('2026-03-31', 'monthly')).toBe('2026-04-30');
    });
    it('rolls into the next year', () => {
        expect(nextOccurrence('2026-12-31', 'monthly')).toBe('2027-01-31');
    });
});

describe('collectRecurringItems', () => {
    it('returns empty array for a file with no recurring items', () => {
        const doc = makeDoc(['> H', '>> - plain']);
        expect(collectRecurringItems(doc, '-')).toHaveLength(0);
    });
    it('collects a recurring item with correct type and section', () => {
        const doc = makeDoc(['> Header', '>> - standup @daily']);
        const items = collectRecurringItems(doc, '-');
        expect(items).toHaveLength(1);
        expect(items[0].type).toBe('daily');
        expect(items[0].section).toBe('Header');
    });
});

describe('parseWordCountGoal', () => {
    it('parses a goal from a header', () => {
        expect(parseWordCountGoal('> My Section ==500')).toBe(500);
    });
    it('returns null when no goal present', () => {
        expect(parseWordCountGoal('> My Section')).toBeNull();
    });
});

describe('headerNameWithoutGoal', () => {
    it('strips ==N and > prefix', () => {
        expect(headerNameWithoutGoal('> My Section ==500')).toBe('My Section');
    });
    it('returns clean name when no goal', () => {
        expect(headerNameWithoutGoal('> My Section')).toBe('My Section');
    });
});
