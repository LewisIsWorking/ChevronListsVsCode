import type { LineReader } from './types';
import { parseBullet, parseNumbered, addMonths, formatDate } from './patterns';

export type RecurrenceType = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceMatch {
    type:           RecurrenceType;
    contentWithout: string;
}

/** Regex matching @daily, @weekly, @monthly in item content */
export const RECURRENCE_RE = /@(daily|weekly|monthly)/i;

/** Parses a recurrence marker from item content */
export function parseRecurrence(content: string): RecurrenceMatch | null {
    const match = content.match(RECURRENCE_RE);
    if (!match) { return null; }
    return {
        type:           match[1].toLowerCase() as RecurrenceType,
        contentWithout: content.replace(match[0], '').replace(/\s{2,}/g, ' ').trim(),
    };
}

export interface RecurringItem {
    type:    RecurrenceType;
    content: string;
    section: string;
    line:    number;
}

/** Collects all recurring items in a document */
export function collectRecurringItems(doc: LineReader, prefix: string): RecurringItem[] {
    const results: RecurringItem[] = [];
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
        const rec = parseRecurrence(content);
        if (!rec) { continue; }
        results.push({ type: rec.type, content: rec.contentWithout, section, line: i });
    }
    return results;
}

/** Advances a YYYY-MM-DD date string by one recurrence period */
export function nextOccurrence(dateStr: string, type: RecurrenceType): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (type === 'daily')   { date.setDate(date.getDate() + 1); }
    if (type === 'weekly')  { date.setDate(date.getDate() + 7); }
    // addMonths clamps to the month's length; setMonth would overflow the 29th-31st
    // into the month after next (31 Jan -> 3 Mar), skipping a month entirely.
    const next = type === 'monthly' ? addMonths(date, 1) : date;
    return formatDate(next);
}
