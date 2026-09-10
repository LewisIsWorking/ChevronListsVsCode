/**
 * Covers src/sectionCommands.ts -- select / delete / duplicate / move section.
 * 85 statements, previously 0%.
 *
 * The move commands use TIGHT section ranges (header + chevron items only) and
 * preserve whatever sits in the gap between two sections, so the fixtures below
 * deliberately include blank lines and prose between sections.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate, type Harness } from './helpers/editorHarness';
import {
    onSelectSectionItems,
    onDeleteSection,
    onDuplicateSection,
    onMoveSectionUp,
    onMoveSectionDown,
} from '../sectionCommands';

const mock = vscode as unknown as { __reset(): void };

/** The editor's current selections, as [line, line] pairs. */
const selectionLines = (h: Harness) =>
    ((h.editor as { selections: { start: { line: number } }[] }).selections)
        .map((s) => s.start.line);

const cursorLine = (h: Harness) =>
    (h.editor as { selection: { active: { line: number } } }).selection.active.line;

beforeEach(() => {
    mock.__reset();
    deactivate();
});

describe('onSelectSectionItems', () => {
    it('does nothing without an active editor', () => {
        onSelectSectionItems();
        expect(true).toBe(true);
    });

    it('does nothing when the cursor is above any header', () => {
        const h = openEditor(['prose'], { cursor: 0 });
        onSelectSectionItems();
        expect(selectionLines(h)).toEqual([0]);
    });

    it('selects every item line in the section', () => {
        const h = openEditor(['> Tasks', '>> - a', '>> 2. b', '>> - c'], { cursor: 0 });
        onSelectSectionItems();
        expect(selectionLines(h)).toEqual([1, 2, 3]);
    });

    it('skips non-item lines inside the section', () => {
        const h = openEditor(['> Tasks', '>> - a', 'prose', '>> - b'], { cursor: 0 });
        onSelectSectionItems();
        expect(selectionLines(h)).toEqual([1, 3]);
    });

    it('leaves the selection alone when the section has no items', () => {
        const h = openEditor(['> Empty', 'prose'], { cursor: 0 });
        onSelectSectionItems();
        expect(selectionLines(h)).toEqual([0]);
    });
});

describe('onDeleteSection', () => {
    it('does nothing without an active editor', async () => {
        await onDeleteSection();
        expect(true).toBe(true);
    });

    it('does nothing when the cursor is above any header', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        await onDeleteSection();
        expect(h.lines()).toEqual(['prose']);
    });

    it('removes the header and its items, leaving what follows', async () => {
        const h = openEditor(['> One', '>> - a', '> Two', '>> - b'], { cursor: 0 });
        await onDeleteSection();
        expect(h.lines()).toEqual(['> Two', '>> - b']);
    });

    it('removes a trailing section without leaving a blank line', async () => {
        const h = openEditor(['> One', '>> - a'], { cursor: 0 });
        await onDeleteSection();
        expect(h.text()).toBe('');
    });
});

describe('onDuplicateSection', () => {
    it('does nothing without an active editor', async () => {
        await onDuplicateSection();
        expect(true).toBe(true);
    });

    it('does nothing when the cursor is above any header', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        await onDuplicateSection();
        expect(h.lines()).toEqual(['prose']);
    });

    it('inserts a copy of the section directly below it', async () => {
        const h = openEditor(['> One', '>> - a', '> Two'], { cursor: 0 });
        await onDuplicateSection();
        expect(h.lines()).toEqual(['> One', '>> - a', '> One', '>> - a', '> Two']);
    });
});

describe('onMoveSectionUp', () => {
    it('does nothing without an active editor', async () => {
        await onMoveSectionUp();
        expect(true).toBe(true);
    });

    it('does nothing for the first section in the file', async () => {
        const h = openEditor(['> One', '>> - a', '> Two', '>> - b'], { cursor: 0 });
        await onMoveSectionUp();
        expect(h.lines()).toEqual(['> One', '>> - a', '> Two', '>> - b']);
    });

    it('does nothing when the cursor is above any header', async () => {
        const h = openEditor(['prose', 'more'], { cursor: 1 });
        await onMoveSectionUp();
        expect(h.lines()).toEqual(['prose', 'more']);
    });

    it('does nothing when nothing above the header is a section', async () => {
        // The header is not on line 0, so the "first section" guard passes,
        // but there is still no previous section to swap with.
        const h = openEditor(['some preamble', '> One', '>> - a'], { cursor: 1 });
        await onMoveSectionUp();
        expect(h.lines()).toEqual(['some preamble', '> One', '>> - a']);
    });

    it('swaps the section with the one above it', async () => {
        const h = openEditor(['> One', '>> - a', '> Two', '>> - b'], { cursor: 2 });
        await onMoveSectionUp();
        expect(h.lines()).toEqual(['> Two', '>> - b', '> One', '>> - a']);
    });

    it('keeps whatever sits between the two sections in place', async () => {
        const h = openEditor(['> One', '>> - a', '', '> Two', '>> - b'], { cursor: 3 });
        await onMoveSectionUp();
        expect(h.lines()).toEqual(['> Two', '>> - b', '', '> One', '>> - a']);
    });

    it('moves the cursor with the section', async () => {
        const h = openEditor(['> One', '>> - a', '> Two', '>> - b'], { cursor: 2 });
        await onMoveSectionUp();
        expect(cursorLine(h)).toBe(0);
        expect(h.revealed.at(-1)?.start[0]).toBe(0);
    });
});

describe('onMoveSectionDown', () => {
    it('does nothing without an active editor', async () => {
        await onMoveSectionDown();
        expect(true).toBe(true);
    });

    it('does nothing when the cursor is above any header', async () => {
        const h = openEditor(['prose'], { cursor: 0 });
        await onMoveSectionDown();
        expect(h.lines()).toEqual(['prose']);
    });

    it('does nothing for the last section in the file', async () => {
        const h = openEditor(['> One', '>> - a', '> Two', '>> - b'], { cursor: 2 });
        await onMoveSectionDown();
        expect(h.lines()).toEqual(['> One', '>> - a', '> Two', '>> - b']);
    });

    it('swaps the section with the one below it', async () => {
        const h = openEditor(['> One', '>> - a', '> Two', '>> - b'], { cursor: 0 });
        await onMoveSectionDown();
        expect(h.lines()).toEqual(['> Two', '>> - b', '> One', '>> - a']);
    });

    it('keeps whatever sits between the two sections in place', async () => {
        const h = openEditor(['> One', '>> - a', '', '> Two', '>> - b'], { cursor: 0 });
        await onMoveSectionDown();
        expect(h.lines()).toEqual(['> Two', '>> - b', '', '> One', '>> - a']);
    });

    it('moves the cursor with the section', async () => {
        const h = openEditor(['> One', '>> - a', '> Two', '>> - b'], { cursor: 0 });
        await onMoveSectionDown();
        expect(cursorLine(h)).toBe(2);
        expect(h.revealed.at(-1)?.start[0]).toBe(2);
    });
});
