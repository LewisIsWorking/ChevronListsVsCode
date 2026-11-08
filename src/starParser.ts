import type { LineReader } from './types';
import { parseBullet, parseNumbered } from './patterns';
import { splitItem, joinItem } from './itemParts';

/** Regex matching a star marker at the start of item content */
export const STAR_RE = /^\* (.+)$/;

/** Parses a star marker from item content */
export function parseStar(content: string): { contentWithout: string } | null {
    const parts = splitItem(content);
    if (parts.marker !== '*' || !parts.body) { return null; }
    return { contentWithout: joinItem({ ...parts, marker: '' }) };
}

/** Returns item content with a star marker toggled on or off */
export function toggleStar(content: string): string {
    const star = parseStar(content);
    if (star) { return star.contentWithout; }
    const parts = splitItem(content);
    return parts.marker ? `* ${content}` : joinItem({ ...parts, marker: '*' });
}

export interface StarredItem {
    content: string;
    section: string;
    line:    number;
}

/** Collects all starred items in a document */
export function collectStarredItems(doc: LineReader, prefix: string): StarredItem[] {
    const results: StarredItem[] = [];
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
        if (parseStar(content)) {
            results.push({ content: parseStar(content)!.contentWithout, section, line: i });
        }
    }
    return results;
}
