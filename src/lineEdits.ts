import * as vscode from 'vscode';
import type { LineReader } from './types';
import { findHeaderAbove, getSectionRange } from './documentUtils';

/** An insertion that puts text on its own line(s), and where that text starts. */
export interface LineInsert {
    /** Pass to TextEditorEdit.insert or WorkspaceEdit.insert. */
    position: vscode.Position;
    /** Pass alongside `position`; line breaks are already added. */
    text: string;
    /** The line number the inserted text starts on, once applied. */
    line: number;
}

/**
 * The insertion that puts `text` as the line (or lines) directly after `line`.
 *
 * The obvious `insert(new vscode.Position(line + 1, 0), text + '\n')` is wrong
 * on the last line of a file that has no trailing newline: there is no line
 * `line + 1`, VS Code clamps the position to the end of the file, and the text
 * is glued onto the last line (">> - a>> - b"). Nearly thirty commands made
 * that insert.
 *
 * When the file does end with a newline its last line is empty, and the text
 * goes onto that empty line, exactly as the clamped insert did, so the file
 * keeps its trailing newline and gains no blank line.
 */
export function lineAfter(doc: LineReader, line: number, text: string): LineInsert {
    const last = doc.lineCount - 1;
    if (line < last) {
        return { position: new vscode.Position(line + 1, 0), text: text + '\n', line: line + 1 };
    }
    const lastText = doc.lineAt(last).text;
    if (lastText === '') {
        return { position: new vscode.Position(last, 0), text: text + '\n', line: last };
    }
    return { position: new vscode.Position(last, lastText.length), text: '\n' + text, line: last + 1 };
}

/**
 * The insertion that appends `text` as a new block at the end of the file, with
 * one blank line between it and the text before it.
 *
 * `deleted` lists the lines the same edit removes: the blank line is judged
 * against what will be left, so a block appended after a deleted section does
 * not get a second blank line, and one appended after text gets exactly one.
 */
export function appendBlock(doc: LineReader, text: string, deleted: Iterable<number>): LineInsert {
    const gone = new Set(deleted);
    const last = doc.lineCount - 1;
    // The empty line a trailing newline leaves is not a blank line anyone sees.
    let before = doc.lineAt(last).text === '' ? last - 1 : last;
    while (before >= 0 && gone.has(before)) { before--; }
    const needsGap = before >= 0 && doc.lineAt(before).text.trim() !== '';
    return lineAfter(doc, last, needsGap ? `\n${text}` : text);
}

/**
 * Ranges that delete `lines` entirely, line breaks included, without leaving a
 * blank line behind. Pass every line of one edit together: consecutive lines are
 * merged into one range, so the ranges never overlap.
 *
 * `doc.lineAt(line).rangeIncludingLineBreak` is not enough on the last line of a
 * file without a trailing newline: there is no break after it, so deleting it
 * left the break BEFORE it in place and the file ended with an empty line. The
 * run of lines that reaches the end of the file takes that preceding break
 * instead.
 */
export function wholeLineRanges(doc: LineReader, lines: Iterable<number>): vscode.Range[] {
    const sorted = [...new Set(lines)].sort((a, b) => a - b);
    const last   = doc.lineCount - 1;
    const ranges: vscode.Range[] = [];
    for (let i = 0; i < sorted.length; ) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) { j++; }
        const first = sorted[i], final = sorted[j];
        if (final < last) {
            ranges.push(new vscode.Range(first, 0, final + 1, 0));
        } else if (first < last && doc.lineAt(last).text === '') {
            // The run ends on the empty line a trailing newline leaves: delete up to
            // it, keeping the newline, rather than taking the break before the run.
            ranges.push(new vscode.Range(first, 0, last, 0));
        } else if (first === 0) {
            ranges.push(new vscode.Range(0, 0, final, doc.lineAt(final).text.length));
        } else {
            ranges.push(new vscode.Range(first - 1, doc.lineAt(first - 1).text.length, final, doc.lineAt(final).text.length));
        }
        i = j + 1;
    }
    return ranges;
}

/** The range that deletes one line entirely; see wholeLineRanges. */
export function wholeLineRange(doc: LineReader, line: number): vscode.Range {
    return wholeLineRanges(doc, [line])[0];
}

/**
 * The insertion for a whole new section block (a header and its lines) asked
 * for at `cursorLine`, and the line its header lands on.
 *
 * With the cursor on a header, or outside any section, the block goes at the
 * cursor line followed by a blank line. With the cursor inside a section it
 * goes after that section's content, after a blank line. Inserting a header in
 * the middle of a section used to hand every item below the cursor to the new
 * section.
 */
export function sectionBlockInsert(doc: LineReader, cursorLine: number, block: string[]): LineInsert {
    const headerLine = findHeaderAbove(doc, cursorLine);
    if (headerLine < 0 || headerLine === cursorLine) {
        // A blank line separates the block from what follows, unless that line is blank already.
        const gap = doc.lineAt(cursorLine).text.trim() === '' ? '' : '\n';
        return { position: new vscode.Position(cursorLine, 0), text: `${block.join('\n')}\n${gap}`, line: cursorLine };
    }
    const ins = lineAfter(doc, sectionContentEnd(doc, headerLine), ['', ...block].join('\n'));
    return { ...ins, line: ins.line + 1 };
}

/**
 * The last non-blank line of the section whose header is at `headerLine`: the
 * line a new item for the end of that section goes after.
 *
 * getSectionRange includes the blank lines that separate a section from the
 * next header, so appending after its end put the new item below the
 * separator, detached from its own list and pressed against the next header.
 */
export function sectionContentEnd(doc: LineReader, headerLine: number): number {
    let [, end] = getSectionRange(doc, headerLine);
    while (end > headerLine && doc.lineAt(end).text.trim() === '') { end--; }
    return end;
}
