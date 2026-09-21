import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { nextInRun } from './numberingRuns';
import type { LineReader } from './types';

/** What pasting multi-line text into an item turns into */
export interface PastedItems {
    /** Replaces the pasted-over selection; the line's text before and after it stays put. */
    insertText: string;
    /** How many new items it adds after the one being pasted into. */
    added: number;
}

/**
 * Pure: the text that makes each pasted line its own item, when `clip` is pasted
 * over [start, end) of `lineText`. Null when this is not such a paste: the line
 * is not an item, the cursor is before its marker, or there is only one line.
 *
 * The first line goes into the item at the cursor. Each further line becomes a
 * new item at the same depth: bullets use the configured prefix, numbered items
 * continue the number. Blank lines are dropped and each line is trimmed, so
 * indentation from chat logs and e-mails goes. A line that is already a chevron
 * item keeps only its text. Whatever followed the cursor ends up after the last
 * pasted line, as with any paste.
 */
export function itemsFromPaste(lineText: string, start: number, clip: string, prefix: string): PastedItems | null {
    const bullet   = parseBullet(lineText, prefix);
    const numbered = parseNumbered(lineText);
    const item     = numbered ?? bullet;
    if (!item) { return null; }
    if (start < lineText.length - item.content.length) { return null; }

    const lines = clip.split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => parseBullet(l, prefix)?.content ?? parseNumbered(l)?.content ?? l);
    if (lines.length < 2) { return null; }

    const rest = lines.slice(1).map((l, i) => numbered
        ? `${numbered.chevrons} ${numbered.num + i + 1}. ${l}`
        : `${item.chevrons} ${prefix} ${l}`);
    return { insertText: [lines[0], ...rest].join('\n'), added: rest.length };
}

/**
 * Pure: the renumbering that keeps the items after a numbered item in sequence
 * once `added` items are inserted after it. Without it the list would read
 * "1, 2, 3, 2, 3" after pasting two lines into item 1 of "1, 2, 3".
 */
export function renumberAfterPaste(doc: LineReader, lineIndex: number, added: number): { line: number; text: string }[] {
    const numbered = parseNumbered(doc.lineAt(lineIndex).text);
    if (!numbered || added === 0) { return []; }
    const edits: { line: number; text: string }[] = [];
    for (let i = nextInRun(doc, lineIndex, numbered.chevrons); i >= 0; i = nextInRun(doc, i, numbered.chevrons)) {
        const n = parseNumbered(doc.lineAt(i).text)!;
        edits.push({ line: i, text: `${n.chevrons} ${n.num + added}. ${n.content}` });
    }
    return edits;
}

export const PASTE_ITEMS_KIND = vscode.DocumentDropOrPasteEditKind?.Text?.append('chevronItems');

/**
 * Makes an ordinary paste of several lines into a chevron item put each line on
 * its own item. It is offered as the default paste; the paste widget still
 * offers plain text, and the chevron-lists.pasteLinesAsItems setting turns it off.
 */
export class ChevronPasteItemsProvider implements vscode.DocumentPasteEditProvider {
    async provideDocumentPasteEdits(
        document: vscode.TextDocument,
        ranges: readonly vscode.Range[],
        dataTransfer: vscode.DataTransfer,
    ): Promise<vscode.DocumentPasteEdit[] | undefined> {
        const { prefix, pasteLinesAsItems } = getConfig();
        if (!pasteLinesAsItems || ranges.length !== 1 || !ranges[0].isSingleLine) { return undefined; }
        const clip = await dataTransfer.get('text/plain')?.asString();
        if (!clip) { return undefined; }

        const range = ranges[0];
        const items = itemsFromPaste(document.lineAt(range.start.line).text, range.start.character, clip, prefix);
        if (!items) { return undefined; }

        const edit = new vscode.DocumentPasteEdit(items.insertText, 'Paste each line as an item', PASTE_ITEMS_KIND);
        const renumber = renumberAfterPaste(document, range.start.line, items.added);
        if (renumber.length > 0) {
            edit.additionalEdit = new vscode.WorkspaceEdit();
            for (const r of renumber) { edit.additionalEdit.replace(document.uri, document.lineAt(r.line).range, r.text); }
        }
        return [edit];
    }
}

/** Registers the provider where the running VS Code has the paste API (1.97+); older versions keep plain paste. */
export function registerPasteItemsProvider(): vscode.Disposable[] {
    if (typeof vscode.languages.registerDocumentPasteEditProvider !== 'function' || !PASTE_ITEMS_KIND) { return []; }
    return [vscode.languages.registerDocumentPasteEditProvider(
        { language: 'markdown' },
        new ChevronPasteItemsProvider(),
        { providedPasteEditKinds: [PASTE_ITEMS_KIND], pasteMimeTypes: ['text/plain'] },
    )];
}
