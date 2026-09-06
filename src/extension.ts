import * as vscode from 'vscode';
import { createStatusBar }                                   from './statusBar';
import { createOverdueStatusBar }                            from './overdueStatusBar';
import { getWordGoalDiagCollection }                         from './wordGoalCommands';
import { applyConfiguredPreset }                             from './presetCommands';
import { refreshEditor }                                     from './editorRefresh';
import { ChevronFoldingProvider }                            from './foldingProvider';
import { ChevronHoverProvider }                              from './hoverProvider';
import { ChevronSemanticTokensProvider, buildLegend }        from './semanticProvider';
import { ChevronOutlineProvider }                            from './outlineProvider';
import { ChevronCodeActionProvider }                         from './codeActionProvider';
import { registerCoreCommands }                              from './commandRegistrationsA';
import { registerSearchItemProviderCommands }                from './commandRegistrationsB';
import { registerPhase12to32Commands }                       from './commandRegistrationsC';
import { registerAutoFixNumbering }                          from './autoFixNumbering';
import { registerLockEnforcement }                           from './lockEnforcement';
import { registerCollapseMemory }                            from './sectionCollapseMemory';
import { showTipOfDay, onShowTipOfDay }                              from './tipOfDay';
import { clearJumpHistory }                                  from './jumpHistory';
import { getConfig }                                         from './config';
import { openOnFirstInstall }                                from './settingsPanel';
import { getChevronDiagCollection }                           from './diagnosticProvider';
import { getExpiryDiagCollection }                            from './expiryDiagnostics';
import { clearAllDiagnostics }                                from './diagnosticCleanup';

/** Debounce window for the full decoration/diagnostic refresh, in ms */
const REFRESH_DEBOUNCE_MS = 150;

export function activate(context: vscode.ExtensionContext): void {
    const statusBar    = createStatusBar();
    const overdueBar   = createOverdueStatusBar();
    const dueDateDiags = vscode.languages.createDiagnosticCollection('chevron-lists-dates');
    const wordGoalDiags = getWordGoalDiagCollection();
    // These two are created at module scope in their own files; register them
    // here so they are disposed with the extension rather than outliving it.
    const chevronDiags = getChevronDiagCollection();
    const expiryDiags  = getExpiryDiagCollection();

    // `refreshEditor` runs 21 full-document passes. Firing it on every
    // keystroke allocated thousands of short-lived objects per character on
    // large files. Collapse keystroke bursts into a single pass once typing
    // pauses. Editor switches stay immediate -- only text edits are debounced.
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = (): void => {
        if (refreshTimer) { clearTimeout(refreshTimer); }
        refreshTimer = setTimeout(() => {
            refreshTimer = undefined;
            const active = vscode.window.activeTextEditor;
            if (active) { refreshEditor(active, { dueDateDiags }); }
        }, REFRESH_DEBOUNCE_MS);
    };

    context.subscriptions.push(
        statusBar, overdueBar, dueDateDiags, wordGoalDiags, chevronDiags, expiryDiags,

        // Make sure a pending refresh can never outlive the extension
        new vscode.Disposable(() => {
            if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = undefined; }
        }),

        // ── Command groups ───────────────────────────────────────────────────
        ...registerCoreCommands(context),
        ...registerSearchItemProviderCommands(context),
        ...registerPhase12to32Commands(),
        vscode.commands.registerCommand('chevron-lists.showTipOfDay', () => onShowTipOfDay(context)),

        // ── Language providers ───────────────────────────────────────────────
        vscode.languages.registerFoldingRangeProvider(
            { language: 'markdown' }, new ChevronFoldingProvider()),
        vscode.languages.registerHoverProvider(
            { language: 'markdown' }, new ChevronHoverProvider()),
        vscode.languages.registerDocumentSymbolProvider(
            { language: 'markdown' }, new ChevronOutlineProvider()),
        vscode.languages.registerCodeActionsProvider(
            { language: 'markdown' },
            new ChevronCodeActionProvider(),
            { providedCodeActionKinds: ChevronCodeActionProvider.providedCodeActionKinds }
        ),
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: 'markdown' },
            new ChevronSemanticTokensProvider(buildLegend()),
            buildLegend()
        ),

        // ── Decoration & diagnostic events ───────────────────────────────────
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) { refreshEditor(editor, { dueDateDiags }); }
        }),
        vscode.workspace.onDidChangeTextDocument(event => {
            const editor = vscode.window.activeTextEditor;
            if (editor && event.document === editor.document) {
                scheduleRefresh();
            }
        }),
        // Release per-file state when a document is closed. Diagnostic
        // collections are strong URI-keyed maps -- without the delete, every
        // markdown file opened this session stays retained.
        vscode.workspace.onDidCloseTextDocument(doc => {
            clearJumpHistory(doc.uri);
            clearAllDiagnostics(doc.uri, dueDateDiags);
        }),
    );

    registerAutoFixNumbering(context);
    registerLockEnforcement(context);
    registerCollapseMemory(context);
    showTipOfDay(context);
    openOnFirstInstall(context);

    if (vscode.window.activeTextEditor) {
        refreshEditor(vscode.window.activeTextEditor, { dueDateDiags });
    }
    applyConfiguredPreset();
}

export function deactivate(): void {}
