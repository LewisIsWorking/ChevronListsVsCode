import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, todayDate } from './patterns';
import { hasTag } from './tagParser';
import { appendToItemBody, joinItem, splitItem } from './itemParts';
import { isRealDate } from './patternsUtils';
import { getSectionRange } from './documentUtils';
import { findHeaderAbove } from './documentUtils';

/** Applies a transform function to every item in the current section */
async function bulkTransformSection(
    editor: vscode.TextEditor,
    transform: (content: string, chevrons: string, prefix: string, num: number | null) => string
): Promise<void> {
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const [, end] = getSectionRange(doc, headerLine);
    await editor.edit(eb => {
        for (let i = headerLine + 1; i <= end; i++) {
            const text    = doc.lineAt(i).text;
            const bullet  = parseBullet(text, prefix);
            const numbered = parseNumbered(text);
            if (!bullet && !numbered) { continue; }
            const chevrons = bullet?.chevrons ?? numbered!.chevrons;
            const content  = bullet?.content  ?? numbered!.content;
            const num      = numbered?.num ?? null;
            const newContent = transform(content, chevrons, prefix, num);
            const newLine    = num !== null
                ? `${chevrons} ${num}. ${newContent}`
                : `${chevrons} ${prefix} ${newContent}`;
            eb.replace(doc.lineAt(i).range, newLine);
        }
    });
}

/** Command: adds a tag to all items in the current section */
export async function onBulkTagItems(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const input = await vscode.window.showInputBox({
        prompt:        'Tag to add to all items (without #)',
        placeHolder:   'urgent',
        validateInput: v => /^#*\w[\w-]*$/.test(v.trim()) ? null : 'Enter one tag: letters, numbers, hyphens and underscores',
    });
    // A leading # is accepted rather than doubled into "##urgent".
    const tag = input?.trim().replace(/^#+/, '');
    if (!tag) { return; }
    await bulkTransformSection(editor, (content) => {
        // The tag itself, in any case -- not any text containing it: "#tagging"
        // used to count as already having "#tag".
        if (hasTag(splitItem(content).body, tag)) { return content; }
        return appendToItemBody(content, `#${tag}`);
    });
}

/** Command: sets priority on all items in the current section */
export async function onBulkSetPriority(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const level = await vscode.window.showQuickPick(
        [{ label: '! Low', value: '!' }, { label: '!! Medium', value: '!!' }, { label: '!!! Critical', value: '!!!' }],
        { placeHolder: 'Select priority level for all items' }
    );
    if (!level) { return; }
    await bulkTransformSection(editor, (content) => joinItem({ ...splitItem(content), priority: level.value }));
}

/** Command: sets a due date on all items in the current section */
export async function onBulkSetDueDate(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const date = await vscode.window.showInputBox({
        prompt:      'Due date for all items (YYYY-MM-DD)',
        placeHolder: `${todayDate()}`,
        validateInput: v => /^\d{4}-\d{2}-\d{2}$/.test(v) && isRealDate(v) ? null : 'Format must be YYYY-MM-DD',
    });
    if (!date?.trim()) { return; }
    await bulkTransformSection(editor, (content) => {
        const parts = splitItem(content);
        const body  = parts.body.replace(/@\d{4}-\d{2}-\d{2}/, '').trim();
        return joinItem({ ...parts, body: `${body} @${date.trim()}`.trim() });
    });
}
