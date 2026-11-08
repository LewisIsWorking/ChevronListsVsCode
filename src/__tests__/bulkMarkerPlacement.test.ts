/**
 * The bulk commands put what they add among an item's words, so a checkbox and
 * priority stay leading and a vote and comment stay last.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onBulkSetDueDate, onBulkSetPriority, onBulkTagItems } from '../bulkCommands';
import { onSetExpiryOnAllItems } from '../bulkExpiryCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { inputBoxCalls: { validateInput(v: string): string | null }[] };
    queued: { inputBox: (string | undefined)[]; quickPick: unknown[] };
};

describe('bulk marker placement', () => {
    beforeEach(() => mock.__reset());
    afterEach(() => deactivate());

    it('Bulk Tag goes before the vote and comment', async () => {
        const h = openEditor(['> S', '>> - a +2 // note'], { cursor: 1 });
        mock.queued.inputBox.push('x');
        await onBulkTagItems();
        expect(h.lines()[1]).toBe('>> - a #x +2 // note');
    });

    it('Bulk Tag is not fooled by a tag in a comment', async () => {
        const h = openEditor(['> S', '>> - a // about #x'], { cursor: 1 });
        mock.queued.inputBox.push('x');
        await onBulkTagItems();
        expect(h.lines()[1]).toBe('>> - a #x // about #x');
    });

    it('Bulk Set Priority keeps the checkbox first and replaces the old priority', async () => {
        const h = openEditor(['> S', '>> - [x] ! a // note', '>> - b'], { cursor: 1 });
        mock.queued.quickPick.push({ value: '!!!' });
        await onBulkSetPriority();
        expect(h.lines().slice(1)).toEqual(['>> - [x] !!! a // note', '>> - !!! b']);
    });

    it('Bulk Set Due Date replaces the item date and leaves the comment', async () => {
        const h = openEditor(['> S', '>> - a @2026-01-01 +2 // from @2025-01-01'], { cursor: 1 });
        mock.queued.inputBox.push('2026-02-02');
        await onBulkSetDueDate();
        expect(h.lines()[1]).toBe('>> - a @2026-02-02 +2 // from @2025-01-01');
    });

    it('Bulk Set Due Date goes before a comment', async () => {
        const h = openEditor(['> S', '>> - a // note'], { cursor: 1 });
        mock.queued.inputBox.push('2026-02-02');
        await onBulkSetDueDate();
        expect(h.lines()[1]).toBe('>> - a @2026-02-02 // note');
    });

    it('Set Expiry goes before the vote and comment', async () => {
        const h = openEditor(['> S', '>> - a +2 // note'], { cursor: 1 });
        mock.queued.inputBox.push('2026-02-02');
        await onSetExpiryOnAllItems();
        expect(h.lines()[1]).toBe('>> - a @expires:2026-02-02 +2 // note');
    });

    it('Set Expiry replaces an expiry among the words, not one in a comment', async () => {
        const h = openEditor(['> S', '>> - @expires:2026-01-01 a // was @expires:2025-01-01'], { cursor: 1 });
        mock.queued.inputBox.push('2026-02-02');
        await onSetExpiryOnAllItems();
        expect(h.lines()[1]).toBe('>> - @expires:2026-02-02 a // was @expires:2025-01-01');
    });

    it('the date prompts refuse a date the calendar does not have', async () => {
        openEditor(['> S', '>> - a'], { cursor: 1 });
        await onBulkSetDueDate();
        await onSetExpiryOnAllItems();
        const [due, expiry] = mock.recorded.inputBoxCalls;
        expect(due.validateInput('2026-02-30')).toBe('Format must be YYYY-MM-DD');
        expect(due.validateInput('2026-02-28')).toBeNull();
        expect(expiry.validateInput('2026-02-30')).toBe('Enter a date as YYYY-MM-DD');
        expect(expiry.validateInput('2026-02-28')).toBeNull();
    });
});
