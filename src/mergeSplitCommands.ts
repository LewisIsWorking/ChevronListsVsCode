import * as vscode from 'vscode';
import { getSectionRange } from './documentUtils';
import { findHeaderAbove } from './documentUtils';
import { sectionContentEnd } from './lineEdits';

/** Command: merges the current section with the one immediately below it */
export async function onMergeSectionBelow(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const [, currentEnd] = getSectionRange(doc, headerLine);
    const nextHeader     = currentEnd + 1;
    if (nextHeader >= doc.lineCount) {
        vscode.window.showInformationMessage('CL: No section below to merge with');
        return;
    }

    // Delete the blank lines after this section's content and the next header,
    // so the next section's items carry straight on. getSectionRange runs up to
    // the next header, so deleting from its end left those blanks mid-list.
    const contentEnd = sectionContentEnd(doc, headerLine);
    await editor.edit(eb => eb.delete(new vscode.Range(
        new vscode.Position(contentEnd + 1, 0),
        new vscode.Position(nextHeader + 1, 0),
    )));
}

/** Command: splits the current section at the cursor line */
export async function onSplitSectionHere(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc        = editor.document;
    const splitLine  = editor.selection.active.line;

    if (!doc.lineAt(splitLine).text.startsWith('>>')) {
        vscode.window.showInformationMessage('CL: Place cursor on an item line to split the section there');
        return;
    }

    const headerLine = findHeaderAbove(doc, splitLine);
    if (headerLine < 0) { return; }
    const originalName = doc.lineAt(headerLine).text.replace(/^> /, '');

    const newName = await vscode.window.showInputBox({
        prompt:      'Name for the new section',
        value:       `${originalName} (continued)`,
    });
    if (!newName?.trim()) { return; }

    await editor.edit(eb =>
        eb.insert(new vscode.Position(splitLine, 0), `> ${newName.trim()}\n`)
    );
}
