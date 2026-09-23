import * as vscode from 'vscode';
import { findHeaderAbove, getSectionRange } from './documentUtils';
import { lineAfter, wholeLineRange } from './lineEdits';

const FROZEN_MARKER = '>> [frozen]';

/** Command: marks the current section as frozen with >> [frozen] */
export async function onFreezeSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const [, end] = getSectionRange(doc, headerLine);
    // Check if already frozen
    for (let i = headerLine + 1; i <= end; i++) {
        if (doc.lineAt(i).text === FROZEN_MARKER) {
            vscode.window.showInformationMessage('CL: Section is already frozen');
            return;
        }
    }
    const ins = lineAfter(doc, headerLine, FROZEN_MARKER);
    await editor.edit(eb => eb.insert(ins.position, ins.text));
    vscode.window.showInformationMessage('CL: Section frozen - edits will show a warning');
}

/** Command: removes the frozen marker from the current section */
export async function onUnfreezeSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const [, end] = getSectionRange(doc, headerLine);
    for (let i = headerLine + 1; i <= end; i++) {
        if (doc.lineAt(i).text === FROZEN_MARKER) {
            await editor.edit(eb => eb.delete(wholeLineRange(doc, i)));
            vscode.window.showInformationMessage('CL: Section unfrozen');
            return;
        }
    }
    vscode.window.showInformationMessage('CL: Section is not frozen');
}

/** Checks if the section containing the given line is frozen */
export function isSectionFrozen(doc: vscode.TextDocument, lineIndex: number): boolean {
    const headerLine = findHeaderAbove(doc, lineIndex);
    if (headerLine < 0) { return false; }
    const [, end] = getSectionRange(doc, headerLine);
    for (let i = headerLine + 1; i <= end; i++) {
        if (doc.lineAt(i).text === FROZEN_MARKER) { return true; }
    }
    return false;
}
