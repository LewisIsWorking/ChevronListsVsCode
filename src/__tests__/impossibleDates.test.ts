/**
 * parseNaturalDate must refuse dates that do not exist, so Set Due Date's
 * validation rejects them instead of writing them into the document.
 */
import { describe, it, expect } from 'bun:test';
import { parseNaturalDate } from '../patternsUtils';

describe('parseNaturalDate with impossible dates', () => {
    const from = new Date(2026, 0, 28);

    it('refuses a month that does not exist', () => {
        expect(parseNaturalDate('2026-13-45', from)).toBeNull();
    });

    it('refuses a day the month does not have', () => {
        expect(parseNaturalDate('2026-02-30', from)).toBeNull();
        expect(parseNaturalDate('2026-02-29', from)).toBeNull();
    });

    it('accepts a real leap day and an ordinary date', () => {
        expect(parseNaturalDate('2028-02-29', from)).toBe('2028-02-29');
        expect(parseNaturalDate('2026-12-31', from)).toBe('2026-12-31');
    });

    it('refuses a relative date too far ahead to represent', () => {
        expect(parseNaturalDate('+99999999999', from)).toBeNull();
    });
});
