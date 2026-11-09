/**
 * Covers commands that edit through workspace.applyEdit, which answers false when
 * VS Code refuses the edit, such as for a read-only file. These commands ignored
 * the answer and reported success.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onRenameTagWorkspace } from '../renameTagCommands';
import { onRenameSectionWorkspace } from '../renameSectionWorkspaceCommands';
import { onSendToDailyNote } from '../sendToDailyNoteCommands';
import { onStartItemTimer, onStopItemTimer } from '../itemTimerCommands';

const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[]; warning: string[]; error: string[] };
    queued: { quickPick: unknown[]; inputBox: (string | undefined)[] };
    workspace: {
        applyEdit(e: unknown): Promise<boolean>;
        openTextDocument(u: unknown): Promise<unknown>;
        findFiles(...a: unknown[]): Promise<unknown[]>;
        workspaceFolders: unknown;
        textDocuments?: unknown[];
    };
};
const real = { ...mock.workspace };
const uriA = vscode.Uri.file('C:/tmp/a.md');
const uriB = vscode.Uri.file('C:/tmp/b.md');

/** Two files for the workspace, and applyEdit giving each answer in turn */
function workspaceOf(a: string[], b: string[], answers: boolean[]): void {
    const docs = new Map([[uriA.toString(), makeEditor(a).document], [uriB.toString(), makeEditor(b).document]]);
    mock.workspace.findFiles = () => Promise.resolve([uriA, uriB]);
    mock.workspace.openTextDocument = (u: unknown) => Promise.resolve(docs.get((u as vscode.Uri).toString()));
    let call = 0;
    mock.workspace.applyEdit = () => Promise.resolve(answers[call++] ?? true);
}

beforeEach(() => { mock.__reset(); deactivate(); });
afterEach(() => { delete mock.workspace.textDocuments; Object.assign(mock.workspace, real); deactivate(); });

describe('Rename Tag across the workspace', () => {
    const rename = async (answers: boolean[]) => {
        workspaceOf(['>> - a #old'], ['>> - b #old', '>> - c #old'], answers);
        mock.queued.quickPick.push({ tag: 'old' });
        mock.queued.inputBox.push('new');
        await onRenameTagWorkspace();
    };

    it('reports all files when every edit applies', async () => {
        await rename([true, true]);
        expect(mock.recorded.info.at(-1)).toContain('3 lines across 2 files');
        expect(mock.recorded.warning).toEqual([]);
    });

    it('counts only the file that changed and warns about the other', async () => {
        await rename([false, true]);
        expect(mock.recorded.warning.at(-1)).toContain('2 lines across 1 file');
        expect(mock.recorded.warning.at(-1)).toContain('1 file could not be changed');
    });

    it('does not claim success when no edit applies', async () => {
        await rename([false, false]);
        expect(mock.recorded.info).toEqual([]);
        expect(mock.recorded.warning.at(-1)).toContain('2 files could not be changed');
    });
});

describe('Rename Section across the workspace', () => {
    const rename = async (answers: boolean[]) => {
        const lines = ['> Old', '>> - a'];
        const h = openEditor(lines, { cursor: 0 });
        workspaceOf(['[[Old]]'], ['[[Old]]'], answers);
        const open = (h.editor as { document: { uri: vscode.Uri } }).document;
        mock.workspace.findFiles = () => Promise.resolve([open.uri, uriB]);
        const docB = makeEditor(['[[Old]]']).document;
        mock.workspace.openTextDocument = (u: unknown) =>
            Promise.resolve((u as vscode.Uri).toString() === open.uri.toString() ? open : docB);
        mock.queued.inputBox.push('New');
        await onRenameSectionWorkspace();
    };

    it('reports all files when every edit applies', async () => {
        await rename([true, true]);
        expect(mock.recorded.info.at(-1)).toContain('across 2 files');
        expect(mock.recorded.warning).toEqual([]);
    });

    it('counts only the file that changed and warns about the other', async () => {
        await rename([true, false]);
        expect(mock.recorded.warning.at(-1)).toContain('across 1 file');
        expect(mock.recorded.warning.at(-1)).toContain('1 file could not be changed');
    });
});

describe('Send to Daily Note', () => {
    it('says so when the item could not be added to the note', async () => {
        openEditor(['>> - idea'], { cursor: 0 });
        mock.__setConfig('chevron-lists.dailyNotesFolder', 'daily');
        mock.workspace.workspaceFolders = [{ uri: vscode.Uri.file('C:/ws') }];
        mock.workspace.openTextDocument = () => Promise.resolve(makeEditor(['> Inbox']).document);
        mock.workspace.applyEdit = () => Promise.resolve(false);
        await onSendToDailyNote();
        expect(mock.recorded.info).toEqual([]);
        expect(mock.recorded.error.at(-1)).toContain('could not');
    });

    it('says so when a new note could not be created', async () => {
        openEditor(['>> - idea'], { cursor: 0 });
        mock.__setConfig('chevron-lists.dailyNotesFolder', 'daily');
        mock.workspace.workspaceFolders = [{ uri: vscode.Uri.file('C:/ws') }];
        mock.workspace.openTextDocument = () => Promise.reject(new Error('missing'));
        mock.workspace.applyEdit = () => Promise.resolve(false);
        await onSendToDailyNote();
        expect(mock.recorded.info).toEqual([]);
        expect(mock.recorded.error.at(-1)).toContain('could not');
    });
});

describe('Stop Item Timer', () => {
    it('says so when the item could not be stamped', async () => {
        const h = openEditor(['> A', '>> - task'], { cursor: 1 });
        mock.workspace.textDocuments = [(h.editor as { document: unknown }).document];
        await onStartItemTimer();
        mock.workspace.applyEdit = () => Promise.resolve(false);
        await onStopItemTimer();
        expect(mock.recorded.info.some(m => m.includes('stamped on item'))).toBe(false);
        expect(mock.recorded.error.at(-1)).toContain('could not');
    });
});
