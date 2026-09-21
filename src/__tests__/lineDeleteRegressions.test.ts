/**
 * Regression tests for line deletions moved onto wholeLineRanges, and for the
 * archive and lock bugs fixed alongside them. Each was checked against the
 * original code, where it fails.
 *
 *   Last line -- deleting the last line of a file with
 *                `rangeIncludingLineBreak` left the break before it, so the file
 *                gained an empty last line.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onMergeItemWithNext } from '../mergeItemCommands';
import { onRemoveOldItems } from '../removeOldItemsCommands';
import { onRemoveBookmark } from '../bookmarkCommands';
import { onUnlockSection } from '../lockCommands';
import { onUnfreezeSection } from '../sectionFreezeCommands';
import { onShowHiddenSections } from '../visibilityCommands';
import { onToggleNote } from '../noteCommands';
import { buildNoteLine } from '../noteParser';
import { onMoveItemToTop } from '../moveItemEdgeCommands';
import { ChevronCodeActionProvider } from '../codeActionProvider';
import { onArchiveDoneItems, onArchiveSection } from '../archiveCommands';
import { onToggleItemDone } from '../checkCommands';
import { registerLockEnforcement } from '../lockEnforcement';

type Pos = { line: number; character: number };
const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[]; warning: string[] };
    queued: { inputBox: (string | undefined)[]; message: (string | undefined)[] };
    workspace: Record<string, unknown>;
};
const realWorkspace = { ...mock.workspace };
const realWindow = { ...(vscode.window as unknown as Record<string, unknown>) };

beforeEach(() => { mock.__reset(); deactivate(); });
afterEach(() => {
    Object.assign(mock.workspace, realWorkspace);
    // Tests that replace a window function must not leak it into later files.
    Object.assign(vscode.window as unknown as Record<string, unknown>, {
        showWarningMessage: realWindow.showWarningMessage,
    });
});

describe('deleting the last line leaves no empty line behind', () => {
    it('merge item with next', async () => {
        const h = openEditor(['>> - a', '>> - b'], { cursor: 0 });
        await onMergeItemWithNext();
        expect(h.lines()).toEqual(['>> - a — b']);
    });

    it('remove old items', async () => {
        const h = openEditor(['> A', '>> - keep', '>> - old @created:2020-01-01']);
        mock.queued.inputBox.push('30');
        await onRemoveOldItems();
        expect(h.lines()).toEqual(['> A', '>> - keep']);
    });

    it('remove bookmark', async () => {
        const h = openEditor(['> A', '>> [bookmark:here]'], { cursor: 1 });
        await onRemoveBookmark();
        expect(h.lines()).toEqual(['> A']);
    });

    it('unlock section', async () => {
        const h = openEditor(['> A', '>> [locked]'], { cursor: 0 });
        await onUnlockSection();
        expect(h.lines()).toEqual(['> A']);
    });

    it('unfreeze section', async () => {
        const h = openEditor(['> A', '>> [frozen]'], { cursor: 0 });
        await onUnfreezeSection();
        expect(h.lines()).toEqual(['> A']);
    });

    it('show hidden sections', async () => {
        const h = openEditor(['> A', '>> [hidden]', '> B', '>> [hidden]']);
        await onShowHiddenSections();
        expect(h.lines()).toEqual(['> A', '> B']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Revealed 2 hidden sections');
    });

    it('toggle a note off', async () => {
        const h = openEditor(['> A', '>> - a', buildNoteLine('>>', 'a note')], { cursor: 1 });
        await onToggleNote();
        expect(h.lines()).toEqual(['> A', '>> - a']);
    });

    it('move the last item to the top', async () => {
        const h = openEditor(['> A', '>> - a', '>> - b'], { cursor: 2 });
        await onMoveItemToTop();
        expect(h.lines()).toEqual(['> A', '>> - b', '>> - a']);
    });

    it('delete an empty section that is the last line (quick fix)', async () => {
        const h = makeEditor(['> A', '>> - a', '> Empty']);
        const d = new vscode.Diagnostic(new vscode.Range(2, 0, 2, 1), 'empty', vscode.DiagnosticSeverity.Warning);
        d.code = 'empty-section';
        d.source = 'Chevron Lists';
        const [, del] = new ChevronCodeActionProvider().provideCodeActions(
            h.document as never, new vscode.Range(0, 0, 0, 0),
            { diagnostics: [d], only: undefined, triggerKind: 1 } as never
        );
        const op = (del.edit as unknown as { operations: { range: vscode.Range }[] }).operations[0];
        await (h.editor as { edit(cb: (eb: { delete(r: vscode.Range): void }) => void): Promise<boolean> })
            .edit(eb => eb.delete(op.range));
        expect(h.lines()).toEqual(['> A', '>> - a']);
    });
});

describe('archive done items', () => {
    it('appends to the Archive’s items, not past its blank separator', async () => {
        const h = openEditor(['> Todo', '>> - [x] done', '>> - [ ] open', '', '> Archive', '>> - [x] old', '', '> Later'], { cursor: 0 });
        await onArchiveDoneItems();
        expect(h.lines()).toEqual(['> Todo', '>> - [ ] open', '', '> Archive', '>> - [x] old', '>> - [x] done', '', '> Later']);
    });

    it('adds to an Archive header that is the last line, on its own line', async () => {
        const h = openEditor(['> Todo', '>> - [x] done', '> Archive'], { cursor: 0 });
        await onArchiveDoneItems();
        expect(h.lines()).toEqual(['> Todo', '> Archive', '>> - [x] done']);
    });

    it('does nothing in a section that is already archived', async () => {
        const h = openEditor(['> Archive', '>> - [x] a', '>> - [x] b'], { cursor: 0 });
        await onArchiveDoneItems();
        expect(h.lines()).toEqual(['> Archive', '>> - [x] a', '>> - [x] b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: These items are already in the Archive');
    });
});

describe('archive section', () => {
    it('adds the section after an Archive header that is the last line, on its own line', async () => {
        const h = openEditor(['> S', '>> - s', '> Archive'], { cursor: 0 });
        await onArchiveSection();
        expect(h.lines()).toEqual(['> Archive', '> S', '>> - s']);
    });

    it('does nothing for a section already sitting straight after the Archive', async () => {
        const h = openEditor(['> Archive', '>> - old', '', '> S', '>> - s'], { cursor: 3 });
        await onArchiveSection();
        expect(h.lines()).toEqual(['> Archive', '>> - old', '', '> S', '>> - s']);
        expect(mock.recorded.info.at(-1)).toBe('CL: This section is already archived');
    });

    it('archives a later section when the Archive is at the top of the file', async () => {
        const h = openEditor(['> Archive', '>> - old', '', '> Todo', '>> - t', '', '> S', '>> - s'], { cursor: 6 });
        await onArchiveSection();
        expect(h.lines()).toEqual(['> Archive', '>> - old', '> S', '>> - s', '', '> Todo', '>> - t', '']);
    });

    it('creates the Archive for the last section without dropping the file’s trailing newline', async () => {
        const h = openEditor(['> A', '>> - a', '', '> S', '>> - s', ''], { cursor: 3 });
        await onArchiveSection();
        expect(h.lines()).toEqual(['> A', '>> - a', '', '> Archive', '> S', '>> - s', '']);
    });
});

describe('auto-archive on toggling done', () => {
    it('archives several items at once when the Archive is above them', async () => {
        // Moving them one at a time reused stale line numbers and deleted "> Todo".
        mock.__setConfig('chevron-lists.autoArchive', true);
        const h = openEditor(['> Archive', '> Todo', '>> - [ ] one', '>> - keep', '>> - [ ] two']);
        h.setSelections([[2, 2], [4, 4]]);
        await onToggleItemDone();
        expect(h.lines()).toEqual(['> Archive', '>> - [x] one', '>> - [x] two', '> Todo', '>> - keep']);
    });

    it('adds to an Archive header that is the last line, on its own line', async () => {
        mock.__setConfig('chevron-lists.autoArchive', true);
        const h = openEditor(['> Todo', '>> - [ ] one', '> Archive'], { cursor: 1 });
        await onToggleItemDone();
        expect(h.lines()).toEqual(['> Todo', '> Archive', '>> - [x] one']);
    });
});

describe('lock enforcement: Unlock Section', () => {
    function register() {
        let onWillSave: (e: { document: unknown }) => void = () => {};
        mock.workspace.onWillSaveTextDocument = (fn: typeof onWillSave) => { onWillSave = fn; return { dispose() {} }; };
        const applied: { operations: { kind: string; range: vscode.Range }[] }[] = [];
        mock.workspace.applyEdit = (e: typeof applied[number]) => { applied.push(e); return Promise.resolve(true); };
        registerLockEnforcement({ subscriptions: [] } as never);
        return { save: (document: unknown) => onWillSave({ document }), applied };
    }
    const settle = () => new Promise(r => setTimeout(r, 0));
    const deleted = (op: { range: vscode.Range }) =>
        [op.range.start.line, op.range.start.character, op.range.end.line, op.range.end.character];

    it('removes the marker from the saved document, not from whichever editor is active', async () => {
        const { save, applied } = register();
        const saved = makeEditor(['> A', '>> [locked]', '>> - a'], { fileName: 'C:/tmp/locked.md' });
        const other = openEditor(['> Other', '>> - untouched', '>> - also']);
        save(saved.document);
        await settle();
        expect(other.lines()).toEqual(['> Other', '>> - untouched', '>> - also']);
        expect(applied).toHaveLength(1);
        expect(deleted(applied[0].operations[0])).toEqual([1, 0, 2, 0]);
    });

    it('finds the marker where it is when the button is clicked, not where it was', async () => {
        const { save, applied } = register();
        const lines = ['> A', '>> [locked]', '>> - a'];
        const doc = {
            languageId: 'markdown', uri: vscode.Uri.file('C:/tmp/locked.md'),
            get lineCount() { return lines.length; },
            lineAt: (i: number) => ({ text: lines[i] }),
        };
        let answer!: (v: string) => void;
        (vscode.window as unknown as { showWarningMessage: unknown }).showWarningMessage =
            () => new Promise<string>(r => { answer = r; });
        save(doc);
        lines.unshift('> Added above while the warning was open');
        answer('Unlock Section');
        await settle();
        expect(applied).toHaveLength(1);
        expect(deleted(applied[0].operations[0])).toEqual([2, 0, 3, 0]);
    });
});
