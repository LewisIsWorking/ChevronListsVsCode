import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { parseBullet, parseNumbered, isHeader, todayDate } from './patterns';

interface TodayItem extends vscode.QuickPickItem {
    uri:       vscode.Uri;
    lineIndex: number;
    daysOverdue: number;
}

/** Command: shows all items due today or overdue across the workspace */
export async function onTodayView(): Promise<void> {
    const { prefix } = getConfig();
    const today      = todayDate();
    const files      = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
    const items: TodayItem[] = [];

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'CL: Today View - scanning…', cancellable: false },
        async () => {
            for (const uri of files) {
                const doc     = await vscode.workspace.openTextDocument(uri);
                const fname   = path.basename(uri.fsPath);
                let section   = '';
                for (let i = 0; i < doc.lineCount; i++) {
                    const text = doc.lineAt(i).text;
                    if (isHeader(text)) { section = text.replace(/^> /, '').trim(); continue; }
                    const bullet   = parseBullet(text, prefix);
                    const numbered = parseNumbered(text);
                    const content  = bullet?.content ?? numbered?.content ?? null;
                    if (!content) { continue; }
                    const m = content.match(/@(\d{4}-\d{2}-\d{2})/);
                    if (!m || m[1] > today) { continue; }
                    const daysOverdue = Math.floor(
                        (Date.parse(today) - Date.parse(m[1])) / 86400000
                    );
                    const label = daysOverdue === 0
                        ? `$(calendar) Today`
                        : `$(warning) ${daysOverdue}d overdue`;
                    items.push({
                        label:       `${label}  ${content.replace(/@\d{4}-\d{2}-\d{2}/, '').trim()}`,
                        description: `${fname} › ${section}`,
                        uri, lineIndex: i, daysOverdue,
                    });
                }
            }
        }
    );

    if (items.length === 0) {
        vscode.window.showInformationMessage('CL: Today View - nothing due today 🎉');
        return;
    }

    // Sort: overdue first (most overdue at top), then today
    items.sort((a, b) => b.daysOverdue - a.daysOverdue);

    const pick = vscode.window.createQuickPick<TodayItem>();
    pick.items       = items;
    pick.placeholder = `${items.length} item${items.length === 1 ? '' : 's'} due today or overdue`;
    pick.onDidAccept(async () => {
        const sel = pick.activeItems[0];
        if (!sel) { return; }
        pick.hide();
        const doc = await vscode.workspace.openTextDocument(sel.uri);
        const ed  = await vscode.window.showTextDocument(doc);
        const pos = new vscode.Position(sel.lineIndex, 0);
        ed.selection = new vscode.Selection(pos, pos);
        ed.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    });
    pick.onDidHide(() => pick.dispose());
    pick.show();
}
