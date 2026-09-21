/**
 * Covers src/exportCommands.ts.
 *
 * The previous version of this file rebuilt the chevron-to-markdown conversion
 * locally and tested that copy, so the real module sat at 0%. These tests drive
 * the actual commands and assert on what lands on the clipboard, which is the
 * only thing a user of these commands ever sees.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onCopySectionAsMarkdown, onCopySectionAsPlainText } from '../exportCommands';

const LF = String.fromCharCode(10);

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[]; clipboard: string };
};

/** What the command put on the clipboard, split back into lines. */
const clipboardLines = (): string[] => mock.recorded.clipboard.split(LF);

beforeEach(() => {
    mock.__reset();
    deactivate();
});

const DOC = [
    '> Shopping',
    '>> - apples',
    '>> 2. bananas',
    '>>> - nested cherries',
    'stray prose',
    '> Other',
    '>> - not included',
];

describe('onCopySectionAsMarkdown', () => {
    it('does nothing without an active editor', async () => {
        await onCopySectionAsMarkdown();
        expect(mock.recorded.clipboard).toBe('');
    });

    it('does nothing when the cursor is above any header', async () => {
        openEditor(['prose only'], { cursor: 0 });
        await onCopySectionAsMarkdown();
        expect(mock.recorded.clipboard).toBe('');
    });

    it('writes the header as a level-two heading followed by a blank line', async () => {
        openEditor(DOC, { cursor: 1 });
        await onCopySectionAsMarkdown();
        expect(clipboardLines().slice(0, 2)).toEqual(['## Shopping', '']);
    });

    it('converts bullets to markdown dashes', async () => {
        openEditor(['> S', '>> - apples'], { cursor: 1 });
        await onCopySectionAsMarkdown();
        expect(clipboardLines()).toEqual(['## S', '', '- apples']);
    });

    it('converts numbered items keeping their number', async () => {
        openEditor(['> S', '>> 3. bananas'], { cursor: 1 });
        await onCopySectionAsMarkdown();
        expect(clipboardLines()).toEqual(['## S', '', '3. bananas']);
    });

    it('indents nested items by two spaces per depth', async () => {
        openEditor(['> S', '>>> - deep', '>>>> 1. deeper'], { cursor: 1 });
        await onCopySectionAsMarkdown();
        expect(clipboardLines()).toEqual(['## S', '', '  - deep', '    1. deeper']);
    });

    it('drops lines that are neither bullet nor numbered', async () => {
        openEditor(DOC, { cursor: 1 });
        await onCopySectionAsMarkdown();
        expect(clipboardLines()).toEqual(
            ['## Shopping', '', '- apples', '2. bananas', '  - nested cherries']
        );
    });

    it('stops at the next section', async () => {
        openEditor(DOC, { cursor: 1 });
        await onCopySectionAsMarkdown();
        expect(mock.recorded.clipboard).not.toContain('not included');
    });

    it('confirms to the user', async () => {
        openEditor(DOC, { cursor: 1 });
        await onCopySectionAsMarkdown();
        expect(mock.recorded.info).toContain('Chevron Lists: Section copied as Markdown');
    });

    it('copies an empty section as just its heading', async () => {
        openEditor(['> Empty'], { cursor: 0 });
        await onCopySectionAsMarkdown();
        expect(clipboardLines()).toEqual(['## Empty', '']);
    });
});

describe('onCopySectionAsPlainText', () => {
    it('does nothing without an active editor', async () => {
        await onCopySectionAsPlainText();
        expect(mock.recorded.clipboard).toBe('');
    });

    it('does nothing when the cursor is above any header', async () => {
        openEditor(['prose only'], { cursor: 0 });
        await onCopySectionAsPlainText();
        expect(mock.recorded.clipboard).toBe('');
    });

    it('writes the bare header followed by a blank line', async () => {
        openEditor(DOC, { cursor: 1 });
        await onCopySectionAsPlainText();
        expect(clipboardLines().slice(0, 2)).toEqual(['Shopping', '']);
    });

    it('strips all markers, leaving only the content', async () => {
        openEditor(DOC, { cursor: 1 });
        await onCopySectionAsPlainText();
        expect(clipboardLines()).toEqual(
            ['Shopping', '', 'apples', 'bananas', 'nested cherries']
        );
    });

    it('does not indent nested items', async () => {
        openEditor(['> S', '>>> - deep'], { cursor: 1 });
        await onCopySectionAsPlainText();
        expect(clipboardLines()).toEqual(['S', '', 'deep']);
    });

    it('stops at the next section', async () => {
        openEditor(DOC, { cursor: 1 });
        await onCopySectionAsPlainText();
        expect(mock.recorded.clipboard).not.toContain('not included');
    });

    it('confirms to the user', async () => {
        openEditor(DOC, { cursor: 1 });
        await onCopySectionAsPlainText();
        expect(mock.recorded.info).toContain('Chevron Lists: Section copied as plain text');
    });

    it('copies an empty section as just its header', async () => {
        openEditor(['> Empty'], { cursor: 0 });
        await onCopySectionAsPlainText();
        expect(clipboardLines()).toEqual(['Empty', '']);
    });
});
