import * as vscode from 'vscode';
import { isHeader, similarity } from './patterns';

interface SimilarPair extends vscode.QuickPickItem { lineA: number; lineB: number; }

/** Command: flags section pairs with similar names as possible duplicates */
export async function onFindSimilarSections(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const doc = editor.document;
    const headers: Array<{ name: string; line: number }> = [];
    for (let i = 0; i < doc.lineCount; i++) {
        if (isHeader(doc.lineAt(i).text)) {
            headers.push({ name: doc.lineAt(i).text.replace(/^> /, '').trim(), line: i });
        }
    }
    if (headers.length < 2) {
        vscode.window.showInformationMessage('CL: Need at least 2 sections to compare');
        return;
    }
    const pairs: SimilarPair[] = [];
    for (let i = 0; i < headers.length; i++) {
        for (let j = i + 1; j < headers.length; j++) {
            const sim = similarity(headers[i].name, headers[j].name);
            if (sim >= 0.7 && sim < 1) {
                pairs.push({
                    label:       `$(warning) "${headers[i].name}" ↔ "${headers[j].name}"`,
                    description: `${Math.round(sim * 100)}% similar`,
                    lineA:       headers[i].line,
                    lineB:       headers[j].line,
                });
            }
        }
    }
    if (pairs.length === 0) {
        vscode.window.showInformationMessage('CL: No similar section names found');
        return;
    }
    const pick = await vscode.window.showQuickPick(pairs, { placeHolder: `${pairs.length} similar section pair${pairs.length === 1 ? '' : 's'} found` });
    if (!pick) { return; }
    const pos = new vscode.Position(pick.lineA, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}
