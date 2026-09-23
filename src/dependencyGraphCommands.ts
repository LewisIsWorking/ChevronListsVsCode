import * as vscode from 'vscode';
import { isHeader } from './patterns';

interface DepEdge { from: string; to: string; }

function collectDependencies(doc: vscode.TextDocument): DepEdge[] {
    const edges: DepEdge[] = [];
    let currentSection = '';
    const DEPENDS_RE = /^>>depends:(.+)$/;
    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (isHeader(text)) { currentSection = text.replace(/^> /, '').trim(); continue; }
        const m = text.match(DEPENDS_RE);
        if (m && currentSection) {
            edges.push({ from: currentSection, to: m[1].trim() });
        }
    }
    return edges;
}

function buildGraphHtml(edges: DepEdge[], fileName: string): string {
    const nodes = [...new Set(edges.flatMap(e => [e.from, e.to]))];
    const angle = (i: number) => (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
    const cx = 340, cy = 240, r = 180;
    const pos = Object.fromEntries(nodes.map((n, i) => [n, {
        x: cx + r * Math.cos(angle(i)),
        y: cy + r * Math.sin(angle(i)),
    }]));

    const arrows = edges.map(e => {
        const s = pos[e.from], t = pos[e.to];
        if (!s || !t) { return ''; }
        const dx = t.x - s.x, dy = t.y - s.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ex = t.x - (dx / len) * 22, ey = t.y - (dy / len) * 22;
        return `<line x1="${s.x.toFixed(1)}" y1="${s.y.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="var(--vscode-textLink-foreground)" stroke-width="1.5" marker-end="url(#arrow)"/>`;
    }).join('');

    const circles = nodes.map(n => {
        const p = pos[n];
        const label = n.length > 18 ? n.slice(0, 17) + '…' : n;
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="20" fill="var(--vscode-editor-inactiveSelectionBackground)" stroke="var(--vscode-focusBorder)" stroke-width="1.5"/>
<text x="${p.x.toFixed(1)}" y="${(p.y + 32).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--vscode-foreground)">${label}</text>`;
    }).join('');

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Dependency Graph</title>
<style>body{background:var(--vscode-editor-background);font-family:var(--vscode-font-family)}h1{font-size:1rem;color:var(--vscode-textLink-foreground);padding:0.75rem}</style>
</head><body><h1>🔗 ${fileName} - Dependency Graph</h1>
${edges.length === 0
    ? '<p style="padding:1rem;opacity:0.6">No <code>&gt;&gt;depends:</code> markers found in this file.</p>'
    : `<svg viewBox="0 0 680 480" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:680px">
<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="var(--vscode-textLink-foreground)"/></marker></defs>
${arrows}${circles}</svg>`}
</body></html>`;
}

let graphPanel: vscode.WebviewPanel | undefined;

/** Command: opens a webview showing the dependency graph */
export async function onShowDependencyGraph(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const fileName = editor.document.fileName.split(/[\\/]/).pop() ?? 'file';
    const edges    = collectDependencies(editor.document);

    if (graphPanel) { graphPanel.reveal(); }
    else {
        graphPanel = vscode.window.createWebviewPanel(
            'chevron-lists.dependencyGraph', 'CL: Dependency Graph',
            vscode.ViewColumn.Beside, { enableScripts: false }
        );
        graphPanel.onDidDispose(() => { graphPanel = undefined; });
    }
    graphPanel.webview.html = buildGraphHtml(edges, fileName);
}
