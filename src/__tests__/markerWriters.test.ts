/**
 * Commands that write a marker put it in its place among the others, and commands
 * that change due dates leave a date quoted in a comment alone.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { markDone } from '../patterns';
import { escalatedContent } from '../overdueEscalation';
import { onShiftAllDueDates } from '../shiftDueDatesCommands';
import { onClearAllDueDates } from '../batchClearCommands';
import { onCompareStatistics } from '../compareStatsCommands';

const mock = vscode as unknown as {
    __reset(): void;
    queued: { inputBox: unknown[]; quickPick: unknown[] };
    workspace: { openTextDocument(o: unknown): Promise<unknown> };
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('markDone', () => {
    it('ticks a box after a priority', () => expect(markDone('!! [ ] a')).toBe('[x] !! a'));
    it('leaves a capital X done', () => expect(markDone('[X] a')).toBe('[x] a'));
    it('adds a box before a priority', () => expect(markDone('!! a')).toBe('[x] !! a'));
});

describe('overdue escalation', () => {
    const today = new Date(2026, 5, 1);
    it('raises an existing priority', () => expect(escalatedContent('! a @2026-01-01', today)).toBe('!!! a @2026-01-01'));
    it('keeps the checkbox first', () => expect(escalatedContent('[ ] a @2026-01-01', today)).toBe('[ ] !!! a @2026-01-01'));
    it('leaves an urgent item', () => expect(escalatedContent('[ ] !!! a @2026-01-01', today)).toBeNull());
    it('leaves an item that is not late', () => expect(escalatedContent('a @2027-01-01', today)).toBeNull());
});

describe('commands that change due dates', () => {
    it('shift leaves a date in a comment', async () => {
        mock.queued.inputBox.push('1');
        const h = openEditor(['> A', '>> - a @2026-01-01 // was @2025-01-01'], { cursor: 0 });
        await onShiftAllDueDates();
        expect(h.lines()[1]).toBe('>> - a @2026-01-02 // was @2025-01-01');
    });
    it('shift numbered items too', async () => {
        mock.queued.inputBox.push('1');
        const h = openEditor(['> A', '>> 3. a @2026-01-01'], { cursor: 0 });
        await onShiftAllDueDates();
        expect(h.lines()[1]).toBe('>> 3. a @2026-01-02');
    });
    it('shift has nothing to do with only a comment date', async () => {
        mock.queued.inputBox.push('1');
        const h = openEditor(['> A', '>> - a // @2025-01-01'], { cursor: 0 });
        await onShiftAllDueDates();
        expect(h.lines()[1]).toBe('>> - a // @2025-01-01');
    });
    it('clear leaves a date in a comment', async () => {
        const h = openEditor(['> A', '>> - a @2026-01-01 // was @2025-01-01', '>> - b // @2025-01-01'], { cursor: 0 });
        await onClearAllDueDates();
        expect(h.lines().slice(1)).toEqual(['>> - a // was @2025-01-01', '>> - b // @2025-01-01']);
    });
});

describe('compare statistics', () => {
    it('keeps a pipe in a section name inside its cell', async () => {
        let shown = '';
        const open = mock.workspace.openTextDocument;
        mock.workspace.openTextDocument = (o: unknown) => {
            shown = (o as { content: string }).content;
            return open(o);
        };
        openEditor(['> A|B', '> C'], { cursor: 0 });
        mock.queued.quickPick.push({ label: 'A|B', line: 0 }, { label: 'C', line: 1 });
        await onCompareStatistics();
        mock.workspace.openTextDocument = open;
        expect(shown.split('\n')[0]).toBe('| Metric | A\\|B | C |');
    });
});
