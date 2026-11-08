/**
 * Due dates, recurrence and mentions come from an item's words, not its comment.
 * A recurrence must be the whole word, and tag and mention stats must find a done
 * checkbox wherever it sits among the leading markers.
 */
import { describe, it, expect } from 'bun:test';
import { extractDate } from '../dueDateParser';
import { parseRecurrence } from '../recurrenceParser';
import { extractMentions } from '../mentionParser';
import { collectTagStats, collectMentionStats } from '../patterns';

describe('item word scopes', () => {
    it('reads a due date from the words', () => {
        expect(extractDate('a @2026-01-01 b')).toEqual({ dateStr: '2026-01-01', contentWithout: 'a b' });
    });
    it('does not read a due date from the comment', () => expect(extractDate('a // @2026-01-01')).toBeNull());

    it('reads a recurrence from the words', () => {
        expect(parseRecurrence('a @Weekly b')).toEqual({ type: 'weekly', contentWithout: 'a b' });
    });
    it('does not read a recurrence from the comment', () => expect(parseRecurrence('a // @daily')).toBeNull());
    it('needs the whole recurrence word', () => expect(parseRecurrence('see @dailybrief')).toBeNull());

    it('reads a mention from the words', () => expect(extractMentions('a @Sam')).toEqual(['Sam']));
    it('does not read a mention from the comment', () => expect(extractMentions('a // @Sam')).toEqual([]));

    it('counts a done box after a priority for a tag', () => {
        expect(collectTagStats([{ text: '>> - !! [x] a #x' }], '-')).toEqual([{ tag: 'x', total: 1, done: 1 }]);
    });
    it('counts a done box after a star for a mention', () => {
        expect(collectMentionStats([{ text: '>> - * [x] a @Sam' }], '-')).toEqual([{ name: 'Sam', total: 1, done: 1 }]);
    });
});
