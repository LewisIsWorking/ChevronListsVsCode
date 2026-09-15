import * as vscode from 'vscode';
import { getConfig } from './config';
import { toggleCheckLine, parseCheck } from './checkParser';
import { findHeaderAbove, getSectionRange } from './documentUtils';
import { countChecks } from './checkParser';
import { appendBlock, lineAfter, wholeLineRanges } from './lineEdits';

/**
 * Moves completed items to the top of the > Archive section, creating it if needed.
 *
 * All the items move in one edit, in document order. They used to move one at a
 * time from the bottom up, reusing line numbers read before any move: when the
 * Archive was above the items, each insertion shifted the lines below it, so
 * later moves deleted the wrong line.
 */
async function autoArchiveLines(editor: vscode.TextEditor, lines: number[]): Promise<void> {
    const doc = editor.document;
    let   archiveLine = -1;

    for (let i = 0; i < doc.lineCount; i++) {
        if (doc.lineAt(i).text.toLowerCase() === '> archive') { archiveLine = i; break; }
    }

    // Items already in the Archive section stay where they are.
    const [archiveStart, archiveEnd] = archiveLine >= 0 ? getSectionRange(doc, archiveLine) : [-1, -1];
    const toMove = [...new Set(lines)].filter(l => l < archiveStart || l > archiveEnd).sort((a, b) => a - b);
    if (toMove.length === 0) { return; }
    const items = toMove.map(l => doc.lineAt(l).text).join('\n');

    await editor.edit(eb => {
        for (const range of wholeLineRanges(doc, toMove)) { eb.delete(range); }
        const ins = archiveLine >= 0
            ? lineAfter(doc, archiveLine, items)
            : appendBlock(doc, `> Archive\n${items}`, toMove);
        eb.insert(ins.position, ins.text);
    });
}

/** Command: toggles [x]/[ ] on the item at the cursor; auto-archives if enabled */
export async function onToggleItemDone(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix, autoArchive } = getConfig();
    const doc                     = editor.document;
    const linesToArchive: number[] = [];

    await editor.edit(eb => {
        for (const sel of editor.selections) {
            const lineIndex = sel.active.line;
            const text      = doc.lineAt(lineIndex).text;
            const toggled   = toggleCheckLine(text, prefix);
            if (toggled !== null) {
                eb.replace(doc.lineAt(lineIndex).range, toggled);
                if (autoArchive && parseCheck(toggled.replace(/^(>{2,}) [^ ]+ /, ''))?.state === 'done') {
                    linesToArchive.push(lineIndex);
                }
            }
        }
    });

    if (linesToArchive.length > 0) {
        await autoArchiveLines(editor, linesToArchive);
    }
}

/** Returns a status string like "3/5 done" for the section containing the cursor, or null */
export function getSectionCheckStatus(
    document: vscode.TextDocument,
    cursorLine: number,
    prefix: string
): string | null {
    const headerLine = findHeaderAbove(document, cursorLine);
    if (headerLine < 0) { return null; }
    const [start, end] = getSectionRange(document, headerLine);
    const { done, total } = countChecks(document, start, end, prefix);
    if (total === 0) { return null; }
    return `${done}/${total} done`;
}
