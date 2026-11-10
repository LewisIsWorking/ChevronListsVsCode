/** A line a timer was started on, as it was at the time */
export interface TrackedLine { index: number; text: string; lineCount: number; }

/**
 * Finds a timed line after the document may have changed: where it was if unchanged,
 * else the nearest exact copy, else where it was if no lines were added or removed
 * (it was edited in place). Returns -1 when it cannot be told apart.
 */
export function findTrackedLine(lines: string[], tracked: TrackedLine): number {
    if (lines[tracked.index] === tracked.text) { return tracked.index; }
    let nearest = -1;
    lines.forEach((text, i) => {
        if (text !== tracked.text) { return; }
        // On a tie the later line wins: added lines push an item down
        if (nearest < 0 || Math.abs(i - tracked.index) <= Math.abs(nearest - tracked.index)) { nearest = i; }
    });
    if (nearest >= 0) { return nearest; }
    return lines.length === tracked.lineCount ? tracked.index : -1;
}

/** The text of every line of a document */
export function linesOf(doc: { lineCount: number; lineAt(i: number): { text: string } }): string[] {
    return Array.from({ length: doc.lineCount }, (_, i) => doc.lineAt(i).text);
}
