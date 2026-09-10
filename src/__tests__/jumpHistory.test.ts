/**
 * Covers src/jumpHistory.ts -- the per-file cursor history behind Jump Back.
 *
 * Representative of the STATE family: the history lives in a module-level Map
 * rather than persisted extension state, so it survives between tests in the
 * same process. Every test clears its own file's entry first; forgetting that
 * is how these tests would start passing for the wrong reason.
 *
 * This is also the module whose retention leak was fixed earlier in this work
 * -- clearJumpHistory on document close -- so the "closing a file releases its
 * entry" behaviour is asserted directly rather than assumed.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate, type Harness } from './helpers/editorHarness';
import {
    pushJumpHistory,
    onJumpBack,
    onShowJumpHistory,
    clearJumpHistory,
    getJumpHistory,
} from '../jumpHistory';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[] };
    lastQuickPick(): {
        items: { label: string; description?: string; pos: vscode.Position }[];
        activeItems: unknown[];
        placeholder: string;
        disposed: boolean;
        fireActive(items: unknown[]): void;
        fireAccept(): void;
        fireHide(): void;
    };
};

const FILE = 'C:/tmp/notes.md';
const key = () => vscode.Uri.file(FILE).toString();

/** Opens the fixture file with the cursor on `line`. */
function open(line: number, lines = ['a', 'b', 'c', 'd', 'e']): Harness {
    return openEditor(lines, { cursor: line, fileName: FILE });
}

const cursorLine = (h: Harness) =>
    (h.editor as { selection: { active: { line: number } } }).selection.active.line;

beforeEach(() => {
    mock.__reset();
    deactivate();
    clearJumpHistory(vscode.Uri.file(FILE));   // module-level Map outlives each test
});

describe('pushJumpHistory / getJumpHistory', () => {
    it('starts with no history for a file', () => {
        expect(getJumpHistory(key())).toEqual([]);
    });

    it('records the cursor position', () => {
        const h = open(2);
        pushJumpHistory(h.editor as never);
        expect(getJumpHistory(key()).map((p) => p.line)).toEqual([2]);
    });

    it('keeps positions in the order they were pushed', () => {
        const h = open(1);
        pushJumpHistory(h.editor as never);
        (h.editor as { selection: vscode.Selection }).selection =
            new vscode.Selection(new vscode.Position(3, 0), new vscode.Position(3, 0));
        pushJumpHistory(h.editor as never);
        expect(getJumpHistory(key()).map((p) => p.line)).toEqual([1, 3]);
    });

    it('caps the stack at ten, dropping the oldest', () => {
        const h = open(0);
        for (let i = 0; i < 12; i++) {
            (h.editor as { selection: vscode.Selection }).selection =
                new vscode.Selection(new vscode.Position(i, 0), new vscode.Position(i, 0));
            pushJumpHistory(h.editor as never);
        }
        const lines = getJumpHistory(key()).map((p) => p.line);
        expect(lines).toHaveLength(10);
        expect(lines[0]).toBe(2);      // 0 and 1 were shifted off
        expect(lines.at(-1)).toBe(11);
    });

    it('keeps each file’s history separate', () => {
        const a = open(1);
        pushJumpHistory(a.editor as never);
        const b = openEditor(['x'], { cursor: 0, fileName: 'C:/tmp/other.md' });
        pushJumpHistory(b.editor as never);
        expect(getJumpHistory(key())).toHaveLength(1);
        clearJumpHistory(vscode.Uri.file('C:/tmp/other.md'));
    });
});

describe('clearJumpHistory', () => {
    it('releases the entry for a closed file', () => {
        const h = open(2);
        pushJumpHistory(h.editor as never);
        expect(getJumpHistory(key())).toHaveLength(1);
        clearJumpHistory(vscode.Uri.file(FILE));
        expect(getJumpHistory(key())).toEqual([]);
    });

    it('is safe for a file that has no history', () => {
        expect(() => clearJumpHistory(vscode.Uri.file('C:/tmp/never-opened.md'))).not.toThrow();
    });
});

