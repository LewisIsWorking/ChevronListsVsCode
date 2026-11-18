import * as vscode from 'vscode';
import { isHeader } from './patterns';
import { getSectionRange } from './documentUtils';
import { wholeLineRange } from './lineEdits';

const LOCKED_MARKER = '>> [locked]';
const FROZEN_MARKER = '>> [frozen]';

/** Pure: returns the line index of the [locked] marker in a section, or -1 */
export function findLockedMarker(doc: vscode.TextDocument, headerLine: number): number {
    const [, end] = getSectionRange(doc, headerLine);
    for (let i = headerLine + 1; i <= end; i++) {
        if (doc.lineAt(i).text.trim() === LOCKED_MARKER) { return i; }
    }
    return -1;
}

/** Pure: returns the line index of the [frozen] marker in a section, or -1 */
export function findFrozenMarker(doc: vscode.TextDocument, headerLine: number): number {
    const [, end] = getSectionRange(doc, headerLine);
    for (let i = headerLine + 1; i <= end; i++) {
        if (doc.lineAt(i).text.trim() === FROZEN_MARKER) { return i; }
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

/** Registers the lock and freeze enforcement listener */
export function registerLockEnforcement(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument(event => {
            const doc = event.document;
            if (doc.languageId !== 'markdown') { return; }

            // Find any locked or frozen sections
            for (let i = 0; i < doc.lineCount; i++) {
                if (!isHeader(doc.lineAt(i).text)) { continue; }
                const lockedAt = findLockedMarker(doc, i);
                if (lockedAt >= 0) {
                    const headerText  = doc.lineAt(i).text;
                    const sectionName = headerText.replace(/^> /, '').trim();
                    vscode.window.showWarningMessage(
                        `CL: "${sectionName}" is locked - use CL: Unlock Section to edit it`,
                        'Unlock Section'
                    ).then(choice => {
                        if (choice !== 'Unlock Section') { return; }
                        const headerLine = findHeaderByText(doc, headerText);
                        const markerLine = headerLine >= 0 ? findLockedMarker(doc, headerLine) : -1;
                        if (markerLine < 0) { return; }
                        const unlock = new vscode.WorkspaceEdit();
                        unlock.delete(doc.uri, wholeLineRange(doc, markerLine));
                        return vscode.workspace.applyEdit(unlock);
                    });
                    break; // warn once per save
                }
                const frozenAt = findFrozenMarker(doc, i);
                if (frozenAt >= 0) {
                    const headerText  = doc.lineAt(i).text;
                    const sectionName = headerText.replace(/^> /, '').trim();
                    vscode.window.showWarningMessage(
                        `CL: "${sectionName}" is frozen - use CL: Unfreeze Section to edit it`,
                        'Unfreeze Section'
                    ).then(choice => {
                        if (choice !== 'Unfreeze Section') { return; }
                        const headerLine = findHeaderByText(doc, headerText);
                        const markerLine = headerLine >= 0 ? findFrozenMarker(doc, headerLine) : -1;
                        if (markerLine < 0) { return; }
                        const unfreeze = new vscode.WorkspaceEdit();
                        unfreeze.delete(doc.uri, wholeLineRange(doc, markerLine));
                        return vscode.workspace.applyEdit(unfreeze);
                    });
                    break; // warn once per save
                }
            }
        })
    );
}
