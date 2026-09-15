import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { parseCreatedDate, ageInDays } from './itemAgeParser';
import { wholeLineRanges } from './lineEdits';

/** Command: removes all items older than a user-specified number of days */
export async function onRemoveOldItems(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const input = await vscode.window.showInputBox({
        prompt:       'Remove items older than how many days?',
        value:        '30',
        placeHolder:  'e.g. 30',
        validateInput: v => /^\d+$/.test(v.trim()) && Number(v.trim()) > 0 ? null : 'Enter a positive integer',
    });
    if (!input?.trim()) { return; }

    const { prefix } = getConfig();
    const days       = Number(input.trim());
    const dayWord    = `${days} day${days === 1 ? '' : 's'}`;
    const doc        = editor.document;
    const today      = new Date();

    // Identify lines to remove
    const toRemove: number[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const dateStr = parseCreatedDate(content);
        if (!dateStr) { continue; }
        if (ageInDays(dateStr, today) >= days) { toRemove.push(i); }
    }

    if (toRemove.length === 0) {
        vscode.window.showInformationMessage(`CL: No items older than ${dayWord} found`);
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `Remove ${toRemove.length} item${toRemove.length === 1 ? '' : 's'} older than ${dayWord}?`,
        { modal: true }, 'Remove'
    );
    if (confirm !== 'Remove') { return; }

    await editor.edit(eb => {
        for (const range of wholeLineRanges(doc, toRemove)) { eb.delete(range); }
    });

    vscode.window.showInformationMessage(
        `CL: Removed ${toRemove.length} item${toRemove.length === 1 ? '' : 's'}`
    );
}
