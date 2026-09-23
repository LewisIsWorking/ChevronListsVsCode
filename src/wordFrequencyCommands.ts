import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, rankWordFrequency } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';
import { stripAllMetadata } from './metadataStripper';

/** Command: shows top 10 words in the current section */
export async function onCountWordFrequency(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const name        = doc.lineAt(headerLine).text.replace(/^> /, '').trim();
    const [, end]     = getSectionRange(doc, headerLine);
    const words: string[] = [];

    for (let i = headerLine + 1; i <= end; i++) {
        const t = doc.lineAt(i).text;
        const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
        if (!content) { continue; }
        const plain = stripAllMetadata(content).toLowerCase();
        for (const w of plain.split(/\W+/).filter(Boolean)) { words.push(w); }
    }

    const freq = rankWordFrequency(words);
    if (freq.length === 0) {
        vscode.window.showInformationMessage(`CL: "${name}" - no words found`);
        return;
    }
    const top  = freq.slice(0, 10).map(([w, n]) => `"${w}" ×${n}`).join('  ·  ');
    vscode.window.showInformationMessage(`CL: "${name}" top words: ${top}`, { modal: true }, 'OK');
}
