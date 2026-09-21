/**
 * Regex matching a // comment tail in item content.
 *
 * The `//` must start the content or follow whitespace. It previously matched
 * `//` anywhere, so every URL was split in two: "see https://example.com"
 * parsed as body "see https:" with the comment "example.com", which mangled
 * previews, exports and the plain-text form of any item containing a link.
 */
export const COMMENT_RE = /(?:^|\s+)\/\/\s*(.*)$/;

/** Parses an inline comment from item content */
export function parseComment(content: string): { body: string; comment: string } | null {
    const match = content.match(COMMENT_RE);
    if (!match) { return null; }
    return {
        body:    content.slice(0, match.index).trimEnd(),
        comment: match[1],
    };
}

/** Strips the // comment from item content */
export function stripComment(content: string): string {
    return parseComment(content)?.body ?? content;
}
