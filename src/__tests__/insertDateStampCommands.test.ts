/**
 * Covers src/insertDateStampCommands.ts.
 *
 * The stamp was inserted beside the primary cursor only, leaving any selected
 * text in place and ignoring other cursors. It now replaces every selection,
 * as typing would; the regression tests were checked against the original code.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onInsertDateStamp } from '../insertDateStampCommands';
import { todayDate } from '../patterns';

type Pos = { line: number; character: number };
type Sel = { anchor: Pos; active: Pos };
const mock = vscode as unknown as { __reset(): void };
const stamp = () => `@${todayDate()}`;

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onInsertDateStamp', () => {
    it('does nothing without an active editor', async () => {
        await onInsertDateStamp();
        expect((vscode.window as { activeTextEditor?: unknown }).activeTextEditor).toBeUndefined();
    });

    it('inserts today’s date at the cursor and leaves the cursor after it', async () => {
        const h = openEditor(['>> - due '], { cursor: 0, character: 9 });
        await onInsertDateStamp();
        expect(h.lines()).toEqual([`>> - due ${stamp()}`]);
        const active = (h.editor as { selection: Sel }).selection.active;
        expect([active.line, active.character]).toEqual([0, 9 + stamp().length]);
    });

    it('replaces the selected text', async () => {
        const h = openEditor(['>> - due @soon']);
        const ed = h.editor as { selections: Sel[]; selection: Sel };
        ed.selections = [new vscode.Selection(new vscode.Position(0, 9), new vscode.Position(0, 14))];
        ed.selection = ed.selections[0];
        await onInsertDateStamp();
        expect(h.lines()).toEqual([`>> - due ${stamp()}`]);
    });

    it('stamps at every cursor', async () => {
        const h = openEditor(['a', 'b']);
        h.setSelections([[0, 0], [1, 1]]);
        await onInsertDateStamp();
        expect(h.lines()).toEqual([`${stamp()}a`, `${stamp()}b`]);
    });
});
