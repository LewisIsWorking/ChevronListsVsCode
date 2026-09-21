import * as vscode from 'vscode';
import { findHeaderAbove } from './documentUtils';
import { lineAfter, sectionContentEnd } from './lineEdits';

/** Command: duplicates the current section immediately below itself with (copy) suffix */
export async function onCloneSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const headerText  = doc.lineAt(headerLine).text;
    const name        = headerText.replace(/^> /, '').trim();
    // The header and its content, without the blank lines that separate the
    // section from whatever follows it
    const contentEnd  = sectionContentEnd(doc, headerLine);
    const sectionLines: string[] = [];
    for (let i = headerLine; i <= contentEnd; i++) {
        sectionLines.push(doc.lineAt(i).text);
    }

    // Build clone with (copy) suffix on header, after one blank separator line
    const cloneHeader    = `> ${name} (copy)`;
    const cloneLines     = ['', cloneHeader, ...sectionLines.slice(1)];
    const ins            = lineAfter(doc, contentEnd, cloneLines.join('\n'));

    await editor.edit(eb => eb.insert(ins.position, ins.text));

    // Jump to the cloned header, which follows the separator line
    const newHeaderLine = ins.line + 1;
    const pos = new vscode.Position(newHeaderLine, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    vscode.window.showInformationMessage(`CL: Cloned "${name}" → "${name} (copy)"`);
}
