import * as vscode from 'vscode';
import { getConfig } from './config';
import { computeFileStats } from './statistics';

function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function card(label: string, value: string | number, sub = ''): string {
    return `<div class="card"><div class="label">${label}</div><div class="value">${value}</div>${sub ? `<div class="sub">${escHtml(sub)}</div>` : ''}</div>`;
}

function goalBar(done: number, goal: number): string {
    const pct   = Math.min(done / goal, 1);
    const bars  = Math.round(pct * 10);
    const color = pct >= 1 ? '#98C379' : pct >= 0.7 ? '#E5C07B' : '#E06C75';
    return `<span style="color:${color}">${'▓'.repeat(bars)}${'░'.repeat(10 - bars)}</span> ${done}/${goal}`;
}

function buildHtml(stats: ReturnType<typeof computeFileStats>, fileName: string): string {
    const completionPct = stats.totalChecks > 0
        ? ` (${Math.round((stats.totalDone / stats.totalChecks) * 100)}%)`
        : '';

    const summaryCards = [
        card('Sections',           stats.totalSections),
        card('Total Items',        stats.totalItems),
        card('Total Words',        stats.totalWords),
        card('Done / Total',       `${stats.totalDone}/${stats.totalChecks}${completionPct}`),
        card('Total Tags',         stats.totalTags),
        card('Avg Items / Section',stats.avgItems.toFixed(1)),
        card('Colour Labelled',    stats.totalColoured),
        card('Flagged (?)',         stats.totalFlagged),
        card('Commented (//)',     stats.totalCommented),
        card('Stamped (@created)', stats.totalStamped),
        card('Most Items',         stats.mostPopulated?.itemCount ?? ' - ', stats.mostPopulated?.name ?? ''),
        card('Fewest Items',       stats.leastPopulated?.itemCount ?? ' - ', stats.leastPopulated?.name ?? ''),
    ].join('');

    const rows = stats.sections.map(s => {
        const done    = s.total > 0 ? `${s.done}/${s.total}` : ' - ';
        const goalCell = s.wordGoal !== null ? goalBar(s.wordCount, s.wordGoal) : ' - ';
        return `<tr>
            <td>${escHtml(s.name)}</td>
            <td>${s.itemCount}</td>
            <td>${s.wordCount}</td>
            <td>${done}</td>
            <td>${s.tagCount}</td>
            <td>${goalCell}</td>
            <td>${s.coloured > 0 ? s.coloured : ''}</td>
            <td>${s.flagged  > 0 ? `❓${s.flagged}` : ''}</td>
            <td>${s.commented > 0 ? `💬${s.commented}` : ''}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>Chevron Lists Statistics</title>
<style>
  body  { font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:1.5rem; }
  h1    { font-size:1.2rem;margin-bottom:1rem;color:var(--vscode-textLink-foreground); }
  .grid { display:grid;grid-template-columns:repeat(4,1fr);gap:0.75rem;margin-bottom:1.5rem; }
  .card { background:var(--vscode-editor-inactiveSelectionBackground);border-radius:6px;padding:0.6rem 0.8rem; }
  .card .label { font-size:0.7rem;opacity:0.7;margin-bottom:0.2rem; }
  .card .value { font-size:1.3rem;font-weight:bold; }
  .card .sub   { font-size:0.7rem;opacity:0.6;margin-top:0.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
  table { width:100%;border-collapse:collapse; }
  th    { text-align:left;padding:0.4rem 0.5rem;border-bottom:1px solid var(--vscode-panel-border);font-size:0.75rem;opacity:0.7; }
  td    { padding:0.3rem 0.5rem;border-bottom:1px solid var(--vscode-panel-border);font-size:0.8rem; }
  tr:hover td { background:var(--vscode-list-hoverBackground); }
</style>
</head><body>
<h1>📊 ${escHtml(fileName)}</h1>
<div class="grid">${summaryCards}</div>
<table>
  <thead><tr><th>Section</th><th>Items</th><th>Words</th><th>Done</th><th>Tags</th><th>Goal</th><th>🎨</th><th>❓</th><th>💬</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;
}

let panel: vscode.WebviewPanel | undefined;

/** Shows the statistics panel for the active markdown document */
export function onShowStatistics(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
        vscode.window.showInformationMessage('CL: Open a markdown file first');
        return;
    }
    const { prefix } = getConfig();
    const stats      = computeFileStats(editor.document, prefix);
    const fileName   = editor.document.fileName.split(/[\\/]/).pop() ?? 'file';

    if (panel) { panel.reveal(); }
    else {
        panel = vscode.window.createWebviewPanel(
            'chevron-lists.statistics', 'CL: Statistics',
            vscode.ViewColumn.Beside, { enableScripts: false }
        );
        panel.onDidDispose(() => { panel = undefined; });
    }
    panel.webview.html = buildHtml(stats, fileName);
}
