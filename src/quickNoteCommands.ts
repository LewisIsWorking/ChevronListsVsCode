import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { joinItem, splitItem } from './itemParts';

/** Command: prompts for a note and appends it as // comment to the item at cursor */
export async function onAddQuickNote(): Promise<void> {
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

    const note = await vscode.window.showInputBox({
        prompt:      'Add a quick note (will be appended as // comment)',
        placeHolder: 'e.g. check with Lewis first',
    });
    if (!note?.trim()) { return; }

    const chevrons = bullet?.chevrons ?? numbered!.chevrons;
    const content  = bullet?.content  ?? numbered!.content;
    const num      = numbered?.num ?? null;
    // Replace any existing comment. The old one was cut at the first "//", so a URL
    // lost everything after "https:".
    const newContent  = joinItem({ ...splitItem(content), comment: note.trim() });
    const newLine     = num !== null
        ? `${chevrons} ${num}. ${newContent}`
        : `${chevrons} ${prefix} ${newContent}`;
    await editor.edit(eb => eb.replace(doc.lineAt(lineIndex).range, newLine));
}
