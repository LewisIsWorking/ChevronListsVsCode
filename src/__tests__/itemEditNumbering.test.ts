/**
 * Merging and splitting items keeps a numbered list in sequence and an item's
 * markers in their places; sorting sections keeps the document's shape; an
 * underline does not cut an emoji in two.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onMergeItemWithNext } from '../mergeItemCommands';
import { onSplitItemAtCursor } from '../splitItemCommands';
import { onSortSectionsAZ } from '../sectionSortCommands';
import { applyUnicodeUnderline } from '../patterns';

const mock = vscode as unknown as { __reset(): void };

describe('item edits', () => {
    beforeEach(() => mock.__reset());
    afterEach(() => deactivate());

    it('merge closes up a numbered list', async () => {
        const h = openEditor(['>> 1. a', '>> 2. b', '>>> 1. kid', '>> 3. c'], { cursor: 0, character: 6 });
        await onMergeItemWithNext();
        expect(h.lines()).toEqual(['>> 1. a - b', '>>> 1. kid', '>> 2. c']);
    });

    it('merge keeps the first markers and the second vote and comment', async () => {
        const h = openEditor(['>> - [ ] a', '>> - [x] b +3 // x'], { cursor: 0, character: 5 });
        await onMergeItemWithNext();
        expect(h.lines()).toEqual(['>> - [ ] a - b +3 // x']);
    });

    it('split opens a gap in a numbered list', async () => {
        const h = openEditor(['>> 1. one two', '>>> 1. kid', '>> 2. c'], { cursor: 0, character: 10 });
        await onSplitItemAtCursor();
        expect(h.lines()).toEqual(['>> 1. one', '>> 2. two', '>>> 1. kid', '>> 3. c']);
    });

    it('sorting sections keeps the gap and adds no blank line at the end', async () => {
        const h = openEditor(['> B', '>> - b', '', '> A'], { cursor: 0, character: 0 });
        await onSortSectionsAZ();
        expect(h.lines()).toEqual(['> A', '', '> B', '>> - b']);
    });

    it('sorting sections twice changes nothing more', async () => {
        const h = openEditor(['> A', '', '> B', ''], { cursor: 0, character: 0 });
        await onSortSectionsAZ();
        expect(h.lines()).toEqual(['> A', '', '> B', '']);
    });

    it('underlining keeps an emoji whole', () => {
        expect(applyUnicodeUnderline('\u{1F600}')).toBe('\u{1F600}̲');
    });
});
