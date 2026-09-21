/**
 * Covers src/newSectionCommands.ts. SECTION-EDIT family.
 *
 * The command inserts two lines at the cursor line and then read the cursor
 * line again to decide where the new item line is. By then VS Code had already
 * moved the cursor down past the inserted lines, so the cursor landed two lines
 * below the blank item, inside whatever followed. It also inserted the new
 * header in the middle of the cursor's section, so the items below the cursor
 * silently moved into the new section. The regression tests below were checked
 * against that code.
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

    it('inside a section, adds the new section after it rather than taking over the items below the cursor', async () => {
        // Inserting at the cursor line used to split the section: "after" became
        // an item of the new section.
        const h = openEditor(['> Old', '>> - kept', 'after', '', '> Next'], { cursor: 1, character: 3 });
        mock.queued.inputBox.push('  Ideas ');
        await onNewSection();
        expect(h.lines()).toEqual(['> Old', '>> - kept', 'after', '', '> Ideas', '>> - ', '', '> Next']);
        expect(cursorOf(h.editor)).toEqual([5, '>> - '.length]);
        expect(h.revealed.at(-1)).toEqual({ start: [5, 5], end: [5, 5] });
    });

    it('on a header, adds the new section above it with a blank line between', async () => {
        const h = openEditor(['first', '> Next', '>> - n'], { cursor: 1, character: 2 });
        mock.queued.inputBox.push('New');
        await onNewSection();
        expect(h.lines()).toEqual(['first', '> New', '>> - ', '', '> Next', '>> - n']);
        expect(cursorOf(h.editor)).toEqual([2, 5]);
    });

    it('outside any section, adds it at the cursor line', async () => {
        const h = openEditor(['first', 'second'], { cursor: 1, character: 0 });
        mock.queued.inputBox.push('New');
        await onNewSection();
        expect(h.lines()).toEqual(['first', '> New', '>> - ', '', 'second']);
        expect(cursorOf(h.editor)).toEqual([2, 5]);
    });

    it('uses the configured bullet prefix, without a second blank line before a blank line', async () => {
        mock.__setConfig('chevron-lists.listPrefix', '*');
        const h = openEditor(['']);
        mock.queued.inputBox.push('Starred');
        await onNewSection();
        expect(h.lines()).toEqual(['> Starred', '>> * ', '']);
        expect(cursorOf(h.editor)).toEqual([1, 5]);
    });

    it('at the end of a section that ends the file, adds it on its own lines', async () => {
        const h = openEditor(['> Old', '>> - kept'], { cursor: 1 });
        mock.queued.inputBox.push('Tail');
        await onNewSection();
        expect(h.lines()).toEqual(['> Old', '>> - kept', '', '> Tail', '>> - ']);
        expect(cursorOf(h.editor)).toEqual([4, 5]);
    });
});