import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { collectSectionCounts } from './patterns';
import type { SectionCount } from './patterns';
import { escHtml } from './htmlExporter';

function buildGrowthHtml(sections: SectionCount[], fileName: string): string {
    const max   = Math.max(...sections.map(s => s.count), 1);
    const rows  = sections.map(s => {
        const pct = Math.round((s.count / max) * 100);
        return `<div class="row"><div class="label" title="${escHtml(s.name)}">${escHtml(s.name.length > 28 ? s.name.slice(0, 27) + '…' : s.name)}</div>
<div class="bar-wrap"><div class="bar" style="width:${pct}%"></div></div>
<div class="count">${s.count}</div></div>`;
    }).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Growth</title>
<style>
body{font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-foreground);padding:1rem}
h1{font-size:.9rem;opacity:.6;margin-bottom:1rem}
.row{display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;font-size:.82rem}
.label{width:180px;flex-shrink:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;opacity:.8}
.bar-wrap{flex:1;background:var(--vscode-editor-inactiveSelectionBackground);border-radius:3px;height:10px}
.bar{background:#A855F7;border-radius:3px;height:10px;min-width:2px}
.count{width:30px;text-align:right;opacity:.5;font-size:.75rem}
</style></head><body>
<h1>📊 Section Growth — ${escHtml(fileName)}</h1>
${sections.length === 0 ? '<p style="opacity:.5">No sections found</p>' : rows}
</body></html>`;
}

let growthPanel: vscode.WebviewPanel | undefined;

/** Command: shows a bar chart of item count per section */
export async function onShowSectionGrowth(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const fileName   = path.basename(doc.fileName);
    const lines      = Array.from({ length: doc.lineCount }, (_, i) => ({ text: doc.lineAt(i).text }));
    const sections   = collectSectionCounts(lines, prefix);

    if (growthPanel) { growthPanel.reveal(); }
    else {
        growthPanel = vscode.window.createWebviewPanel(
            'chevron-lists.sectionGrowth', 'CL: Section Growth',
            vscode.ViewColumn.Beside, { enableScripts: false }
        );
        growthPanel.onDidDispose(() => { growthPanel = undefined; });
    }
    growthPanel.webview.html = buildGrowthHtml(sections, fileName);
}
