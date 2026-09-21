/**
 * Covers src/duplicateItem.ts. ITEM-TRANSFORM family.
 *
 * Duplicating the last line of a file without a trailing newline used to glue
 * the copy onto the original (">> - a>> - a"): the copy was inserted at the
 * start of the line after the last line, which VS Code clamps to the end of
 * the file. The regression tests below were checked against that code.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onDuplicateItem } from '../duplicateItem';

type Pos = { line: number; character: number };
const mock = vscode as unknown as { __reset(): void; recorded: { info: string[] } };
const cursorOf = (e: unknown) => {
    const a = (e as { selection: { active: Pos } }).selection.active;
    return [a.line, a.character];
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onDuplicateItem', () => {
    it('does nothing without an active editor', async () => {
        await onDuplicateItem();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        const h = openEditor(['>> - a'], { languageId: 'plaintext' });
        await onDuplicateItem();
        expect(h.lines()).toEqual(['>> - a']);
    });

    it('asks for an item when the cursor is not on one', async () => {
        const h = openEditor(['> Section', 'prose'], { cursor: 1 });
        await onDuplicateItem();
        expect(mock.recorded.info.at(-1)).toBe('CL: Place cursor on a chevron item to duplicate it');
        expect(h.lines()).toEqual(['> Section', 'prose']);
    });

    it('duplicates a bullet item below itself and moves the cursor to the copy', async () => {
        const h = openEditor(['> S', '>> - a', '>> - b'], { cursor: 1, character: 3 });
        await onDuplicateItem();
        expect(h.lines()).toEqual(['> S', '>> - a', '>> - a', '>> - b']);
        expect(cursorOf(h.editor)).toEqual([2, 3]);
    });

    it('duplicates a numbered item', async () => {
        const h = openEditor(['> S', '>> 1. first', ''], { cursor: 1 });
        await onDuplicateItem();
        expect(h.lines()).toEqual(['> S', '>> 1. first', '>> 1. first', '']);
    });

    it('duplicates the last line of a file with no trailing newline onto its own line', async () => {
        const h = openEditor(['> S', '>> - a'], { cursor: 1, character: 2 });
        await onDuplicateItem();
        expect(h.lines()).toEqual(['> S', '>> - a', '>> - a']);
        expect(cursorOf(h.editor)).toEqual([2, 2]);
    });

    it('keeps the column when the cursor sits at the end of the last line', async () => {
        const h = openEditor(['>> - a'], { cursor: 0, character: 6 });
        await onDuplicateItem();
        expect(h.lines()).toEqual(['>> - a', '>> - a']);
        expect(cursorOf(h.editor)).toEqual([1, 6]);
    });
});
