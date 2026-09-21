import { parseComment } from './commentParser';

/**
 * Item content split into the parts the parsers read from fixed places:
 *
 *   [x] !!! * {red}  the words the user wrote  +3 // a note
 *   ^ lead markers   ^ body                    ^vote ^comment
 *
 * The checkbox, priority, star or flag, and colour label are only recognised at
 * the start (in that order); a vote only at the end of the text before any
 * comment; a comment from "//" to the end. Commands that rebuilt content by hand
 * broke each other's markers: a colour label put before the checkbox hid the
 * checkbox, strikethrough wrapped the checkbox and priority, a due date or a note
 * appended after a vote hid the vote, and a vote added to an item with a comment
 * landed inside the comment.
 */
export interface ItemParts {
    check:    string;   // "[x]" or "[ ]", or ''
    priority: string;   // "!" to "!!!", or ''
    marker:   string;   // "*" or "?", or ''
    colour:   string;   // "{red}" etc., or ''
    body:     string;
    vote:     number | null;
    comment:  string | null;
}

const LEAD: [keyof ItemParts, RegExp][] = [
    ['check',    /^\[(?:x| ?)\]\s*/i],
    ['priority', /^!{1,3}(?: +|$)/],
    ['marker',   /^[*?](?: +|$)/],
    ['colour',   /^\{(?:red|green|blue|yellow|orange|purple)\}(?:\s+|$)/],
];

/** Pure: splits item content into its parts. Leading markers are accepted in any order. */
export function splitItem(content: string): ItemParts {
    const parts: ItemParts = { check: '', priority: '', marker: '', colour: '', body: '', vote: null, comment: null };
    let rest = content.trim();
    for (let found = true; found; ) {
        found = false;
        for (const [key, re] of LEAD) {
            const m = parts[key] === '' ? re.exec(rest) : null;
            if (!m) { continue; }
            (parts as unknown as Record<string, string>)[key] = m[0].trim();
            rest  = rest.slice(m[0].length);
            found = true;
        }
    }
    const comment = parseComment(rest);
    if (comment) { parts.comment = comment.comment; rest = comment.body; }
    const vote = /(?:^|\s+)\+(\d+)\s*$/.exec(rest); // "C++11" is not a vote
    if (vote) { parts.vote = parseInt(vote[1], 10); rest = rest.slice(0, vote.index); }
    parts.body = rest.trim();
    return parts;
}

/** Pure: joins parts back into content, markers in the order the parsers read them */
export function joinItem(parts: ItemParts): string {
    const check = parts.check.toLowerCase() === '[x]' ? '[x]' : parts.check === '' ? '' : '[ ]';
    return [
        check, parts.priority, parts.marker, parts.colour,
        parts.body.replace(/\s{2,}/g, ' ').trim(),
        parts.vote !== null ? `+${parts.vote}` : '',
        parts.comment !== null ? `// ${parts.comment}` : '',
    ].filter(Boolean).join(' ');
}
