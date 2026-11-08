/**
 * An estimate is read from an item's words: the first real one, past any "~" that
 * is not an estimate, and not from its comment.
 */
import { describe, it, expect } from 'bun:test';
import { parseEstimateToMinutes } from '../patterns';
import { parseEstimate } from '../estimateParser';

describe('estimate scope', () => {
    it('finds an estimate after strikethrough', () => expect(parseEstimateToMinutes('~~a~~ ~2h')).toBe(120));
    it('finds an estimate after a loose tilde', () => expect(parseEstimateToMinutes('about ~5 then ~30m')).toBe(30));
    it('agrees with the other parser on hours and minutes', () => expect(parseEstimateToMinutes('~1h30m')).toBe(90));
    it('does not read the comment', () => {
        expect(parseEstimateToMinutes('a // took ~2h')).toBe(0);
        expect(parseEstimate('a // took ~2h')).toBeNull();
    });
    it('reads the words before a comment', () => {
        expect(parseEstimate('a ~1h // took ~2h')?.totalMinutes).toBe(60);
        expect(parseEstimate('a ~1h // took ~2h')?.contentWithout).toBe('a // took ~2h');
    });
});
