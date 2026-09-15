import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, isHeader, todayDate } from './patterns';
import { parseCheck } from './checkParser';
import { extractTags } from './tagParser';
import { getSectionRange, findHeaderAbove } from './documentUtils';
import { stripAllMetadata } from './metadataStripper';

/** Command: shows a quick one-line stats message for the cursor section */
export async function onQuickStats(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const name        = doc.lineAt(headerLine).text.replace(/^> /, '').trim();
    const [, end]     = getSectionRange(doc, headerLine);
    const today       = todayDate();
    let   items = 0, done = 0, words = 0, tags = 0, overdue = 0;

    for (let i = headerLine + 1; i <= end; i++) {
        const t = doc.lineAt(i).text;
        const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
        if (!content) { continue; }
        items++;
        words  += stripAllMetadata(content).trim().split(/\s+/).filter(Boolean).length;
        tags   += extractTags(content).length;
        if (parseCheck(content)?.state === 'done') { done++; }
        const m = content.match(/@(\d{4}-\d{2}-\d{2})/);
        if (m && m[1] < today) { overdue++; }
    }

    const pct      = items > 0 ? `${Math.round((done / items) * 100)}%` : '–';
    const parts    = [
        `${items} item${items === 1 ? '' : 's'}`,
        `${done}/${items} done (${pct})`,
        `${words} word${words === 1 ? '' : 's'}`,
        tags > 0    ? `${tags} tag${tags === 1 ? '' : 's'}` : null,
        overdue > 0 ? `⚠ ${overdue} overdue` : null,
    ].filter(Boolean);

    vscode.window.showInformationMessage(`CL: "${name}" — ${parts.join(' · ')}`);
}
