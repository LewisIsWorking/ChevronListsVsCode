/**
 * A priority counts wherever it sits among the leading markers. An item's due date
 * comes from its words, and a done item is not overdue. Pinning the last section
 * of a file keeps the sections apart.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { parsePriority } from '../priorityParser';
import { extractDate, openDueDate, collectDueDates } from '../dueDateParser';
import { extractSortDate, isEscalatable } from '../patterns';
import { onPinSectionToTop } from '../pinToTopCommands';
import { onShowProgressReport } from '../progressReportCommands';

const mock = vscode as unknown as {
    __reset(): void;
    workspace: { openTextDocument(o: unknown): Promise<unknown> };
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('priority after other markers', () => {
    it('reads a priority after a checkbox', () => {
        expect(parsePriority('[x] !! a')).toEqual({ level: 2, contentWithout: '[x] a' });
    });
    it('reads a priority after a star', () => expect(parsePriority('* !!! a')?.level).toBe(3));
    it('reads a priority at the start', () => expect(parsePriority('! a')).toEqual({ level: 1, contentWithout: 'a' }));
    it('does not read one among the words', () => expect(parsePriority('a !! b')).toBeNull());
});

describe('open due date', () => {
    it('is the date of an open item', () => expect(openDueDate('[ ] a @2026-01-01')).toBe('2026-01-01'));
    it('is the date of an item with no box', () => expect(openDueDate('a @2026-01-01')).toBe('2026-01-01'));
    it('is nothing for a done item', () => expect(openDueDate('!! [x] a @2026-01-01')).toBeNull());
    it('is nothing in a comment', () => expect(openDueDate('a // @2026-01-01')).toBeNull());
});

describe('readers of due dates', () => {
    const today = new Date(2026, 5, 1);
    it('sorts by the date in the words', () => expect(extractSortDate('a // @2026-01-01')).toBe('9999-99-99'));
    it('does not escalate a done item', () => expect(isEscalatable('[x] a @2026-01-01', today)).toBe(false));
    it('escalates an open item', () => expect(isEscalatable('a @2026-01-01', today)).toBe(true));
    it('does not call a done item overdue', () => {
        const lines = ['>> - [x] a @2026-01-01', '>> - b @2026-01-01'];
        const doc   = { lineCount: lines.length, lineAt: (i: number) => ({ text: lines[i] }) };
        expect(collectDueDates(doc, '-', today).map(d => d.overdue)).toEqual([false, true]);
    });
    it('still reads a date from the words', () => expect(extractDate('a @2026-01-01')?.dateStr).toBe('2026-01-01'));
});

describe('pin section to top', () => {
    it('keeps a blank line when the last section moves', async () => {
        const h = openEditor(['> A', '', '> B'], { cursor: 2 });
        await onPinSectionToTop();
        expect(h.lines()).toEqual(['> B', '', '> A']);
    });
    it('moves a middle section with its blank line', async () => {
        const h = openEditor(['> A', '', '> B', '', '> C'], { cursor: 2 });
        await onPinSectionToTop();
        expect(h.lines()).toEqual(['> B', '', '> A', '', '> C']);
    });
});

describe('progress report', () => {
    it('counts a flag after a checkbox and skips done and commented dates', async () => {
        let shown = '';
        const open = mock.workspace.openTextDocument;
        mock.workspace.openTextDocument = (o: unknown) => {
            shown = (o as { content: string }).content;
            return open(o);
        };
        openEditor(['> A', '>> - [ ] ? a', '>> - [x] b @2020-01-01', '>> - c // @2020-01-01', '>> - d @2020-01-01'], { cursor: 0 });
        await onShowProgressReport();
        mock.workspace.openTextDocument = open;
        expect(shown).toContain('1 flagged');
        expect(shown).toContain('⚠ 1 overdue');
    });
});
