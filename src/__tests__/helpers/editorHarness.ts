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
 *
 * Two more behaviours copy the real editor, because commands that ignore them
 * are wrong in VS Code while looking right against a simpler fake:
 *   - Positions are clamped to the document. A position past the end of a line
 *     is the end of that line; a line past the last line is the end of the file.
 *     So inserting at (lastLine + 1, 0) in a file without a trailing newline
 *     appends to the last line, as it does in VS Code.
 *   - Selections move with edits. Text inserted before a cursor pushes it along,
 *     and an empty cursor at the insertion point ends up after the new text, as
 *     if typed. A non-empty selection grows when text is inserted at its edges.
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

/**
 * Where offset `p` (in the text before `edits`) ends up afterwards.
 * `isStartEdge` is true for the start of a non-empty selection, which stays put
 * when text is inserted exactly there (the selection grows); every other
 * position at an insertion point is pushed past the inserted text.
 */
function moveOffset(p: number, edits: { start: number; end: number; text: string }[], isStartEdge: boolean): number {
    let shift = 0;
    for (const e of edits) {
        const delta = e.text.length - (e.end - e.start);
        if (e.end < p) { shift += delta; }
        else if (e.start < p) { return moveOffset(e.start, edits.filter(x => x !== e), false) + e.text.length; }
        else if (e.start === p && e.end === p && !isStartEdge) { shift += delta; }
    }
    return p + shift;
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

    /** Character offset of a Position in the joined text, clamped like TextDocument.validatePosition. */
    const offsetAt = (pos: { line: number; character: number }): number => {
        if (pos.line >= content.length) { return content.join(LF).length; }
        const line = Math.max(0, pos.line);
        let off = 0;
        for (let i = 0; i < line; i++) { off += content[i].length + 1; }
        return off + Math.min(Math.max(0, pos.character), content[line].length);
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
            const applied = [...pending];
            // Selection edges as offsets in the ORIGINAL text, before any edit lands.
            const before = editor.selections.map(sel => {
                const { anchor, active } = sel as { anchor: { line: number; character: number }; active: { line: number; character: number } };
                return { anchor: offsetAt(anchor), active: offsetAt(active) };
            });
            let whole = content.join(LF);
            for (const e of [...applied].sort((a, b) => b.start - a.start)) {
                whole = whole.slice(0, e.start) + e.text + whole.slice(e.end);
            }
            content = whole.split(LF);
            pending.length = 0;
            const moved = before.map(({ anchor, active }) => {
                const lo = Math.min(anchor, active), hi = Math.max(anchor, active);
                const map = (p: number) => moveOffset(p, applied, lo !== hi && p === lo);
                return new vscode.Selection(positionAt(map(anchor)), positionAt(map(active)));
            });
            editor.selections = moved;
            editor.selection = moved[0] ?? editor.selection;
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
