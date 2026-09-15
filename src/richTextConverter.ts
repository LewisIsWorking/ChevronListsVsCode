
/** Maps raw marker syntax to readable symbols */
const PRIORITY_SYMBOLS: Record<string, string> = { '!!!': '🔴', '!!': '🟠', '!': '🟡' };

/** Pure: converts chevron item content to a human-readable rich text string */
export function toRichText(content: string): string {
    let out = content;
    // Checkboxes
    out = out.replace(/^\[x\]\s*/i, '✓ ').replace(/^\[ \]\s*/, '☐ ');
    // Priority
    out = out.replace(/^(!!!|!!|!)\s*/, m => (PRIORITY_SYMBOLS[m.trim()] ?? m) + ' ');
    // Star marker
    out = out.replace(/^\*\s+/, '⭐ ');
    // Question flag
    out = out.replace(/^\?\s+/, '❓ ');
    // Strikethrough ~~text~~ → (text)
    out = out.replace(/~~([^~]+)~~/g, '($1)');
    // Colour labels {red} etc. → remove braces
    out = out.replace(/\{(red|green|blue|yellow|orange|purple)\}\s*/gi, '');
    // Comments //text → [note: text]
    out = out.replace(/\s*\/\/\s*(.+)$/, ' [note: $1]');
    // Tags stay as-is (#tag)
    // Votes +N → (+N)
    out = out.replace(/\+(\d+)/, '(+$1)');
    // Due date @YYYY-MM-DD → (due: YYYY-MM-DD)
    out = out.replace(/@(\d{4}-\d{2}-\d{2})/g, '(due: $1)');
    // Estimate ~Nh/Nm → (~N)
    out = out.replace(/~(\w+)/g, '(~$1)');
    // Rating ★N → (★N)
    out = out.replace(/★(\d)/, '(★$1)');
    // Square bracket labels [LABEL] → [LABEL]  (keep as-is, already readable)
    return out.trim();
}
