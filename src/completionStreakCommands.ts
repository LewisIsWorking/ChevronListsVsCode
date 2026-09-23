import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { parseCheck } from './checkParser';
import { getSectionRange } from './documentUtils';

interface StreakItem extends vscode.QuickPickItem { lineIndex: number; total: number; }

/** Command: shows all sections where every checkbox item is [x] done */
export async function onShowCompletionStreak(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const completed: StreakItem[] = [];

    for (let i = 0; i < doc.lineCount; i++) {
        if (!isHeader(doc.lineAt(i).text)) { continue; }
        const name    = doc.lineAt(i).text.replace(/^> /, '');
        const [, end] = getSectionRange(doc, i);
        let done = 0, total = 0;
        for (let j = i + 1; j <= end; j++) {
            const t = doc.lineAt(j).text;
            const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
            if (!content) { continue; }
            const check = parseCheck(content);
            if (!check) { continue; }
            total++;
            if (check.state === 'done') { done++; }
        }
        if (total > 0 && done === total) {
            completed.push({
                label:       `$(pass-filled) ${name}`,
                description: `${total} item${total === 1 ? '' : 's'} - all done`,
                lineIndex:   i,
                total,
            });
        }
    }

    if (completed.length === 0) {
        vscode.window.showInformationMessage('CL: No fully-completed sections found');
        return;
    }

    const pick        = vscode.window.createQuickPick<StreakItem>();
    pick.items        = completed;
    pick.placeholder  = `${completed.length} fully-completed section${completed.length === 1 ? '' : 's'} 🎉`;
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
