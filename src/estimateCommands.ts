import * as vscode from 'vscode';
import { getConfig } from './config';
import { collectEstimatedItems, totalEstimatedMinutes } from './estimateParser';

interface EstimatePickItem extends vscode.QuickPickItem { lineIndex: number; }

function formatTotal(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

/** Command: shows all estimated items sorted by duration */
export async function onShowTimeEstimates(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const items      = collectEstimatedItems(editor.document, prefix);

    if (items.length === 0) {
        vscode.window.showInformationMessage('CL: No time estimates found (use ~2h, ~30m, or ~1h30m in item content)');
        return;
    }

    const total = totalEstimatedMinutes(items);
    const pick  = vscode.window.createQuickPick<EstimatePickItem>();
    pick.items = items.map(i => ({
        label:       `$(clock) ~${i.estimate.display} - ${i.content}`,
        description: i.section,
        lineIndex:   i.line,
    }));
    pick.placeholder = `${items.length} estimated item${items.length === 1 ? '' : 's'} - total: ${formatTotal(total)}`;

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
