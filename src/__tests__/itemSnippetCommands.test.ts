/**
 * Covers src/itemSnippetCommands.ts. ITEM-TRANSFORM family.
 *
 * Every date placeholder defaulted to a fixed 2026-01-01, so a task inserted
 * with its default due date was born overdue and a creation stamp was wrong.
 * They now default to today; the regression tests below were checked against
 * the fixed-date code.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onInsertItemSnippet } from '../itemSnippetCommands';
import { todayDate } from '../patterns';

type Pos = { line: number; character: number };
type Item = { label: string; description: string; snippet: { template: string } };
const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { quickPickCalls: { items: Item[]; options: { placeHolder: string } }[] };
    queued: { quickPick: unknown[] };
};
const cursorOf = (e: unknown) => {
    const a = (e as { selection: { active: Pos } }).selection.active;
    return [a.line, a.character];
};
const offered = () => mock.recorded.quickPickCalls.at(-1)!.items;
const template = (name: string) => offered().find(i => i.label === name)!.snippet.template;

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onInsertItemSnippet', () => {
    it('does nothing without an active editor', async () => {
        await onInsertItemSnippet();
        expect(mock.recorded.quickPickCalls).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['text'], { languageId: 'plaintext' });
        await onInsertItemSnippet();
        expect(mock.recorded.quickPickCalls).toHaveLength(0);
    });

    it('offers every snippet and changes nothing when cancelled', async () => {
        const h = openEditor(['> A', '>> - a', ''], { cursor: 1 });
        await onInsertItemSnippet();
        expect(offered().map(i => i.label)).toEqual([
            'Task', 'Urgent Task', 'Starred Note', 'Flagged Item', 'Timed Task',
            'Assigned Task', 'Coloured Item', 'Voted Item', 'Commented Item', 'Stamped Item',
        ]);
        expect(mock.recorded.quickPickCalls.at(-1)!.options.placeHolder).toBe('Select an item snippet to insert…');
        expect(h.lines()).toEqual(['> A', '>> - a', '']);
    });

    it('inserts a blank item below the cursor and expands the snippet on it', async () => {
        const h = openEditor(['> A', '>> - a', '>> - b'], { cursor: 1 });
        mock.queued.quickPick.push({ snippet: { template: '* ${1:note}' } });
        await onInsertItemSnippet();
        expect(h.lines()).toEqual(['> A', '>> - a', '>> - ', '>> - b']);
        expect(cursorOf(h.editor)).toEqual([2, 5]);
        expect(h.snippets).toEqual(['* ${1:note}']);
    });

    it('uses the configured bullet prefix', async () => {
        mock.__setConfig('chevron-lists.listPrefix', '*');
        const h = openEditor(['> A', ''], { cursor: 0 });
        mock.queued.quickPick.push({ snippet: { template: 'x' } });
        await onInsertItemSnippet();
        expect(h.lines()).toEqual(['> A', '>> * ', '']);
    });

    it('defaults every date placeholder to today', async () => {
        openEditor(['> A'], { cursor: 0 });
        await onInsertItemSnippet();
        const today = todayDate();
        expect(template('Task')).toBe(`[ ] \${1:task} @\${2:${today}} #\${3:tag}`);
        expect(template('Urgent Task')).toBe(`!!! [ ] \${1:task} @\${2:${today}}`);
        expect(template('Stamped Item')).toBe(`\${1:item} @created:\${2:${today}}`);
        expect(offered().some(i => i.snippet.template.includes('2026-01-01') && today !== '2026-01-01')).toBe(false);
    });
});
