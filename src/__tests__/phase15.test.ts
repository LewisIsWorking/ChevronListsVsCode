import { describe, it, expect } from 'bun:test';
import { toggleStrikethrough } from '../patterns';
import { parseColourLabel, setColourLabel,
         removeColourLabel, collectColourLabels } from '../colourLabelParser';
import type { LineReader } from '../types';

function makeDoc(lines: string[]): LineReader {
    return { lineCount: lines.length, lineAt: (i: number) => ({ text: lines[i] }) };
}

describe('toggleStrikethrough', () => {
    it('wraps content in ~~', () => {
        expect(toggleStrikethrough('item text')).toBe('~~item text~~');
    });
    it('removes ~~ when already struck through', () => {
        expect(toggleStrikethrough('~~item text~~')).toBe('item text');
    });
    it('leaves an empty item alone', () => {
        // It used to become "~~~~", which toggling again turned into "~~~~~~~~".
        expect(toggleStrikethrough('')).toBe('');
    });
});

describe('parseColourLabel', () => {
    it('parses {red}', () => expect(parseColourLabel('{red} item')).toBe('red'));
    it('parses {green}', () => expect(parseColourLabel('{green} go')).toBe('green'));
    it('parses {blue}', () => expect(parseColourLabel('{blue} note')).toBe('blue'));
    it('parses {yellow}', () => expect(parseColourLabel('{yellow} caution')).toBe('yellow'));
    it('returns null for no label', () => expect(parseColourLabel('plain item')).toBeNull());
    it('returns null for unknown colour', () => expect(parseColourLabel('{pink} item')).toBeNull());
});

describe('setColourLabel', () => {
    it('adds a colour label to plain content', () => {
        expect(setColourLabel('my task', 'red')).toBe('{red} my task');
    });
    it('replaces an existing colour label', () => {
        expect(setColourLabel('{green} my task', 'red')).toBe('{red} my task');
    });
});

describe('removeColourLabel', () => {
    it('removes a colour label', () => {
        expect(removeColourLabel('{red} my task')).toBe('my task');
    });
    it('returns unchanged string when no label', () => {
        expect(removeColourLabel('plain item')).toBe('plain item');
    });
});

describe('collectColourLabels', () => {
    it('returns empty for no labelled items', () => {
        const doc = makeDoc(['> H', '>> - plain']);
        expect(collectColourLabels(doc, '-')).toHaveLength(0);
    });
    it('collects labelled items with correct label and section', () => {
        const doc = makeDoc(['> Header', '>> - {red} blocked task']);
        const items = collectColourLabels(doc, '-');
        expect(items).toHaveLength(1);
        expect(items[0].label).toBe('red');
        expect(items[0].section).toBe('Header');
        expect(items[0].content).toBe('blocked task');
    });
    it('collects multiple labels across sections', () => {
        const doc = makeDoc(['> A', '>> - {red} a', '> B', '>> - {green} b']);
        expect(collectColourLabels(doc, '-')).toHaveLength(2);
    });
});
