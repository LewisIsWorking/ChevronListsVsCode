/**
 * Replace in Section edits an item's words and never its list marker, Convert
 * Item to Section Link matches a name holding punctuation, and Extract URLs
 * leaves out the punctuation of the sentence around a link.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onReplaceInSection } from '../findReplaceCommands';
import { onConvertItemToSectionLink } from '../convertToLinkCommands';
import { onExtractUrlsFromSection } from '../urlExtractorCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[]; quickPickCalls: { items: { url: string }[] }[] };
    queued: { inputBox: (string | undefined)[] };
};

describe('section text fixes', () => {
    beforeEach(() => mock.__reset());
    afterEach(() => deactivate());

    it('Replace in Section leaves a bullet marker alone', async () => {
        const h = openEditor(['> S', '>> - a-b'], { cursor: 1 });
        mock.queued.inputBox.push('-', 'x');
        await onReplaceInSection();
        expect(h.lines()[1]).toBe('>> - axb');
    });

    it('Replace in Section leaves a number and the chevrons alone', async () => {
        const h = openEditor(['> S', '>> 1. a1', '>> - b>c'], { cursor: 1 });
        mock.queued.inputBox.push('1', '2');
        await onReplaceInSection();
        expect(h.lines()[1]).toBe('>> 1. a2');
    });

    it('Replace in Section skips an item matching only in its marker', async () => {
        const h = openEditor(['> S', '>> 1. a'], { cursor: 1 });
        mock.queued.inputBox.push('1', '2');
        await onReplaceInSection();
        expect(h.lines()[1]).toBe('>> 1. a');
        expect(mock.recorded.info).toContain('CL: No occurrences of "1" found in section');
    });

    it('Replace in Section counts occurrences, not lines', async () => {
        openEditor(['> S', '>> - a a'], { cursor: 1 });
        mock.queued.inputBox.push('a', 'b');
        await onReplaceInSection();
        expect(mock.recorded.info).toContain('CL: Replaced 2 occurrences in section');
    });

    it('Convert to Section Link matches a name ending in punctuation', async () => {
        const h = openEditor(['> Launch!', '> B', '>> - Launch!'], { cursor: 2 });
        await onConvertItemToSectionLink();
        expect(h.lines()[2]).toBe('>> - [[Launch!]]');
    });

    it('Convert to Section Link still ignores the metadata', async () => {
        const h = openEditor(['> Launch', '> B', '>> - [x] !! Launch #tag @2026-01-01 // note'], { cursor: 2 });
        await onConvertItemToSectionLink();
        expect(h.lines()[2]).toBe('>> - [[Launch]]');
    });

    it('Extract URLs leaves out punctuation after a link', async () => {
        openEditor(['> S', '>> - see https://a.example/x, then https://b.example/y.'], { cursor: 1 });
        await onExtractUrlsFromSection();
        expect(mock.recorded.quickPickCalls[0].items.map(i => i.url))
            .toEqual(['https://a.example/x', 'https://b.example/y']);
    });
});
