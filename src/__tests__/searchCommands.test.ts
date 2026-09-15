/**
 * Covers src/searchCommands.ts.
 *
 * The previous version of this file rebuilt the collect/filter logic locally --
 * "Pure helpers mirrored from searchCommands.ts" -- and tested those copies, so
 * the real module sat at 0%. These tests drive the actual commands.
 *
 * Both commands are quick-pick driven, so they need the mock's recording quick
 * pick: `fireActive` for the live-preview path, `fireAccept` for selection and
 * `fireHide` for cancel. Those three callbacks are most of the module's
 * branching and none of them were reachable before.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate, type Harness } from './helpers/editorHarness';
import { onSearchItems, onFilterSections } from '../searchCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
    lastQuickPick(): {
        items: { label: string; description?: string; lineIndex: number }[];
        activeItems: unknown[];
        placeholder: string;
        shown: boolean;
        disposed: boolean;
        fireActive(items: unknown[]): void;
        fireAccept(): void;
        fireHide(): void;
    };
};

beforeEach(() => {
    mock.__reset();
    deactivate();
});

const DOC = [
    '> Alpha',
    '>> - first item',
    '>> 2. second item',
    '>>> - nested item',
    'plain prose',
    '> Beta',
    '>> - beta item',
];

describe('onSearchItems', () => {
    it('does nothing without an active editor', async () => {
        await onSearchItems();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(DOC, { languageId: 'plaintext' });
        await onSearchItems();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('tells the user when the file has no items', async () => {
        openEditor(['> Header only', 'prose']);
        await onSearchItems();
        expect(mock.recorded.info).toContain('Chevron Lists: no items found in this file');
    });

    it('lists every bullet and numbered item, and nothing else', async () => {
        openEditor(DOC);
        await onSearchItems();
        const pick = mock.lastQuickPick();
        expect(pick.items).toHaveLength(4);
        expect(pick.items.map((i) => i.lineIndex)).toEqual([1, 2, 3, 6]);
    });

    it('tags each item with the header it sits under', async () => {
        openEditor(DOC);
        await onSearchItems();
        expect(mock.lastQuickPick().items.map((i) => i.description)).toEqual(
            ['Alpha', 'Alpha', 'Alpha', 'Beta']
        );
    });

    it('indents nested items by chevron depth', async () => {
        openEditor(DOC);
        await onSearchItems();
        const labels = mock.lastQuickPick().items.map((i) => i.label);
        expect(labels[0].startsWith('$(list-unordered)')).toBe(true);   // depth 0
        expect(labels[2].startsWith('  $(list-unordered)')).toBe(true); // depth 1
    });

    it('renders numbered items with their number', async () => {
        openEditor(DOC);
        await onSearchItems();
        expect(mock.lastQuickPick().items[1].label).toContain('$(symbol-numeric) 2. second item');
    });

    it('shows the pick with a filter placeholder', async () => {
        openEditor(DOC);
        await onSearchItems();
        const pick = mock.lastQuickPick();
        expect(pick.shown).toBe(true);
        expect(pick.placeholder).toBe('Type to filter chevron list items...');
    });

    it('previews the highlighted item by moving the cursor to its line', async () => {
        const h: Harness = openEditor(DOC);
        await onSearchItems();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[3]]);   // the Beta item, line 6
        expect(h.revealed.at(-1)?.start[0]).toBe(6);
    });

    it('ignores an empty active list', async () => {
        const h: Harness = openEditor(DOC);
        await onSearchItems();
        const before = h.revealed.length;
        mock.lastQuickPick().fireActive([]);
        expect(h.revealed).toHaveLength(before);
    });

    it('jumps to the item on accept and closes the pick', async () => {
        const h: Harness = openEditor(DOC);
        await onSearchItems();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);   // line 2
        pick.fireAccept();
        expect(h.revealed.at(-1)?.start[0]).toBe(2);
        expect(pick.shown).toBe(false);
        expect(pick.disposed).toBe(true);
    });

    it('accepting with nothing highlighted still closes the pick', async () => {
        openEditor(DOC);
        await onSearchItems();
        const pick = mock.lastQuickPick();
        pick.fireAccept();                  // activeItems is empty
        expect(pick.disposed).toBe(true);
    });

    it('restores the original cursor position when cancelled', async () => {
        const h: Harness = openEditor(DOC, { cursor: 4, character: 2 });
        await onSearchItems();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);   // preview moves away to line 1
        pick.activeItems = [];              // cancelled: nothing selected
        pick.fireHide();
        expect(h.revealed.at(-1)?.start).toEqual([4, 2]);
        expect(pick.disposed).toBe(true);
    });
});

describe('onFilterSections', () => {
    it('does nothing without an active editor', async () => {
        await onFilterSections();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(DOC, { languageId: 'plaintext' });
        await onFilterSections();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('tells the user when the file has no headers', async () => {
        openEditor(['>> - an orphan item', 'prose']);
        await onFilterSections();
        expect(mock.recorded.info).toContain('Chevron Lists: no headers found in this file');
    });

    it('lists every header', async () => {
        openEditor(DOC);
        await onFilterSections();
        const pick = mock.lastQuickPick();
        expect(pick.items).toHaveLength(2);
        expect(pick.items.map((i) => i.lineIndex)).toEqual([0, 5]);
    });

    it('shows the pick with a section placeholder', async () => {
        openEditor(DOC);
        await onFilterSections();
        expect(mock.lastQuickPick().placeholder).toBe('Type to filter sections...');
    });

    it('previews the highlighted section', async () => {
        const h: Harness = openEditor(DOC);
        await onFilterSections();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);   // Beta, line 5
        expect(h.revealed.at(-1)?.start[0]).toBe(5);
    });

    it('ignores an empty active list', async () => {
        const h: Harness = openEditor(DOC);
        await onFilterSections();
        const before = h.revealed.length;
        mock.lastQuickPick().fireActive([]);
        expect(h.revealed).toHaveLength(before);
    });

    it('jumps to the section on accept', async () => {
        const h: Harness = openEditor(DOC);
        await onFilterSections();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);
        pick.fireAccept();
        expect(h.revealed.at(-1)?.start[0]).toBe(5);
        expect(pick.disposed).toBe(true);
    });

    it('accepting with nothing highlighted still closes the pick', async () => {
        openEditor(DOC);
        await onFilterSections();
        const pick = mock.lastQuickPick();
        pick.fireAccept();
        expect(pick.disposed).toBe(true);
    });

    it('restores the original cursor position when cancelled', async () => {
        const h: Harness = openEditor(DOC, { cursor: 6, character: 1 });
        await onFilterSections();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.activeItems = [];
        pick.fireHide();
        expect(h.revealed.at(-1)?.start).toEqual([6, 1]);
    });
});
