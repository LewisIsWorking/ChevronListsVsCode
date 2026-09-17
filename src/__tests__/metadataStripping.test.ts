/**
 * Regression tests for stripAllMetadata and parseComment.
 *
 * stripAllMetadata stripped position-sensitive markers ANYWHERE in the text,
 * while the parsers that define those markers only recognise them at the start
 * (checkbox, priority, star, flag) or the end (votes). It therefore ate ordinary
 * prose, and 23 modules inherit its output: word counts, duplicate detection,
 * exports, previews, reading time, word clouds.
 *
 * parseComment matched `//` anywhere, so every URL was split into a body and a
 * bogus comment.
 *
 * Both were confirmed by execution before being fixed, and these tests were
 * checked against the original code, where they fail.
 */
import { describe, it, expect } from 'bun:test';
import { stripAllMetadata } from '../metadataStripper';
import { parseComment, stripComment } from '../commentParser';
import { parsePriority } from '../priorityParser';
import { parseStar } from '../starParser';
import { parseFlag } from '../flagParser';
import { parseVote } from '../voteParser';

describe('stripAllMetadata leaves ordinary prose alone', () => {
    it('keeps a question mark mid-sentence', () => {
        expect(stripAllMetadata('Why? Because')).toBe('Why? Because');
    });

    it('keeps exclamation marks mid-sentence', () => {
        expect(stripAllMetadata('Wow!! amazing')).toBe('Wow!! amazing');
    });

    it('keeps a plus followed by digits mid-sentence', () => {
        expect(stripAllMetadata('C++11 rocks')).toBe('C++11 rocks');
    });

    it('keeps an asterisk mid-sentence', () => {
        expect(stripAllMetadata('5 * 3 = 15')).toBe('5 * 3 = 15');
    });

    it('keeps a bracketed x that is not a leading checkbox', () => {
        expect(stripAllMetadata('index array[x] here')).toBe('index array[x] here');
    });
});

describe('stripAllMetadata still strips real markers', () => {
    it('strips a leading completed checkbox', () => {
        expect(stripAllMetadata('[x] done')).toBe('done');
    });

    it('strips a leading open checkbox', () => {
        expect(stripAllMetadata('[ ] todo')).toBe('todo');
    });

    it('strips a leading priority', () => {
        expect(stripAllMetadata('!!! urgent')).toBe('urgent');
    });

    it('strips a leading star', () => {
        expect(stripAllMetadata('* starred')).toBe('starred');
    });

    it('strips a leading flag', () => {
        expect(stripAllMetadata('? unclear')).toBe('unclear');
    });

    it('strips a trailing vote', () => {
        expect(stripAllMetadata('good idea +5')).toBe('good idea');
    });

    it('strips leading markers in the parsers’ own order', () => {
        expect(stripAllMetadata('[ ] !! * nested markers')).toBe('nested markers');
    });

    it('strips a trailing comment', () => {
        expect(stripAllMetadata('deploy // ask first')).toBe('deploy');
    });
});

describe('stripAllMetadata agrees with the parsers', () => {
    // The point of the fix: strip exactly what the extension treats as metadata.
    const cases = [
        'Wow!! amazing', '!!! urgent', 'deploy !!! now',
        '5 * 3 = 15', '* starred',
        'Why? Because', '? unclear',
        'C++11 rocks', 'idea +5', 'idea +5 // note',
    ];

    for (const text of cases) {
        it(`only strips a marker the parser recognises in "${text}"`, () => {
            const recognised = Boolean(parsePriority(text) || parseStar(text) || parseFlag(text) || parseVote(text));
            const changed = stripAllMetadata(text) !== text.trim();
            // A comment also changes the text, so exclude that case from this invariant.
            if (!text.includes('//')) { expect(changed).toBe(recognised); }
        });
    }

    it('strips a vote followed by a comment, which parseVote reads as a vote', () => {
        // A comment used to hide the vote from parseVote, so both kept "+5".
        expect(parseVote('idea +5 // note')?.count).toBe(5);
        expect(stripAllMetadata('idea +5 // note')).toBe('idea');
    });
});

describe('URLs are not comments', () => {
    it('parseComment ignores the // inside a URL', () => {
        expect(parseComment('see https://example.com')).toBeNull();
    });

    it('parseComment still finds a real comment after a URL', () => {
        expect(parseComment('see https://example.com // check it')).toEqual({
            body: 'see https://example.com',
            comment: 'check it',
        });
    });

    it('parseComment keeps a URL that sits inside the comment', () => {
        expect(parseComment('task // see https://example.com')).toEqual({
            body: 'task',
            comment: 'see https://example.com',
        });
    });

    it('stripComment leaves a URL intact', () => {
        expect(stripComment('see https://example.com')).toBe('see https://example.com');
    });

    it('stripAllMetadata leaves a URL intact', () => {
        expect(stripAllMetadata('see https://example.com')).toBe('see https://example.com');
    });

    it('parseComment still accepts a whole-line comment', () => {
        expect(parseComment('// only a comment')).toEqual({ body: '', comment: 'only a comment' });
    });
});
