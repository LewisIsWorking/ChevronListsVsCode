/**
 * Copies of a numbered item: Duplicate Item, Duplicate and Increment, Clone as
 * Done and Clone Stripped, all through itemCopyBelow (lineEdits.ts).
 *
 * Bugs fixed, with regression tests checked against the original code:
 *  - the copy repeated the original's number ("3. a", "3. b"), leaving the list
 *    out of sequence unless auto-fix was on;
 *  - the copy went between the item and its children, which then belonged to
 *    the copy;
 *  - Duplicate and Increment bumped the first digits anywhere, dates included
 *    ("@2026-01-01 step 1" became "@2027-01-01 step 1"), and dropped
 *    zero-padding ("07" became "8").
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onDuplicateItemAndIncrement } from '../duplicateIncrementCommands';
import { onCloneItemAsDone, onCloneItemStripped } from '../cloneTransformCommands';
import { incrementFirstNumber } from '../patterns';

type Pos = { line: number; character: number };
const mock = vscode as unknown as { __reset(): void; __setConfig(key: string, value: unknown): void; recorded: { info: string[] } };
const cursorOf = (e: unknown) => {
    const a = (e as { selection: { active: Pos } }).selection.active;
    return [a.line, a.character];
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('a numbered copy takes the next number and later items move up', () => {
    const LIST = ['> S', '>> 1. step 1', '>>> - detail', '>> 2. other', '>> - bullet', '>> 3. last', '> T', '>> 1. elsewhere'];

    it('duplicate and increment', async () => {
        const h = openEditor(LIST, { cursor: 1, character: 4 });
        await onDuplicateItemAndIncrement();
        expect(h.lines()).toEqual(['> S', '>> 1. step 1', '>>> - detail', '>> 2. step 2', '>> 3. other', '>> - bullet', '>> 4. last', '> T', '>> 1. elsewhere']);
        expect(cursorOf(h.editor)).toEqual([3, 4]);
    });

    it('clone as done', async () => {
        const h = openEditor(LIST, { cursor: 3 });
        await onCloneItemAsDone();
        expect(h.lines()).toEqual(['> S', '>> 1. step 1', '>>> - detail', '>> 2. other', '>> 3. [x] other', '>> - bullet', '>> 4. last', '> T', '>> 1. elsewhere']);
    });

    it('clone stripped', async () => {
        const h = openEditor(['> S', '>> 1. !!! fix #bug', '>> 2. next'], { cursor: 1 });
        await onCloneItemStripped();
        expect(h.lines()).toEqual(['> S', '>> 1. !!! fix #bug', '>> 2. fix', '>> 3. next']);
    });

    it('a bullet copy goes after the item’s children and changes no numbers', async () => {
        mock.__setConfig('chevron-lists.listPrefix', '*');
        const h = openEditor(['> S', '>> * a', '>>> 1. child', '>> 2. numbered'], { cursor: 1 });
        await onCloneItemAsDone();
        expect(h.lines()).toEqual(['> S', '>> * a', '>>> 1. child', '>> * [x] a', '>> 2. numbered']);
    });
});

describe('duplicate and increment', () => {
    it('does nothing without an editor or outside markdown, and asks for an item', async () => {
        await onDuplicateItemAndIncrement();
        openEditor(['>> - a 1'], { languageId: 'plaintext' });
        await onDuplicateItemAndIncrement();
        expect(mock.recorded.info).toEqual([]);
        const h = openEditor(['prose 1']);
        await onDuplicateItemAndIncrement();
        expect(mock.recorded.info.at(-1)).toBe('CL: Place cursor on a chevron item');
        expect(h.lines()).toEqual(['prose 1']);
    });

    it('copies an item with no number unchanged, before the prose that follows it', async () => {
        const h = openEditor(['>> - no digits here', 'prose']);
        await onDuplicateItemAndIncrement();
        expect(h.lines()).toEqual(['>> - no digits here', '>> - no digits here', 'prose']);
    });
});

describe('clone commands ask for an item', () => {
    it('clone as done and clone stripped', async () => {
        await onCloneItemAsDone();
        await onCloneItemStripped();
        openEditor(['>> - a'], { languageId: 'plaintext' });
        await onCloneItemAsDone();
        await onCloneItemStripped();
        expect(mock.recorded.info).toEqual([]);
        openEditor(['> Header']);
        await onCloneItemAsDone();
        await onCloneItemStripped();
        expect(mock.recorded.info).toEqual(['CL: Place cursor on a chevron item', 'CL: Place cursor on a chevron item']);
    });

    it('clone as done replaces an existing checkbox', async () => {
        const h = openEditor(['>> - [ ] todo']);
        await onCloneItemAsDone();
        expect(h.lines()).toEqual(['>> - [ ] todo', '>> - [x] todo']);
    });
});

describe('incrementFirstNumber', () => {
    it('skips numbers inside metadata', () => {
        expect(incrementFirstNumber('@2026-01-01 step 1')).toBe('@2026-01-01 step 2');
        expect(incrementFirstNumber('~2h +3 ★4 #v2 [[Part 1]] take 5')).toBe('~2h +3 ★4 #v2 [[Part 1]] take 6');
        expect(incrementFirstNumber('~2h +3 only metadata @2026-02-02')).toBeNull();
    });

    it('keeps zero-padding and increments inside a word', () => {
        expect(incrementFirstNumber('Episode 09')).toBe('Episode 10');
        expect(incrementFirstNumber('take 07')).toBe('take 08');
        expect(incrementFirstNumber('v2-final')).toBe('v3-final');
    });
});
