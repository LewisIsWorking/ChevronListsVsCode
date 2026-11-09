import type { LineReader } from './types';
import { parseBullet, parseNumbered } from './patterns';
import { splitItem } from './itemParts';

/** Priority levels */
export type PriorityLevel = 1 | 2 | 3;

/** A priority match found in item content */
export interface PriorityMatch {
    level:          PriorityLevel;
    contentWithout: string; // content with the priority marker stripped
}

/** Regex matching !, !!, !!! at start of item content */
export const PRIORITY_RE = /^(!{1,3}) /;

/** Parses priority marker from item content. Returns null if none present. */
export function parsePriority(content: string): PriorityMatch | null {
    // Through splitItem so a priority after a checkbox or star counts, and one among
    // the item's words does not. The first run of ! in the text is that one.
    if (splitItem(content).priority === '') { return null; }
    const match = content.match(/(?<!\S)(!{1,3}) /);
    if (!match) { return null; }
    const level = Math.min(match[1].length, 3) as PriorityLevel;
    return { level, contentWithout: content.slice(0, match.index) + content.slice(match.index! + match[0].length) };
}

/** Priority labels for display */
export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
    1: '! Low',
    2: '!! Medium',
    3: '!!! Critical',
};

export interface PriorityOccurrence {
    level:     PriorityLevel;
    content:   string;
    section:   string;
    line:      number;
}

/** Collects all priority items in a document */
export function collectPriorityItems(
    doc: LineReader,
    prefix: string
): PriorityOccurrence[] {
    const results: PriorityOccurrence[] = [];
    let section = '';

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (text.startsWith('> ') && !text.startsWith('>> ')) {
            section = text.replace(/^> /, '');
            continue;
        }
        const bullet   = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const priority = parsePriority(content);
        if (!priority) { continue; }
        results.push({ level: priority.level, content: priority.contentWithout, section, line: i });
    }
    return results;
}
