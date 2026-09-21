import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { extractTags } from './tagParser';

/** Command: opens a side panel with a workspace-wide tag report */
export async function onShowTagReportWorkspace(): Promise<void> {
    const { prefix } = getConfig();
    const files      = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
    const tagMap     = new Map<string, Map<string, number[]>>();

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'CL: Building tag report…', cancellable: false },
        async () => {
            for (const uri of files) {
                const doc      = await vscode.workspace.openTextDocument(uri);
                // The workspace-relative path, not the base name: two notes.md files in
                // different folders used to be reported as one file with both counts.
                const fileName = vscode.workspace.asRelativePath(uri);
                for (let i = 0; i < doc.lineCount; i++) {
                    const t = doc.lineAt(i).text;
                    const bullet  = parseBullet(t, prefix);
                    const numbered = parseNumbered(t);
                    const content  = bullet?.content ?? numbered?.content ?? null;
                    if (!content) { continue; }
                    for (const tag of extractTags(content)) {
                        if (!tagMap.has(tag)) { tagMap.set(tag, new Map()); }
                        const fm = tagMap.get(tag)!;
                        if (!fm.has(fileName)) { fm.set(fileName, []); }
                        fm.get(fileName)!.push(i);
                    }
                }
            }
        }
    );

    if (tagMap.size === 0) {
        vscode.window.showInformationMessage('CL: No #tags found in workspace');
        return;
    }

    const sorted = [...tagMap.entries()].sort((a, b) => {
        const countA = [...a[1].values()].reduce((s, v) => s + v.length, 0);
        const countB = [...b[1].values()].reduce((s, v) => s + v.length, 0);
        return countB - countA;
    });

    const lines = sorted.map(([tag, fileMap]) => {
        const total   = [...fileMap.values()].reduce((s, v) => s + v.length, 0);
        const fileList = [...fileMap.entries()]
            .map(([f, lines]) => `  - ${f}: ${lines.length} item${lines.length === 1 ? '' : 's'}`)
            .join('\n');
        return `## #${tag} (${total} total)\n\n${fileList}`;
    }).join('\n\n');

    const content = `# Tag Report — Workspace\n\n${tagMap.size} unique tags across ${files.length} files\n\n${lines}`;
    const mdDoc   = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
    await vscode.window.showTextDocument(mdDoc, vscode.ViewColumn.Beside);
}
