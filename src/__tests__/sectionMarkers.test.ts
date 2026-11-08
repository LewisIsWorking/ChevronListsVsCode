/**
 * The section-wide marker commands must read an item's leading markers in any
 * order, as the parsers do, and leave punctuation in the words alone.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onMarkAllDone, onMarkAllUndone, onRemoveAllCheckboxes } from '../completionCommands';
import { onMarkAllDoneSection, onMarkAllUndoneSection } from '../bulkCheckboxCommands';
import { onClearAllPriority } from '../batchClearCommands';
import { stripAllMetadata } from '../metadataStripper';

const mock = vscode as unknown as { __reset(): void };

describe('section-wide marker commands', () => {
    beforeEach(() => mock.__reset());
    afterEach(() => deactivate());

    async function run(command: () => Promise<void>, content: string): Promise<string> {
        const h = openEditor(['> A', `>> - ${content}`], { cursor: 1, character: 5 });
        await command();
        return h.lines()[1];
    }

    it('Clear All Priority leaves an exclamation mark in the words', async () => {
        expect(await run(onClearAllPriority, 'Wow! great')).toBe('>> - Wow! great');
        expect(await run(onClearAllPriority, '!important')).toBe('>> - !important');
    });

    it('Clear All Priority still clears a priority', async () => {
        expect(await run(onClearAllPriority, '[ ] !!! a')).toBe('>> - [ ] a');
    });

    it('Mark All Done finds a checkbox after a priority', async () => {
        expect(await run(onMarkAllDone, '!! [ ] a')).toBe('>> - [x] !! a');
    });

    it('Mark All Undone finds a checkbox after a priority', async () => {
        expect(await run(onMarkAllUndone, '!! [x] a')).toBe('>> - [ ] !! a');
    });

    it('Remove All Checkboxes finds a checkbox after a priority', async () => {
        expect(await run(onRemoveAllCheckboxes, '!! [x] a')).toBe('>> - !! a');
    });

    it('the section checkbox commands find a checkbox after a priority', async () => {
        expect(await run(onMarkAllDoneSection, '!! [ ] a')).toBe('>> - [x] !! a');
        expect(await run(onMarkAllUndoneSection, '!! [x] a')).toBe('>> - [ ] !! a');
    });

    it('stripAllMetadata finds a checkbox after a priority', () => {
        expect(stripAllMetadata('!! [ ] a')).toBe('a');
    });
});
