import * as vscode from 'vscode';
import { findHeaderAbove } from './documentUtils';

/** Command: folds all sections except the one under the cursor */
export async function onFocusSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    // Fold all — then unfold the current section
    const original = editor.selection;
    await vscode.commands.executeCommand('editor.foldAll');
    const pos = new vscode.Position(headerLine, 0);
    editor.selection = new vscode.Selection(pos, pos);
    await vscode.commands.executeCommand('editor.unfold');

    // Put the cursor back where it was. It used to be moved to the start of the
    // section's first line, losing the user's place.
    editor.selection = original;
    editor.revealRange(new vscode.Range(pos, original.active), vscode.TextEditorRevealType.InCenter);
}

/** Command: restores all folded sections */
export async function onUnfocusSection(): Promise<void> {
    await vscode.commands.executeCommand('editor.unfoldAll');
}
