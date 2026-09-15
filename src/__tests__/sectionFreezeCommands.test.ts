/**
 * Covers src/sectionFreezeCommands.ts.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onFreezeSection, onUnfreezeSection, isSectionFrozen } from '../sectionFreezeCommands';

const mock = vscode as unknown as { __reset(): void; recorded: { info: string[] } };

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onFreezeSection', () => {
    it('does nothing without an active editor', async () => {
        await onFreezeSection();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        const h = openEditor(['> S', '>> - a'], { languageId: 'plaintext', cursor: 1 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> S', '>> - a']);
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('shows a message when there is no section at the cursor', async () => {
        const h = openEditor(['prose', 'more prose'], { cursor: 1 });
        await onFreezeSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: No section found at cursor');
        expect(h.lines()).toEqual(['prose', 'more prose']);
    });

    it('freezes a header-only section at the end of a file with no trailing newline', async () => {
        const h = openEditor(['> S'], { cursor: 0 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> S', '>> [frozen]']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section frozen — edits will show a warning');
    });

    it('inserts the marker directly after the header when the section ends at EOF with no trailing newline', async () => {
        const h = openEditor(['> S', '>> - a'], { cursor: 1 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> S', '>> [frozen]', '>> - a']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section frozen — edits will show a warning');
    });

    it('freezes a mid-file section directly after its header', async () => {
        const h = openEditor(['> A', '>> - a', '> B', '>> - b'], { cursor: 1 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> A', '>> [frozen]', '>> - a', '> B', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section frozen — edits will show a warning');
    });

    it('finds the header when the cursor is several lines below it', async () => {
        const h = openEditor(['> A', '>> - a', '>> - b', '>> - c'], { cursor: 3 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> A', '>> [frozen]', '>> - a', '>> - b', '>> - c']);
    });

    it('does not freeze twice when the marker is immediately after the header', async () => {
        const h = openEditor(['> S', '>> [frozen]', '>> - a'], { cursor: 2 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> S', '>> [frozen]', '>> - a']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section is already frozen');
    });

    it('detects the marker deeper in the section', async () => {
        const h = openEditor(['> S', '>> - a', '>> - b', '>> [frozen]'], { cursor: 1 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> S', '>> - a', '>> - b', '>> [frozen]']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section is already frozen');
    });

    it('ignores a near-miss marker with a trailing space', async () => {
        const h = openEditor(['> S', '>> [frozen] ', '>> - a'], { cursor: 2 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> S', '>> [frozen]', '>> [frozen] ', '>> - a']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section frozen — edits will show a warning');
    });

    it('freezes a section when a later section holds the marker', async () => {
        const h = openEditor(['> A', '>> - a', '> B', '>> [frozen]', '>> - b'], { cursor: 1 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> A', '>> [frozen]', '>> - a', '> B', '>> [frozen]', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section frozen — edits will show a warning');
    });
});

describe('onUnfreezeSection', () => {
    it('does nothing without an active editor', async () => {
        await onUnfreezeSection();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        const h = openEditor(['> S', '>> [frozen]'], { languageId: 'plaintext', cursor: 1 });
        await onUnfreezeSection();
        expect(h.lines()).toEqual(['> S', '>> [frozen]']);
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('shows a message when there is no section at the cursor', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        await onUnfreezeSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: No section found at cursor');
        expect(h.lines()).toEqual(['prose']);
    });

    it('reports not frozen for a header-only section', async () => {
        const h = openEditor(['> S'], { cursor: 0 });
        await onUnfreezeSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: Section is not frozen');
        expect(h.lines()).toEqual(['> S']);
    });

    it('reports not frozen when the section has items but no marker', async () => {
        const h = openEditor(['> S', '>> - a', '>> - b'], { cursor: 2 });
        await onUnfreezeSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: Section is not frozen');
        expect(h.lines()).toEqual(['> S', '>> - a', '>> - b']);
    });

    it('removes the marker immediately after the header', async () => {
        const h = openEditor(['> A', '>> [frozen]', '>> - a', '> B', '>> - b'], { cursor: 2 });
        await onUnfreezeSection();
        expect(h.lines()).toEqual(['> A', '>> - a', '> B', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section unfrozen');
    });

    it('removes a deeper marker', async () => {
        const h = openEditor(['> S', '>> - a', '>> [frozen]', '>> - b'], { cursor: 1 });
        await onUnfreezeSection();
        expect(h.lines()).toEqual(['> S', '>> - a', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section unfrozen');
    });

    it('removes the marker at the end of a file with no trailing newline', async () => {
        const h = openEditor(['> S', '>> - a', '>> [frozen]'], { cursor: 1 });
        await onUnfreezeSection();
        expect(h.lines()).toEqual(['> S', '>> - a']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section unfrozen');
    });

    it('leaves a later section marker alone when the current section is not frozen', async () => {
        const h = openEditor(['> A', '>> - a', '> B', '>> [frozen]', '>> - b'], { cursor: 1 });
        await onUnfreezeSection();
        expect(h.lines()).toEqual(['> A', '>> - a', '> B', '>> [frozen]', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section is not frozen');
    });
});

describe('isSectionFrozen', () => {
    it('returns false when there is no header above the line', () => {
        const h = makeEditor(['prose', 'more prose']);
        expect(isSectionFrozen(h.document as unknown as vscode.TextDocument, 1)).toBe(false);
    });

    it('returns false for a header-only section', () => {
        const h = makeEditor(['> S']);
        expect(isSectionFrozen(h.document as unknown as vscode.TextDocument, 0)).toBe(false);
    });

    it('returns false when the section has items but no marker', () => {
        const h = makeEditor(['> S', '>> - a', '>> - b']);
        expect(isSectionFrozen(h.document as unknown as vscode.TextDocument, 2)).toBe(false);
    });

    it('returns true when the marker is immediately after the header', () => {
        const h = makeEditor(['> S', '>> [frozen]', '>> - a']);
        expect(isSectionFrozen(h.document as unknown as vscode.TextDocument, 2)).toBe(true);
    });

    it('returns true when the marker is deeper in the section', () => {
        const h = makeEditor(['> S', '>> - a', '>> [frozen]']);
        expect(isSectionFrozen(h.document as unknown as vscode.TextDocument, 1)).toBe(true);
    });

    it('only looks within the section containing the line', () => {
        const h = makeEditor(['> A', '>> - a', '> B', '>> [frozen]', '>> - b']);
        const doc = h.document as unknown as vscode.TextDocument;
        expect(isSectionFrozen(doc, 1)).toBe(false);
        expect(isSectionFrozen(doc, 4)).toBe(true);
    });
});
