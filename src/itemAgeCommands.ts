import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, todayDate } from './patterns';
import { collectAgedItems } from './itemAgeParser';

interface AgePickItem extends vscode.QuickPickItem { lineIndex: number; }

/** Command: stamps the item at the cursor with @created:today */
export async function onStampItem(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const text       = doc.lineAt(lineIndex).text;
    const bullet     = parseBullet(text, prefix);
    const numbered   = parseNumbered(text);
    if (!bullet && !numbered) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item to stamp it');
        return;
    }
    const today    = todayDate();
    const chevrons = bullet?.chevrons ?? numbered!.chevrons;
    const content  = bullet?.content  ?? numbered!.content;
    const num      = numbered?.num ?? null;
    if (content.includes('@created:')) {
        vscode.window.showInformationMessage('CL: Item already has a creation date');
        return;
    }
    const newContent = `${content} @created:${today}`;
    const newLine    = num !== null
        ? `${chevrons} ${num}. ${newContent}`
        : `${chevrons} ${prefix} ${newContent}`;
    await editor.edit(eb => eb.replace(doc.lineAt(lineIndex).range, newLine));
}

/** Command: shows all items with @created dates older than 30 days */
export async function onShowOldItems(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const allItems   = collectAgedItems(editor.document, prefix);
    const oldItems   = allItems.filter(i => i.ageDays >= 30);

    if (oldItems.length === 0) {
        vscode.window.showInformationMessage('CL: No items older than 30 days found');
        return;
    }

    const pick = vscode.window.createQuickPick<AgePickItem>();
    pick.items = oldItems.map(i => ({
        label:       `$(history) ${i.content}`,
        description: `${i.section} - ${i.ageDays} days old (${i.dateStr})`,
        lineIndex:   i.line,
    }));
    pick.placeholder = `${oldItems.length} item${oldItems.length === 1 ? '' : 's'} older than 30 days`;
    const originalPos = editor.selection.active;
    pick.onDidChangeActive(active => {
        if (!active[0]) { return; }
        const pos = new vscode.Position(active[0].lineIndex, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    });
    pick.onDidAccept(() => { pick.hide(); });
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) {
            const pos = new vscode.Position(originalPos.line, originalPos.character);
            editor.selection = new vscode.Selection(pos, pos);
        }
        pick.dispose();
    });
    pick.show();
}
