/**
 * Covers src/markdownExportCommands.ts, src/htmlExportCommands.ts and
 * src/obsidianExportCommands.ts: the commands that turn the active file into
 * another document. The conversions themselves are tested with their pure
 * functions.
 *
 * For an untitled document both save dialogs defaulted to a bare relative path
 * built from "Untitled-1"; they now leave the location to the dialog. The
 * regression tests were checked against the original code.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onExportAsMarkdownDoc } from '../markdownExportCommands';
import { onExportAsHtml } from '../htmlExportCommands';
import { onExportToObsidian } from '../obsidianExportCommands';

type SaveOptions = { defaultUri?: vscode.Uri; filters: Record<string, string[]> };
const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
    queued: { saveDialog: unknown[]; message: (string | undefined)[] };
    window: Record<string, unknown>;
    workspace: Record<string, unknown> & { fs: Record<string, unknown> };
    env: Record<string, unknown>;
};
const real = {
    showSaveDialog: mock.window.showSaveDialog,
    showTextDocument: mock.window.showTextDocument,
    openTextDocument: mock.workspace.openTextDocument,
    writeFile: mock.workspace.fs.writeFile,
    openExternal: mock.env.openExternal,
};

let dialogs: SaveOptions[];
let written: { path: string; text: string }[];
let opened: vscode.Uri[];

beforeEach(() => {
    mock.__reset();
    deactivate();
    dialogs = []; written = []; opened = [];
    mock.window.showSaveDialog = (opts: SaveOptions) => { dialogs.push(opts); return Promise.resolve(mock.queued.saveDialog.shift()); };
    mock.workspace.fs.writeFile = (u: vscode.Uri, b: Uint8Array) => { written.push({ path: u.fsPath, text: Buffer.from(b).toString('utf-8') }); return Promise.resolve(); };
    mock.env.openExternal = (u: vscode.Uri) => { opened.push(u); return Promise.resolve(true); };
});
afterEach(() => {
    mock.window.showSaveDialog = real.showSaveDialog;
    mock.window.showTextDocument = real.showTextDocument;
    mock.workspace.openTextDocument = real.openTextDocument;
    mock.workspace.fs.writeFile = real.writeFile;
    mock.env.openExternal = real.openExternal;
});

const untitled = () => {
    const h = openEditor(['> S', '>> - a'], { fileName: 'Untitled-1' });
    (h.document as { isUntitled: boolean }).isUntitled = true;
    return h;
};

describe('onExportAsMarkdownDoc', () => {
    it('asks for a markdown file', async () => {
        await onExportAsMarkdownDoc();
        openEditor(['x'], { languageId: 'plaintext' });
        await onExportAsMarkdownDoc();
        expect(mock.recorded.info).toEqual(['CL: Open a markdown file to export', 'CL: Open a markdown file to export']);
    });

    it('suggests <name>-export.md beside the file and writes the export', async () => {
        openEditor(['> Shopping', '>> - milk'], { fileName: 'C:/notes/list.md' });
        mock.queued.saveDialog.push(vscode.Uri.file('C:/notes/out.md'));
        await onExportAsMarkdownDoc();
        expect(dialogs[0].defaultUri?.fsPath.replace(/\\/g, '/')).toBe('C:/notes/list-export.md');
        expect(dialogs[0].filters).toEqual({ 'Markdown Files': ['md'] });
        expect(written).toHaveLength(1);
        expect(written[0].text).toContain('milk');
        expect(mock.recorded.info.at(-1)).toBe('CL: Exported to out.md');
    });

    it('writes nothing when the dialog is cancelled', async () => {
        openEditor(['> S']);
        await onExportAsMarkdownDoc();
        expect(written).toEqual([]);
    });

    it('lets the dialog choose the folder for an untitled document', async () => {
        untitled();
        await onExportAsMarkdownDoc();
        expect(dialogs[0].defaultUri).toBeUndefined();
    });
});

describe('onExportAsHtml', () => {
    it('asks for a markdown file', async () => {
        await onExportAsHtml();
        expect(mock.recorded.info).toEqual(['CL: Open a markdown file to export']);
    });

    it('suggests <name>.html beside the file, writes it, and opens it when asked', async () => {
        openEditor(['> S', '>> - a'], { fileName: 'C:/notes/list.md' });
        mock.queued.saveDialog.push(vscode.Uri.file('C:/notes/list.html'));
        await onExportAsHtml();
        expect(dialogs[0].defaultUri?.fsPath.replace(/\\/g, '/')).toBe('C:/notes/list.html');
        expect(written[0].text).toContain('<!DOCTYPE html>');
        expect(mock.recorded.info.at(-1)).toBe('CL: Exported to list.html');
        expect(opened.map(u => u.fsPath.replace(/\\/g, '/'))).toEqual(['C:/notes/list.html']);
    });

    it('does not open the browser when the prompt is dismissed', async () => {
        openEditor(['> S']);
        mock.queued.saveDialog.push(vscode.Uri.file('C:/notes/x.html'));
        mock.queued.message.push(undefined);
        await onExportAsHtml();
        expect(opened).toEqual([]);
    });

    it('writes nothing when the dialog is cancelled', async () => {
        openEditor(['> S']);
        await onExportAsHtml();
        expect(written).toEqual([]);
    });

    it('lets the dialog choose the folder for an untitled document', async () => {
        untitled();
        await onExportAsHtml();
        expect(dialogs[0].defaultUri).toBeUndefined();
    });
});

describe('onExportToObsidian', () => {
    it('does nothing without an active editor or outside markdown', async () => {
        await onExportToObsidian();
        openEditor(['x'], { languageId: 'plaintext' });
        await onExportToObsidian();
        expect(mock.recorded.info).toEqual([]);
    });

    it('opens the converted document beside the file', async () => {
        const docs: { content: string; language: string }[] = [];
        const shown: unknown[][] = [];
        mock.workspace.openTextDocument = (arg: { content: string; language: string }) => { docs.push(arg); return Promise.resolve(arg); };
        mock.window.showTextDocument = (...args: unknown[]) => { shown.push(args); return Promise.resolve(); };
        openEditor(['> S', '>> 2. b']);
        await onExportToObsidian();
        expect(docs[0].language).toBe('markdown');
        expect(docs[0].content).toContain('## S\n2. b');
        expect(shown[0]).toEqual([docs[0], vscode.ViewColumn.Beside]);
        expect(mock.recorded.info.at(-1)).toBe('CL: Obsidian export ready — save the file to use in Obsidian');
    });
});
