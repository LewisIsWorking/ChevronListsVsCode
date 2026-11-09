import * as vscode from 'vscode';
import { isHeader } from './patterns';
import { findHeaderAbove, getSectionRange } from './documentUtils';

/** Command: moves the current section to the first position in the file */
export async function onPinSectionToTop(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    // Find first header in the file
    let firstHeader = -1;
    for (let i = 0; i < doc.lineCount; i++) {
        if (isHeader(doc.lineAt(i).text)) { firstHeader = i; break; }
    }
    if (firstHeader === headerLine) {
        vscode.window.showInformationMessage('CL: Section is already at the top');
        return;
    }

    const [, end]       = getSectionRange(doc, headerLine);
    const sectionLines  = Array.from({ length: end - headerLine + 1 }, (_, k) => doc.lineAt(headerLine + k).text);
    // The last section of a file has no blank line of its own, so it takes the one
    // before it. Otherwise it landed against the next section, with a stray line at the end.
    const borrows = end === doc.lineCount - 1
        && doc.lineAt(end).text.trim() !== '' && doc.lineAt(headerLine - 1).text.trim() === '';
    const betweenEnd = borrows ? headerLine - 1 : headerLine;
    const between    = Array.from({ length: betweenEnd - firstHeader }, (_, k) => doc.lineAt(firstHeader + k).text);
    const newLines   = [...sectionLines, ...(borrows ? [''] : []), ...between];
    const range      = new vscode.Range(firstHeader, 0, end, doc.lineAt(end).text.length);
    await editor.edit(eb => eb.replace(range, newLines.join('\n')));

    const pos = new vscode.Position(firstHeader, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    vscode.window.showInformationMessage(`CL: "${sectionLines[0].replace(/^> /, '')}" pinned to top`);
}
