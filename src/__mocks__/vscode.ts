/**
 * vscode.ts -- test stand-in for the `vscode` runtime module.
 *
 * Resolved via the `test-shims/vscode` package (a `file:` devDependency named
 * "vscode"), so production code can `import * as vscode from 'vscode'` and be
 * loaded by `bun test` unchanged. Before that shim existed nothing in the
 * integration layer was importable at all, so 224 of 265 source files were
 * invisible to coverage -- see test-shims/README.md.
 *
 * This is a working fake, not a stub wall: Position/Range/Selection carry real
 * semantics, collections really store, and the `window` prompts record their
 * calls so tests can assert what the user was shown. Call `__reset()` between
 * tests to clear that recorded state.
 *
 * Types still come from @types/vscode -- the shim package deliberately ships no
 * declarations -- so this file only has to be behaviourally right, not
 * type-identical to the real API.
 */

// ---------------------------------------------------------------- primitives

export class Position {
    constructor(public readonly line: number, public readonly character: number) {}
    with(line?: number, character?: number): Position {
        return new Position(line ?? this.line, character ?? this.character);
    }
    translate(lineDelta = 0, characterDelta = 0): Position {
        return new Position(this.line + lineDelta, this.character + characterDelta);
    }
    isBefore(other: Position): boolean {
        return this.line < other.line || (this.line === other.line && this.character < other.character);
    }
    isAfter(other: Position): boolean { return other.isBefore(this); }
    isEqual(other: Position): boolean {
        return this.line === other.line && this.character === other.character;
    }
    compareTo(other: Position): number {
        return this.isEqual(other) ? 0 : this.isBefore(other) ? -1 : 1;
    }
}

export class Range {
    readonly start: Position;
    readonly end: Position;
    constructor(startLine: number | Position, startChar?: number | Position, endLine?: number, endChar?: number) {
        if (startLine instanceof Position && startChar instanceof Position) {
            // Real Range orders its endpoints regardless of argument order.
            this.start = startLine.isBefore(startChar) ? startLine : startChar;
            this.end   = startLine.isBefore(startChar) ? startChar : startLine;
        } else {
            this.start = new Position(startLine as number, startChar as number);
            this.end   = new Position(endLine as number, endChar as number);
        }
    }
    get isEmpty(): boolean { return this.start.isEqual(this.end); }
    get isSingleLine(): boolean { return this.start.line === this.end.line; }
    contains(pos: Position): boolean { return !pos.isBefore(this.start) && !pos.isAfter(this.end); }
    with(start?: Position, end?: Position): Range { return new Range(start ?? this.start, end ?? this.end); }
}

export class Selection extends Range {
    constructor(public readonly anchor: Position, public readonly active: Position) {
        super(anchor, active);
    }
    get isReversed(): boolean { return this.active.isBefore(this.anchor); }
}

export class Location {
    constructor(public uri: Uri, public range: Range | Position) {}
}

export class Uri {
    private constructor(public readonly scheme: string, public readonly fsPath: string) {}
    static file(p: string): Uri { return new Uri('file', p); }
    static parse(value: string): Uri {
        const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/.exec(value);
        return m ? new Uri(m[1], m[2]) : new Uri('file', value);
    }
    static joinPath(base: Uri, ...parts: string[]): Uri {
        return new Uri(base.scheme, [base.fsPath.replace(/[\/]+$/, ''), ...parts].join('/'));
    }
    get path(): string { return this.fsPath; }
    toString(): string { return this.scheme === 'file' ? this.fsPath : `${this.scheme}:${this.fsPath}`; }
    with(change: { scheme?: string; path?: string }): Uri {
        return new Uri(change.scheme ?? this.scheme, change.path ?? this.fsPath);
    }
}

export class Disposable {
    static from(...items: { dispose(): unknown }[]): Disposable {
        return new Disposable(() => items.forEach(i => i.dispose()));
    }
    constructor(private readonly callOnDispose: () => unknown = () => {}) {}
    dispose(): void { this.callOnDispose(); }
}

export class EventEmitter<T> {
    private readonly listeners: ((e: T) => unknown)[] = [];
    readonly event = (listener: (e: T) => unknown): Disposable => {
        this.listeners.push(listener);
        return new Disposable(() => {
            const i = this.listeners.indexOf(listener);
            if (i >= 0) { this.listeners.splice(i, 1); }
        });
    };
    fire(data: T): void { for (const l of [...this.listeners]) { l(data); } }
    dispose(): void { this.listeners.length = 0; }
}

