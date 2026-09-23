import type { LineReader, SectionRange } from './types';
import { isHeader, parseNumbered, parseBullet } from './patterns';
import { prevNumberInRun } from './numberingRuns';

/**
 * The number of the previous numbered item in the same list at this depth, or
 * 0 if lineIndex starts a list (so the first item becomes 1). A header or a
 * shallower line ends a list; see NumberingRuns.
 */
export function prevNumberAtDepth(
    doc: LineReader,
    lineIndex: number,
    chevrons: string
): number {
    return prevNumberInRun(doc, lineIndex, chevrons);
}

/**
 * Returns the inclusive [startLine, endLine] range for the chevron section
 * whose header is at headerLine. Ends just before the next header or EOF.
 * Includes blank lines and non-chevron content - used by hover, fold, select.
 */
export function getSectionRange(doc: LineReader, headerLine: number): SectionRange {
    let end = headerLine;
    for (let i = headerLine + 1; i < doc.lineCount; i++) {
        if (isHeader(doc.lineAt(i).text)) { break; }
        end = i;
    }
    return [headerLine, end];
}

/**
 * Returns the tight [startLine, endLine] range covering only the header and
 * its immediate chevron items. Stops at the last item line - blank lines,
 * dividers, and non-chevron content are NOT included.
 * Used by Move Section Up/Down so separators stay in place during a swap.
 */
export function getTightSectionRange(
    doc: LineReader,
    headerLine: number,
    prefix: string
): SectionRange {
    let end = headerLine;
    for (let i = headerLine + 1; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (isHeader(text)) { break; }
        if (parseBullet(text, prefix) !== null || parseNumbered(text) !== null) {
            end = i; // Only extend for actual chevron items
        } else if (text.trim() !== '') {
            break;   // Non-blank, non-chevron content ends the section
        }
        // Blank lines are skipped - they don't extend end but don't break either
    }
    return [headerLine, end];
}

/**
 * Finds the nearest header at or above fromLine.
 * Returns -1 if no header is found.
 */
export function findHeaderAbove(doc: LineReader, fromLine: number): number {
    for (let i = fromLine; i >= 0; i--) {
        if (isHeader(doc.lineAt(i).text)) { return i; }
    }
    return -1;
}

/**
 * Finds the next header strictly below fromLine.
 * Returns -1 if no header is found.
 */
export function findHeaderBelow(doc: LineReader, fromLine: number): number {
    for (let i = fromLine + 1; i < doc.lineCount; i++) {
        if (isHeader(doc.lineAt(i).text)) { return i; }
    }
    return -1;
}
