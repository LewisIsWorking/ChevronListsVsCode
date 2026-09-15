import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { extractTags } from './tagParser';
import { parseCheck } from './checkParser';
import { getSectionRange } from './documentUtils';
import { itemWordCount } from './metadataStripper';

/** Command: shows aggregated statistics across all markdown files in the workspace */
export async function onShowWorkspaceStatistics(): Promise<void> {
    const { prefix } = getConfig();
    const files      = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');

    if (files.length === 0) {
        vscode.window.showInformationMessage('CL: No markdown files found in workspace');
        return;
    }

    let totalFiles = 0, totalSections = 0, totalItems = 0;
    let totalWords = 0, totalDone = 0, totalChecks = 0, totalTags = 0;

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'CL: Scanning workspace...', cancellable: false },
        async () => {
            for (const uri of files) {
                const doc = await vscode.workspace.openTextDocument(uri);
                totalFiles++;
                for (let i = 0; i < doc.lineCount; i++) {
                    const text = doc.lineAt(i).text;
                    if (isHeader(text)) { totalSections++; continue; }
                    const bullet  = parseBullet(text, prefix);
                    const numbered = parseNumbered(text);
                    const content  = bullet?.content ?? numbered?.content ?? null;
                    if (!content) { continue; }
                    totalItems++;
                    totalWords += itemWordCount(content);
                    totalTags  += extractTags(content).length;
                    const check = parseCheck(content);
                    if (check) { totalChecks++; if (check.state === 'done') { totalDone++; } }
                }
            }
        }
    );

    const completionPct = totalChecks > 0 ? `${Math.round((totalDone / totalChecks) * 100)}%` : 'n/a';
    const lines = [
        `# Workspace Statistics`,
        ``,
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Files  | ${totalFiles} |`,
        `| Sections | ${totalSections} |`,
        `| Items  | ${totalItems} |`,
        `| Words  | ${totalWords} |`,
        `| Tags   | ${totalTags} |`,
        `| Completion | ${totalDone}/${totalChecks} (${completionPct}) |`,
    ];
    const mdDoc = await vscode.workspace.openTextDocument({ content: lines.join('\n'), language: 'markdown' });
    await vscode.window.showTextDocument(mdDoc, vscode.ViewColumn.Beside);
}
