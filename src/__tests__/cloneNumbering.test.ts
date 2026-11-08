/**
 * Covers src/cloneCommands.ts -- a numbered clone continues the list it lands in.
 * Clones used to keep the original's number, so "1. a, 2. b" cloned at 1 read
 * "1. a, 2. b, 1. a".
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onCloneItem, onCloneItemToSection } from '../cloneCommands';

const mock = vscode as unknown as { __reset(): void; queued: { quickPick: unknown[] } };

beforeEach(() => {
    mock.__reset();
    deactivate();
});

describe('numbered clones', () => {
    it('Clone Item continues the list', async () => {
        const h = openEditor(['> A', '>> 1. a', '>> 2. b', '', '> B'], { cursor: 1 });
        await onCloneItem();
        expect(h.lines()).toEqual(['> A', '>> 1. a', '>> 2. b', '>> 3. a', '', '> B']);
    });

    it('counts only lines at the same depth', async () => {
        const h = openEditor(['> A', '>> 1. a', '>>> 7. kid'], { cursor: 1 });
        await onCloneItem();
        expect(h.lines()).toEqual(['> A', '>> 1. a', '>>> 7. kid', '>> 2. a']);
    });

    it('Clone Item to Section continues the list there', async () => {
        const h = openEditor(['> A', '>> 5. a', '> B', '>> 1. b', '>> 2. c'], { cursor: 1 });
        mock.queued.quickPick.push({ label: 'B', lineIndex: 2 });
        await onCloneItemToSection();
        expect(h.lines()).toEqual(['> A', '>> 5. a', '> B', '>> 1. b', '>> 2. c', '>> 3. a']);
    });

    it('starts at 1 in a section with no numbered list', async () => {
        const h = openEditor(['> A', '>> 5. a', '> B', '>> - b'], { cursor: 1 });
        mock.queued.quickPick.push({ label: 'B', lineIndex: 2 });
        await onCloneItemToSection();
        expect(h.lines()).toEqual(['> A', '>> 5. a', '> B', '>> - b', '>> 1. a']);
    });

    it('leaves a bullet as it is', async () => {
        const h = openEditor(['> A', '>> - a'], { cursor: 1 });
        await onCloneItem();
        expect(h.lines()).toEqual(['> A', '>> - a', '>> - a']);
    });
});
