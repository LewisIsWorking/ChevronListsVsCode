import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { wholeLineRange } from './lineEdits';

/** Command: joins the item at the cursor with the item below it */
export async function onMergeItemWithNext(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const text       = doc.lineAt(lineIndex).text;
    const nextIndex  = lineIndex + 1;

    if (nextIndex >= doc.lineCount) {
        vscode.window.showInformationMessage('CL: No item below to merge with');
        return;
    }

    const bullet    = parseBullet(text, prefix);
    const numbered  = parseNumbered(text);
    if (!bullet && !numbered) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item');
        return;
    }

    const nextText    = doc.lineAt(nextIndex).text;
    const nextBullet  = parseBullet(nextText, prefix);
    const nextNumbered = parseNumbered(nextText);
    if (!nextBullet && !nextNumbered) {
        vscode.window.showInformationMessage('CL: Next line is not a chevron item');
        return;
    }

    const chevrons    = bullet?.chevrons  ?? numbered!.chevrons;
    const contentA    = bullet?.content   ?? numbered!.content;
    const contentB    = nextBullet?.content ?? nextNumbered!.content;
    const num         = numbered?.num ?? null;
    const mergedContent = `${contentA.trim()} - ${contentB.trim()}`;
    const newLine       = num !== null
        ? `${chevrons} ${num}. ${mergedContent}`
        : `${chevrons} ${prefix} ${mergedContent}`;

    const deleteRange = wholeLineRange(doc, nextIndex);
    await editor.edit(eb => {
        eb.replace(doc.lineAt(lineIndex).range, newLine);
        eb.delete(deleteRange);
    });
}
