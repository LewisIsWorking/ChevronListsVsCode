/**
 * Covers Sort by Priority, Sort by Votes and Sort by Due Date. They sorted lines,
 * not items: nested items lost their parents, notes and blank lines moved, and
 * numbers travelled with their items. Sort by Votes also ran lowest first, and
 * Sort by Priority missed a priority after a checkbox.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onSortByPriority } from '../sortByPriorityCommands';
import { onSortByVotes } from '../voteCommands';
import { onSortByDueDate } from '../sortByDateCommands';

const mock = vscode as unknown as { __reset(): void; recorded: { info: string[] } };

beforeEach(() => {
    mock.__reset();
    deactivate();
});

describe('Sort by Priority', () => {
    it('sorts highest first and keeps children with their parent', async () => {
        const h = openEditor(['> A', '>> - plain', '>> - !!! top', '>>> - kid', '>> - ! low'], { cursor: 1 });
        await onSortByPriority();
        expect(h.lines()).toEqual(['> A', '>> - !!! top', '>>> - kid', '>> - ! low', '>> - plain']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Sorted by priority');
    });

    it('reads a priority after a checkbox', async () => {
        const h = openEditor(['> A', '>> - a', '>> - [ ] !! b'], { cursor: 1 });
        await onSortByPriority();
        expect(h.lines()).toEqual(['> A', '>> - [ ] !! b', '>> - a']);
    });

    it('leaves the blank line before the next section where it is', async () => {
        const h = openEditor(['> A', '>> - a', '>> - !! b', '', '> B', '>> - c'], { cursor: 1 });
        await onSortByPriority();
        expect(h.lines()).toEqual(['> A', '>> - !! b', '>> - a', '', '> B', '>> - c']);
    });

    it('keeps numbers in position', async () => {
        const h = openEditor(['> A', '>> 1. a', '>> 2. !! b'], { cursor: 1 });
        await onSortByPriority();
        expect(h.lines()).toEqual(['> A', '>> 1. !! b', '>> 2. a']);
    });

    it('needs a section', async () => {
        const h = openEditor(['>> - a'], { cursor: 0 });
        await onSortByPriority();
        expect(mock.recorded.info.at(-1)).toBe('CL: No section found at cursor');
        expect(h.lines()).toEqual(['>> - a']);
    });
});

describe('Sort by Votes', () => {
    it('sorts most votes first', async () => {
        const h = openEditor(['> A', '>> - a +1', '>> - b +5', '>> - c'], { cursor: 1 });
        await onSortByVotes();
        expect(h.lines()).toEqual(['> A', '>> - b +5', '>> - a +1', '>> - c']);
    });

    it('keeps equal items in their order', async () => {
        const h = openEditor(['> A', '>> - a +2', '>> - b +2', '>> - c +3'], { cursor: 1 });
        await onSortByVotes();
        expect(h.lines()).toEqual(['> A', '>> - c +3', '>> - a +2', '>> - b +2']);
    });

    it('does not move a note', async () => {
        const lines = ['> A', '>> - a +1', 'a note', '>> - b +5'];
        const h = openEditor(lines, { cursor: 1 });
        await onSortByVotes();
        expect(h.lines()).toEqual(lines);
    });
});

describe('Sort by Due Date', () => {
    it('sorts soonest first with undated items last, children attached', async () => {
        const h = openEditor(['> A', '>> - none', '>> - b @2026-02-01', '>>> - kid', '>> - a @2026-01-01'], { cursor: 1 });
        await onSortByDueDate();
        expect(h.lines()).toEqual(['> A', '>> - a @2026-01-01', '>> - b @2026-02-01', '>>> - kid', '>> - none']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Sorted by due date');
    });
});