// --------------------------------------------------------------------- enums

export const TextEditorRevealType = { Default: 0, InCenter: 1, InCenterIfOutsideViewport: 2, AtTop: 3 };
export const ViewColumn           = { Active: -1, Beside: -2, One: 1, Two: 2, Three: 3 };
export const ProgressLocation     = { SourceControl: 1, Window: 10, Notification: 15 };
export const ConfigurationTarget  = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
export const StatusBarAlignment   = { Left: 1, Right: 2 };
export const DiagnosticSeverity   = { Error: 0, Warning: 1, Information: 2, Hint: 3 };
export const OverviewRulerLane    = { Left: 1, Center: 2, Right: 4, Full: 7 };
export const QuickPickItemKind    = { Separator: -1, Default: 0 };
export const EndOfLine            = { LF: 1, CRLF: 2 };
export const TextEditorCursorStyle = { Line: 1, Block: 2, Underline: 3 };

export const CompletionItemKind = {
    Text: 0, Method: 1, Function: 2, Constructor: 3, Field: 4, Variable: 5, Class: 6,
    Interface: 7, Module: 8, Property: 9, Unit: 10, Value: 11, Enum: 12, Keyword: 13,
    Snippet: 14, Color: 15, File: 16, Reference: 17, Folder: 18, EnumMember: 19,
    Constant: 20, Struct: 21, Event: 22, Operator: 23, TypeParameter: 24, User: 25, Issue: 26,
};

export const SymbolKind = {
    File: 0, Module: 1, Namespace: 2, Package: 3, Class: 4, Method: 5, Property: 6,
    Field: 7, Constructor: 8, Enum: 9, Interface: 10, Function: 11, Variable: 12,
    Constant: 13, String: 14, Number: 15, Boolean: 16, Array: 17, Object: 18, Key: 19,
    Null: 20, EnumMember: 21, Struct: 22, Event: 23, Operator: 24, TypeParameter: 25,
};

export class CodeActionKind {
    static readonly Empty         = new CodeActionKind('');
    static readonly QuickFix      = new CodeActionKind('quickfix');
    static readonly Refactor      = new CodeActionKind('refactor');
    static readonly Source        = new CodeActionKind('source');
    static readonly SourceFixAll  = new CodeActionKind('source.fixAll');
    constructor(public readonly value: string) {}
    append(parts: string): CodeActionKind { return new CodeActionKind(`${this.value}.${parts}`); }
    contains(other: CodeActionKind): boolean { return other.value.startsWith(this.value); }
}

// ----------------------------------------------------------------- value types

export class ThemeColor { constructor(public readonly id: string) {} }

export class MarkdownString {
    isTrusted = false;
    supportHtml = false;
    constructor(public value = '') {}
    appendText(v: string): this { this.value += v; return this; }
    appendMarkdown(v: string): this { this.value += v; return this; }
    appendCodeblock(code: string, lang = ''): this {
        this.value += '```' + lang + String.fromCharCode(10) + code + String.fromCharCode(10) + '```';
        return this;
    }
}

export class SnippetString {
    constructor(public value = '') {}
    appendText(v: string): this { this.value += v; return this; }
    appendPlaceholder(v: string): this { this.value += v; return this; }
    appendTabstop(): this { return this; }
}

export class Hover {
    constructor(public contents: MarkdownString | string | (MarkdownString | string)[], public range?: Range) {}
}

export class Diagnostic {
    source?: string;
    code?: string | number;
    tags?: number[];
    relatedInformation?: unknown[];
    constructor(public range: Range, public message: string, public severity: number = DiagnosticSeverity.Error) {}
}

export class CompletionItem {
    detail?: string;
    documentation?: string | MarkdownString;
    insertText?: string | SnippetString;
    sortText?: string;
    filterText?: string;
    range?: Range;
    command?: unknown;
    constructor(public label: string, public kind?: number) {}
}

export class CodeAction {
    edit?: WorkspaceEdit;
    diagnostics?: Diagnostic[];
    command?: unknown;
    isPreferred?: boolean;
    constructor(public title: string, public kind?: CodeActionKind) {}
}

