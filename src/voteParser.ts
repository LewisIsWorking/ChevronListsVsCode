import type { LineReader } from './types';
import { parseBullet, parseNumbered } from './patterns';
import { joinItem, splitItem } from './itemParts';

/** Regex matching +N vote count at end of item content */
export const VOTE_RE = /(?<!\S)\+(\d+)(?=\s*$)/;

export interface VoteMatch {
    count:          number;
    contentWithout: string;
}

/**
 * Parses a vote count from item content: the +N at the end of the text before
 * any // comment. A comment after the vote used to hide it ("idea +5 // why").
 */
export function parseVote(content: string): VoteMatch | null {
    const parts = splitItem(content);
    if (parts.vote === null) { return null; }
    return { count: parts.vote, contentWithout: joinItem({ ...parts, vote: null }) };
}

/**
 * Sets or updates the vote count on item content, before any comment. It used to
 * append "+N" after the comment, where it became part of the comment.
 */
export function setVoteCount(content: string, count: number): string {
    return joinItem({ ...splitItem(content), vote: count > 0 ? count : null });
}

export interface VotedItem {
    count:   number;
    content: string;
    line:    number;
}

/** Collects all voted items sorted by count descending */
export function collectVotedItems(doc: LineReader, prefix: string): VotedItem[] {
    const results: VotedItem[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const vote = parseVote(content);
        if (!vote) { continue; }
        results.push({ count: vote.count, content: vote.contentWithout, line: i });
    }
    return results.sort((a, b) => b.count - a.count);
}
