import * as vscode from 'vscode';
import { getConfig } from './config';
import { computeAutoFixEdits } from './patterns';

/**
 * autoFixNumbering.ts - registers a debounced on-edit listener that
 * renumbers broken numbered-list sequences. Pure logic lives in
 * computeAutoFixEdits (patternsUtils.ts).
 *
 * Two robustness measures (added v26.5.0):
 *   1. try/finally around applyEdit - if it throws, isApplyingFix is still
 *      reset so the listener stays alive instead of silently dying.
 *   2. 250ms debounce - collapses bursts of keystrokes into a single scan,
 *      eliminating per-keystroke document allocation churn and GC pressure.
 */

const DEBOUNCE_MS = 250;

let isApplyingFix = false;
let pendingTimer: ReturnType<typeof setTimeout> | undefined;
let pendingDoc:   vscode.TextDocument | undefined;

/** Registers the auto-fix numbering document change listener */
export function registerAutoFixNumbering(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (isApplyingFix) { return; }
            if (event.document.languageId !== 'markdown') { return; }
            if (!getConfig().autoFixNumbering) { return; }
            if (event.contentChanges.length === 0) { return; }

            // Coalesce bursts of edits into a single scan after the user pauses
            pendingDoc = event.document;
            if (pendingTimer) { clearTimeout(pendingTimer); }
            pendingTimer = setTimeout(() => {
                pendingTimer = undefined;
                const doc    = pendingDoc;
                pendingDoc   = undefined;
                if (!doc) { return; }
                void runAutoFix(doc);
            }, DEBOUNCE_MS);
        })
    );

    // Clear any pending timer on extension deactivate so we don't fire after dispose
    context.subscriptions.push({
        dispose: () => {
            if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = undefined; }
            pendingDoc = undefined;
        }
    });
}

/** Scans the document, computes any renumber edits needed, and applies them */
async function runAutoFix(doc: vscode.TextDocument): Promise<void> {
    if (doc.isClosed) { return; }

    const lines = Array.from({ length: doc.lineCount }, (_, i) => ({
        text: doc.lineAt(i).text, lineIndex: i,
    }));
    const edits = computeAutoFixEdits(lines);
    if (edits.length === 0) { return; }

    isApplyingFix = true;
    try {
        const we = new vscode.WorkspaceEdit();
        for (const e of edits) {
            we.replace(doc.uri, doc.lineAt(e.lineIndex).range, e.newText);
        }
        await vscode.workspace.applyEdit(we);
    } catch (err) {
        // Best-effort fix - log for diagnostics but never let an exception kill the listener
        console.warn('CL: autoFixNumbering applyEdit failed', err);
    } finally {
        isApplyingFix = false;
    }
}
