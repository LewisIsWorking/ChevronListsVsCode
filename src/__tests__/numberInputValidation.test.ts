/**
 * Every prompt for a whole number means the number, not the digits typed: "00"
 * and "-0" are zero, and a number too large to keep exact is refused.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onOffsetListNumbers } from '../listRebaseCommands';
import { onSetListStartNumber } from '../listStartCommands';
import { onShiftAllDueDates } from '../shiftDueDatesCommands';
import { onArchiveOldDoneItems } from '../archiveOldDoneCommands';
import { onRemoveOldItems } from '../removeOldItemsCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { inputBoxCalls: { validateInput(v: string): string | null }[] };
};

async function validatorOf(command: () => Promise<void>): Promise<(v: string) => string | null> {
    openEditor(['> S', '>> 1. a'], { cursor: 1 });
    await command();
    return mock.recorded.inputBoxCalls[0].validateInput;
}

const TOO_BIG = '99999999999999999999';

describe('whole number prompts', () => {
    beforeEach(() => mock.__reset());
    afterEach(() => deactivate());

    for (const [name, command] of [
        ['Offset List Numbers', onOffsetListNumbers],
        ['Shift All Due Dates', onShiftAllDueDates],
    ] as const) {
        it(`${name} treats every spelling of zero as zero`, async () => {
            const validate = await validatorOf(command);
            expect(validate('00')).toBe('Enter a non-zero integer');
            expect(validate('-0')).toBe('Enter a non-zero integer');
            expect(validate('-5')).toBeNull();
            expect(validate('7')).toBeNull();
        });

        it(`${name} refuses a number too large to keep exact`, async () => {
            expect((await validatorOf(command))(TOO_BIG)).toBe('Enter a non-zero integer');
        });
    }

    for (const [name, command] of [
        ['Set List Start Number', onSetListStartNumber],
        ['Archive Old Done Items', onArchiveOldDoneItems],
        ['Remove Old Items', onRemoveOldItems],
    ] as const) {
        it(`${name} takes a positive number within range`, async () => {
            const validate = await validatorOf(command);
            expect(validate('30')).toBeNull();
            expect(validate('0')).toBe('Enter a positive integer');
            expect(validate('x')).toBe('Enter a positive integer');
            expect(validate(TOO_BIG)).toBe('Enter a positive integer');
        });
    }
});
