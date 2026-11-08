import type { LineReader } from './types';
import { parseBullet, parseNumbered } from './patterns';
import { joinItem, splitItem } from './itemParts';

/** Regex matching ★N rating (1–5) in item content */
export const RATING_RE = /★([1-5])/;

/** Parses a star rating from item content */
export function parseRating(content: string): number | null {
    const match = splitItem(content).body.match(RATING_RE);
    return match ? Number(match[1]) : null;
}

function withoutRating(body: string): string {
    return body.replace(/★[1-5]\s*/g, '').trim();
}

/** Sets or replaces the ★N rating among the item's words, after any leading markers */
export function setRating(content: string, rating: number): string {
    const parts = splitItem(content);
    return joinItem({ ...parts, body: `★${rating} ${withoutRating(parts.body)}`.trim() });
}

/** Removes any ★N rating from item content */
export function removeRating(content: string): string {
    const parts = splitItem(content);
    return joinItem({ ...parts, body: withoutRating(parts.body) });
}

export interface RatedItem { content: string; rating: number; section: string; line: number; }

/** Collects all rated items in a document, sorted by rating descending */
export function collectRatedItems(doc: LineReader, prefix: string): RatedItem[] {
    const results: RatedItem[] = [];
    let section = '';
    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (text.startsWith('> ') && !text.startsWith('>> ')) { section = text.replace(/^> /, ''); continue; }
        const bullet   = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const rating = parseRating(content);
        if (rating === null) { continue; }
        results.push({ content: removeRating(content), rating, section, line: i });
    }
    return results.sort((a, b) => b.rating - a.rating);
}
