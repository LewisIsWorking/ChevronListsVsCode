/**
 * Covers src/shiftDueDatesCommands.ts. ITEM-TRANSFORM family.
 *
 * Three bugs, fixed, with regression tests checked against the original code:
 * every @YYYY-MM-DD on every line moved, prose and notes included; the count
 * was of lines, so a line with two dates said "Shifted 1 date"; and one day
 * read "by +1 days".
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onShiftAllDueDates } from '../shiftDueDatesCommands';

const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[]; inputBoxCalls: { prompt: string; validateInput(v: string): string | null }[] };
    queued: { inputBox: (string | undefined)[] };
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onShiftAllDueDates', () => {
    it('does nothing without an active editor', async () => {
        await onShiftAllDueDates();
        expect(mock.recorded.inputBoxCalls).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['> S', '>> - a @2026-01-01'], { languageId: 'plaintext' });
        await onShiftAllDueDates();
        expect(mock.recorded.inputBoxCalls).toHaveLength(0);
    });

    it('accepts only a non-zero integer', async () => {
        openEditor(['> S']);
        await onShiftAllDueDates();
        const validate = mock.recorded.inputBoxCalls[0].validateInput;
        expect(validate('7')).toBeNull();
        expect(validate(' -3 ')).toBeNull();
        expect(validate('0')).toBe('Enter a non-zero integer');
        expect(validate('1.5')).toBe('Enter a non-zero integer');
        expect(validate('soon')).toBe('Enter a non-zero integer');
    });

    it('does nothing when the prompt is cancelled or blank', async () => {
        const h = openEditor(['> S', '>> - a @2026-01-01'], { cursor: 1 });
        await onShiftAllDueDates();
        mock.queued.inputBox.push('  ');
        await onShiftAllDueDates();
        expect(h.lines()).toEqual(['> S', '>> - a @2026-01-01']);
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('reports when the cursor is not in a section', async () => {
        openEditor(['prose @2026-01-01'], { cursor: 0 });
        mock.queued.inputBox.push('1');
        await onShiftAllDueDates();
        expect(mock.recorded.info.at(-1)).toBe('CL: No section found at cursor');
    });

    it('shifts the due dates of bullet and numbered items in the section only', async () => {
        const h = openEditor([
            '> S', '>> - a @2026-01-30', '>> 1. b @2026-02-28', '> T', '>> - c @2026-01-01',
        ], { cursor: 1 });
        mock.queued.inputBox.push('2');
        await onShiftAllDueDates();
        expect(h.lines()).toEqual([
            '> S', '>> - a @2026-02-01', '>> 1. b @2026-03-02', '> T', '>> - c @2026-01-01',
        ]);
        expect(mock.recorded.info.at(-1)).toBe('CL: Shifted 2 dates by +2 days');
    });

    it('leaves dates in prose and notes alone', async () => {
        const h = openEditor(['> S', 'Agreed on @2026-01-01', '>> > note @2026-01-01', '>> - task @2026-01-01'], { cursor: 0 });
        mock.queued.inputBox.push('7');
        await onShiftAllDueDates();
        expect(h.lines()).toEqual(['> S', 'Agreed on @2026-01-01', '>> > note @2026-01-01', '>> - task @2026-01-08']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Shifted 1 date by +7 days');
    });

    it('counts every date, not every line', async () => {
        const h = openEditor(['> S', '>> - from @2026-01-01 to @2026-01-05'], { cursor: 0 });
        mock.queued.inputBox.push('1');
        await onShiftAllDueDates();
        expect(h.lines()[1]).toBe('>> - from @2026-01-02 to @2026-01-06');
        expect(mock.recorded.info.at(-1)).toBe('CL: Shifted 2 dates by +1 day');
    });

    it('moves dates back and says "day" for one', async () => {
        const h = openEditor(['> S', '>> - a @2026-03-01'], { cursor: 0 });
        mock.queued.inputBox.push('-1');
        await onShiftAllDueDates();
        expect(h.lines()[1]).toBe('>> - a @2026-02-28');
        expect(mock.recorded.info.at(-1)).toBe('CL: Shifted 1 date by -1 day');
    });

    it('uses the configured bullet prefix to recognise items', async () => {
        mock.__setConfig('chevron-lists.listPrefix', '*');
        const h = openEditor(['> S', '>> * a @2026-01-01', '>> - not an item here @2026-01-01'], { cursor: 0 });
        mock.queued.inputBox.push('1');
        await onShiftAllDueDates();
        expect(h.lines()).toEqual(['> S', '>> * a @2026-01-02', '>> - not an item here @2026-01-01']);
    });

    it('reports when no item in the section has a due date', async () => {
        openEditor(['> S', '>> - a', 'prose @2026-01-01'], { cursor: 0 });
        mock.queued.inputBox.push('3');
        await onShiftAllDueDates();
        expect(mock.recorded.info.at(-1)).toBe('CL: No due dates found in this section');
    });
});
