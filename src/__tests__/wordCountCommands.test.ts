/**
 * Covers src/wordCountCommands.ts. SECTION-REPORT family, last of the eleven.
 *
 * onShowWordCount has two description formats: sections with a ==N goal show
 * "words / goal" (with a tick once met) and the rest show a pluralised count.
 * onShowNestingSummary groups a section's items by chevron depth.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate, type Harness } from './helpers/editorHarness';
import { onShowWordCount, onShowNestingSummary } from '../wordCountCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
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

describe('onShowWordCount', () => {
    it('does nothing without an active editor', async () => {
        await onShowWordCount();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['> S', '>> - a'], { languageId: 'plaintext' });
        await onShowWordCount();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('reports when the file has no sections', async () => {
        openEditor(['prose', '>> - orphan']);
        await onShowWordCount();
        expect(lastInfo()).toBe('CL: No sections found in this file');
    });

    it('lists every section in document order', async () => {
        openEditor(['> One', '>> - a', '> Two', '>> - b']);
        await onShowWordCount();
        expect(mock.lastQuickPick().items.map((i) => i.label)).toEqual(['One', 'Two']);
    });

    it('counts words across a section’s items', async () => {
        openEditor(['> S', '>> - one two three', '>> 1. four']);
        await onShowWordCount();
        expect(mock.lastQuickPick().items[0].description).toBe('4 words');
    });

    it('uses the singular for one word', async () => {
        openEditor(['> S', '>> - solo']);
        await onShowWordCount();
        expect(mock.lastQuickPick().items[0].description).toBe('1 word');
    });

    it('ignores words on lines that are not items', async () => {
        openEditor(['> S', 'lots of loose prose here', '>> - one']);
        await onShowWordCount();
        expect(mock.lastQuickPick().items[0].description).toBe('1 word');
    });

    it('shows progress for a section with a goal', async () => {
        openEditor(['> Chapter ==10', '>> - three short words']);
        await onShowWordCount();
        const [item] = mock.lastQuickPick().items;
        expect(item.label).toBe('Chapter');
        expect(item.description).toBe('3 / 10 words');
    });

    it('ticks a section that has met its goal', async () => {
        openEditor(['> Chapter ==2', '>> - three short words']);
        await onShowWordCount();
        expect(mock.lastQuickPick().items[0].description).toBe('3 / 2 words ✅');
    });

    it('explains goals in the placeholder', async () => {
        openEditor(['> S', '>> - a']);
        await onShowWordCount();
        expect(mock.lastQuickPick().placeholder)
            .toBe('Word counts per section (sections with ==N goals show progress)');
    });

    it('previews the highlighted section', async () => {
        const h = openEditor(['> One', '>> - a', '> Two', '>> - b']);
        await onShowWordCount();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);
        expect(cursorLine(h)).toBe(2);
    });

    it('ignores an empty active list', async () => {
        const h = openEditor(['> S', '>> - a']);
        await onShowWordCount();
        const before = h.revealed.length;
        mock.lastQuickPick().fireActive([]);
        expect(h.revealed).toHaveLength(before);
    });

    it('closes on accept', async () => {
        openEditor(['> S', '>> - a']);
        await onShowWordCount();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.fireAccept();
        expect(pick.disposed).toBe(true);
    });

    it('restores the cursor when dismissed without choosing', async () => {
        const h = openEditor(['> S', '>> - a', 'x'], { cursor: 2 });
        await onShowWordCount();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.activeItems = [];
        pick.fireHide();
        expect(cursorLine(h)).toBe(2);
    });
});

describe('onShowNestingSummary', () => {
    it('does nothing without an active editor', async () => {
        await onShowNestingSummary();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['> S', '>> - a'], { cursor: 1, languageId: 'plaintext' });
        await onShowNestingSummary();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('reports when the cursor is not in a section', async () => {
        openEditor(['prose'], { cursor: 0 });
        await onShowNestingSummary();
        expect(lastInfo()).toBe('CL: No section found at cursor');
    });

    it('reports a section with no items', async () => {
        openEditor(['> Empty', 'just prose'], { cursor: 0 });
        await onShowNestingSummary();
        expect(lastInfo()).toBe('CL: "Empty" has no items');
    });

    it('breaks items down by depth, shallowest first', async () => {
        openEditor(['> S', '>>> - deep', '>> - top', '>> 2. top two', '>>> - deep two'], { cursor: 1 });
        await onShowNestingSummary();
        expect(lastInfo()).toBe('"S" - Depth 0: 2 items, Depth 1: 2 items');
    });

    it('uses the singular for a single item at a depth', async () => {
        openEditor(['> S', '>> - top', '>>>> - very deep'], { cursor: 1 });
        await onShowNestingSummary();
        expect(lastInfo()).toBe('"S" - Depth 0: 1 item, Depth 2: 1 item');
    });

    it('stops at the next section', async () => {
        openEditor(['> One', '>> - a', '> Two', '>>> - b'], { cursor: 1 });
        await onShowNestingSummary();
        expect(lastInfo()).toBe('"One" - Depth 0: 1 item');
    });
});