export class DocumentSymbol {
    children: DocumentSymbol[] = [];
    constructor(
        public name: string, public detail: string, public kind: number,
        public range: Range, public selectionRange: Range
    ) {}
}

export class FoldingRange {
    constructor(public start: number, public end: number, public kind?: number) {}
}

export class DocumentLink {
    constructor(public range: Range, public target?: Uri) {}
}

export class SemanticTokensLegend {
    constructor(public readonly tokenTypes: string[], public readonly tokenModifiers: string[] = []) {}
}

export class SemanticTokens {
    constructor(public readonly data: Uint32Array) {}
}

export class SemanticTokensBuilder {
    private readonly tokens: number[] = [];
    constructor(public readonly legend?: SemanticTokensLegend) {}
    push(line: number, char: number, length: number, tokenType: number, tokenModifiers = 0): void {
        this.tokens.push(line, char, length, tokenType, tokenModifiers);
    }
    build(): SemanticTokens { return new SemanticTokens(new Uint32Array(this.tokens)); }
}

// ------------------------------------------------------------------- edits

interface EditOp { kind: 'replace' | 'insert' | 'delete'; uri: Uri; range?: Range; position?: Position; text?: string; }

export class WorkspaceEdit {
    /** Recorded operations, in order -- assert against these instead of a real document. */
    readonly operations: EditOp[] = [];
    get size(): number { return this.operations.length; }
    replace(uri: Uri, range: Range, text: string): void { this.operations.push({ kind: 'replace', uri, range, text }); }
    insert(uri: Uri, position: Position, text: string): void { this.operations.push({ kind: 'insert', uri, position, text }); }
    delete(uri: Uri, range: Range): void { this.operations.push({ kind: 'delete', uri, range }); }
    has(uri: Uri): boolean { return this.operations.some(o => o.uri.toString() === uri.toString()); }
    entries(): [Uri, EditOp[]][] {
        const byUri = new Map<string, [Uri, EditOp[]]>();
        for (const op of this.operations) {
            const key = op.uri.toString();
            if (!byUri.has(key)) { byUri.set(key, [op.uri, []]); }
            byUri.get(key)![1].push(op);
        }
        return [...byUri.values()];
    }
}

/**
 * Map-backed DiagnosticCollection. The real one is a strong URI -> Diagnostic[]
 * map owned by the extension host, which is exactly why entries have to be
 * deleted on document close -- so the fake stores for real and exposes `size`.
 */
export class DiagnosticCollection {
    readonly entries = new Map<string, Diagnostic[]>();
    constructor(public readonly name: string) {}
    set(uri: Uri, diags: Diagnostic[]): void { this.entries.set(uri.toString(), diags ?? []); }
    get(uri: Uri): Diagnostic[] | undefined { return this.entries.get(uri.toString()); }
    delete(uri: Uri): void { this.entries.delete(uri.toString()); }
    has(uri: Uri): boolean { return this.entries.has(uri.toString()); }
    clear(): void { this.entries.clear(); }
    dispose(): void { this.entries.clear(); }
    get size(): number { return this.entries.size; }
    forEach(cb: (uri: Uri, diags: Diagnostic[]) => void): void {
        for (const [k, v] of this.entries) { cb(Uri.parse(k), v); }
    }
}

// ------------------------------------------------------- recorded interactions

/** Everything the extension showed the user, so tests can assert on it. */
export const recorded = {
    info:     [] as string[],
    warning:  [] as string[],
    error:    [] as string[],
    commands: [] as { command: string; args: unknown[] }[],
    clipboard: '',
};

/** Queued answers for the next prompt calls. Pop order is FIFO. */
export const queued = {
    quickPick: [] as unknown[],
    inputBox:  [] as (string | undefined)[],
    saveDialog: [] as (Uri | undefined)[],
};

/** Clears all recorded interactions, queued answers and registrations. */
export function __reset(): void {
    recorded.info.length = 0;
    recorded.warning.length = 0;
    recorded.error.length = 0;
    recorded.commands.length = 0;
    recorded.clipboard = '';
    queued.quickPick.length = 0;
    queued.inputBox.length = 0;
    queued.saveDialog.length = 0;
    registeredCommands.clear();
    configValues.clear();
    (window as { activeTextEditor?: unknown }).activeTextEditor = undefined;
    window.visibleTextEditors.length = 0;
}

const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
const configValues = new Map<string, unknown>();

