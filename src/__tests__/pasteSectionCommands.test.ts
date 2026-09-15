/**
 * Covers src/pasteSectionCommands.ts. PASTE-AS-SECTION family.
 *
 * Clipboard text becomes a new chevron section: first line is the header,
 * the rest are items. Markers already on the copied text are replaced, not
 * stacked ("> > Title", ">> - - milk"), and numbered lines stay numbered.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onPasteAsSection } from '../pasteSectionCommands';

const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[]; clipboard: string };
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onPasteAsSection', () => {
    it('does nothing without an active editor', async () => {
        mock.recorded.clipboard = 'Title\nitem';
        await onPasteAsSection();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        const h = openEditor(['text'], { languageId: 'plaintext' });
        mock.recorded.clipboard = 'Title\nitem';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['text']);
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('shows a message when the clipboard is empty', async () => {
        const h = openEditor(['> S'], { cursor: 0 });
        mock.recorded.clipboard = '';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> S']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Clipboard is empty');
    });

    it('shows a message when the clipboard has only blank lines', async () => {
        const h = openEditor(['> S'], { cursor: 0 });
        mock.recorded.clipboard = '   \n  \n\t\n';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> S']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Clipboard is empty');
    });

    it('pastes a header-only clipboard as a section with no items', async () => {
        const h = openEditor(['> Old', '>> - kept'], { cursor: 0 });
        mock.recorded.clipboard = 'New section';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> New section', '', '> Old', '>> - kept']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Pasted as section "New section" with 0 items');
    });

    it('pastes plain lines as a header with bullet items and skips blank lines', async () => {
        const h = openEditor(['> Old', '>> - kept'], { cursor: 0 });
        mock.recorded.clipboard = 'Shopping\n\nmilk\n   \nbread';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> Shopping', '>> - milk', '>> - bread', '', '> Old', '>> - kept']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Pasted as section "Shopping" with 2 items');
    });

    it('uses the singular "item" for exactly one item', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        mock.recorded.clipboard = ' Solo \n  only-item  ';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> Solo', '>> - only-item', '', 'prose']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Pasted as section "Solo" with 1 item');
    });

    it('strips a chevron marker from the header line', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        mock.recorded.clipboard = '> Groceries\nmilk';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> Groceries', '>> - milk', '', 'prose']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Pasted as section "Groceries" with 1 item');
    });

    it('strips a markdown heading marker from the header line', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        mock.recorded.clipboard = '## Weekend\nmilk';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> Weekend', '>> - milk', '', 'prose']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Pasted as section "Weekend" with 1 item');
    });

    it('replaces markers already on copied items instead of stacking them', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        mock.recorded.clipboard = 'Title\n>> - milk\n- bread';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> Title', '>> - milk', '>> - bread', '', 'prose']);
    });

    it('strips star, plus and bullet markers from copied items', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        mock.recorded.clipboard = 'Title\n* a\n+ b\n• c';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> Title', '>> - a', '>> - b', '>> - c', '', 'prose']);
    });

    it('keeps numbered lines numbered and normalises a paren to a dot', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        mock.recorded.clipboard = 'Title\n1. first\n2) second';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> Title', '>> 1. first', '>> 2. second', '', 'prose']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Pasted as section "Title" with 2 items');
    });

    it('keeps a chevron-numbered line numbered without stacking markers', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        mock.recorded.clipboard = 'Title\n>> 3. third';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> Title', '>> 3. third', '', 'prose']);
    });

    it('uses the configured bullet prefix for plain items', async () => {
        mock.__setConfig('chevron-lists.listPrefix', '*');
        const h = openEditor(['prose'], { cursor: 0 });
        mock.recorded.clipboard = 'Title\nplain';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> Title', '>> * plain', '', 'prose']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Pasted as section "Title" with 1 item');
    });

    it('inserts at the cursor line when outside any section', async () => {
        const h = openEditor(['prose', 'more'], { cursor: 1 });
        mock.recorded.clipboard = 'Name\na';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['prose', '> Name', '>> - a', '', 'more']);
    });

    it('appends after the section content when the cursor is on an item', async () => {
        const h = openEditor(['> S', '>> - a', '', '> Next', '>> - n'], { cursor: 1 });
        mock.recorded.clipboard = 'Name\nx\ny';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> S', '>> - a', '', '> Name', '>> - x', '>> - y', '', '> Next', '>> - n']);
    });

    it('appends on its own lines at the end of a file with no trailing newline', async () => {
        const h = openEditor(['> S', '>> - a'], { cursor: 1 });
        mock.recorded.clipboard = 'Name\nx';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> S', '>> - a', '', '> Name', '>> - x']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Pasted as section "Name" with 1 item');
    });

    it('keeps the trailing newline when the file ends with one', async () => {
        const h = makeEditor(['> S', '>> - a', ''], { cursor: 1 });
        (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = h.editor;
        mock.recorded.clipboard = 'Name\nx';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> S', '>> - a', '', '> Name', '>> - x', '']);
    });
});
