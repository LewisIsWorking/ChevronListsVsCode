/**
 * Covers src/readingMode.ts.
 *
 * Reading mode has no document edits: the user-visible effects are the info
 * message, the panel title and the rendered HTML. Panel creation and the
 * workspace listener are captured by wrapping the vscode mock, so the tests
 * assert on title/html rather than on internal calls.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { onEnterReadingMode } from '../readingMode';

const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[] };
};

interface FakePanel {
    title: string;
    webview: { html: string };
    revealCount: number;
    disposed: boolean;
    disposeCbs: (() => void)[];
    reveal(): void;
    onDidDispose(cb: () => void): { dispose(): void };
    dispose(): void;
}

interface FakeSub {
    disposed: boolean;
    dispose(): void;
}

let panels: FakePanel[] = [];
let docListeners: ((e: { document: unknown }) => void)[] = [];
let subs: FakeSub[] = [];

const winAny = vscode.window as unknown as {
    createWebviewPanel: (...args: unknown[]) => unknown;
};
const wsAny = vscode.workspace as unknown as {
    onDidChangeTextDocument: (cb: (e: { document: unknown }) => void) => unknown;
};

winAny.createWebviewPanel = (_type: unknown, title: unknown) => {
    const panel: FakePanel = {
        title: title as string,
        webview: { html: '' },
        revealCount: 0,
        disposed: false,
        disposeCbs: [],
        reveal() { panel.revealCount++; },
        onDidDispose(cb: () => void) {
            panel.disposeCbs.push(cb);
            return { dispose() {} };
        },
        dispose() {
            panel.disposed = true;
            for (const cb of [...panel.disposeCbs]) { cb(); }
        },
    };
    panels.push(panel);
    return panel;
};

wsAny.onDidChangeTextDocument = (cb: (e: { document: unknown }) => void) => {
    docListeners.push(cb);
    const sub: FakeSub = {
        disposed: false,
        dispose() { sub.disposed = true; },
    };
    subs.push(sub);
    return sub;
};

function lastPanel(): FakePanel {
    const p = panels[panels.length - 1];
    if (!p) { throw new Error('No reading panel was created'); }
    return p;
}

beforeEach(() => {
    for (const p of panels) {
        if (!p.disposed) { p.dispose(); }
    }
    // Second dispose fires the onDidDispose callback again with readingSub
    // already cleared, covering the readingSub?.dispose() undefined branch.
    for (const p of panels) { p.dispose(); }
    panels = [];
    docListeners = [];
    subs = [];
    mock.__reset();
    deactivate();
});

describe('onEnterReadingMode', () => {
    it('does nothing without an active editor', () => {
        onEnterReadingMode();
        expect(mock.recorded.info).toEqual(['CL: Open a markdown file to enter reading mode']);
        expect(panels).toHaveLength(0);
        expect(docListeners).toHaveLength(0);
    });

    it('ignores non-markdown documents', () => {
        const h = openEditor(['>> - a'], { languageId: 'plaintext' });
        onEnterReadingMode();
        expect(mock.recorded.info).toEqual(['CL: Open a markdown file to enter reading mode']);
        expect(panels).toHaveLength(0);
        expect(h.lines()).toEqual(['>> - a']);
    });

    it('opens a markdown file in a new panel with rendered html', () => {
        const h = openEditor(['> Shopping', '>> - apples'], { fileName: 'C:/tmp/notes.md' });
        onEnterReadingMode();
        expect(mock.recorded.info).toHaveLength(0);
        expect(panels).toHaveLength(1);
        expect(lastPanel().title).toBe('notes - Reading Mode');
        expect(lastPanel().webview.html).toContain('<!DOCTYPE html>');
        expect(lastPanel().webview.html).toContain('Shopping');
        expect(lastPanel().webview.html).toContain('apples');
        expect(h.lines()).toEqual(['> Shopping', '>> - apples']);
    });

    it('renders the last line of a file with no trailing newline', () => {
        openEditor(['> S', '>> - last'], { fileName: 'C:/tmp/a.md' });
        onEnterReadingMode();
        expect(lastPanel().webview.html).toContain('last');
        expect(lastPanel().title).toBe('a - Reading Mode');
    });

    it('honours a custom listPrefix', () => {
        mock.__setConfig('chevron-lists.listPrefix', '*');
        openEditor(['> S', '>> * starred'], { fileName: 'C:/tmp/b.md' });
        onEnterReadingMode();
        expect(lastPanel().webview.html).toContain('starred');
    });

    it('reuses the existing panel and retitles it for the new file', () => {
        const h1 = openEditor(['> First', '>> - one'], { fileName: 'C:/tmp/first.md' });
        onEnterReadingMode();
        const panel = lastPanel();
        expect(panel.title).toBe('first - Reading Mode');
        expect(panel.webview.html).toContain('First');
        expect(subs).toHaveLength(1);
        expect(subs[0].disposed).toBe(false);

        const h2 = openEditor(['> Second', '>> - two'], { fileName: 'C:/tmp/second.md' });
        onEnterReadingMode();
        expect(panels).toHaveLength(1);
        expect(lastPanel()).toBe(panel);
        expect(panel.revealCount).toBe(1);
        expect(panel.title).toBe('second - Reading Mode');
        expect(panel.webview.html).toContain('Second');
        expect(panel.webview.html).toContain('two');
        expect(panel.webview.html).not.toContain('First');
        // The previous file's listener is disposed so it cannot flip the panel back.
        expect(subs).toHaveLength(2);
        expect(subs[0].disposed).toBe(true);
        expect(subs[1].disposed).toBe(false);
        expect(h1.lines()).toEqual(['> First', '>> - one']);
        expect(h2.lines()).toEqual(['> Second', '>> - two']);
    });

    it('live-updates when the shown document changes', async () => {
        const h = openEditor(['> S', '>> - a'], { fileName: 'C:/tmp/live.md' });
        onEnterReadingMode();
        const panel = lastPanel();
        expect(panel.webview.html).toContain('a');
        expect(panel.webview.html).not.toContain('b-item');

        const ed = h.editor as {
            edit(cb: (eb: { replace(r: unknown, t: string): void }) => void): Promise<boolean>;
        };
        await ed.edit(eb => eb.replace(new vscode.Range(1, 0, 1, 6), '>> - b-item'));
        expect(h.lines()).toEqual(['> S', '>> - b-item']);
        docListeners[docListeners.length - 1]({ document: h.document });
        expect(panel.webview.html).toContain('b-item');
    });

    it('ignores changes to other documents', () => {
        const h1 = openEditor(['> A', '>> - alpha'], { fileName: 'C:/a.md' });
        onEnterReadingMode();
        const panel = lastPanel();
        const before = panel.webview.html;
        expect(before).toContain('alpha');

        const h2 = makeEditor(['> B', '>> - beta'], { fileName: 'C:/b.md' });
        docListeners[docListeners.length - 1]({ document: h2.document });
        expect(panel.webview.html).toBe(before);
        expect(panel.webview.html).not.toContain('beta');
        expect(h1.lines()).toEqual(['> A', '>> - alpha']);
    });

    it('stops updating after the panel is disposed and reopens fresh', () => {
        const h = openEditor(['> S', '>> - a'], { fileName: 'C:/tmp/gone.md' });
        onEnterReadingMode();
        const panel = lastPanel();
        const listener = docListeners[docListeners.length - 1];
        panel.dispose();
        expect(panel.disposed).toBe(true);
        expect(subs[subs.length - 1].disposed).toBe(true);

        // The stale listener no longer crashes and creates no new panel.
        listener({ document: h.document });
        expect(panels).toHaveLength(1);

        const h2 = openEditor(['> Fresh', '>> - new'], { fileName: 'C:/tmp/fresh.md' });
        onEnterReadingMode();
        expect(panels).toHaveLength(2);
        expect(lastPanel().title).toBe('fresh - Reading Mode');
        expect(lastPanel().webview.html).toContain('Fresh');
        expect(h2.lines()).toEqual(['> Fresh', '>> - new']);
    });

    it('does not flip back to the first file when it changes after switching', () => {
        const h1 = openEditor(['> First', '>> - one'], { fileName: 'C:/tmp/one.md' });
        onEnterReadingMode();
        const panel = lastPanel();

        const h2 = openEditor(['> Second', '>> - two'], { fileName: 'C:/tmp/two.md' });
        onEnterReadingMode();
        expect(panel.webview.html).toContain('Second');

        // An edit to the first file, reported through the current listener,
        // is not the shown document so the panel keeps showing the second file.
        const current = docListeners[docListeners.length - 1];
        current({ document: h1.document });
        expect(panel.webview.html).toContain('Second');
        expect(panel.webview.html).not.toContain('First');

        // The current file still live-updates.
        current({ document: h2.document });
        expect(panel.webview.html).toContain('Second');
    });
});
