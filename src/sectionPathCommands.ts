import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';
import { itemWordCount } from './metadataStripper';

/** Command: shows current section name, word count and item count as a quick orientation */
export async function onShowSectionPath(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: Not inside a section'); return; }

    const name        = doc.lineAt(headerLine).text.replace(/^> /, '').trim();
    const cursorLine  = editor.selection.active.line;
    const [, end]     = getSectionRange(doc, headerLine);
    let   items = 0, words = 0;

    for (let i = headerLine + 1; i <= end; i++) {
        const t = doc.lineAt(i).text;
        const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
        if (!content) { continue; }
        items++;
        words += itemWordCount(content);
    }

    const lineInSection = cursorLine - headerLine;
    vscode.window.showInformationMessage(
        `📍 ${name}  ·  line ${lineInSection} of ${end - headerLine}  ·  ${items} item${items === 1 ? '' : 's'}  ·  ${words} word${words === 1 ? '' : 's'}`
    );
}
