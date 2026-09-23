/**
 * Covers src/duplicateItemsCommands.ts. SECTION-REPORT family.
 *
 * Duplicates are detected on the item's PLAIN text -- metadata stripped,
 * trimmed, lower-cased -- so two items that differ only by tag, priority or
 * case are the same item. That normalisation is the point of the command, so
 * it gets tested explicitly rather than implied by one happy path.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate, type Harness } from './helpers/editorHarness';
import { onShowDuplicateItems } from '../duplicateItemsCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
    lastQuickPick(): {
        items: { label: string; description?: string; lineIndex: number }[];
        activeItems: unknown[];
        placeholder: string;
        disposed: boolean;
        fireActive(items: unknown[]): void;
        fireAccept(): void;
        fireHide(): void;
    };
};

const NONE = 'CL: No duplicate items found in this file';
const cursorLine = (h: Harness) =>
    (h.editor as { selection: { active: { line: number } } }).selection.active.line;

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onShowDuplicateItems', () => {
    it('does nothing without an active editor', async () => {
        await onShowDuplicateItems();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['>> - same', '>> - same'], { languageId: 'plaintext' });
        await onShowDuplicateItems();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('reports when nothing is duplicated', async () => {
        openEditor(['> S', '>> - one', '>> - two']);
        await onShowDuplicateItems();
        expect(mock.recorded.info).toContain(NONE);
    });

    it('lists every occurrence, flagging the first and marking the rest', async () => {
        openEditor(['> S', '>> - buy milk', '>> - buy milk']);
        await onShowDuplicateItems();
        expect(mock.lastQuickPick().items.map((i) => i.label))
            .toEqual(['$(warning) buy milk', '  ↪ duplicate']);
    });

    it('describes each occurrence by section and one-based line', async () => {
        openEditor(['> Home', '>> - buy milk', '> Work', '>> - buy milk']);
        await onShowDuplicateItems();
        expect(mock.lastQuickPick().items.map((i) => i.description))
            .toEqual(['Home - line 2', 'Work - line 4']);
    });

    it('treats items differing only by case as duplicates', async () => {
        openEditor(['> S', '>> - Buy Milk', '>> - buy milk']);
        await onShowDuplicateItems();
        expect(mock.lastQuickPick().items).toHaveLength(2);
    });

    it('treats items differing only by metadata as duplicates', async () => {
        openEditor(['> S', '>> - buy milk #shop', '>> - buy milk #errand']);
        await onShowDuplicateItems();
        expect(mock.lastQuickPick().items[0].label).toBe('$(warning) buy milk');
    });

    it('matches numbered and bullet items against each other', async () => {
        openEditor(['> S', '>> - buy milk', '>> 1. buy milk']);
        await onShowDuplicateItems();
        expect(mock.lastQuickPick().items).toHaveLength(2);
    });

    it('ignores items that are nothing but metadata', async () => {
        openEditor(['> S', '>> - #tag', '>> - #tag']);
        await onShowDuplicateItems();
        expect(mock.recorded.info).toContain(NONE);
    });

    it('ignores lines that are not items', async () => {
        openEditor(['> S', 'buy milk', 'buy milk', '>> - once']);
        await onShowDuplicateItems();
        expect(mock.recorded.info).toContain(NONE);
    });

    it('uses the singular placeholder for one duplicated item', async () => {
        openEditor(['> S', '>> - a', '>> - a']);
        await onShowDuplicateItems();
        expect(mock.lastQuickPick().placeholder).toBe('1 duplicate item found');
    });

    it('uses the plural placeholder for several', async () => {
        openEditor(['> S', '>> - a', '>> - a', '>> - b', '>> - b']);
        await onShowDuplicateItems();
        expect(mock.lastQuickPick().placeholder).toBe('2 duplicate items found');
    });

    it('previews the highlighted occurrence', async () => {
        const h = openEditor(['> S', '>> - a', 'x', '>> - a']);
        await onShowDuplicateItems();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);
        expect(cursorLine(h)).toBe(3);
    });

    it('ignores an empty active list', async () => {
        const h = openEditor(['> S', '>> - a', '>> - a']);
        await onShowDuplicateItems();
        const before = h.revealed.length;
        mock.lastQuickPick().fireActive([]);
        expect(h.revealed).toHaveLength(before);
    });

    it('closes on accept', async () => {
        openEditor(['> S', '>> - a', '>> - a']);
        await onShowDuplicateItems();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.fireAccept();
        expect(pick.disposed).toBe(true);
    });

    it('restores the cursor when dismissed without choosing', async () => {
        const h = openEditor(['> S', '>> - a', '>> - a', 'x'], { cursor: 3 });
        await onShowDuplicateItems();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.activeItems = [];
        pick.fireHide();
        expect(cursorLine(h)).toBe(3);
    });
});
