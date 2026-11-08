import type { LineReader } from './types';
import { parseBullet, parseNumbered } from './patterns';
import { splitItem, joinItem } from './itemParts';

/** Regex matching ? question flag at start of item content */
export const FLAG_RE = /^\? (.+)$/;

/** Parses a question flag from item content */
export function parseFlag(content: string): { contentWithout: string } | null {
    const parts = splitItem(content);
    if (parts.marker !== '?' || !parts.body) { return null; }
    return { contentWithout: joinItem({ ...parts, marker: '' }) };
}

/** Toggles the ? flag on item content */
export function toggleFlag(content: string): string {
    const parsed = parseFlag(content);
    if (parsed) { return parsed.contentWithout; }
    const parts = splitItem(content);
    return parts.marker ? `? ${content}` : joinItem({ ...parts, marker: '?' });
}

export interface FlaggedItem {
    content: string;
    section: string;
    line:    number;
}

/** Collects all flagged items in a document */
export function collectFlaggedItems(doc: LineReader, prefix: string): FlaggedItem[] {
    const results: FlaggedItem[] = [];
    let section = '';
    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (text.startsWith('> ') && !text.startsWith('>> ')) { section = text.replace(/^> /, ''); continue; }
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content || !parseFlag(content)) { continue; }
        results.push({ content: parseFlag(content)!.contentWithout, section, line: i });
    }
    return results;
}
