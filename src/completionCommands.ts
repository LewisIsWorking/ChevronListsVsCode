import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { splitItem, joinItem } from './itemParts';
import { getSectionRange, findHeaderAbove } from './documentUtils';

type EditBuilder = vscode.TextEditorEdit;

/** Applies a checkbox transform to all items in the current section */
async function transformCheckboxes(
    transform: (content: string) => string
): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const [, end]     = getSectionRange(doc, headerLine);

    await editor.edit((eb: EditBuilder) => {
        for (let i = headerLine + 1; i <= end; i++) {
            const text    = doc.lineAt(i).text;
            const bullet  = parseBullet(text, prefix);
            const numbered = parseNumbered(text);
            if (!bullet && !numbered) { continue; }
            const chevrons = bullet?.chevrons ?? numbered!.chevrons;
            const content  = bullet?.content  ?? numbered!.content;
            const num      = numbered?.num ?? null;
            const newContent = transform(content);
            if (newContent === content) { continue; }
            const newLine = num !== null
                ? `${chevrons} ${num}. ${newContent}`
                : `${chevrons} ${prefix} ${newContent}`;
            eb.replace(doc.lineAt(i).range, newLine);
        }
    });
}

/** Command: marks all [ ] items in the current section as [x] */
export async function onMarkAllDone(): Promise<void> {
    await transformCheckboxes(content => {
        const parts = splitItem(content);
        return /x/i.test(parts.check) ? content : joinItem({ ...parts, check: '[x]' });
    });
}

/** Command: resets all [x] items in the current section back to [ ] */
export async function onMarkAllUndone(): Promise<void> {
    await transformCheckboxes(content => {
        const parts = splitItem(content);
        return /x/i.test(parts.check) ? joinItem({ ...parts, check: '[ ]' }) : content;
    });
}

/** Command: strips all [x]/[ ] markers from all items in the section */
export async function onRemoveAllCheckboxes(): Promise<void> {
    await transformCheckboxes(content => {
        const parts = splitItem(content);
        return parts.check ? joinItem({ ...parts, check: '' }) : content;
    });
}
