/**
 * Word counts must keep accented letters, instead of cutting a word in two at
 * the first letter outside a to z.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onCountWordFrequency } from '../wordFrequencyCommands';
import { countWordFrequency } from '../patterns';
import { topWords } from '../wordFrequency';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
};

describe('word frequency letters', () => {
    beforeEach(() => mock.__reset());
    afterEach(() => deactivate());

    it('counts an accented word whole in the command', async () => {
        openEditor(['> A', '>> - café naïve café'], { cursor: 1 });
        await onCountWordFrequency();
        expect(mock.recorded.info.at(-1)).toBe('CL: "A" top words: "café" ×2  ·  "naïve" ×1');
    });

    it('counts an accented word whole in topWords', () => {
        expect(topWords(['café café'])).toEqual([{ word: 'café', count: 2 }]);
    });

    it('counts an accented word whole in countWordFrequency', () => {
        expect(countWordFrequency(['Naïve'])).toEqual(new Map([['naïve', 1]]));
    });

    it('still splits on punctuation', () => {
        expect(topWords(['one,two'])).toEqual([{ word: 'one', count: 1 }, { word: 'two', count: 1 }]);
    });
});
