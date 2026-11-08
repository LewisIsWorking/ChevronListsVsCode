import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';

/** Command: find and replace plain text across all items in the current section */
export async function onBatchReplaceText(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const find = await vscode.window.showInputBox({ prompt: 'Find text in section items', placeHolder: 'e.g. old name' });
    if (!find?.trim()) { return; }
    const replace = await vscode.window.showInputBox({ prompt: `Replace "${find}" with`, placeHolder: 'replacement text' });
    if (replace === undefined) { return; }

    const [, end] = getSectionRange(doc, headerLine);
    const matches: Array<{ line: number; newText: string }> = [];

    for (let i = headerLine + 1; i <= end; i++) {
        const text    = doc.lineAt(i).text;
        const content = parseBullet(text, prefix)?.content ?? parseNumbered(text)?.content ?? '';
        // Only the words: searching the whole line rewrote the marker and the number.
        if (!content.includes(find)) { continue; }
        matches.push({ line: i, newText: text.slice(0, text.length - content.length) + content.split(find).join(replace) });
    }

    if (matches.length === 0) {
        vscode.window.showInformationMessage(`CL: "${find}" not found in this section`);
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `CL: Replace "${find}" → "${replace}" in ${matches.length} item${matches.length === 1 ? '' : 's'}?`,
        { modal: true }, 'Replace'
    );
    if (confirm !== 'Replace') { return; }

    await editor.edit(eb => {
        for (const m of matches) { eb.replace(doc.lineAt(m.line).range, m.newText); }
    });
    vscode.window.showInformationMessage(`CL: Replaced in ${matches.length} item${matches.length === 1 ? '' : 's'}`);
}
