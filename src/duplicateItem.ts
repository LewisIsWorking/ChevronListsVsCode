import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { applyItemCopy, itemCopyBelow } from './lineEdits';

/** Command: duplicates the item at the cursor directly below itself */
export async function onDuplicateItem(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const character  = editor.selection.active.character;
    const text       = doc.lineAt(lineIndex).text;
    const bullet     = parseBullet(text, prefix);
    const numbered   = parseNumbered(text);

    if (!bullet && !numbered) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item to duplicate it');
        return;
    }

    const copy = itemCopyBelow(doc, lineIndex, prefix, (numbered ?? bullet)!.content);
    await editor.edit(eb => applyItemCopy(eb, doc, copy));

    // Move cursor to the duplicate, keeping the column it was in before the edit
    const pos = new vscode.Position(copy.insert.line, character);
    editor.selection = new vscode.Selection(pos, pos);
}
