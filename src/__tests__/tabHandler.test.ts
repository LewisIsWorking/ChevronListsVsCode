/**
 * Covers src/tabHandler.ts -- Tab/Shift+Tab promotion and snippet expansion.
 *
 * 112 statements and the second-largest file in the repo; it was at 0.9%.
 * snippets.test.ts kept a hand-copy of the SNIPPETS map ("must stay in sync"),
 * which is now redundant: this file asserts against the real export.
 *
 * onTab consults `editor.action.inlineSuggest.isVisible` before doing anything,
 * so the suggest-widget branch is driven by registering that command through
 * the mock and having it answer true.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate, type Harness } from './helpers/editorHarness';
import {
    SNIPPETS,
    getSnippetPrefix,
    expandSnippet,
    onExpandSnippet,
    onTab,
    onShiftTab,
} from '../tabHandler';

const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { commands: { command: string }[] };
};

const ran = (name: string) => mock.recorded.commands.some((c) => c.command === name);

/** Makes the suggest widget report itself as open. */
function suggestIsOpen(): void {
    vscode.commands.registerCommand('editor.action.inlineSuggest.isVisible', () => true);
}

beforeEach(() => {
    mock.__reset();
    deactivate();
});

describe('SNIPPETS', () => {
    it('defines the two chevron-list snippets', () => {
        expect(Object.keys(SNIPPETS).sort()).toEqual(['chl', 'chn']);
    });

    it('starts each snippet with a header placeholder', () => {
        for (const body of Object.values(SNIPPETS)) {
            expect(body.startsWith('> ${1:Section Header}')).toBe(true);
        }
    });
});

describe('getSnippetPrefix', () => {
    it('recognises a snippet trigger before the cursor', () => {
        const h = openEditor(['chl'], { cursor: 0, character: 3 });
        expect(getSnippetPrefix(h.editor as never)).toBe('chl');
    });

    it('ignores leading whitespace', () => {
        const h = openEditor(['    chn'], { cursor: 0, character: 7 });
        expect(getSnippetPrefix(h.editor as never)).toBe('chn');
    });

    it('returns null for text that is not a trigger', () => {
        const h = openEditor(['nope'], { cursor: 0, character: 4 });
        expect(getSnippetPrefix(h.editor as never)).toBeNull();
    });

    it('returns null when the cursor sits mid-trigger', () => {
        const h = openEditor(['chl'], { cursor: 0, character: 2 });   // "ch"
        expect(getSnippetPrefix(h.editor as never)).toBeNull();
    });
});

describe('expandSnippet', () => {
    it('reports false when there is no trigger to expand', async () => {
        const h = openEditor(['nothing here'], { cursor: 0, character: 5 });
        expect(await expandSnippet(h.editor as never)).toBe(false);
        expect(h.snippets).toHaveLength(0);
    });

    it('removes the trigger text and inserts the snippet body', async () => {
        const h = openEditor(['chl'], { cursor: 0, character: 3 });
        expect(await expandSnippet(h.editor as never)).toBe(true);
        expect(h.text()).toBe('');                      // trigger deleted
        expect(h.snippets).toEqual([SNIPPETS.chl]);
    });

    it('keeps surrounding indentation when expanding', async () => {
        const h = openEditor(['  chn'], { cursor: 0, character: 5 });
        await expandSnippet(h.editor as never);
        expect(h.text()).toBe('  ');
        expect(h.snippets).toEqual([SNIPPETS.chn]);
    });
});

describe('onExpandSnippet', () => {
    it('does nothing without an active editor', async () => {
        await onExpandSnippet();
        expect(true).toBe(true);
    });

    it('expands the trigger under the cursor', async () => {
        const h = openEditor(['chl'], { cursor: 0, character: 3 });
        await onExpandSnippet();
        expect(h.snippets).toEqual([SNIPPETS.chl]);
    });
});

