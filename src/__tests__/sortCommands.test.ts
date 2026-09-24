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
    sortItems,
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

describe('sortItems', () => {
    it('sorts Z to A with children attached', () => {
        expect(sortItems(['>> - a', '>>> - q', '>> - c', '>> - b'], true, '-'))
            .toEqual(['>> - c', '>> - b', '>> - a', '>>> - q']);
    });

    it('keeps equal items in their order', () => {
        expect(sortItems(['>> - Same', '>> - same', '>> - a'], false, '-'))
            .toEqual(['>> - a', '>> - Same', '>> - same']);
    });

    it('keeps a later list start', () => {
        expect(sortItems(['>> 5. b', '>> 6. a'], false, '-')).toEqual(['>> 5. a', '>> 6. b']);
    });

    // Items need a space after the chevrons here (NUMBERED_ITEM_RE, bulletRE), so
    // tab-separated lines are text and stay where they are
    it('leaves tab-separated lines alone, as they are not items', () => {
        expect(sortItems(['>>\t- b', '>>\t- a'], false, '-')).toEqual(['>>\t- b', '>>\t- a']);
    });

    it('leaves bullets with another prefix alone', () => {
        expect(sortItems(['>> * b', '>> * a'], false, '-')).toEqual(['>> * b', '>> * a']);
    });
});

describe('onSortItemsZA', () => {
    it('sorts the bullets Z to A', async () => {
        const h = openEditor(['> Tasks', '>> - apple', '>> - cherry', '>> - banana'], { cursor: 1 });
        await onSortItemsZA();
        expect(h.lines()).toEqual(['> Tasks', '>> - cherry', '>> - banana', '>> - apple']);
    });

    it('leaves a single item alone', async () => {
        const h = openEditor(['> Tasks', '>> - only'], { cursor: 1 });
        await onSortItemsZA();
        expect(h.edits).toHaveLength(0);
    });

    it('does nothing without an editor', async () => {
        await onSortItemsZA();
        expect(true).toBe(true);
    });

    it('does nothing without a header', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        await onSortItemsZA();
        expect(h.edits).toHaveLength(0);
    });
});

describe('onRenumberItems', () => {
    it('resets a broken sequence to 1..n', async () => {
        const h = openEditor(['> Tasks', '>> 1. a', '>> 5. b', '>> 5. c'], { cursor: 1 });
        await onRenumberItems();
        expect(h.lines()).toEqual(['> Tasks', '>> 1. a', '>> 2. b', '>> 3. c']);
    });

    it('numbers each chevron depth independently', async () => {
        const h = openEditor(
            ['> Tasks', '>> 3. top', '>>> 7. nested', '>>> 9. nested two', '>> 1. top two'],
            { cursor: 1 }
        );
        await onRenumberItems();
        expect(h.lines()).toEqual(
            ['> Tasks', '>> 1. top', '>>> 1. nested', '>>> 2. nested two', '>> 2. top two']
        );
    });

    it('leaves non-numbered lines untouched', async () => {
        const h = openEditor(['> Tasks', '>> 4. a', '>> - bullet', 'prose'], { cursor: 1 });
        await onRenumberItems();
        expect(h.lines()).toEqual(['> Tasks', '>> 1. a', '>> - bullet', 'prose']);
    });

    it('does nothing without an editor', async () => {
        await onRenumberItems();
        expect(true).toBe(true);
    });

    it('does nothing without a header', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        await onRenumberItems();
        expect(h.edits).toHaveLength(0);
    });
});

describe('onConvertBulletsToNumbered', () => {
    it('converts bullets and keeps their order', async () => {
        const h = openEditor(['> Tasks', '>> - first', '>> - second'], { cursor: 1 });
        await onConvertBulletsToNumbered();
        expect(h.lines()).toEqual(['> Tasks', '>> 1. first', '>> 2. second']);
    });

    it('continues from the highest existing number at that depth', async () => {
        const h = openEditor(['> Tasks', '>> 4. existing', '>> - new one'], { cursor: 1 });
        await onConvertBulletsToNumbered();
        expect(h.lines()).toEqual(['> Tasks', '>> 4. existing', '>> 5. new one']);
    });

    it('tells the user when there is nothing to convert', async () => {
        openEditor(['> Tasks', '>> 1. already numbered'], { cursor: 1 });
        await onConvertBulletsToNumbered();
        expect(mock.recorded.info).toContain('CL: No bullet items found to convert');
    });

    it('tells the user when the cursor is not in a section', async () => {
        openEditor(['prose only'], { cursor: 0 });
        await onConvertBulletsToNumbered();
        expect(mock.recorded.info).toContain('CL: No section found at cursor');
    });

    it('ignores non-markdown documents', async () => {
        const h = openEditor(['> Tasks', '>> - a'], { cursor: 1, languageId: 'plaintext' });
        await onConvertBulletsToNumbered();
        expect(h.edits).toHaveLength(0);
    });

    it('does nothing without an editor', async () => {
        await onConvertBulletsToNumbered();
        expect(mock.recorded.info).toHaveLength(0);
    });
});

describe('onConvertNumberedToBullets', () => {
    it('converts numbered items to bullets', async () => {
        const h = openEditor(['> Tasks', '>> 1. first', '>> 2. second'], { cursor: 1 });
        await onConvertNumberedToBullets();
        expect(h.lines()).toEqual(['> Tasks', '>> - first', '>> - second']);
    });

    it('tells the user when there is nothing to convert', async () => {
        openEditor(['> Tasks', '>> - already a bullet'], { cursor: 1 });
        await onConvertNumberedToBullets();
        expect(mock.recorded.info).toContain('CL: No numbered items found to convert');
    });

    it('tells the user when the cursor is not in a section', async () => {
        openEditor(['prose only'], { cursor: 0 });
        await onConvertNumberedToBullets();
        expect(mock.recorded.info).toContain('CL: No section found at cursor');
    });

    it('ignores non-markdown documents', async () => {
        const h = openEditor(['> Tasks', '>> 1. a'], { cursor: 1, languageId: 'plaintext' });
        await onConvertNumberedToBullets();
        expect(h.edits).toHaveLength(0);
    });

    it('does nothing without an editor', async () => {
        await onConvertNumberedToBullets();
        expect(mock.recorded.info).toHaveLength(0);
    });
});

describe('renumber', () => {
    it('renumbers per depth and passes other lines through', () => {
        expect(renumber(['>> 3. a', '>>> 9. n', '>> 7. b', 'prose'])).toEqual(
            ['>> 1. a', '>>> 1. n', '>> 2. b', 'prose']
        );
    });

    it('returns an empty list unchanged', () => {
        expect(renumber([])).toEqual([]);
    });
});
