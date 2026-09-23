import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onHideSection, onShowHiddenSections, isSectionExcluded } from '../visibilityCommands';
const mock = vscode as unknown as { __reset(): void; recorded: { info: string[] } };
beforeEach(() => { mock.__reset(); deactivate(); });
describe('onHideSection', () => {
    it('does nothing without an active editor', async () => {
        await onHideSection();
        expect(mock.recorded.info).toHaveLength(0);
    });
    it('ignores non-markdown documents', async () => {
        const h = openEditor(['> S', '>> - a'], { languageId: 'plaintext' });
        await onHideSection();
        expect(h.lines()).toEqual(['> S', '>> - a']);
        expect(mock.recorded.info).toHaveLength(0);
    });
    it('asks for a section when the cursor is not under one', async () => {
        const h = openEditor(['prose', 'more'], { cursor: 1 });
        await onHideSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: No section found at cursor');
        expect(h.lines()).toEqual(['prose', 'more']);
    });
    it('refuses to hide a section that is already hidden', async () => {
        const h = openEditor(['> S', '>> [hidden]', '>> - a'], { cursor: 2 });
        await onHideSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: Section is already hidden');
        expect(h.lines()).toEqual(['> S', '>> [hidden]', '>> - a']);
    });
    it('inserts the hidden marker directly after the header', async () => {
        const h = openEditor(['> S', '>> - a', '> T', '>> - b'], { cursor: 0 });
        await onHideSection();
        expect(h.lines()).toEqual(['> S', '>> [hidden]', '>> - a', '> T', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section hidden - use CL: Show Hidden Sections to reveal');
    });
    it('finds the header above the cursor', async () => {
        const h = openEditor(['> S', '>> - a', '>> - b'], { cursor: 2 });
        await onHideSection();
        expect(h.lines()).toEqual(['> S', '>> [hidden]', '>> - a', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section hidden - use CL: Show Hidden Sections to reveal');
    });
    it('hides a header on the last line of a file with no trailing newline', async () => {
        const h = openEditor(['> S', '>> - a', '> Last'], { cursor: 2 });
        await onHideSection();
        expect(h.lines()).toEqual(['> S', '>> - a', '> Last', '>> [hidden]']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section hidden - use CL: Show Hidden Sections to reveal');
    });
    it('hides a lone header that is the whole file', async () => {
        const h = openEditor(['> Solo'], { cursor: 0 });
        await onHideSection();
        expect(h.lines()).toEqual(['> Solo', '>> [hidden]']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section hidden - use CL: Show Hidden Sections to reveal');
    });
});
describe('onShowHiddenSections', () => {
    it('does nothing without an active editor', async () => {
        await onShowHiddenSections();
        expect(mock.recorded.info).toHaveLength(0);
    });
    it('ignores non-markdown documents', async () => {
        const h = openEditor(['> S', '>> [hidden]'], { languageId: 'plaintext' });
        await onShowHiddenSections();
        expect(h.lines()).toEqual(['> S', '>> [hidden]']);
        expect(mock.recorded.info).toHaveLength(0);
    });
    it('reports when there is nothing hidden', async () => {
        const h = openEditor(['> S', '>> - a'], { cursor: 0 });
        await onShowHiddenSections();
        expect(h.lines()).toEqual(['> S', '>> - a']);
        expect(mock.recorded.info.at(-1)).toBe('CL: No hidden sections found');
    });
    it('reveals a single hidden section with singular message', async () => {
        const h = openEditor(['> S', '>> [hidden]', '>> - a', '> T'], { cursor: 0 });
        await onShowHiddenSections();
        expect(h.lines()).toEqual(['> S', '>> - a', '> T']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Revealed 1 hidden section');
    });
    it('reveals multiple hidden sections with plural message', async () => {
        const h = openEditor(['> A', '>> [hidden]', '>> - a', '> B', '>> [hidden]', '>> - b'], { cursor: 0 });
        await onShowHiddenSections();
        expect(h.lines()).toEqual(['> A', '>> - a', '> B', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Revealed 2 hidden sections');
    });
    it('removes a marker on the last line of a file with no trailing newline', async () => {
        const h = openEditor(['> S', '>> [hidden]'], { cursor: 0 });
        await onShowHiddenSections();
        expect(h.lines()).toEqual(['> S']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Revealed 1 hidden section');
    });
    it('removes a trailing marker without leaving a blank line', async () => {
        const h = openEditor(['> S', '>> - a', '>> [hidden]'], { cursor: 0 });
        await onShowHiddenSections();
        expect(h.lines()).toEqual(['> S', '>> - a']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Revealed 1 hidden section');
    });
    it('keeps the trailing newline when one is present', async () => {
        const h = openEditor(['> S', '>> [hidden]', '>> - a', ''], { cursor: 0 });
        await onShowHiddenSections();
        expect(h.lines()).toEqual(['> S', '>> - a', '']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Revealed 1 hidden section');
    });
    it('round-trips hide then show', async () => {
        const h = openEditor(['> S', '>> - a'], { cursor: 0 });
        await onHideSection();
        expect(h.lines()).toEqual(['> S', '>> [hidden]', '>> - a']);
        await onShowHiddenSections();
        expect(h.lines()).toEqual(['> S', '>> - a']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Revealed 1 hidden section');
    });
});
describe('isSectionExcluded', () => {
    it('returns true when the line after the header is the hidden marker', () => {
        const h = makeEditor(['> S', '>> [hidden]', '>> - a']);
        expect(isSectionExcluded(h.document as unknown as vscode.TextDocument, 0)).toBe(true);
    });
    it('returns false when the section is visible', () => {
        const h = makeEditor(['> S', '>> - a']);
        expect(isSectionExcluded(h.document as unknown as vscode.TextDocument, 0)).toBe(false);
    });
    it('returns false when the header is the last line of the file', () => {
        const h = makeEditor(['> S', '>> - a', '> Last']);
        expect(isSectionExcluded(h.document as unknown as vscode.TextDocument, 2)).toBe(false);
    });
});
