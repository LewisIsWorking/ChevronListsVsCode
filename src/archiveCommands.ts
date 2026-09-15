import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { parseCheck } from './checkParser';
import { getSectionRange } from './documentUtils';
import { findHeaderAbove } from './documentUtils';
import { appendBlock, lineAfter, sectionContentEnd, wholeLineRanges } from './lineEdits';

const ARCHIVE_HEADER = '> Archive';

/** The line of the > Archive header, or -1 when there is none */
function findArchiveLine(document: vscode.TextDocument): number {
    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text;
        if (isHeader(text) && text.replace(/^> /, '').toLowerCase() === 'archive') {
            return i;
        }
    }
    return -1;
}

/** How many blank lines sit directly above `line` */
function blankLinesAbove(doc: vscode.TextDocument, line: number): number {
    let n = 0;
    while (line - n - 1 >= 0 && doc.lineAt(line - n - 1).text.trim() === '') { n++; }
    return n;
}

/** Command: moves all [x] done items from the current section to the Archive */
export async function onArchiveDoneItems(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const [, end] = getSectionRange(doc, headerLine);
    const doneLines: Array<{ lineIndex: number; text: string }> = [];

    for (let i = headerLine + 1; i <= end; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const check = parseCheck(content);
        if (check?.state === 'done') { doneLines.push({ lineIndex: i, text }); }
    }

    if (doneLines.length === 0) {
        vscode.window.showInformationMessage('CL: No done items found in this section');
        return;
    }

    const archiveLine = findArchiveLine(doc);
    if (headerLine === archiveLine) {
        vscode.window.showInformationMessage('CL: These items are already in the Archive');
        return;
    }
    const archived = doneLines.map(l => l.text).join('\n');

    await editor.edit(eb => {
        for (const range of wholeLineRanges(doc, doneLines.map(l => l.lineIndex))) { eb.delete(range); }
        // After the Archive's last item, not after the blank lines that end its
        // section; or a new Archive at the end of the file
        const ins = archiveLine >= 0
            ? lineAfter(doc, sectionContentEnd(doc, archiveLine), archived)
            : appendBlock(doc, `${ARCHIVE_HEADER}\n${archived}`, doneLines.map(l => l.lineIndex));
        eb.insert(ins.position, ins.text);
    });

    vscode.window.showInformationMessage(`CL: Archived ${doneLines.length} done item${doneLines.length === 1 ? '' : 's'}`);
}

/** Command: moves the entire current section to the Archive area */
export async function onArchiveSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    // Archived sections go straight after the Archive's items, so the Archive
    // itself, or a section already sitting there, has nowhere to move to.
    const archiveLine = findArchiveLine(doc);
    if (archiveLine >= 0 && archiveLine <= headerLine
        && sectionContentEnd(doc, archiveLine) + 1 >= headerLine - blankLinesAbove(doc, headerLine)) {
        vscode.window.showInformationMessage('CL: This section is already archived');
        return;
    }

    const headerText  = doc.lineAt(headerLine).text;
    const [, end]     = getSectionRange(doc, headerLine);
    const sectionText = Array.from({ length: sectionContentEnd(doc, headerLine) - headerLine + 1 }, (_, k) =>
        doc.lineAt(headerLine + k).text
    ).join('\n');
    const sectionLines = Array.from({ length: end - headerLine + 1 }, (_, k) => headerLine + k);

    await editor.edit(eb => {
        // The section and the blank lines after it go; the copy in the archive
        // takes only its content
        for (const range of wholeLineRanges(doc, sectionLines)) { eb.delete(range); }
        const ins = archiveLine >= 0
            ? lineAfter(doc, sectionContentEnd(doc, archiveLine), sectionText)
            : appendBlock(doc, `${ARCHIVE_HEADER}\n${sectionText}`, sectionLines);
        eb.insert(ins.position, ins.text);
    });

    vscode.window.showInformationMessage(`CL: Archived "${headerText.replace(/^> /, '')}"`);
}
