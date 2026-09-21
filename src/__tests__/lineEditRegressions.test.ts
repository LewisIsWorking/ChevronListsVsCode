/**
 * Regression tests for the commands moved onto lineEdits.ts, one or more per
 * bug. Each was checked against the original code, where it fails.
 *
 *   End of file  -- inserting at Position(line + 1, 0) on the last line of a
 *                   file with no trailing newline glued the text onto that line.
 *   Section end  -- "append to the section" inserted after the blank lines that
 *                   separate a section from the next header, detaching the item.
 *   Stale cursor -- reading the cursor after an edit that had already moved it.
 *   One-offs     -- noted on each test.
 *
 * Full coverage of each command lives in its own test file; these are only the
 * bugs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onCloneItem, onCloneItemToSection } from '../cloneCommands';
import { onCloneItemAsDone, onCloneItemStripped } from '../cloneTransformCommands';
import { onDuplicateItemAndIncrement } from '../duplicateIncrementCommands';
import { onLockSection } from '../lockCommands';
import { onFreezeSection } from '../sectionFreezeCommands';
import { onHideSection } from '../visibilityCommands';
import { onMoveItemToTop, onMoveItemToBottom } from '../moveItemEdgeCommands';
import { onInsertRecurringItem } from '../recurringTemplateCommands';
import { onDuplicateSection } from '../sectionCommands';
import { onSuggestItems, onSummariseSection, onExpandItem } from '../aiCommands';
import { onCloneSection } from '../cloneSectionCommands';
import { ChevronCodeActionProvider } from '../codeActionProvider';
import { onInsertItemSnippet } from '../itemSnippetCommands';
import { onSetListStartNumber } from '../listStartCommands';
import { onMoveItemToFile } from '../moveItemToFileCommands';
import { onMoveItemToSection } from '../moveItemToSectionCommands';
import { onToggleNote } from '../noteCommands';
import { onPasteAsBullets, onPasteAsNumbered } from '../pasteCommands';
import { onSmartPaste } from '../smartPasteCommands';
import { onQuickCapture } from '../quickCapture';
import { onSendToDailyNote } from '../sendToDailyNoteCommands';
import { onArchiveOldDoneItems } from '../archiveOldDoneCommands';

type Pos = { line: number; character: number };
type Op = { kind: string; position?: Pos; text?: string };
const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[]; warning: string[]; error: string[]; clipboard: string };
    queued: { quickPick: unknown[]; inputBox: (string | undefined)[] };
    window: { activeTextEditor: unknown };
    workspace: {
        applyEdit(e: unknown): Promise<boolean>;
        openTextDocument(u: unknown): Promise<unknown>;
        findFiles(...a: unknown[]): Promise<unknown[]>;
        workspaceFolders: unknown;
    };
};
const cursorOf = (e: unknown) => {
    const a = (e as { selection: { active: Pos } }).selection.active;
    return [a.line, a.character];
};
const at = (p?: Pos) => (p ? [p.line, p.character] : undefined);

const realWorkspace = { ...mock.workspace };
const realFetch = globalThis.fetch;

beforeEach(() => { mock.__reset(); deactivate(); });
afterEach(() => {
    Object.assign(mock.workspace, realWorkspace);
    globalThis.fetch = realFetch;
});

describe('clone item', () => {
    it('clones to the end of the section, not past its blank separator', async () => {
        const h = openEditor(['> A', '>> - a', '', '> B', '>> - b'], { cursor: 1 });
        await onCloneItem();
        expect(h.lines()).toEqual(['> A', '>> - a', '>> - a', '', '> B', '>> - b']);
        expect(cursorOf(h.editor)).toEqual([2, 0]);
    });

    it('clones onto its own line at the end of a file with no trailing newline', async () => {
        const h = openEditor(['> A', '>> - a'], { cursor: 1 });
        await onCloneItem();
        expect(h.lines()).toEqual(['> A', '>> - a', '>> - a']);
    });

    it('clones into a chosen last section onto its own line', async () => {
        const h = openEditor(['> A', '>> - a', '> B', '>> - b'], { cursor: 1 });
        mock.queued.quickPick.push({ label: 'B', lineIndex: 2 });
        await onCloneItemToSection();
        expect(h.lines()).toEqual(['> A', '>> - a', '> B', '>> - b', '>> - a']);
    });
});

describe('clone transforms and duplicate-and-increment at the end of the file', () => {
    it('clone as done', async () => {
        const h = openEditor(['>> - task'], { cursor: 0 });
        await onCloneItemAsDone();
        expect(h.lines()).toEqual(['>> - task', '>> - [x] task']);
    });

    it('clone stripped', async () => {
        const h = openEditor(['>> - task #tag'], { cursor: 0 });
        await onCloneItemStripped();
        expect(h.lines()).toEqual(['>> - task #tag', '>> - task']);
    });

    it('duplicate and increment keeps the cursor column', async () => {
        const h = openEditor(['>> - step 1'], { cursor: 0, character: 6 });
        await onDuplicateItemAndIncrement();
        expect(h.lines()).toEqual(['>> - step 1', '>> - step 2']);
        expect(cursorOf(h.editor)).toEqual([1, 6]);
    });
});

describe('section markers on an empty last section', () => {
    // The marker used to be glued onto the header, renaming the section.
    it('lock', async () => {
        const h = openEditor(['> A'], { cursor: 0 });
        await onLockSection();
        expect(h.lines()).toEqual(['> A', '>> [locked]']);
    });

    it('freeze', async () => {
        const h = openEditor(['> A'], { cursor: 0 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> A', '>> [frozen]']);
    });

    it('hide', async () => {
        const h = openEditor(['> A'], { cursor: 0 });
        await onHideSection();
        expect(h.lines()).toEqual(['> A', '>> [hidden]']);
    });
});

describe('move item to top / bottom', () => {
    it('keeps the cursor column when moving to the top', async () => {
        const h = openEditor(['> A', '>> - a', '>> - b', '>> - c'], { cursor: 2, character: 4 });
        await onMoveItemToTop();
        expect(h.lines()).toEqual(['> A', '>> - b', '>> - a', '>> - c']);
        expect(cursorOf(h.editor)).toEqual([1, 4]);
    });

    it('moves to the last item, not past the blank separator', async () => {
        const h = openEditor(['> A', '>> - a', '>> - b', '', '> B'], { cursor: 1, character: 3 });
        await onMoveItemToBottom();
        expect(h.lines()).toEqual(['> A', '>> - b', '>> - a', '', '> B']);
        expect(cursorOf(h.editor)).toEqual([2, 3]);
    });

    it('does nothing for the last item when blank lines follow it', async () => {
        const h = openEditor(['> A', '>> - a', '>> - b', '', '> B'], { cursor: 2 });
        await onMoveItemToBottom();
        expect(h.lines()).toEqual(['> A', '>> - a', '>> - b', '', '> B']);
    });

    it('moves to the bottom onto its own line at the end of a file with no trailing newline', async () => {
        const h = openEditor(['> A', '>> - a', '>> - b'], { cursor: 1, character: 2 });
        await onMoveItemToBottom();
        expect(h.lines()).toEqual(['> A', '>> - b', '>> - a']);
        expect(cursorOf(h.editor)).toEqual([2, 2]);
    });
});

describe('inserting after the cursor line at the end of the file', () => {
    it('recurring item template', async () => {
        const h = openEditor(['notes'], { cursor: 0 });
        mock.queued.quickPick.push({ tmpl: { content: '[ ] Daily standup @daily' } });
        await onInsertRecurringItem();
        expect(h.lines()).toEqual(['notes', '>> - [ ] Daily standup @daily']);
        expect(cursorOf(h.editor)).toEqual([1, '>> - [ ] Daily standup @daily'.length]);
    });

    it('item snippet', async () => {
        const h = openEditor(['notes'], { cursor: 0 });
        mock.queued.quickPick.push({ snippet: { template: '* ${1:note}' } });
        await onInsertItemSnippet();
        expect(h.lines()).toEqual(['notes', '>> - ']);
        expect(cursorOf(h.editor)).toEqual([1, 5]);
    });

    it('list start number, insert mode', async () => {
        const h = openEditor(['notes'], { cursor: 0 });
        mock.queued.inputBox.push('5');
        await onSetListStartNumber();
        expect(h.lines()).toEqual(['notes', '>> 5. ']);
        expect(cursorOf(h.editor)).toEqual([1, 6]);
    });

    it('toggle note', async () => {
        const h = openEditor(['> A', '>> - a'], { cursor: 1 });
        await onToggleNote();
        expect(h.lines()).toHaveLength(3);
        expect(h.lines()[1]).toBe('>> - a');
        expect(h.lines()[2]).toContain('Note text here');
    });

    it('paste as bullets', async () => {
        const h = openEditor(['>> - a'], { cursor: 0 });
        mock.recorded.clipboard = 'x\ny';
        await onPasteAsBullets();
        expect(h.lines()).toEqual(['>> - a', '>> - x', '>> - y']);
    });

    it('paste as numbered', async () => {
        const h = openEditor(['> A', '>> 1. a'], { cursor: 1 });
        mock.recorded.clipboard = 'x';
        await onPasteAsNumbered();
        expect(h.lines()).toEqual(['> A', '>> 1. a', '>> 2. x']);
    });

    it('smart paste', async () => {
        const h = openEditor(['>> - a'], { cursor: 0 });
        mock.recorded.clipboard = '- x';
        await onSmartPaste();
        expect(h.lines()[0]).toBe('>> - a');
        expect(h.lines()).toHaveLength(2);
    });
});

describe('duplicate section', () => {
    it('places the copy on its own lines at the end of a file with no trailing newline', async () => {
        const h = openEditor(['> A', '>> - a'], { cursor: 1 });
        await onDuplicateSection();
        expect(h.lines()).toEqual(['> A', '>> - a', '> A', '>> - a']);
    });

    it('keeps the file’s spacing when the file ends with a newline', async () => {
        // Used to give ['> A', '>> - a', '> A', '>> - a', '', '']: no gap, two blank lines at the end.
        const h = openEditor(['> A', '>> - a', ''], { cursor: 1 });
        await onDuplicateSection();
        expect(h.lines()).toEqual(['> A', '>> - a', '', '> A', '>> - a', '']);
    });
});

describe('clone section', () => {
    it('leaves one blank line before the copy and lands the cursor on its header', async () => {
        // Used to leave two blank lines and put the cursor on the copy's first item.
        const h = openEditor(['> A', '>> - a', '', '> B'], { cursor: 1 });
        await onCloneSection();
        expect(h.lines()).toEqual(['> A', '>> - a', '', '> A (copy)', '>> - a', '', '> B']);
        expect(cursorOf(h.editor)).toEqual([3, 0]);
    });

    it('lands the cursor on the copy’s header at the end of a file with no trailing newline', async () => {
        const h = openEditor(['> A', '>> - a'], { cursor: 1 });
        await onCloneSection();
        expect(h.lines()).toEqual(['> A', '>> - a', '', '> A (copy)', '>> - a']);
        expect(cursorOf(h.editor)).toEqual([3, 0]);
    });
});

describe('empty-section quick fix', () => {
    it('adds the placeholder on its own line when the empty section is the last line', () => {
        const { document } = makeEditor(['> Empty']);
        const d = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), 'empty', vscode.DiagnosticSeverity.Warning);
        d.code = 'empty-section';
        d.source = 'Chevron Lists';
        const [add] = new ChevronCodeActionProvider().provideCodeActions(
            document as never, new vscode.Range(0, 0, 0, 0),
            { diagnostics: [d], only: undefined, triggerKind: 1 } as never
        );
        const op = (add.edit as unknown as { operations: Op[] }).operations[0];
        expect(at(op.position)).toEqual([0, 7]);
        expect(op.text).toBe('\n>> - Item');
    });
});

describe('move item to another section', () => {
    it('appends to the end of the destination’s items, not past its blank separator', async () => {
        const h = openEditor(['> A', '>> - a', '', '> B', '>> - b'], { cursor: 4 });
        mock.queued.quickPick.push({ label: 'A', headerLine: 0 });
        await onMoveItemToSection();
        expect(h.lines()).toEqual(['> A', '>> - a', '>> - b', '', '> B']);
    });
});

describe('move item to another file', () => {
    function setUp(destLines: string[]) {
        const h = openEditor(['> Src', '>> - moving', '>> - stays'], { cursor: 1 });
        const dest = makeEditor(destLines, { fileName: 'C:/tmp/dest.md' });
        const destUri = vscode.Uri.file('C:/tmp/dest.md');
        mock.workspace.findFiles = () => Promise.resolve([destUri]);
        mock.workspace.openTextDocument = () => Promise.resolve(dest.document);
        mock.queued.quickPick.push({ label: 'dest.md', uri: destUri }, { label: 'Dest', headerLine: 0 });
        const applied: Op[][] = [];
        mock.workspace.applyEdit = (e: unknown) => {
            applied.push((e as { operations: Op[] }).operations);
            return Promise.resolve(true);
        };
        return { h, applied };
    }

    it('appends after the destination section’s items, not past its blank separator', async () => {
        const { applied } = setUp(['> Dest', '>> - d', '', '> Other']);
        await onMoveItemToFile();
        expect(at(applied[0][0].position)).toEqual([2, 0]);
        expect(applied[0][0].text).toBe('>> - moving\n');
    });

    it('keeps the item when the destination edit is rejected', async () => {
        // The source line used to be deleted whatever applyEdit returned, losing the item.
        const { h } = setUp(['> Dest', '>> - d']);
        mock.workspace.applyEdit = () => Promise.resolve(false);
        await onMoveItemToFile();
        expect(h.lines()).toEqual(['> Src', '>> - moving', '>> - stays']);
        expect(mock.recorded.error.at(-1)).toBe('CL: Could not add the item to dest.md; nothing was moved');
    });
});

describe('quick capture', () => {
    it('appends to the end of the section’s items, not past its blank separator', async () => {
        const h = openEditor(['> A', '>> - a', '', '> B'], { cursor: 0 });
        const context = { workspaceState: { get: (_k: string, d: unknown) => d } };
        mock.queued.quickPick.push({ label: 'A', lineIndex: 0 });
        mock.queued.inputBox.push('new');
        await onQuickCapture(context as never);
        expect(h.lines()).toEqual(['> A', '>> - a', '>> - new', '', '> B']);
    });
});

describe('send to daily note', () => {
    it('adds under an Inbox header that is the last line, on its own line', async () => {
        openEditor(['>> - idea'], { cursor: 0 });
        mock.__setConfig('chevron-lists.dailyNotesFolder', 'daily');
        mock.workspace.workspaceFolders = [{ uri: vscode.Uri.file('C:/ws') }];
        const note = makeEditor(['# today', '', '> Inbox']);
        mock.workspace.openTextDocument = () => Promise.resolve(note.document);
        const applied: Op[][] = [];
        mock.workspace.applyEdit = (e: unknown) => {
            applied.push((e as { operations: Op[] }).operations);
            return Promise.resolve(true);
        };
        await onSendToDailyNote();
        expect(at(applied[0][0].position)).toEqual([2, 7]);
        expect(applied[0][0].text).toBe('\n>> - idea');
    });
});

describe('AI commands', () => {
    function reply(text: string) {
        mock.__setConfig('chevron-lists.anthropicApiKey', 'test-key');
        globalThis.fetch = (() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ content: [{ type: 'text', text }] }),
        })) as unknown as typeof fetch;
    }

    it('adds suggestions after the section’s items, not past its blank separator', async () => {
        const h = openEditor(['> A', '>> - a', '', '> B'], { cursor: 1 });
        reply('first idea');
        mock.queued.quickPick.push([{ label: 'first idea' }]);
        await onSuggestItems();
        expect(h.lines()).toEqual(['> A', '>> - a', '>> - first idea', '', '> B']);
    });

    it('adds suggestions to the section the command ran on even if the cursor moves while waiting', async () => {
        const h = openEditor(['> A', '>> - a', '> B', '>> - b'], { cursor: 1 });
        mock.__setConfig('chevron-lists.anthropicApiKey', 'test-key');
        globalThis.fetch = (() => {
            // The user moves to section B while Claude is thinking.
            const ed = h.editor as { selection: unknown };
            ed.selection = new vscode.Selection(new vscode.Position(3, 0), new vscode.Position(3, 0));
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ content: [{ type: 'text', text: 'idea' }] }) });
        }) as unknown as typeof fetch;
        mock.queued.quickPick.push([{ label: 'idea' }]);
        await onSuggestItems();
        expect(h.lines()).toEqual(['> A', '>> - a', '>> - idea', '> B', '>> - b']);
    });

    it('writes the summary with the configured bullet prefix', async () => {
        // It was always written with "-".
        mock.__setConfig('chevron-lists.listPrefix', '*');
        const h = openEditor(['> A', '>> * a', ''], { cursor: 1 });
        reply('A short summary');
        await onSummariseSection();
        expect(h.lines()).toEqual(['> A', '>> * _A short summary_', '>> * a', '']);
    });

    it('inserts nothing when Claude suggests no sub-items', async () => {
        // An empty reply used to insert a blank line under the item.
        const h = openEditor(['> A', '>> - a', '>> - b'], { cursor: 1 });
        reply('   \n');
        await onExpandItem();
        expect(h.lines()).toEqual(['> A', '>> - a', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Claude suggested no sub-items');
    });

    it('expands the last item of a file with no trailing newline onto new lines', async () => {
        const h = openEditor(['> A', '>> - a'], { cursor: 1 });
        reply('one\ntwo');
        await onExpandItem();
        expect(h.lines()).toEqual(['> A', '>> - a', '>>> - one', '>>> - two']);
    });
});

describe('archive old done items', () => {
    const old = '@created:2020-01-01';

    it('moves items into an existing Archive in document order, leaving archived items alone', async () => {
        const h = openEditor([
            '> Todo', `>> - [x] one ${old}`, `>> - [x] two ${old}`,
            '> Archive', `>> - [x] earlier ${old}`,
        ]);
        mock.queued.inputBox.push('30');
        await onArchiveOldDoneItems();
        expect(mock.recorded.warning.at(-1)).toBe('Archive 2 done items older than 30 days?');
        expect(h.lines()).toEqual([
            '> Todo',
            '> Archive', `>> - [x] one ${old}`, `>> - [x] two ${old}`, `>> - [x] earlier ${old}`,
        ]);
    });

    it('creates a single Archive section for several items', async () => {
        const h = openEditor(['> Todo', `>> - [x] one ${old}`, `>> - [x] two ${old}`, '>> - [ ] open']);
        mock.queued.inputBox.push('30');
        await onArchiveOldDoneItems();
        expect(h.lines()).toEqual(['> Todo', '>> - [ ] open', '', '> Archive', `>> - [x] one ${old}`, `>> - [x] two ${old}`]);
    });

    it('says "1 day", not "1 days"', async () => {
        openEditor(['> Todo', '>> - [ ] open']);
        mock.queued.inputBox.push('1');
        await onArchiveOldDoneItems();
        expect(mock.recorded.info.at(-1)).toBe('CL: No done items older than 1 day found');
    });
});
