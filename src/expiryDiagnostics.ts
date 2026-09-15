import * as vscode from 'vscode';
import { parseBullet, parseNumbered } from './patterns';
import { parseExpiry, isExpired } from './expiryParser';

const EXPIRY_DIAG_SOURCE = 'Chevron Lists';
let expiryDiagCollection: vscode.DiagnosticCollection | undefined;

export function getExpiryDiagCollection(): vscode.DiagnosticCollection {
    if (!expiryDiagCollection) {
        expiryDiagCollection = vscode.languages.createDiagnosticCollection('chevron-lists-expiry');
    }
    return expiryDiagCollection;
}

/** Updates @expires: diagnostics for the given document */
export function updateExpiryDiagnostics(
    doc: vscode.TextDocument,
    collection: vscode.DiagnosticCollection,
    prefix: string
): void {
    if (doc.languageId !== 'markdown') { return; }
    const diags: vscode.Diagnostic[] = [];
    const today = new Date();
    for (let i = 0; i < doc.lineCount; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const dateStr = parseExpiry(content);
        if (!dateStr || !isExpired(dateStr, today)) { continue; }
        const range = doc.lineAt(i).range;
        const diag  = new vscode.Diagnostic(
            range,
            `Item expired on ${dateStr}`,
            vscode.DiagnosticSeverity.Warning
        );
        diag.code   = 'expired';
        diag.source = EXPIRY_DIAG_SOURCE;
        diags.push(diag);
    }
    collection.set(doc.uri, diags);
}
