/**
 * Covers src/findReplaceCommands.ts. SECTION-REPORT family.
 *
 * Replace is scoped twice -- to the cursor's section, and within it to item
 * lines only -- so both boundaries get a test. Replacement uses split/join,
 * which replaces EVERY occurrence on a line, not just the first; that is
 * asserted because it is easy to assume otherwise.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate, type Harness } from './helpers/editorHarness';
import { onReplaceInSection, onFindInSections } from '../findReplaceCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[]; inputBoxCalls: { prompt: string; placeHolder: string }[] };
    queued: { inputBox: (string | undefined)[] };
    quickPicks: unknown[];
    lastQuickPick(): {
        items: { label: string; description?: string; lineIndex: number }[];
        activeItems: unknown[];
        placeholder: string;
        disposed: boolean;
        fireActive(items: unknown[]): void;
        fireAccept(): void;
        fireHide(): void;
    };
};

const lastInfo = () => mock.recorded.info.at(-1);
const cursorLine = (h: Harness) =>
    (h.editor as { selection: { active: { line: number } } }).selection.active.line;

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onReplaceInSection', () => {
    it('does nothing without an active editor', async () => {
        await onReplaceInSection();
        expect(mock.recorded.inputBoxCalls).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['> S', '>> - cat'], { cursor: 1, languageId: 'plaintext' });
        await onReplaceInSection();
        expect(mock.recorded.inputBoxCalls).toHaveLength(0);
    });

    it('stops when the find prompt is cancelled', async () => {
        const h = openEditor(['> S', '>> - cat'], { cursor: 1 });
        await onReplaceInSection();
        expect(mock.recorded.inputBoxCalls).toHaveLength(1);
        expect(h.lines()).toEqual(['> S', '>> - cat']);
    });

    it('stops when the find term is blank', async () => {
        openEditor(['> S', '>> - cat'], { cursor: 1 });
        mock.queued.inputBox.push('  ');
        await onReplaceInSection();
        expect(mock.recorded.inputBoxCalls).toHaveLength(1);
    });

    it('names the find term in the replace prompt', async () => {
        openEditor(['> S', '>> - cat'], { cursor: 1 });
        mock.queued.inputBox.push('cat');
        await onReplaceInSection();
        expect(mock.recorded.inputBoxCalls[1].prompt).toBe('Replace "cat" with');
    });

    it('stops when the replace prompt is cancelled', async () => {
        const h = openEditor(['> S', '>> - cat'], { cursor: 1 });
        mock.queued.inputBox.push('cat');                  // no replacement queued
        await onReplaceInSection();
        expect(h.lines()).toEqual(['> S', '>> - cat']);
    });

    it('reports when the cursor is not in a section', async () => {
        openEditor(['prose'], { cursor: 0 });
        mock.queued.inputBox.push('cat', 'dog');
        await onReplaceInSection();
        expect(lastInfo()).toBe('CL: No section found at cursor');
    });

    it('replaces within the section’s items and reports the count', async () => {
        const h = openEditor(['> S', '>> - cat', '>> 2. cat nap'], { cursor: 1 });
        mock.queued.inputBox.push('cat', 'dog');
        await onReplaceInSection();
        expect(h.lines()).toEqual(['> S', '>> - dog', '>> 2. dog nap']);
        expect(lastInfo()).toBe('CL: Replaced 2 occurrences in section');
    });

    it('uses the singular for a single replacement', async () => {
        openEditor(['> S', '>> - cat'], { cursor: 1 });
        mock.queued.inputBox.push('cat', 'dog');
        await onReplaceInSection();
        expect(lastInfo()).toBe('CL: Replaced 1 occurrence in section');
    });

    it('replaces every occurrence on a line, counting the line once', async () => {
        const h = openEditor(['> S', '>> - cat and cat'], { cursor: 1 });
        mock.queued.inputBox.push('cat', 'dog');
        await onReplaceInSection();
        expect(h.lines()[1]).toBe('>> - dog and dog');
        expect(lastInfo()).toBe('CL: Replaced 1 occurrence in section');
    });

    it('deletes the term when the replacement is empty', async () => {
        const h = openEditor(['> S', '>> - remove this word'], { cursor: 1 });
        mock.queued.inputBox.push(' this', '');
        await onReplaceInSection();
        expect(h.lines()[1]).toBe('>> - remove word');
    });

    it('leaves non-item lines in the section alone', async () => {
        const h = openEditor(['> S', 'prose cat', '>> - cat'], { cursor: 1 });
        mock.queued.inputBox.push('cat', 'dog');
        await onReplaceInSection();
        expect(h.lines()).toEqual(['> S', 'prose cat', '>> - dog']);
    });

    it('does not reach into the next section', async () => {
        const h = openEditor(['> One', '>> - cat', '> Two', '>> - cat'], { cursor: 1 });
        mock.queued.inputBox.push('cat', 'dog');
        await onReplaceInSection();
        expect(h.lines()).toEqual(['> One', '>> - dog', '> Two', '>> - cat']);
    });

    it('reports when nothing in the section matches', async () => {
        openEditor(['> S', '>> - bird'], { cursor: 1 });
        mock.queued.inputBox.push('cat', 'dog');
        await onReplaceInSection();
        expect(lastInfo()).toBe('CL: No occurrences of "cat" found in section');
    });
});

describe('onFindInSections', () => {
    const DOC = ['> Home', '>> - Buy Milk', '> Work', '>> 1. milk the budget', '>> - unrelated'];

    it('does nothing without an active editor', async () => {
        await onFindInSections();
        expect(mock.recorded.inputBoxCalls).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(DOC, { languageId: 'plaintext' });
        await onFindInSections();
        expect(mock.recorded.inputBoxCalls).toHaveLength(0);
    });

    it('stops when the search is cancelled', async () => {
        openEditor(DOC);
        await onFindInSections();
        expect(mock.quickPicks).toHaveLength(0);
    });

    it('stops when the search term is blank', async () => {
        openEditor(DOC);
        mock.queued.inputBox.push('   ');
        await onFindInSections();
        expect(mock.quickPicks).toHaveLength(0);
    });

    it('reports when nothing matches', async () => {
        openEditor(DOC);
        mock.queued.inputBox.push('zebra');
        await onFindInSections();
        expect(lastInfo()).toBe('CL: No items matching "zebra"');
    });

    it('matches case-insensitively across bullets and numbered items', async () => {
        openEditor(DOC);
        mock.queued.inputBox.push('MILK');
        await onFindInSections();
        expect(mock.lastQuickPick().items.map((i) => i.lineIndex)).toEqual([1, 3]);
    });

    it('labels each match with its section', async () => {
        openEditor(DOC);
        mock.queued.inputBox.push('milk');
        await onFindInSections();
        expect(mock.lastQuickPick().items.map((i) => i.description)).toEqual(['Home', 'Work']);
    });

    it('ignores matching text on lines that are not items', async () => {
        openEditor(['> S', 'milk in prose', '>> - nothing']);
        mock.queued.inputBox.push('milk');
        await onFindInSections();
        expect(lastInfo()).toBe('CL: No items matching "milk"');
    });

    it('uses the singular placeholder for one match', async () => {
        openEditor(DOC);
        mock.queued.inputBox.push('budget');
        await onFindInSections();
        expect(mock.lastQuickPick().placeholder).toBe('1 item matching "budget"');
    });

    it('uses the plural placeholder for several', async () => {
        openEditor(DOC);
        mock.queued.inputBox.push('milk');
        await onFindInSections();
        expect(mock.lastQuickPick().placeholder).toBe('2 items matching "milk"');
    });

    it('previews the highlighted match', async () => {
        const h = openEditor(DOC);
        mock.queued.inputBox.push('milk');
        await onFindInSections();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);
        expect(cursorLine(h)).toBe(3);
    });

    it('ignores an empty active list', async () => {
        const h = openEditor(DOC);
        mock.queued.inputBox.push('milk');
        await onFindInSections();
        const before = h.revealed.length;
        mock.lastQuickPick().fireActive([]);
        expect(h.revealed).toHaveLength(before);
    });

    it('closes on accept', async () => {
        openEditor(DOC);
        mock.queued.inputBox.push('milk');
        await onFindInSections();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.fireAccept();
        expect(pick.disposed).toBe(true);
    });

    it('restores the cursor when dismissed without choosing', async () => {
        const h = openEditor(DOC, { cursor: 4 });
        mock.queued.inputBox.push('milk');
        await onFindInSections();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.activeItems = [];
        pick.fireHide();
        expect(cursorLine(h)).toBe(4);
    });
});
