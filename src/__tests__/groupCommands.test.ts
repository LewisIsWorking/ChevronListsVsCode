/**
 * Covers src/groupCommands.ts -- grouping sections under `>> -- Name`
 * dividers and navigating between groups.
 *
 * collectGroups only emits a group once a section header follows its divider,
 * so an empty divider is silently dropped; that is asserted because it is the
 * difference between "no groups" and "a group you cannot see".
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate, type Harness } from './helpers/editorHarness';
import { onGroupSections, onFilterGroups } from '../groupCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[]; inputBoxCalls: unknown[] };
    queued: { inputBox: (string | undefined)[] };
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

const NO_GROUPS = 'CL: No section groups found (use CL: Group Sections or type >> -- Group Name)';
const CONTEXT = {} as vscode.ExtensionContext;   // accepted but unused by the command
const cursorLine = (h: Harness) =>
    (h.editor as { selection: { active: { line: number } } }).selection.active.line;

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onGroupSections', () => {
    it('does nothing without an active editor', async () => {
        await onGroupSections(CONTEXT);
        expect(mock.recorded.inputBoxCalls).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['> S'], { languageId: 'plaintext' });
        await onGroupSections(CONTEXT);
        expect(mock.recorded.inputBoxCalls).toHaveLength(0);
    });

    it('asks for a group name', async () => {
        openEditor(['> S'], { cursor: 0 });
        await onGroupSections(CONTEXT);
        expect(mock.recorded.inputBoxCalls[0]).toEqual({
            prompt: 'Enter a name for this section group',
            placeHolder: 'e.g. Act One, Chapter 2, Phase 1...',
        });
    });

    it('stops when the name prompt is cancelled', async () => {
        const h = openEditor(['> S'], { cursor: 0 });
        await onGroupSections(CONTEXT);                 // nothing queued = Escape
        expect(h.lines()).toEqual(['> S']);
    });

    it('stops when the name is blank', async () => {
        const h = openEditor(['> S'], { cursor: 0 });
        mock.queued.inputBox.push('   ');
        await onGroupSections(CONTEXT);
        expect(h.lines()).toEqual(['> S']);
    });

    it('reports when there is no header at or above the cursor', async () => {
        openEditor(['prose', '> Later'], { cursor: 0 });
        mock.queued.inputBox.push('Act One');
        await onGroupSections(CONTEXT);
        expect(mock.recorded.info).toContain('CL: No section header found at cursor');
    });

    it('inserts the divider above the nearest header', async () => {
        const h = openEditor(['> S', '>> - a'], { cursor: 1 });
        mock.queued.inputBox.push('Act One');
        await onGroupSections(CONTEXT);
        expect(h.lines()).toEqual(['>> -- Act One', '> S', '>> - a']);
    });

    it('uses the header the cursor is sitting on', async () => {
        const h = openEditor(['> First', '> Second'], { cursor: 1 });
        mock.queued.inputBox.push('G');
        await onGroupSections(CONTEXT);
        expect(h.lines()).toEqual(['> First', '>> -- G', '> Second']);
    });

    it('trims the name', async () => {
        const h = openEditor(['> S'], { cursor: 0 });
        mock.queued.inputBox.push('  Act One  ');
        await onGroupSections(CONTEXT);
        expect(h.lines()[0]).toBe('>> -- Act One');
    });
});

describe('onFilterGroups', () => {
    const DOC = [
        '>> -- Act One', '> Intro', '> Setup',
        '>> -- Act Two', '> Climax',
    ];

    it('does nothing without an active editor', async () => {
        await onFilterGroups();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(DOC, { languageId: 'plaintext' });
        await onFilterGroups();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('reports when the file has no groups', async () => {
        openEditor(['> Ungrouped']);
        await onFilterGroups();
        expect(mock.recorded.info).toContain(NO_GROUPS);
    });

    it('treats a divider with no sections under it as no group', async () => {
        openEditor(['>> -- Empty group']);
        await onFilterGroups();
        expect(mock.recorded.info).toContain(NO_GROUPS);
    });

    it('lists each group with its sections', async () => {
        openEditor(DOC);
        await onFilterGroups();
        const items = mock.lastQuickPick().items;
        expect(items.map((i) => i.label)).toEqual(['$(folder) Act One', '$(folder) Act Two']);
        expect(items.map((i) => i.description)).toEqual(['2 sections: Intro, Setup', '1 section: Climax']);
    });

    it('shows a navigation placeholder', async () => {
        openEditor(DOC);
        await onFilterGroups();
        expect(mock.lastQuickPick().placeholder).toBe('Jump to a section group...');
    });

    it('previews the highlighted group', async () => {
        const h = openEditor(DOC);
        await onFilterGroups();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);
        expect(cursorLine(h)).toBe(3);
    });

    it('ignores an empty active list', async () => {
        const h = openEditor(DOC);
        await onFilterGroups();
        const before = h.revealed.length;
        mock.lastQuickPick().fireActive([]);
        expect(h.revealed).toHaveLength(before);
    });

    it('jumps to the group on accept', async () => {
        const h = openEditor(DOC);
        await onFilterGroups();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);
        pick.fireAccept();
        expect(cursorLine(h)).toBe(3);
        expect(pick.disposed).toBe(true);
    });

    it('accepting with nothing highlighted still closes', async () => {
        openEditor(DOC);
        await onFilterGroups();
        const pick = mock.lastQuickPick();
        pick.fireAccept();
        expect(pick.disposed).toBe(true);
    });

    it('restores the cursor when dismissed without choosing', async () => {
        const h = openEditor(DOC, { cursor: 4 });
        await onFilterGroups();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);
        pick.activeItems = [];
        pick.fireHide();
        expect(cursorLine(h)).toBe(4);
    });
});
