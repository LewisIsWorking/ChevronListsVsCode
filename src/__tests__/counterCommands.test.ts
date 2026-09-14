/**
 * Covers src/counterCommands.ts. SECTION-REPORT family.
 *
 * onShowSectionSummary builds its "Done" suffix with a nested ternary whose
 * two truthy arms produce the identical string -- the first condition is
 * redundant. It is left as-is (not this change's business), but every operand
 * still has to be exercised for branch coverage, so the fixtures below are
 * chosen per operand: an empty section, done-with-tags, done-without-tags and
 * not-done-without-tags.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onShowSectionSummary, onCountItemsByTag } from '../counterCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: {
        info: string[];
        quickPickCalls: { items: { label: string; description: string }[]; options: { placeHolder: string } }[];
    };
};

const lastInfo = () => mock.recorded.info.at(-1);

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onShowSectionSummary', () => {
    it('does nothing without an active editor', async () => {
        await onShowSectionSummary();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['> S', '>> - a'], { cursor: 1, languageId: 'plaintext' });
        await onShowSectionSummary();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('reports when the cursor is not in a section', async () => {
        openEditor(['prose'], { cursor: 0 });
        await onShowSectionSummary();
        expect(lastInfo()).toBe('CL: No section found at cursor');
    });

    it('summarises an empty section', async () => {
        openEditor(['> Empty'], { cursor: 0 });
        await onShowSectionSummary();
        expect(lastInfo()).toBe('"Empty" — 0 items, 0 words');
    });

    it('summarises items and words with no checkboxes or tags', async () => {
        openEditor(['> S', '>> - one two', '>> - three'], { cursor: 1 });
        await onShowSectionSummary();
        expect(lastInfo()).toBe('"S" — 2 items, 3 words');
    });

    it('uses the singular for one item', async () => {
        openEditor(['> S', '>> - solo'], { cursor: 1 });
        await onShowSectionSummary();
        // Note: "words" is never singularised, unlike "items" -- asserted as shipped.
        expect(lastInfo()).toBe('"S" — 1 item, 1 words');
    });

    it('adds the done count when there are completed items but no tags', async () => {
        openEditor(['> S', '>> - [x] a', '>> - [ ] b'], { cursor: 1 });
        await onShowSectionSummary();
        // 5, not 4: words are split on whitespace, so an UNCHECKED box "[ ]" is
        // two tokens while a checked "[x]" is one. Checkbox markup is counted as
        // prose -- asserted as shipped, and worth knowing if word counts look high.
        expect(lastInfo()).toBe('"S" — 2 items, 5 words  Done: 1/2');
    });

    it('adds the done count alongside tags', async () => {
        openEditor(['> S', '>> - [x] a #t'], { cursor: 1 });
        await onShowSectionSummary();
        expect(lastInfo()).toBe('"S" — 1 item, 3 words  Done: 1/1  Tags: #t×1');
    });

    it('tallies each tag across the section', async () => {
        openEditor(['> S', '>> - a #x #y', '>> - b #x'], { cursor: 1 });
        await onShowSectionSummary();
        expect(lastInfo()).toBe('"S" — 2 items, 5 words  Tags: #x×2, #y×1');
    });

    it('counts numbered items and skips non-item lines', async () => {
        openEditor(['> S', '>> 1. counted', 'loose prose line'], { cursor: 1 });
        await onShowSectionSummary();
        expect(lastInfo()).toBe('"S" — 1 item, 1 words');
    });

    it('stops at the next section', async () => {
        openEditor(['> One', '>> - a', '> Two', '>> - b', '>> - c'], { cursor: 1 });
        await onShowSectionSummary();
        expect(lastInfo()).toBe('"One" — 1 item, 1 words');
    });
});

describe('onCountItemsByTag', () => {
    const call = () => mock.recorded.quickPickCalls.at(-1)!;

    it('does nothing without an active editor', async () => {
        await onCountItemsByTag();
        expect(mock.recorded.quickPickCalls).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['>> - a #t'], { languageId: 'plaintext' });
        await onCountItemsByTag();
        expect(mock.recorded.quickPickCalls).toHaveLength(0);
    });

    it('reports when the file has no tags', async () => {
        openEditor(['> S', '>> - untagged']);
        await onCountItemsByTag();
        expect(lastInfo()).toBe('CL: No #tags found in this file');
        expect(mock.recorded.quickPickCalls).toHaveLength(0);
    });

    it('offers one row per tag, most used first', async () => {
        openEditor(['>> - a #rare', '>> - b #common', '>> - c #common']);
        await onCountItemsByTag();
        expect(call().items.map((i) => i.label)).toEqual(['$(tag) #common', '$(tag) #rare']);
    });

    it('pluralises the item count', async () => {
        openEditor(['>> - a #one', '>> - b #two', '>> - c #two']);
        await onCountItemsByTag();
        expect(call().items.map((i) => i.description)).toEqual(['2 items', '1 item']);
    });

    it('counts tags from numbered items and ignores non-item lines', async () => {
        openEditor(['>> 1. a #t', 'prose #t', '# heading #t']);
        await onCountItemsByTag();
        expect(call().items).toEqual([{ label: '$(tag) #t', description: '1 item' }]);
    });

    it('marks the pick as read-only in its placeholder', async () => {
        openEditor(['>> - a #t']);
        await onCountItemsByTag();
        expect(call().options.placeHolder).toBe('Item counts by tag (read-only)');
    });
});
