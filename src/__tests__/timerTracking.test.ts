/**
 * Covers the item and section timers when the document changes while they run,
 * and what the item timer's stamp replaces.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, Harness } from './helpers/editorHarness';
import { onStartItemTimer, onStopItemTimer } from '../itemTimerCommands';
import { onStartSectionTimer, onStopSectionTimer } from '../sectionTimer';

interface Op { range: { start: { line: number } }; text: string; }
type Edited = { operations: Op[] };
type Window = { activeTextEditor: unknown; visibleTextEditors: unknown[]; createStatusBarItem: (...a: unknown[]) => { text: string } };

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
    workspace: { applyEdit(e: unknown): Promise<boolean>; textDocuments?: unknown[] };
};
const win = vscode.window as unknown as Window;
const realApply = mock.workspace.applyEdit;
const realBar = win.createStatusBarItem;
let applied: Op[];

function trackFile(h: Harness): void { mock.workspace.textDocuments = [h.document]; }

function insertAtTop(h: Harness, text: string): Promise<boolean> {
    const editor = h.editor as { edit(cb: (b: { insert(p: vscode.Position, t: string): void }) => void): Promise<boolean> };
    return editor.edit(b => b.insert(new vscode.Position(0, 0), text));
}

function replaceLine(h: Harness, line: number, text: string): Promise<boolean> {
    const editor = h.editor as { edit(cb: (b: { replace(r: vscode.Range, t: string): void }) => void): Promise<boolean> };
    return editor.edit(b => b.replace(new vscode.Range(line, 0, line, 999), text));
}

beforeEach(() => {
    mock.__reset();
    applied = [];
    mock.workspace.applyEdit = e => { applied.push(...(e as Edited).operations); return Promise.resolve(true); };
});

afterEach(async () => {
    await onStopItemTimer();
    await onStopSectionTimer();
    mock.workspace.applyEdit = realApply;
    win.createStatusBarItem = realBar;
});

describe('Stop Item Timer stamp', () => {
    async function stampOf(line: string): Promise<string> {
        trackFile(openEditor(['> A', line], { cursor: 1 }));
        await onStartItemTimer();
        await onStopItemTimer();
        return applied[0].text;
    }

    it('replaces a whole stamp with hours and minutes', async () => {
        expect(await stampOf('>> - task ~1h 5m')).toBe('>> - task ~0s');
    });

    it('replaces a short estimate', async () => {
        expect(await stampOf('>> - task ~2h')).toBe('>> - task ~0s');
    });

    it('keeps a word that starts with a tilde', async () => {
        expect(await stampOf('>> - see ~notes')).toBe('>> - see ~notes ~0s');
    });
});

describe('Stop Item Timer when the file changed', () => {
    it('stamps the item after lines were added above it', async () => {
        const h = openEditor(['> A', '>> - task', '>> - other'], { cursor: 1 });
        trackFile(h);
        await onStartItemTimer();
        await insertAtTop(h, '> New\n>> - x\n');
        await onStopItemTimer();
        expect(applied[0].range.start.line).toBe(3);
        expect(applied[0].text).toBe('>> - task ~0s');
    });

    it('picks the nearest copy of a repeated item', async () => {
        const h = openEditor(['> A', '>> - same', '>> - other', '>> - same'], { cursor: 3 });
        trackFile(h);
        await onStartItemTimer();
        await insertAtTop(h, '> New\n');
        await onStopItemTimer();
        expect(applied[0].range.start.line).toBe(4);
    });

    it('stamps an item edited where it stands', async () => {
        const h = openEditor(['> A', '>> - task'], { cursor: 1 });
        trackFile(h);
        await onStartItemTimer();
        await replaceLine(h, 1, '>> - better task');
        await onStopItemTimer();
        expect(applied[0].text).toBe('>> - better task ~0s');
    });

    it('stamps nothing when the item was both edited and moved', async () => {
        const h = openEditor(['> A', '>> - task', '>> - other'], { cursor: 1 });
        trackFile(h);
        await onStartItemTimer();
        await replaceLine(h, 1, '>> - changed');
        await insertAtTop(h, '> New\n>> - y\n');
        await onStopItemTimer();
        expect(applied).toEqual([]);
        expect(mock.recorded.info.at(-1)).toContain('elapsed');
    });
});

describe('Section timer display', () => {
    const tick = () => new Promise(resolve => setTimeout(resolve, 1300));
    function showing(active: Harness, ...visible: Harness[]): void {
        win.activeTextEditor = active.editor;
        win.visibleTextEditors = visible.map(h => h.editor);
    }

    it('does not decorate another file', async () => {
        const a = openEditor(['> A', '>> - a'], { cursor: 0, fileName: 'C:/tmp/a.md' });
        await onStartSectionTimer();
        const b = makeEditor(['> B', '>> - b'], { fileName: 'C:/tmp/b.md' });
        showing(b, b);
        await tick();
        expect(b.decorations).toEqual([]);
        expect(a.decorations.length).toBe(1);
    });

    it('clears the decoration from its file when another file is active', async () => {
        const a = openEditor(['> A', '>> - a'], { cursor: 0, fileName: 'C:/tmp/a.md' });
        await onStartSectionTimer();
        const b = makeEditor(['> B'], { fileName: 'C:/tmp/b.md' });
        showing(b, a, b);
        await onStopSectionTimer();
        expect(a.decorations.at(-1)?.count).toBe(0);
    });

    it('keeps the decoration on the header when lines are added above it', async () => {
        const a = openEditor(['> A', '>> - a'], { cursor: 0 });
        const lines: number[] = [];
        (a.editor as { setDecorations: unknown }).setDecorations =
            (_t: unknown, r: { range: { start: { line: number } } }[]) => { lines.push(...r.map(x => x.range.start.line)); };
        await onStartSectionTimer();
        await insertAtTop(a, 'first\nsecond\n');
        await tick();
        expect(lines.at(-1)).toBe(2);
    });

    it('keeps counting in the status bar in a file that is not markdown', async () => {
        let bar: { text: string } | undefined;
        win.createStatusBarItem = (...a: unknown[]) => { bar = realBar(...a); return bar; };
        openEditor(['> A'], { cursor: 0 });
        await onStartSectionTimer();
        const other = makeEditor(['text'], { languageId: 'plaintext', fileName: 'C:/tmp/c.txt' });
        showing(other, other);
        await tick();
        expect(bar?.text).toContain('0:01');
    });
});
