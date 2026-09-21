import { CHECK_RE } from './checkParser';
import { PRIORITY_RE } from './priorityParser';
import { parseComment } from './commentParser';

/** Maps raw marker syntax to readable symbols */
const PRIORITY_SYMBOLS: Record<string, string> = { '!!!': '🔴', '!!': '🟠', '!': '🟡' };

/**
 * Pure: converts chevron item content to a human-readable rich text string.
 *
 * Markers are read the way their parsers read them: checkbox, then priority,
 * then star or flag at the start; a vote only at the end; a comment only where
 * "//" starts one; an estimate only as ~Nh, ~Nm or ~NhNm. They used to match
 * loosely, so a priority after a checkbox stayed as "!!!", "!important" became
 * a priority, "https://x.com" became "https: [note: x.com]", "C++11" became
 * "C+(+11)" and "~approx" became "(~approx)".
 */
export function toRichText(content: string): string {
    let out  = content.trim();
    let lead = '';
    const check = CHECK_RE.exec(out);
    if (check) { lead += check[1].toLowerCase() === 'x' ? '✓ ' : '☐ '; out = out.slice(check[0].length); }
    const priority = PRIORITY_RE.exec(out);
    if (priority) { lead += `${PRIORITY_SYMBOLS[priority[1]]} `; out = out.slice(priority[0].length); }
    // Star marker, question flag
    out = out.replace(/^\*\s+/, '⭐ ').replace(/^\?\s+/, '❓ ');
    // Strikethrough ~~text~~ → (text)
    out = out.replace(/~~([^~]+)~~/g, '($1)');
    // Colour labels {red} etc. → remove braces
    out = out.replace(/\{(red|green|blue|yellow|orange|purple)\}\s*/gi, '');
    // Comments // text → [note: text], then a vote +N ending the text before it → (+N)
    const comment = parseComment(out);
    const note    = comment ? ` [note: ${comment.comment}]` : '';
    if (comment) { out = comment.body; }
    out = out.replace(/(?:^|\s+)\+(\d+)\s*$/, ' (+$1)');
    // Tags stay as-is (#tag)
    // Due date @YYYY-MM-DD → (due: YYYY-MM-DD)
    out = out.replace(/@(\d{4}-\d{2}-\d{2})/g, '(due: $1)');
    // Estimate ~Nh / ~Nm / ~NhNm → (~…)
    out = out.replace(/~(\d+h(?:\d+m)?|\d+m)(?=\s|$)/g, '(~$1)');
    // Rating ★N → (★N)
    out = out.replace(/★(\d)/, '(★$1)');
    // Square bracket labels [LABEL] → [LABEL]  (keep as-is, already readable)
    return (lead + out + note).trim();
}
