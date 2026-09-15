/**
 * Covers src/pasteItemsProvider.ts: pasting several lines into a chevron item
 * puts each line on its own item, instead of dropping the lines in unchevroned
 * with whatever indentation they carried.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { makeEditor, deactivate } from './helpers/editorHarness';
import { itemsFromPaste, renumberAfterPaste, ChevronPasteItemsProvider, registerPasteItemsProvider, PASTE_ITEMS_KIND } from '../pasteItemsProvider';

const mock = vscode as unknown as { __reset(): void; __setConfig(key: string, value: unknown): void };

beforeEach(() => { mock.__reset(); deactivate(); });

type Ed = { document: never; edit(cb: (eb: { replace(r: vscode.Range, t: string): void }) => void): Promise<boolean> };

/** Pastes `clip` at (line, character) through the provider, applying its edits, and returns the document. */
async function paste(lines: string[], line: number, character: number, clip: string, endCharacter = character) {
    const h = makeEditor(lines);
    const ed = h.editor as Ed;
    const range = new vscode.Range(line, character, line, endCharacter);
    const transfer = { get: (mime: string) => (mime === 'text/plain' ? { asString: () => Promise.resolve(clip) } : undefined) };
    const edits = await new ChevronPasteItemsProvider().provideDocumentPasteEdits(ed.document, [range], transfer as never);
    if (!edits) { return { lines: null, edits }; }
    const [edit] = edits as unknown as { insertText: string; additionalEdit?: { operations: { range: vscode.Range; text: string }[] } }[];
    await ed.edit(eb => {
        eb.replace(range, edit.insertText);
        for (const op of edit.additionalEdit?.operations ?? []) { eb.replace(op.range, op.text); }
    });
    return { lines: h.lines(), edits };
}

describe('pasting a chat log into a numbered item', () => {
    const LOG = [
        '[15/09/2026 17:37] Path Wars: 5 TABLES OF LIGHTNING SIGILS START TO GLOW!',
        '      [15/09/2026 17:38] Path Wars: [ Photo ]',
        '      [15/09/2026 17:38] Path Wars: 5 nearest allies:',
        '      [15/09/2026 17:38] Path Wars: 1. Ji Yun\'s Blood God Eidolon.',
        '      [15/09/2026 17:39] Path Wars: Ji Yun\'s Blood God Eidolon takes 6 damage.',
        '      Persistent Damage',
        '      1d6 persistent electricity',
        '',
        '      [15/09/2026 17:43] Path Wars: END OF ROUND 1 ENEMY TURNS!',
    ].join('\r\n');

    it('puts every line on its own item, numbered on from the item pasted into', async () => {
        const { lines } = await paste(['> Round 1: Enemy turns.', '>> 1. '], 1, 6, LOG);
        expect(lines).toEqual([
            '> Round 1: Enemy turns.',
            '>> 1. [15/09/2026 17:37] Path Wars: 5 TABLES OF LIGHTNING SIGILS START TO GLOW!',
            '>> 2. [15/09/2026 17:38] Path Wars: [ Photo ]',
            '>> 3. [15/09/2026 17:38] Path Wars: 5 nearest allies:',
            '>> 4. [15/09/2026 17:38] Path Wars: 1. Ji Yun\'s Blood God Eidolon.',
            '>> 5. [15/09/2026 17:39] Path Wars: Ji Yun\'s Blood God Eidolon takes 6 damage.',
            '>> 6. Persistent Damage',
            '>> 7. 1d6 persistent electricity',
            '>> 8. [15/09/2026 17:43] Path Wars: END OF ROUND 1 ENEMY TURNS!',
        ]);
    });

    it('renumbers the items that follow in the same list', async () => {
        const { lines } = await paste(['> R', '>> 1. ', '>>> 1. child', '>> 2. ', '> Next', '>> 1. other'], 1, 6, 'a\nb');
        expect(lines).toEqual(['> R', '>> 1. a', '>> 2. b', '>>> 1. child', '>> 3. ', '> Next', '>> 1. other']);
    });
});

