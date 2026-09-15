import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onToggleNote } from '../noteCommands';
type Pos = { line: number; character: number };
const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[] };
};
const cursorOf = (e: unknown) => {
    const a = (e as { selection: { active: Pos } }).selection.active;
    return [a.line, a.character];
};
const selectionOf = (e: unknown) => {
    const s = (e as { selection: { anchor: Pos; active: Pos } }).selection;
    return [[s.anchor.line, s.anchor.character], [s.active.line, s.active.character]];
};
beforeEach(() => { mock.__reset(); deactivate(); });
describe('onToggleNote', () => {
    it('does nothing without an active editor', async () => {
        await onToggleNote();
        expect(mock.recorded.info).toHaveLength(0);
    });
    it('ignores non-markdown documents', async () => {
        const h = openEditor(['>> - a'], { languageId: 'plaintext' });
        await onToggleNote();
        expect(h.lines()).toEqual(['>> - a']);
        expect(mock.recorded.info).toHaveLength(0);
    });
    it('asks for an item when the cursor is on prose', async () => {
        const h = openEditor(['> Section', 'prose'], { cursor: 1 });
        await onToggleNote();
        expect(mock.recorded.info.at(-1)).toBe('CL: Place cursor on a chevron item to toggle a note');
        expect(h.lines()).toEqual(['> Section', 'prose']);
    });
    it('asks for an item when the cursor is on a header', async () => {
        const h = openEditor(['> Section', '>> - a'], { cursor: 0 });
        await onToggleNote();
        expect(mock.recorded.info.at(-1)).toBe('CL: Place cursor on a chevron item to toggle a note');
        expect(h.lines()).toEqual(['> Section', '>> - a']);
    });
    it('asks for an item when the cursor is on a note line itself', async () => {
        const h = openEditor(['>> - a', '>> > existing'], { cursor: 1 });
        await onToggleNote();
        expect(mock.recorded.info.at(-1)).toBe('CL: Place cursor on a chevron item to toggle a note');
        expect(h.lines()).toEqual(['>> - a', '>> > existing']);
    });
    it('adds a note below a bullet item and selects the placeholder', async () => {
        const h = openEditor(['> S', '>> - a', '>> - b'], { cursor: 1, character: 3 });
        await onToggleNote();
        expect(h.lines()).toEqual(['> S', '>> - a', '>> > Note text here', '>> - b']);
        const line = h.lines()[2];
        const start = line.indexOf('Note text here');
        expect(selectionOf(h.editor)).toEqual([[2, start], [2, start + 'Note text here'.length]]);
        expect(h.revealed).toEqual([{ start: [2, start], end: [2, start + 'Note text here'.length] }]);
    });
    it('adds a note below a numbered item preserving depth', async () => {
        const h = openEditor(['> S', '>>> 1. first', '>>> 2. second'], { cursor: 1 });
        await onToggleNote();
        expect(h.lines()).toEqual(['> S', '>>> 1. first', '>>> > Note text here', '>>> 2. second']);
        const line = h.lines()[2];
        const start = line.indexOf('Note text here');
        expect(selectionOf(h.editor)).toEqual([[2, start], [2, start + 'Note text here'.length]]);
    });
    it('adds a note on its own line at the end of a file with no trailing newline', async () => {
        const h = openEditor(['> S', '>> - a'], { cursor: 1, character: 2 });
        await onToggleNote();
        expect(h.lines()).toEqual(['> S', '>> - a', '>> > Note text here']);
        const line = h.lines()[2];
        const start = line.indexOf('Note text here');
        expect(selectionOf(h.editor)).toEqual([[2, start], [2, start + 'Note text here'.length]]);
    });
    it('adds a numbered note on its own line at the end of a file with no trailing newline', async () => {
        const h = openEditor(['>> 1. last'], { cursor: 0, character: 0 });
        await onToggleNote();
        expect(h.lines()).toEqual(['>> 1. last', '>> > Note text here']);
    });
    it('removes an existing note below a bullet item', async () => {
        const h = openEditor(['> S', '>> - a', '>> > my note', '>> - b'], { cursor: 1, character: 3 });
        await onToggleNote();
        expect(h.lines()).toEqual(['> S', '>> - a', '>> - b']);
        expect(cursorOf(h.editor)).toEqual([1, 3]);
        expect(h.revealed).toHaveLength(0);
    });
    it('removes an existing note below a numbered item', async () => {
        const h = openEditor(['> S', '>> 1. first', '>> > my note'], { cursor: 1 });
        await onToggleNote();
        expect(h.lines()).toEqual(['> S', '>> 1. first']);
    });
    it('removes the note on the last line without leaving a blank line', async () => {
        const h = openEditor(['> S', '>> - a', '>> > my note'], { cursor: 1 });
        await onToggleNote();
        expect(h.lines()).toEqual(['> S', '>> - a']);
    });
    it('uses the configured bullet prefix', async () => {
        mock.__setConfig('chevron-lists.listPrefix', '*');
        const h = openEditor(['> S', '>> * task', '>> * other'], { cursor: 1 });
        await onToggleNote();
        expect(h.lines()).toEqual(['> S', '>> * task', '>> > Note text here', '>> * other']);
    });
    it('keeps the deep chevrons on the added note', async () => {
        const h = openEditor(['>>>> - deep'], { cursor: 0 });
        void makeEditor;
        await onToggleNote();
        expect(h.lines()).toEqual(['>>>> - deep', '>>>> > Note text here']);
    });
});
