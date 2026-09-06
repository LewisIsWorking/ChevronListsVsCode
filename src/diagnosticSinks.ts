/**
 * diagnosticSinks.ts
 * Pure cleanup core for diagnostic retention -- no `vscode` import, so it is
 * unit testable (the same pure-core / thin-bridge split used by patterns.ts
 * and diagnostics.ts).
 *
 * A DiagnosticCollection is a strong URI -> Diagnostic[] map owned by the
 * extension host. Entries outlive the document being closed, so every
 * collection that calls `.set(uri, ...)` must also be cleared here or each
 * markdown file opened during a session stays retained until reload.
 */

/** The slice of vscode.DiagnosticCollection this module needs */
export interface DiagnosticSink {
    delete(uri: never): void;
}

/** Anything URI-like; collections key on the string form */
export interface UriLike {
    toString(): string;
}

/** Releases the entry held for `uri` in every sink. Missing entries are a no-op. */
export function clearSinks(sinks: readonly DiagnosticSink[], uri: UriLike): void {
    for (const sink of sinks) {
        (sink as { delete(u: UriLike): void }).delete(uri);
    }
}
