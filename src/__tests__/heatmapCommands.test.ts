/**
 * Covers src/heatmapCommands.ts -- sections ranked by tag count or completion.
 *
 * Representative of the SECTION-REPORT family (11 modules): scan the file,
 * aggregate per section, rank, and offer the result as a quick pick whose
 * highlight previews the section and whose dismissal restores the cursor.
 * The pattern here transfers directly to the other ten.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate, type Harness } from './helpers/editorHarness';
import { onShowTagHeatmap, onShowCompletionHeatmap } from '../heatmapCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
    lastQuickPick(): {
        items: { label: string; description?: string; lineIndex: number }[];
        activeItems: unknown[];
        placeholder: string;
        shown: boolean;
        disposed: boolean;
        fireActive(items: unknown[]): void;
        fireAccept(): void;
        fireHide(): void;
    };
};

const cursorLine = (h: Harness) =>
    (h.editor as { selection: { active: { line: number } } }).selection.active.line;

beforeEach(() => {
    mock.__reset();
    deactivate();
});

describe('onShowTagHeatmap', () => {
    it('does nothing without an active editor', async () => {
        await onShowTagHeatmap();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['> One', '>> - a #x'], { languageId: 'plaintext' });
        await onShowTagHeatmap();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('tells the user when the file has no sections', async () => {
        openEditor(['just prose', '>> - an orphan #tag']);
        await onShowTagHeatmap();
        expect(mock.recorded.info).toContain('CL: No sections found');
    });

    it('ranks sections by tag count, busiest first', async () => {
        openEditor([
            '> Quiet', '>> - a #one',
            '> Busy', '>> - b #x #y', '>> - c #z',
        ]);
        await onShowTagHeatmap();
        expect(mock.lastQuickPick().items.map((i) => i.label)).toEqual(['Busy', 'Quiet']);
    });

    it('counts tags across both bullet and numbered items', async () => {
        openEditor(['> S', '>> - a #x', '>> 2. b #y']);
        await onShowTagHeatmap();
        expect(mock.lastQuickPick().items[0].description).toBe('2 tags');
    });

    it('uses the singular for exactly one tag', async () => {
        openEditor(['> S', '>> - a #only']);
        await onShowTagHeatmap();
        expect(mock.lastQuickPick().items[0].description).toBe('1 tag');
    });

    it('reports zero for a section with no tags', async () => {
        openEditor(['> S', '>> - plain item']);
        await onShowTagHeatmap();
        expect(mock.lastQuickPick().items[0].description).toBe('0 tags');
    });

    it('ignores tags on lines that are not items', async () => {
        openEditor(['> S', 'loose prose #nope', '>> - real #yes']);
        await onShowTagHeatmap();
        expect(mock.lastQuickPick().items[0].description).toBe('1 tag');
    });

    it('shows the pick with a tag-ranking placeholder', async () => {
        openEditor(['> S', '>> - a #x']);
        await onShowTagHeatmap();
        const pick = mock.lastQuickPick();
        expect(pick.shown).toBe(true);
        expect(pick.placeholder).toBe('Sections ranked by tag count');
    });
});

describe('onShowCompletionHeatmap', () => {
    it('does nothing without an active editor', async () => {
        await onShowCompletionHeatmap();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['> One', '>> - [x] a'], { languageId: 'plaintext' });
        await onShowCompletionHeatmap();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('reports the completed percentage', async () => {
        openEditor(['> S', '>> - [x] done', '>> - [ ] todo']);
        await onShowCompletionHeatmap();
        expect(mock.lastQuickPick().items[0].description).toBe('50% done');
    });

    it('rounds the percentage', async () => {
        openEditor(['> S', '>> - [x] a', '>> - [ ] b', '>> - [ ] c']);
        await onShowCompletionHeatmap();
        expect(mock.lastQuickPick().items[0].description).toBe('33% done');
    });

    it('says so when a section has no checkboxes at all', async () => {
        openEditor(['> S', '>> - no checkbox here']);
        await onShowCompletionHeatmap();
        expect(mock.lastQuickPick().items[0].description).toBe('no checkboxes');
    });

    it('ranks the most complete section first', async () => {
        openEditor([
            '> Behind', '>> - [ ] a', '>> - [ ] b',
            '> Ahead', '>> - [x] c',
        ]);
        await onShowCompletionHeatmap();
        expect(mock.lastQuickPick().items.map((i) => i.label)).toEqual(['Ahead', 'Behind']);
    });

    it('shows the pick with a completion-ranking placeholder', async () => {
        openEditor(['> S', '>> - [x] a']);
        await onShowCompletionHeatmap();
        expect(mock.lastQuickPick().placeholder).toBe('Sections ranked by completion %');
    });
});

describe('the heatmap quick pick', () => {
    it('previews the highlighted section', async () => {
        const h = openEditor(['> One', '>> - a #x', '> Two', '>> - b #y #z']);
        await onShowTagHeatmap();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);          // the lower-ranked section, "One" at line 0
        expect(cursorLine(h)).toBe(0);
        expect(h.revealed.at(-1)?.start[0]).toBe(0);
    });

    it('ignores an empty active list', async () => {
        const h = openEditor(['> S', '>> - a #x']);
        await onShowTagHeatmap();
        const before = h.revealed.length;
        mock.lastQuickPick().fireActive([]);
        expect(h.revealed).toHaveLength(before);
    });

    it('closes on accept, leaving the previewed position', async () => {
        const h = openEditor(['> One', '>> - a #x', '> Two', '>> - b #y']);
        await onShowTagHeatmap();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.fireAccept();
        expect(pick.disposed).toBe(true);
        expect(cursorLine(h)).toBe(pick.items[0].lineIndex);
    });

    it('restores the original cursor when dismissed without choosing', async () => {
        const h = openEditor(['> One', '>> - a #x', '> Two', '>> - b #y'], { cursor: 3 });
        await onShowTagHeatmap();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);          // preview moves the cursor away
        pick.activeItems = [];                     // dismissed with nothing chosen
        pick.fireHide();
        expect(cursorLine(h)).toBe(3);
        expect(pick.disposed).toBe(true);
    });
});
