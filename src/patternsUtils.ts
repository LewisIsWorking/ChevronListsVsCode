/**
 * patternsUtils.ts
 * Pure utility functions that extend patterns.ts - split out to keep patterns.ts under 200 lines.
 * All functions here are re-exported by patterns.ts so callers use a single import.
 */
import { parseBullet, parseNumbered } from './patterns';
import { NumberingRuns } from './numberingRuns';

/**
 * Formats a Date as YYYY-MM-DD using its LOCAL calendar date.
 *
 * This deliberately does not use toISOString(), which reports the UTC date.
 * Dates across the extension are built at local midnight (new Date(y, m, d)),
 * and anywhere east of UTC local midnight is still the previous day in UTC --
 * so toISOString() put every result one day early. In the UK that meant every
 * date operation was off by one for the whole of British Summer Time.
 */
export function formatDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local calendar date as YYYY-MM-DD. */
export function todayDate(): string {
    return formatDate(new Date());
}

/**
 * Adds whole calendar months, clamping the day to the target month's length.
 *
 * Date#setMonth overflows instead: 31 January + 1 month is "31 February", which
 * rolls on to 3 March, skipping February entirely. The same happens from any
 * 29th-31st into a shorter month (31 March -> 1 May skips April).
 */
export function addMonths(d: Date, months: number): Date {
    const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(d.getDate(), lastDay));
    return target;
}

/** Returns the next occurrence of a given day of week (0=Sun, 5=Fri etc.) */
export function nextWeekday(dayOfWeek: number, from: Date = new Date()): Date {
    const d    = new Date(from);
    const diff = (dayOfWeek - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d;
}

/** Shifts a YYYY-MM-DD date string by N days. Returns the new date string. */
export function shiftDate(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return formatDate(date);
}

/** Parses natural-language date input to YYYY-MM-DD. Returns null if unrecognised. */
export function parseNaturalDate(input: string, from: Date = new Date()): string | null {
    const s     = input.trim().toLowerCase();
    const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const relMatch = s.match(/^\+(\d+)$/);
    if (relMatch) { const d = new Date(today); d.setDate(d.getDate() + Number(relMatch[1])); return formatDate(d); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { return s; }
    const days: Record<string, number> = {
        sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
        wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
    };
    if (days[s] !== undefined) { return formatDate(nextWeekday(days[s], today)); }
    if (s === 'today')      { return formatDate(today); }
    if (s === 'tomorrow')   { const d = new Date(today); d.setDate(d.getDate() + 1); return formatDate(d); }
    if (s === 'next week')  { const d = new Date(today); d.setDate(d.getDate() + 7); return formatDate(d); }
    if (s === 'next month') { return formatDate(addMonths(today, 1)); }
    return null;
}

/** Checks an array of {text, index} item lines for health issues */
export interface HealthIssue { line: number; message: string; kind: string; }

export function checkLinesHealth(
    lines: Array<{ text: string; index: number }>,
    prefix: string,
    stripFn: (content: string) => string,
    extractTagsFn: (content: string) => string[]
): HealthIssue[] {
    const issues: HealthIssue[] = [];
    const seen = new Map<string, number>();
    for (const { text, index } of lines) {
        const bullet   = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        if (!bullet && !numbered) { continue; }
        const content = bullet?.content ?? numbered!.content;
        const plain   = stripFn(content).trim();
        if (plain.length === 0) {
            issues.push({ line: index, message: 'Item has no content after stripping metadata', kind: 'empty-content' });
        } else if (plain.length > 200) {
            issues.push({ line: index, message: `Item is very long (${plain.length} chars) - consider splitting`, kind: 'too-long' });
        }
        if (plain.length > 0) {
            const firstSeen = seen.get(plain.toLowerCase());
            if (firstSeen !== undefined) {
                issues.push({ line: index, message: `Duplicate item content (same as line ${firstSeen + 1})`, kind: 'duplicate' });
            } else {
                seen.set(plain.toLowerCase(), index);
            }
        }
    }
    return issues;
}

/** Computes a composite weight score: items(×3) + prioritySum + votes + tags */
export function computeSectionWeight(items: number, prioritySum: number, votes: number, tags: number): number {
    return (items * 3) + prioritySum + votes + tags;
}

/** Groups item lines by their primary #tag. Untagged items placed last with tag=''. */
export function groupLinesByTag(
    lines: string[],
    prefix: string,
    extractTagsFn: (content: string) => string[]
): Array<{ tag: string; lines: string[] }> {
    const groups = new Map<string, string[]>();
    const untagged: string[] = [];
    for (const line of lines) {
        const bullet   = parseBullet(line, prefix);
        const numbered = parseNumbered(line);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { untagged.push(line); continue; }
        const tags = extractTagsFn(content);
        if (tags.length === 0) { untagged.push(line); continue; }
        const key = tags[0];
        if (!groups.has(key)) { groups.set(key, []); }
        groups.get(key)!.push(line);
    }
    const result = [...groups.entries()].map(([tag, ls]) => ({ tag, lines: ls }));
    if (untagged.length > 0) { result.push({ tag: '', lines: untagged }); }
    return result;
}

const STOP_WORDS = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with',
    'is','it','its','this','that','be','as','by','from','was','are','have',
    'has','had','not','i','my','we','our','you','your','they','their',
]);

