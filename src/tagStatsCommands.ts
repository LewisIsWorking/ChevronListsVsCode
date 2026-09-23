import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { collectTagStats, type TagStat } from './patterns';
import { escHtml } from './htmlExporter';

function buildTagStatsHtml(stats: TagStat[], fileName: string): string {
    const rows = stats.map(s => {
        const pct = Math.round((s.done / s.total) * 100); // every listed entry has at least one item
        const bar = `<div class="bar" style="width:${pct}%"></div>`;
        return `<tr><td>#${escHtml(s.tag)}</td><td>${s.total}</td><td>${s.done}</td><td><div class="bar-wrap">${bar}</div></td><td>${pct}%</td></tr>`;
    }).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Tag Stats</title>
<style>
body{font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-foreground);padding:1rem}
h1{font-size:.9rem;opacity:.6;margin-bottom:1rem}
table{border-collapse:collapse;width:100%;font-size:.85rem}
th{text-align:left;padding:.3rem .6rem;opacity:.5;font-weight:normal;border-bottom:1px solid var(--vscode-widget-border,#333)}
td{padding:.3rem .6rem;border-bottom:1px solid var(--vscode-widget-border,#222)}
td:first-child{color:#A855F7;font-weight:bold}
.bar-wrap{background:var(--vscode-editor-inactiveSelectionBackground);border-radius:3px;height:8px;width:120px}
.bar{background:#84CC16;border-radius:3px;height:8px;transition:width .3s}
</style></head><body>
<h1>🏷 Tag Stats - ${escHtml(fileName)}</h1>
${stats.length === 0 ? '<p style="opacity:.5">No tags found in this file</p>' : `
<table><thead><tr><th>Tag</th><th>Items</th><th>Done</th><th>Progress</th><th>%</th></tr></thead>
<tbody>${rows}</tbody></table>`}
</body></html>`;
}

let tagStatsPanel: vscode.WebviewPanel | undefined;

/** Command: shows a tag stats webview for the current file */
export async function onShowTagStats(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const fileName   = path.basename(doc.fileName);
    const lines      = Array.from({ length: doc.lineCount }, (_, i) => ({ text: doc.lineAt(i).text }));
    const stats      = collectTagStats(lines, prefix);

    if (tagStatsPanel) { tagStatsPanel.reveal(); }
    else {
        tagStatsPanel = vscode.window.createWebviewPanel(
            'chevron-lists.tagStats', 'CL: Tag Stats',
            vscode.ViewColumn.Beside, { enableScripts: false }
        );
        tagStatsPanel.onDidDispose(() => { tagStatsPanel = undefined; });
    }
    tagStatsPanel.webview.html = buildTagStatsHtml(stats, fileName);
}
