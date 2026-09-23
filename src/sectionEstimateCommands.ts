import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, parseEstimateToMinutes, formatTotalMinutes } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';

/** Command: sums all ~estimate markers in the current section */
export async function onShowSectionTimeEstimate(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const name        = doc.lineAt(headerLine).text.replace(/^> /, '').trim();
    const [, end]     = getSectionRange(doc, headerLine);
    let   total = 0, count = 0;

    for (let i = headerLine + 1; i <= end; i++) {
        const text    = doc.lineAt(i).text;
        const content = parseBullet(text, prefix)?.content ?? parseNumbered(text)?.content ?? null;
        if (!content || !/~\d/.test(content)) { continue; }
        const mins = parseEstimateToMinutes(content);
        if (mins > 0) { total += mins; count++; }
    }

    if (count === 0) {
        vscode.window.showInformationMessage(`CL: "${name}" - no ~estimate markers found`);
        return;
    }
    vscode.window.showInformationMessage(
        `CL: "${name}" - ${count} estimate${count === 1 ? '' : 's'} totalling ${formatTotalMinutes(total)}`
    );
}
