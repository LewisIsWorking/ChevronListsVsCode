/**
 * Tests for the test harness itself. Command tests are only as good as the fake
 * editor they run against, and a fake that is kinder than VS Code hides bugs:
 * one that never moved the cursor let commands read a stale cursor after an
 * edit, and one that never clamped positions let them insert past the end.
 */
import { describe, it, expect } from 'bun:test';
import * as vscode from 'vscode';
import { makeEditor } from './helpers/editorHarness';

type Pos = { line: number; character: number };
type Ed = {
    selection: { anchor: Pos; active: Pos };
    selections: { anchor: Pos; active: Pos }[];
    edit(cb: (eb: {
        insert(p: vscode.Position, t: string): void;
        replace(r: vscode.Range, t: string): void;
        delete(r: vscode.Range): void;
    }) => void): Promise<boolean>;
};
const at = (p: Pos) => [p.line, p.character];

describe('position clamping', () => {
    it('inserting on the line after the last line appends to the file', async () => {
        const h = makeEditor(['a', 'b']);
        await (h.editor as Ed).edit(eb => eb.insert(new vscode.Position(2, 0), 'X'));
        expect(h.lines()).toEqual(['a', 'bX']);
    });

    it('a character past the end of a line is the end of that line', async () => {
        const h = makeEditor(['ab', 'cd']);
        await (h.editor as Ed).edit(eb => eb.insert(new vscode.Position(0, 99), 'X'));
        expect(h.lines()).toEqual(['abX', 'cd']);
    });

    it('negative coordinates clamp to the start', async () => {
        const h = makeEditor(['ab']);
        await (h.editor as Ed).edit(eb => eb.insert(new vscode.Position(-1, -5), 'X'));
        expect(h.lines()).toEqual(['Xab']);
    });
});

describe('selections move with edits', () => {
    it('an insertion on an earlier line pushes the cursor down', async () => {
        const h = makeEditor(['a', 'b', 'c'], { cursor: 2, character: 1 });
        await (h.editor as Ed).edit(eb => eb.insert(new vscode.Position(0, 0), 'new\n'));
        expect(at((h.editor as Ed).selection.active)).toEqual([3, 1]);
    });

    it('an insertion after the cursor leaves it alone', async () => {
        const h = makeEditor(['a', 'b'], { cursor: 0, character: 1 });
        await (h.editor as Ed).edit(eb => eb.insert(new vscode.Position(1, 0), 'new\n'));
        expect(at((h.editor as Ed).selection.active)).toEqual([0, 1]);
    });

    it('an empty cursor at the insertion point ends up after the new text', async () => {
        const h = makeEditor(['ab'], { cursor: 0, character: 1 });
        await (h.editor as Ed).edit(eb => eb.insert(new vscode.Position(0, 1), 'XY'));
        expect(at((h.editor as Ed).selection.active)).toEqual([0, 3]);
    });

    it('a cursor inside a replaced range moves to the end of the replacement', async () => {
        const h = makeEditor(['hello world'], { cursor: 0, character: 3 });
        await (h.editor as Ed).edit(eb => eb.replace(new vscode.Range(0, 0, 0, 5), 'hi'));
        expect(at((h.editor as Ed).selection.active)).toEqual([0, 2]);
    });

    it('a deletion before the cursor pulls it back', async () => {
        const h = makeEditor(['abcdef'], { cursor: 0, character: 5 });
        await (h.editor as Ed).edit(eb => eb.delete(new vscode.Range(0, 0, 0, 2)));
        expect(at((h.editor as Ed).selection.active)).toEqual([0, 3]);
    });

    it('a non-empty selection grows when text is inserted at either edge', async () => {
        const h = makeEditor(['abcd']);
        h.setSelections([[0, 0]]);
        const ed = h.editor as Ed;
        ed.selections = [new vscode.Selection(new vscode.Position(0, 1), new vscode.Position(0, 3))];
        await ed.edit(eb => { eb.insert(new vscode.Position(0, 1), '<'); eb.insert(new vscode.Position(0, 3), '>'); });
        expect(h.lines()).toEqual(['a<bc>d']);
        expect(at(ed.selection.anchor)).toEqual([0, 1]);
        expect(at(ed.selection.active)).toEqual([0, 5]);
    });

    it('moves every cursor, not just the primary one', async () => {
        const h = makeEditor(['a', 'b', 'c']);
        h.setSelections([[1, 1], [2, 2]]);
        const ed = h.editor as Ed;
        await ed.edit(eb => eb.insert(new vscode.Position(0, 0), 'x\n'));
        expect(ed.selections.map(s => at(s.active))).toEqual([[2, 0], [3, 0]]);
    });
});

describe('several inserts at one position', () => {
    it('keep the order they were made in', async () => {
        const h = makeEditor(['ab']);
        await (h.editor as Ed).edit(eb => {
            eb.insert(new vscode.Position(0, 1), '1');
            eb.insert(new vscode.Position(0, 1), '2');
            eb.insert(new vscode.Position(0, 1), '3');
        });
        expect(h.lines()).toEqual(['a123b']);
    });
});

describe('edits are relative to the original text', () => {
    it('an insert touching the start of a deletion survives it', async () => {
        const h = makeEditor(['keep', 'drop']);
        await (h.editor as Ed).edit(eb => {
            eb.delete(new vscode.Range(0, 4, 1, 4));
            eb.insert(new vscode.Position(0, 4), '!');
        });
        expect(h.lines()).toEqual(['keep!']);
    });

    it('rejects overlapping ranges, as VS Code does', () => {
        const h = makeEditor(['abcdef']);
        expect(() => (h.editor as Ed).edit(eb => {
            eb.delete(new vscode.Range(0, 0, 0, 4));
            eb.replace(new vscode.Range(0, 2, 0, 5), 'X');
        })).toThrow('Overlapping ranges are not allowed!');
    });
});
