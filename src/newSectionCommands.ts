import * as vscode from 'vscode';
import { getConfig } from './config';

/** Command: prompts for a name and inserts a new section at the cursor */
export async function onNewSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const name = await vscode.window.showInputBox({
        prompt:      'New section name',
        placeHolder: 'e.g. My Section',
    });
    if (!name?.trim()) { return; }

    const { prefix }  = getConfig();
    // Read the cursor line BEFORE editing: the edit inserts lines at the cursor,
    // which moves the cursor down, so reading it afterwards is two lines off.
    const cursorLine  = editor.selection.active.line;
    const insertPos   = new vscode.Position(cursorLine, 0);
    const newContent  = `> ${name.trim()}\n>> ${prefix} `;

    await editor.edit(eb => eb.insert(insertPos, newContent + '\n'));

    // Place cursor at the end of the blank item line ready to type
    const itemLine = cursorLine + 1;
    const itemChar = `>> ${prefix} `.length;
    const pos      = new vscode.Position(itemLine, itemChar);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos));
}
