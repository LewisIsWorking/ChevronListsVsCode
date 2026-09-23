/**
 * patternsExtra.ts
 * Additional pure utilities - split from patternsExport.ts to stay under 200 lines.
 * Re-exported by patterns.ts so callers use a single import.
 */
import { extractTags } from './tagParser';
import { extractMentions } from './mentionParser';
import { CHECK_RE } from './checkParser';
import { PRIORITY_RE } from './priorityParser';
import { parseEstimate } from './estimateParser';
import { parseVote } from './voteParser';

/** Pure: extracts due date string from content for sorting, or high sentinel for undated */
export function extractSortDate(content: string): string {
    return content.match(/@(\d{4}-\d{2}-\d{2})/)?.[1] ?? '9999-99-99';
}

/** Pure: escapes a value for CSV output */
export function csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

/** Pure: returns true if content is overdue by more than 7 days */
export function isEscalatable(content: string, today: Date = new Date()): boolean {
    const m = content.match(/@(\d{4}-\d{2}-\d{2})/);
    if (!m) { return false; }
    const [y, mo, d] = m[1].split('-').map(Number);
    const due        = new Date(y, mo - 1, d);
    const todayMid   = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.floor((todayMid.getTime() - due.getTime()) / 86400000) > 7;
}

/** Pure: parses a ~Nh/~Nm/~NhNm estimate string to total minutes */
export function parseEstimateToMinutes(content: string): number {
    const match = content.match(/~(\d+h)?(\d+m)?/);
    if (!match || (!match[1] && !match[2])) { return 0; }
    return (match[1] ? parseInt(match[1]) : 0) * 60 + (match[2] ? parseInt(match[2]) : 0);
}

/** Pure: formats total minutes as a readable string */
export function formatTotalMinutes(total: number): string {
    if (total === 0)  { return '0m'; }
    if (total < 60)   { return `${total}m`; }
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Pure: collects item count per section from document lines */
export interface SectionCount { name: string; count: number; }

export function collectSectionCounts(lines: Array<{ text: string }>, prefix: string): SectionCount[] {
    const HEADER_RE = /^> [^>]/;
    const BULLET_RE = new RegExp(`^(>{2,}) ${prefix === '-' ? '-' : prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (.*)$`);
    const NUM_RE    = /^(>{2,}) \d+\. (.*)$/;
    const results: SectionCount[] = [];
    let name  = '', count = 0;
    for (const { text } of lines) {
        if (HEADER_RE.test(text)) {
            if (name) { results.push({ name, count }); }
            name  = text.replace(/^> /, '').replace(/\s*==\d+/, '').replace(/\s*\[colour:[^\]]+\]/gi, '').trim();
            count = 0;
        } else if (BULLET_RE.test(text) || NUM_RE.test(text)) {
            count++;
        }
    }
    if (name) { results.push({ name, count }); }
    return results.sort((a, b) => b.count - a.count);
}

/** Pure: groups item lines by first @Name mention */
export function groupLinesByMention(
    items: Array<{ text: string; index: number }>,
    prefix: string
): Map<string, Array<{ text: string; index: number }>> {
    const groups     = new Map<string, Array<{ text: string; index: number }>>();
    const untagged:  Array<{ text: string; index: number }> = [];
    for (const item of items) {
        const [name] = extractMentions(item.text);
        if (name) {
            if (!groups.has(name)) { groups.set(name, []); }
            groups.get(name)!.push(item);
        } else {
            untagged.push(item);
        }
    }
    if (untagged.length > 0) { groups.set('Unassigned', untagged); }
    return groups;
}

/** Pure: scores item content by marker density */
export function scoreItemComplexity(content: string): {
    priority: number; tags: number; estimate: number;
    dueDate: number; expiry: number; vote: number; label: number; total: number;
} {
    // Each marker as its own parser reads it. These used to be loose regexes:
    // "!important" had priority, a priority after a checkbox did not,
    // "~~done~~" had an estimate, "C++11" a vote, and "[X] done" a label.
    const body     = content.replace(CHECK_RE, '');
    const priority = PRIORITY_RE.exec(body)?.[1].length ?? 0;
    const tags     = extractTags(content).length;
    const estimate = parseEstimate(content) ? 1 : 0;
    const dueDate  = /@\d{4}-\d{2}-\d{2}/.test(content) ? 1 : 0;
    const expiry   = /@expires:\d{4}-\d{2}-\d{2}/.test(content) ? 1 : 0;
    const vote     = parseVote(content) ? 1 : 0;
    const label    = /\[[A-Z][^\]]*\]/.test(body) ? 1 : 0;
    const total    = priority + tags + estimate + dueDate + expiry + vote + label;
    return { priority, tags, estimate, dueDate, expiry, vote, label, total };
}

