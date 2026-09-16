import { describe, it, expect } from 'bun:test';
import { extractMentions, collectMentions, uniqueMentions } from '../mentionParser';
import { parseWordCountGoal, headerNameWithoutGoal } from '../wordGoalParser';
import type { LineReader } from '../types';

function makeDoc(lines: string[]): LineReader {
    return { lineCount: lines.length, lineAt: (i: number) => ({ text: lines[i] }) };
}

describe('extractMentions', () => {
    it('extracts a single mention', () => {
        expect(extractMentions('discuss with @Lewis')).toEqual(['Lewis']);
    });
    it('extracts multiple mentions', () => {
        expect(extractMentions('sync @Alice and @Bob')).toEqual(['Alice', 'Bob']);
    });
    it('deduplicates repeated mentions', () => {
        expect(extractMentions('@Alice and also @Alice')).toEqual(['Alice']);
    });
    it('returns empty array for no mentions', () => {
        expect(extractMentions('plain item')).toEqual([]);
    });
    it('does not match @daily/@weekly recurrence markers as mentions', () => {
        // This test used to assert length >= 0, which is always true, while @daily was matched.
        expect(extractMentions('task @daily @weekly @monthly @created:2026-01-01 @expires:2026-02-01')).toEqual([]);
    });
});

describe('collectMentions', () => {
    it('returns empty array for a file with no mentions', () => {
        const doc = makeDoc(['> H', '>> - plain item']);
        expect(collectMentions(doc, '-')).toHaveLength(0);
    });
    it('collects mentions with correct section', () => {
        const doc = makeDoc(['> Header', '>> - discuss with @Lewis']);
        const items = collectMentions(doc, '-');
        expect(items).toHaveLength(1);
        expect(items[0].name).toBe('Lewis');
        expect(items[0].section).toBe('Header');
    });
});

describe('uniqueMentions', () => {
    it('returns sorted unique mention names', () => {
        const doc = makeDoc(['> H', '>> - @Zara item', '>> - @Alice item', '>> - @Zara again']);
        expect(uniqueMentions(doc, '-')).toEqual(['Alice', 'Zara']);
    });
});

describe('parseWordCountGoal', () => {
    it('parses ==500', () => expect(parseWordCountGoal('> My Section ==500')).toBe(500));
    it('returns null when no goal', () => expect(parseWordCountGoal('> My Section')).toBeNull());
    it('parses ==0', () => expect(parseWordCountGoal('> Section ==0')).toBe(0));
});

describe('headerNameWithoutGoal', () => {
    it('strips ==N and > prefix', () => expect(headerNameWithoutGoal('> My Section ==500')).toBe('My Section'));
    it('trims trailing whitespace', () => expect(headerNameWithoutGoal('> Section ==100 ')).toBe('Section'));
});
