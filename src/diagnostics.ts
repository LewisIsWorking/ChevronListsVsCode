import type { LineReader } from './types';
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { NumberingRuns } from './numberingRuns';

export interface DiagnosticIssue {
    line:    number;
    message: string;
    kind:    'duplicate-header' | 'duplicate-subheading' | 'empty-section' | 'bad-numbering';
}

/** Finds all diagnostic issues in a document */
export function collectIssues(doc: LineReader, prefix: string): DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = [];
    const seenHeaders     = new Map<string, number>(); // name → first line
    const seenSubheadings = new Map<string, number>(); // name → first line
    let lastHeaderLine     = -1;
    let lastHeaderHasItems = false;

    // Per list: track {line, num} of the previous numbered item
    const prevItem = new Map<number, { line: number; num: number }>();
    const runs     = new NumberingRuns();

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;

        // Detect duplicate ## markdown subheadings
        const subMatch = text.match(/^(#{1,6})\s+(.+)$/);
        if (subMatch && !isHeader(text)) {
            const subName = subMatch[2].trim().toLowerCase();
            if (seenSubheadings.has(subName)) {
                issues.push({ line: i, message: `Duplicate subheading "${subMatch[2].trim()}" (first at line ${(seenSubheadings.get(subName)! + 1)})`, kind: 'duplicate-subheading' });
            } else {
                seenSubheadings.set(subName, i);
            }
            continue;
        }

        if (isHeader(text)) {
            if (lastHeaderLine >= 0 && !lastHeaderHasItems) {
                issues.push({ line: lastHeaderLine, message: `Empty section - no items under this header`, kind: 'empty-section' });
            }
            const name = text.replace(/^> /, '').trim().toLowerCase();
            if (seenHeaders.has(name)) {
                issues.push({ line: i, message: `Duplicate section name "${text.replace(/^> /, '')}" (first at line ${(seenHeaders.get(name)! + 1)})`, kind: 'duplicate-header' });
            } else {
                seenHeaders.set(name, i);
            }
            lastHeaderLine     = i;
            lastHeaderHasItems = false;
            prevItem.clear();
            runs.visit(text);
            continue;
        }

        const run      = runs.visit(text);
        const numbered = parseNumbered(text);
        if (numbered) {
            lastHeaderHasItems = true;
            const key  = run!;
            const prev = prevItem.get(key);

            if (prev !== undefined) {
                const expected = prev.num + 1;
                if (numbered.num !== expected) {
                    // Flag the PREVIOUS item - it's the one that created
                    // the unexpected gap, not the current one.
                    issues.push({
                        line:    prev.line,
                        message: `Sequence break after this item: expected ${expected} next but found ${numbered.num}`,
                        kind:    'bad-numbering',
                    });
                }
            }

            prevItem.set(key, { line: i, num: numbered.num });
            continue;
        }

        if (parseBullet(text, prefix)) { lastHeaderHasItems = true; }
    }

    if (lastHeaderLine >= 0 && !lastHeaderHasItems) {
        issues.push({ line: lastHeaderLine, message: `Empty section - no items under this header`, kind: 'empty-section' });
    }

    return issues;
}
