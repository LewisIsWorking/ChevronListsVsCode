/**
 * The all-cursors commands must read an item's leading markers in any order, as
 * the parsers do, instead of adding a second checkbox or priority beside them.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onSetPriorityAllCursors, onToggleDoneAllCursors } from '../multiCursorCommands';

const mock = vscode as unknown as {
    __reset(): void;
    queued: { quickPick: unknown[] };
};

describe('all-cursor marker commands', () => {
    beforeEach(() => mock.__reset());
    afterEach(() => deactivate());

    async function setPriority(line: string, priority: string): Promise<string> {
        const h = openEditor(['> A', line], { cursor: 1, character: 5 });
        mock.queued.quickPick.push({ priority });
        await onSetPriorityAllCursors();
        return h.lines()[1];
    }

    it('replaces a priority that follows a checkbox', async () => {
        expect(await setPriority('>> - [ ] !! a', '!!!')).toBe('>> - [ ] !!! a');
    });

    it('clears a priority that follows a checkbox', async () => {
        expect(await setPriority('>> - [ ] !! a', '')).toBe('>> - [ ] a');
    });

    it('leaves an exclamation mark that belongs to the words', async () => {
        expect(await setPriority('>> - !important', '!!')).toBe('>> - !! !important');
    });

    it('toggles a checkbox that follows a priority', async () => {
        const h = openEditor(['> A', '>> - !! [ ] a'], { cursor: 1, character: 5 });
        await onToggleDoneAllCursors();
        expect(h.lines()[1]).toBe('>> - [x] !! a');
    });
});
