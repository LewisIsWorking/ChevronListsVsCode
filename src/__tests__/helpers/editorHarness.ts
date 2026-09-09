/**
 * editorHarness.ts -- fake TextDocument / TextEditor for testing command handlers.
 *
 * Almost every command in this extension has the same shape:
 *
 *     const editor = vscode.window.activeTextEditor;
 *     if (!editor) { return; }
 *     ... read the document, find a section, collect items ...
 *     await editor.edit(eb => eb.replace(range, newText));
 *
 * so one harness covers ~200 files. `edit()` really applies the edits to the
 * document, which means a test can assert on the resulting text rather than on
 * a list of edit objects -- assertions then describe behaviour ("the section is
 * sorted") instead of implementation ("replace was called with these ranges").
 *
 * Edits are applied by character offset, not by line, so replace/insert/delete
 * all work uniformly and multi-line ranges behave like the real editor.
 */
import * as vscode from 'vscode';

const LF = String.fromCharCode(10);

export interface RecordedEdit {
    kind: 'replace' | 'insert' | 'delete';
    text?: string;
    range?: { start: [number, number]; end: [number, number] };
}

export interface Harness {
    /** The fake editor to hand to the code under test. */
    editor: unknown;
    /** The fake document. */
    document: unknown;
    /** Current document text. */
    text(): string;
    /** Current document lines. */
    lines(): string[];
    /** Every edit the code under test asked for, in call order. */
    edits: RecordedEdit[];
    /** Ranges passed to revealRange, for navigation commands. */
    revealed: { start: [number, number]; end: [number, number] }[];
    /** Decoration calls, for decoration modules. */
    decorations: { type: unknown; count: number }[];
    /** Snippet bodies passed to insertSnippet, for the snippet-expansion paths. */
    snippets: string[];
    /** Replaces the cursor set, for multi-cursor and range-selection commands. */
    setSelections(ranges: [number, number][]): void;
}

