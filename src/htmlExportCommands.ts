import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { buildHtml } from './htmlExporter';

/** Command: exports the active markdown file as a styled standalone HTML document */
export async function onExportAsHtml(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
        vscode.window.showInformationMessage('CL: Open a markdown file to export');
        return;
    }

    const { prefix }  = getConfig();
    const doc         = editor.document;
    const fileName    = path.basename(doc.fileName, path.extname(doc.fileName));
    const htmlContent = buildHtml(doc, prefix, fileName);

    // An untitled document has no folder, so its default would be a bare relative
    // path such as "Untitled-1.html"; leave the dialog to choose instead.
    const defaultUri = doc.isUntitled ? undefined : vscode.Uri.file(
        path.join(path.dirname(doc.fileName), `${fileName}.html`)
    );

    const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { 'HTML Files': ['html'] },
    });

    if (!saveUri) { return; }

    await vscode.workspace.fs.writeFile(
        saveUri,
        Buffer.from(htmlContent, 'utf-8')
    );

    const open = await vscode.window.showInformationMessage(
        `CL: Exported to ${path.basename(saveUri.fsPath)}`,
        'Open in Browser'
    );
    if (open) { vscode.env.openExternal(saveUri); }
}
