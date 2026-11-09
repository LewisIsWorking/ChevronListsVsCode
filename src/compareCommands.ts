import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange } from './documentUtils';
import { findHeaderAbove } from './documentUtils';

/** Extracts all item text lines from a section */
function getSectionLines(document: vscode.TextDocument, prefix: string, headerLine: number): string[] {
    const [, end] = getSectionRange(document, headerLine);
    const lines: string[] = [];
    for (let i = headerLine + 1; i <= end; i++) {
        const text    = document.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (content) { lines.push(content); }
    }
    return lines;
}

/** Produces a simple line-by-line diff as markdown */
function simpleDiff(current: string[], clipboard: string[]): string {
    const all = new Set([...current, ...clipboard]);
    const lines: string[] = ['**Section vs Clipboard Diff**\n'];
    for (const line of all) {
        const inCurrent   = current.includes(line);
        const inClipboard = clipboard.includes(line);
        if (inCurrent && inClipboard) {
            lines.push(`= ${line}`);
        } else if (inCurrent) {
            lines.push(`- ${line}  *(only in section)*`);
        } else {
            lines.push(`+ ${line}  *(only in clipboard)*`);
        }
    }
    return lines.join('\n');
}

/** Command: compares the current section against clipboard content */
export async function onCompareSectionToClipboard(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix }  = getConfig();
    const headerLine  = findHeaderAbove(editor.document, editor.selection.active.line);
    if (headerLine < 0) {
        vscode.window.showInformationMessage('CL: No section found at cursor');
        return;
    }

    const current   = getSectionLines(editor.document, prefix, headerLine);
    const clipboard = (await vscode.env.clipboard.readText())
        .split('\n').map(l => l.trim()).filter(Boolean)
        // Copied from a list, a line is its item, not its chevrons and bullet.
        .map(l => parseBullet(l, prefix)?.content ?? parseNumbered(l)?.content ?? l);

    if (clipboard.length === 0) {
        vscode.window.showInformationMessage('CL: Clipboard is empty');
        return;
    }

    const diff = simpleDiff(current, clipboard);

    // Show diff in a new untitled document
    const doc = await vscode.workspace.openTextDocument({ content: diff, language: 'markdown' });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
}
