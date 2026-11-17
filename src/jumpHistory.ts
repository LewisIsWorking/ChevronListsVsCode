import * as vscode from 'vscode';

const MAX_HISTORY = 10;

/** A jump history entry: the cursor position plus the line text at push time. */
export interface JumpHistoryEntry {
    line: number;
    character: number;
    /** Line text when the entry was pushed, used to re-anchor after edits. */
    text: string;
}

/** Per-file jump history stack - stores positions before each navigation */
const history = new Map<string, JumpHistoryEntry[]>();

/** Pushes the current cursor position onto the history stack for this file */
export function pushJumpHistory(editor: vscode.TextEditor): void {
    const key  = editor.document.uri.toString();
    const stack = history.get(key) ?? [];
    const pos = editor.selection.active;
    let text = '';
    try { text = editor.document.lineAt(pos.line).text; } catch { text = ''; }
    stack.push({ line: pos.line, character: pos.character, text });
    if (stack.length > MAX_HISTORY) { stack.shift(); }
    history.set(key, stack);
}

/**
 * Resolves an entry against the current document. If edits moved the line
 * since the push, the nearest line with matching text wins (ties go to the
 * line below, the common case of inserted lines pushing content down).
 * Falls back to the stored position clamped into the document.
 */
export function resolveJumpEntry(doc: vscode.TextDocument, entry: JumpHistoryEntry): vscode.Position {
    const lastLine = Math.max(0, doc.lineCount - 1);
    const line = Math.min(Math.max(0, entry.line), lastLine);
    const clampChar = (l: number) => Math.min(Math.max(0, entry.character), doc.lineAt(l).text.length);
    if (doc.lineAt(line).text === entry.text) {
        return new vscode.Position(line, clampChar(line));
    }
    for (let d = 1; d < doc.lineCount; d++) {
        const below = line + d;
        const above = line - d;
        if (below <= lastLine && doc.lineAt(below).text === entry.text) {
            return new vscode.Position(below, clampChar(below));
        }
        if (above >= 0 && doc.lineAt(above).text === entry.text) {
            return new vscode.Position(above, clampChar(above));
        }
    }
    return new vscode.Position(line, clampChar(line));
}

/** Command: jumps back to the previous position in this file */
export async function onJumpBack(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const key   = editor.document.uri.toString();
    const stack = history.get(key);

    if (!stack || stack.length === 0) {
        vscode.window.showInformationMessage('CL: No jump history for this file');
        return;
    }

    const entry = stack.pop()!;
    history.set(key, stack);
    const pos = resolveJumpEntry(editor.document, entry);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/** Command: shows full jump history as a quick pick for direct navigation */
export async function onShowJumpHistory(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const key   = editor.document.uri.toString();
    const stack = history.get(key);

    if (!stack || stack.length === 0) {
        vscode.window.showInformationMessage('CL: No jump history for this file');
        return;
    }

    interface HistoryItem extends vscode.QuickPickItem { entry: JumpHistoryEntry; }
    const items: HistoryItem[] = [...stack].reverse().map((entry, i) => ({
        label:       `$(location) Line ${entry.line + 1}, Col ${entry.character + 1}`,
        description: i === 0 ? 'most recent' : `${i + 1} steps back`,
        entry,
    }));

    const pick = vscode.window.createQuickPick<HistoryItem>();
    pick.items       = items;
    pick.placeholder = 'Jump to a previous cursor position';

    const originalPos = editor.selection.active;
    pick.onDidChangeActive(active => {
        if (!active[0]) { return; }
        const p = resolveJumpEntry(editor.document, active[0].entry);
        editor.selection = new vscode.Selection(p, p);
        editor.revealRange(new vscode.Range(p, p), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    });
    pick.onDidAccept(() => {
        if (pick.activeItems[0]) {
            // Remove selected entry from history
            const idx = stack.indexOf(pick.activeItems[0].entry);
            if (idx >= 0) { stack.splice(idx, 1); history.set(key, stack); }
        }
        pick.hide();
    });
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) {
            editor.selection = new vscode.Selection(originalPos, originalPos);
        }
        pick.dispose();
    });
    pick.show();
}

/** Clears jump history when a file is closed */
export function clearJumpHistory(uri: vscode.Uri): void {
    history.delete(uri.toString());
}

/** Returns a read-only copy of the jump history for a given file URI */
export function getJumpHistory(uriKey: string): readonly JumpHistoryEntry[] {
    return history.get(uriKey) ?? [];
}