/** Builds a document whose content is `lines`, and an editor over it. */
export function makeEditor(
    lines: string[],
    opts: {
        /** Cursor line (default 0). */
        cursor?: number;
        /** Cursor character (default 0). */
        character?: number;
        languageId?: string;
        fileName?: string;
    } = {}
): Harness {
    let content = lines.slice();
    const languageId = opts.languageId ?? 'markdown';
    const fileName = opts.fileName ?? 'C:/tmp/notes.md';

    const edits: RecordedEdit[] = [];
    const revealed: Harness['revealed'] = [];
    const decorations: Harness['decorations'] = [];
    const snippets: string[] = [];

    const lineAt = (lineOrPos: number | { line: number }) => {
        const i = typeof lineOrPos === 'number' ? lineOrPos : lineOrPos.line;
        const text = content[i] ?? '';
        return {
            text,
            lineNumber: i,
            range: new vscode.Range(i, 0, i, text.length),
            rangeIncludingLineBreak: new vscode.Range(i, 0, i + 1, 0),
            firstNonWhitespaceCharacterIndex: text.length - text.trimStart().length,
            isEmptyOrWhitespace: text.trim().length === 0,
        };
    };

    /** Character offset of a Position in the joined text. */
    const offsetAt = (pos: { line: number; character: number }): number => {
        let off = 0;
        for (let i = 0; i < pos.line && i < content.length; i++) { off += content[i].length + 1; }
        return off + pos.character;
    };

    const positionAt = (offset: number) => {
        let remaining = offset;
        for (let i = 0; i < content.length; i++) {
            if (remaining <= content[i].length) { return new vscode.Position(i, remaining); }
            remaining -= content[i].length + 1;
        }
        const last = Math.max(0, content.length - 1);
        return new vscode.Position(last, (content[last] ?? '').length);
    };

    const document = {
        languageId,
        fileName,
        uri: vscode.Uri.file(fileName),
        get lineCount() { return content.length; },
        lineAt,
        offsetAt,
        positionAt,
        getText(range?: { start: { line: number; character: number }; end: { line: number; character: number } }) {
            const whole = content.join(LF);
            if (!range) { return whole; }
            return whole.slice(offsetAt(range.start), offsetAt(range.end));
        },
        save: () => Promise.resolve(true),
        isDirty: false,
        isUntitled: false,
        version: 1,
    };

    // Applied high-offset-first so earlier offsets stay valid, exactly as a real
    // TextEditorEdit batch behaves.
    const pending: { start: number; end: number; text: string }[] = [];

    const editBuilder = {
        replace(range: { start: { line: number; character: number }; end: { line: number; character: number } }, text: string) {
            edits.push({
                kind: 'replace', text,
                range: { start: [range.start.line, range.start.character], end: [range.end.line, range.end.character] },
            });
            pending.push({ start: offsetAt(range.start), end: offsetAt(range.end), text });
        },
        insert(position: { line: number; character: number }, text: string) {
            edits.push({ kind: 'insert', text, range: { start: [position.line, position.character], end: [position.line, position.character] } });
            const at = offsetAt(position);
            pending.push({ start: at, end: at, text });
        },
        delete(range: { start: { line: number; character: number }; end: { line: number; character: number } }) {
            edits.push({
                kind: 'delete',
                range: { start: [range.start.line, range.start.character], end: [range.end.line, range.end.character] },
            });
            pending.push({ start: offsetAt(range.start), end: offsetAt(range.end), text: '' });
        },
        setEndOfLine() { /* no-op */ },
    };

    const editor = {
        document,
        selection: new vscode.Selection(
            new vscode.Position(opts.cursor ?? 0, opts.character ?? 0),
            new vscode.Position(opts.cursor ?? 0, opts.character ?? 0)
        ),
        selections: [] as unknown[],
        options: { insertSpaces: true, tabSize: 4 },
        viewColumn: 1,
        edit(cb: (eb: typeof editBuilder) => void) {
            pending.length = 0;
            cb(editBuilder);
            let whole = content.join(LF);
            for (const e of [...pending].sort((a, b) => b.start - a.start)) {
                whole = whole.slice(0, e.start) + e.text + whole.slice(e.end);
            }
            content = whole.split(LF);
            pending.length = 0;
            return Promise.resolve(true);
        },
        revealRange(range: { start: { line: number; character: number }; end: { line: number; character: number } }) {
            revealed.push({
                start: [range.start.line, range.start.character],
                end: [range.end.line, range.end.character],
            });
        },
        setDecorations(type: unknown, ranges: unknown[]) {
            decorations.push({ type, count: Array.isArray(ranges) ? ranges.length : 0 });
        },
        insertSnippet: (snippet: { value: string }) => {
            snippets.push(snippet?.value ?? String(snippet));
            return Promise.resolve(true);
        },
    };

    editor.selections = [editor.selection];

    return {
        editor,
        document,
        text: () => content.join(LF),
        lines: () => content.slice(),
        edits,
        revealed,
        decorations,
        snippets,
        // Each entry is [startLine, endLine]; a single-line pair is a plain cursor.
        setSelections(ranges: [number, number][]) {
            editor.selections = ranges.map(([a, b]) =>
                new vscode.Selection(new vscode.Position(a, 0), new vscode.Position(b, 0)));
            editor.selection = editor.selections[0] ?? editor.selection;
        },
    };
}

/** Installs `harness.editor` as the active editor and returns it. */
export function activate(harness: Harness): Harness {
    (vscode.window as { activeTextEditor: unknown }).activeTextEditor = harness.editor;
    (vscode.window as { visibleTextEditors: unknown[] }).visibleTextEditors = [harness.editor];
    return harness;
}

/** Clears the active editor, for the "no editor open" branch every command has. */
export function deactivate(): void {
    (vscode.window as { activeTextEditor: unknown }).activeTextEditor = undefined;
    (vscode.window as { visibleTextEditors: unknown[] }).visibleTextEditors = [];
}

/** Shorthand: build a document, make it active, return the harness. */
export function openEditor(lines: string[], opts?: Parameters<typeof makeEditor>[1]): Harness {
    return activate(makeEditor(lines, opts));
}
