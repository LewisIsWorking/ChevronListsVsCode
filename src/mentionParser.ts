import type { LineReader } from './types';
import { parseBullet, parseNumbered } from './patterns';

/** A @mention occurrence in item content */
export interface MentionOccurrence {
    name:      string;  // without the @ prefix
    itemText:  string;
    section:   string;
    line:      number;
}

/**
 * A @Name mention: "@" at the start or after whitespace, then a capital letter,
 * then word characters or hyphens. Group 1 is the name.
 *
 * The ONE definition of a mention, as documented ("@Name"). There used to be
 * two: this parser took any letter, so the metadata markers "@daily", "@weekly",
 * "@monthly", "@created:" and "@expires:" were people and "bob@example.com"
 * mentioned "example"; the report and grouping took only letters, so
 * "@Mary-Jane" was "Mary". Filter by Mention and the Mentions Report disagreed.
 */
export const MENTION_RE = /(?<!\S)@([A-Z][\w-]*)/g;

/** Extracts all @mentions from item content */
export function extractMentions(content: string): string[] {
    const names: string[] = [];
    for (const match of content.matchAll(MENTION_RE)) {
        names.push(match[1]);
    }
    return [...new Set(names)];
}

/** Collects all @mention occurrences in a document */
export function collectMentions(doc: LineReader, prefix: string): MentionOccurrence[] {
    const results: MentionOccurrence[] = [];
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
        for (const name of extractMentions(content)) {
            results.push({ name, itemText: content, section, line: i });
        }
    }
    return results;
}

/** Returns all unique mention names in a document, sorted alphabetically */
export function uniqueMentions(doc: LineReader, prefix: string): string[] {
    return [...new Set(collectMentions(doc, prefix).map(m => m.name))].sort();
}