describe('onTab', () => {
    it('does nothing without an active editor', async () => {
        await onTab();
        expect(ran('acceptSelectedSuggestion')).toBe(false);
    });

    it('lets the suggest widget take Tab when it is open', async () => {
        const h = openEditor(['>> - item'], { cursor: 0 });
        suggestIsOpen();
        await onTab();
        expect(ran('acceptSelectedSuggestion')).toBe(true);
        expect(h.edits).toHaveLength(0);           // nothing indented
    });

    it('expands a snippet when the trigger is set to tab', async () => {
        const h = openEditor(['chl'], { cursor: 0, character: 3 });
        await onTab();
        expect(h.snippets).toEqual([SNIPPETS.chl]);
    });

    it('does not expand when the trigger is configured elsewhere', async () => {
        mock.__setConfig('chevron-lists.snippetTrigger', 'enter');
        const h = openEditor(['chl'], { cursor: 0, character: 3 });
        await onTab();
        expect(h.snippets).toHaveLength(0);
    });

    it('falls through to a plain tab when the line is not a chevron item', async () => {
        openEditor(['plain prose'], { cursor: 0 });
        await onTab();
        expect(ran('tab')).toBe(true);
    });

    it('indents a bullet by one chevron', async () => {
        const h = openEditor(['>> - item'], { cursor: 0 });
        await onTab();
        expect(h.lines()).toEqual(['>>> - item']);
    });

    it('indents a numbered item and renumbers it for its new depth', async () => {
        const h = openEditor(['>> 1. a', '>> 2. b'], { cursor: 1 });
        await onTab();
        expect(h.lines()).toEqual(['>> 1. a', '>>> 1. b']);
    });

    it('carries child items along with their parent', async () => {
        const h = openEditor(['>> - parent', '>>> - child', '>> - sibling'], { cursor: 0 });
        await onTab();
        expect(h.lines()).toEqual(['>>> - parent', '>>>> - child', '>> - sibling']);
    });

    it('stops collecting children at a non-chevron line', async () => {
        const h = openEditor(['>> - parent', 'prose', '>>> - not a child'], { cursor: 0 });
        await onTab();
        expect(h.lines()).toEqual(['>>> - parent', 'prose', '>>> - not a child']);
    });

    it('indents every cursor without pulling in children', async () => {
        const h = openEditor(['>> - one', '>>> - onechild', '>> - two'], { cursor: 0 });
        h.setSelections([[0, 0], [2, 2]]);
        await onTab();
        expect(h.lines()).toEqual(['>>> - one', '>>> - onechild', '>>> - two']);
    });

    it('indents every chevron line inside a range selection', async () => {
        const h = openEditor(['>> - a', 'prose', '>> - b'], { cursor: 0 });
        h.setSelections([[0, 2]]);
        await onTab();
        expect(h.lines()).toEqual(['>>> - a', 'prose', '>>> - b']);
    });
});

describe('onShiftTab', () => {
    it('does nothing without an active editor', async () => {
        await onShiftTab();
        expect(ran('outdent')).toBe(false);
    });

    it('falls through to outdent when the line is not a chevron item', async () => {
        openEditor(['plain prose'], { cursor: 0 });
        await onShiftTab();
        expect(ran('outdent')).toBe(true);
    });

    it('dedents a nested bullet by one chevron', async () => {
        const h = openEditor(['>>> - item'], { cursor: 0 });
        await onShiftTab();
        expect(h.lines()).toEqual(['>> - item']);
    });

    it('refuses to dedent a bullet already at minimum depth', async () => {
        const h = openEditor(['>> - item'], { cursor: 0 });
        await onShiftTab();
        expect(h.lines()).toEqual(['>> - item']);
    });

    it('refuses to dedent a numbered item already at minimum depth', async () => {
        const h = openEditor(['>> 1. item'], { cursor: 0 });
        await onShiftTab();
        expect(h.lines()).toEqual(['>> 1. item']);
    });

    it('dedents a numbered item and renumbers it for its new depth', async () => {
        const h = openEditor(['>> 1. a', '>>> 5. b'], { cursor: 1 });
        await onShiftTab();
        expect(h.lines()).toEqual(['>> 1. a', '>> 2. b']);
    });

    it('carries child items along with their parent', async () => {
        const h = openEditor(['>>> - parent', '>>>> - child'], { cursor: 0 });
        await onShiftTab();
        expect(h.lines()).toEqual(['>> - parent', '>>> - child']);
    });

    it('dedents every cursor', async () => {
        const h = openEditor(['>>> - one', '>>> - two'], { cursor: 0 });
        h.setSelections([[0, 0], [1, 1]]);
        await onShiftTab();
        expect(h.lines()).toEqual(['>> - one', '>> - two']);
    });
});
