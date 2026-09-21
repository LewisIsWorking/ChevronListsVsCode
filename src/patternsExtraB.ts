/**
 * patternsExtraB.ts
 * Additional pure utilities — overflow from patternsExtra.ts.
 * Re-exported by patterns.ts so callers use a single import.
 */
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { parseCreatedDate, ageInDays } from './itemAgeParser';
import { tagRegex } from './tagParser';

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

/** Pure: converts chevron item content to standard markdown */
export function itemToMarkdown(content: string): string {
    let md = content;
    md = md.replace(/^\[x\]\s*/i, '- [x] ');
    md = md.replace(/^\[ \]\s*/, '- [ ] ');
    md = md.replace(/^\[\]\s*/, '- [ ] ');
    if (!md.startsWith('- [')) { md = `- ${md}`; }
    md = md.replace(/^- !!!\s*/, '- 🔴 ');
    md = md.replace(/^- !!\s*/,  '- 🟠 ');
    md = md.replace(/^- !\s*/,   '- 🟡 ');
    md = md.replace(tagRegex(), '**#$1**');
    md = md.replace(/\{(?:red|green|blue|yellow|orange|purple)\}\s*/g, '');
    md = md.replace(/\s*\/\/.*$/, '');
    md = md.replace(/\s*\+\d+/, '');
    return md.trim();
}
