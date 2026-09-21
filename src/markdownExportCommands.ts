import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { toMarkdownDocument } from './markdownExporter';

/** Command: exports the file as a clean standard markdown document */
export async function onExportAsMarkdownDoc(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
        vscode.window.showInformationMessage('CL: Open a markdown file to export');
        return;
    }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const fileName   = path.basename(doc.fileName, path.extname(doc.fileName));
    const content    = toMarkdownDocument(doc, prefix);

    // An untitled document has no folder, so its default would be a bare relative
    // path such as "Untitled-1-export.md"; leave the dialog to choose instead.
    const defaultUri = doc.isUntitled ? undefined : vscode.Uri.file(
        path.join(path.dirname(doc.fileName), `${fileName}-export.md`)
    );
    const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { 'Markdown Files': ['md'] },
    });
    if (!saveUri) { return; }

    await vscode.workspace.fs.writeFile(saveUri, Buffer.from(content, 'utf-8'));
    vscode.window.showInformationMessage(`CL: Exported to ${path.basename(saveUri.fsPath)}`);
}