/** Seeds a workspace configuration value, e.g. __setConfig('chevron-lists.prefix', '*'). */
export function __setConfig(key: string, value: unknown): void { configValues.set(key, value); }

const noopDisposable = (): Disposable => new Disposable(() => {});

// ---------------------------------------------------------------- namespaces

export const window = {
    activeTextEditor: undefined as unknown,
    visibleTextEditors: [] as unknown[],

    showInformationMessage: (msg: string, ...items: string[]) => {
        recorded.info.push(msg);
        return Promise.resolve(items[0]);
    },
    showWarningMessage: (msg: string, ...items: string[]) => {
        recorded.warning.push(msg);
        return Promise.resolve(items[0]);
    },
    showErrorMessage: (msg: string, ...items: string[]) => {
        recorded.error.push(msg);
        return Promise.resolve(items[0]);
    },

    // Prompts answer from `queued`; an empty queue means the user cancelled,
    // which is the branch most command code forgets to handle.
    showQuickPick: (_items?: unknown, _opts?: unknown) => Promise.resolve(queued.quickPick.shift()),
    showInputBox: (_opts?: unknown) => Promise.resolve(queued.inputBox.shift()),
    showSaveDialog: (_opts?: unknown) => Promise.resolve(queued.saveDialog.shift()),
    showOpenDialog: (_opts?: unknown) => Promise.resolve(undefined),

    createQuickPick: () => ({
        items: [] as unknown[], activeItems: [] as unknown[], selectedItems: [] as unknown[],
        placeholder: "", title: "", value: "", busy: false, canSelectMany: false,
        onDidChangeActive: (_: unknown) => noopDisposable(),
        onDidChangeSelection: (_: unknown) => noopDisposable(),
        onDidAccept: (_: unknown) => noopDisposable(),
        onDidHide: (_: unknown) => noopDisposable(),
        show: () => {}, hide: () => {}, dispose: () => {},
    }),

    createTextEditorDecorationType: (opts?: unknown) => ({ key: "dec", options: opts, dispose: () => {} }),

    createStatusBarItem: (alignment?: number, priority?: number) => ({
        alignment, priority, text: "", tooltip: "", command: undefined as unknown,
        show: () => {}, hide: () => {}, dispose: () => {},
    }),

    createWebviewPanel: (_type: string, title: string, _col?: unknown, _opts?: unknown) => ({
        title,
        webview: {
            html: "",
            options: {},
            asWebviewUri: (u: Uri) => u,
            cspSource: "vscode-webview:",
            postMessage: (_m: unknown) => Promise.resolve(true),
            onDidReceiveMessage: (_: unknown) => noopDisposable(),
        },
        onDidDispose: (_: unknown) => noopDisposable(),
        onDidChangeViewState: (_: unknown) => noopDisposable(),
        reveal: () => {}, dispose: () => {}, visible: true,
    }),

    createOutputChannel: (name: string) => ({
        name, append: () => {}, appendLine: () => {}, clear: () => {},
        show: () => {}, hide: () => {}, dispose: () => {},
    }),

    showTextDocument: (doc: unknown) => Promise.resolve({
        document: doc,
        selection: new Selection(new Position(0, 0), new Position(0, 0)),
        selections: [] as unknown[],
        edit: (_cb: unknown) => Promise.resolve(true),
        revealRange: () => {},
        setDecorations: () => {},
    }),

    // Runs the task immediately with a no-op reporter, so command code under
    // test actually executes instead of being skipped.
    withProgress: <T>(
        _opts: unknown,
        task: (p: { report: (v: unknown) => void }, token: unknown) => Thenable<T>
    ) => Promise.resolve(task(
        { report: () => {} },
        { isCancellationRequested: false, onCancellationRequested: () => noopDisposable() }
    )),

    onDidChangeActiveTextEditor: (_: unknown) => noopDisposable(),
    onDidChangeTextEditorSelection: (_: unknown) => noopDisposable(),
    onDidChangeVisibleTextEditors: (_: unknown) => noopDisposable(),
    setStatusBarMessage: (_: string) => noopDisposable(),
};

