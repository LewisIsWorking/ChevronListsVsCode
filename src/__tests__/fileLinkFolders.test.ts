/**
 * Covers a [[file:name.md]] link to a file in another folder. Insert File Section
 * Link offers every workspace file but writes only its name, and Find Dead Links
 * counts such a link as alive, so following it has to find the file too.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onGoToLinkedFile, ChevronFileLinkHoverProvider } from '../fileLinkCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { error: string[] };
    workspace: {
        openTextDocument(u: unknown): Promise<unknown>;
        findFiles(...a: unknown[]): Promise<unknown[]>;
    };
};
const real = { ...mock.workspace };
const nested = vscode.Uri.file('C:/tmp/sub/a.md');
const beside = 'C:/tmp/a.md';

let opened: string[];
let searches: unknown[];
let inWorkspace: unknown[];
let onDisk: string[];

beforeEach(() => {
    mock.__reset();
    opened = [];
    searches = [];
    inWorkspace = [];
    onDisk = [];
    mock.workspace.openTextDocument = (u: unknown) => {
        const p = (u as { fsPath: string }).fsPath.replace(/\\/g, '/');
        if (!onDisk.includes(p)) { return Promise.reject(new Error('not found')); }
        opened.push(p);
        return Promise.resolve({ lineCount: 1, lineAt: () => ({ text: '> Found' }) });
    };
    mock.workspace.findFiles = (include: unknown) => {
        searches.push(include);
        return Promise.resolve(inWorkspace);
    };
});

afterEach(() => {
    Object.assign(mock.workspace, real);
    deactivate();
});

const onLink = () => openEditor(['>> - [[file:a.md]]'], { cursor: 0, character: 12, fileName: 'C:/tmp/notes.md' });

describe('file links to other folders', () => {
    it('opens the file beside this one without searching', async () => {
        onDisk = [beside];
        onLink();
        await onGoToLinkedFile();
        expect(opened).toEqual([beside]);
        expect(searches).toEqual([]);
    });

    it('finds the file in another folder of the workspace', async () => {
        onDisk = ['C:/tmp/sub/a.md'];
        inWorkspace = [nested];
        onLink();
        await onGoToLinkedFile();
        expect(opened).toEqual(['C:/tmp/sub/a.md']);
        expect(searches).toEqual(['**/a.md']);
        expect(mock.recorded.error).toEqual([]);
    });

    it('says so when the file is nowhere', async () => {
        onLink();
        await onGoToLinkedFile();
        expect(mock.recorded.error).toEqual(['CL: Could not open file "a.md"']);
    });

    it('hovers a file in another folder', async () => {
        onDisk = ['C:/tmp/sub/a.md'];
        inWorkspace = [nested];
        const { editor } = makeEditor(['>> - [[file:a.md]]'], { fileName: 'C:/tmp/notes.md' }) as unknown as { editor: vscode.TextEditor };
        const hover = await new ChevronFileLinkHoverProvider().provideHover(editor.document, new vscode.Position(0, 12));
        expect(JSON.stringify(hover)).not.toContain('file not found');
        expect(JSON.stringify(hover)).toContain('> Found');
    });
});
