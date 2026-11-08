/**
 * Covers src/moveItemEdgeCommands.ts -- move item to top / bottom of section,
 * carrying anything nested under it.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onMoveItemToTop, onMoveItemToBottom } from '../moveItemEdgeCommands';

const mock = vscode as unknown as { __reset(): void; recorded: { info: string[] } };

const cursorLine = (editor: unknown) =>
    (editor as { selection: { active: { line: number } } }).selection.active.line;

beforeEach(() => {
    mock.__reset();
    deactivate();
});

describe('onMoveItemToTop', () => {
    it("takes the item's children with it", async () => {
        // Only the item's own line used to move, leaving c1 under b
        const h = openEditor(['> A', '>> - a', '>> - b', '>> - c', '>>> - c1'], { cursor: 3 });
        await onMoveItemToTop();
        expect(h.lines()).toEqual(['> A', '>> - c', '>>> - c1', '>> - a', '>> - b']);
        expect(cursorLine(h.editor)).toBe(1);
    });

    it('keeps a nested item under its parent', async () => {
        // It used to land straight under the header, out of its parent
        const h = openEditor(['> A', '>> - a', '>> - b', '>>> - b1', '>>> - b2'], { cursor: 4 });
        await onMoveItemToTop();
        expect(h.lines()).toEqual(['> A', '>> - a', '>> - b', '>>> - b2', '>>> - b1']);
        expect(cursorLine(h.editor)).toBe(3);
    });

    it('asks for an item line', async () => {
        const h = openEditor(['> A', 'note'], { cursor: 1 });
        await onMoveItemToTop();
        expect(mock.recorded.info).toEqual(['CL: Place cursor on a chevron item']);
        expect(h.lines()).toEqual(['> A', 'note']);
    });
});

describe('onMoveItemToBottom', () => {
    it("takes the item's children past the last sibling's children", async () => {
        const h = openEditor(['> A', '>> - a', '>>> - a1', '>> - b', '>> - c', '>>> - c1', '', '> B'], { cursor: 1 });
        await onMoveItemToBottom();
        expect(h.lines()).toEqual(['> A', '>> - b', '>> - c', '>>> - c1', '>> - a', '>>> - a1', '', '> B']);
        expect(cursorLine(h.editor)).toBe(4);
    });

    it('does nothing for the last sibling', async () => {
        const h = openEditor(['> A', '>> - a', '>> - b', '>>> - b1'], { cursor: 2 });
        await onMoveItemToBottom();
        expect(h.lines()).toEqual(['> A', '>> - a', '>> - b', '>>> - b1']);
    });
});
