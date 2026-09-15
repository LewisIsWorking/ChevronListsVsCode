import * as vscode from 'vscode';
import { formatDate } from './patterns';

/**
 * Command: inserts today's date as @YYYY-MM-DD at every cursor, replacing any
 * selected text, as typing would. It used to insert beside the primary
 * cursor only, leaving a selection in place and ignoring other cursors.
 */
export async function onInsertDateStamp(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const stamp = `@${formatDate(new Date())}`;
    // Each cursor ends up after its stamp: the editor moves cursors with the edit.
    await editor.edit(eb => {
        for (const selection of editor.selections) { eb.replace(selection, stamp); }
    });
}
