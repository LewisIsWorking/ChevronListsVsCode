import * as vscode from 'vscode';
import { isHeader } from './patterns';
import { getSectionRange } from './documentUtils';
import { wholeLineRange } from './lineEdits';

const LOCKED_MARKER = '>> [locked]';

/** Pure: returns the line index of the [locked] marker in a section, or -1 */
export function findLockedMarker(doc: vscode.TextDocument, headerLine: number): number {
    const [, end] = getSectionRange(doc, headerLine);
    for (let i = headerLine + 1; i <= end; i++) {
        if (doc.lineAt(i).text.trim() === LOCKED_MARKER) { return i; }
    }
    return -1;
}

/** The line of the first header whose text is exactly `headerText`, or -1 */
function findHeaderByText(doc: vscode.TextDocument, headerText: string): number {
    for (let i = 0; i < doc.lineCount; i++) {
        if (doc.lineAt(i).text === headerText) { return i; }
    }
    return -1;
}

/** Registers the lock enforcement listener */
export function registerLockEnforcement(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument(event => {
            const doc = event.document;
            if (doc.languageId !== 'markdown') { return; }

            // Find any locked sections
            for (let i = 0; i < doc.lineCount; i++) {
                if (!isHeader(doc.lineAt(i).text)) { continue; }
                const lockedAt = findLockedMarker(doc, i);
                if (lockedAt < 0) { continue; }

                const headerText  = doc.lineAt(i).text;
                const sectionName = headerText.replace(/^> /, '').trim();
                vscode.window.showWarningMessage(
                    `CL: "${sectionName}" is locked — use CL: Unlock Section to edit it`,
                    'Unlock Section'
                ).then(choice => {
                    if (choice !== 'Unlock Section') { return; }
                    // Look for the marker again now: the document may have changed while
                    // the warning was showing, and the active editor may be a different
                    // file. Deleting line `lockedAt` from the active editor did both wrong.
                    const headerLine = findHeaderByText(doc, headerText);
                    const markerLine = headerLine >= 0 ? findLockedMarker(doc, headerLine) : -1;
                    if (markerLine < 0) { return; }
                    const unlock = new vscode.WorkspaceEdit();
                    unlock.delete(doc.uri, wholeLineRange(doc, markerLine));
                    return vscode.workspace.applyEdit(unlock);
                });
                break; // warn once per save
            }
        })
    );
}
