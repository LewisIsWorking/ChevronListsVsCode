import * as vscode from 'vscode';
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { parseWordCountGoal, headerNameWithoutGoal } from './wordGoalParser';
import { getSectionRange } from './documentUtils';
import { findHeaderAbove } from './documentUtils';
import { itemWordCount } from './metadataStripper';

const wordGoalDiagCollection = vscode.languages.createDiagnosticCollection('chevron-lists-wordgoals');

/** Updates word-goal diagnostics for the given document */
export function updateWordGoalDiagnostics(document: vscode.TextDocument, prefix: string): void {
    if (document.languageId !== 'markdown') { return; }
    const diagnostics: vscode.Diagnostic[] = [];

    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text;
        if (!isHeader(text)) { continue; }
        const goal = parseWordCountGoal(text);
        if (goal === null) { continue; }

        const [start, end] = getSectionRange(document, i);
        let words = 0;
        for (let j = start + 1; j <= end; j++) {
            const line    = document.lineAt(j).text;
            const bullet  = parseBullet(line, prefix);
            const numbered = parseNumbered(line);
            const content  = bullet?.content ?? numbered?.content ?? null;
            if (content) { words += itemWordCount(content); }
        }

        if (words < goal) {
            const d = new vscode.Diagnostic(
                document.lineAt(i).range,
                `Word count goal not met: ${words}/${goal} words`,
                vscode.DiagnosticSeverity.Information
            );
            d.source = 'Chevron Lists';
            d.code   = 'word-goal';
            diagnostics.push(d);
        }
    }
    wordGoalDiagCollection.set(document.uri, diagnostics);
}

export function getWordGoalDiagCollection(): vscode.DiagnosticCollection {
    return wordGoalDiagCollection;
}

/** Command: sets or updates the ==N goal on the nearest section header */
export async function onSetWordCountGoal(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) {
        vscode.window.showInformationMessage('CL: No section header found at cursor');
        return;
    }

    const headerText = doc.lineAt(headerLine).text;
    const current    = parseWordCountGoal(headerText);
    const cleanName  = headerNameWithoutGoal(headerText);

    const input = await vscode.window.showInputBox({
        prompt:      `Set word count goal for "${cleanName}"`,
        value:       current !== null ? String(current) : '',
        placeHolder: 'e.g. 500 (leave blank to remove goal)',
    });

    if (input === undefined) { return; }

    await editor.edit(eb => {
        const range   = doc.lineAt(headerLine).range;
        const newText = input.trim()
            ? `> ${cleanName} ==${input.trim()}`
            : `> ${cleanName}`;
        eb.replace(range, newText);
    });
}
