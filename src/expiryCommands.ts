import * as vscode from 'vscode';
import { getConfig } from './config';
import { collectExpiredItems } from './expiryParser';

interface ExpiredPickItem extends vscode.QuickPickItem { lineIndex: number; }

/** Command: shows all expired items in the current file */
export async function onShowExpiredItems(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const expired    = collectExpiredItems(editor.document, prefix);
    if (expired.length === 0) {
        vscode.window.showInformationMessage('CL: No expired items found (@expires:YYYY-MM-DD)');
        return;
    }
    const pick        = vscode.window.createQuickPick<ExpiredPickItem>();
    pick.items        = expired.map(e => ({
        label:       `$(warning) ${e.content}`,
        description: `${e.section} - expired ${e.dateStr}`,
        lineIndex:   e.line,
    }));
    pick.placeholder  = `${expired.length} expired item${expired.length === 1 ? '' : 's'}`;
    const originalPos = editor.selection.active;
    pick.onDidChangeActive(active => {
        if (!active[0]) { return; }
        const pos = new vscode.Position(active[0].lineIndex, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    });
    pick.onDidAccept(() => { pick.hide(); });
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) { editor.selection = new vscode.Selection(originalPos, originalPos); }
        pick.dispose();
    });
    pick.show();
}
