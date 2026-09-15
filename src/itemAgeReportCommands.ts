import * as vscode from 'vscode';
import { getConfig } from './config';
import { collectAgedItems } from './patterns';
import type { AgedItem } from './patterns';

function buildAgeReportHtml(items: AgedItem[], fileName: string): string {
    const rows = items.slice(0, 50).map(item => {
        const ageLabel = item.age === 1 ? '1 day' : `${item.age} days`;
        const colour   = item.age >= 90 ? '#E06C75' : item.age >= 30 ? '#E5C07B' : '#98C379';
        return `<tr>
            <td style="color:${colour};font-weight:bold">${ageLabel}</td>
            <td style="opacity:.6">${item.section}</td>
            <td>${item.content.slice(0, 80)}${item.content.length > 80 ? '…' : ''}</td>
        </tr>`;
    }).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Age Report</title>
<style>
body{font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-foreground);padding:1rem}
h1{font-size:.9rem;opacity:.6;margin-bottom:1rem}
table{border-collapse:collapse;width:100%;font-size:.82rem}
th{text-align:left;padding:.3rem .6rem;opacity:.5;font-weight:normal;border-bottom:1px solid var(--vscode-widget-border,#333)}
td{padding:.3rem .6rem;border-bottom:1px solid var(--vscode-widget-border,#222);vertical-align:top}
</style></head><body>
<h1>🕰 Item Age Report — ${fileName} (oldest ${Math.min(items.length,50)} of ${items.length})</h1>
${items.length === 0
    ? '<p style="opacity:.5">No items with @created: dates found</p>'
    : `<table><thead><tr><th>Age</th><th>Section</th><th>Content</th></tr></thead><tbody>${rows}</tbody></table>`}
</body></html>`;
}

let agePanel: vscode.WebviewPanel | undefined;

/** Command: shows an age report webview for the current file */
export async function onShowItemAgeReport(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const fileName   = doc.fileName.split(/[\\/]/).pop() ?? 'file';
    const lines      = Array.from({ length: doc.lineCount }, (_, i) => ({ text: doc.lineAt(i).text }));
    const items      = collectAgedItems(lines, prefix, new Date());

    if (agePanel) { agePanel.reveal(); }
    else {
        agePanel = vscode.window.createWebviewPanel(
            'chevron-lists.ageReport', 'CL: Item Age Report',
            vscode.ViewColumn.Beside, { enableScripts: false }
        );
        agePanel.onDidDispose(() => { agePanel = undefined; });
    }
    agePanel.webview.html = buildAgeReportHtml(items, fileName);
}
