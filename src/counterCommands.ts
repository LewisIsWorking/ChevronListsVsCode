import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { parseCheck } from './checkParser';
import { extractTags } from './tagParser';
import { getSectionRange } from './documentUtils';
import { findHeaderAbove } from './documentUtils';
import { itemWordCount } from './metadataStripper';

/** Command: shows a summary notification for the current section */
export async function onShowSectionSummary(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const name        = doc.lineAt(headerLine).text.replace(/^> /, '');
    const [, end]     = getSectionRange(doc, headerLine);
    let items = 0, done = 0, words = 0;
    const tagCounts: Record<string, number> = {};

    for (let i = headerLine + 1; i <= end; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        items++;
        words += itemWordCount(content);
        const check = parseCheck(content);
        if (check?.state === 'done') { done++; }
        for (const tag of extractTags(content)) {
            tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
        }
    }

    const tagLine = Object.keys(tagCounts).length > 0
        ? `  Tags: ${Object.entries(tagCounts).map(([t, n]) => `#${t}×${n}`).join(', ')}`
        : '';
    const checkLine = done > 0 ? `  Done: ${done}/${items}` : '';

    vscode.window.showInformationMessage(
        `"${name}" - ${items} item${items === 1 ? '' : 's'}, ${words} word${words === 1 ? '' : 's'}${checkLine}${tagLine}`
    );
}

/** Command: shows item counts broken down by tag */
export async function onCountItemsByTag(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const tagCounts: Record<string, number> = {};

    for (let i = 0; i < doc.lineCount; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        for (const tag of extractTags(content)) {
            tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
        }
    }

    if (Object.keys(tagCounts).length === 0) {
        vscode.window.showInformationMessage('CL: No #tags found in this file');
        return;
    }

    const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    await vscode.window.showQuickPick(
        sorted.map(([tag, count]) => ({
            label:       `$(tag) #${tag}`,
            description: `${count} item${count === 1 ? '' : 's'}`,
        })),
        { placeHolder: 'Item counts by tag (read-only)' }
    );
}
