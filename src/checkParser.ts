import type { LineReader } from './types';
import { parseBullet, parseNumbered } from './patterns';
import { splitItem } from './itemParts';

/** State of a checkbox item */
export type CheckState = 'done' | 'todo' | 'none';

/** Parsed checkbox prefix from item content */
export interface CheckMatch {
    state:          CheckState;
    contentWithout: string; // content with the checkbox stripped
}

/** Regex matching [], [ ] or [x] at start of item content */
export const CHECK_RE = /^\[(x| ?)\] ?/i;

/** Parses the checkbox state from item content. Returns null if no checkbox present. */
export function parseCheck(content: string): CheckMatch | null {
    // Through splitItem so a box after a priority, star or colour label counts,
    // and one among the item's words does not. The first box in the text is that one.
    if (splitItem(content).check === '') { return null; }
    const match = content.match(/\[(x| ?)\] ?/i)!;
    return {
        state:          match[1].toLowerCase() === 'x' ? 'done' : 'todo',
        contentWithout: content.slice(0, match.index) + content.slice(match.index! + match[0].length),
    };
}

/** Toggles [x] to [ ] and vice versa in a full line of text */
export function toggleCheckLine(line: string, prefix: string): string | null {
    const bullet  = parseBullet(line, prefix);
    const numbered = parseNumbered(line);
    const content  = bullet?.content ?? numbered?.content ?? null;
    if (!content) { return null; }

    const check = parseCheck(content);
    const chevronPart = bullet
        ? `${bullet.chevrons} ${prefix} `
        : `${numbered!.chevrons} ${numbered!.num}. `;

    if (!check) {
        // No checkbox - add [ ]
        return `${chevronPart}[ ] ${content}`;
    }
    // Normalise [] → [ ] on first toggle; then cycle [ ] ↔ [x]
    const toggled = check.state === 'done' ? '[ ]' : '[x]';
    return `${chevronPart}${toggled} ${check.contentWithout}`;
}

/** Counts done and total checkbox items in a section (from startLine to endLine inclusive) */
export function countChecks(
    doc: LineReader,
    startLine: number,
    endLine:   number,
    prefix:    string
): { done: number; total: number } {
    let done = 0, total = 0;
    for (let i = startLine; i <= endLine; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const check = parseCheck(content);
        if (!check) { continue; }
        total++;
        if (check.state === 'done') { done++; }
    }
    return { done, total };
}
