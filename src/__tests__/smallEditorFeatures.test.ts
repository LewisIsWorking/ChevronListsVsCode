/**
 * Covers six small modules with no bugs found on review: foldAllCommands,
 * decorationProvider, foldingProvider, templateCommands, pinState and
 * diagnosticCleanup.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onFoldAllSections, onUnfoldAllSections } from '../foldAllCommands';
import { updateDecorations } from '../decorationProvider';
import { ChevronFoldingProvider } from '../foldingProvider';
import { getTemplates, onInsertTemplate } from '../templateCommands';
import { BUILT_IN_TEMPLATES } from '../templateData';
import { getPinnedSections, togglePin, isPinned } from '../pinState';
import { clearAllDiagnostics } from '../diagnosticCleanup';
import { getChevronDiagCollection } from '../diagnosticProvider';
import { getWordGoalDiagCollection } from '../wordGoalCommands';
import { getExpiryDiagCollection } from '../expiryDiagnostics';

const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { commands: { command: string }[]; quickPickCalls: { items: { label: string }[]; options: Record<string, unknown> }[] };
    queued: { quickPick: unknown[] };
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('fold all / unfold all', () => {
    it('run the editor’s own fold commands', async () => {
        await onFoldAllSections();
        await onUnfoldAllSections();
        expect(mock.recorded.commands.map(c => c.command)).toEqual(['editor.foldAll', 'editor.unfoldAll']);
    });
});

describe('updateDecorations', () => {
    it('marks every header line in markdown', () => {
        const h = makeEditor(['> A', '>> - a', '> B', '>>> not a header']);
        updateDecorations(h.editor as never);
        expect(h.decorations.at(-1)!.count).toBe(2);
    });

    it('clears the markers outside markdown', () => {
        const h = makeEditor(['> A'], { languageId: 'plaintext' });
        updateDecorations(h.editor as never);
        expect(h.decorations.at(-1)!.count).toBe(0);
    });
});

describe('ChevronFoldingProvider', () => {
    const ranges = (lines: string[]) => new ChevronFoldingProvider()
        .provideFoldingRanges(makeEditor(lines).document as never)
        .map(r => [r.start, r.end]);

    it('folds each section from its header to the line before the next header', () => {
        expect(ranges(['intro', '> A', '>> - a', '', '> B', '>> - b', '>> - c'])).toEqual([[1, 3], [4, 6]]);
    });

    it('does not fold a header with nothing under it', () => {
        expect(ranges(['> A', '> B', '>> - b', '> C'])).toEqual([[1, 2]]);
    });

    it('has nothing to fold without headers', () => {
        expect(ranges(['>> - a', 'prose'])).toEqual([]);
    });
});

describe('templates', () => {
    it('lists the built-in templates followed by the user’s', () => {
        const mine = { name: 'Mine', description: 'd', body: '> ${1:x}' };
        mock.__setConfig('chevron-lists.templates', [mine]);
        expect(getTemplates()).toEqual([...BUILT_IN_TEMPLATES, mine]);
    });

    it('does nothing without an active editor', async () => {
        await onInsertTemplate();
        expect(mock.recorded.quickPickCalls).toHaveLength(0);
    });

    it('offers every template, searching descriptions too, and inserts nothing when cancelled', async () => {
        const h = openEditor(['']);
        await onInsertTemplate();
        const call = mock.recorded.quickPickCalls[0];
        expect(call.items.map(i => i.label)).toEqual(BUILT_IN_TEMPLATES.map(t => t.name));
        expect(call.options).toEqual({ placeHolder: 'Select a template to insert', matchOnDescription: true });
        expect(h.snippets).toEqual([]);
    });

    it('inserts the chosen template as a snippet', async () => {
        const h = openEditor(['']);
        mock.queued.quickPick.push({ template: BUILT_IN_TEMPLATES[0] });
        await onInsertTemplate();
        expect(h.snippets).toEqual([BUILT_IN_TEMPLATES[0].body]);
    });
});

describe('pinned sections', () => {
    function context(initial?: string[]) {
        const store = new Map<string, unknown>(initial ? [['chevron-lists.pinnedSections', initial]] : []);
        return {
            workspaceState: {
                get: <T>(k: string, d: T) => (store.has(k) ? store.get(k) : d) as T,
                update: (k: string, v: unknown) => { store.set(k, v); return Promise.resolve(); },
            },
            store,
        };
    }

    it('reads pins case-insensitively and starts empty', () => {
        expect([...getPinnedSections(context() as never)]).toEqual([]);
        const ctx = context(['Inbox']);
        expect(isPinned(ctx as never, 'INBOX')).toBe(true);
        expect(isPinned(ctx as never, 'Other')).toBe(false);
    });

    it('toggles a pin on and off, saving each time', async () => {
        const ctx = context();
        expect(await togglePin(ctx as never, 'Work')).toBe(true);
        expect(ctx.store.get('chevron-lists.pinnedSections')).toEqual(['work']);
        expect(await togglePin(ctx as never, 'WORK')).toBe(false);
        expect(ctx.store.get('chevron-lists.pinnedSections')).toEqual([]);
    });
});

describe('clearAllDiagnostics', () => {
    it('drops the document from every diagnostic collection', () => {
        const uri = vscode.Uri.file('C:/tmp/notes.md');
        const other = vscode.Uri.file('C:/tmp/other.md');
        const dueDates = vscode.languages.createDiagnosticCollection('due');
        const all = [getChevronDiagCollection(), getWordGoalDiagCollection(), getExpiryDiagCollection(), dueDates];
        for (const c of all) { c.set(uri, []); c.set(other, []); }
        clearAllDiagnostics(uri, dueDates);
        expect(all.map(c => c.has(uri))).toEqual([false, false, false, false]);
        expect(all.map(c => c.has(other))).toEqual([true, true, true, true]);
    });
});