describe('onJumpBack', () => {
    it('does nothing without an active editor', async () => {
        await onJumpBack();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('tells the user when there is no history', async () => {
        open(0);
        await onJumpBack();
        expect(mock.recorded.info).toContain('CL: No jump history for this file');
    });

    it('returns the cursor to the last recorded position', async () => {
        const h = open(3);
        pushJumpHistory(h.editor as never);
        (h.editor as { selection: vscode.Selection }).selection =
            new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));
        await onJumpBack();
        expect(cursorLine(h)).toBe(3);
        expect(h.revealed.at(-1)?.start[0]).toBe(3);
    });

    it('consumes the entry, so a second jump reports an empty history', async () => {
        const h = open(2);
        pushJumpHistory(h.editor as never);
        await onJumpBack();
        expect(getJumpHistory(key())).toEqual([]);
        await onJumpBack();
        expect(mock.recorded.info).toContain('CL: No jump history for this file');
    });

    it('walks back through the stack newest first', async () => {
        const h = open(1);
        pushJumpHistory(h.editor as never);
        (h.editor as { selection: vscode.Selection }).selection =
            new vscode.Selection(new vscode.Position(4, 0), new vscode.Position(4, 0));
        pushJumpHistory(h.editor as never);
        await onJumpBack();
        expect(cursorLine(h)).toBe(4);
        await onJumpBack();
        expect(cursorLine(h)).toBe(1);
    });
});

describe('onShowJumpHistory', () => {
    /** Pushes `lines` worth of history onto the fixture file. */
    function withHistory(lines: number[]): Harness {
        const h = open(0);
        for (const l of lines) {
            (h.editor as { selection: vscode.Selection }).selection =
                new vscode.Selection(new vscode.Position(l, 0), new vscode.Position(l, 0));
            pushJumpHistory(h.editor as never);
        }
        return h;
    }

    it('does nothing without an active editor', async () => {
        await onShowJumpHistory();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('tells the user when there is no history', async () => {
        open(0);
        await onShowJumpHistory();
        expect(mock.recorded.info).toContain('CL: No jump history for this file');
    });

    it('lists the history newest first', async () => {
        withHistory([1, 2, 3]);
        await onShowJumpHistory();
        expect(mock.lastQuickPick().items.map((i) => i.pos.line)).toEqual([3, 2, 1]);
    });

    it('labels each entry with a one-based line and column', async () => {
        withHistory([4]);
        await onShowJumpHistory();
        expect(mock.lastQuickPick().items[0].label).toBe('$(location) Line 5, Col 1');
    });

    it('marks the newest entry and counts the rest back', async () => {
        withHistory([1, 2, 3]);
        await onShowJumpHistory();
        expect(mock.lastQuickPick().items.map((i) => i.description))
            .toEqual(['most recent', '2 steps back', '3 steps back']);
    });

    it('previews the highlighted entry', async () => {
        const h = withHistory([1, 4]);
        await onShowJumpHistory();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[1]]);      // the older entry, line 1
        expect(cursorLine(h)).toBe(1);
        expect(h.revealed.at(-1)?.start[0]).toBe(1);
    });

    it('ignores an empty active list', async () => {
        const h = withHistory([2]);
        await onShowJumpHistory();
        const before = h.revealed.length;
        mock.lastQuickPick().fireActive([]);
        expect(h.revealed).toHaveLength(before);
    });

    it('removes the chosen entry from the history on accept', async () => {
        withHistory([1, 2, 3]);
        await onShowJumpHistory();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);      // newest, line 3
        pick.fireAccept();
        expect(getJumpHistory(key()).map((p) => p.line)).toEqual([1, 2]);
        expect(pick.disposed).toBe(true);
    });

    it('tolerates the chosen entry having already left the stack', async () => {
        withHistory([1, 2, 3]);
        await onShowJumpHistory();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);      // newest, line 3
        await onJumpBack();                    // pops line 3 out from under the pick
        pick.fireAccept();                     // indexOf now returns -1
        expect(getJumpHistory(key()).map((p) => p.line)).toEqual([1, 2]);
        expect(pick.disposed).toBe(true);
    });

    it('accepting with nothing highlighted leaves the history alone', async () => {
        withHistory([1, 2]);
        await onShowJumpHistory();
        const pick = mock.lastQuickPick();
        pick.fireAccept();
        expect(getJumpHistory(key())).toHaveLength(2);
        expect(pick.disposed).toBe(true);
    });

    it('restores the original cursor when dismissed', async () => {
        const h = withHistory([1, 4]);
        (h.editor as { selection: vscode.Selection }).selection =
            new vscode.Selection(new vscode.Position(2, 0), new vscode.Position(2, 0));
        await onShowJumpHistory();
        const pick = mock.lastQuickPick();
        pick.fireActive([pick.items[0]]);      // preview jumps away
        pick.activeItems = [];                 // dismissed without choosing
        pick.fireHide();
        expect(cursorLine(h)).toBe(2);
    });
});
