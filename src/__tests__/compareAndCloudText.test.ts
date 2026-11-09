/**
 * Section names are text: a pipe stays in its table cell and markup stays visible
 * in the word cloud. Copied chevron lines compare as their items.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { buildCloudHtml } from '../wordCloudCommands';
import { onCompareTwoSectionsAsTable } from '../sectionCompareTableCommands';
import { onCompareSectionToClipboard } from '../compareCommands';

const mock = vscode as unknown as {
    __reset(): void;
    queued: { quickPick: unknown[] };
    recorded: { clipboard: string };
    workspace: { openTextDocument(o: unknown): Promise<unknown> };
};

async function shownBy(run: () => Promise<void>): Promise<string> {
    let shown = '';
    const open = mock.workspace.openTextDocument;
    mock.workspace.openTextDocument = (o: unknown) => {
        shown = (o as { content: string }).content;
        return open(o);
    };
    try { await run(); } finally { mock.workspace.openTextDocument = open; }
    return shown;
}

beforeEach(() => { mock.__reset(); deactivate(); });

describe('word cloud', () => {
    it('shows markup in a section name as text', () => {
        const html = buildCloudHtml(new Map(), '<b>A</b>');
        expect(html).toContain('&lt;b&gt;A&lt;/b&gt;');
        expect(html).not.toContain('<b>A</b>');
    });
});

describe('sections side by side', () => {
    it('keeps a pipe in a section name inside its cell', async () => {
        openEditor(['> A|1', '>> - a', '> B', '>> - b'], { cursor: 0 });
        mock.queued.quickPick.push({ label: 'A|1', headerLine: 0 }, { label: 'B', headerLine: 2 });
        const shown = await shownBy(onCompareTwoSectionsAsTable);
        expect(shown.split('\n')[2]).toBe('| A\\|1 | B |');
    });
});

describe('section against the clipboard', () => {
    it('reads copied chevron lines as their items', async () => {
        openEditor(['> A', '>> - same', '>> - mine'], { cursor: 0 });
        mock.recorded.clipboard = '>> - same\n>> 2. numbered\nplain';
        const shown = await shownBy(onCompareSectionToClipboard);
        expect(shown.split('\n').slice(1)).toEqual([
            '',
            '= same',
            '- mine  *(only in section)*',
            '+ numbered  *(only in clipboard)*',
            '+ plain  *(only in clipboard)*',
        ]);
    });
});