const STOP_WORDS = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','is','it','this','that','was','be','as','by','are','from','have','has','had','not','they','we','you','i','he','she']);

/** Pure: ranks word frequency from a word array, filtering stop words and short words, sorted descending */
export function rankWordFrequency(words: string[]): Array<[string, number]> {
    const freq = new Map<string, number>();
    for (const w of words) {
        if (w.length < 3 || STOP_WORDS.has(w)) { continue; }
        freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]);
}

/** Pure: wraps text with a marker pair if not already wrapped, else unwraps */
export function toggleWrap(text: string, style: 'bold' | 'italic' | 'mono' | 'strike'): string {
    const PAIRS: Record<string, [string, string]> = {
        bold: ['**', '**'], italic: ['_', '_'], mono: ['`', '`'], strike: ['~~', '~~'],
    };
    const [open, close] = PAIRS[style];
    if (text.startsWith(open) && text.endsWith(close) && text.length > open.length + close.length) {
        return text.slice(open.length, text.length - close.length);
    }
    return `${open}${text}${close}`;
}

/** Pure: applies Unicode combining low line underline to each character */
export function applyUnicodeUnderline(text: string): string {
    return text.split('').map(c => c + '\u0332').join('');
}

/** Pure: removes Unicode combining low line underline characters */
export function removeUnicodeUnderline(text: string): string {
    return text.replace(/\u0332/g, '');
}

/** Pure: returns true if text contains Unicode combining underline */
export function isUnicodeUnderlined(text: string): boolean {
    return text.includes('\u0332');
}

/** Pure: finds and evaluates the first =expr in content */
export function evaluateExpression(content: string): { original: string; result: number } | null {
    const match = content.match(/=([0-9+\-*/.() ]+)/);
    if (!match) { return null; }
    try {
        const expr = match[1].trim();
        if (!/^[0-9+\-*/.() ]+$/.test(expr)) { return null; }
        // eslint-disable-next-line no-new-func
        const result = new Function(`return (${expr})`)() as number;
        if (typeof result !== 'number' || !isFinite(result)) { return null; }
        // Without the spaces the match ran on into: replacing "=2+2 " glued the
        // result to the next word ("=4more").
        return { original: match[0].trimEnd(), result: Math.round(result * 10000) / 10000 };
    } catch { return null; }
}

/** Pure: collects per-mention (@Name) stats from document lines */
export interface MentionStat { name: string; total: number; done: number; }

export function collectMentionStats(
    lines: Array<{ text: string }>,
    prefix: string
): MentionStat[] {
    const CHECK_DONE = /^\[x\] /i;
    const CHECK_ANY  = /^\[(x| ?)\] /i;
    const BULLET_RE  = new RegExp(`^(>{2,}) ${prefix === '-' ? '-' : prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (.*)$`);
    const NUM_RE     = /^(>{2,}) \d+\. (.*)$/;
    const stats      = new Map<string, { total: number; done: number }>();
    for (const { text } of lines) {
        const bm = text.match(BULLET_RE);
        const nm = text.match(NUM_RE);
        const content = bm?.[2] ?? nm?.[2] ?? null;
        if (!content) { continue; }
        // Each person once per item: an item naming @Sam twice is one item for Sam.
        const mentions  = extractMentions(content);
        if (mentions.length === 0) { continue; }
        const done = CHECK_ANY.test(content) && CHECK_DONE.test(content);
        for (const name of mentions) {
            if (!stats.has(name)) { stats.set(name, { total: 0, done: 0 }); }
            const s = stats.get(name)!;
            s.total++;
            if (done) { s.done++; }
        }
    }
    return [...stats.entries()]
        .map(([name, s]) => ({ name, ...s }))
        .sort((a, b) => b.total - a.total);
}
