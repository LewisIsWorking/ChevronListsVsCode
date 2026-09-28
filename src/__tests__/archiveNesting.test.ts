/**
 * Archive Done Items moves a done item together with everything nested under
 * it. It used to move only the done line, so its children stayed behind and
 * read as children of whichever item sat above them.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { onArchiveDoneItems } from '../archiveCommands';
import { openEditor, deactivate } from './helpers/editorHarness';

const mock = vscode as unknown as { __reset(): void };

beforeEach(() => { mock.__reset(); deactivate(); });

describe('archive done items with nested items', () => {
    it('takes the children of a done item with it', async () => {
        const h = openEditor(['> Tasks', '>> - [ ] keep', '>> - [x] done', '>>> - child', '>> - [ ] also'], { cursor: 1 });
        await onArchiveDoneItems();
        expect(h.lines()).toEqual(['> Tasks', '>> - [ ] keep', '>> - [ ] also', '', '> Archive', '>> - [x] done', '>>> - child']);
    });

    it('moves a done child on its own when its parent is not done', async () => {
        const h = openEditor(['> Tasks', '>> - [ ] p', '>>> - [x] gone', '>>> - [ ] stay'], { cursor: 1 });
        await onArchiveDoneItems();
        expect(h.lines()).toEqual(['> Tasks', '>> - [ ] p', '>>> - [ ] stay', '', '> Archive', '>>> - [x] gone']);
    });

    it('moves a done child inside a done parent once, with its parent', async () => {
        const h = openEditor(['> Tasks', '>> - [x] p', '>>> - [x] c', '>> - [ ] q'], { cursor: 1 });
        await onArchiveDoneItems();
        expect(h.lines()).toEqual(['> Tasks', '>> - [ ] q', '', '> Archive', '>> - [x] p', '>>> - [x] c']);
    });
});
