import * as vscode from 'vscode';
import { parseBullet, parseNumbered, todayDate } from './patterns';
import { getConfig } from './config';

let overdueBar: vscode.StatusBarItem | undefined;

/** Creates and returns the overdue status bar item (called from extension.ts activation) */
export function createOverdueStatusBar(): vscode.StatusBarItem {
    overdueBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -98);
    overdueBar.tooltip = 'CL: Overdue items - click to open Today View';
    overdueBar.command = 'chevron-lists.todayView';
    return overdueBar;
}

/** Updates the overdue status bar item for the active document */
export function updateOverdueStatusBar(editor: vscode.TextEditor | undefined): void {
    if (!overdueBar) { return; }
    if (!editor || editor.document.languageId !== 'markdown') {
        overdueBar.hide();
        return;
    }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const today      = todayDate();
    let   overdue    = 0;

    for (let i = 0; i < doc.lineCount; i++) {
        const text    = doc.lineAt(i).text;
        const content = parseBullet(text, prefix)?.content ?? parseNumbered(text)?.content ?? null;
        if (!content) { continue; }
        const m = content.match(/@(\d{4}-\d{2}-\d{2})/);
        if (m && m[1] < today) { overdue++; }
    }

    if (overdue === 0) { overdueBar.hide(); return; }
    overdueBar.text = `⚠ ${overdue} overdue`;
    overdueBar.show();
}
