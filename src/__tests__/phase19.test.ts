import { describe, it, expect } from 'bun:test';
import { offsetNumberedLine } from '../patterns';
import { stripAllMetadata } from '../metadataStripper';
import { topWords } from '../wordFrequency';

describe('offsetNumberedLine', () => {
    it('adds a positive offset', () => {
        expect(offsetNumberedLine('>> 5. item', 10)).toBe('>> 15. item');
    });
    it('subtracts a negative offset', () => {
        expect(offsetNumberedLine('>> 15. item', -5)).toBe('>> 10. item');
    });
    it('returns null when result would be below 1', () => {
        expect(offsetNumberedLine('>> 2. item', -5)).toBeNull();
    });
    it('returns null for non-numbered lines', () => {
        expect(offsetNumberedLine('>> - bullet', 5)).toBeNull();
    });
    it('preserves content', () => {
        expect(offsetNumberedLine('>> 3. my content here', 1)).toBe('>> 4. my content here');
    });
});

describe('stripAllMetadata', () => {
    it('removes a tag', () => {
        expect(stripAllMetadata('item #urgent')).toBe('item');
    });
    it('removes priority', () => {
        expect(stripAllMetadata('!!! critical task')).toBe('critical task');
    });
    it('removes due date', () => {
        expect(stripAllMetadata('item @2026-03-20')).toBe('item');
    });
    it('removes colour label', () => {
        expect(stripAllMetadata('{red} blocked')).toBe('blocked');
    });
    it('removes inline comment', () => {
        expect(stripAllMetadata('deploy // ask Lewis')).toBe('deploy');
    });
    it('removes flag marker', () => {
        expect(stripAllMetadata('? unclear item')).toBe('unclear item');
    });
    it('keeps strikethrough text content', () => {
        expect(stripAllMetadata('~~cancelled thing~~')).toBe('cancelled thing');
    });
    it('removes vote count', () => {
        expect(stripAllMetadata('good idea +5')).toBe('good idea');
    });
    it('strips multiple markers', () => {
        // Markers in the positions their parsers recognise: checkbox then priority
        // lead, the vote trails. This fixture previously put "!!!" mid-sentence
        // and expected it stripped -- but parsePriority never treats a mid-sentence
        // "!!!" as a priority, so no other feature did either.
        const result = stripAllMetadata('[x] !!! deploy #urgent @2026-01-01 +3');
        expect(result).toBe('deploy');
    });
});

describe('topWords', () => {
    it('returns top words by frequency', () => {
        const words = topWords(['deploy server', 'deploy database', 'fix server']);
        expect(words[0].word).toBe('deploy');
        expect(words[0].count).toBe(2);
    });
    it('excludes stop words', () => {
        const words = topWords(['the quick fox', 'and the fast fox']);
        expect(words.every(w => !['the', 'and'].includes(w.word))).toBe(true);
    });
    it('excludes short words', () => {
        const words = topWords(['go do it now run']);
        expect(words.every(w => w.word.length > 2)).toBe(true);
    });
    it('returns empty for no content', () => {
        expect(topWords([])).toHaveLength(0);
    });
});
