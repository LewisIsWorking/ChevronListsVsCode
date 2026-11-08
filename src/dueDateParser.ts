import type { LineReader } from './types';
import { parseBullet, parseNumbered } from './patterns';
import { splitItem } from './itemParts';

/** A parsed due date item */
export interface DueDate {
    date:      Date;
    dateStr:   string;   // original YYYY-MM-DD string
    content:   string;   // item content without the @date marker
    section:   string;
    line:      number;
    overdue:   boolean;
}

/** Regex matching @YYYY-MM-DD in item content */
export const DATE_RE = /@(\d{4}-\d{2}-\d{2})/g;

/** Extracts the first @YYYY-MM-DD date from item content */
export function extractDate(content: string): { dateStr: string; contentWithout: string } | null {
    const match = splitItem(content).body.match(/@(\d{4}-\d{2}-\d{2})/);
    if (!match) { return null; }
    return {
        dateStr:      match[1],
        contentWithout: content.replace(match[0], '').replace(/\s{2,}/g, ' ').trim(),
    };
}

/** Returns true if a YYYY-MM-DD string represents a date before today */
export function isOverdue(dateStr: string, today: Date = new Date()): boolean {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return date < todayMidnight;
}

/** Collects all items with @YYYY-MM-DD dates, sorted chronologically */
export function collectDueDates(
    doc: LineReader,
    prefix: string,
    today: Date = new Date()
): DueDate[] {
    const results: DueDate[] = [];
    let section = '';

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (text.startsWith('> ') && !text.startsWith('>> ')) {
            section = text.replace(/^> /, '');
            continue;
        }
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const parsed = extractDate(content);
        if (!parsed) { continue; }
        const [y, m, d] = parsed.dateStr.split('-').map(Number);
        results.push({
            date:      new Date(y, m - 1, d),
            dateStr:   parsed.dateStr,
            content:   parsed.contentWithout,
            section,
            line:      i,
            overdue:   isOverdue(parsed.dateStr, today),
        });
    }

    return results.sort((a, b) => a.date.getTime() - b.date.getTime());
}
