import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered, todayDate } from './patterns';
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
    const tag = await vscode.window.showInputBox({ prompt: 'Tag to add to all items (without #)', placeHolder: 'urgent' });
    if (!tag?.trim()) { return; }
    await bulkTransformSection(editor, (content) => {
        if (content.includes(`#${tag.trim()}`)) { return content; }
        return `${content} #${tag.trim()}`;
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
    await bulkTransformSection(editor, (content) => {
        const stripped = content.replace(/^!{1,3} /, '');
        return `${level.value} ${stripped}`;
    });
}

/** Command: sets a due date on all items in the current section */
export async function onBulkSetDueDate(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const date = await vscode.window.showInputBox({
        prompt:      'Due date for all items (YYYY-MM-DD)',
        placeHolder: `${todayDate()}`,
        validateInput: v => /^\d{4}-\d{2}-\d{2}$/.test(v) ? null : 'Format must be YYYY-MM-DD',
    });
    if (!date?.trim()) { return; }
    await bulkTransformSection(editor, (content) => {
        const stripped = content.replace(/@\d{4}-\d{2}-\d{2}/, '').trim();
        return `${stripped} @${date.trim()}`;
    });
}
