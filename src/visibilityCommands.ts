import * as vscode from 'vscode';
import { findHeaderAbove } from './documentUtils';
import { lineAfter, wholeLineRanges } from './lineEdits';

const HIDDEN_MARKER = '>> [hidden]';

/** Returns true if the section at headerLine is hidden */
function isSectionHidden(document: vscode.TextDocument, headerLine: number): boolean {
    if (headerLine + 1 >= document.lineCount) { return false; }
    return document.lineAt(headerLine + 1).text === HIDDEN_MARKER;
}

/** Command: marks the current section as hidden and folds it */
export async function onHideSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    if (isSectionHidden(doc, headerLine)) {
        vscode.window.showInformationMessage('CL: Section is already hidden');
        return;
    }

    const ins = lineAfter(doc, headerLine, HIDDEN_MARKER);
    await editor.edit(eb => eb.insert(ins.position, ins.text));
    // Fold the section
    const pos = new vscode.Position(headerLine, 0);
    editor.selection = new vscode.Selection(pos, pos);
    await vscode.commands.executeCommand('editor.fold');
    vscode.window.showInformationMessage('CL: Section hidden - use CL: Show Hidden Sections to reveal');
}

/** Command: removes all hidden markers and unfolds sections */
export async function onShowHiddenSections(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc     = editor.document;
    const markers: number[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
        if (doc.lineAt(i).text === HIDDEN_MARKER) { markers.push(i); }
    }
    const count = markers.length;

    await editor.edit(eb => {
        for (const range of wholeLineRanges(doc, markers)) { eb.delete(range); }
    });

    if (count > 0) {
        await vscode.commands.executeCommand('editor.unfoldAll');
        vscode.window.showInformationMessage(`CL: Revealed ${count} hidden section${count === 1 ? '' : 's'}`);
    } else {
        vscode.window.showInformationMessage('CL: No hidden sections found');
    }
}

/** Returns true if a section at headerLine should be excluded from exports */
export function isSectionExcluded(document: vscode.TextDocument, headerLine: number): boolean {
    return isSectionHidden(document, headerLine);
}
