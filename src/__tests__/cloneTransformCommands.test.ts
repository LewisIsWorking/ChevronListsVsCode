/**
 * Covers src/cloneTransformCommands.ts -- Clone Item as Done must leave one
 * checkbox on the copy. It only recognised a lowercase checkbox at the very
 * start, so "[X] a" and "!! [ ] a" gained a second one.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onCloneItemAsDone } from '../cloneTransformCommands';

const mock = vscode as unknown as { __reset(): void };

beforeEach(() => {
    mock.__reset();
    deactivate();
});

describe('onCloneItemAsDone', () => {
    const copyOf = async (item: string) => {
        const h = openEditor([item], { cursor: 0 });
        await onCloneItemAsDone();
        return h.lines()[1];
    };

    it('adds a checkbox to an item without one', async () => {
        expect(await copyOf('>> - a')).toBe('>> - [x] a');
    });

    it('ticks an open checkbox', async () => {
        expect(await copyOf('>> - [ ] a')).toBe('>> - [x] a');
    });

    it('does not double a capital checkbox', async () => {
        expect(await copyOf('>> - [X] a')).toBe('>> - [x] a');
    });

    it('does not double a checkbox after other markers', async () => {
        expect(await copyOf('>> - !! [ ] a')).toBe('>> - [x] !! a');
    });

    it('keeps the vote and comment', async () => {
        expect(await copyOf('>> - a +2 // note')).toBe('>> - [x] a +2 // note');
    });
});
