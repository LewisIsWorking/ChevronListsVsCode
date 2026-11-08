/**
 * Bulk Tag asks for one tag, since "#a b" tags only "a" and leaves "b" as a
 * word, and Show Section Path names a section without its word goal.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onBulkTagItems } from '../bulkCommands';
import { parseColourLabel } from '../colourLabelParser';
import { onShowSectionPath } from '../sectionPathCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[]; inputBoxCalls: { validateInput(v: string): string | null }[] };
    queued: { inputBox: (string | undefined)[] };
};

describe('tag prompt and path name', () => {
    beforeEach(() => mock.__reset());
    afterEach(() => deactivate());

    it('Bulk Tag refuses anything but one tag', async () => {
        openEditor(['> S', '>> - a'], { cursor: 1 });
        mock.queued.inputBox.push(undefined);
        await onBulkTagItems();
        const validate = mock.recorded.inputBoxCalls[0].validateInput;
        expect(validate('a b')).not.toBeNull();
        expect(validate('')).not.toBeNull();
        expect(validate('#')).not.toBeNull();
        expect(validate('urgent')).toBeNull();
        expect(validate(' #to-do_1 ')).toBeNull();
    });

    it('a colour named in a comment is not the colour of the item', () => {
        expect(parseColourLabel('a // was {red}')).toBeNull();
        expect(parseColourLabel('[x] {red} a')).toBe('red');
        expect(parseColourLabel('a {blue} b // was {red}')).toBe('blue');
    });

    it('Show Section Path leaves out the word goal', async () => {
        openEditor(['> Draft ==500', '>> - a'], { cursor: 1 });
        await onShowSectionPath();
        expect(mock.recorded.info[0]).toStartWith('📍 Draft  ·');
    });
});
