import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseNumbered } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';
import { lineAfter } from './lineEdits';

/** Finds the highest existing number at `>>` depth in a section */
function findHighestNumber(document: vscode.TextDocument, headerLine: number): number {
    const [, end] = getSectionRange(document, headerLine);
    let max = 0;
    for (let i = headerLine + 1; i <= end; i++) {
        const n = parseNumbered(document.lineAt(i).text);
        if (n && n.chevrons === '>>') { max = Math.max(max, n.num); }
    }
    return max;
}

/** Command: pastes clipboard text as >> - bullet items at the cursor */
export async function onPasteAsBullets(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix }  = getConfig();
    const clipText    = await vscode.env.clipboard.readText();
    const lines       = clipText.split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length === 0) {
        vscode.window.showInformationMessage('CL: Clipboard is empty');
        return;
    }

    const ins = lineAfter(editor.document, editor.selection.active.line, lines.map(l => `>> ${prefix} ${l}`).join('\n'));
    await editor.edit(eb => eb.insert(ins.position, ins.text));
    vscode.window.showInformationMessage(`CL: Pasted ${lines.length} bullet item${lines.length === 1 ? '' : 's'}`);
}

/** Command: pastes clipboard text as >> N. numbered items, continuing from existing */
export async function onPasteAsNumbered(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const clipText = await vscode.env.clipboard.readText();
    const lines    = clipText.split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length === 0) {
        vscode.window.showInformationMessage('CL: Clipboard is empty');
        return;
    }

    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    let startNum     = (headerLine >= 0 ? findHighestNumber(doc, headerLine) : 0) + 1;

    const ins = lineAfter(doc, editor.selection.active.line, lines.map(l => `>> ${startNum++}. ${l}`).join('\n'));
    await editor.edit(eb => eb.insert(ins.position, ins.text));
    vscode.window.showInformationMessage(`CL: Pasted ${lines.length} numbered item${lines.length === 1 ? '' : 's'}`);
}
