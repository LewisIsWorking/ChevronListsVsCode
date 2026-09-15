/**
 * patternsExport.ts
 * Pure export/conversion utilities — split from patternsUtils.ts.
 * Re-exported by patterns.ts. Functions added in phases 42-43 live in patternsExtra.ts.
 */
import { parseBullet, parseNumbered, isHeader } from './patterns';
import { todayDate } from './patternsUtils';
import { extractTags } from './tagParser';

/** Formats elapsed milliseconds as Ns / Nm / NhNm */
export function formatElapsed(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours        = Math.floor(totalSeconds / 3600);
    const minutes      = Math.floor((totalSeconds % 3600) / 60);
    const seconds      = totalSeconds % 60;
    if (hours > 0)   { return `${hours}h ${minutes}m`; }
    if (minutes > 0) { return `${minutes}m`; }
    return `${seconds}s`;
}

/** Pure: converts chevron-list lines to Obsidian-compatible markdown */
export function convertToObsidian(lines: string[], prefix: string): string {
    if (lines.length === 0) { return ''; }
    const body: string[] = [];
    const allTags        = new Set<string>();
    const PRIORITY_EMOJI = ['🟡', '🟠', '🔴'];
    for (const line of lines) {
        if (isHeader(line)) {
            const name = line.replace(/^> /, '').replace(/\s*==\d+/, '').replace(/\s*\[colour:[^\]]+\]/gi, '').trim();
            if (body.length > 0) { body.push(''); }
            body.push(`## ${name}`);
            continue;
        }
        const bullet   = parseBullet(line, prefix);
        const numbered = parseNumbered(line);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { if (line.trim()) { body.push(line); } continue; }
        const depth    = (bullet?.chevrons ?? numbered!.chevrons).length - 2;
        const indent   = '  '.repeat(depth);
        // The checkbox and priority are only markers at the START, in that order,
        // as their parsers read them. They used to be replaced anywhere, and the
        // checkbox brought its own "- ": "[x] done" became "- - [x] done",
        // "array[x] here" became "array- [x] here", "wow!!! great" got an emoji.
        let rest = content;
        let marks = '';
        const check = /^\[(x| ?)\]\s*/i.exec(rest);
        if (check) { marks += check[1].toLowerCase() === 'x' ? '[x] ' : '[ ] '; rest = rest.slice(check[0].length); }
        const priority = /^(!{1,3}) +/.exec(rest);
        if (priority) { marks += `${PRIORITY_EMOJI[priority[1].length - 1]} `; rest = rest.slice(priority[0].length); }
        rest = rest
            .replace(/@expires:(\d{4}-\d{2}-\d{2})/g,  '⏰ $1')
            .replace(/@(\d{4}-\d{2}-\d{2})/g,          '📅 $1')
            .replace(/\[\[file:([^\]]+)\]\]/g,          '[[$1]]')
            .trim();
        // Numbered items keep their number rather than becoming "- " bullets.
        body.push(`${indent}${numbered ? `${numbered.num}.` : '-'} ${marks}${rest}`.trimEnd());
        for (const tag of extractTags(content)) { allTags.add(tag); }
    }
    // Frontmatter must be the first thing in the file. It used to be written at
    // the first header, so a file with items above its first header got it in
    // the middle, and a file with no header lost its tags.
    const tags = allTags.size > 0 ? ['tags:', ...[...allTags].map(t => `  - ${t}`)] : ['tags: []'];
    return ['---', `created: ${todayDate()}`, ...tags, '---', '', ...body].join('\n');
}

/** Pure: word-level diff summary between two strings */
export function buildLineDiff(before: string, after: string): string {
    const bWords = new Set(before.split(/\s+/).filter(Boolean));
    const aWords = new Set(after.split(/\s+/).filter(Boolean));
    const added   = [...aWords].filter(w => !bWords.has(w)).map(w => `+ ${w}`);
    const removed = [...bWords].filter(w => !aWords.has(w)).map(w => `- ${w}`);
    if (added.length === 0 && removed.length === 0) { return '_No changes detected_'; }
    return [...removed, ...added].join('\n');
}

/** Pure: converts clipboard text to chevron item lines, detecting list format */
export function smartPasteLines(clipText: string, prefix: string, chevrons: string, startNum: number): string[] {
    const rawLines   = clipText.split(/\r?\n/).filter(l => l.trim());
    const isNumbered = rawLines.every(l => /^\d+[.)]\s/.test(l.trim()));
    return rawLines.map((line, i) => {
        const content = line.replace(/^\d+[.)]\s*/, '').replace(/^[-*•]\s*/, '').trim();
        if (isNumbered) { return `${chevrons} ${startNum + i}. ${content}`; }
        return `${chevrons} ${prefix} ${content}`;
    });
}

const WPM = 200;

/** Pure: counts words in an array of content strings */
export function countWords(contents: string[]): number {
    return contents.reduce((sum, c) => sum + c.trim().split(/\s+/).filter(Boolean).length, 0);
}

/** Pure: formats a word count as an estimated reading time string */
export function formatReadingTime(words: number): string {
    const seconds = Math.round((words / WPM) * 60);
    if (seconds < 60)  { return `${seconds} second${seconds === 1 ? '' : 's'}`; }
    const mins = Math.round(seconds / 60);
    return `${mins} minute${mins === 1 ? '' : 's'}`;
}

export interface TagStat { tag: string; total: number; done: number; }

/** Pure: collects per-tag item/done counts from document lines */
export function collectTagStats(lines: Array<{ text: string }>, prefix: string): TagStat[] {
    const CHECK_DONE = /^\[x\] /i;
    const CHECK_ANY  = /^\[(x| ?)\] /i;
    const BULLET_RE  = new RegExp(`^(>{2,}) ${prefix === '-' ? '-' : prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (.*)$`);
    const NUM_RE     = /^(>{2,}) \d+\. (.*)$/;
    const stats      = new Map<string, { total: number; done: number }>();
    for (const { text } of lines) {
        const content = text.match(BULLET_RE)?.[2] ?? text.match(NUM_RE)?.[2] ?? null;
        if (!content) { continue; }
        // Unique and lower-cased, like every other tag count: "#Work" and "#work"
        // are one tag, and an item tagged twice counts once.
        const tags = extractTags(content);
        if (tags.length === 0) { continue; }
        const done = CHECK_ANY.test(content) && CHECK_DONE.test(content);
        for (const tag of tags) {
            if (!stats.has(tag)) { stats.set(tag, { total: 0, done: 0 }); }
            const s = stats.get(tag)!; s.total++; if (done) { s.done++; }
        }
    }
    return [...stats.entries()].map(([tag, s]) => ({ tag, ...s })).sort((a, b) => b.total - a.total);
}
