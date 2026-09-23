import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';

type EditBuilder = vscode.TextEditorEdit;

/** Applies a content transform to every item in the current section */
async function batchTransform(
    transform: (content: string) => string,
    label: string
): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const [, end]     = getSectionRange(doc, headerLine);

    let changed = 0;
    await editor.edit((eb: EditBuilder) => {
        for (let i = headerLine + 1; i <= end; i++) {
            const text     = doc.lineAt(i).text;
            const bullet   = parseBullet(text, prefix);
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
            changed++;
        }
    });
    vscode.window.showInformationMessage(
        changed > 0 ? `CL: ${label} - cleared from ${changed} item${changed === 1 ? '' : 's'}` : `CL: No ${label.toLowerCase()} found`
    );
}

/** Command: removes all !,!!,!!! priority markers from every item in the section */
export const onClearAllPriority  = () => batchTransform(
    c => c.replace(/!{1,3}\s*/g, '').replace(/\s{2,}/g, ' ').trim(),
    'All Priority'
);

/** Command: removes all @YYYY-MM-DD due dates from every item in the section */
export const onClearAllDueDates  = () => batchTransform(
    c => c.replace(/\s*@\d{4}-\d{2}-\d{2}/g, '').trim(),
    'All Due Dates'
);
