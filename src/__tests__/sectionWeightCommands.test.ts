/**
 * Covers src/sectionWeightCommands.ts. SECTION-REPORT family.
 *
 * Weight is items*3 + sum of priority levels + sum of votes + tag count, so
 * each input is isolated in its own test: a regression in one term would
 * otherwise hide behind the others in a single combined fixture.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate, type Harness } from './helpers/editorHarness';
import { onShowSectionWeights } from '../sectionWeightCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
    lastQuickPick(): {
        items: { label: string; description?: string; lineIndex: number; weight: number }[];
        activeItems: unknown[];
        placeholder: string;
        disposed: boolean;
        fireActive(items: unknown[]): void;
        fireAccept(): void;
        fireHide(): void;
    };
};

const cursorLine = (h: Harness) =>
    (h.editor as { selection: { active: { line: number } } }).selection.active.line;

/** Weight of the only section in `lines`. */
async function weightOf(lines: string[]): Promise<number> {
    openEditor(lines);
    await onShowSectionWeights();
    return mock.lastQuickPick().items[0].weight;
}

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onShowSectionWeights', () => {
    it('does nothing without an active editor', async () => {
        await onShowSectionWeights();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['> S', '>> - a'], { languageId: 'plaintext' });
        await onShowSectionWeights();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('reports when the file has no sections', async () => {
        openEditor(['prose', '>> - orphan']);
        await onShowSectionWeights();
        expect(mock.recorded.info).toContain('CL: No sections found');
    });

    it('counts three per item', async () => {
        expect(await weightOf(['> S', '>> - a', '>> - b'])).toBe(6);
    });

    it('adds each item’s priority level', async () => {
        expect(await weightOf(['> S', '>> - !!! a'])).toBe(3 + 3);
    });

    it('adds each item’s votes', async () => {
        expect(await weightOf(['> S', '>> - idea +5'])).toBe(3 + 5);
    });

    it('adds one per tag', async () => {
        expect(await weightOf(['> S', '>> - a #x #y'])).toBe(3 + 2);
    });

    it('combines every term', async () => {
        expect(await weightOf(['> S', '>> - !! a #x +4'])).toBe(3 + 2 + 4 + 1);
    });

    it('weighs an empty section at zero', async () => {
        expect(await weightOf(['> S', 'prose only'])).toBe(0);
    });

    it('counts numbered items the same as bullets', async () => {
        expect(await weightOf(['> S', '>> 1. a'])).toBe(3);
    });

    it('shows the weight in the description', async () => {
        openEditor(['> S', '>> - a']);
        await onShowSectionWeights();
        expect(mock.lastQuickPick().items[0].description).toBe('weight: 3');
    });

    it('ranks the heaviest section first', async () => {
        openEditor(['> Light', '>> - a', '> Heavy', '>> - a', '>> - b', '>> - c']);
        await onShowSectionWeights();
        expect(mock.lastQuickPick().items.map((i) => i.label)).toEqual(['Heavy', 'Light']);
    });

    it('explains the formula in the placeholder', async () => {
        openEditor(['> S', '>> - a']);
        await onShowSectionWeights();
        expect(mock.lastQuickPick().placeholder)
            .toBe('Sections ranked by weight (items × 3 + priority + votes + tags)');
    });

    it('previews the highlighted section', async () => {
        const h = openEditor(['> One', '>> - a', '> Two', '>> - a', '>> - b']);
        await onShowSectionWeights();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);      // lighter section, "One" at line 0
        expect(cursorLine(h)).toBe(0);
    });

    it('ignores an empty active list', async () => {
        const h = openEditor(['> S', '>> - a']);
        await onShowSectionWeights();
        const before = h.revealed.length;
        mock.lastQuickPick().fireActive([]);
        expect(h.revealed).toHaveLength(before);
    });

    it('closes on accept', async () => {
        openEditor(['> S', '>> - a']);
        await onShowSectionWeights();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.fireAccept();
        expect(pick.disposed).toBe(true);
    });

    it('restores the cursor when dismissed without choosing', async () => {
        const h = openEditor(['> S', '>> - a', 'x'], { cursor: 2 });
        await onShowSectionWeights();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.activeItems = [];
        pick.fireHide();
        expect(cursorLine(h)).toBe(2);
    });
});
