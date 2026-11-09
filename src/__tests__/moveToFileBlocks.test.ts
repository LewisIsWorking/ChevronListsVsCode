/**
 * Covers Move Item to File taking the item's children with it, Duplicate Section
 * to File reporting a rejected edit, and the Text Transform title case keeping
 * the letter after an apostrophe small.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onMoveItemToFile } from '../moveItemToFileCommands';
import { onDuplicateSectionToFile } from '../duplicateSectionToFileCommands';
import { casedText } from '../textTransformPaletteCommands';

type Op = { text?: string };
const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[]; error: string[] };
    queued: { quickPick: unknown[] };
    workspace: {
        applyEdit(e: unknown): Promise<boolean>;
        openTextDocument(u: unknown): Promise<unknown>;
        findFiles(...a: unknown[]): Promise<unknown[]>;
    };
};
const realWorkspace = { ...mock.workspace };
const destUri = vscode.Uri.file('C:/tmp/dest.md');

let applied: Op[][];

beforeEach(() => {
    mock.__reset();
    deactivate();
    applied = [];
    const dest = makeEditor(['> Dest', '>> - d', '', '> Other'], { fileName: 'C:/tmp/dest.md' });
    mock.workspace.findFiles = () => Promise.resolve([destUri]);
    mock.workspace.openTextDocument = () => Promise.resolve(dest.document);
    mock.workspace.applyEdit = (e: unknown) => {
        applied.push((e as { operations: Op[] }).operations);
        return Promise.resolve(true);
    };
});
afterEach(() => { Object.assign(mock.workspace, realWorkspace); });

describe('Move Item to File', () => {
    const queuePicks = () => mock.queued.quickPick.push({ label: 'dest.md', uri: destUri }, { label: 'Dest', headerLine: 0 });

    it('takes everything nested under the item with it', async () => {
        const h = openEditor(['> Src', '>> - moving', '>>> - child', '>>>> - grandchild', '>> - stays'], { cursor: 1 });
        queuePicks();
        await onMoveItemToFile();
        expect(applied[0][0].text).toBe('>> - moving\n>>> - child\n>>>> - grandchild\n');
        expect(h.lines()).toEqual(['> Src', '>> - stays']);
    });

    it('moves an item with no children on its own', async () => {
        const h = openEditor(['> Src', '>>> - moving', '>> - stays'], { cursor: 1 });
        queuePicks();
        await onMoveItemToFile();
        expect(applied[0][0].text).toBe('>>> - moving\n');
        expect(h.lines()).toEqual(['> Src', '>> - stays']);
    });
});

describe('Duplicate Section to File', () => {
    it('says so when the file rejects the copy', async () => {
        openEditor(['> Src', '>> - a'], { cursor: 0 });
        mock.queued.quickPick.push({ label: 'dest.md', uri: destUri });
        mock.workspace.applyEdit = () => Promise.resolve(false);
        await onDuplicateSectionToFile();
        expect(mock.recorded.info).toEqual([]);
        expect(mock.recorded.error.at(-1)).toBe('CL: Could not copy "Src" to dest.md');
    });
});

describe('Text Transform case', () => {
    it('title case leaves the letter after an apostrophe small', () => {
        expect(casedText('title', "don't stop")).toBe("Don't Stop");
    });
    it('changes the whole text for upper and lower', () => {
        expect(casedText('upper', 'aB')).toBe('AB');
        expect(casedText('lower', 'aB')).toBe('ab');
    });
});
