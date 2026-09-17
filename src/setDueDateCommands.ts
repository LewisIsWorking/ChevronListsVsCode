import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, parseNaturalDate } from './patterns';
import { joinItem, splitItem } from './itemParts';

/** Command: sets or replaces the @YYYY-MM-DD due date on the item at the cursor */
export async function onSetDueDate(): Promise<void> {
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

    const input = await vscode.window.showInputBox({
        prompt:      'Set due date — ISO (2026-12-31), weekday (friday), relative (+7), or shorthand (today, tomorrow, next week)',
        placeHolder: 'e.g. friday or +14 or 2026-06-01',
        validateInput: v => parseNaturalDate(v.trim()) ? null : 'Unrecognised date — try: 2026-12-31, friday, +7, today',
    });
    if (!input?.trim()) { return; }

    const dateStr  = parseNaturalDate(input.trim())!;
    const chevrons = bullet?.chevrons ?? numbered!.chevrons;
    const content  = bullet?.content  ?? numbered!.content;
    const num      = numbered?.num ?? null;
    // The date goes at the end of the words, before any vote or comment: appended
    // after them it hid the vote ("idea +5 @date") or went inside the comment.
    const parts      = splitItem(content);
    const newContent = joinItem({ ...parts, body: `${parts.body.replace(/@\d{4}-\d{2}-\d{2}/, '')} @${dateStr}` });
    const newLine    = num !== null
        ? `${chevrons} ${num}. ${newContent}`
        : `${chevrons} ${prefix} ${newContent}`;
    await editor.edit(eb => eb.replace(doc.lineAt(lineIndex).range, newLine));
}
