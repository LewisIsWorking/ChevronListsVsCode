import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, incrementFirstNumber } from './patterns';
import { applyItemCopy, itemCopyBelow } from './lineEdits';

/** Command: duplicates item below itself with the first number in content incremented */
export async function onDuplicateItemAndIncrement(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const text       = doc.lineAt(lineIndex).text;
    const bullet     = parseBullet(text, prefix);
    const numbered   = parseNumbered(text);

    if (!bullet && !numbered) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item');
        return;
    }

    const content    = (numbered ?? bullet)!.content;
    const newContent = incrementFirstNumber(content) ?? content;

    const character = editor.selection.active.character;
    const copy      = itemCopyBelow(doc, lineIndex, prefix, newContent);
    await editor.edit(eb => applyItemCopy(eb, doc, copy));

    const pos = new vscode.Position(copy.insert.line, character);
    editor.selection = new vscode.Selection(pos, pos);
}
