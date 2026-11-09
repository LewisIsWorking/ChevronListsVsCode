import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, groupLinesByMention } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';
import { GROUP_RE } from './groupParser';

/** Command: groups section items by @mention into sub-sections */
export async function onGroupItemsByMention(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const [, end]     = getSectionRange(doc, headerLine);

    const itemLines: Array<{ text: string; index: number }> = [];
    const otherLines: string[] = [];
    for (let i = headerLine + 1; i <= end; i++) {
        const text = doc.lineAt(i).text;
        if (parseBullet(text, prefix) || parseNumbered(text)) {
            itemLines.push({ text, index: i });
        } else if (!GROUP_RE.test(text)) {
            // Notes and blank lines stay. A divider from an earlier run is replaced.
            otherLines.push(text);
        }
    }

    if (itemLines.length === 0) {
        vscode.window.showInformationMessage('CL: No items found in this section');
        return;
    }

    const groups = groupLinesByMention(itemLines, prefix);
    if ([...groups.keys()].every(name => name === 'Unassigned')) {
        vscode.window.showInformationMessage('CL: No @Mention markers found in section items');
        return;
    }

    const newLines: string[] = [];
    for (const [name, items] of groups.entries()) {
        newLines.push(`>> -- ${name}`);
        for (const item of items) { newLines.push(item.text); }
    }

    newLines.push(...otherLines);

    const range = new vscode.Range(headerLine + 1, 0, end, doc.lineAt(end).text.length);
    await editor.edit(eb => eb.replace(range, newLines.join('\n')));
    vscode.window.showInformationMessage(`CL: Grouped into ${groups.size} mention groups`);
}
