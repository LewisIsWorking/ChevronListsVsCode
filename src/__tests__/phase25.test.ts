import { describe, it, expect } from 'bun:test';
import { formatDate, nextWeekday } from '../patterns';

describe('formatDate', () => {
    it('formats a date as YYYY-MM-DD', () => {
        expect(formatDate(new Date(2026, 2, 20))).toBe('2026-03-20');
    });
    it('zero-pads month and day', () => {
        expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
});

describe('nextWeekday', () => {
    it('returns next Friday from a Monday', () => {
        // Monday March 16 2026
        const monday = new Date(2026, 2, 16);
        const friday = nextWeekday(5, monday);
        expect(friday.getDay()).toBe(5);
        expect(formatDate(friday)).toBe('2026-03-20');
    });
    it('returns NEXT occurrence when today is already that day', () => {
        // Friday March 20 2026 - next Friday should be March 27
        const friday = new Date(2026, 2, 20);
        const nextFri = nextWeekday(5, friday);
        expect(formatDate(nextFri)).toBe('2026-03-27');
    });
    it('returns correct day of week', () => {
        const monday = new Date(2026, 2, 16);
        expect(nextWeekday(1, monday).getDay()).toBe(1); // next Monday
    });
});
