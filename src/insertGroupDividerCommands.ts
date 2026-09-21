import * as vscode from 'vscode';
import { lineAfter } from './lineEdits';

/** Command: inserts a >> -- Name group divider below the cursor line */
export async function onInsertGroupDivider(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const name = await vscode.window.showInputBox({
        prompt:      'Group divider name',
        placeHolder: 'e.g. Act One, Phase 2, Backlog…',
    });
    if (!name?.trim()) { return; }

    const doc     = editor.document;
    const divider = `>> -- ${name.trim()}`;
    const ins     = lineAfter(doc, editor.selection.active.line, divider);
    await editor.edit(eb => eb.insert(ins.position, ins.text));

    // Place cursor after the inserted divider: the start of the following line,
    // or the end of the divider when it is now the last line
    const newPos = ins.line + 1 < doc.lineCount
        ? new vscode.Position(ins.line + 1, 0)
        : new vscode.Position(ins.line, divider.length);
    editor.selection = new vscode.Selection(newPos, newPos);
    vscode.window.showInformationMessage(`CL: Inserted group "-- ${name.trim()}"`);
}
