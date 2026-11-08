import * as vscode from 'vscode';
import { getConfig } from './config';
import { collectIssues } from './diagnostics';
import { isHeader } from './patterns';
import { renumberLines } from './numberingRuns';

const collection = vscode.languages.createDiagnosticCollection('chevron-lists');

/**
 * Exposes the core diagnostic collection so `activate` can register it for
 * disposal and so `diagnosticCleanup` can drop entries for closed documents.
 */
export function getChevronDiagCollection(): vscode.DiagnosticCollection {
    return collection;
}

/** Refreshes diagnostics for the given document */
export function updateDiagnostics(document: vscode.TextDocument): void {
    if (document.languageId !== 'markdown') { collection.delete(document.uri); return; }

    const { prefix } = getConfig();
    const issues     = collectIssues(document, prefix);

    const diagnostics = issues.map(issue => {
        const range    = document.lineAt(issue.line).range;
        const severity = (issue.kind === 'bad-numbering' || issue.kind === 'duplicate-header' || issue.kind === 'duplicate-subheading' || issue.kind === 'set-duplicate')
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;
        const d        = new vscode.Diagnostic(range, issue.message, severity);
        d.source       = 'Chevron Lists';
        d.code         = issue.kind;
        return d;
    });

    collection.set(document.uri, diagnostics);
}

/** Fixes all out-of-sequence numbered items in the active document */
export async function onFixNumbering(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc    = editor.document;
    const before = Array.from({ length: doc.lineCount }, (_, i) => doc.lineAt(i).text);
    const start  = before.findIndex(isHeader);
    if (start >= 0) {
        const fixed = renumberLines(before.slice(start));
        await editor.edit(eb => {
            fixed.forEach((text, k) => {
                if (text !== before[start + k]) { eb.replace(doc.lineAt(start + k).range, text); }
            });
        });
    }

    updateDiagnostics(editor.document);
    vscode.window.showInformationMessage('CL: Numbered items fixed');
}

export function getDiagnosticCollection(): vscode.DiagnosticCollection { return collection; }
