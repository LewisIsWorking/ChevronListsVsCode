/**
 * Copy Section as HTML escapes the section name as it does the words, and
 * struck-through text does not hide a time estimate after it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onCopySectionAsHtml } from '../sectionHtmlExportCommands';
import { parseEstimate } from '../estimateParser';

const mock = vscode as unknown as { __reset(): void; recorded: { clipboard: string } };

describe('section export escapes', () => {
    beforeEach(() => mock.__reset());
    afterEach(() => deactivate());

    it('escapes the section name in HTML', async () => {
        openEditor(['> A & <B>', '>> - a'], { cursor: 1, character: 5 });
        await onCopySectionAsHtml();
        expect(mock.recorded.clipboard).toContain('>A &amp; &lt;B&gt;</h3>');
    });

    it('finds an estimate after struck-through text', () => {
        expect(parseEstimate('~~old~~ ~2h')?.display).toBe('2h');
    });

    it('still reads hours and minutes', () => {
        expect(parseEstimate('a ~1h30m')?.totalMinutes).toBe(90);
        expect(parseEstimate('a ~45m')?.display).toBe('45m');
        expect(parseEstimate('a ~ b')).toBeNull();
    });
});
