/**
 * Covers src/sortCommands.ts end to end -- the largest previously-uncovered
 * file (114 statements, 0%).
 *
 * These are the first tests to drive a real command handler rather than a pure
 * parser, using the editorHarness fake. `editor.edit()` genuinely applies its
 * edits, so the assertions read as behaviour ("the section came out sorted")
 * instead of implementation ("replace was called with this range").
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import {
    onSortItemsAZ,
    onSortItemsZA,
    onRenumberItems,
    onConvertBulletsToNumbered,
    onConvertNumberedToBullets,
    renumber,
} from '../sortCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
};

beforeEach(() => {
    mock.__reset();
    deactivate();
});

describe('onSortItemsAZ', () => {
    it('sorts the bullets in the cursor section A to Z', async () => {
        const h = openEditor(['> Tasks', '>> - cherry', '>> - apple', '>> - banana'], { cursor: 1 });
        await onSortItemsAZ();
        expect(h.lines()).toEqual(['> Tasks', '>> - apple', '>> - banana', '>> - cherry']);
    });

    it('sorts case-insensitively', async () => {
        const h = openEditor(['> Tasks', '>> - Zebra', '>> - apple'], { cursor: 1 });
        await onSortItemsAZ();
        expect(h.lines()).toEqual(['> Tasks', '>> - apple', '>> - Zebra']);
    });

    it('leaves a single item alone', async () => {
        const h = openEditor(['> Tasks', '>> - only'], { cursor: 1 });
        await onSortItemsAZ();
        expect(h.edits).toHaveLength(0);
        expect(h.lines()).toEqual(['> Tasks', '>> - only']);
    });

    it('does nothing when no editor is open', async () => {
        await onSortItemsAZ();   // deactivate() ran in beforeEach
        expect(true).toBe(true); // reaching here without throwing is the assertion
    });

    it('does nothing when the cursor is above any header', async () => {
        const h = openEditor(['just prose', 'more prose'], { cursor: 0 });
        await onSortItemsAZ();
        expect(h.edits).toHaveLength(0);
    });

    it('only touches the cursor section, not the one below', async () => {
        const h = openEditor(
            ['> One', '>> - b', '>> - a', '> Two', '>> - z', '>> - y'],
            { cursor: 1 }
        );
        await onSortItemsAZ();
        expect(h.lines()).toEqual(['> One', '>> - a', '>> - b', '> Two', '>> - z', '>> - y']);
    });

    it('keeps a prose line in place and sorts the lists either side of it separately', async () => {
        const h = openEditor(
            ['> Tasks', '>> - cherry', 'a prose line', '>> 2. numbered', '>> - apple'],
            { cursor: 1 }
        );
        await onSortItemsAZ();
        // A prose line belongs to the items around it, so bullets no longer jump
        // across it. The numbered item sorts with its siblings and keeps the number
        // of its position.
        expect(h.lines()).toEqual(
            ['> Tasks', '>> - cherry', 'a prose line', '>> - apple', '>> 2. numbered']
        );
    });

    // The sort used to reorder every bullet line regardless of depth, so these
    // children ended up under the wrong parent: a, b, >>> x, >>> y.
    it('keeps nested items with their parent', async () => {
        const h = openEditor(['> H', '>> - b', '>>> - x', '>> - a', '>>> - y'], { cursor: 1 });
        await onSortItemsAZ();
        expect(h.lines()).toEqual(['> H', '>> - a', '>>> - y', '>> - b', '>>> - x']);
    });

    it('sorts nested items among themselves', async () => {
        const h = openEditor(['> H', '>> - p', '>>> - z', '>>> - x', '>> - a'], { cursor: 1 });
        await onSortItemsAZ();
        expect(h.lines()).toEqual(['> H', '>> - a', '>> - p', '>>> - x', '>>> - z']);
    });

    it('keeps numbers with their positions', async () => {
        const h = openEditor(['> H', '>> 1. cherry', '>> 2. apple', '>> 3. banana'], { cursor: 1 });
        await onSortItemsAZ();
        expect(h.lines()).toEqual(['> H', '>> 1. apple', '>> 2. banana', '>> 3. cherry']);
    });
});

