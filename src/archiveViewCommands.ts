import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange } from './documentUtils';

interface ArchiveItem extends vscode.QuickPickItem { lineIndex: number; }

/** Command: shows all items in the > Archive section as a reviewable quick pick */
export async function onShowArchive(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;

    // Find the Archive section
    let archiveLine = -1;
    for (let i = 0; i < doc.lineCount; i++) {
        if (doc.lineAt(i).text.toLowerCase().trim() === '> archive') { archiveLine = i; break; }
    }
    if (archiveLine < 0) {
        vscode.window.showInformationMessage('CL: No > Archive section found in this file');
        return;
    }

    const [, end]    = getSectionRange(doc, archiveLine);
    const items: ArchiveItem[] = [];

    for (let i = archiveLine + 1; i <= end; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const depth  = (bullet?.chevrons ?? numbered!.chevrons).length - 2;
        items.push({
            label:       `${'  '.repeat(depth)}$(archive) ${content.slice(0, 70)}`,
            description: `line ${i + 1}`,
            lineIndex:   i,
        });
    }

    if (items.length === 0) {
        vscode.window.showInformationMessage('CL: Archive section is empty');
        return;
    }

    const pick        = vscode.window.createQuickPick<ArchiveItem>();
    pick.items        = items;
    pick.placeholder  = `${items.length} archived item${items.length === 1 ? '' : 's'} — press Enter to jump`;
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
