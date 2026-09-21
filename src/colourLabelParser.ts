import type { LineReader } from './types';
import { parseBullet, parseNumbered } from './patterns';
import { joinItem, splitItem } from './itemParts';

/** All supported colour label names */
export const COLOUR_LABELS = ['red', 'green', 'blue', 'yellow', 'orange', 'purple'] as const;
export type ColourLabel = typeof COLOUR_LABELS[number];

/** Regex matching {colour} in item content */
export const COLOUR_LABEL_RE = /\{(red|green|blue|yellow|orange|purple)\}/g;

/** Parses the first colour label from item content */
export function parseColourLabel(content: string): ColourLabel | null {
    const match = content.match(/\{(red|green|blue|yellow|orange|purple)\}/);
    return match ? match[1] as ColourLabel : null;
}

/**
 * Sets (or replaces) the colour label on item content, after the checkbox,
 * priority and star or flag. It used to go first ("{red} [x] done"), which hid
 * the checkbox and priority from their parsers.
 */
export function setColourLabel(content: string, label: ColourLabel): string {
    const parts = splitItem(content);
    return joinItem({ ...parts, colour: `{${label}}`, body: parts.body.replace(COLOUR_LABEL_RE, '') });
}

/** Removes any colour label from item content */
export function removeColourLabel(content: string): string {
    const parts = splitItem(content);
    return joinItem({ ...parts, colour: '', body: parts.body.replace(COLOUR_LABEL_RE, '') });
}

export interface ColourLabelOccurrence {
    label:   ColourLabel;
    content: string;
    section: string;
    line:    number;
}

/** Collects all colour-labelled items in a document */
export function collectColourLabels(doc: LineReader, prefix: string): ColourLabelOccurrence[] {
    const results: ColourLabelOccurrence[] = [];
    let section = '';
    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (text.startsWith('> ') && !text.startsWith('>> ')) { section = text.replace(/^> /, ''); continue; }
        const bullet   = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const label = parseColourLabel(content);
        if (!label) { continue; }
        results.push({ label, content: removeColourLabel(content), section, line: i });
    }
    return results;
}
