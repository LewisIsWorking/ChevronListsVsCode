/**
 * diagnosticCleanup.ts
 * Central "forget this document" hook for every DiagnosticCollection the
 * extension owns.
 *
 * A DiagnosticCollection is a strong URI -> Diagnostic[] map held by the
 * extension host. Entries survive the document being closed, so without an
 * explicit delete every markdown file opened during a session is retained
 * (its Diagnostic and Range objects) until the window is reloaded. With four
 * collections that is four retained arrays per file, for the whole session.
 *
 * Every collection that calls `.set(uri, ...)` MUST be dropped here.
 */
import * as vscode from 'vscode';
import { getChevronDiagCollection } from './diagnosticProvider';
import { getWordGoalDiagCollection } from './wordGoalCommands';
import { getExpiryDiagCollection } from './expiryDiagnostics';
import { clearSinks } from './diagnosticSinks';

/**
 * Releases every diagnostic entry held for `uri`.
 *
 * `dueDateDiags` is created in `activate` and threaded through, so it is
 * passed in rather than looked up.
 */
export function clearAllDiagnostics(
    uri: vscode.Uri,
    dueDateDiags: vscode.DiagnosticCollection
): void {
    clearSinks([
        getChevronDiagCollection(),
        getWordGoalDiagCollection(),
        getExpiryDiagCollection(),
        dueDateDiags,
    ], uri);
}
