/**
 * Commands that rewrite items in bulk change only what they say they change:
 * words and not list markers, items and not the prose around them.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onBatchReplaceText } from '../batchReplaceCommands';
import { onChangeItemPrefix } from '../changePrefixCommands';
import { onGroupItemsByTag } from '../groupByTagCommands';
import { onRenameTag } from '../renameTagCommands';
import { onSetWordCountGoal } from '../wordGoalCommands';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[]; inputBoxCalls: { validateInput(v: string): string | null }[] };
    queued: { inputBox: (string | undefined)[]; quickPick: unknown[] };
};
const win = vscode.window as unknown as { showWarningMessage: unknown };
const realWarning = win.showWarningMessage;

describe('item rewrite commands', () => {
    beforeEach(() => mock.__reset());
    afterEach(() => { win.showWarningMessage = realWarning; deactivate(); });

    it('Batch Replace leaves the list marker and the number alone', async () => {
        win.showWarningMessage = async () => 'Replace';
        const h = openEditor(['> S', '>> - a-b', '>> 1. 1 up'], { cursor: 1 });
        mock.queued.inputBox.push('-', '+');
        await onBatchReplaceText();
        expect(h.lines().slice(1)).toEqual(['>> - a+b', '>> 1. 1 up']);

        mock.queued.inputBox.push('1', 'one');
        await onBatchReplaceText();
        expect(h.lines()[2]).toBe('>> 1. one up');
    });

    it('Batch Replace ignores a match only in the marker', async () => {
        const h = openEditor(['> S', '>> - a'], { cursor: 1 });
        mock.queued.inputBox.push('-', '+');
        await onBatchReplaceText();
        expect(h.lines()[1]).toBe('>> - a');
        expect(mock.recorded.info[0]).toContain('not found');
    });

    it('Rename Tag changes items, not the prose around them', async () => {
        const h = openEditor(['# Bikes #x', 'see #x', '> S', '>> - a #x', '>> 1. b #x'], { cursor: 3 });
        mock.queued.quickPick.push({ tag: 'x' });
        mock.queued.inputBox.push('y');
        await onRenameTag();
        expect(h.lines()).toEqual(['# Bikes #x', 'see #x', '> S', '>> - a #y', '>> 1. b #y']);
        expect(mock.recorded.info[0]).toContain('2 lines');
    });

    it('Rename Tag refuses a name that would not be a tag', async () => {
        openEditor(['> S', '>> - a #x'], { cursor: 1 });
        mock.queued.quickPick.push({ tag: 'x' });
        mock.queued.inputBox.push(undefined);
        await onRenameTag();
        const validate = mock.recorded.inputBoxCalls[0].validateInput;
        expect(validate('-y')).not.toBeNull();
        expect(validate('a b')).not.toBeNull();
        expect(validate(' to-do_1 ')).toBeNull();
    });

    it('Change Item Prefix can be changed back', async () => {
        const h = openEditor(['> S', '>> - a', '>> 1. b'], { cursor: 1 });
        mock.queued.quickPick.push({ prefix: '*' });
        await onChangeItemPrefix();
        expect(h.lines().slice(1)).toEqual(['>> * a', '>> 1. b']);

        mock.queued.quickPick.push({ prefix: '-' });
        await onChangeItemPrefix();
        expect(h.lines().slice(1)).toEqual(['>> - a', '>> 1. b']);
    });

    it('Group Items by Tag run twice does not pile up headings', async () => {
        const h = openEditor(['> S', '>> - a #x', '>> - b #y', '>> - c #x', '>> - d'], { cursor: 1 });
        await onGroupItemsByTag();
        const once = ['// #x', '>> - a #x', '>> - c #x', '// #y', '>> - b #y', '>> - d'];
        expect(h.lines().slice(1)).toEqual(once);
        await onGroupItemsByTag();
        expect(h.lines().slice(1)).toEqual(once);
    });

    it('Group Items by Tag renumbers and adds no line at the end of the file', async () => {
        const h = openEditor(['> S', '>> 1. a #x', '>> 2. b #y', '>> 3. c #x'], { cursor: 1 });
        await onGroupItemsByTag();
        expect(h.lines().slice(1)).toEqual(['// #x', '>> 1. a #x', '>> 2. c #x', '// #y', '>> 3. b #y']);
    });

    it('Set Word Count Goal asks for a whole number or nothing', async () => {
        openEditor(['> S ==5', '>> - a'], { cursor: 1 });
        mock.queued.inputBox.push(undefined);
        await onSetWordCountGoal();
        const validate = mock.recorded.inputBoxCalls[0].validateInput;
        expect(validate('abc')).not.toBeNull();
        expect(validate('0')).not.toBeNull();
        expect(validate('500')).toBeNull();
        expect(validate('')).toBeNull();
    });
});
