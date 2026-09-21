/**
 * Covers src/prioritySummaryCommands.ts. SECTION-REPORT family.
 *
 * Differs from the rest of the family in one way that matters for tests: the
 * pick mixes real items with SEPARATOR rows (lineIndex -1) heading each
 * priority bucket. Highlighting or dismissing on a separator must behave like
 * highlighting nothing, and both of those guards are asserted below.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate, type Harness } from './helpers/editorHarness';
import { onShowPrioritySummary } from '../prioritySummaryCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
    lastQuickPick(): {
        items: { label: string; description?: string; lineIndex: number; kind?: number }[];
        activeItems: unknown[];
        placeholder: string;
        disposed: boolean;
        fireActive(items: unknown[]): void;
        fireAccept(): void;
        fireHide(): void;
    };
};

const NONE = 'CL: No priority items found (add !, !!, or !!! to items)';
const cursorLine = (h: Harness) =>
    (h.editor as { selection: { active: { line: number } } }).selection.active.line;

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onShowPrioritySummary', () => {
    it('does nothing without an active editor', async () => {
        await onShowPrioritySummary();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['>> - !!! urgent'], { languageId: 'plaintext' });
        await onShowPrioritySummary();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('reports when no item carries a priority', async () => {
        openEditor(['> S', '>> - plain']);
        await onShowPrioritySummary();
        expect(mock.recorded.info).toContain(NONE);
    });

    it('groups items under a separator per level, most urgent first', async () => {
        openEditor(['> S', '>> - ! low', '>> - !!! urgent', '>> - !! high']);
        await onShowPrioritySummary();
        expect(mock.lastQuickPick().items.map((i) => i.label)).toEqual([
            '🔴 Urgent (!!!)', 'urgent',
            '🟠 High (!!)', 'high',
            '🟡 Normal (!)', 'low',
        ]);
    });

    it('marks the bucket headings as separators', async () => {
        openEditor(['> S', '>> - !!! urgent']);
        await onShowPrioritySummary();
        const [heading] = mock.lastQuickPick().items;
        expect(heading.kind).toBe(vscode.QuickPickItemKind.Separator);
        expect(heading.lineIndex).toBe(-1);
    });

    it('omits empty levels entirely', async () => {
        openEditor(['> S', '>> - !! high only']);
        await onShowPrioritySummary();
        expect(mock.lastQuickPick().items.map((i) => i.label)).toEqual(['🟠 High (!!)', 'high only']);
    });

    it('shows each item against the section it sits in', async () => {
        openEditor(['> Home', '>> - !! a', '> Work', '>> - !! b']);
        await onShowPrioritySummary();
        const rows = mock.lastQuickPick().items.filter((i) => i.lineIndex >= 0);
        expect(rows.map((r) => r.description)).toEqual(['Home', 'Work']);
    });

    it('reads priorities from numbered items too', async () => {
        openEditor(['> S', '>> 1. !!! numbered']);
        await onShowPrioritySummary();
        expect(mock.lastQuickPick().items[1].label).toBe('numbered');
    });

    it('truncates long item text to 65 characters', async () => {
        const long = 'x'.repeat(100);
        openEditor(['> S', `>> - !! ${long}`]);
        await onShowPrioritySummary();
        expect(mock.lastQuickPick().items[1].label).toHaveLength(65);
    });

    it('ignores lines that are not items', async () => {
        openEditor(['> S', '!!! not an item', '>> - plain']);
        await onShowPrioritySummary();
        expect(mock.recorded.info).toContain(NONE);
    });

    it('uses the singular placeholder for one item', async () => {
        openEditor(['> S', '>> - ! a']);
        await onShowPrioritySummary();
        expect(mock.lastQuickPick().placeholder).toBe('1 priority item — press Enter to jump');
    });

    it('uses the plural placeholder for several', async () => {
        openEditor(['> S', '>> - ! a', '>> - !! b']);
        await onShowPrioritySummary();
        expect(mock.lastQuickPick().placeholder).toBe('2 priority items — press Enter to jump');
    });

    it('previews a highlighted item', async () => {
        const h = openEditor(['> S', 'x', '>> - !! target']);
        await onShowPrioritySummary();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);
        expect(cursorLine(h)).toBe(2);
    });

    it('does not move the cursor when a separator is highlighted', async () => {
        const h = openEditor(['> S', '>> - !! a'], { cursor: 0 });
        await onShowPrioritySummary();
        const pick = mock.lastQuickPick();
        const before = h.revealed.length;
        pick.fireActive([pick.items[0]]);      // the heading row
        expect(h.revealed).toHaveLength(before);
    });

    it('ignores an empty active list', async () => {
        const h = openEditor(['> S', '>> - !! a']);
        await onShowPrioritySummary();
        const before = h.revealed.length;
        mock.lastQuickPick().fireActive([]);
        expect(h.revealed).toHaveLength(before);
    });

    it('closes on accept', async () => {
        openEditor(['> S', '>> - !! a']);
        await onShowPrioritySummary();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);
        pick.fireAccept();
        expect(pick.disposed).toBe(true);
    });

    it('restores the cursor when dismissed without choosing', async () => {
        const h = openEditor(['> S', '>> - !! a', 'x'], { cursor: 2 });
        await onShowPrioritySummary();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);
        pick.activeItems = [];
        pick.fireHide();
        expect(cursorLine(h)).toBe(2);
    });

    it('restores the cursor when dismissed while a separator is highlighted', async () => {
        const h = openEditor(['> S', '>> - !! a', 'x'], { cursor: 2 });
        await onShowPrioritySummary();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);      // preview moves to line 1
        pick.activeItems = [pick.items[0]];    // then left on the heading
        pick.fireHide();
        expect(cursorLine(h)).toBe(2);
    });
});
