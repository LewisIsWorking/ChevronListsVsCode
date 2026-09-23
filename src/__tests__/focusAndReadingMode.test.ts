/**
 * Covers src/focusMode.ts and src/readingMode.ts.
 *
 * Bugs fixed, with regression tests checked against the original code:
 *  - Focus Section moved the cursor to the start of the section's first line
 *    instead of leaving it where the user was;
 *  - Reading Mode reused its panel for another file without retitling it, and
 *    kept every earlier file's change listener, so an edit to the first file
 *    put the first file back in the panel.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate, activate } from './helpers/editorHarness';
import { onFocusSection, onUnfocusSection } from '../focusMode';

type Pos = { line: number; character: number };
const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[]; commands: { command: string }[] };
    window: Record<string, unknown>;
    workspace: Record<string, unknown>;
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('onFocusSection', () => {
    it('does nothing without an active editor or outside markdown', async () => {
        await onFocusSection();
        openEditor(['> A'], { languageId: 'plaintext' });
        await onFocusSection();
        expect(mock.recorded.commands).toEqual([]);
    });

    it('reports when the cursor is not in a section', async () => {
        openEditor(['prose']);
        await onFocusSection();
        expect(mock.recorded.info.at(-1)).toBe('CL: No section found at cursor');
    });

    it('folds everything, unfolds the cursor’s section, and leaves the cursor where it was', async () => {
        const h = openEditor(['> A', '>> - a', '> B', '>> - b1', '>> - b2'], { cursor: 4, character: 3 });
        await onFocusSection();
        expect(mock.recorded.commands.map(c => c.command)).toEqual(['editor.foldAll', 'editor.unfold']);
        const active = (h.editor as { selection: { active: Pos } }).selection.active;
        expect([active.line, active.character]).toEqual([4, 3]);
        expect(h.revealed.at(-1)).toEqual({ start: [2, 0], end: [4, 3] });
    });

    it('unfocus unfolds everything', async () => {
        await onUnfocusSection();
        expect(mock.recorded.commands.map(c => c.command)).toEqual(['editor.unfoldAll']);
    });
});

describe('onEnterReadingMode', () => {
    type Panel = { title: string; webview: { html: string }; revealed: number; dispose(): void };
    const realCreate = mock.window.createWebviewPanel;
    const realOnChange = mock.workspace.onDidChangeTextDocument;
    let panels: Panel[];
    let listeners: { fn: (e: { document: unknown }) => void; disposed: boolean }[];

    beforeEach(() => {
        panels = []; listeners = [];
        mock.window.createWebviewPanel = (_t: string, title: string) => {
            let onDispose: () => void = () => {};
            const panel: Panel & { onDidDispose(f: () => void): void; reveal(): void } = {
                title, webview: { html: '' }, revealed: 0,
                onDidDispose: (f: () => void) => { onDispose = f; },
                reveal: () => { panel.revealed++; },
                dispose: () => onDispose(),
            };
            panels.push(panel);
            return panel;
        };
        mock.workspace.onDidChangeTextDocument = (fn: (e: { document: unknown }) => void) => {
            const l = { fn, disposed: false };
            listeners.push(l);
            return { dispose: () => { l.disposed = true; } };
        };
    });
    afterEach(() => {
        panels.forEach(p => p.dispose());
        mock.window.createWebviewPanel = realCreate;
        mock.workspace.onDidChangeTextDocument = realOnChange;
    });

    const fire = (document: unknown) => listeners.filter(l => !l.disposed).forEach(l => l.fn({ document }));
    // Imported per test so the module-level panel starts fresh after each dispose.
    const enter = async () => (await import('../readingMode')).onEnterReadingMode();

    it('asks for a markdown file', async () => {
        await enter();
        openEditor(['x'], { languageId: 'plaintext' });
        await enter();
        expect(mock.recorded.info).toEqual(['CL: Open a markdown file to enter reading mode', 'CL: Open a markdown file to enter reading mode']);
        expect(panels).toEqual([]);
    });

    it('opens a panel with the file as HTML and keeps it up to date', async () => {
        const h = openEditor(['> Shopping', '>> - milk'], { fileName: 'C:/notes/list.md' });
        await enter();
        expect(panels).toHaveLength(1);
        expect(panels[0].title).toBe('list - Reading Mode');
        expect(panels[0].webview.html).toContain('milk');
        await (h.editor as { edit(cb: (eb: { insert(p: vscode.Position, t: string): void }) => void): Promise<boolean> })
            .edit(eb => eb.insert(new vscode.Position(1, 9), ' and eggs'));
        fire(h.document);
        expect(panels[0].webview.html).toContain('milk and eggs');
        fire(makeEditor(['> Other']).document);
        expect(panels[0].webview.html).toContain('milk and eggs');
    });

    it('reuses the panel for another file, retitled, and stops following the first file', async () => {
        const first = openEditor(['> First', '>> - zebra'], { fileName: 'C:/notes/first.md' });
        await enter();
        const second = makeEditor(['> Second', '>> - yak'], { fileName: 'C:/notes/second.md' });
        activate(second);
        await enter();
        expect(panels).toHaveLength(1);
        expect(panels[0].revealed).toBe(1);
        expect(panels[0].title).toBe('second - Reading Mode');
        expect(panels[0].webview.html).toContain('yak');
        fire(first.document);
        expect(panels[0].webview.html).toContain('yak');
        expect(panels[0].webview.html).not.toContain('zebra');
        expect(listeners.filter(l => !l.disposed)).toHaveLength(1);
    });

    it('stops listening when the panel is closed', async () => {
        openEditor(['> A'], { fileName: 'C:/notes/a.md' });
        await enter();
        panels[0].dispose();
        expect(listeners.every(l => l.disposed)).toBe(true);
    });
});
