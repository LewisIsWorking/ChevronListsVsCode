import { describe, it, expect } from 'bun:test';
import { collectIssues } from '../diagnostics';
import type { LineReader } from '../types';

function makeDoc(lines: string[]): LineReader {
    return { lineCount: lines.length, lineAt: (i: number) => ({ text: lines[i] }) };
}

describe('collectIssues - empty sections', () => {
    it('flags a header with no items', () => {
        const doc    = makeDoc(['> EmptyHeader']);
        const issues = collectIssues(doc, '-');
        expect(issues).toHaveLength(1);
        expect(issues[0].kind).toBe('empty-section');
        expect(issues[0].line).toBe(0);
    });

    it('does not flag a header with items', () => {
        const doc    = makeDoc(['> Header', '>> - item']);
        const issues = collectIssues(doc, '-');
        expect(issues).toHaveLength(0);
    });

    it('flags empty section among populated ones', () => {
        const doc = makeDoc(['> Full', '>> - item', '> Empty', '> AnotherFull', '>> - item']);
        const issues = collectIssues(doc, '-');
        expect(issues).toHaveLength(1);
        expect(issues[0].line).toBe(2);
    });
});

describe('collectIssues - duplicate headers', () => {
    it('flags a duplicate section name', () => {
        const doc    = makeDoc(['> Alpha', '>> - item', '> Alpha', '>> - item']);
        const issues = collectIssues(doc, '-');
        expect(issues.some(i => i.kind === 'duplicate-header')).toBe(true);
        expect(issues.find(i => i.kind === 'duplicate-header')?.line).toBe(2);
    });

    it('duplicate check is case-insensitive', () => {
        const doc    = makeDoc(['> Alpha', '>> - item', '> alpha', '>> - item']);
        const issues = collectIssues(doc, '-');
        expect(issues.some(i => i.kind === 'duplicate-header')).toBe(true);
    });

    it('does not flag unique headers', () => {
        const doc    = makeDoc(['> Alpha', '>> - item', '> Beta', '>> - item']);
        const issues = collectIssues(doc, '-');
        expect(issues.some(i => i.kind === 'duplicate-header')).toBe(false);
    });
});

describe('collectIssues - bad numbering', () => {
    it('flags the item BEFORE the break (not the item that breaks)', () => {
        // 69 is followed by 2 - flag 69, not 2
        const doc    = makeDoc(['> Header', '>> 69. first', '>> 2. second']);
        const issues = collectIssues(doc, '-');
        expect(issues.some(i => i.kind === 'bad-numbering')).toBe(true);
        expect(issues.find(i => i.kind === 'bad-numbering')?.line).toBe(1); // 69 is on line 1
    });

    it('flags an out-of-sequence jump (e.g. 1, 3)', () => {
        const doc    = makeDoc(['> Header', '>> 1. first', '>> 3. third']);
        const issues = collectIssues(doc, '-');
        expect(issues.some(i => i.kind === 'bad-numbering')).toBe(true);
        // Flag is on "1." because it's followed by "3." not "2."
        expect(issues.find(i => i.kind === 'bad-numbering')?.line).toBe(1);
    });

    it('does not flag correct sequence', () => {
        const doc    = makeDoc(['> Header', '>> 1. first', '>> 2. second', '>> 3. third']);
        const issues = collectIssues(doc, '-');
        expect(issues.some(i => i.kind === 'bad-numbering')).toBe(false);
    });

    it('does not flag a list starting at a number other than 1', () => {
        const doc    = makeDoc(['> Header', '>> 50. fifty', '>> 51. fifty-one']);
        const issues = collectIssues(doc, '-');
        expect(issues.some(i => i.kind === 'bad-numbering')).toBe(false);
    });

    it('flags a break in a custom-start sequence', () => {
        const doc    = makeDoc(['> Header', '>> 50. fifty', '>> 52. fifty-two']);
        const issues = collectIssues(doc, '-');
        expect(issues.some(i => i.kind === 'bad-numbering')).toBe(true);
        // Flag is on "50." because it's followed by "52." not "51."
        expect(issues.find(i => i.kind === 'bad-numbering')?.line).toBe(1);
    });

    it('resets counter for each new section', () => {
        const doc    = makeDoc(['> A', '>> 1. one', '>> 2. two', '> B', '>> 1. one', '>> 2. two']);
        expect(collectIssues(doc, '-').some(i => i.kind === 'bad-numbering')).toBe(false);
    });

    it('tracks depth independently', () => {
        const doc    = makeDoc(['> Header', '>> 1. one', '>>> 1. nested', '>>> 2. nested', '>> 2. two']);
        expect(collectIssues(doc, '-').some(i => i.kind === 'bad-numbering')).toBe(false);
    });
});

describe('collectIssues - duplicate subheadings', () => {
    it('flags a duplicate ## subheading', () => {
        const doc    = makeDoc(['## Session 277.', '> Header', '>> - item', '## Session 277.']);
        const issues = collectIssues(doc, '-');
        expect(issues.some(i => i.kind === 'duplicate-subheading')).toBe(true);
        expect(issues.find(i => i.kind === 'duplicate-subheading')?.line).toBe(3);
    });

    it('duplicate subheading check is case-insensitive', () => {
        const doc    = makeDoc(['## Session 277.', '## session 277.']);
        const issues = collectIssues(doc, '-');
        expect(issues.some(i => i.kind === 'duplicate-subheading')).toBe(true);
    });

    it('does not flag unique subheadings', () => {
        const doc    = makeDoc(['## Session 277.', '## Session 278.']);
        const issues = collectIssues(doc, '-');
        expect(issues.some(i => i.kind === 'duplicate-subheading')).toBe(false);
    });

    it('works for deeper heading levels (###)', () => {
        const doc    = makeDoc(['### Notes', '> Header', '>> - item', '### Notes']);
        const issues = collectIssues(doc, '-');
        expect(issues.some(i => i.kind === 'duplicate-subheading')).toBe(true);
    });

    it('does not flag chevron > headers as subheadings', () => {
        const doc    = makeDoc(['> Alpha', '>> - item', '> Alpha', '>> - item']);
        const issues = collectIssues(doc, '-');
        expect(issues.some(i => i.kind === 'duplicate-subheading')).toBe(false);
        expect(issues.some(i => i.kind === 'duplicate-header')).toBe(true);
    });
});
