import type { LineReader } from './types';

/** Regex matching [[file:filename.md]] and [[file:filename.md#Section]] syntax */
export const FILE_LINK_RE = /\[\[file:([^\]#]+)(?:#([^\]]+))?\]\]/g;

export interface FileLink {
    filename:   string;
    section?:   string;
    start:      number;
    end:        number;
    lineIndex:  number;
}

/** Extracts all [[file:...]] links from a single line */
export function extractFileLinks(text: string, lineIndex: number): FileLink[] {
    const links: FileLink[] = [];
    for (const match of text.matchAll(FILE_LINK_RE)) {
        links.push({
            filename:  match[1].trim(),
            section:   match[2]?.trim(),
            start:     match.index!,
            end:       match.index! + match[0].length,
            lineIndex,
        });
    }
    return links;
}

/** Collects all [[file:...]] links in a document */
export function collectFileLinks(doc: LineReader): FileLink[] {
    const results: FileLink[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
        results.push(...extractFileLinks(doc.lineAt(i).text, i));
    }
    return results;
}
