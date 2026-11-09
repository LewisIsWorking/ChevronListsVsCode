import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, countWordFrequency } from './patterns';
import { stripAllMetadata } from './metadataStripper';
import { getSectionRange, findHeaderAbove } from './documentUtils';
import { escHtml } from './htmlExporter';

export function buildCloudHtml(freq: Map<string, number>, sectionName: string): string {
    const sorted  = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
    const maxFreq = sorted[0]?.[1] ?? 1;
    const words   = sorted.map(([word, count]) => {
        const size = Math.round(12 + (count / maxFreq) * 28);
        const opacity = 0.5 + (count / maxFreq) * 0.5;
        return `<span style="font-size:${size}px;opacity:${opacity};margin:4px;display:inline-block;color:var(--vscode-textLink-foreground)">${word}</span>`;
    }).join(' ');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Word Cloud</title>
<style>body{font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-foreground);padding:1.5rem;line-height:2}
h1{font-size:1rem;color:var(--vscode-textLink-foreground);margin-bottom:1rem}</style>
</head><body><h1>☁ ${escHtml(sectionName)}</h1><div>${words || '<p style="opacity:0.5">Not enough words to build a cloud.</p>'}</div></body></html>`;
}

let cloudPanel: vscode.WebviewPanel | undefined;

/** Command: shows a word cloud for the current section */
export async function onShowWordCloud(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const name        = doc.lineAt(headerLine).text.replace(/^> /, '');
    const [, end]     = getSectionRange(doc, headerLine);
    const plainLines: string[] = [];
    for (let i = headerLine + 1; i <= end; i++) {
        const t = doc.lineAt(i).text;
        const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
        if (content) { plainLines.push(stripAllMetadata(content)); }
    }
    const freq = countWordFrequency(plainLines);
    if (cloudPanel) { cloudPanel.reveal(); }
    else {
        cloudPanel = vscode.window.createWebviewPanel(
            'chevron-lists.wordCloud', 'CL: Word Cloud',
            vscode.ViewColumn.Beside, { enableScripts: false }
        );
        cloudPanel.onDidDispose(() => { cloudPanel = undefined; });
    }
    cloudPanel.webview.html = buildCloudHtml(freq, name);
}
