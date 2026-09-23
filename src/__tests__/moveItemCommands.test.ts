/**
 * Move Item Up / Down. An item moves with anything nested under it and swaps
 * with the previous or next item at its own depth. It used to swap single lines
 * with whatever item line was adjacent, so moving a parent down put it below its
 * own child, and moving a child up put it above its parent.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { onMoveItemUp, onMoveItemDown, moveItemBlock } from '../moveItemCommands';
import { openEditor, deactivate } from './helpers/editorHarness';

type Pos = { line: number; character: number };
const mock = vscode as unknown as { __reset(): void; __setConfig(key: string, value: unknown): void };
const cursorOf = (e: unknown) => {
    const a = (e as { selection: { active: Pos } }).selection.active;
    return [a.line, a.character];
};

beforeEach(() => { mock.__reset(); deactivate(); });

const nested = ['> H', '>> - a', '>>> - a1', '>>> - a2', '>> - b'];

describe('moveItemBlock', () => {
    it('swaps an item with the one above it', () => {
        expect(moveItemBlock(['> H', '>> - a', '>> - b'], 2, true, '-'))
            .toEqual({ lines: ['> H', '>> - b', '>> - a'], newIndex: 1 });
    });

    it('carries children when a parent moves down', () => {
        expect(moveItemBlock(nested, 1, false, '-'))
            .toEqual({ lines: ['> H', '>> - b', '>> - a', '>>> - a1', '>>> - a2'], newIndex: 2 });
    });

    it('moves a parent past the whole of its next sibling', () => {
        expect(moveItemBlock(['> H', '>> - a', '>> - b', '>>> - b1'], 1, false, '-'))
            .toEqual({ lines: ['> H', '>> - b', '>>> - b1', '>> - a'], newIndex: 3 });
    });

    it('carries children when a parent moves up', () => {
        expect(moveItemBlock(['> H', '>> - a', '>> - b', '>>> - b1'], 2, true, '-'))
            .toEqual({ lines: ['> H', '>> - b', '>>> - b1', '>> - a'], newIndex: 1 });
    });

    it('swaps sibling children', () => {
        expect(moveItemBlock(nested, 3, true, '-'))
            .toEqual({ lines: ['> H', '>> - a', '>>> - a2', '>>> - a1', '>> - b'], newIndex: 2 });
    });

    it('will not move a first child above its parent', () => {
        expect(moveItemBlock(nested, 2, true, '-')).toBeNull();
    });

    it('will not move a last child below the next parent', () => {
        expect(moveItemBlock(nested, 3, false, '-')).toBeNull();
    });

    it('never crosses a header', () => {
        const lines = ['> One', '>> - a', '> Two', '>> - b'];
        expect(moveItemBlock(lines, 3, true, '-')).toBeNull();
        expect(moveItemBlock(lines, 1, false, '-')).toBeNull();
    });

    it('moves numbered items, leaving the numbers for the fixer', () => {
        expect(moveItemBlock(['> H', '>> 1. a', '>> 2. b'], 2, true, '-'))
            .toEqual({ lines: ['> H', '>> 2. b', '>> 1. a'], newIndex: 1 });
    });

    it('ignores lines that are not items', () => {
        expect(moveItemBlock(['> H', 'plain', '>> - a'], 1, false, '-')).toBeNull();
        expect(moveItemBlock(['> H', '>> * a', '>> * b'], 2, true, '-')).toBeNull();
    });

    it('ignores an index outside the document', () => {
        expect(moveItemBlock(nested, 99, true, '-')).toBeNull();
        expect(moveItemBlock(nested, -1, false, '-')).toBeNull();
    });
});

describe('Move Item Down / Up commands', () => {
    it('moves a parent down with its children and follows it with the cursor', async () => {
        const h = openEditor(nested, { cursor: 1, character: 3 });
        await onMoveItemDown();
        expect(h.lines()).toEqual(['> H', '>> - b', '>> - a', '>>> - a1', '>>> - a2']);
        expect(cursorOf(h.editor)).toEqual([2, 3]);
    });

    it('moves an item up past a sibling that has children', async () => {
        const h = openEditor(nested, { cursor: 4, character: 2 });
        await onMoveItemUp();
        expect(h.lines()).toEqual(['> H', '>> - b', '>> - a', '>>> - a1', '>>> - a2']);
        expect(cursorOf(h.editor)).toEqual([1, 2]);
    });

    it('leaves a child that has no earlier sibling where it is', async () => {
        const h = openEditor(nested, { cursor: 2 });
        await onMoveItemUp();
        expect(h.lines()).toEqual(nested);
    });
});
