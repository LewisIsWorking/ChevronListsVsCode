/**
 * Covers src/insertGroupDividerCommands.ts. SECTION-EDIT family.
 *
 * On the last line of a file without a trailing newline the divider used to be
 * glued onto that line (">> - a>> -- Name") and the cursor sent to a line that
 * did not exist. The regression tests below were checked against that code.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onInsertGroupDivider } from '../insertGroupDividerCommands';

type Pos = { line: number; character: number };
const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[]; inputBoxCalls: { prompt: string; placeHolder: string }[] };
    queued: { inputBox: (string | undefined)[] };
};
const cursorOf = (e: unknown) => {
    const a = (e as { selection: { active: Pos } }).selection.active;
    return [a.line, a.character];
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onInsertGroupDivider', () => {
    it('does nothing without an active editor', async () => {
        await onInsertGroupDivider();
        expect(mock.recorded.inputBoxCalls).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['>> - a'], { languageId: 'plaintext' });
        await onInsertGroupDivider();
        expect(mock.recorded.inputBoxCalls).toHaveLength(0);
    });

    it('does nothing when the prompt is cancelled', async () => {
        const h = openEditor(['> S', '>> - a', ''], { cursor: 1 });
        await onInsertGroupDivider();
        expect(mock.recorded.inputBoxCalls[0].prompt).toBe('Group divider name');
        expect(h.lines()).toEqual(['> S', '>> - a', '']);
    });

    it('does nothing for a blank name', async () => {
        const h = openEditor(['> S', '>> - a', ''], { cursor: 1 });
        mock.queued.inputBox.push('   ');
        await onInsertGroupDivider();
        expect(h.lines()).toEqual(['> S', '>> - a', '']);
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('inserts a trimmed divider below the cursor line and moves past it', async () => {
        const h = openEditor(['> S', '>> - a', '>> - b'], { cursor: 1, character: 4 });
        mock.queued.inputBox.push('  Act One ');
        await onInsertGroupDivider();
        expect(h.lines()).toEqual(['> S', '>> - a', '>> -- Act One', '>> - b']);
        expect(cursorOf(h.editor)).toEqual([3, 0]);
        expect(mock.recorded.info.at(-1)).toBe('CL: Inserted group "-- Act One"');
    });

    it('puts the divider on its own line at the end of a file with no trailing newline', async () => {
        const h = openEditor(['> S', '>> - a'], { cursor: 1, character: 6 });
        mock.queued.inputBox.push('Backlog');
        await onInsertGroupDivider();
        expect(h.lines()).toEqual(['> S', '>> - a', '>> -- Backlog']);
        expect(cursorOf(h.editor)).toEqual([2, '>> -- Backlog'.length]);
    });
});
