import { describe, it, expect } from 'bun:test';
import { computeFileStats } from '../statistics';
import type { LineReader } from '../types';

function makeDoc(lines: string[]): LineReader {
    return { lineCount: lines.length, lineAt: (i: number) => ({ text: lines[i] }) };
}

describe('computeFileStats - extended markers', () => {
    it('counts done items', () => {
        const doc   = makeDoc(['> H', '>> - [x] done', '>> - [ ] todo']);
        const stats = computeFileStats(doc, '-');
        expect(stats.totalDone).toBe(1);
        expect(stats.totalChecks).toBe(2);
    });
    it('counts tags', () => {
        const doc   = makeDoc(['> H', '>> - item #urgent #wip']);
        const stats = computeFileStats(doc, '-');
        expect(stats.totalTags).toBe(2);
    });
    it('counts colour labels', () => {
        const doc   = makeDoc(['> H', '>> - {red} blocked']);
        const stats = computeFileStats(doc, '-');
        expect(stats.totalColoured).toBe(1);
    });
    it('counts flagged items', () => {
        const doc   = makeDoc(['> H', '>> - ? unclear']);
        const stats = computeFileStats(doc, '-');
        expect(stats.totalFlagged).toBe(1);
    });
    it('counts commented items', () => {
        const doc   = makeDoc(['> H', '>> - task // note']);
        const stats = computeFileStats(doc, '-');
        expect(stats.totalCommented).toBe(1);
    });
    it('counts stamped items', () => {
        const doc   = makeDoc(['> H', '>> - task @created:2026-01-01']);
        const stats = computeFileStats(doc, '-');
        expect(stats.totalStamped).toBe(1);
    });
    it('captures word goal on section', () => {
        const doc   = makeDoc(['> My Section ==500', '>> - item']);
        const stats = computeFileStats(doc, '-');
        expect(stats.sections[0].wordGoal).toBe(500);
    });
});
