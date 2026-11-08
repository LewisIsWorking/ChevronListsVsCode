/**
 * Covers src/textTransformCommands.ts -- Uppercase / Lowercase / Title Case Item
 * change the words only. They used to change the whole content, so "{red}"
 * became "{RED}" and stopped being a colour label, "#work" became another tag,
 * "@Lewis" stopped being a mention and "[[Plans]]" stopped being a link.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onUppercaseItem, onLowercaseItem, onTitleCaseItem } from '../textTransformCommands';
import { toTitleCase } from '../patterns';

const mock = vscode as unknown as { __reset(): void; recorded: { info: string[] } };

beforeEach(() => {
    mock.__reset();
    deactivate();
});

describe('Uppercase Item', () => {
    it('leaves the markers, vote and comment alone', async () => {
        const h = openEditor(['>> - [x] !! {red} buy milk +3 // see note'], { cursor: 0 });
        await onUppercaseItem();
        expect(h.lines()).toEqual(['>> - [x] !! {red} BUY MILK +3 // see note']);
    });

    it('leaves tags, mentions, links and addresses alone', async () => {
        const h = openEditor(['>> - ask @Lewis about #work in [[Two Words]] at https://x.com/a now'], { cursor: 0 });
        await onUppercaseItem();
        expect(h.lines()).toEqual(['>> - ASK @Lewis ABOUT #work IN [[Two Words]] AT https://x.com/a NOW']);
    });

    it('keeps the number of a numbered item', async () => {
        const h = openEditor(['>>> 4. go'], { cursor: 0 });
        await onUppercaseItem();
        expect(h.lines()).toEqual(['>>> 4. GO']);
    });

    it('asks for an item', async () => {
        const h = openEditor(['> Header'], { cursor: 0 });
        await onUppercaseItem();
        expect(mock.recorded.info.at(-1)).toBe('CL: Place cursor on a chevron item to transform it');
        expect(h.lines()).toEqual(['> Header']);
    });
});

describe('Lowercase Item', () => {
    it('does not turn a mention into plain text', async () => {
        const h = openEditor(['>> - TELL @Lewis NOW'], { cursor: 0 });
        await onLowercaseItem();
        expect(h.lines()).toEqual(['>> - tell @Lewis now']);
    });
});

describe('Title Case Item', () => {
    it('leaves the colour label and checkbox alone', async () => {
        const h = openEditor(['>> - [x] {green} buy milk'], { cursor: 0 });
        await onTitleCaseItem();
        expect(h.lines()).toEqual(['>> - [x] {green} Buy Milk']);
    });
});

describe('toTitleCase', () => {
    it('does not capitalise after an apostrophe', () => {
        expect(toTitleCase("don't stop, it's mine")).toBe("Don't Stop, It's Mine");
    });

    it('handles accented letters', () => {
        expect(toTitleCase('élan vital')).toBe('Élan Vital');
        expect(toTitleCase('café au lait')).toBe('Café Au Lait');
    });

    it('still capitalises after a hyphen', () => {
        expect(toTitleCase('well-known fact')).toBe('Well-Known Fact');
    });
});
