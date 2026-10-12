import { describe, it, expect } from 'bun:test';
import {
    collectSetDuplicates, computeMoveToSection, findSets, moveTargetsFor, setMemberKey, setSummary,
} from '../sets';
import { collectIssues } from '../diagnostics';
import type { LineReader } from '../types';

const bikes = [
    '# Beer Bikes #set',             // 0
    '',
    '> Paid.',                       // 2
    '>> 1. Lewis.',
    '>> 2. Eimer.',
    '',
    "> Hasn't paid.",                // 6
    '>> 1. Ethan.',
    '>> 2. Luke.',
    '>>> owes for two',
    '',
    '> Not going.',                  // 11
    '>> 1. ethan',
    '>> 2. Jess.',
    '',
    '# Other',                       // 15
    '> Elsewhere',                   // 16
    '>> - Ethan.',
];

const reader = (lines: string[]): LineReader => ({ lineCount: lines.length, lineAt: (i: number) => ({ text: lines[i] }) });

describe('findSets', () => {
    it('holds the sections up to the next heading of its level', () => {
        expect(findSets(bikes)).toEqual([{ headingLine: 0, sections: [2, 6, 11] }]);
    });
    it('keeps deeper headings inside the set, and needs the tag as a whole word', () => {
        const doc = ['## Trip #set', '> A', '### Day one', '> B', '## Next', '> C', '# Not #settled'];
        expect(findSets(doc)).toEqual([{ headingLine: 0, sections: [1, 3] }]);
    });
});

describe('setMemberKey', () => {
    it('ignores case, checkboxes, spacing and end punctuation', () => {
        expect(setMemberKey('[x] Thomas  McNeil.')).toBe('thomas mcneil');
        expect(setMemberKey('Ethan.')).toBe(setMemberKey('ethan'));
        expect(setMemberKey('Luke')).not.toBe(setMemberKey('Luke Skillen'));
    });
});

describe('collectSetDuplicates', () => {
    it('flags an item in two lists of a set on both lines', () => {
        const issues = collectSetDuplicates(bikes, '-');
        expect(issues.map(i => i.line)).toEqual([7, 12]);
        expect(issues[0].message).toBe('In this set more than once: also in "Not going." (line 13)');
        expect(issues[1].message).toBe('In this set more than once: also in "Hasn\'t paid." (line 8)');
        expect(issues.every(i => i.kind === 'set-duplicate')).toBe(true);
    });
    it('leaves out nested notes and sections outside the set', () => {
        const doc = [...bikes];
        doc[12] = '>> 1. Jo';
        doc[9]  = '>>> - Lewis';
        expect(collectSetDuplicates(doc, '-')).toEqual([]);
    });
    it('is reported by collectIssues', () => {
        expect(collectIssues(reader(bikes), '-').filter(i => i.kind === 'set-duplicate')).toHaveLength(2);
    });
});

describe('moveTargetsFor', () => {
    it('offers the set\'s other lists inside a set, and every other section elsewhere', () => {
        expect(moveTargetsFor(bikes, 7, '-')).toEqual([{ header: 2, name: 'Paid.' }, { header: 11, name: 'Not going.' }]);
        expect(moveTargetsFor(bikes, 17, '-').map(t => t.header)).toEqual([2, 6, 11]);
        expect(moveTargetsFor(bikes, 9, '-')).toEqual([]);   // a nested note
        expect(moveTargetsFor(bikes, 2, '-')).toEqual([]);   // a header
    });
});

describe('computeMoveToSection', () => {
    it('carries nested lines down and renumbers both lists', () => {
        const r = computeMoveToSection(bikes, 8, 11, '-')!;
        expect(r.slice(6, 15)).toEqual(["> Hasn't paid.", '>> 1. Ethan.', '', '> Not going.', '>> 1. ethan', '>> 2. Jess.',
            '>> 3. Luke.', '>>> owes for two', '']);
        expect(r).toHaveLength(bikes.length);
    });
    it('lands after the last item when moving up, before the blank line', () => {
        const r = computeMoveToSection(bikes, 13, 2, '-')!;
        expect(r.slice(2, 7)).toEqual(['> Paid.', '>> 1. Lewis.', '>> 2. Eimer.', '>> 3. Jess.', '']);
        expect(r.slice(12, 15)).toEqual(['> Not going.', '>> 1. ethan', '']);
    });
    it('takes the list type of its new section', () => {
        const doc = ['> Numbered', '>> 1. a', '>> 2. b', '> Bullets', '>> - c'];
        expect(computeMoveToSection(doc, 2, 3, '-')).toEqual(['> Numbered', '>> 1. a', '> Bullets', '>> - c', '>> - b']);
        expect(computeMoveToSection(doc, 4, 0, '-')).toEqual(['> Numbered', '>> 1. a', '>> 2. b', '>> 3. c', '> Bullets']);
        expect(computeMoveToSection(bikes, 7, 16, '-')).toBeNull();   // out of its set
        expect(computeMoveToSection(bikes, 17, 2, '-')![5]).toBe('>> 3. Ethan.');
    });
    it('moves into an empty section right under the header', () => {
        const doc = ['> A', '>> 1. x', '>> 2. y', '> B', '', '> C'];
        expect(computeMoveToSection(doc, 1, 3, '-')).toEqual(['> A', '>> 1. y', '> B', '>> 1. x', '', '> C']);
    });
    it('refuses its own section and lines that are not items', () => {
        expect(computeMoveToSection(bikes, 7, 6, '-')).toBeNull();
        expect(computeMoveToSection(bikes, 9, 2, '-')).toBeNull();
        expect(computeMoveToSection(bikes, 7, 3, '-')).toBeNull();   // line 3 is not a header
    });
});

describe('setSummary', () => {
    it('counts each list, and each member once in all', () => {
        expect(setSummary(bikes, 0, '-')).toBe("2 Paid, 2 Hasn't paid, 2 Not going, 5 in all");
        expect(setSummary(bikes, 15, '-')).toBeNull();   // a heading without #set
        expect(setSummary(bikes, 2, '-')).toBeNull();    // a section header
        expect(setSummary(['# Empty #set', 'text'], 0, '-')).toBeNull();
    });
    it('does not count an empty item just started with Enter', () => {
        const doc = [...bikes];
        doc.splice(3, 0, '>> 1. ');
        expect(setSummary(doc, 0, '-')).toBe("2 Paid, 2 Hasn't paid, 2 Not going, 5 in all");
    });
});
