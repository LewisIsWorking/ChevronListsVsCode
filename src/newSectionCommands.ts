import * as vscode from 'vscode';
import { getConfig } from './config';
import { sectionBlockInsert } from './lineEdits';

/** Command: prompts for a name and inserts a new section at the cursor */
export async function onNewSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const name = await vscode.window.showInputBox({
        prompt:      'New section name',
        placeHolder: 'e.g. My Section',
    });
    if (!name?.trim()) { return; }

    const { prefix } = getConfig();
    const itemStart  = `>> ${prefix} `;
    // At a section boundary; see sectionBlockInsert. Positions come from the
    // insertion, not from the cursor, which the edit itself moves.
    const ins = sectionBlockInsert(editor.document, editor.selection.active.line, [`> ${name.trim()}`, itemStart]);
    await editor.edit(eb => eb.insert(ins.position, ins.text));

    // Place cursor at the end of the blank item line ready to type
    const pos = new vscode.Position(ins.line + 1, itemStart.length);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos));
}