describe('itemsFromPaste', () => {
    it('adds bullets with the configured prefix at the item’s depth', () => {
        expect(itemsFromPaste('>>> * ', 6, 'one\ntwo\nthree', '*')).toEqual({ insertText: 'one\n>>> * two\n>>> * three', added: 2 });
    });

    it('keeps only the text of lines that are already chevron items', () => {
        expect(itemsFromPaste('>> - ', 5, '>> - copied\n>>> 4. nested', '-')).toEqual({ insertText: 'copied\n>> - nested', added: 1 });
    });

    it('is not used for a single line, a non-item line, or a cursor before the marker', () => {
        expect(itemsFromPaste('>> - x', 6, 'just one line\n\n', '-')).toBeNull();
        expect(itemsFromPaste('> Header', 8, 'a\nb', '-')).toBeNull();
        expect(itemsFromPaste('plain text', 3, 'a\nb', '-')).toBeNull();
        expect(itemsFromPaste('>> - x', 2, 'a\nb', '-')).toBeNull();
    });
});

describe('the paste provider', () => {
    it('keeps what followed the cursor after the last pasted line', async () => {
        const { lines } = await paste(['>> - before after'], 0, 12, 'one\ntwo');
        // As with a plain paste, the text after the cursor follows the last line directly.
        expect(lines).toEqual(['>> - before one', '>> - twoafter']);
    });

    it('replaces a selection inside the item', async () => {
        const { lines } = await paste(['>> - keep DROP tail'], 0, 10, 'x\ny', 14);
        expect(lines).toEqual(['>> - keep x', '>> - y tail']);
    });

    it('offers a titled edit of its own kind', async () => {
        const { edits } = await paste(['>> - '], 0, 5, 'a\nb');
        const [edit] = edits as unknown as { title: string; kind: unknown; additionalEdit?: unknown }[];
        expect(edit.title).toBe('Paste each line as an item');
        expect(edit.kind).toBe(PASTE_ITEMS_KIND);
        expect(edit.additionalEdit).toBeUndefined();
    });

    it('leaves the paste alone when it does not apply', async () => {
        expect((await paste(['> Header'], 0, 8, 'a\nb')).edits).toBeUndefined();
        expect((await paste(['>> - x'], 0, 6, 'single')).edits).toBeUndefined();
        expect((await paste(['>> - x'], 0, 6, '')).edits).toBeUndefined();
    });

    it('leaves multi-cursor, multi-line selections and non-text pastes alone', async () => {
        const provider = new ChevronPasteItemsProvider();
        const doc = makeEditor(['>> - a', '>> - b']).document as never;
        const text = { get: () => ({ asString: () => Promise.resolve('x\ny') }) } as never;
        expect(await provider.provideDocumentPasteEdits(doc, [new vscode.Range(0, 6, 0, 6), new vscode.Range(1, 6, 1, 6)], text)).toBeUndefined();
        expect(await provider.provideDocumentPasteEdits(doc, [new vscode.Range(0, 5, 1, 5)], text)).toBeUndefined();
        expect(await provider.provideDocumentPasteEdits(doc, [new vscode.Range(0, 6, 0, 6)], { get: () => undefined } as never)).toBeUndefined();
    });

    it('can be turned off', async () => {
        mock.__setConfig('chevron-lists.pasteLinesAsItems', false);
        expect((await paste(['>> - '], 0, 5, 'a\nb')).edits).toBeUndefined();
    });
});

describe('renumberAfterPaste', () => {
    const doc = (lines: string[]) => ({ lineCount: lines.length, lineAt: (i: number) => ({ text: lines[i] }) });

    it('does nothing for a bullet or when nothing was added', () => {
        expect(renumberAfterPaste(doc(['>> - a', '>> 2. b']), 0, 3)).toEqual([]);
        expect(renumberAfterPaste(doc(['>> 1. a', '>> 2. b']), 0, 0)).toEqual([]);
    });
});

describe('registerPasteItemsProvider', () => {
    it('registers for markdown where the paste API exists, and not where it does not', () => {
        const languages = vscode.languages as unknown as Record<string, unknown>;
        const real = languages.registerDocumentPasteEditProvider;
        const calls: unknown[][] = [];
        languages.registerDocumentPasteEditProvider = (...args: unknown[]) => { calls.push(args); return { dispose() {} }; };
        expect(registerPasteItemsProvider()).toHaveLength(1);
        expect(calls[0][0]).toEqual({ language: 'markdown' });
        expect(calls[0][2]).toEqual({ providedPasteEditKinds: [PASTE_ITEMS_KIND], pasteMimeTypes: ['text/plain'] });
        languages.registerDocumentPasteEditProvider = undefined;
        expect(registerPasteItemsProvider()).toEqual([]);
        languages.registerDocumentPasteEditProvider = real;
    });
});
