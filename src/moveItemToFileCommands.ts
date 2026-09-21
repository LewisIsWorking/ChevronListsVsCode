import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { parseBullet, parseNumbered, isHeader } from './patterns';
import { lineAfter, sectionContentEnd, wholeLineRange } from './lineEdits';

interface SectionPickItem extends vscode.QuickPickItem { headerLine: number; }

/** Command: moves the item at the cursor to a section in another workspace file */
export async function onMoveItemToFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const text       = doc.lineAt(lineIndex).text;

    if (!parseBullet(text, prefix) && !parseNumbered(text)) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item to move it');
        return;
    }

    // Pick a destination file
    const files = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
    const currentUri = doc.uri.toString();
    const filePick = await vscode.window.showQuickPick(
        files.filter(f => f.toString() !== currentUri)
             .map(f => ({ label: path.basename(f.fsPath), description: f.fsPath, uri: f })),
        { placeHolder: 'Move item to file…' }
    );
    if (!filePick) { return; }

    // Pick a destination section in that file
    const destDoc  = await vscode.workspace.openTextDocument(filePick.uri);
    const sections: SectionPickItem[] = [];
    for (let i = 0; i < destDoc.lineCount; i++) {
        const t = destDoc.lineAt(i).text;
        if (isHeader(t)) { sections.push({ label: t.replace(/^> /, ''), headerLine: i }); }
    }
    if (sections.length === 0) {
        vscode.window.showInformationMessage(`CL: No sections found in ${filePick.label}`);
        return;
    }
    const sectionPick = await vscode.window.showQuickPick(sections, { placeHolder: 'Select destination section…' });
    if (!sectionPick) { return; }

    // Insert at end of destination section, delete from source
    const ins        = lineAfter(destDoc, sectionContentEnd(destDoc, sectionPick.headerLine), text);
    const srcRange   = wholeLineRange(doc, lineIndex);

    const destEdit = new vscode.WorkspaceEdit();
    destEdit.insert(filePick.uri, ins.position, ins.text);
    // Only delete the source once the item is safely in the destination; deleting
    // it regardless lost the item whenever the destination edit was rejected.
    if (!await vscode.workspace.applyEdit(destEdit)) {
        vscode.window.showErrorMessage(`CL: Could not add the item to ${filePick.label}; nothing was moved`);
        return;
    }

    await editor.edit(eb => eb.delete(srcRange));
    vscode.window.showInformationMessage(`CL: Moved item to "${sectionPick.label}" in ${filePick.label}`);
}
