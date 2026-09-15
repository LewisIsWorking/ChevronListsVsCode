import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';

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

    // The last line has no line after it to insert at; VS Code would clamp that
    // position to the end of the file and glue the copy onto the original.
    const isLastLine = lineIndex === doc.lineCount - 1;
    await editor.edit(eb => {
        if (isLastLine) { eb.insert(doc.lineAt(lineIndex).range.end, '\n' + text); }
        else            { eb.insert(new vscode.Position(lineIndex + 1, 0), text + '\n'); }
    });

    // Move cursor to the duplicate, keeping the column it was in before the edit
    const pos = new vscode.Position(lineIndex + 1, character);
    editor.selection = new vscode.Selection(pos, pos);
}
