import type { LineReader } from './types';
import { isHeader } from './patterns';

/** A [[SectionName]] link found in item content */
export interface SectionLink {
    target:    string; // the section name inside [[ ]]
    line:      number;
    startChar: number;
    endChar:   number;
}

/** Regex matching [[SectionName]] links */
export const LINK_RE = /\[\[([^\]]+)\]\]/g;

/** Extracts all [[section]] links from a single content string; [[file:...]] links are not sections */
export function extractLinks(text: string): Array<{ target: string; startChar: number; endChar: number }> {
    const links = [];
    for (const match of text.matchAll(LINK_RE)) {
        if (match[1].trimStart().startsWith('file:')) { continue; }
        links.push({
            target:    match[1].trim(),
            startChar: match.index!,
            endChar:   match.index! + match[0].length,
        });
    }
    return links;
}

/** Collects all [[links]] in a document */
export function collectLinks(doc: LineReader): SectionLink[] {
    const links: SectionLink[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        for (const link of extractLinks(text)) {
            links.push({ ...link, line: i });
        }
    }
    return links;
}

/** Finds the line index of a header matching the given name (case-insensitive). Returns -1 if not found. */
export function findHeaderLine(doc: LineReader, name: string): number {
    const target = name.trim().toLowerCase();
    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (isHeader(text) && text.replace(/^> /, '').trim().toLowerCase() === target) {
            return i;
        }
    }
    return -1;
}
