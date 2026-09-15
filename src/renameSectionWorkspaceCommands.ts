import * as vscode from 'vscode';
import { isHeader } from './patterns';

/** Command: renames a section and updates [[links]] across all workspace files */
export async function onRenameSectionWorkspace(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc = editor.document;
    // Find nearest header
    let headerLine = -1;
    for (let i = editor.selection.active.line; i >= 0; i--) {
        if (isHeader(doc.lineAt(i).text)) { headerLine = i; break; }
    }
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const oldName = doc.lineAt(headerLine).text.replace(/^> /, '').trim();
    const newName = await vscode.window.showInputBox({
        prompt:      'Rename section (updates all [[links]] in workspace)',
        value:       oldName,
        placeHolder: 'New section name',
    });
    if (!newName?.trim() || newName.trim() === oldName) { return; }

    const mdFiles = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
    let totalUpdated = 0;

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'CL: Renaming section across workspace…', cancellable: false },
        async () => {
            for (const uri of mdFiles) {
                const fileDoc = await vscode.workspace.openTextDocument(uri);
                let updated   = false;
                const edit    = new vscode.WorkspaceEdit();

                for (let i = 0; i < fileDoc.lineCount; i++) {
                    const text     = fileDoc.lineAt(i).text;
                    // Rename the header itself
                    if (uri.toString() === doc.uri.toString() && i === headerLine) {
                        edit.replace(uri, fileDoc.lineAt(i).range, `> ${newName.trim()}`);
                        updated = true;
                        continue;
                    }
                    // Update [[oldName]] links
                    if (text.includes(`[[${oldName}]]`)) {
                        const newText = text.split(`[[${oldName}]]`).join(`[[${newName.trim()}]]`);
                        edit.replace(uri, fileDoc.lineAt(i).range, newText);
                        updated = true;
                    }
                }
                if (updated) {
                    await vscode.workspace.applyEdit(edit);
                    totalUpdated++;
                }
            }
        }
    );

    vscode.window.showInformationMessage(
        `CL: Renamed "${oldName}" → "${newName.trim()}" across ${totalUpdated} file${totalUpdated === 1 ? '' : 's'}`
    );
}
