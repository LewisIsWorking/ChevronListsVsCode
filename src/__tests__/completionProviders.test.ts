/**
 * Covers src/completionProviders.ts -- the five completion providers.
 * 79 statements, previously 0%.
 *
 * Each provider is a pure function of (document, position) that first checks
 * what the user just typed. The "wrong trigger returns nothing" path is the
 * one that fires most often in real use and was never tested.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { makeEditor } from './helpers/editorHarness';
import {
    ChevronTagCompletionProvider,
    ChevronMentionCompletionProvider,
    ChevronLinkCompletionProvider,
    ChevronPriorityCompletionProvider,
    ChevronDateCompletionProvider,
} from '../completionProviders';

const mock = vscode as unknown as { __reset(): void };

/** Runs `provider` with the cursor at the end of the last line of `lines`. */
function complete(provider: { provideCompletionItems(d: never, p: never): vscode.CompletionItem[] }, lines: string[]) {
    const { document } = makeEditor(lines);
    const last = lines.length - 1;
    const pos = new vscode.Position(last, lines[last].length);
    return provider.provideCompletionItems(document as never, pos as never);
}

const labels = (items: vscode.CompletionItem[]) => items.map((i) => i.label);

beforeEach(() => mock.__reset());

describe('ChevronTagCompletionProvider', () => {
    const p = new ChevronTagCompletionProvider();

    it('offers nothing unless the cursor follows a #', () => {
        expect(complete(p, ['>> - task', '>> - '])).toHaveLength(0);
    });

    it('collects tags from the items in the file', () => {
        const items = complete(p, ['>> - a #alpha', '>> - b #beta', '>> - #']);
        expect(labels(items).sort()).toEqual(['alpha', 'beta']);
    });

    it('orders tags by how often they are used', () => {
        const items = complete(p, ['>> - a #rare', '>> - b #common', '>> - c #common', '>> - #']);
        expect(labels(items)[0]).toBe('common');
    });

    it('reports the usage count in the detail', () => {
        const items = complete(p, ['>> - a #x', '>> - b #x', '>> - #']);
        expect(items[0].detail).toBe('#x — used 2×');
    });

    it('inserts the bare tag, since the # is already typed', () => {
        const items = complete(p, ['>> - a #x', '>> - #']);
        expect(items[0].insertText).toBe('x');
    });

    it('ignores tags outside chevron items', () => {
        expect(complete(p, ['# not an item tag', '> Header #nope', '>> - #'])).toHaveLength(0);
    });

    it('reads tags from numbered items too', () => {
        expect(labels(complete(p, ['>> 1. a #fromnumbered', '>> - #']))).toEqual(['fromnumbered']);
    });
});

describe('ChevronMentionCompletionProvider', () => {
    const p = new ChevronMentionCompletionProvider();

    it('offers nothing unless the cursor follows an @', () => {
        expect(complete(p, ['>> - task'])).toHaveLength(0);
    });

    it('does not fire when the @ follows a digit, which means a date', () => {
        expect(complete(p, ['>> - alice @alice', '>> - due 2026@'])).toHaveLength(0);
    });

    it('offers names already mentioned in the file', () => {
        const items = complete(p, ['>> - ping @alice', '>> - ping @bob', '>> - @']);
        expect(labels(items).sort()).toEqual(['alice', 'bob']);
    });

    it('inserts the bare name and shows the @ form as detail', () => {
        const items = complete(p, ['>> - ping @alice', '>> - @']);
        expect(items[0].insertText).toBe('alice');
        expect(items[0].detail).toBe('@alice');
    });
});

describe('ChevronLinkCompletionProvider', () => {
    const p = new ChevronLinkCompletionProvider();

    it('offers nothing unless the cursor follows [[', () => {
        expect(complete(p, ['> Tasks', '>> - see ['])).toHaveLength(0);
    });

    it('offers every header in the file', () => {
        expect(labels(complete(p, ['> One', '> Two', '>> - see [[']))).toEqual(['One', 'Two']);
    });

    it('closes the brackets for you', () => {
        const items = complete(p, ['> One', '>> - see [[']);
        expect((items[0].insertText as vscode.SnippetString).value).toBe('One]]');
    });

    it('offers nothing when the file has no headers', () => {
        expect(complete(p, ['>> - see [['])).toHaveLength(0);
    });
});

describe('ChevronPriorityCompletionProvider', () => {
    const p = new ChevronPriorityCompletionProvider();

    it('offers nothing unless the cursor follows a !', () => {
        expect(complete(p, ['>> - task'])).toHaveLength(0);
    });

    it('offers the three priority levels in order', () => {
        expect(labels(complete(p, ['>> - task !']))).toEqual(['!', '!!', '!!!']);
    });

    it('describes each level', () => {
        expect(complete(p, ['>> - task !']).map((i) => i.detail))
            .toEqual(['Low priority', 'Medium priority', 'High priority']);
    });

    it('inserts only the characters still missing, since one ! is typed', () => {
        expect(complete(p, ['>> - task !']).map((i) => i.insertText)).toEqual(['', '!', '!!']);
    });
});

describe('ChevronDateCompletionProvider', () => {
    const p = new ChevronDateCompletionProvider();
    const today = new Date().toISOString().slice(0, 10);

    it('offers nothing unless the cursor follows an @', () => {
        expect(complete(p, ['>> - task'])).toHaveLength(0);
    });

    it('offers the five relative dates in order', () => {
        const items = complete(p, ['>> - task @']);
        expect(items).toHaveLength(5);
        expect(items.map((i) => i.sortText)).toEqual(['1', '2', '3', '4', '5']);
    });

    it('labels each option with the date it resolves to', () => {
        const [first] = complete(p, ['>> - task @']);
        expect(first.label).toBe(`today (${today})`);
        expect(first.detail).toBe(today);
    });

    it('inserts the resolved date, not the words', () => {
        expect(complete(p, ['>> - task @'])[0].insertText).toBe(today);
    });

    it('resolves every option to an ISO date', () => {
        for (const item of complete(p, ['>> - task @'])) {
            expect(item.detail).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
    });
});
