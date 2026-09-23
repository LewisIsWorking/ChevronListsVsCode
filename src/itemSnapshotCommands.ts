import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, buildLineDiff } from './patterns';

let itemSnapshot: string | undefined;

/** Command: snapshots the item content at the cursor */
export async function onSnapshotItem(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const lineIndex  = editor.selection.active.line;
    const text       = editor.document.lineAt(lineIndex).text;
    const bullet     = parseBullet(text, prefix);
    const numbered   = parseNumbered(text);
    const content    = bullet?.content ?? numbered?.content ?? null;
    if (!content) { vscode.window.showInformationMessage('CL: Place cursor on a chevron item'); return; }
    itemSnapshot = content;
    vscode.window.showInformationMessage(`CL: Snapshot saved - "${content.slice(0, 50)}"`);
}

/** Command: shows a diff between the current item and the stored snapshot */
export async function onDiffItemWithSnapshot(): Promise<void> {
    if (!itemSnapshot) {
        vscode.window.showInformationMessage('CL: No snapshot stored - use CL: Snapshot Item first');
        return;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const lineIndex  = editor.selection.active.line;
    const text       = editor.document.lineAt(lineIndex).text;
    const bullet     = parseBullet(text, prefix);
    const numbered   = parseNumbered(text);
    const current    = bullet?.content ?? numbered?.content ?? null;
    if (!current) { vscode.window.showInformationMessage('CL: Place cursor on a chevron item'); return; }

    const content  = `# Item Snapshot Diff\n\n## Before\n\n${itemSnapshot}\n\n## After\n\n${current}\n\n## Changes\n\n${buildLineDiff(itemSnapshot, current)}`;
    const doc      = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
}