/** Counts word frequency in strings, excluding stop words */
export function countWordFrequency(lines: string[]): Map<string, number> {
    const freq = new Map<string, number>();
    for (const line of lines) {
        for (const word of line.toLowerCase().match(/[a-z]{3,}/g) ?? []) {
            if (STOP_WORDS.has(word)) { continue; }
            freq.set(word, (freq.get(word) ?? 0) + 1);
        }
    }
    return freq;
}

/** Levenshtein edit distance between two strings */
export function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
    );
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i-1] === b[j-1]
                ? dp[i-1][j-1]
                : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
        }
    }
    return dp[m][n];
}

/** String similarity ratio 0–1 (1 = identical) */
export function similarity(a: string, b: string): number {
    return 1 - levenshtein(a.toLowerCase(), b.toLowerCase()) / Math.max(a.length, b.length, 1);
}

/** Regex matching [colour:X] section colour tags */
export const SECTION_COLOUR_RE = /\[colour:(red|green|blue|yellow|orange|purple)\]/i;

/** Parses the colour tag from a section header line, or returns null */
export function parseSectionColour(headerText: string): string | null {
    return headerText.match(SECTION_COLOUR_RE)?.[1]?.toLowerCase() ?? null;
}

/** Sets or clears the [colour:X] tag on a header line */
export function setSectionColour(headerText: string, colour: string | null): string {
    const stripped = headerText.replace(/\s*\[colour:[^\]]+\]/gi, '').trim();
    return colour ? `${stripped} [colour:${colour}]` : stripped;
}

/** Returns the bullet prefix for the first item in a new list, based on the defaultNewListType setting */
export function getFirstItemPrefix(listPrefix: string, defaultNewListType: string): string {
    return defaultNewListType === 'ordered' ? '1.' : listPrefix;
}

// formatElapsed and convertToObsidian live in patternsExport.ts (re-exported via patterns.ts)

/** Pure: finds renumbering edits needed to fix duplicate/broken sequences at each depth */
export function computeAutoFixEdits(
    lines: Array<{ text: string; lineIndex: number }>
): Array<{ lineIndex: number; newText: string }> {
    // Group by list, so items are only compared with the items of their own list:
    // not across sections, and not across the child lists of different parents.
    const byDepth = new Map<number, Array<{ lineIndex: number; num: number; text: string }>>();
    const runs    = new NumberingRuns();
    for (const { text, lineIndex } of lines) {
        const run = runs.visit(text);
        if (run === null) { continue; }
        const m = parseNumbered(text)!;
        if (!byDepth.has(run)) { byDepth.set(run, []); }
        byDepth.get(run)!.push({ lineIndex, num: m.num, text });
    }
    const edits: Array<{ lineIndex: number; newText: string }> = [];
    for (const items of byDepth.values()) {
        let lastNum: number | null = null;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (lastNum !== null && item.num !== lastNum + 1) {
                let counter = lastNum + 1;
                for (const toFix of items.slice(i)) {
                    const m = parseNumbered(toFix.text)!;
                    edits.push({ lineIndex: toFix.lineIndex, newText: `${m.chevrons} ${counter}. ${m.content}` });
                    counter++;
                }
                break;
            }
            lastNum = item.num;
        }
    }
    return edits;
}
