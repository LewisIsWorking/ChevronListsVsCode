/**
 * Covers src/copySectionAsCommands.ts. SECTION-REPORT family.
 *
 * The Markdown format wrote numbered items as "- " bullets, losing the numbers
 * that Copy Section as Markdown keeps. The regression test was checked against
 * that code.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onCopySectionAs } from '../copySectionAsCommands';

const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[]; clipboard: string; quickPickCalls: { items: { label: string }[] }[] };
    queued: { quickPick: unknown[] };
};

const DOC = [
    '> Plan & "Ideas"',
    '>> - [x] first #tag',
    'loose prose',
    '>>> 2. second <b>',
    '>> - say "hi"',
    '> Next',
    '>> - not copied',
];

async function copyAs(format: string, lines = DOC, cursor = 1) {
    openEditor(lines, { cursor });
    mock.queued.quickPick.push({ label: format });
    await onCopySectionAs();
    return mock.recorded.clipboard;
}

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onCopySectionAs', () => {
    it('does nothing without an active editor', async () => {
        await onCopySectionAs();
        expect(mock.recorded.quickPickCalls).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(DOC, { languageId: 'plaintext' });
        await onCopySectionAs();
        expect(mock.recorded.quickPickCalls).toHaveLength(0);
    });

    it('offers the five formats and copies nothing when cancelled', async () => {
        openEditor(DOC, { cursor: 1 });
        await onCopySectionAs();
        expect(mock.recorded.quickPickCalls[0].items.map(i => i.label)).toEqual(['Markdown', 'Plain Text', 'JSON', 'CSV', 'HTML']);
        expect(mock.recorded.clipboard).toBe('');
    });

    it('reports when the cursor is not in a section', async () => {
        expect(await copyAs('Markdown', ['prose'], 0)).toBe('');
        expect(mock.recorded.info.at(-1)).toBe('CL: No section found at cursor');
    });

    it('Markdown keeps metadata, indents by depth and keeps item numbers', async () => {
        expect(await copyAs('Markdown')).toBe(
            '## Plan & "Ideas"\n\n- [x] first #tag\n  2. second <b>\n- say "hi"'
        );
        expect(mock.recorded.info.at(-1)).toBe('CL: Copied as Markdown');
    });

    it('Plain Text strips metadata and marks bullets with •', async () => {
        expect(await copyAs('Plain Text')).toBe('Plan & "Ideas"\n\n• first\n  2. second <b>\n• say "hi"');
    });

    it('JSON lists every item with its plain text and depth', async () => {
        expect(JSON.parse(await copyAs('JSON'))).toEqual({
            section: 'Plan & "Ideas"',
            items: [
                { index: 1, content: '[x] first #tag', plain: 'first', depth: 0 },
                { index: 2, content: 'second <b>', plain: 'second <b>', depth: 1 },
                { index: 3, content: 'say "hi"', plain: 'say "hi"', depth: 0 },
            ],
        });
    });

    it('CSV quotes and doubles embedded quotes', async () => {
        expect(await copyAs('CSV')).toBe('index,depth,content\n1,0,"first"\n2,1,"second <b>"\n3,0,"say ""hi"""');
    });

    it('HTML escapes the section name and items', async () => {
        expect(await copyAs('HTML')).toBe(
            '<section>\n<h2>Plan &amp; "Ideas"</h2>\n<ul>\n' +
            '  <li>first</li>\n  <li>second &lt;b&gt;</li>\n  <li>say "hi"</li>\n</ul>\n</section>'
        );
    });

    it('uses the configured bullet prefix to recognise items', async () => {
        mock.__setConfig('chevron-lists.listPrefix', '*');
        expect(await copyAs('Markdown', ['> S', '>> * star', '>> - dash'], 0)).toBe('## S\n\n- star');
    });
});
