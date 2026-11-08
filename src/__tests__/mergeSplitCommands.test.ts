/**
 * Covers src/mergeSplitCommands.ts -- merge section below / split section here.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onMergeSectionBelow, onSplitSectionHere } from '../mergeSplitCommands';

const mock = vscode as unknown as {
    __reset(): void;
    queued: { inputBox: (string | undefined)[] };
    recorded: { info: string[] };
};

beforeEach(() => {
    mock.__reset();
    deactivate();
});

describe('onMergeSectionBelow', () => {
    it("joins the next section's items straight onto this one", async () => {
        const h = openEditor(['> A', '>> - a1', '', '> B', '>> - b1', '', '> C'], { cursor: 1 });
        await onMergeSectionBelow();
        // The blank line between the sections used to stay inside the merged list
        expect(h.lines()).toEqual(['> A', '>> - a1', '>> - b1', '', '> C']);
    });

    it('keeps notes under the first section', async () => {
        const h = openEditor(['> A', '>> - a1', 'a note', '', '', '> B', '>> - b1'], { cursor: 0 });
        await onMergeSectionBelow();
        expect(h.lines()).toEqual(['> A', '>> - a1', 'a note', '>> - b1']);
    });

    it('says so when there is no section below', async () => {
        const h = openEditor(['> A', '>> - a1'], { cursor: 1 });
        await onMergeSectionBelow();
        expect(mock.recorded.info).toEqual(['CL: No section below to merge with']);
        expect(h.lines()).toEqual(['> A', '>> - a1']);
    });

    it('says so outside a section', async () => {
        openEditor(['intro', '> A'], { cursor: 0 });
        await onMergeSectionBelow();
        expect(mock.recorded.info).toEqual(['CL: No section found at cursor']);
    });
});

describe('onSplitSectionHere', () => {
    it('inserts a header above the cursor item', async () => {
        const h = openEditor(['> A', '>> - a1', '>> - a2'], { cursor: 2 });
        mock.queued.inputBox.push(' Later ');
        await onSplitSectionHere();
        expect(h.lines()).toEqual(['> A', '>> - a1', '> Later', '>> - a2']);
    });

    it('changes nothing when the name is cancelled', async () => {
        const h = openEditor(['> A', '>> - a1', '>> - a2'], { cursor: 2 });
        mock.queued.inputBox.push(undefined);
        await onSplitSectionHere();
        expect(h.lines()).toEqual(['> A', '>> - a1', '>> - a2']);
    });

    it('needs an item line', async () => {
        const h = openEditor(['> A', 'note'], { cursor: 1 });
        await onSplitSectionHere();
        expect(mock.recorded.info).toEqual(['CL: Place cursor on an item line to split the section there']);
        expect(h.lines()).toEqual(['> A', 'note']);
    });
});
