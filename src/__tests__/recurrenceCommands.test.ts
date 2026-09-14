/**
 * Covers src/recurrenceCommands.ts.
 *
 * Writing these found TWO real bugs in onGenerateNextOccurrence, both
 * confirmed by execution rather than by reading:
 *
 *   1. The generated item is always a BULLET. The template is
 *      `${chevrons} ${prefix} ...`, so a numbered source `>> 3. Review` yields
 *      `>> - Review`.
 *
 *   2. The insert goes to Position(lineIndex + 1, 0). When the recurring item
 *      is the LAST line of a file with no trailing newline, that position does
 *      not exist and resolves to the end of the same line, so the new item is
 *      glued onto the existing one. Mid-file and files ending in a newline are
 *      fine -- verified -- so this is specifically end-of-file.
 *
 * Both are written as `it.failing` asserting the CORRECT behaviour. That keeps
 * them visible without enshrining a corrupted document as "expected", and Bun
 * fails the test the moment either is fixed so the marker can be removed.
 * Product behaviour is deliberately not changed here.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate, type Harness } from './helpers/editorHarness';
import { onShowRecurring, onGenerateNextOccurrence } from '../recurrenceCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
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

const NONE = 'CL: No recurring items found (use @daily, @weekly, or @monthly in item content)';
const cursorLine = (h: Harness) =>
    (h.editor as { selection: { active: { line: number } } }).selection.active.line;

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onShowRecurring', () => {
    const DOC = ['> Chores', '>> - Water plants @daily', '>> 2. Review @weekly', 'prose @monthly'];

    it('does nothing without an active editor', async () => {
        await onShowRecurring();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(DOC, { languageId: 'plaintext' });
        await onShowRecurring();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('reports when there are no recurring items', async () => {
        openEditor(['> S', '>> - one-off']);
        await onShowRecurring();
        expect(mock.recorded.info).toContain(NONE);
    });

    it('lists recurring items from bullets and numbered items only', async () => {
        openEditor(DOC);
        await onShowRecurring();
        expect(mock.lastQuickPick().items.map((i) => i.label)).toEqual([
            '$(sync) @daily — Water plants',
            '$(sync) @weekly — Review',
        ]);
    });

    it('labels each with its section', async () => {
        openEditor(DOC);
        await onShowRecurring();
        expect(mock.lastQuickPick().items.map((i) => i.description)).toEqual(['Chores', 'Chores']);
    });

    it('shows a descriptive placeholder', async () => {
        openEditor(DOC);
        await onShowRecurring();
        expect(mock.lastQuickPick().placeholder).toBe('Recurring items in this file');
    });

    it('previews the highlighted item', async () => {
        const h = openEditor(DOC);
        await onShowRecurring();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);
        expect(cursorLine(h)).toBe(2);
    });

    it('ignores an empty active list', async () => {
        const h = openEditor(DOC);
        await onShowRecurring();
        const before = h.revealed.length;
        mock.lastQuickPick().fireActive([]);
        expect(h.revealed).toHaveLength(before);
    });

    it('jumps to the item on accept', async () => {
        const h = openEditor(DOC);
        await onShowRecurring();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);
        pick.fireAccept();
        expect(cursorLine(h)).toBe(2);
        expect(pick.disposed).toBe(true);
    });

    it('accepting with nothing highlighted still closes', async () => {
        openEditor(DOC);
        await onShowRecurring();
        const pick = mock.lastQuickPick();
        pick.fireAccept();
        expect(pick.disposed).toBe(true);
    });

    it('restores the cursor when dismissed without choosing', async () => {
        const h = openEditor(DOC, { cursor: 3 });
        await onShowRecurring();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.activeItems = [];
        pick.fireHide();
        expect(cursorLine(h)).toBe(3);
    });
});

describe('onGenerateNextOccurrence', () => {
    it('does nothing without an active editor', async () => {
        await onGenerateNextOccurrence();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        const h = openEditor(['>> - a @daily', 'x'], { cursor: 0, languageId: 'plaintext' });
        await onGenerateNextOccurrence();
        expect(h.lines()).toEqual(['>> - a @daily', 'x']);
    });

    it('asks for a recurring item when the cursor is not on an item', async () => {
        openEditor(['> Header'], { cursor: 0 });
        await onGenerateNextOccurrence();
        expect(mock.recorded.info).toContain('CL: Place cursor on a recurring item');
    });

    it('reports an item with no recurrence marker', async () => {
        openEditor(['>> - one-off', 'x'], { cursor: 0 });
        await onGenerateNextOccurrence();
        expect(mock.recorded.info).toContain('CL: Item has no @daily/@weekly/@monthly marker');
    });

    it('inserts the next weekly occurrence below, moving the date on', async () => {
        const h = openEditor(['>> - Review @weekly @2026-01-01', 'after'], { cursor: 0 });
        await onGenerateNextOccurrence();
        expect(h.lines()).toEqual([
            '>> - Review @weekly @2026-01-01',
            '>> - Review @weekly @2026-01-08',
            'after',
        ]);
    });

    it('advances a daily item by one day', async () => {
        const h = openEditor(['>> - Water @daily @2026-01-31', 'after'], { cursor: 0 });
        await onGenerateNextOccurrence();
        expect(h.lines()[1]).toBe('>> - Water @daily @2026-02-01');
    });

    it('advances a monthly item', async () => {
        const h = openEditor(['>> - Rent @monthly @2026-01-15', 'after'], { cursor: 0 });
        await onGenerateNextOccurrence();
        expect(h.lines()[1]).toBe('>> - Rent @monthly @2026-02-15');
    });

    it('matches the marker case-insensitively', async () => {
        const h = openEditor(['>> - Review @Weekly @2026-01-01', 'after'], { cursor: 0 });
        await onGenerateNextOccurrence();
        expect(h.lines()[1]).toBe('>> - Review @Weekly @2026-01-08');
    });

    it('counts from today when the item has no date', async () => {
        const h = openEditor(['>> - Review @weekly', 'after'], { cursor: 0 });
        await onGenerateNextOccurrence();
        const today = new Date().toISOString().slice(0, 10);
        expect(h.lines()[1]).toMatch(/^>> - Review @weekly @\d{4}-\d{2}-\d{2}$/);
        expect(h.lines()[1].endsWith(`@${today}`)).toBe(false);
    });

    it('keeps the nesting depth', async () => {
        const h = openEditor(['>>>> - Deep @weekly @2026-01-01', 'after'], { cursor: 0 });
        await onGenerateNextOccurrence();
        expect(h.lines()[1]).toBe('>>>> - Deep @weekly @2026-01-08');
    });

    it.failing('BUG: a monthly item due on the 31st does not skip February', async () => {
        const h = openEditor(['>> - Rent @monthly @2026-01-31', 'after'], { cursor: 0 });
        await onGenerateNextOccurrence();
        // Currently '2026-03-03'. nextOccurrence (recurrenceParser) uses Date#setMonth,
        // which overflows "Feb 31" into March -- so February is skipped entirely and
        // the schedule drifts to the 3rd. Expected: clamp to the last day of February.
        expect(h.lines()[1]).toBe('>> - Rent @monthly @2026-02-28');
    });

    it.failing('BUG: keeps a numbered item numbered', async () => {
        const h = openEditor(['>> 3. Review @weekly @2026-01-01', 'after'], { cursor: 0 });
        await onGenerateNextOccurrence();
        // Currently produces '>> - Review @weekly @2026-01-08'.
        expect(h.lines()[1]).toMatch(/^>> \d+\. Review @weekly @2026-01-08$/);
    });

    it.failing('BUG: puts the new item on its own line at the end of a file', async () => {
        const h = openEditor(['> S', '>> - Review @weekly @2026-01-01'], { cursor: 1 });
        await onGenerateNextOccurrence();
        // Currently glues it on: '>> - Review @weekly @2026-01-01>> - Review @weekly @2026-01-08'.
        expect(h.lines()[1]).toBe('>> - Review @weekly @2026-01-01');
        expect(h.lines()[2]).toBe('>> - Review @weekly @2026-01-08');
    });
});
