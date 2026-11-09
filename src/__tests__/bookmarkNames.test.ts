/**
 * Covers a bookmark name with a closing bracket in it. The marker ends at the
 * first `]`, so such a name was cut short when the marker was read back.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onAddBookmark } from '../bookmarkCommands';
import { parseBookmark } from '../bookmarkParser';

const mock = vscode as unknown as {
    __reset(): void;
    queued: { inputBox: (string | undefined)[] };
};

beforeEach(() => { mock.__reset(); deactivate(); });
afterEach(() => { deactivate(); });

describe('Add Bookmark names', () => {
    it('keeps the whole name when it has a closing bracket', async () => {
        const h = openEditor(['> A'], { cursor: 0 });
        mock.queued.inputBox.push('a]b]');
        await onAddBookmark();
        expect(h.lines()).toEqual(['>> [bookmark:ab]', '> A']);
        expect(parseBookmark(h.lines()[0])).toBe('ab');
    });

    it('adds nothing when only a bracket is left of the name', async () => {
        const h = openEditor(['> A'], { cursor: 0 });
        mock.queued.inputBox.push(' ] ');
        await onAddBookmark();
        expect(h.lines()).toEqual(['> A']);
    });

    it('still trims an ordinary name', async () => {
        const h = openEditor(['> A'], { cursor: 0 });
        mock.queued.inputBox.push('  Key point ');
        await onAddBookmark();
        expect(h.lines()).toEqual(['>> [bookmark:Key point]', '> A']);
    });
});
