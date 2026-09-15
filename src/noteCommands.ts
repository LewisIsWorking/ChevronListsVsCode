import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { parseNote, getNoteLineForItem, buildNoteLine } from './noteParser';
import { lineAfter, wholeLineRange } from './lineEdits';

/** Command: toggles a note line on/off for the item at the cursor */
export async function onToggleNote(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const text       = doc.lineAt(lineIndex).text;
    const bullet     = parseBullet(text, prefix);
    const numbered   = parseNumbered(text);

    if (!bullet && !numbered) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item to toggle a note');
        return;
    }

    const chevrons  = bullet?.chevrons ?? numbered?.chevrons ?? '>>';
    const noteLine  = getNoteLineForItem(doc, lineIndex);

    await editor.edit(eb => {
        if (noteLine >= 0) {
            // Remove existing note
            eb.delete(wholeLineRange(doc, noteLine));
        } else {
            // Add a new note
            const ins = lineAfter(doc, lineIndex, buildNoteLine(chevrons, 'Note text here'));
            eb.insert(ins.position, ins.text);
        }
    });

    // If we just added a note, move cursor to it and select the placeholder text
    if (noteLine < 0) {
        const noteParsed = parseNote(doc.lineAt(lineIndex + 1).text);
        if (noteParsed) {
            const line       = doc.lineAt(lineIndex + 1);
            const noteStart  = line.text.indexOf('Note text here');
            const startPos   = new vscode.Position(lineIndex + 1, noteStart);
            const endPos     = new vscode.Position(lineIndex + 1, noteStart + 'Note text here'.length);
            editor.selection = new vscode.Selection(startPos, endPos);
            editor.revealRange(new vscode.Range(startPos, endPos));
        }
    }
}
