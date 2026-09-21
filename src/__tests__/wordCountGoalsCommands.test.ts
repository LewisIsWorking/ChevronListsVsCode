/**
 * Covers src/wordCountGoalsCommands.ts. SECTION-REPORT family.
 *
 * Each goal row has three independent thresholds -- the icon (under 50%,
 * 50-99%, 100%+), the detail ("to go" vs "over goal") and the ten-cell bar
 * capped at 100% -- so fixtures are chosen to land on each side of each one
 * rather than one happy path that happens to exercise a single band.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate, type Harness } from './helpers/editorHarness';
import { onShowWordCountGoals } from '../wordCountGoalsCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
    lastQuickPick(): {
        items: { label: string; description?: string; detail?: string; lineIndex: number }[];
        activeItems: unknown[];
        placeholder: string;
        disposed: boolean;
        fireActive(items: unknown[]): void;
        fireAccept(): void;
        fireHide(): void;
    };
};

const NONE = 'CL: No word count goals found — add `==N` to a section header';
const cursorLine = (h: Harness) =>
    (h.editor as { selection: { active: { line: number } } }).selection.active.line;

/** A section with goal `goal` containing exactly `words` one-word items. */
const section = (name: string, goal: number, words: number) =>
    [`> ${name} ==${goal}`, ...Array.from({ length: words }, (_, i) => `>> - w${i}`)];

/** The single goal row produced for `lines`. */
async function row(lines: string[]) {
    openEditor(lines);
    await onShowWordCountGoals();
    return mock.lastQuickPick().items[0];
}

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onShowWordCountGoals', () => {
    it('does nothing without an active editor', async () => {
        await onShowWordCountGoals();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(section('Ch', 10, 1), { languageId: 'plaintext' });
        await onShowWordCountGoals();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('reports when no header carries a goal', async () => {
        openEditor(['> Plain header', '>> - words here']);
        await onShowWordCountGoals();
        expect(mock.recorded.info).toContain(NONE);
    });

    it('ignores headers without a goal among ones that have one', async () => {
        openEditor(['> No goal', '>> - a', ...section('Goal', 10, 1)]);
        await onShowWordCountGoals();
        expect(mock.lastQuickPick().items).toHaveLength(1);
    });

    it('names the section without its goal marker', async () => {
        expect((await row(section('Chapter One', 10, 1))).label).toContain('Chapter One');
    });

    it('counts words across items, ignoring metadata', async () => {
        const r = await row(['> Ch ==100', '>> - three plain words #tag', '>> - two more']);
        expect(r.description).toContain('5/100');
    });

    it('ignores words on lines that are not items', async () => {
        const r = await row(['> Ch ==100', 'loose prose words', '>> - one']);
        expect(r.description).toContain('1/100');
    });

    it('uses the empty-circle icon under halfway', async () => {
        expect((await row(section('Ch', 10, 4))).label).toBe('$(circle-outline) Ch');
    });

    it('uses the dash icon from halfway', async () => {
        expect((await row(section('Ch', 10, 5))).label).toBe('$(dash) Ch');
    });

    it('uses the check icon once the goal is met', async () => {
        expect((await row(section('Ch', 10, 10))).label).toBe('$(check) Ch');
    });

    it('draws a proportional ten-cell bar', async () => {
        expect((await row(section('Ch', 10, 3))).description).toBe('▓▓▓░░░░░░░ 3/10 (30%)');
    });

    it('caps the bar and percentage at 100', async () => {
        expect((await row(section('Ch', 4, 6))).description).toBe('▓▓▓▓▓▓▓▓▓▓ 6/4 (100%)');
    });

    it('says how many words remain', async () => {
        expect((await row(section('Ch', 10, 3))).detail).toBe('7 words to go');
    });

    it('says how far past the goal a section is', async () => {
        expect((await row(section('Ch', 4, 6))).detail).toBe('✓ 2 over goal');
    });

    it('treats hitting the goal exactly as zero over', async () => {
        expect((await row(section('Ch', 5, 5))).detail).toBe('✓ 0 over goal');
    });

    it('lists the section furthest from its goal first', async () => {
        openEditor([...section('Nearly', 10, 9), ...section('Far', 10, 1)]);
        await onShowWordCountGoals();
        expect(mock.lastQuickPick().items.map((i) => i.label)).toEqual(
            ['$(circle-outline) Far', '$(dash) Nearly']
        );
    });

    it('uses the singular placeholder for one goal', async () => {
        await row(section('Ch', 10, 1));
        expect(mock.lastQuickPick().placeholder).toBe('1 word goal section — press Enter to jump');
    });

    it('uses the plural placeholder for several', async () => {
        openEditor([...section('A', 10, 1), ...section('B', 10, 1)]);
        await onShowWordCountGoals();
        expect(mock.lastQuickPick().placeholder).toBe('2 word goal sections — press Enter to jump');
    });

    it('previews the highlighted section', async () => {
        const h = openEditor([...section('A', 10, 9), ...section('B', 10, 1)]);
        await onShowWordCountGoals();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);            // "A" at line 0
        expect(cursorLine(h)).toBe(0);
    });

    it('ignores an empty active list', async () => {
        const h = openEditor(section('Ch', 10, 1));
        await onShowWordCountGoals();
        const before = h.revealed.length;
        mock.lastQuickPick().fireActive([]);
        expect(h.revealed).toHaveLength(before);
    });

    it('closes on accept', async () => {
        await row(section('Ch', 10, 1));
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.fireAccept();
        expect(pick.disposed).toBe(true);
    });

    it('restores the cursor when dismissed without choosing', async () => {
        const h = openEditor([...section('Ch', 10, 1), 'trailing'], { cursor: 2 });
        await onShowWordCountGoals();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.activeItems = [];
        pick.fireHide();
        expect(cursorLine(h)).toBe(2);
    });
});
