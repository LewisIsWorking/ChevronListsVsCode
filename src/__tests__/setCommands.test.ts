import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onMoveItemToSection } from '../moveItemToSectionCommands';
import { updateSetTotalsDecorations } from '../setTotalsDecoration';

const mock = vscode as unknown as {
    __reset(): void;
    queued: { quickPick: unknown[] };
};

beforeEach(() => { mock.__reset(); deactivate(); });

const doc = ['# Bikes #set', '> Paid.', '>> 1. Lewis.', '', "> Hasn't paid.", '>> 1. Ethan.', '>> 2. Luke.',
    '', '> Not going.', '>> 1. Ethan.', '', '# Other', '> Elsewhere', '>> - Jo'];

describe('move item to section inside a set', () => {
    it('moves to the end of the chosen list and renumbers both', async () => {
        const h = openEditor(doc, { cursor: 6 });
        mock.queued.quickPick.push({ label: 'Paid.', headerLine: 1 });
        await onMoveItemToSection();
        expect(h.lines().slice(0, 9)).toEqual(['# Bikes #set', '> Paid.', '>> 1. Lewis.', '>> 2. Luke.', '',
            "> Hasn't paid.", '>> 1. Ethan.', '', '> Not going.']);
    });

    it('offers only the set\'s other lists', async () => {
        openEditor(doc, { cursor: 5 });
        let offered: unknown[] = [];
        const win = vscode.window as unknown as { showQuickPick: (items: unknown[]) => Promise<unknown> };
        const real = win.showQuickPick;
        win.showQuickPick = (items: unknown[]) => { offered = items; return Promise.resolve(undefined); };
        try { await onMoveItemToSection(); } finally { win.showQuickPick = real; }
        expect(offered.map(o => (o as { label: string }).label)).toEqual(['Paid.', 'Not going.']);
    });
});

describe('set totals decoration', () => {
    it('shows one set of totals per #set heading', () => {
        const h = makeEditor(doc);
        updateSetTotalsDecorations(h.editor as never);
        expect(h.decorations.at(-1)!.count).toBe(1);
    });
});
