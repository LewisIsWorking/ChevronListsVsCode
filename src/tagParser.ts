import type { LineReader } from './types';
import { isHeader, parseBullet, parseNumbered } from './patterns';

/** A single tag occurrence found in a document */
export interface TagOccurrence {
    tag:       string;   // without the # prefix
    itemText:  string;   // full item content
    section:   string;   // parent header name
    line:      number;
}

/**
 * A #tag: "#" at the start of the text or after whitespace, then a word
 * character, then word characters or hyphens. Group 1 is the name.
 *
 * This is the ONE definition of a tag. There used to be several: "#([\w-]+)"
 * here, "#(\w+)" in exports, stats, complexity and rename, none of them anchored,
 * so "#to-do" was the tag "to" in some features and "to-do" in others, and a URL
 * like "example.com/guide#setup" had a tag "setup" (and lost "#setup" when
 * metadata was stripped). It matches the JetBrains plugin's definition.
 */
export const TAG_RE = /(?<!\S)#(\w[\w-]*)/g;

/** A fresh copy of TAG_RE, so callers never share its lastIndex. */
export function tagRegex(): RegExp {
    return new RegExp(TAG_RE.source, 'g');
}

/** A regex for one specific tag, any case, that does not match longer tags such as "#to-do" for "to". */
export function oneTagRegex(tag: string): RegExp {
    const name = tag.replace(/^#/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<!\\S)#${name}(?![\\w-])`, 'gi');
}

/** Extracts all unique tag names from a content string, lower-cased */
export function extractTags(content: string): string[] {
    const tags: string[] = [];
    for (const match of content.matchAll(tagRegex())) {
        tags.push(match[1].toLowerCase());
    }
    return [...new Set(tags)];
}

/** Whether content carries `tag` (with or without its #), in any case */
export function hasTag(content: string, tag: string): boolean {
    return oneTagRegex(tag).test(content);
}

/** Strips all #tag tokens from a content string for display */
export function stripTags(content: string): string {
    return content.replace(tagRegex(), '').replace(/\s{2,}/g, ' ').trim();
}

/** Collects all tag occurrences in a document */
export function collectTags(doc: LineReader, prefix: string): TagOccurrence[] {
    const occurrences: TagOccurrence[] = [];
    let section = '';

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (isHeader(text)) { section = text.replace(/^> /, ''); continue; }

        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;

        if (!content) { continue; }
        for (const tag of extractTags(content)) {
            occurrences.push({ tag, itemText: content, section, line: i });
        }
    }
    return occurrences;
}

/** Returns all unique tag names from a document, sorted alphabetically */
export function uniqueTags(doc: LineReader, prefix: string): string[] {
    const all = collectTags(doc, prefix).map(o => o.tag);
    return [...new Set(all)].sort();
}

/**
 * Renames a tag in a single line of text, returns the updated string. Any case
 * of the old tag is renamed, as tags are compared case-insensitively everywhere
 * else; a tag followed by punctuation such as ")" is renamed; a longer tag
 * that merely starts with the old name is not.
 */
export function renameTagInText(text: string, oldTag: string, newTag: string): string {
    return text.replace(oneTagRegex(oldTag), `#${newTag.replace(/^#/, '')}`);
}
