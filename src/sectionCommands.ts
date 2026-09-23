import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { findHeaderAbove, findHeaderBelow, getSectionRange, getTightSectionRange } from './documentUtils';
import { lineAfter, sectionContentEnd } from './lineEdits';

type EditBuilder = vscode.TextEditorEdit;

function getLines(doc: vscode.TextDocument, start: number, end: number): string[] {
    return Array.from({ length: end - start + 1 }, (_, i) => doc.lineAt(start + i).text);
}

/** Selects all chevron item lines under the nearest header above the cursor */
export function onSelectSectionItems(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const { prefix } = getConfig();
    const headerLine = findHeaderAbove(editor.document, editor.selection.active.line);
    if (headerLine < 0) { return; }
    const [, end] = getSectionRange(editor.document, headerLine);
    const selections: vscode.Selection[] = [];
    for (let i = headerLine + 1; i <= end; i++) {
        const text = editor.document.lineAt(i).text;
        if (parseBullet(text, prefix) || parseNumbered(text)) {
            const line = editor.document.lineAt(i);
            selections.push(new vscode.Selection(line.range.start, line.range.end));
        }
    }
    if (selections.length > 0) { editor.selections = selections; }
}

/** Deletes the entire section (header + items) containing the cursor */
export async function onDeleteSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const headerLine = findHeaderAbove(editor.document, editor.selection.active.line);
    if (headerLine < 0) { return; }
    const [start, end] = getSectionRange(editor.document, headerLine);
    const deleteStart  = new vscode.Position(start, 0);
    const deleteEnd    = end + 1 < editor.document.lineCount
        ? new vscode.Position(end + 1, 0)
        : new vscode.Position(end, editor.document.lineAt(end).text.length);
    await editor.edit((eb: EditBuilder) => eb.delete(new vscode.Range(deleteStart, deleteEnd)));
}

/** Duplicates the entire section containing the cursor, inserting it below */
export async function onDuplicateSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const headerLine = findHeaderAbove(editor.document, editor.selection.active.line);
    if (headerLine < 0) { return; }
    const doc          = editor.document;
    const [start, end] = getSectionRange(doc, headerLine);
    // Copy the header and its content, placed after the content with the same
    // blank-line spacing the section already has before whatever follows it.
    const contentEnd   = sectionContentEnd(doc, headerLine);
    const spacing      = getLines(doc, contentEnd + 1, end);
    const copy         = [...spacing, ...getLines(doc, start, contentEnd)];
    const ins          = lineAfter(doc, contentEnd, copy.join('\n'));
    await editor.edit((eb: EditBuilder) => eb.insert(ins.position, ins.text));
}

/** Swaps the section containing the cursor with the section immediately above it */
export async function onMoveSectionUp(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const doc        = editor.document;
    const { prefix } = getConfig();
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine <= 0) { return; }
    const prevHeader = findHeaderAbove(doc, headerLine - 1);
    if (prevHeader < 0) { return; }

    // Tight ranges - only header + chevron items, no separators
    const [curStart, curEnd]   = getTightSectionRange(doc, headerLine, prefix);
    const [prevStart, prevEnd] = getTightSectionRange(doc, prevHeader, prefix);

    // Gap = lines between the end of prev section and start of cur section
    const gapLines = getLines(doc, prevEnd + 1, curStart - 1);
    const curLines  = getLines(doc, curStart, curEnd);
    const prevLines = getLines(doc, prevStart, prevEnd);

    // Replace [prevStart, curEnd] with: curSection + gap + prevSection
    await editor.edit((eb: EditBuilder) => {
        const range = new vscode.Range(
            new vscode.Position(prevStart, 0),
            new vscode.Position(curEnd, doc.lineAt(curEnd).text.length)
        );
        eb.replace(range, [...curLines, ...gapLines, ...prevLines].join('\n'));
    });

    // Cursor follows the section to its new position
    const newPos = new vscode.Position(prevStart, 0);
    editor.selection = new vscode.Selection(newPos, newPos);
    editor.revealRange(new vscode.Range(newPos, newPos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/** Swaps the section containing the cursor with the section immediately below it */
export async function onMoveSectionDown(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const doc        = editor.document;
    const { prefix } = getConfig();
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { return; }
    const nextHeader = findHeaderBelow(doc, headerLine);
    if (nextHeader < 0) { return; }

    // Tight ranges - only header + chevron items, no separators
    const [curStart, curEnd]   = getTightSectionRange(doc, headerLine, prefix);
    const [nextStart, nextEnd] = getTightSectionRange(doc, nextHeader, prefix);

    // Gap = lines between the end of cur section and start of next section
    const gapLines  = getLines(doc, curEnd + 1, nextStart - 1);
    const curLines  = getLines(doc, curStart, curEnd);
    const nextLines = getLines(doc, nextStart, nextEnd);

    // Replace [curStart, nextEnd] with: nextSection + gap + curSection
    await editor.edit((eb: EditBuilder) => {
        const range = new vscode.Range(
            new vscode.Position(curStart, 0),
            new vscode.Position(nextEnd, doc.lineAt(nextEnd).text.length)
        );
        eb.replace(range, [...nextLines, ...gapLines, ...curLines].join('\n'));
    });

    // Cursor follows the section to its new position
    const newLine = curStart + nextLines.length + gapLines.length;
    const newPos  = new vscode.Position(newLine, 0);
    editor.selection = new vscode.Selection(newPos, newPos);
    editor.revealRange(new vscode.Range(newPos, newPos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}
