/**
 * Covers src/sectionFreezeCommands.ts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onFreezeSection, onUnfreezeSection, isSectionFrozen } from '../sectionFreezeCommands';
import { findFrozenMarker, registerLockEnforcement } from '../lockEnforcement';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[]; warning: string[] };
    workspace: Record<string, unknown>;
};
const realWindow = { ...(vscode.window as unknown as Record<string, unknown>) };

beforeEach(() => { mock.__reset(); deactivate(); });
afterEach(() => {
    // Tests that replace a window function must not leak it into later files.
    Object.assign(vscode.window as unknown as Record<string, unknown>, {
        showWarningMessage: realWindow.showWarningMessage,
    });
});

describe('onFreezeSection', () => {
    it('does nothing without an active editor', async () => {
        await onFreezeSection();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        const h = openEditor(['> S', '>> - a'], { languageId: 'plaintext', cursor: 1 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> S', '>> - a']);
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('shows a message when there is no section at the cursor', async () => {
        const h = openEditor(['prose', 'more prose'], { cursor: 1 });
        await onFreezeSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: No section found at cursor');
        expect(h.lines()).toEqual(['prose', 'more prose']);
    });

    it('freezes a header-only section at the end of a file with no trailing newline', async () => {
        const h = openEditor(['> S'], { cursor: 0 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> S', '>> [frozen]']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section frozen');
    });

    it('inserts the marker directly after the header when the section ends at EOF with no trailing newline', async () => {
        const h = openEditor(['> S', '>> - a'], { cursor: 1 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> S', '>> [frozen]', '>> - a']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section frozen');
    });

    it('freezes a mid-file section directly after its header', async () => {
        const h = openEditor(['> A', '>> - a', '> B', '>> - b'], { cursor: 1 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> A', '>> [frozen]', '>> - a', '> B', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section frozen');
    });

    it('finds the header when the cursor is several lines below it', async () => {
        const h = openEditor(['> A', '>> - a', '>> - b', '>> - c'], { cursor: 3 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> A', '>> [frozen]', '>> - a', '>> - b', '>> - c']);
    });

    it('does not freeze twice when the marker is immediately after the header', async () => {
        const h = openEditor(['> S', '>> [frozen]', '>> - a'], { cursor: 2 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> S', '>> [frozen]', '>> - a']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section is already frozen');
    });

    it('detects the marker deeper in the section', async () => {
        const h = openEditor(['> S', '>> - a', '>> - b', '>> [frozen]'], { cursor: 1 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> S', '>> - a', '>> - b', '>> [frozen]']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section is already frozen');
    });

    it('ignores a near-miss marker with a trailing space', async () => {
        const h = openEditor(['> S', '>> [frozen] ', '>> - a'], { cursor: 2 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> S', '>> [frozen]', '>> [frozen] ', '>> - a']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section frozen');
    });

    it('freezes a section when a later section holds the marker', async () => {
        const h = openEditor(['> A', '>> - a', '> B', '>> [frozen]', '>> - b'], { cursor: 1 });
        await onFreezeSection();
        expect(h.lines()).toEqual(['> A', '>> [frozen]', '>> - a', '> B', '>> [frozen]', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section frozen');
    });
});

describe('onUnfreezeSection', () => {
    it('does nothing without an active editor', async () => {
        await onUnfreezeSection();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        const h = openEditor(['> S', '>> [frozen]'], { languageId: 'plaintext', cursor: 1 });
        await onUnfreezeSection();
        expect(h.lines()).toEqual(['> S', '>> [frozen]']);
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('shows a message when there is no section at the cursor', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        await onUnfreezeSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: No section found at cursor');
        expect(h.lines()).toEqual(['prose']);
    });

    it('reports not frozen for a header-only section', async () => {
        const h = openEditor(['> S'], { cursor: 0 });
        await onUnfreezeSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: Section is not frozen');
        expect(h.lines()).toEqual(['> S']);
    });

    it('reports not frozen when the section has items but no marker', async () => {
        const h = openEditor(['> S', '>> - a', '>> - b'], { cursor: 2 });
        await onUnfreezeSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: Section is not frozen');
        expect(h.lines()).toEqual(['> S', '>> - a', '>> - b']);
    });

    it('removes the marker immediately after the header', async () => {
        const h = openEditor(['> A', '>> [frozen]', '>> - a', '> B', '>> - b'], { cursor: 2 });
        await onUnfreezeSection();
        expect(h.lines()).toEqual(['> A', '>> - a', '> B', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section unfrozen');
    });

    it('removes a deeper marker', async () => {
        const h = openEditor(['> S', '>> - a', '>> [frozen]', '>> - b'], { cursor: 1 });
        await onUnfreezeSection();
        expect(h.lines()).toEqual(['> S', '>> - a', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section unfrozen');
    });

    it('removes the marker at the end of a file with no trailing newline', async () => {
        const h = openEditor(['> S', '>> - a', '>> [frozen]'], { cursor: 1 });
        await onUnfreezeSection();
        expect(h.lines()).toEqual(['> S', '>> - a']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section unfrozen');
    });

    it('leaves a later section marker alone when the current section is not frozen', async () => {
        const h = openEditor(['> A', '>> - a', '> B', '>> [frozen]', '>> - b'], { cursor: 1 });
        await onUnfreezeSection();
        expect(h.lines()).toEqual(['> A', '>> - a', '> B', '>> [frozen]', '>> - b']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Section is not frozen');
    });
});

describe('freeze enforcement', () => {
    function register() {
        let onWillSave: (e: { document: unknown }) => void = () => {};
        (mock.workspace as { onWillSaveTextDocument: unknown }).onWillSaveTextDocument =
            (fn: typeof onWillSave) => { onWillSave = fn; return { dispose() {} }; };
        const applied: { operations: { kind: string; range: vscode.Range }[] }[] = [];
        (mock.workspace as { applyEdit: unknown }).applyEdit =
            (e: typeof applied[number]) => { applied.push(e); return Promise.resolve(true); };
        registerLockEnforcement({ subscriptions: [] } as never);
        return { save: (document: unknown) => onWillSave({ document }), applied };
    }
    const settle = () => new Promise(r => setTimeout(r, 0));
    const deleted = (op: { range: vscode.Range }) =>
        [op.range.start.line, op.range.start.character, op.range.end.line, op.range.end.character];

    it('findFrozenMarker locates marker in section', () => {
        const h = openEditor(['> S', '>> [frozen]', '>> - a'], { cursor: 0 });
        expect(findFrozenMarker(h.editor.document as never, 0)).toBe(1);
    });

    it('warns and removes the frozen marker from the saved document', async () => {
        const { save, applied } = register();
        const saved = makeEditor(['> A', '>> [frozen]', '>> - a'], { fileName: 'C:/tmp/frozen.md' });
        const other = openEditor(['> Other', '>> - untouched', '>> - also']);
        save(saved.document);
        await settle();
        expect(mock.recorded.warning.at(-1)).toBe('CL: "A" is frozen - use CL: Unfreeze Section to edit it');
        expect(other.lines()).toEqual(['> Other', '>> - untouched', '>> - also']);
        expect(applied).toHaveLength(1);
        expect(deleted(applied[0].operations[0])).toEqual([1, 0, 2, 0]);
    });

    it('finds the marker where it is when the button is clicked, not where it was', async () => {
        const { save, applied } = register();
        const lines = ['> A', '>> [frozen]', '>> - a'];
        const doc = {
            languageId: 'markdown', uri: vscode.Uri.file('C:/tmp/frozen.md'),
            get lineCount() { return lines.length; },
            lineAt: (i: number) => ({ text: lines[i] }),
        };
        let answer!: (v: string) => void;
        (vscode.window as unknown as { showWarningMessage: unknown }).showWarningMessage =
            () => new Promise<string>(r => { answer = r; });
        save(doc);
        lines.unshift('> Added above while the warning was open');
        answer('Unfreeze Section');
        await settle();
        expect(applied).toHaveLength(1);
        expect(deleted(applied[0].operations[0])).toEqual([2, 0, 3, 0]);
    });
});

describe('isSectionFrozen', () => {
    it('returns false when there is no header above the line', () => {
        const h = makeEditor(['prose', 'more prose']);
        expect(isSectionFrozen(h.document as unknown as vscode.TextDocument, 1)).toBe(false);
    });

    it('returns false for a header-only section', () => {
        const h = makeEditor(['> S']);
        expect(isSectionFrozen(h.document as unknown as vscode.TextDocument, 0)).toBe(false);
    });

    it('returns false when the section has items but no marker', () => {
        const h = makeEditor(['> S', '>> - a', '>> - b']);
        expect(isSectionFrozen(h.document as unknown as vscode.TextDocument, 2)).toBe(false);
    });

    it('returns true when the marker is immediately after the header', () => {
        const h = makeEditor(['> S', '>> [frozen]', '>> - a']);
        expect(isSectionFrozen(h.document as unknown as vscode.TextDocument, 2)).toBe(true);
    });

    it('returns true when the marker is deeper in the section', () => {
        const h = makeEditor(['> S', '>> - a', '>> [frozen]']);
        expect(isSectionFrozen(h.document as unknown as vscode.TextDocument, 1)).toBe(true);
    });

    it('only looks within the section containing the line', () => {
        const h = makeEditor(['> A', '>> - a', '> B', '>> [frozen]', '>> - b']);
        const doc = h.document as unknown as vscode.TextDocument;
        expect(isSectionFrozen(doc, 1)).toBe(false);
        expect(isSectionFrozen(doc, 4)).toBe(true);
    });
});
