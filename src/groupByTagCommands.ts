import * as vscode from 'vscode';
import { getConfig } from './config';
import { groupLinesByTag } from './patterns';
import { extractTags } from './tagParser';
import { getSectionRange, findHeaderAbove } from './documentUtils';
import { renumberLines } from './numberingRuns';

const GROUP_HEADING_RE = /^\/\/ #[\w-]+$/;

/** Command: re-orders items in the section so items sharing a #tag are clustered */
export async function onGroupItemsByTag(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const [, end] = getSectionRange(doc, headerLine);
    const itemLines: string[] = [];
    for (let i = headerLine + 1; i <= end; i++) {
        const text = doc.lineAt(i).text;
        // A heading from an earlier run is replaced, not kept among the untagged lines.
        if (!GROUP_HEADING_RE.test(text)) { itemLines.push(text); }
    }

    const groups  = groupLinesByTag(itemLines, prefix, extractTags);
    const hasMultiple = groups.filter(g => g.tag !== '').length > 1;
    if (!hasMultiple) {
        vscode.window.showInformationMessage('CL: Not enough distinct tags to group by');
        return;
    }

    const newLines: string[] = [];
    for (const group of groups) {
        if (group.tag) { newLines.push(`// #${group.tag}`); }
        newLines.push(...group.lines);
    }

    const range = new vscode.Range(headerLine + 1, 0, end, doc.lineAt(end).text.length);
    await editor.edit(eb => eb.replace(range, renumberLines(newLines).join('\n')));
    vscode.window.showInformationMessage(
        `CL: Grouped into ${groups.filter(g => g.tag).length} tag group${groups.length === 1 ? '' : 's'}`
    );
}
