/**
 * Covers src/listRebaseCommands.ts. ITEM-TRANSFORM family.
 *
 * Offset List Numbers skipped items that would go below 1 while moving the
 * rest, breaking the sequence ("1, 2, 10" by -5 gave "1, 2, 5") with a message
 * that only counted what moved. It is now all or nothing; the regression test
 * was checked against the original code. Per-list numbering for Rebase is
 * covered in numberingRuns.test.ts.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onRebaseListFromHere, onOffsetListNumbers } from '../listRebaseCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[]; inputBoxCalls: { validateInput(v: string): string | null }[] };
    queued: { inputBox: (string | undefined)[] };
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onRebaseListFromHere', () => {
    it('does nothing without an active editor or outside markdown', async () => {
        await onRebaseListFromHere();
        openEditor(['> S', '>> 3. a'], { cursor: 1, languageId: 'plaintext' });
        await onRebaseListFromHere();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('asks for a numbered item', async () => {
        openEditor(['> S', '>> - a'], { cursor: 1 });
        await onRebaseListFromHere();
        expect(mock.recorded.info.at(-1)).toBe('CL: Place cursor on a numbered item to rebase from here');
    });

    it('does nothing for a numbered item outside any section', async () => {
        const h = openEditor(['>> 4. a'], { cursor: 0 });
        await onRebaseListFromHere();
        expect(h.lines()).toEqual(['>> 4. a']);
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('renumbers from the cursor, continuing from the item above', async () => {
        const h = openEditor(['> S', '>> 1. a', 'prose', '>> 7. b', '>> - bullet', '>> 3. c'], { cursor: 3 });
        await onRebaseListFromHere();
        expect(h.lines()).toEqual(['> S', '>> 1. a', 'prose', '>> 2. b', '>> - bullet', '>> 3. c']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Rebased 1 item');
    });

    it('reports when everything is already in sequence', async () => {
        openEditor(['> S', '>> 1. a', '>> 2. b'], { cursor: 1 });
        await onRebaseListFromHere();
        expect(mock.recorded.info.at(-1)).toBe('CL: All items already in sequence');
    });
});

describe('onOffsetListNumbers', () => {
    it('does nothing without an active editor or outside markdown', async () => {
        await onOffsetListNumbers();
        openEditor(['> S', '>> 1. a'], { languageId: 'plaintext' });
        await onOffsetListNumbers();
        expect(mock.recorded.inputBoxCalls).toHaveLength(0);
    });

    it('reports when the cursor is not in a section', async () => {
        openEditor(['prose'], { cursor: 0 });
        await onOffsetListNumbers();
        expect(mock.recorded.info.at(-1)).toBe('CL: No section found at cursor');
    });

    it('accepts only a non-zero integer and does nothing when cancelled', async () => {
        const h = openEditor(['> S', '>> 1. a'], { cursor: 0 });
        await onOffsetListNumbers();
        const validate = mock.recorded.inputBoxCalls[0].validateInput;
        expect(validate('10')).toBeNull();
        expect(validate('-5')).toBeNull();
        expect(validate('0')).toBe('Enter a non-zero integer');
        expect(validate('x')).toBe('Enter a non-zero integer');
        expect(h.lines()).toEqual(['> S', '>> 1. a']);
    });

    it('offsets every numbered item in the section', async () => {
        const h = openEditor(['> S', '>> 1. a', '>> - bullet', '>>> 2. b', '> T', '>> 1. other'], { cursor: 1 });
        mock.queued.inputBox.push('10');
        await onOffsetListNumbers();
        expect(h.lines()).toEqual(['> S', '>> 11. a', '>> - bullet', '>>> 12. b', '> T', '>> 1. other']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Offset 2 items by +10');
    });

    it('says "1 item" and shows a negative offset as is', async () => {
        const h = openEditor(['> S', '>> 8. a'], { cursor: 0 });
        mock.queued.inputBox.push('-3');
        await onOffsetListNumbers();
        expect(h.lines()).toEqual(['> S', '>> 5. a']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Offset 1 item by -3');
    });

    it('changes nothing when any item would go below 1', async () => {
        const h = openEditor(['> S', '>> 1. a', '>> 2. b', '>> 10. c'], { cursor: 0 });
        mock.queued.inputBox.push('-5');
        await onOffsetListNumbers();
        expect(h.lines()).toEqual(['> S', '>> 1. a', '>> 2. b', '>> 10. c']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Offsetting by -5 would take 2 items below 1 — nothing changed');
    });

    it('says "1 item" when one item would go below 1', async () => {
        openEditor(['> S', '>> 1. a', '>> 9. b'], { cursor: 0 });
        mock.queued.inputBox.push('-1');
        await onOffsetListNumbers();
        expect(mock.recorded.info.at(-1)).toBe('CL: Offsetting by -1 would take 1 item below 1 — nothing changed');
    });

    it('reports a section with no numbered items', async () => {
        openEditor(['> S', '>> - a'], { cursor: 0 });
        mock.queued.inputBox.push('2');
        await onOffsetListNumbers();
        expect(mock.recorded.info.at(-1)).toBe('CL: No numbered items to offset');
    });
});
