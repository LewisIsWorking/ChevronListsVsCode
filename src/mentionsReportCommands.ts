import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { collectMentionStats } from './patterns';
import type { MentionStat } from './patterns';
import { escHtml } from './htmlExporter';

function buildMentionsHtml(stats: MentionStat[], fileName: string): string {
    const rows = stats.map(s => {
        const pct = Math.round((s.done / s.total) * 100); // every listed entry has at least one item
        const bar = `<div class="bar" style="width:${pct}%"></div>`;
        return `<tr><td>@${escHtml(s.name)}</td><td>${s.total}</td><td>${s.done}</td><td><div class="bar-wrap">${bar}</div></td><td>${pct}%</td></tr>`;
    }).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Mentions</title>
<style>
body{font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-foreground);padding:1rem}
h1{font-size:.9rem;opacity:.6;margin-bottom:1rem}
table{border-collapse:collapse;width:100%;font-size:.85rem}
th{text-align:left;padding:.3rem .6rem;opacity:.5;font-weight:normal;border-bottom:1px solid var(--vscode-widget-border,#333)}
td{padding:.3rem .6rem;border-bottom:1px solid var(--vscode-widget-border,#222)}
td:first-child{color:#84CC16;font-weight:bold}
.bar-wrap{background:var(--vscode-editor-inactiveSelectionBackground);border-radius:3px;height:8px;width:120px}
.bar{background:#A855F7;border-radius:3px;height:8px}
</style></head><body>
<h1>👤 Mentions Report — ${escHtml(fileName)}</h1>
${stats.length === 0 ? '<p style="opacity:.5">No @Mentions found</p>' : `
<table><thead><tr><th>Person</th><th>Items</th><th>Done</th><th>Progress</th><th>%</th></tr></thead>
<tbody>${rows}</tbody></table>`}
</body></html>`;
}

let mentionsPanel: vscode.WebviewPanel | undefined;

/** Command: shows a mentions report webview for the current file */
export async function onShowMentionsReport(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const fileName   = path.basename(doc.fileName);
    const lines      = Array.from({ length: doc.lineCount }, (_, i) => ({ text: doc.lineAt(i).text }));
    const stats      = collectMentionStats(lines, prefix);

    if (mentionsPanel) { mentionsPanel.reveal(); }
    else {
        mentionsPanel = vscode.window.createWebviewPanel(
            'chevron-lists.mentionsReport', 'CL: Mentions Report',
            vscode.ViewColumn.Beside, { enableScripts: false }
        );
        mentionsPanel.onDidDispose(() => { mentionsPanel = undefined; });
    }
    mentionsPanel.webview.html = buildMentionsHtml(stats, fileName);
}
