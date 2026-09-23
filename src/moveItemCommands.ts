import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered } from './patterns';

/** The document after a move, and the line the moved item now starts on */
export interface MoveResult { lines: string[]; newIndex: number }

/** The chevron depth of an item line, or null if the line is not an item */
function depthOf(line: string, prefix: string): number | null {
    const item = parseNumbered(line) ?? parseBullet(line, prefix);
    return item ? item.chevrons.length : null;
}

/** The last line of the block starting at `index`: the item plus anything nested under it */
function blockEnd(lines: string[], index: number, depth: number, last: number, prefix: string): number {
    let end = index;
    for (let i = index + 1; i <= last; i++) {
        const d = depthOf(lines[i], prefix);
        if (d === null || d <= depth) { break; }
        end = i;
    }
    return end;
}

/**
 * Pure: moves the item at `index` one place up (or down) among its siblings,
 * carrying anything nested under it. Null when there is nothing to do: the line
 * is not an item, or it is already the first or last sibling in its section.
 *
 * It used to swap single lines with the adjacent item line of any depth, so
 * moving a parent down put it below its own child. Items never cross a header,
 * and numbered items keep their numbers for the numbering fixer. Mirrors
 * computeMoveItem in the JetBrains plugin.
 */
export function moveItemBlock(lines: string[], index: number, up: boolean, prefix: string): MoveResult | null {
    if (index < 0 || index >= lines.length) { return null; }
    const depth = depthOf(lines[index], prefix);
    if (depth === null) { return null; }

    let first = 0;
    for (let i = index; i >= 0; i--) { if (isHeader(lines[i])) { first = i + 1; break; } }
    let last = lines.length - 1;
    for (let i = index + 1; i < lines.length; i++) { if (isHeader(lines[i])) { last = i - 1; break; } }

    const end   = blockEnd(lines, index, depth, last, prefix);
    const block = lines.slice(index, end + 1);
    const rest  = [...lines.slice(0, index), ...lines.slice(end + 1)];

    if (up) {
        let sibling = -1;
        for (let i = index - 1; i >= first; i--) {
            const d = depthOf(lines[i], prefix);
            if (d === null) { continue; }
            if (d < depth) { break; }
            if (d === depth) { sibling = i; break; }
        }
        if (sibling < 0) { return null; }
        rest.splice(sibling, 0, ...block);
        return { lines: rest, newIndex: sibling };
    }

    let sibling = -1;
    for (let i = end + 1; i <= last; i++) {
        const d = depthOf(lines[i], prefix);
        if (d === null) { continue; }
        if (d < depth) { break; }
        if (d === depth) { sibling = i; break; }
    }
    if (sibling < 0) { return null; }
    const insertAt = blockEnd(lines, sibling, depth, last, prefix) - block.length + 1;
    rest.splice(insertAt, 0, ...block);
    return { lines: rest, newIndex: insertAt };
}

/** Applies a move: rewrites only the lines that changed, then follows the item with the cursor */
async function moveItem(up: boolean): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    if (depthOf(doc.lineAt(lineIndex).text, prefix) === null) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item to move it'); return;
    }

    const before: string[] = [];
    for (let i = 0; i < doc.lineCount; i++) { before.push(doc.lineAt(i).text); }
    const result = moveItemBlock(before, lineIndex, up, prefix);
    if (!result) { return; }

    let first = 0;
    while (before[first] === result.lines[first]) { first++; }
    let last = before.length - 1;
    while (before[last] === result.lines[last]) { last--; }

    const character = editor.selection.active.character;
    const range = new vscode.Range(doc.lineAt(first).range.start, doc.lineAt(last).range.end);
    await editor.edit(eb => eb.replace(range, result.lines.slice(first, last + 1).join('\n')));
    const pos = new vscode.Position(result.newIndex, character);
    editor.selection = new vscode.Selection(pos, pos);
}

/** Command: moves the item at the cursor, with its nested items, above the previous item at its depth */
export function onMoveItemUp(): Promise<void> { return moveItem(true); }

/** Command: moves the item at the cursor, with its nested items, below the next item at its depth */
export function onMoveItemDown(): Promise<void> { return moveItem(false); }
