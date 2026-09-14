/**
 * Covers src/previewItemCommands.ts -- the rich one-item preview.
 *
 * Each metadata marker gets its own test because the command tests for each
 * one independently and appends a line per hit. The example content for every
 * marker was confirmed by running it through the real parser first, so these
 * fixtures are known to parse rather than assumed to.
 *
 * The "clean" first line resolves with a precedence -- comment, then star,
 * then flag, then colour label, then the raw text -- so each rung of that
 * ladder is pinned separately too.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onPreviewItem } from '../previewItemCommands';

const mock = vscode as unknown as { __reset(): void; recorded: { info: string[] } };
const NONE = 'CL: Place cursor on a chevron item to preview it';

/** Previews the item on line 0 and returns the notification's lines. */
async function preview(line: string, opts: { languageId?: string } = {}): Promise<string[]> {
    openEditor([line], { cursor: 0, ...opts });
    await onPreviewItem();
    return (mock.recorded.info.at(-1) ?? '').split(String.fromCharCode(10));
}

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onPreviewItem guards', () => {
    it('does nothing without an active editor', async () => {
        await onPreviewItem();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('ignores non-markdown documents', async () => {
        openEditor(['>> - item'], { cursor: 0, languageId: 'plaintext' });
        await onPreviewItem();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('asks for an item when the cursor is on something else', async () => {
        openEditor(['> Header'], { cursor: 0 });
        await onPreviewItem();
        expect(mock.recorded.info).toContain(NONE);
    });
});

describe('onPreviewItem headline', () => {
    it('shows a bullet with its depth and text', async () => {
        expect((await preview('>> - plain item'))[0]).toBe('• [depth 0] plain item');
    });

    it('shows a numbered item with its number', async () => {
        expect((await preview('>> 7. numbered'))[0]).toBe('#7 [depth 0] numbered');
    });

    it('reports nesting depth', async () => {
        expect((await preview('>>>> - deep'))[0]).toBe('• [depth 2] deep');
    });

    it('has no metadata lines for a plain item', async () => {
        expect(await preview('>> - plain item')).toHaveLength(1);
    });
});

describe('onPreviewItem metadata lines', () => {
    it('shows a completed checkbox', async () => {
        expect(await preview('>> - [x] Buy milk')).toContain('✅ Done');
    });

    it('shows an open checkbox', async () => {
        expect(await preview('>> - [ ] Buy milk')).toContain('⬜ Todo');
    });

    it('shows a critical priority', async () => {
        expect(await preview('>> - !!! Ship it')).toContain('🔴 !!! Critical');
    });

    it('shows a medium priority', async () => {
        expect(await preview('>> - !! Ship it')).toContain('🟡 !! Medium');
    });

    it('shows a low priority', async () => {
        expect(await preview('>> - ! Ship it')).toContain('🔵 ! Low');
    });

    it('reads a priority that follows a checkbox', async () => {
        const lines = await preview('>> - [ ] !!! Both');
        expect(lines).toContain('⬜ Todo');
        expect(lines).toContain('🔴 !!! Critical');
    });

    it('shows a star', async () => {
        expect(await preview('>> - * Important item')).toContain('⭐ Starred');
    });

    it('shows a flag', async () => {
        expect(await preview('>> - ? Is this complete?')).toContain('❓ Flagged');
    });

    it('shows a colour label', async () => {
        expect(await preview('>> - {red} Urgent task')).toContain('🎨 red');
    });

    it('flags a past due date as overdue', async () => {
        expect(await preview('>> - Meeting on @2020-03-30')).toContain('📅 2020-03-30 ⚠️ OVERDUE');
    });

    it('shows a future due date without the overdue warning', async () => {
        expect(await preview('>> - Meeting on @2099-03-30')).toContain('📅 2099-03-30');
    });

    it('shows a time estimate', async () => {
        expect(await preview('>> - Task ~2h30m')).toContain('⏱ ~2h30m');
    });

    it('shows a recurrence', async () => {
        expect(await preview('>> - Review @daily')).toContain('🔁 @daily');
    });

    it('shows votes', async () => {
        expect(await preview('>> - Great idea +5')).toContain('👍 +5');
    });

    it('shows every tag on one line', async () => {
        expect(await preview('>> - Fix bug #urgent #backend')).toContain('🏷 #urgent #backend');
    });

    it('shows a trailing comment', async () => {
        expect(await preview('>> - Do this // note about this')).toContain('💬 note about this');
    });
});

describe('onPreviewItem headline text precedence', () => {
    it('uses the text before a comment', async () => {
        expect((await preview('>> - Do this // note about this'))[0]).toBe('• [depth 0] Do this');
    });

    it('drops the star marker', async () => {
        expect((await preview('>> - * Important item'))[0]).toBe('• [depth 0] Important item');
    });

    it('drops the flag marker', async () => {
        expect((await preview('>> - ? Is this complete?'))[0]).toBe('• [depth 0] Is this complete?');
    });

    it('drops the colour label', async () => {
        expect((await preview('>> - {red} Urgent task'))[0]).toBe('• [depth 0] Urgent task');
    });

    it('drops the checkbox and priority markers', async () => {
        expect((await preview('>> - [x] !! Finished'))[0]).toBe('• [depth 0] Finished');
    });
});
