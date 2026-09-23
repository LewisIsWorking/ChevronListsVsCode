import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { isSectionLocked, onLockSection, onUnlockSection } from '../lockCommands';
const mock = vscode as unknown as { __reset(): void; recorded: { info: string[] } };
beforeEach(() => { mock.__reset(); deactivate(); });
describe('isSectionLocked', () => {
    it('returns false when the header is the last line of the file', () => {
        const h = makeEditor(['> S']);
        expect(isSectionLocked(h.document as vscode.TextDocument, 0)).toBe(false);
    });
    it('returns true when the line below the header is the lock marker', () => {
        const h = makeEditor(['> S', '>> [locked]', '>> - a']);
        expect(isSectionLocked(h.document as vscode.TextDocument, 0)).toBe(true);
    });
    it('returns false when the line below the header is not the lock marker', () => {
        const h = makeEditor(['> S', '>> - a']);
        expect(isSectionLocked(h.document as vscode.TextDocument, 0)).toBe(false);
    });
});
describe('onLockSection', () => {
    it('does nothing without an active editor', async () => {
        await onLockSection();
        expect(mock.recorded.info).toHaveLength(0);
    });
    it('ignores non-markdown documents', async () => {
        const h = openEditor(['> S', '>> - a'], { languageId: 'plaintext' });
        await onLockSection();
        expect(h.lines()).toEqual(['> S', '>> - a']);
        expect(mock.recorded.info).toHaveLength(0);
    });
    it('asks for a section when the cursor is not under one', async () => {
        const h = openEditor(['prose', 'more'], { cursor: 1 });
        await onLockSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: No section found at cursor');
        expect(h.lines()).toEqual(['prose', 'more']);
    });
    it('reports when the section is already locked', async () => {
        const h = openEditor(['> S', '>> [locked]', '>> - a'], { cursor: 2 });
        await onLockSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: Section is already locked');
        expect(h.lines()).toEqual(['> S', '>> [locked]', '>> - a']);
    });
    it('locks an unlocked section mid-file', async () => {
        const h = openEditor(['> S', '>> - a', '> T'], { cursor: 1 });
        await onLockSection();
        expect(h.lines()).toEqual(['> S', '>> [locked]', '>> - a', '> T']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section locked - bulk operations will skip this section');
    });
    it('locks the header at the end of a file with no trailing newline onto its own line', async () => {
        const h = openEditor(['> S'], { cursor: 0 });
        await onLockSection();
        expect(h.lines()).toEqual(['> S', '>> [locked]']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section locked - bulk operations will skip this section');
    });
    it('locks the last section of a multi-section file with no trailing newline', async () => {
        const h = openEditor(['> A', '>> - a', '> B'], { cursor: 2 });
        await onLockSection();
        expect(h.lines()).toEqual(['> A', '>> - a', '> B', '>> [locked]']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section locked - bulk operations will skip this section');
    });
    it('locks when the cursor is on the header line itself', async () => {
        const h = openEditor(['> S', '>> - a'], { cursor: 0 });
        await onLockSection();
        expect(h.lines()).toEqual(['> S', '>> [locked]', '>> - a']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section locked - bulk operations will skip this section');
    });
});
describe('onUnlockSection', () => {
    it('does nothing without an active editor', async () => {
        await onUnlockSection();
        expect(mock.recorded.info).toHaveLength(0);
    });
    it('ignores non-markdown documents', async () => {
        const h = openEditor(['> S', '>> [locked]'], { languageId: 'plaintext' });
        await onUnlockSection();
        expect(h.lines()).toEqual(['> S', '>> [locked]']);
        expect(mock.recorded.info).toHaveLength(0);
    });
    it('asks for a section when the cursor is not under one', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        await onUnlockSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: No section found at cursor');
        expect(h.lines()).toEqual(['prose']);
    });
    it('reports when the section is not locked', async () => {
        const h = openEditor(['> S', '>> - a'], { cursor: 1 });
        await onUnlockSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: Section is not locked');
        expect(h.lines()).toEqual(['> S', '>> - a']);
    });
    it('reports not locked when the header is the last line of a file with no trailing newline', async () => {
        const h = openEditor(['> S'], { cursor: 0 });
        await onUnlockSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: Section is not locked');
        expect(h.lines()).toEqual(['> S']);
    });
    it('unlocks a locked section mid-file', async () => {
        const h = openEditor(['> S', '>> [locked]', '>> - a', '> T'], { cursor: 2 });
        await onUnlockSection();
        expect(h.lines()).toEqual(['> S', '>> - a', '> T']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section unlocked');
    });
    it('unlocks a marker at the end of a file with no trailing newline', async () => {
        const h = openEditor(['> S', '>> [locked]'], { cursor: 1 });
        await onUnlockSection();
        expect(h.lines()).toEqual(['> S']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section unlocked');
    });
    it('unlocks a marker when the file ends with a trailing newline', async () => {
        const h = openEditor(['> S', '>> [locked]', ''], { cursor: 1 });
        await onUnlockSection();
        expect(h.lines()).toEqual(['> S', '']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section unlocked');
    });
});
