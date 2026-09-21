/**
 * Covers src/newSectionCommands.ts. SECTION-EDIT family.
 *
 * The command inserts two lines at the cursor line and then read the cursor
 * line again to decide where the new item line is. By then VS Code had already
 * moved the cursor down past the inserted lines, so the cursor landed two lines
 * below the blank item, inside whatever followed. The regression tests below
 * were checked against that code.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onNewSection } from '../newSectionCommands';

type Pos = { line: number; character: number };
const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { inputBoxCalls: { prompt: string }[] };
    queued: { inputBox: (string | undefined)[] };
};
const cursorOf = (e: unknown) => {
    const a = (e as { selection: { active: Pos } }).selection.active;
    return [a.line, a.character];
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onNewSection', () => {
    it('does nothing without an active editor', async () => {
        await onNewSection();
        expect(mock.recorded.inputBoxCalls).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['text'], { languageId: 'plaintext' });
        await onNewSection();
        expect(mock.recorded.inputBoxCalls).toHaveLength(0);
    });

    it('does nothing when the prompt is cancelled', async () => {
        const h = openEditor(['text']);
        await onNewSection();
        expect(mock.recorded.inputBoxCalls[0].prompt).toBe('New section name');
        expect(h.lines()).toEqual(['text']);
    });

    it('does nothing for a blank name', async () => {
        const h = openEditor(['text']);
        mock.queued.inputBox.push(' ');
        await onNewSection();
        expect(h.lines()).toEqual(['text']);
    });

    it('inserts the section and a blank item, leaving the cursor ready to type the item', async () => {
        const h = openEditor(['> Old', '>> - kept', 'after'], { cursor: 2, character: 3 });
        mock.queued.inputBox.push('  Ideas ');
        await onNewSection();
        expect(h.lines()).toEqual(['> Old', '>> - kept', '> Ideas', '>> - ', 'after']);
        expect(cursorOf(h.editor)).toEqual([3, '>> - '.length]);
        expect(h.revealed.at(-1)).toEqual({ start: [3, 5], end: [3, 5] });
    });

    it('puts the cursor on the item line when the cursor started at column 0', async () => {
        const h = openEditor(['first', 'second'], { cursor: 1, character: 0 });
        mock.queued.inputBox.push('New');
        await onNewSection();
        expect(h.lines()).toEqual(['first', '> New', '>> - ', 'second']);
        expect(cursorOf(h.editor)).toEqual([2, 5]);
    });

    it('uses the configured bullet prefix', async () => {
        mock.__setConfig('chevron-lists.listPrefix', '*');
        const h = openEditor(['']);
        mock.queued.inputBox.push('Starred');
        await onNewSection();
        expect(h.lines()).toEqual(['> Starred', '>> * ', '']);
        expect(cursorOf(h.editor)).toEqual([1, 5]);
    });
});
