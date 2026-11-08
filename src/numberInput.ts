/**
 * Validators for prompts that ask for a whole number. They judge the number
 * rather than the digits typed, so "00" and "-0" are zero, and they refuse a
 * value beyond MAX_WHOLE_NUMBER: past a point a typed number is no longer kept
 * exact and a date moved by it cannot be written.
 */
const MAX_WHOLE_NUMBER = 1_000_000;

function inRange(text: string): boolean {
    return Math.abs(Number(text)) <= MAX_WHOLE_NUMBER;
}

/** Input box validator: null for a whole number above zero */
export function validatePositiveInteger(value: string): string | null {
    const text = value.trim();
    return /^\d+$/.test(text) && Number(text) > 0 && inRange(text) ? null : 'Enter a positive integer';
}

/** Input box validator: null for a whole number other than zero, negative allowed */
export function validateNonZeroInteger(value: string): string | null {
    const text = value.trim();
    return /^-?\d+$/.test(text) && Number(text) !== 0 && inRange(text) ? null : 'Enter a non-zero integer';
}
