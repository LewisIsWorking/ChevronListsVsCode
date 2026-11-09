import * as vscode from 'vscode';
import * as path from 'path';
import { getSectionRange, findHeaderAbove } from './documentUtils';

/** Command: copies the current section into a chosen workspace file */
export async function onDuplicateSectionToFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const sectionName = doc.lineAt(headerLine).text.replace(/^> /, '').trim();
    const [, end]     = getSectionRange(doc, headerLine);
    const sectionText = Array.from({ length: end - headerLine + 1 }, (_, i) =>
        doc.lineAt(headerLine + i).text
    ).join('\n');

    // Pick a target file
    const files = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**', 50);
    const self  = doc.uri.fsPath;
    const items = files
        .filter(f => f.fsPath !== self)
        .map(f => ({
            label:       path.basename(f.fsPath),
            description: vscode.workspace.asRelativePath(f),
            uri:         f,
        }));

    if (items.length === 0) {
        vscode.window.showInformationMessage('CL: No other markdown files found in workspace');
        return;
    }

    const pick = await vscode.window.showQuickPick(items, {
        placeHolder: `Copy "${sectionName}" to which file?`,
    });
    if (!pick) { return; }

    const targetDoc = await vscode.workspace.openTextDocument(pick.uri);
    const insertPos = new vscode.Position(targetDoc.lineCount, 0);
    const we        = new vscode.WorkspaceEdit();
    we.insert(pick.uri, insertPos, `\n${sectionText}\n`);
    if (!await vscode.workspace.applyEdit(we)) {
        vscode.window.showErrorMessage(`CL: Could not copy "${sectionName}" to ${pick.label}`);
        return;
    }
    vscode.window.showInformationMessage(`CL: Copied "${sectionName}" to ${pick.label}`);
}
