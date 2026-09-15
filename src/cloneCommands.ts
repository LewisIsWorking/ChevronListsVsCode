import * as vscode from 'vscode';
import { isHeader } from './patterns';
import { findHeaderAbove } from './documentUtils';
import { lineAfter, sectionContentEnd } from './lineEdits';

function revealLine(editor: vscode.TextEditor, lineIndex: number): void {
    const pos = new vscode.Position(lineIndex, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/** Command: duplicates the item at the cursor to the end of the same section */
export async function onCloneItem(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc       = editor.document;
    const lineIndex = editor.selection.active.line;
    const text      = doc.lineAt(lineIndex).text;

    if (!text.startsWith('>>')) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item to clone it');
        return;
    }

    const headerLine = findHeaderAbove(doc, lineIndex);
    if (headerLine < 0) { return; }
    const ins = lineAfter(doc, sectionContentEnd(doc, headerLine), text);
    await editor.edit(eb => eb.insert(ins.position, ins.text));
    revealLine(editor, ins.line);
}

/** Command: duplicates the item at the cursor to a chosen section */
export async function onCloneItemToSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc       = editor.document;
    const lineIndex = editor.selection.active.line;
    const text      = doc.lineAt(lineIndex).text;

    if (!text.startsWith('>>')) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item to clone it');
        return;
    }

    // Collect all headers as targets
    const headers: Array<{ label: string; lineIndex: number }> = [];
    for (let i = 0; i < doc.lineCount; i++) {
        const t = doc.lineAt(i).text;
        if (isHeader(t)) { headers.push({ label: t.replace(/^> /, ''), lineIndex: i }); }
    }

    const pick = await vscode.window.showQuickPick(
        headers.map(h => ({ label: h.label, lineIndex: h.lineIndex })),
        { placeHolder: 'Clone item to which section?' }
    );
    if (!pick) { return; }

    const ins = lineAfter(doc, sectionContentEnd(doc, pick.lineIndex), text);
    await editor.edit(eb => eb.insert(ins.position, ins.text));
    revealLine(editor, ins.line);
}
