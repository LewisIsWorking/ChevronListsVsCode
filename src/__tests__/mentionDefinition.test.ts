/**
 * One definition of an @Name mention, used everywhere (MENTION_RE in
 * mentionParser.ts), as the docs describe it.
 *
 * Bugs fixed, with regression tests checked against the original code:
 *  - Filter by Mention and mention completion treated "@daily", "@weekly",
 *    "@monthly", "@created:" and "@expires:" as people, and "bob@example.com"
 *    as a mention of "example";
 *  - the Mentions Report and Group by Mention cut "@Mary-Jane" to "Mary";
 *  - the Mentions Report counted an item that names someone twice as two items;
 *  - Filter by Mention said "1 items".
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { extractMentions } from '../mentionParser';
import { collectMentionStats, groupLinesByMention } from '../patterns';
import { onFilterByMention } from '../mentionCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { quickPickCalls: { items: { label: string; description: string }[] }[]; info: string[] };
};
const lines = (ls: string[]) => ls.map(text => ({ text }));

beforeEach(() => { mock.__reset(); deactivate(); });

describe('what is a mention', () => {
    it('@ then a capital letter, then word characters or hyphens', () => {
        expect(extractMentions('@Alice asks @Mary-Jane and @Jo_Smith')).toEqual(['Alice', 'Mary-Jane', 'Jo_Smith']);
    });

    it('not a metadata marker, a lower-case word, a date or an e-mail address', () => {
        expect(extractMentions('@daily @weekly @monthly @created:2026-01-01 @expires:2026-02-01 @alice @2026-03-03 bob@Example.com')).toEqual([]);
    });
});

describe('every mention feature uses it', () => {
    it('the Mentions Report keeps hyphenated names and counts an item once per person', () => {
        expect(collectMentionStats(lines(['>> - [x] @Mary-Jane and @Mary-Jane again', '>> - @Mary-Jane @daily']), '-')).toEqual([
            { name: 'Mary-Jane', total: 2, done: 1 },
        ]);
    });

    it('Group by Mention groups by the whole name', () => {
        const groups = groupLinesByMention([{ text: 'ask @Mary-Jane', index: 0 }, { text: 'task @daily', index: 1 }], '-');
        expect([...groups.keys()]).toEqual(['Mary-Jane', 'Unassigned']);
    });

    it('Filter by Mention lists people only, with "1 item" and "2 items"', async () => {
        openEditor(['> S', '>> - @Sam ping @daily', '>> - @Sam again', '>> - mail bob@example.com @Lee']);
        await onFilterByMention();
        expect(mock.recorded.quickPickCalls[0].items.map(i => [i.label, i.description])).toEqual([
            ['$(person) @Lee', '1 item'],
            ['$(person) @Sam', '2 items'],
        ]);
    });
});
