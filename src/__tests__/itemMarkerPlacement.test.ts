/**
 * Stamps and ratings go among an item's words, so the leading markers, the
 * vote and the comment still parse. Pasted lines lose the list markers they
 * were copied with.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { formatDate } from '../patterns';
import { onStampItem } from '../itemAgeCommands';
import { onStampAllItems } from '../stampAllCommands';
import { parseRating, removeRating, setRating } from '../ratingParser';
import { onBulkSetRating } from '../bulkRatingCommands';
import { onPasteAsBullets, onPasteAsNumbered } from '../pasteCommands';
import { splitItem } from '../itemParts';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[]; clipboard: string };
    queued: { quickPick: unknown[] };
};
const clipboard = (text: string) => { mock.recorded.clipboard = text; };
const today = formatDate(new Date());

describe('item marker placement', () => {
    beforeEach(() => mock.__reset());
    afterEach(() => deactivate());

    it('Stamp Item goes before the vote and comment', async () => {
        const h = openEditor(['> S', '>> - a +2 // note'], { cursor: 1 });
        await onStampItem();
        expect(h.lines()[1]).toBe(`>> - a @created:${today} +2 // note`);
    });

    it('Stamp Item is not fooled by a comment mentioning a stamp', async () => {
        const h = openEditor(['> S', '>> - a // see @created:2020-01-01'], { cursor: 1 });
        await onStampItem();
        expect(h.lines()[1]).toBe(`>> - a @created:${today} // see @created:2020-01-01`);
    });

    it('Stamp All Items goes before the vote and comment', async () => {
        const h = openEditor(['> S', '>> 1. a +2 // note'], { cursor: 1 });
        await onStampAllItems();
        expect(h.lines()[1]).toBe(`>> 1. a @created:${today} +2 // note`);
    });

    it('a rating keeps the checkbox and priority leading', () => {
        const rated = setRating('[x] !! a', 3);
        expect(rated).toBe('[x] !! ★3 a');
        expect(splitItem(rated).check).toBe('[x]');
    });

    it('a rating replaces the old one and leaves the vote and comment', () => {
        expect(setRating('★1 a +2 // ★5 note', 4)).toBe('★4 a +2 // ★5 note');
        expect(removeRating('[x] ★2 a // ★5 note')).toBe('[x] a // ★5 note');
    });

    it('a rating only counts among the words', () => {
        expect(parseRating('a // ★5 note')).toBeNull();
        expect(parseRating('[x] ★2 a')).toBe(2);
    });

    it('Bulk Set Rating says when nothing needed changing', async () => {
        openEditor(['> S', '>> - ★3 a'], { cursor: 1 });
        mock.queued.quickPick.push({ rating: 3 });
        await onBulkSetRating();
        expect(mock.recorded.info).toContain('CL: No ratings changed');
    });

    it('Paste as Bullets replaces markers instead of stacking them', async () => {
        const h = openEditor(['> S'], { cursor: 0 });
        clipboard('- milk\r\n* eggs\r\n1. ham\r\n>> - old\r\nplain');
        await onPasteAsBullets();
        expect(h.lines().slice(1)).toEqual(['>> - milk', '>> - eggs', '>> - ham', '>> - old', '>> - plain']);
    });

    it('Paste as Numbered replaces markers instead of stacking them', async () => {
        const h = openEditor(['> S', '>> 4. a'], { cursor: 1 });
        clipboard('1. milk\n- eggs');
        await onPasteAsNumbered();
        expect(h.lines().slice(2)).toEqual(['>> 5. milk', '>> 6. eggs']);
    });
});
