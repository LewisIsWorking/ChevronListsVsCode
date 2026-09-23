import * as vscode from 'vscode';
import { getConfig } from './config';
import { checkLinesHealth } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';
import { stripAllMetadata } from './metadataStripper';
import { extractTags } from './tagParser';

/** Command: shows a health report for the current section */
export async function onSectionHealthCheck(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const sectionName = doc.lineAt(headerLine).text.replace(/^> /, '');
    const [, end]     = getSectionRange(doc, headerLine);
    const lines       = Array.from({ length: end - headerLine }, (_, k) => ({
        text: doc.lineAt(headerLine + 1 + k).text,
        index: headerLine + 1 + k,
    }));

    const issues = checkLinesHealth(lines, prefix, stripAllMetadata, extractTags);

    if (issues.length === 0) {
        vscode.window.showInformationMessage(`CL: "${sectionName}" - no health issues found ✅`);
        return;
    }

    interface IssueItem extends vscode.QuickPickItem { lineIndex: number; }
    const pick = vscode.window.createQuickPick<IssueItem>();
    pick.items = issues.map(i => ({
        label:       `$(warning) Line ${i.line + 1} - ${i.message}`,
        description: i.kind,
        lineIndex:   i.line,
    }));
    pick.placeholder = `${issues.length} issue${issues.length === 1 ? '' : 's'} in "${sectionName}"`;
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
            editor.selection = new vscode.Selection(originalPos, originalPos);
        }
        pick.dispose();
    });
    pick.show();
}
