/**
 * Item content has markers the parsers read from fixed places: checkbox,
 * priority, star or flag, and colour label at the start; a vote at the end of
 * the text before any comment; a comment from "//". splitItem / joinItem
 * (itemParts.ts) keep them there, and the commands below now use them.
 *
 * Bugs fixed, with regression tests checked against the original code:
 *  - a comment after a vote hid the vote from parseVote, and voting on an item
 *    with a comment put "+1" inside the comment;
 *  - Set Item Colour put "{red}" before the checkbox, hiding it;
 *  - Strikethrough wrapped the checkbox and priority ("~~[x] done~~"), and an
 *    empty item became "~~~~";
 *  - Set Due Date appended the date after a vote or comment;
 *  - Quick Note cut a URL at "https:" when replacing the old comment;
 *  - Edit Item Content silently dropped the edit when metadata sat among the
 *    words, and could rename a tag instead of a word;
 *  - Evaluate Expression glued the result to the next word ("=4more");
 *  - rich text and the complexity score read "!important" as a priority, missed
 *    a priority after a checkbox, read "https://x" as a comment, "C++11" as a
 *    vote, "~~done~~" and "~approx" as estimates, and "[X]" as a label.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { splitItem, joinItem } from '../itemParts';
import { parseVote, setVoteCount } from '../voteParser';
import { setColourLabel, removeColourLabel } from '../colourLabelParser';
import { toggleStrikethrough, removeStrikethrough, evaluateExpression, scoreItemComplexity } from '../patterns';
import { toRichText } from '../richTextConverter';
import { stripAllMetadata } from '../metadataStripper';
import { onSetDueDate } from '../setDueDateCommands';
import { onAddQuickNote } from '../quickNoteCommands';
import { onEditItemContent } from '../editItemCommands';
import { onEvaluateExpression } from '../expressionCommands';
import { onSetItemColour } from '../colourLabelCommands';
import { onStrikethroughItem, onRemoveStrikethrough } from '../strikethroughCommands';

const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[]; inputBoxCalls: { value?: string; validateInput?(v: string): string | null }[] };
    queued: { quickPick: unknown[]; inputBox: (string | undefined)[] };
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('splitItem / joinItem', () => {
    it('splits every part and joins it back in parser order', () => {
        const parts = splitItem('{red} ! [X] * buy milk #shop +3 // see https://x.com');
        expect(parts).toEqual({ check: '[X]', priority: '!', marker: '*', colour: '{red}', body: 'buy milk #shop', vote: 3, comment: 'see https://x.com' });
        expect(joinItem(parts)).toBe('[x] ! * {red} buy milk #shop +3 // see https://x.com');
    });

    it('keeps an item without markers as it is, and normalises spacing', () => {
        expect(joinItem(splitItem('  plain   words  '))).toBe('plain words');
        expect(joinItem(splitItem('[] todo'))).toBe('[ ] todo');
        expect(splitItem('[x]done').body).toBe('done');
        expect(splitItem('!important').priority).toBe('');
    });
});

describe('votes and comments', () => {
    it('reads a vote before a comment', () => {
        expect(parseVote('idea +5 // why')).toEqual({ count: 5, contentWithout: 'idea // why' });
        expect(parseVote('C++11 rocks')).toBeNull();
    });

    it('sets a vote before the comment, and removes it at zero', () => {
        expect(setVoteCount('idea // why', 1)).toBe('idea +1 // why');
        expect(setVoteCount('idea +5 // why', 6)).toBe('idea +6 // why');
        expect(setVoteCount('idea +5 // why', 0)).toBe('idea // why');
    });

    it('strips both from the plain text', () => {
        expect(stripAllMetadata('idea +5 // why')).toBe('idea');
    });

    it('does not read "C++11" at the end of an item as a vote of 11', () => {
        expect(parseVote('learn C++11')).toBeNull();
        expect(stripAllMetadata('learn C++11')).toBe('learn C++11');
        expect(toRichText('learn C++11')).toBe('learn C++11');
        expect(splitItem('learn C++11').vote).toBeNull();
        expect(parseVote('+4')?.count).toBe(4);
    });
});

describe('colour labels and strikethrough keep the leading markers first', () => {
    it('sets and removes a colour label after the checkbox and priority', () => {
        expect(setColourLabel('[x] !! done {blue}', 'red')).toBe('[x] !! {red} done');
        expect(removeColourLabel('{red} [x] done')).toBe('[x] done');
    });

    it('strikes and unstrikes only the words', () => {
        expect(toggleStrikethrough('[x] !! done +2 // note')).toBe('[x] !! ~~done~~ +2 // note');
        expect(toggleStrikethrough('[x] !! ~~done~~ +2 // note')).toBe('[x] !! done +2 // note');
        expect(removeStrikethrough('[ ] ~~old~~')).toBe('[ ] old');
        expect(removeStrikethrough('[ ] not struck')).toBe('[ ] not struck');
        expect(toggleStrikethrough('[x]')).toBe('[x]');
    });
});

describe('rich text and complexity read markers like their parsers', () => {
    it('rich text', () => {
        expect(toRichText('[ ] !!! fix it')).toBe('☐ 🔴 fix it');
        expect(toRichText('!important thing')).toBe('!important thing');
        expect(toRichText('see https://x.com/a')).toBe('see https://x.com/a');
        expect(toRichText('C++11 notes ~approx')).toBe('C++11 notes ~approx');
        expect(toRichText('idea +5 // why ~2h')).toBe('idea (+5) [note: why ~2h]');
    });

    it('complexity score', () => {
        expect(scoreItemComplexity('[ ] !!! fix').priority).toBe(3);
        expect(scoreItemComplexity('!important').priority).toBe(0);
        expect(scoreItemComplexity('~~done~~ ~approx').estimate).toBe(0);
        expect(scoreItemComplexity('C++11 +3 // why').vote).toBe(1);
        expect(scoreItemComplexity('C++11').vote).toBe(0);
        expect(scoreItemComplexity('[X] done').label).toBe(0);
        expect(scoreItemComplexity('[TODO] later').label).toBe(1);
    });
});

describe('item commands keep votes and comments in place', () => {
    it('Set Due Date puts the date before a vote and comment, replacing any old date', async () => {
        const h = openEditor(['>> 2. idea @2026-01-01 more +5 // why'], { cursor: 0 });
        mock.queued.inputBox.push('2026-12-31');
        await onSetDueDate();
        expect(h.lines()).toEqual(['>> 2. idea more @2026-12-31 +5 // why']);
        expect(mock.recorded.inputBoxCalls[0].validateInput!('nonsense')).toBe('Unrecognised date — try: 2026-12-31, friday, +7, today');
        expect(mock.recorded.inputBoxCalls[0].validateInput!('today')).toBeNull();
    });

    it('Quick Note replaces a comment without cutting a URL, keeping the vote', async () => {
        const h = openEditor(['>> - read https://x.com/a +2 // old'], { cursor: 0 });
        mock.queued.inputBox.push(' new note ');
        await onAddQuickNote();
        expect(h.lines()).toEqual(['>> - read https://x.com/a +2 // new note']);
    });

    it('Edit Item Content applies the edit when metadata sits among the words', async () => {
        const h = openEditor(['>> - [x] buy #shop milk @2026-01-01 today +1 // why'], { cursor: 0 });
        mock.queued.inputBox.push('buy oat milk tomorrow');
        await onEditItemContent();
        expect(mock.recorded.inputBoxCalls[0].value).toBe('buy milk today');
        expect(h.lines()).toEqual(['>> - [x] buy oat milk tomorrow #shop @2026-01-01 +1 // why']);
    });

    it('Edit Item Content edits the word, not a tag with the same name', async () => {
        const h = openEditor(['>> 3. #milk milk'], { cursor: 0 });
        mock.queued.inputBox.push('bread');
        await onEditItemContent();
        expect(h.lines()).toEqual(['>> 3. bread #milk']);
    });

    it('Edit Item Content keeps a struck-through item struck, and ignores an empty or unchanged edit', async () => {
        const h = openEditor(['>> - ~~old task~~ #t'], { cursor: 0 });
        mock.queued.inputBox.push('new task');
        await onEditItemContent();
        expect(h.lines()).toEqual(['>> - ~~new task~~ #t']);
        mock.queued.inputBox.push('   ');
        await onEditItemContent();
        mock.queued.inputBox.push('new task');
        await onEditItemContent();
        await onEditItemContent();
        expect(h.lines()).toEqual(['>> - ~~new task~~ #t']);
    });

    it('Evaluate Expression keeps the space before the next word', async () => {
        const h = openEditor(['>> - total =2+2 apples'], { cursor: 0 });
        await onEvaluateExpression();
        expect(h.lines()).toEqual(['>> - total =4 apples']);
        expect(mock.recorded.info.at(-1)).toBe('CL: 2+2 = 4');
        expect(evaluateExpression('x =1/0')).toBeNull();
        expect(evaluateExpression('no expression')).toBeNull();
    });

    it('Set Item Colour and strikethrough commands', async () => {
        mock.__setConfig('chevron-lists.listPrefix', '*');
        const h = openEditor(['>> * [x] done'], { cursor: 0 });
        mock.queued.quickPick.push({ colour: 'green' });
        await onSetItemColour();
        expect(h.lines()).toEqual(['>> * [x] {green} done']);
        await onStrikethroughItem();
        expect(h.lines()).toEqual(['>> * [x] {green} ~~done~~']);
        await onRemoveStrikethrough();
        mock.queued.quickPick.push({ colour: null });
        await onSetItemColour();
        expect(h.lines()).toEqual(['>> * [x] done']);
    });
});

describe('the item commands ask for an item', () => {
    const commands: [string, () => Promise<void>, string][] = [
        ['set due date', onSetDueDate, 'CL: Place cursor on a chevron item'],
        ['quick note', onAddQuickNote, 'CL: Place cursor on a chevron item'],
        ['edit item', onEditItemContent, 'CL: Place cursor on a chevron item to edit it'],
        ['expression', onEvaluateExpression, 'CL: Place cursor on a chevron item'],
        ['colour', onSetItemColour, 'CL: Place cursor on a chevron item to colour it'],
        ['strikethrough', onStrikethroughItem, 'CL: Place cursor on a chevron item'],
    ];
    for (const [name, run, message] of commands) {
        it(name, async () => {
            await run();
            openEditor(['>> - a'], { languageId: 'plaintext' });
            await run();
            expect(mock.recorded.info).toEqual([]);
            const h = openEditor(['> Header']);
            await run();
            expect(mock.recorded.info.at(-1)).toBe(message);
            expect(h.lines()).toEqual(['> Header']);
        });
    }

    it('cancelled prompts change nothing', async () => {
        const h = openEditor(['>> - a'], { cursor: 0 });
        await onSetDueDate();
        await onAddQuickNote();
        await onSetItemColour();
        expect(h.lines()).toEqual(['>> - a']);
    });

    it('Evaluate Expression reports an item without one', async () => {
        openEditor(['>> - no maths'], { cursor: 0 });
        await onEvaluateExpression();
        expect(mock.recorded.info.at(-1)).toBe('CL: No =expression found in item (e.g. =2+2)');
    });
});
