/**
 * Stars and flags must be found among an item's leading markers in any order,
 * expiry dates must come from its words, and a leaderboard must not cut the
 * wrong "+N" from an item or show the vote twice.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { parseStar, toggleStar } from '../starParser';
import { parseFlag, toggleFlag } from '../flagParser';
import { parseExpiry } from '../expiryParser';
import { onShowVoteLeaderboard } from '../voteLeaderboardCommands';
import { onShowSectionVoteLeaderboard } from '../sectionVoteLeaderboardCommands';

const mock = vscode as unknown as {
    __reset(): void;
    lastQuickPick(): { items: Array<{ label: string }> };
};

describe('marker order', () => {
    it('finds a star after a checkbox', () => expect(parseStar('[ ] * a')?.contentWithout).toBe('[ ] a'));
    it('finds a star after a priority', () => expect(parseStar('!! * a')?.contentWithout).toBe('!! a'));
    it('adds a star after a checkbox', () => expect(toggleStar('[ ] a')).toBe('[ ] * a'));
    it('removes a star after a checkbox', () => expect(toggleStar('[ ] * a')).toBe('[ ] a'));
    it('keeps a flag when starring', () => expect(toggleStar('? a')).toBe('* ? a'));
    it('finds a flag after a checkbox', () => expect(parseFlag('[x] ? a')?.contentWithout).toBe('[x] a'));
    it('adds a flag after a priority', () => expect(toggleFlag('! a')).toBe('! ? a'));
    it('removes a flag after a priority', () => expect(toggleFlag('! ? a')).toBe('! a'));
    it('keeps a star when flagging', () => expect(toggleFlag('* a')).toBe('? * a'));
});

describe('expiry scope', () => {
    it('reads the words', () => expect(parseExpiry('a @expires:2026-01-01')).toBe('2026-01-01'));
    it('does not read the comment', () => expect(parseExpiry('a // @expires:2026-01-01')).toBeNull());
});

describe('vote leaderboard labels', () => {
    beforeEach(() => mock.__reset());
    afterEach(() => deactivate());

    it('removes the vote, not an earlier +N, across the file', async () => {
        openEditor(['> A', '>> - try +1 more +3'], { cursor: 1 });
        await onShowVoteLeaderboard();
        expect(mock.lastQuickPick().items[0].label).toBe('$(star-full) +3  try +1 more');
    });

    it('does not show the vote twice in a section', async () => {
        openEditor(['> A', '>> - a +3'], { cursor: 1 });
        await onShowSectionVoteLeaderboard();
        expect(mock.lastQuickPick().items[0].label).toBe('$(star-full) +3  a');
    });
});
