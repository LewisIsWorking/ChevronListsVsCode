import type { LineReader } from './types';

/** Regex matching a bookmark marker: >> [bookmark:Name] */
export const BOOKMARK_RE = /^\s*>>\s*\[bookmark:([^\]]+)\]/;

/** Parses a bookmark name from a line, or returns null */
export function parseBookmark(text: string): string | null {
    const match = text.match(BOOKMARK_RE);
    return match ? match[1].trim() : null;
}

/** The marker line for a bookmark, without the `]` that would end it early; null if no name is left */
export function bookmarkMarker(name: string): string | null {
    const clean = name.replace(/]/g, '').trim();
    return clean ? `>> [bookmark:${clean}]` : null;
}

export interface BookmarkOccurrence {
    name:  string;
    line:  number;
}

/** Collects all bookmarks in a document */
export function collectBookmarks(doc: LineReader): BookmarkOccurrence[] {
    const results: BookmarkOccurrence[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
        const name = parseBookmark(doc.lineAt(i).text);
        if (name) { results.push({ name, line: i }); }
    }
    return results;
}
