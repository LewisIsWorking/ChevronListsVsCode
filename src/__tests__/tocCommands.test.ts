/**
 * Covers src/tocCommands.ts.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onInsertTableOfContents } from '../tocCommands';

void makeEditor;

const mock = vscode as unknown as { __reset(): void; recorded: { info: string[] } };

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onInsertTableOfContents', () => {
    it('does nothing without an active editor', async () => {
        await onInsertTableOfContents();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        const h = openEditor(['> Alpha'], { languageId: 'plaintext' });
        await onInsertTableOfContents();
        expect(h.lines()).toEqual(['> Alpha']);
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('shows a message when there are no sections', async () => {
        const h = openEditor(['>> - a', 'prose'], { cursor: 0 });
        await onInsertTableOfContents();
        expect(h.lines()).toEqual(['>> - a', 'prose']);
        expect(mock.recorded.info.at(-1)).toBe('CL: No sections found to build a table of contents');
    });

    it('inserts a single-entry TOC above the cursor header with singular message', async () => {
        const h = openEditor(['> Alpha', '>> - a'], { cursor: 0 });
        await onInsertTableOfContents();
        expect(h.lines()).toEqual(['> Table of Contents', '>> - [[Alpha]]', '', '> Alpha', '>> - a']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Inserted table of contents with 1 section');
    });

    it('inserts a multi-entry TOC after the cursor section and ignores non-header lines', async () => {
        const h = openEditor(['> Alpha', '>> - a', '', '> Beta', '>> - b'], { cursor: 1 });
        await onInsertTableOfContents();
        expect(h.lines()).toEqual(['> Alpha', '>> - a', '', '> Table of Contents', '>> - [[Alpha]]', '>> - [[Beta]]', '', '> Beta', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Inserted table of contents with 2 sections');
    });

    it('does not list an existing Table of Contents header', async () => {
        const h = openEditor(['> Table of Contents', '>> - [[Old]]', '', '> Alpha'], { cursor: 3 });
        await onInsertTableOfContents();
        expect(h.lines()).toEqual(['> Table of Contents', '>> - [[Old]]', '', '> Table of Contents', '>> - [[Alpha]]', '', '> Alpha']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Inserted table of contents with 1 section');
    });

    it('appends after the last line when the section ends the file with no trailing newline', async () => {
        const h = openEditor(['> Alpha', '>> - a', '>> - b'], { cursor: 2 });
        await onInsertTableOfContents();
        expect(h.lines()).toEqual(['> Alpha', '>> - a', '>> - b', '', '> Table of Contents', '>> - [[Alpha]]']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Inserted table of contents with 1 section');
    });

    it('inserts at the cursor line when outside any section', async () => {
        const h = openEditor(['prose', 'more', '> Alpha'], { cursor: 0 });
        await onInsertTableOfContents();
        expect(h.lines()).toEqual(['> Table of Contents', '>> - [[Alpha]]', '', 'prose', 'more', '> Alpha']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Inserted table of contents with 1 section');
    });

    it('does not add a second blank line when the cursor line is already blank', async () => {
        const h = openEditor(['', '> Alpha'], { cursor: 0 });
        await onInsertTableOfContents();
        expect(h.lines()).toEqual(['> Table of Contents', '>> - [[Alpha]]', '', '> Alpha']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Inserted table of contents with 1 section');
    });
});