export const workspace = {
    workspaceFolders: undefined as unknown,
    getConfiguration: (section?: string) => ({
        get: <T>(key: string, defaultValue?: T): T => {
            const full = section ? section + "." + key : key;
            return (configValues.has(full) ? configValues.get(full) : defaultValue) as T;
        },
        has: (key: string) => configValues.has(section ? section + "." + key : key),
        update: (key: string, value: unknown) => {
            configValues.set(section ? section + "." + key : key, value);
            return Promise.resolve();
        },
        inspect: () => undefined,
    }),
    openTextDocument: (_arg?: unknown) => Promise.resolve({
        uri: Uri.file("untitled"), languageId: "markdown", lineCount: 0,
        getText: () => "",
        lineAt: (i: number) => ({ text: "", lineNumber: i, range: new Range(i, 0, i, 0) }),
        save: () => Promise.resolve(true),
    }),
    applyEdit: (_edit: WorkspaceEdit) => Promise.resolve(true),
    findFiles: (_include: unknown, _exclude?: unknown) => Promise.resolve([] as Uri[]),
    fs: {
        readFile: (_u: Uri) => Promise.resolve(new Uint8Array()),
        writeFile: (_u: Uri, _c: Uint8Array) => Promise.resolve(),
        delete: (_u: Uri, _o?: unknown) => Promise.resolve(),
        stat: (_u: Uri) => Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 0 }),
        createDirectory: (_u: Uri) => Promise.resolve(),
        readDirectory: (_u: Uri) => Promise.resolve([] as [string, number][]),
    },
    asRelativePath: (p: Uri | string) => (typeof p === "string" ? p : p.fsPath),
    onDidChangeTextDocument: (_: unknown) => noopDisposable(),
    onDidCloseTextDocument: (_: unknown) => noopDisposable(),
    onDidOpenTextDocument: (_: unknown) => noopDisposable(),
    onDidSaveTextDocument: (_: unknown) => noopDisposable(),
    onDidDeleteFiles: (_: unknown) => noopDisposable(),
    onDidRenameFiles: (_: unknown) => noopDisposable(),
    onDidChangeConfiguration: (_: unknown) => noopDisposable(),
};

export const languages = {
    createDiagnosticCollection: (name: string) => new DiagnosticCollection(name),
    registerFoldingRangeProvider:           (_s: unknown, _p: unknown) => noopDisposable(),
    registerHoverProvider:                  (_s: unknown, _p: unknown) => noopDisposable(),
    registerDocumentSymbolProvider:         (_s: unknown, _p: unknown) => noopDisposable(),
    registerCodeActionsProvider:            (_s: unknown, _p: unknown, _m?: unknown) => noopDisposable(),
    registerCompletionItemProvider:         (_s: unknown, _p: unknown, ..._t: string[]) => noopDisposable(),
    registerDefinitionProvider:             (_s: unknown, _p: unknown) => noopDisposable(),
    registerDocumentLinkProvider:           (_s: unknown, _p: unknown) => noopDisposable(),
    registerDocumentSemanticTokensProvider: (_s: unknown, _p: unknown, _l?: unknown) => noopDisposable(),
};

export const commands = {
    registerCommand: (command: string, cb: (...args: unknown[]) => unknown) => {
        registeredCommands.set(command, cb);
        return noopDisposable();
    },
    registerTextEditorCommand: (command: string, cb: (...args: unknown[]) => unknown) => {
        registeredCommands.set(command, cb);
        return noopDisposable();
    },
    executeCommand: (command: string, ...args: unknown[]) => {
        recorded.commands.push({ command, args });
        const handler = registeredCommands.get(command);
        return Promise.resolve(handler ? handler(...args) : undefined);
    },
    getCommands: (_filter?: boolean) => Promise.resolve([...registeredCommands.keys()]),
};

/** Invokes a command registered through the mock, for exercising its handler. */
export function __invokeCommand(command: string, ...args: unknown[]): unknown {
    const handler = registeredCommands.get(command);
    if (!handler) { throw new Error("Command not registered: " + command); }
    return handler(...args);
}

/** Names of every command registered so far. */
export function __registeredCommands(): string[] { return [...registeredCommands.keys()]; }

export const env = {
    clipboard: {
        writeText: (t: string) => { recorded.clipboard = t; return Promise.resolve(); },
        readText: () => Promise.resolve(recorded.clipboard),
    },
    openExternal: (_u: Uri) => Promise.resolve(true),
    appName: "Visual Studio Code",
    language: "en",
};

export const extensions = {
    getExtension: (_id: string) => undefined,
    all: [] as unknown[],
};
