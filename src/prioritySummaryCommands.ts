import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, isHeader } from './patterns';
import { parsePriority } from './priorityParser';
import { stripAllMetadata } from './metadataStripper';

interface PriorityItem extends vscode.QuickPickItem { lineIndex: number; }

/** Command: shows all priority items across the file, grouped by level */
export async function onShowPrioritySummary(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;

    const buckets: Record<number, Array<{ content: string; section: string; line: number }>> = {
        3: [], 2: [], 1: [],
    };
    let section = '';

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (isHeader(text)) { section = text.replace(/^> /, '').trim(); continue; }
        const content = parseBullet(text, prefix)?.content ?? parseNumbered(text)?.content ?? null;
        if (!content) { continue; }
        const level = parsePriority(content)?.level ?? 0;
        if (level > 0) { buckets[level].push({ content, section, line: i }); }
    }

    const total = buckets[3].length + buckets[2].length + buckets[1].length;
    if (total === 0) {
        vscode.window.showInformationMessage('CL: No priority items found (add !, !!, or !!! to items)');
        return;
    }

    const labels: Record<number, string> = { 3: '🔴 Urgent (!!!)', 2: '🟠 High (!!)', 1: '🟡 Normal (!)' };
    const items: PriorityItem[] = [];
    for (const level of [3, 2, 1]) {
        if (buckets[level].length === 0) { continue; }
        items.push({ label: labels[level], kind: vscode.QuickPickItemKind.Separator, lineIndex: -1 });
        for (const entry of buckets[level]) {
            const plain = stripAllMetadata(entry.content).slice(0, 65);
            items.push({ label: plain, description: entry.section, lineIndex: entry.line });
        }
    }

    const originalPos = editor.selection.active;
    const pick        = vscode.window.createQuickPick<PriorityItem>();
    pick.items        = items;
    pick.placeholder  = `${total} priority item${total === 1 ? '' : 's'} - press Enter to jump`;
    pick.onDidChangeActive(active => {
        if (!active[0] || active[0].lineIndex < 0) { return; }
        const pos = new vscode.Position(active[0].lineIndex, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    });
    pick.onDidAccept(() => { pick.hide(); });
    pick.onDidHide(() => {
        if (!pick.activeItems[0] || pick.activeItems[0].lineIndex < 0) {
            editor.selection = new vscode.Selection(originalPos, originalPos);
        }
        pick.dispose();
    });
    pick.show();
}
