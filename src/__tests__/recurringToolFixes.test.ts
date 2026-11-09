/**
 * A checkbox counts wherever it sits among the leading markers. Generate Next
 * Occurrence keeps its new date in the item's words, Group by Mention keeps the
 * section's other lines, and collecting a tag twice does not copy its results.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { parseCheck, toggleCheckLine } from '../checkParser';
import { onGenerateNextOccurrence } from '../recurrenceCommands';
import { onGroupItemsByMention } from '../groupByMentionCommands';
import { onCollectItemsByTag } from '../collectByTagCommands';
import { onShowWordCountGoals } from '../wordCountGoalsCommands';
import { scoreItemComplexity } from '../patterns';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
    queued: { quickPick: unknown[] };
    lastQuickPick(): { items: { description?: string }[] };
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('checkbox after other markers', () => {
    it('reads a done box after a priority', () => {
        expect(parseCheck('!! [x] a')).toEqual({ state: 'done', contentWithout: '!! a' });
    });
    it('reads an open box after a star', () => {
        expect(parseCheck('* [ ] a')).toEqual({ state: 'todo', contentWithout: '* a' });
    });
    it('does not read a box among the words', () => expect(parseCheck('a [x] b')).toBeNull());
    it('toggles the box instead of adding a second one', () => {
        expect(toggleCheckLine('>> - !! [x] a', '-')).toBe('>> - [ ] !! a');
    });
});

describe('next occurrence', () => {
    const next = async (line: string) => {
        const h = openEditor([line], { cursor: 0 });
        await onGenerateNextOccurrence();
        return h.lines()[1];
    };
    it('puts the date before a vote and comment', async () => {
        expect(await next('>> - a @daily @2026-01-01 +2 // note')).toBe('>> - a @daily @2026-01-02 +2 // note');
    });
    it('reopens a done item', async () => {
        expect(await next('>> - [x] a @daily @2026-01-01')).toBe('>> - [ ] a @daily @2026-01-02');
    });
    it('needs the whole recurrence word', async () => {
        expect(await next('>> - see @dailybrief')).toBeUndefined();
    });
    it('does not read a recurrence from the comment', async () => {
        expect(await next('>> - a // @daily')).toBeUndefined();
    });
});

describe('group by mention', () => {
    it('keeps other lines and replaces old dividers', async () => {
        const h = openEditor(['> S', '>> -- Old', 'a note', '>> - a @Sam', '', '> T'], { cursor: 0 });
        await onGroupItemsByMention();
        expect(h.lines()).toEqual(['> S', '>> -- Sam', '>> - a @Sam', 'a note', '', '> T']);
    });
    it('groups when one person is mentioned', async () => {
        const h = openEditor(['> S', '>> - a @Sam'], { cursor: 0 });
        await onGroupItemsByMention();
        expect(h.lines()).toEqual(['> S', '>> -- Sam', '>> - a @Sam']);
    });
    it('adds no blank line at the end of a file', async () => {
        const h = openEditor(['> S', '>> - a @Sam', '>> - b @Kim'], { cursor: 0 });
        await onGroupItemsByMention();
        expect(h.lines()).toEqual(['> S', '>> -- Sam', '>> - a @Sam', '>> -- Kim', '>> - b @Kim']);
    });
    it('still reports a section nobody is mentioned in', async () => {
        openEditor(['> S', '>> - a'], { cursor: 0 });
        await onGroupItemsByMention();
        expect(mock.recorded.info).toEqual(['CL: No @Mention markers found in section items']);
    });
});

describe('collect by tag', () => {
    it('does not copy the results of an earlier run', async () => {
        const h = openEditor(['> S', '>> - a #x', '', '> #x Results', '>> - a #x', ''], { cursor: 0 });
        mock.queued.quickPick.push({ tag: 'x' });
        await onCollectItemsByTag();
        expect(mock.recorded.info).toEqual(['CL: Collected 1 item into "#x Results"']);
        expect(h.lines().filter(l => l === '>> - a #x').length).toBe(3);
    });
});

describe('item complexity', () => {
    it('ignores dates and labels in a comment', () => {
        const s = scoreItemComplexity('a // @2026-01-01 @expires:2026-01-01 [Later]');
        expect([s.dueDate, s.expiry, s.label]).toEqual([0, 0, 0]);
    });
    it('reads a priority after a star', () => expect(scoreItemComplexity('* !! a').priority).toBe(2));
});

describe('word count goals', () => {
    it('treats a goal of zero as met', async () => {
        openEditor(['> A ==0'], { cursor: 0 });
        await onShowWordCountGoals();
        expect(mock.lastQuickPick().items[0].description).toContain('(100%)');
    });
});
