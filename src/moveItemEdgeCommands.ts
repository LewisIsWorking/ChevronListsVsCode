import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { findHeaderAbove } from './documentUtils';
import { lineAfter, sectionContentEnd, wholeLineRange } from './lineEdits';

/** Command: moves the item at the cursor to the first position in the section */
export async function onMoveItemToTop(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const text       = doc.lineAt(lineIndex).text;
    if (!parseBullet(text, prefix) && !parseNumbered(text)) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item'); return;
    }
    const headerLine = findHeaderAbove(doc, lineIndex);
    if (headerLine < 0 || lineIndex === headerLine + 1) { return; }
    // Read the column before editing: deleting the cursor's line moves the cursor
    const character = editor.selection.active.character;
    await editor.edit(eb => {
        eb.delete(wholeLineRange(doc, lineIndex));
        eb.insert(new vscode.Position(headerLine + 1, 0), text + '\n');
    });
    const pos = new vscode.Position(headerLine + 1, character);
    editor.selection = new vscode.Selection(pos, pos);
}

/** Command: moves the item at the cursor to the last position in the section */
export async function onMoveItemToBottom(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const text       = doc.lineAt(lineIndex).text;
    if (!parseBullet(text, prefix) && !parseNumbered(text)) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item'); return;
    }
    const headerLine = findHeaderAbove(doc, lineIndex);
    if (headerLine < 0) { return; }
    // The last item, not the last line: the section's range includes the blank
    // lines that separate it from the next header
    const end = sectionContentEnd(doc, headerLine);
    if (lineIndex === end) { return; }
    const character = editor.selection.active.character;
    const ins       = lineAfter(doc, end, text);
    await editor.edit(eb => {
        eb.delete(wholeLineRange(doc, lineIndex));
        eb.insert(ins.position, ins.text);
    });
    // The item's old line, above, is gone, so the moved item sits one line higher
    const pos = new vscode.Position(ins.line - 1, character);
    editor.selection = new vscode.Selection(pos, pos);
}
