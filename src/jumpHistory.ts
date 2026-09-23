import * as vscode from 'vscode';

const MAX_HISTORY = 10;

/** Per-file jump history stack - stores positions before each navigation */
const history = new Map<string, vscode.Position[]>();

/** Pushes the current cursor position onto the history stack for this file */
export function pushJumpHistory(editor: vscode.TextEditor): void {
    const key  = editor.document.uri.toString();
    const stack = history.get(key) ?? [];
    stack.push(editor.selection.active);
    if (stack.length > MAX_HISTORY) { stack.shift(); }
    history.set(key, stack);
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

    const pos = stack.pop()!;
    history.set(key, stack);
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

    interface HistoryItem extends vscode.QuickPickItem { pos: vscode.Position; }
    const items: HistoryItem[] = [...stack].reverse().map((pos, i) => ({
        label:       `$(location) Line ${pos.line + 1}, Col ${pos.character + 1}`,
        description: i === 0 ? 'most recent' : `${i + 1} steps back`,
        pos,
    }));

    const pick = vscode.window.createQuickPick<HistoryItem>();
    pick.items       = items;
    pick.placeholder = 'Jump to a previous cursor position';

    const originalPos = editor.selection.active;
    pick.onDidChangeActive(active => {
        if (!active[0]) { return; }
        const p = active[0].pos;
        editor.selection = new vscode.Selection(p, p);
        editor.revealRange(new vscode.Range(p, p), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    });
    pick.onDidAccept(() => {
        if (pick.activeItems[0]) {
            // Remove selected entry from history
            const idx = stack.indexOf(pick.activeItems[0].pos);
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
export function getJumpHistory(uriKey: string): readonly vscode.Position[] {
    return history.get(uriKey) ?? [];
}
