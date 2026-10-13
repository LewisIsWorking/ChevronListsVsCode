import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onEnter } from '../enterHandler';

const mock = vscode as unknown as { __reset(): void };

beforeEach(() => { mock.__reset(); deactivate(); });

describe('Enter at the end of a header', () => {
    it('starts a numbered first item when a numbered list is under it, and renumbers the list', async () => {
        const h = openEditor(['> Paid.', '>> 1. Lewis.', '>> 2. Eimer.'], { cursor: 0, character: 7 });
        await onEnter();
        expect(h.lines()).toEqual(['> Paid.', '>> 1. ', '>> 2. Lewis.', '>> 3. Eimer.']);
        expect(h.editor.selection.active.line).toBe(1);
        expect(h.editor.selection.active.character).toBe(6);
    });

    it('starts a bullet when a bulleted list is under it', async () => {
        const h = openEditor(['> Todo', '>> - milk'], { cursor: 0, character: 6 });
        await onEnter();
        expect(h.lines()).toEqual(['> Todo', '>> - ', '>> - milk']);
    });
});

describe('Enter on a numbered item', () => {
    it('renumbers the items below it', async () => {
        const h = openEditor(['> A', '>> 1. x', '>>> - note', '>> 2. y', '>> 3. z'], { cursor: 1, character: 7 });
        await onEnter();
        expect(h.lines()).toEqual(['> A', '>> 1. x', '>> 2. ', '>>> - note', '>> 3. y', '>> 4. z']);
    });

    it('renumbers after a mid-line split too', async () => {
        const h = openEditor(['> A', '>> 1. ab', '>> 2. c'], { cursor: 1, character: 7 });
        await onEnter();
        expect(h.lines()).toEqual(['> A', '>> 1. a', '>> 2. b', '>> 3. c']);
    });
});
