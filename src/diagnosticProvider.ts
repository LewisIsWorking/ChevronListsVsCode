import * as vscode from 'vscode';
import { getConfig } from './config';
import { collectIssues } from './diagnostics';
import { parseNumbered } from './patterns';
import { isHeader } from './patterns';

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
        const severity = (issue.kind === 'bad-numbering' || issue.kind === 'duplicate-header' || issue.kind === 'duplicate-subheading')
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

    const doc      = editor.document;
    const counters = new Map<string, number>();
    let   inSection = false;

    await editor.edit(eb => {
        for (let i = 0; i < doc.lineCount; i++) {
            const text = doc.lineAt(i).text;
            if (isHeader(text)) { counters.clear(); inSection = true; continue; }
            if (!inSection) { continue; }

            const numbered = parseNumbered(text);
            if (!numbered) { continue; }

            const key      = numbered.chevrons;
            const expected = (counters.get(key) ?? 0) + 1;
            counters.set(key, expected);

            if (numbered.num !== expected) {
                const fixed = `${numbered.chevrons} ${expected}. ${numbered.content}`;
                eb.replace(doc.lineAt(i).range, fixed);
            }
        }
    });

    updateDiagnostics(editor.document);
    vscode.window.showInformationMessage('CL: Numbered items fixed');
}

export function getDiagnosticCollection(): vscode.DiagnosticCollection { return collection; }
