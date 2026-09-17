import type { BulletMatch, NumberedMatch } from './types';
import { joinItem, splitItem } from './itemParts';

/** Matches a >> 1. numbered item at any depth — captures chevrons, number, content */
export const NUMBERED_ITEM_RE = /^(>{2,}) (\d+)\. (.*)$/;

/** Matches a > header line (single >, not >>) */
export const HEADER_RE = /^> [^>]/;

/** Escapes special regex characters in a string */
export function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds the bullet item regex for the configured prefix e.g. ">> - content" */
export function bulletRE(prefix: string): RegExp {
    return new RegExp(`^(>{2,}) ${escapeRegex(prefix)} (.*)$`);
}

/** Parses a bullet item line, returning null if it does not match */
export function parseBullet(line: string, prefix: string): BulletMatch | null {
    const match = line.match(bulletRE(prefix));
    if (!match) { return null; }
    return { chevrons: match[1], content: match[2] };
}

/** Parses a numbered item line, returning null if it does not match */
export function parseNumbered(line: string): NumberedMatch | null {
    const match = line.match(NUMBERED_ITEM_RE);
    if (!match) { return null; }
    return { chevrons: match[1], num: parseInt(match[2], 10), content: match[3] };
}

/** Returns true if the line is a chevron header (single >) */
export function isHeader(line: string): boolean {
    return HEADER_RE.test(line);
}

/** Regex matching [LABEL] spans in item content */
export const LABEL_RE = /\[([^\]]*)\]/g;

/** Returns all [label] spans in a content string with their positions */
export function extractLabels(content: string): Array<{ text: string; start: number; end: number }> {
    const results: Array<{ text: string; start: number; end: number }> = [];
    for (const match of content.matchAll(LABEL_RE)) {
        results.push({ text: match[0], start: match.index!, end: match.index! + match[0].length });
    }
    return results;
}

/** Title-cases a string — first letter of each word capitalised */
export function toTitleCase(s: string): string {
    return s.replace(/\b\w/g, c => c.toUpperCase());
}

/** Toggles ~~strikethrough~~ on a content string */
export function toggleStrikethrough(content: string): string {
    // Only the words: wrapping the whole content put the checkbox and priority
    // inside "~~", where they stopped being recognised ("~~[x] done~~"), and a
    // vote or comment went with them.
    const parts = splitItem(content);
    if (isStruck(parts.body)) { return joinItem({ ...parts, body: parts.body.slice(2, -2) }); }
    if (parts.body === '') { return content; }
    return joinItem({ ...parts, body: `~~${parts.body}~~` });
}

/** Pure: removes ~~strikethrough~~ from the item's words, leaving its markers alone */
export function removeStrikethrough(content: string): string {
    const parts = splitItem(content);
    return isStruck(parts.body) ? joinItem({ ...parts, body: parts.body.slice(2, -2) }) : content;
}

function isStruck(body: string): boolean {
    return body.startsWith('~~') && body.endsWith('~~') && body.length > 4;
}

/** Replaces @YYYY-MM-DD in item content with a new date string */
export function replaceDate(content: string, newDate: string): string {
    return content.replace(/@\d{4}-\d{2}-\d{2}/, `@${newDate}`);
}

/** Strips @YYYY-MM-DD from item content */
export function stripDate(content: string): string {
    return content.replace(/\s*@\d{4}-\d{2}-\d{2}/, '').trim();
}

/** Adds [x] done marker to item content if not already present */
export function markDone(content: string): string {
    if (content.startsWith('[ ]')) { return content.replace('[ ]', '[x]'); }
    if (content.startsWith('[x]')) { return content; }
    return `[x] ${content}`;
}

/** Applies a numeric offset to a numbered item line; returns null if result < 1 */
export function offsetNumberedLine(text: string, offset: number): string | null {
    const m = text.match(/^(>{2,}) (\d+)\. (.*)$/);
    if (!m) { return null; }
    const newNum = Number(m[2]) + offset;
    if (newNum < 1) { return null; }
    return `${m[1]} ${newNum}. ${m[3]}`;
}

/** Converts a list of content rows to a markdown table string */
export function toMarkdownTable(rows: Array<{ num: number; content: string }>): string {
    return [
        '| # | Content |',
        '|---|---------|',
        ...rows.map(r => `| ${r.num} | ${r.content.replace(/\|/g, '\\|')} |`),
    ].join('\n');
}

/**
 * Increments the first number in the item's words, keeping its zero-padding
 * ("Episode 09" becomes "Episode 10", "07" becomes "08"). Returns null if there
 * is none.
 *
 * Numbers inside metadata are skipped: a date, estimate, vote, rating, tag or
 * link. It used to take the first digits anywhere, so "@2026-01-01 step 1"
 * became "@2027-01-01 step 1".
 */
export function incrementFirstNumber(content: string): string | null {
    // A link can span words ("[[Part 1]]"), so its characters are masked first.
    const masked = content.replace(/\[\[[^\]]*\]\]/g, m => ' '.repeat(m.length));
    for (const word of masked.matchAll(/\S+/g)) {
        if (/^[@~+★#]/.test(word[0])) { continue; }
        const digits = /\d+/.exec(word[0]);
        if (!digits) { continue; }
        const at = word.index! + digits.index;
        const next = String(Number(digits[0]) + 1).padStart(digits[0].length, '0');
        return content.slice(0, at) + next + content.slice(at + digits[0].length);
    }
    return null;
}

/** Pure line-by-line diff of two string arrays. Lines prefixed with ' ', '+', or '-' */
export function diffLines(a: string[], b: string[]): string[] {
    const out: string[] = [];
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
        const lineA = a[i] ?? null;
        const lineB = b[i] ?? null;
        if (lineA === lineB)     { out.push(`  ${lineA ?? ''}`); }
        else if (lineA === null) { out.push(`+ ${lineB}`); }
        else if (lineB === null) { out.push(`- ${lineA}`); }
        else                     { out.push(`- ${lineA}`, `+ ${lineB}`); }
    }
    return out;
}

// Re-export everything from patternsUtils, patternsExport, and patternsExtra so callers only need one import
export * from './patternsUtils';
export * from './patternsExport';
export * from './patternsExtra';
export * from './patternsExtraB';
