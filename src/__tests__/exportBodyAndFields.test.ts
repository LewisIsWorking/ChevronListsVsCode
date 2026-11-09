/**
 * Covers text that used to come out wrong in the file exports: items above the
 * first section landing inside it, "$" patterns and template words in the HTML,
 * and the star and default location of Export All Sections as JSON.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { buildHtml } from '../htmlExporter';
import { onExportAllSectionsAsJson } from '../exportAllJsonCommands';
import type { LineReader } from '../types';

type SaveOptions = { defaultUri?: vscode.Uri };
const mock = vscode as unknown as {
    __reset(): void;
    queued: { saveDialog: unknown[] };
    window: Record<string, unknown>;
    workspace: { fs: Record<string, unknown> };
};
const real = { showSaveDialog: mock.window.showSaveDialog, writeFile: mock.workspace.fs.writeFile };

let dialogs: SaveOptions[];
let written: string[];

beforeEach(() => {
    mock.__reset();
    deactivate();
    dialogs = []; written = [];
    mock.window.showSaveDialog = (opts: SaveOptions) => { dialogs.push(opts); return Promise.resolve(mock.queued.saveDialog.shift()); };
    mock.workspace.fs.writeFile = (_u: vscode.Uri, b: Uint8Array) => { written.push(Buffer.from(b).toString('utf-8')); return Promise.resolve(); };
});
afterEach(() => {
    mock.window.showSaveDialog = real.showSaveDialog;
    mock.workspace.fs.writeFile = real.writeFile;
});

function makeDoc(lines: string[]): LineReader {
    return { lineCount: lines.length, lineAt: (i: number) => ({ text: lines[i] }) };
}

describe('buildHtml', () => {
    it('leaves out items above the first section instead of filing them in it', () => {
        expect(buildHtml(makeDoc(['>> - stray', '> A', '>> - kept']), '-', 'f')).not.toContain('stray');
    });

    it('puts the file name in the page heading as well as the title', () => {
        const html = buildHtml(makeDoc(['> A', '>> - kept']), '-', 'notes');
        expect(html).toContain('<h1>notes</h1>');
        expect(html).not.toContain('{{TITLE}}');
    });

    it('keeps replacement patterns in an item as they are', () => {
        const html = buildHtml(makeDoc(['> A', ">> - costs $& and $' here"]), '-', 'f');
        expect(html).toContain('costs $&amp; and $&#39; here');
        expect(html.match(/<!DOCTYPE html>/g)).toHaveLength(1);
    });

    it('does not treat a file named after the body placeholder as the body', () => {
        const html = buildHtml(makeDoc(['> A', '>> - kept']), '-', '{{BODY}}');
        expect(html).toContain('<title>{{BODY}}</title>');
        expect(html).toContain('<h1>{{BODY}}</h1>');
        expect(html).toContain('kept');
    });
});

describe('onExportAllSectionsAsJson', () => {
    it('reports a starred item as starred', async () => {
        openEditor(['> S', '>> - * shining', '>> - plain'], { fileName: 'C:/notes/list.md' });
        mock.queued.saveDialog.push(vscode.Uri.file('C:/notes/list.json'));
        await onExportAllSectionsAsJson();
        const { sections } = JSON.parse(written[0]) as { sections: { items: { starred: boolean }[] }[] };
        expect(sections[0].items.map(i => i.starred)).toEqual([true, false]);
    });

    it('leaves the location to the dialog for an untitled document', async () => {
        const h = openEditor(['> S', '>> - a'], { fileName: 'Untitled-1' });
        (h.document as { isUntitled: boolean }).isUntitled = true;
        mock.queued.saveDialog.push(undefined);
        await onExportAllSectionsAsJson();
        expect(dialogs[0].defaultUri).toBeUndefined();
    });
});
