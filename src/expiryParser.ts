import type { LineReader } from './types';
import { parseBullet, parseNumbered } from './patterns';
import { splitItem } from './itemParts';

/** Regex matching @expires:YYYY-MM-DD in item content */
export const EXPIRES_RE = /@expires:(\d{4}-\d{2}-\d{2})/;

/** Parses an expiry date from item content */
export function parseExpiry(content: string): string | null {
    return splitItem(content).body.match(EXPIRES_RE)?.[1] ?? null;
}

/** Returns true if the given YYYY-MM-DD date is in the past */
export function isExpired(dateStr: string, today: Date = new Date()): boolean {
    const [y, m, d] = dateStr.split('-').map(Number);
    const expiry    = new Date(y, m - 1, d);
    const todayMid  = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return expiry < todayMid;
}

export interface ExpiredItem { content: string; dateStr: string; section: string; line: number; }

/** Collects all expired items in a document */
export function collectExpiredItems(doc: LineReader, prefix: string): ExpiredItem[] {
    const results: ExpiredItem[] = [];
    let section = '';
    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (text.startsWith('> ') && !text.startsWith('>> ')) { section = text.replace(/^> /, ''); continue; }
        const bullet   = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const dateStr = parseExpiry(content);
        if (!dateStr || !isExpired(dateStr)) { continue; }
        results.push({ content: content.replace(EXPIRES_RE, '').trim(), dateStr, section, line: i });
    }
    return results;
}
