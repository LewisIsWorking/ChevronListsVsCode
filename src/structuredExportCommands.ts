import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { parseStructured, toCsv } from './structuredExport';

async function saveFile(
    document: vscode.TextDocument,
    content: string,
    ext: string,
    label: string
): Promise<void> {
    const baseName  = path.basename(document.fileName, path.extname(document.fileName));
    // An untitled document has no folder, so its default would be a bare relative path.
    const defaultUri = document.isUntitled ? undefined : vscode.Uri.file(
        path.join(path.dirname(document.fileName), `${baseName}.${ext}`)
    );
    const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { [label]: [ext] },
    });
    if (!saveUri) { return; }
    await vscode.workspace.fs.writeFile(saveUri, Buffer.from(content, 'utf-8'));
    vscode.window.showInformationMessage(`CL: Exported to ${path.basename(saveUri.fsPath)}`);
}

/** Command: exports the file as structured JSON */
export async function onExportAsJson(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
        vscode.window.showInformationMessage('CL: Open a markdown file to export');
        return;
    }
    const { prefix }  = getConfig();
    const sections    = parseStructured(editor.document, prefix);
    const json        = JSON.stringify(sections, null, 2);
    await saveFile(editor.document, json, 'json', 'JSON Files');
}

/** Command: exports the file as a flat CSV */
export async function onExportAsCsv(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
        vscode.window.showInformationMessage('CL: Open a markdown file to export');
        return;
    }
    const { prefix }  = getConfig();
    const sections    = parseStructured(editor.document, prefix);
    const csv         = toCsv(sections);
    await saveFile(editor.document, csv, 'csv', 'CSV Files');
}
