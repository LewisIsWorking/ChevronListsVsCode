/**
 * Covers src/copyItemAsMarkdownCommands.ts and the itemToMarkdown conversion it
 * uses.
 *
 * Bugs fixed, with regression tests checked against the original code:
 * numbered items were copied as "- " bullets; a comment was cut at any "//",
 * so "https://x.com" became "https:"; a vote was stripped anywhere, so "C++11"
 * became "C+"; a priority after a checkbox kept its "!!!"; and "!important"
 * became a low priority.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onCopyItemAsMarkdown } from '../copyItemAsMarkdownCommands';
import { itemToMarkdown } from '../patterns';

const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[]; clipboard: string };
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onCopyItemAsMarkdown', () => {
    it('does nothing without an active editor or outside markdown', async () => {
        await onCopyItemAsMarkdown();
        openEditor(['>> - a'], { languageId: 'plaintext' });
        await onCopyItemAsMarkdown();
        expect(mock.recorded.clipboard).toBe('');
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('asks for an item when the cursor is not on one', async () => {
        openEditor(['> S'], { cursor: 0 });
        await onCopyItemAsMarkdown();
        expect(mock.recorded.info.at(-1)).toBe('CL: Place cursor on a chevron item');
        expect(mock.recorded.clipboard).toBe('');
    });

    it('copies a bullet, indented by depth', async () => {
        openEditor(['>>> - [x] done #ok'], { cursor: 0 });
        await onCopyItemAsMarkdown();
        expect(mock.recorded.clipboard).toBe('  - [x] done **#ok**');
        expect(mock.recorded.info.at(-1)).toBe('CL: Copied as markdown');
    });

    it('keeps a numbered item’s number', async () => {
        openEditor(['>> 3. [ ] third'], { cursor: 0 });
        await onCopyItemAsMarkdown();
        expect(mock.recorded.clipboard).toBe('3. [ ] third');
    });

    it('uses the configured bullet prefix to recognise items', async () => {
        mock.__setConfig('chevron-lists.listPrefix', '*');
        openEditor(['>> * star'], { cursor: 0 });
        await onCopyItemAsMarkdown();
        expect(mock.recorded.clipboard).toBe('- star');
    });
});

describe('itemToMarkdown', () => {
    it('keeps a URL whole', () => {
        expect(itemToMarkdown('see https://example.com/a')).toBe('- see https://example.com/a');
        expect(itemToMarkdown('see https://example.com // check')).toBe('- see https://example.com');
    });

    it('strips only a trailing vote', () => {
        expect(itemToMarkdown('C++11 notes')).toBe('- C++11 notes');
        expect(itemToMarkdown('idea +5 // note')).toBe('- idea');
    });

    it('reads a priority after a checkbox, and only with a space after it', () => {
        expect(itemToMarkdown('[ ] !!! fix it')).toBe('- [ ] 🔴 fix it');
        expect(itemToMarkdown('!important thing')).toBe('- !important thing');
    });

    it('numbers the item when given a number', () => {
        expect(itemToMarkdown('!! second', 2)).toBe('2. 🟠 second');
    });
});
