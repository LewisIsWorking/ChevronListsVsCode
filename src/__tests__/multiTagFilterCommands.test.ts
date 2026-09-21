/**
 * Covers src/multiTagFilterCommands.ts. SECTION-REPORT family.
 *
 * Unlike the rest of the family this is a three-step conversation: pick tags
 * (multi-select), pick AND/OR, then browse matches. Each step can be cancelled,
 * and each cancellation is its own early return -- the mock's queued answers
 * drive the first two steps and an empty queue stands in for Escape.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate, type Harness } from './helpers/editorHarness';
import { onFilterByMultipleTags } from '../multiTagFilterCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
    queued: { quickPick: unknown[] };
    quickPicks: unknown[];
    lastQuickPick(): {
        items: { label: string; description?: string; lineIndex: number }[];
        activeItems: unknown[];
        placeholder: string;
        disposed: boolean;
        fireActive(items: unknown[]): void;
        fireAccept(): void;
        fireHide(): void;
    };
};

const AND = { label: 'AND — items must have ALL selected tags' };
const OR  = { label: 'OR — items with ANY selected tag' };
const tag = (t: string) => ({ label: `#${t}`, tag: t });

const DOC = [
    '> Home', '>> - fix sink #diy #urgent', '>> - paint #diy',
    '> Work', '>> - report #urgent',
];

const cursorLine = (h: Harness) =>
    (h.editor as { selection: { active: { line: number } } }).selection.active.line;

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onFilterByMultipleTags', () => {
    it('does nothing without an active editor', async () => {
        await onFilterByMultipleTags();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(DOC, { languageId: 'plaintext' });
        await onFilterByMultipleTags();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('reports when the file has no tags', async () => {
        openEditor(['> S', '>> - untagged']);
        await onFilterByMultipleTags();
        expect(mock.recorded.info).toContain('CL: No tags found in this file');
    });

    it('stops quietly when tag selection is cancelled', async () => {
        openEditor(DOC);
        await onFilterByMultipleTags();              // nothing queued = Escape
        expect(mock.quickPicks).toHaveLength(0);
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('stops quietly when no tags are ticked', async () => {
        openEditor(DOC);
        mock.queued.quickPick.push([]);
        await onFilterByMultipleTags();
        expect(mock.quickPicks).toHaveLength(0);
    });

    it('stops quietly when the match mode is cancelled', async () => {
        openEditor(DOC);
        mock.queued.quickPick.push([tag('diy')]);    // second prompt left unanswered
        await onFilterByMultipleTags();
        expect(mock.quickPicks).toHaveLength(0);
    });

    it('AND keeps only items carrying every selected tag', async () => {
        openEditor(DOC);
        mock.queued.quickPick.push([tag('diy'), tag('urgent')], AND);
        await onFilterByMultipleTags();
        expect(mock.lastQuickPick().items.map((i) => i.lineIndex)).toEqual([1]);
    });

    it('OR keeps items carrying any selected tag', async () => {
        openEditor(DOC);
        mock.queued.quickPick.push([tag('diy'), tag('urgent')], OR);
        await onFilterByMultipleTags();
        expect(mock.lastQuickPick().items.map((i) => i.lineIndex)).toEqual([1, 2, 4]);
    });

    it('labels each match with its section', async () => {
        openEditor(DOC);
        mock.queued.quickPick.push([tag('urgent')], OR);
        await onFilterByMultipleTags();
        expect(mock.lastQuickPick().items.map((i) => i.description)).toEqual(['Home', 'Work']);
    });

    it('truncates long item text to 70 characters', async () => {
        openEditor(['> S', `>> - ${'y'.repeat(90)} #t`]);
        mock.queued.quickPick.push([tag('t')], OR);
        await onFilterByMultipleTags();
        expect(mock.lastQuickPick().items[0].label).toHaveLength(70);
    });

    it('reports when nothing carries all the selected tags', async () => {
        // #x and #y each exist, but never on the same item.
        openEditor(['> S', '>> - a #x', '>> - b #y']);
        mock.queued.quickPick.push([tag('x'), tag('y')], AND);
        await onFilterByMultipleTags();
        expect(mock.recorded.info).toContain('CL: No items match the selected tags');
    });

    it('joins AND tags with & in the placeholder', async () => {
        openEditor(DOC);
        mock.queued.quickPick.push([tag('diy'), tag('urgent')], AND);
        await onFilterByMultipleTags();
        expect(mock.lastQuickPick().placeholder).toBe('1 item matching [#diy & #urgent]');
    });

    it('joins OR tags with | in the placeholder, pluralised', async () => {
        openEditor(DOC);
        mock.queued.quickPick.push([tag('diy'), tag('urgent')], OR);
        await onFilterByMultipleTags();
        expect(mock.lastQuickPick().placeholder).toBe('3 items matching [#diy | #urgent]');
    });

    it('ignores tags on lines that are not items', async () => {
        openEditor(['> S', 'prose #loose', '>> - a #real']);
        mock.queued.quickPick.push([tag('loose')], OR);
        await onFilterByMultipleTags();
        expect(mock.recorded.info).toContain('CL: No items match the selected tags');
    });

    it('previews the highlighted match', async () => {
        const h = openEditor(DOC);
        mock.queued.quickPick.push([tag('urgent')], OR);
        await onFilterByMultipleTags();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);
        expect(cursorLine(h)).toBe(4);
    });

    it('ignores an empty active list', async () => {
        const h = openEditor(DOC);
        mock.queued.quickPick.push([tag('urgent')], OR);
        await onFilterByMultipleTags();
        const before = h.revealed.length;
        mock.lastQuickPick().fireActive([]);
        expect(h.revealed).toHaveLength(before);
    });

    it('closes on accept', async () => {
        openEditor(DOC);
        mock.queued.quickPick.push([tag('urgent')], OR);
        await onFilterByMultipleTags();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.fireAccept();
        expect(pick.disposed).toBe(true);
    });

    it('restores the cursor when dismissed without choosing', async () => {
        const h = openEditor(DOC, { cursor: 3 });
        mock.queued.quickPick.push([tag('urgent')], OR);
        await onFilterByMultipleTags();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.activeItems = [];
        pick.fireHide();
        expect(cursorLine(h)).toBe(3);
    });
});
