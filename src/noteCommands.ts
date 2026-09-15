import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getNoteLineForItem, buildNoteLine } from './noteParser';
import { lineAfter, wholeLineRange } from './lineEdits';

const NOTE_PLACEHOLDER = 'Note text here';

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

    const noteLine  = getNoteLineForItem(doc, lineIndex);
    if (noteLine >= 0) {
        await editor.edit(eb => eb.delete(wholeLineRange(doc, noteLine)));
        return;
    }

    // Add a new note, then select its placeholder text so typing replaces it
    const noteText  = buildNoteLine((bullet ?? numbered)!.chevrons, NOTE_PLACEHOLDER);
    const ins       = lineAfter(doc, lineIndex, noteText);
    await editor.edit(eb => eb.insert(ins.position, ins.text));

    const noteStart = noteText.indexOf(NOTE_PLACEHOLDER);
    const startPos  = new vscode.Position(ins.line, noteStart);
    const endPos    = new vscode.Position(ins.line, noteStart + NOTE_PLACEHOLDER.length);
    editor.selection = new vscode.Selection(startPos, endPos);
    editor.revealRange(new vscode.Range(startPos, endPos));
}
