/**
 * Numbered lists are per parent: the children of two different items are two
 * lists, each starting at 1. Every numbering feature used to key lists by depth
 * across the whole section instead, so a correctly restarted child list was
 * flagged as out of sequence, auto-fix (on by default) renumbered it as the
 * user typed, and Renumber, Rebase, Set List Start and bullet conversion
 * numbered it as a continuation. Separately, the bad-numbering quick fix
 * rewrote the flagged item, whose number was already right.
 *
 * The end-to-end tests below were checked against the original code, where
 * they fail.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { NumberingRuns, prevNumberInRun, nextInRun } from '../numberingRuns';
import { prevNumberAtDepth } from '../documentUtils';
import { collectIssues } from '../diagnostics';
import { computeAutoFixEdits } from '../patterns';
import { renumber, onRenumberItems, onConvertBulletsToNumbered } from '../sortCommands';
import { onRebaseListFromHere } from '../listRebaseCommands';
import { onSetListStartNumber } from '../listStartCommands';
import { ChevronCodeActionProvider } from '../codeActionProvider';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
    queued: { inputBox: (string | undefined)[] };
};
const doc = (lines: string[]) => ({ lineCount: lines.length, lineAt: (i: number) => ({ text: lines[i] }) });

/** Two parents, each with a child list that restarts at 1. Correct as written. */
const NESTED = ['> S', '>> 1. a', '>>> 1. a1', '>>> 2. a2', '>> 2. b', '>>> 1. b1', '>>> 2. b2'];

beforeEach(() => { mock.__reset(); deactivate(); });

describe('NumberingRuns', () => {
    const runsOf = (lines: string[], asNumbered: (t: string) => boolean = () => false) => {
        const runs = new NumberingRuns();
        return lines.map(t => runs.visit(t, asNumbered(t)));
    };

    it('gives the child lists of different parents different runs', () => {
        const r = runsOf(NESTED);
        expect(r[0]).toBeNull();
        expect(r[2]).toBe(r[3]);
        expect(r[1]).toBe(r[4]);
        expect(r[5]).not.toBe(r[2]);
        expect(r[5]).toBe(r[6]);
    });

    it('continues a list past bullets, notes and prose at the same or deeper depth', () => {
        const r = runsOf(['>> 1. a', '>> - bullet', '>>> - child', 'prose', '', '>> 2. b']);
        expect(r[0]).toBe(r[5]);
        expect([r[1], r[2], r[3], r[4]]).toEqual([null, null, null, null]);
    });

    it('ends every list at a header', () => {
        const r = runsOf(['>> 1. a', '> T', '>> 1. b']);
        expect(r[0]).not.toBe(r[2]);
    });

    it('can place a line that is about to be numbered into a run', () => {
        const r = runsOf(['>> 1. a', '>> - b'], t => t.includes('- '));
        expect(r[1]).toBe(r[0]);
    });
});

describe('prevNumberInRun / nextInRun', () => {
    it('finds the previous number in the same list, skipping deeper and non-numbered lines', () => {
        expect(prevNumberInRun(doc(['>> 3. a', '>>> 1. x', '>> - b', 'prose', '>> c']), 4, '>>')).toBe(3);
    });

    it('starts a new list below a shallower line or a header', () => {
        expect(prevNumberInRun(doc(NESTED), 5, '>>>')).toBe(0);
        expect(prevNumberInRun(doc(['>> 1. a', '> T', '>> x']), 2, '>>')).toBe(0);
        expect(prevNumberAtDepth(doc(NESTED), 5, '>>>')).toBe(0);
    });

    it('finds the next item in the same list, or -1 when the list ends', () => {
        expect(nextInRun(doc(NESTED), 2, '>>>')).toBe(3);
        expect(nextInRun(doc(NESTED), 3, '>>>')).toBe(-1);
        expect(nextInRun(doc(['>> 1. a', '> T', '>> 2. b']), 0, '>>')).toBe(-1);
        expect(nextInRun(doc(['>> 1. a', '>>> - x', 'prose', '>> 2. b']), 0, '>>')).toBe(3);
        expect(nextInRun(doc(['>> 1. a', '>> - bullet', '>> 2. b']), 0, '>>')).toBe(2);
    });
});

describe('a correctly restarted child list is left alone', () => {
    it('by the numbering diagnostic', () => {
        expect(collectIssues(doc(NESTED), '-').filter(i => i.kind === 'bad-numbering')).toEqual([]);
    });

    it('by auto-fix as you type', () => {
        expect(computeAutoFixEdits(NESTED.map((text, lineIndex) => ({ text, lineIndex })))).toEqual([]);
    });

    it('by renumber', () => {
        expect(renumber(NESTED)).toEqual(NESTED);
    });
});

