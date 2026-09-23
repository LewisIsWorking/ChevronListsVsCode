/**
 * Regression tests for word counting.
 *
 * There were two definitions of an item's word count. Ten modules split the raw
 * content on whitespace, four stripped metadata first. On the same section the
 * section summary, the word-count picker and file statistics disagreed with
 * Quick Stats and the word-goal nudge, and markup was counted as prose: an
 * unchecked "[ ]" was two words, a checked "[x]" one, and every #tag and
 * @date a word. The section summary also said "1 words".
 *
 * Every counter now calls itemWordCount. These tests were checked against the
 * original code, where they fail.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { itemWordCount } from '../metadataStripper';
import { onShowSectionSummary } from '../counterCommands';
import { onQuickStats } from '../quickStatsCommands';
import { onShowWordCount } from '../wordCountCommands';
import { computeFileStats } from '../statistics';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: {
        info: string[];
    };
    lastQuickPick(): { items: { label: string; description: string }[] };
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('itemWordCount', () => {
    it('counts plain words', () => {
        expect(itemWordCount('one two three')).toBe(3);
    });

    it('counts an unchecked and a checked item the same', () => {
        expect(itemWordCount('[ ] write report')).toBe(2);
        expect(itemWordCount('[x] write report')).toBe(2);
    });

    it('does not count tags, due dates, priority or votes', () => {
        expect(itemWordCount('!!! write report #work @2026-01-01 +3')).toBe(2);
    });

    it('is zero for empty content', () => {
        expect(itemWordCount('')).toBe(0);
        expect(itemWordCount('   ')).toBe(0);
    });

    it('is zero for content that is only metadata', () => {
        expect(itemWordCount('[ ] #work @2026-01-01')).toBe(0);
    });
});

describe('every word counter agrees', () => {
    // Three items, six words of prose, and a lot of markup that is not prose.
    const lines = [
        '> Plan',
        '>> - [ ] write the report #work',
        '>> - [x] ship it @2026-01-01',
        '>> 1. !! celebrate +2',
    ];
    const EXPECTED = 6;

    const wordsIn = (text: string) => Number(/(\d+) words?/.exec(text)![1]);

    it('section summary', async () => {
        openEditor(lines, { cursor: 1 });
        await onShowSectionSummary();
        expect(wordsIn(mock.recorded.info.at(-1)!)).toBe(EXPECTED);
    });

    it('quick stats', async () => {
        openEditor(lines, { cursor: 1 });
        await onQuickStats();
        const parts = mock.recorded.info.at(-1)!.split(' · ');
        expect(wordsIn(parts.find(p => /words?$/.test(p))!)).toBe(EXPECTED);
    });

    it('word count picker', async () => {
        openEditor(lines, { cursor: 1 });
        await onShowWordCount();
        expect(wordsIn(mock.lastQuickPick().items[0].description)).toBe(EXPECTED);
    });

    it('file statistics', () => {
        const doc = { lineCount: lines.length, lineAt: (i: number) => ({ text: lines[i] }) };
        const stats = computeFileStats(doc as any, '-');
        expect(stats.totalWords).toBe(EXPECTED);
        expect(stats.sections[0].wordCount).toBe(EXPECTED);
    });
});

describe('section summary wording', () => {
    it('says "1 word", not "1 words"', async () => {
        openEditor(['> S', '>> - solo'], { cursor: 1 });
        await onShowSectionSummary();
        expect(mock.recorded.info.at(-1)).toBe('"S" - 1 item, 1 word');
    });
});
