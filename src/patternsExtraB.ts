/**
 * patternsExtraB.ts
 * Additional pure utilities — overflow from patternsExtra.ts.
 * Re-exported by patterns.ts so callers use a single import.
 */
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { parseCreatedDate, ageInDays } from './itemAgeParser';
import { tagRegex } from './tagParser';
import { stripComment } from './commentParser';

export interface AgedItem { content: string; section: string; age: number; line: number; }

/** Pure: collects all items with @created: dates, sorted oldest first */
export function collectAgedItems(
    lines: Array<{ text: string }>,
    prefix: string,
    today: Date
): AgedItem[] {
    const results: AgedItem[] = [];
    let section = '';
    for (let i = 0; i < lines.length; i++) {
        const text = lines[i].text;
        if (isHeader(text)) { section = text.replace(/^> /, '').trim(); continue; }
        const content = parseBullet(text, prefix)?.content ?? parseNumbered(text)?.content ?? null;
        if (!content) { continue; }
        const created = parseCreatedDate(content);
        if (!created) { continue; }
        results.push({ content, section, age: ageInDays(created, today), line: i });
    }
    return results.sort((a, b) => b.age - a.age);
}

/**
 * Pure: converts chevron item content to standard markdown. `num` makes it a
 * numbered list item ("3. ") instead of a bullet.
 *
 * Markers are read the way their parsers read them: a checkbox, then a
 * priority ("!" to "!!!" followed by a space), at the start; a vote only at the
 * end; a comment only where "//" starts it. This used to match loosely, so a
 * priority after a checkbox kept its "!!!", "!important" became a priority,
 * "https://x.com" lost everything after "https:", and "C++11" became "C+".
 */
export function itemToMarkdown(content: string, num: number | null = null): string {
    let rest = content.trim();
    let marks = '';
    const check = /^\[(x| ?)\]\s*/i.exec(rest);
    if (check) { marks += check[1].toLowerCase() === 'x' ? '[x] ' : '[ ] '; rest = rest.slice(check[0].length); }
    const priority = /^(!{1,3}) +/.exec(rest);
    if (priority) { marks += `${['🟡', '🟠', '🔴'][priority[1].length - 1]} `; rest = rest.slice(priority[0].length); }
    rest = stripComment(rest)
        .replace(/(?:^|\s+)\+\d+\s*$/, '')
        .replace(/\{(?:red|green|blue|yellow|orange|purple)\}\s*/g, '')
        .replace(tagRegex(), '**#$1**');
    return `${num !== null ? `${num}.` : '-'} ${marks}${rest}`.trim();
}
