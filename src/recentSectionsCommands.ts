import * as vscode from 'vscode';
import { isHeader } from './patterns';
import { getJumpHistory } from './jumpHistory';

interface SectionPickItem extends vscode.QuickPickItem { line: number; }

/** Command: shows recently visited sections from jump history as a quick pick */
export async function onShowRecentSections(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc     = editor.document;
    const history = getJumpHistory(doc.uri.toString());

    if (history.length === 0) {
        vscode.window.showInformationMessage('CL: No navigation history yet - use Ctrl+Alt+Down/Up to build history');
        return;
    }

    // Map each history position to its nearest header above
    const seen    = new Set<number>();
    const sections: SectionPickItem[] = [];

    for (const pos of [...history].reverse()) {
        let headerLine = -1;
        for (let i = pos.line; i >= 0; i--) {
            if (isHeader(doc.lineAt(i).text)) { headerLine = i; break; }
        }
        if (headerLine < 0 || seen.has(headerLine)) { continue; }
        seen.add(headerLine);
        sections.push({
            label:       doc.lineAt(headerLine).text.replace(/^> /, ''),
            description: `Line ${headerLine + 1}`,
            line:        headerLine,
        });
    }

    if (sections.length === 0) {
        vscode.window.showInformationMessage('CL: No section history found');
        return;
    }

    const pick        = vscode.window.createQuickPick<SectionPickItem>();
    pick.items        = sections;
    pick.placeholder  = 'Recently visited sections';
    const originalPos = editor.selection.active;
    pick.onDidChangeActive(active => {
        if (!active[0]) { return; }
        const pos = new vscode.Position(active[0].line, 0);
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
