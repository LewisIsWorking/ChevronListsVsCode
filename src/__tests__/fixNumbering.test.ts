/**
 * Fix Numbering counted by depth across the whole section, so the children of two
 * parents were one list: it changed the second "1." to "2." The rest of the
 * numbering features count each list separately (see NumberingRuns), and a clone
 * at the end of a section has to do the same.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onFixNumbering } from '../diagnosticProvider';
import { onCloneItem } from '../cloneCommands';

const mock = vscode as unknown as { __reset(): void; recorded: { info: string[] } };

beforeEach(() => {
    mock.__reset();
    deactivate();
});

describe('Fix Numbering', () => {
    it('counts the children of each parent separately', async () => {
        const lines = ['> A', '>> 1. a', '>>> 1. a1', '>> 2. b', '>>> 1. b1'];
        const h = openEditor(lines, { cursor: 1 });
        await onFixNumbering();
        expect(h.lines()).toEqual(lines);
    });

    it('fixes numbers out of sequence, section by section', async () => {
        const h = openEditor(['> A', '>> 3. a', '>> 7. b', '> B', '>> 2. c'], { cursor: 1 });
        await onFixNumbering();
        expect(h.lines()).toEqual(['> A', '>> 1. a', '>> 2. b', '> B', '>> 1. c']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Numbered items fixed');
    });

    it('leaves items before the first section alone', async () => {
        const h = openEditor(['>> 5. x', '> A', '>> 3. a'], { cursor: 2 });
        await onFixNumbering();
        expect(h.lines()).toEqual(['>> 5. x', '> A', '>> 1. a']);
    });
});

describe('Clone Item at a nested depth', () => {
    it('starts a new list when a shallower item ended the old one', async () => {
        const h = openEditor(['> A', '>> 1. a', '>>> 5. x', '>> 2. b'], { cursor: 2 });
        await onCloneItem();
        expect(h.lines()).toEqual(['> A', '>> 1. a', '>>> 5. x', '>> 2. b', '>>> 1. x']);
    });
});
