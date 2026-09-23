import * as vscode from 'vscode';
import { isHeader } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';

const DIM_DECORATION = vscode.window.createTextEditorDecorationType({
    opacity: '0.35',
});

let focusModeActive = false;

/** Toggles focus mode - dims all sections except the one the cursor is in */
export async function onToggleFocusMode(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    focusModeActive = !focusModeActive;
    if (focusModeActive) {
        updateFocusDecoration(editor);
        vscode.window.showInformationMessage('CL: Focus mode on - other sections dimmed');
    } else {
        editor.setDecorations(DIM_DECORATION, []);
        vscode.window.showInformationMessage('CL: Focus mode off');
    }
}

/** Updates dim decorations when cursor moves (call from editorRefresh) */
export function updateFocusDecoration(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== 'markdown' || !focusModeActive) {
        editor?.setDecorations(DIM_DECORATION, []);
        return;
    }
    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    const dimRanges: vscode.Range[] = [];

    for (let i = 0; i < doc.lineCount; i++) {
        if (!isHeader(doc.lineAt(i).text)) { continue; }
        if (i === headerLine) { continue; }
        const [, end] = getSectionRange(doc, i);
        dimRanges.push(new vscode.Range(i, 0, end, doc.lineAt(end).text.length));
    }
    editor.setDecorations(DIM_DECORATION, dimRanges);
}

/** Returns whether focus mode is currently active */
export function isFocusModeActive(): boolean { return focusModeActive; }