describe('genuine breaks are still caught within a list', () => {
    const BROKEN = ['> S', '>> 1. a', '>>> 1. a1', '>>> 3. a2', '>> 2. b', '>>> 1. b1', '>>> 1. b2'];

    it('diagnostics flag the item before each break', () => {
        expect(collectIssues(doc(BROKEN), '-').filter(i => i.kind === 'bad-numbering').map(i => i.line)).toEqual([2, 5]);
    });

    it('auto-fix renumbers only the broken lists', () => {
        expect(computeAutoFixEdits(BROKEN.map((text, lineIndex) => ({ text, lineIndex })))).toEqual([
            { lineIndex: 3, newText: '>>> 2. a2' },
            { lineIndex: 6, newText: '>>> 2. b2' },
        ]);
    });

    it('renumber numbers each list from 1', () => {
        expect(renumber(BROKEN)).toEqual(NESTED);
    });
});

describe('commands number each list separately', () => {
    it('Renumber Items', async () => {
        const h = openEditor(['> S', '>> 3. a', '>>> 4. a1', '>> 9. b', '>>> 7. b1'], { cursor: 0 });
        await onRenumberItems();
        expect(h.lines()).toEqual(['> S', '>> 1. a', '>>> 1. a1', '>> 2. b', '>>> 1. b1']);
    });

    it('Rebase List From Here continues each list from its own last number', async () => {
        const h = openEditor(['> S', '>> 1. a', '>>> 1. a1', '>> 5. b', '>>> 4. b1', '>>> 9. b2'], { cursor: 3 });
        await onRebaseListFromHere();
        expect(h.lines()).toEqual(['> S', '>> 1. a', '>>> 1. a1', '>> 2. b', '>>> 1. b1', '>>> 2. b2']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Rebased 3 items');
    });

    it('Set List Start renumbers only the cursor item’s list', async () => {
        const h = openEditor(['> S', '>> 1. a', '>>> 1. a1', '>> 2. b', '', '> T', '>> 1. other'], { cursor: 1 });
        mock.queued.inputBox.push('5');
        await onSetListStartNumber();
        expect(h.lines()).toEqual(['> S', '>> 5. a', '>>> 1. a1', '>> 6. b', '', '> T', '>> 1. other']);
    });

    it('Set List Start on a child list leaves its parent list alone', async () => {
        const h = openEditor(['> S', '>> 1. a', '>>> 1. a1', '>>> 2. a2', '>> 2. b', '>>> 1. b1'], { cursor: 2 });
        mock.queued.inputBox.push('10');
        await onSetListStartNumber();
        expect(h.lines()).toEqual(['> S', '>> 1. a', '>>> 10. a1', '>>> 11. a2', '>> 2. b', '>>> 1. b1']);
    });

    it('Convert Bullets to Numbered continues each list, not every list at that depth', async () => {
        const h = openEditor(['> S', '>> 1. a', '>>> 1. a1', '>>> - a2', '>> 2. b', '>>> - b1'], { cursor: 0 });
        await onConvertBulletsToNumbered();
        expect(h.lines()).toEqual(['> S', '>> 1. a', '>>> 1. a1', '>>> 2. a2', '>> 2. b', '>>> 1. b1']);
    });
});

describe('the bad-numbering quick fix', () => {
    function quickFixFor(lines: string[]) {
        const h = makeEditor(lines);
        const [issue] = collectIssues(doc(lines), '-').filter(i => i.kind === 'bad-numbering');
        const d = new vscode.Diagnostic(new vscode.Range(issue.line, 0, issue.line, 1), issue.message, vscode.DiagnosticSeverity.Warning);
        d.code = 'bad-numbering';
        d.source = 'Chevron Lists';
        const [fix] = new ChevronCodeActionProvider().provideCodeActions(
            h.document as never, new vscode.Range(0, 0, 0, 0),
            { diagnostics: [d], only: undefined, triggerKind: 1 } as never
        );
        return { h, fix };
    }

    it('fixes the item the diagnostic complains about', async () => {
        const { h, fix } = quickFixFor(['> S', '>> 1. a', '>> 2. b', '>> 5. c']);
        expect(fix.title).toBe('CL: Fix: change 5 to 3');
        const op = (fix.edit as unknown as { operations: { range: vscode.Range; text: string }[] }).operations[0];
        await (h.editor as { edit(cb: (eb: { replace(r: vscode.Range, t: string): void }) => void): Promise<boolean> })
            .edit(eb => eb.replace(op.range, op.text));
        expect(h.lines()).toEqual(['> S', '>> 1. a', '>> 2. b', '>> 3. c']);
        expect(collectIssues(doc(h.lines()), '-').filter(i => i.kind === 'bad-numbering')).toEqual([]);
    });

    it('offers no per-item fix once the flagged item has nothing after it', () => {
        const h = makeEditor(['> S', '>> 1. a']);
        const d = new vscode.Diagnostic(new vscode.Range(1, 0, 1, 1), 'stale', vscode.DiagnosticSeverity.Warning);
        d.code = 'bad-numbering';
        d.source = 'Chevron Lists';
        const titles = new ChevronCodeActionProvider().provideCodeActions(
            h.document as never, new vscode.Range(0, 0, 0, 0),
            { diagnostics: [d], only: undefined, triggerKind: 1 } as never
        ).map(a => a.title);
        expect(titles).toEqual(['CL: Fix all numbering in file']);
    });
});
