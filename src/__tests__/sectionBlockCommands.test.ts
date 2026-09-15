/**
 * Covers src/tocCommands.ts and src/pasteSectionCommands.ts, which add a whole
 * section, and sectionBlockInsert, which decides where it goes.
 *
 * Bugs fixed, with regression tests checked against the original code:
 *  - both inserted the new header at the cursor line, so inside a section the
 *    items below the cursor silently became part of the new section;
 *  - running Insert Table of Contents again listed the previous table;
 *  - Paste as Section stacked markers on copied text ("> > Title",
 *    ">> - - milk") and turned numbered lines into bullets.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onInsertTableOfContents } from '../tocCommands';
import { onPasteAsSection } from '../pasteSectionCommands';
import { sectionBlockInsert } from '../lineEdits';

const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[]; clipboard: string };
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('sectionBlockInsert', () => {
    async function place(lines: string[], cursor: number, block: string[]) {
        const h = makeEditor(lines);
        const ins = sectionBlockInsert((h.editor as { document: never }).document, cursor, block);
        await (h.editor as { edit(cb: (eb: { insert(p: unknown, t: string): void }) => void): Promise<boolean> })
            .edit(eb => eb.insert(ins.position, ins.text));
        return { lines: h.lines(), line: ins.line };
    }

    it('goes after the cursor’s section, before its blank separator', async () => {
        expect(await place(['> A', '>> - a', '>> - b', '', '> B'], 1, ['> N'])).toEqual({
            lines: ['> A', '>> - a', '>> - b', '', '> N', '', '> B'], line: 4,
        });
    });

    it('goes at the cursor when the cursor is on a header or outside any section', async () => {
        expect(await place(['> A', '>> - a'], 0, ['> N'])).toEqual({ lines: ['> N', '', '> A', '>> - a'], line: 0 });
        expect(await place(['intro', '> A'], 0, ['> N'])).toEqual({ lines: ['> N', '', 'intro', '> A'], line: 0 });
    });

    it('adds no second blank line before a blank line', async () => {
        expect(await place(['', '> A'], 0, ['> N'])).toEqual({ lines: ['> N', '', '> A'], line: 0 });
    });
});

describe('onInsertTableOfContents', () => {
    it('does nothing without an active editor or outside markdown', async () => {
        await onInsertTableOfContents();
        openEditor(['> A'], { languageId: 'plaintext' });
        await onInsertTableOfContents();
        expect(mock.recorded.info).toEqual([]);
    });

    it('reports a file with no sections', async () => {
        openEditor(['prose']);
        await onInsertTableOfContents();
        expect(mock.recorded.info.at(-1)).toBe('CL: No sections found to build a table of contents');
    });

    it('inserts a linked list of sections at the top', async () => {
        const h = openEditor(['> Alpha', '>> - a', '> Beta'], { cursor: 0 });
        await onInsertTableOfContents();
        expect(h.lines()).toEqual([
            '> Table of Contents', '>> - [[Alpha]]', '>> - [[Beta]]', '', '> Alpha', '>> - a', '> Beta',
        ]);
        expect(mock.recorded.info.at(-1)).toBe('CL: Inserted table of contents with 2 sections');
    });

    it('does not take over the items below the cursor', async () => {
        const h = openEditor(['> Alpha', '>> - a1', '>> - a2'], { cursor: 1 });
        await onInsertTableOfContents();
        expect(h.lines()).toEqual(['> Alpha', '>> - a1', '>> - a2', '', '> Table of Contents', '>> - [[Alpha]]']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Inserted table of contents with 1 section');
    });

    it('leaves an existing table of contents out of the new one', async () => {
        const h = openEditor(['> Table of Contents', '>> - [[Alpha]]', '', '> Alpha'], { cursor: 3 });
        await onInsertTableOfContents();
        expect(h.lines()).toEqual(['> Table of Contents', '>> - [[Alpha]]', '', '> Table of Contents', '>> - [[Alpha]]', '', '> Alpha']);
    });
});

describe('onPasteAsSection', () => {
    it('does nothing without an active editor or outside markdown', async () => {
        await onPasteAsSection();
        openEditor([''], { languageId: 'plaintext' });
        await onPasteAsSection();
        expect(mock.recorded.info).toEqual([]);
    });

    it('reports an empty clipboard', async () => {
        openEditor(['']);
        mock.recorded.clipboard = ' \n \n';
        await onPasteAsSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: Clipboard is empty');
    });

    it('makes the first line the header and the rest items', async () => {
        const h = openEditor(['']);
        mock.recorded.clipboard = 'Groceries\r\nmilk\r\n\r\neggs';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> Groceries', '>> - milk', '>> - eggs', '']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Pasted as section "Groceries" with 2 items');
    });

    it('replaces markers already on the copied text, keeping numbers', async () => {
        mock.__setConfig('chevron-lists.listPrefix', '*');
        const h = openEditor(['']);
        mock.recorded.clipboard = '> Plan\n- first\n>> * second\n2) third\n# not a header marker here';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> Plan', '>> * first', '>> * second', '>> 2. third', '>> * # not a header marker here', '']);
    });

    it('says "1 item" and strips a markdown heading marker from the header', async () => {
        const h = openEditor(['']);
        mock.recorded.clipboard = '## Title\nonly';
        await onPasteAsSection();
        expect(h.lines()[0]).toBe('> Title');
        expect(mock.recorded.info.at(-1)).toBe('CL: Pasted as section "Title" with 1 item');
    });

    it('does not take over the items below the cursor', async () => {
        const h = openEditor(['> A', '>> - a1', '>> - a2'], { cursor: 1 });
        mock.recorded.clipboard = 'B\nb1';
        await onPasteAsSection();
        expect(h.lines()).toEqual(['> A', '>> - a1', '>> - a2', '', '> B', '>> - b1']);
    });
});
