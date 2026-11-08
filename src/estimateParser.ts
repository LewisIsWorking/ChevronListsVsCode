import type { LineReader } from './types';
import { parseBullet, parseNumbered } from './patterns';

/** Regex matching ~Nh, ~Nm, ~NhNm time estimates */
export const ESTIMATE_RE = /~(\d+h)?(\d+m)?(?=\s|$)/;

export interface TimeEstimate {
    hours:          number;
    minutes:        number;
    totalMinutes:   number;
    display:        string;
    contentWithout: string;
}

/** Parses a ~Nh~Nm time estimate from item content */
export function parseEstimate(content: string): TimeEstimate | null {
    const match = content.match(/~(\d+h(?:\d+m)?|\d+m)/);
    if (!match || !match[1]) { return null; }
    const hours   = parseInt(match[1].match(/(\d+)h/)?.[1] ?? '0', 10);
    const minutes = parseInt(match[1].match(/(\d+)m/)?.[1] ?? '0', 10);
    if (hours === 0 && minutes === 0) { return null; }
    const display        = hours && minutes ? `${hours}h${minutes}m` : hours ? `${hours}h` : `${minutes}m`;
    const contentWithout = content.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();
    return { hours, minutes, totalMinutes: hours * 60 + minutes, display, contentWithout };
}

export interface EstimatedItem {
    estimate:    TimeEstimate;
    content:     string;
    section:     string;
    line:        number;
}

/** Collects all time-estimated items in a document, sorted by duration */
export function collectEstimatedItems(doc: LineReader, prefix: string): EstimatedItem[] {
    const results: EstimatedItem[] = [];
    let section = '';
    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (text.startsWith('> ') && !text.startsWith('>> ')) { section = text.replace(/^> /, ''); continue; }
        const bullet   = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const estimate = parseEstimate(content);
        if (!estimate) { continue; }
        results.push({ estimate, content: estimate.contentWithout, section, line: i });
    }
    return results.sort((a, b) => b.estimate.totalMinutes - a.estimate.totalMinutes);
}

/** Sums total estimated minutes across a set of items */
export function totalEstimatedMinutes(items: EstimatedItem[]): number {
    return items.reduce((acc, i) => acc + i.estimate.totalMinutes, 0);
}
