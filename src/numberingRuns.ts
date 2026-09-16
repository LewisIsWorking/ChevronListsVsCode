import type { LineReader } from './types';
import { isHeader, parseNumbered } from './patterns';

/** A line's chevron depth (">>" is 2), or null for a line that is not a chevron line. */
function chevronDepth(text: string): number | null {
    const m = /^(>{2,}) \S/.exec(text);
    return m ? m[1].length : null;
}

/**
 * Which numbered list ("run") each numbered item belongs to.
 *
 * Numbered items at the same depth continue one list until a header, or a
 * chevron line SHALLOWER than them, interrupts it. So the children of two
 * different parents are two lists, each starting at 1, as in any outline:
 *
 *     >> 1. a
 *     >>> 1. a1
 *     >> 2. b
 *     >>> 1. b1     <- a new list, not "2."
 *
 * Every numbering feature used to key lists by depth alone, across the whole
 * section. Diagnostics then flagged b1 as out of sequence, auto-fix (on by
 * default) renumbered it to 2 as the user typed, and Renumber, Rebase and Set
 * List Start did the same.
 *
 * Feed every line in document order to `visit`.
 */
export class NumberingRuns {
    private readonly runs = new Map<number, number>();
    private nextRun = 0;

    /**
     * Records `text` and returns the run of the numbered item on it, or null
     * when the line is not a numbered item. `asNumbered` treats a non-numbered
     * chevron line as if it were numbered, for commands that are about to
     * number it.
     */
    visit(text: string, asNumbered = false): number | null {
        if (isHeader(text)) { this.runs.clear(); return null; }
        const depth = chevronDepth(text);
        if (depth === null) { return null; }
        for (const d of [...this.runs.keys()]) {
            if (d > depth) { this.runs.delete(d); }
        }
        if (!asNumbered && !parseNumbered(text)) { return null; }
        if (!this.runs.has(depth)) { this.runs.set(depth, this.nextRun++); }
        return this.runs.get(depth)!;
    }
}

/**
 * The number of the numbered item before `lineIndex` in the same list at depth
 * `chevrons`, or 0 when `lineIndex` would start a new list (so it becomes 1).
 * Stops at a header or at a line shallower than `chevrons`.
 */
export function prevNumberInRun(doc: LineReader, lineIndex: number, chevrons: string): number {
    for (let i = lineIndex - 1; i >= 0; i--) {
        const text  = doc.lineAt(i).text;
        if (isHeader(text)) { break; }
        const depth = chevronDepth(text);
        if (depth === null || depth > chevrons.length) { continue; }
        if (depth < chevrons.length) { break; }
        const match = parseNumbered(text);
        if (match) { return match.num; }
    }
    return 0;
}

/**
 * The replacements that add `by` to the number of every item after `lineIndex`
 * in its list at depth `chevrons`: what keeps a list in sequence when `by`
 * numbered items are inserted straight after `lineIndex`.
 */
export function renumberFollowing(doc: LineReader, lineIndex: number, chevrons: string, by: number): { line: number; text: string }[] {
    const edits: { line: number; text: string }[] = [];
    if (by === 0) { return edits; }
    for (let i = nextInRun(doc, lineIndex, chevrons); i >= 0; i = nextInRun(doc, i, chevrons)) {
        const n = parseNumbered(doc.lineAt(i).text)!;
        edits.push({ line: i, text: `${n.chevrons} ${n.num + by}. ${n.content}` });
    }
    return edits;
}

/**
 * The line of the next numbered item after `lineIndex` in the same list at
 * depth `chevrons`, or -1 when the list ends first.
 */
export function nextInRun(doc: LineReader, lineIndex: number, chevrons: string): number {
    for (let i = lineIndex + 1; i < doc.lineCount; i++) {
        const text  = doc.lineAt(i).text;
        if (isHeader(text)) { break; }
        const depth = chevronDepth(text);
        if (depth === null || depth > chevrons.length) { continue; }
        if (depth < chevrons.length) { break; }
        if (parseNumbered(text)) { return i; }
    }
    return -1;
}
