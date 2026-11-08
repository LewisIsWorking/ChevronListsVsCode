import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';
import { parseExpiry } from './expiryParser';
import { appendToItemBody, joinItem, splitItem } from './itemParts';
import { isRealDate } from './patternsUtils';

/** Command: sets @expires:YYYY-MM-DD on every item in the current section */
export async function onSetExpiryOnAllItems(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const input = await vscode.window.showInputBox({
        prompt:       'Set expiry date on all items in this section (YYYY-MM-DD)',
        placeHolder:  'e.g. 2026-12-31',
        validateInput: v => /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) && isRealDate(v.trim()) ? null : 'Enter a date as YYYY-MM-DD',
    });
    if (!input?.trim()) { return; }

    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const [, end]     = getSectionRange(doc, headerLine);
    const dateStr     = input.trim();

    let changed = 0;
    await editor.edit(eb => {
        for (let i = headerLine + 1; i <= end; i++) {
            const text    = doc.lineAt(i).text;
            const bullet  = parseBullet(text, prefix);
            const numbered = parseNumbered(text);
            if (!bullet && !numbered) { continue; }
            const chevrons = bullet?.chevrons ?? numbered!.chevrons;
            const content  = bullet?.content  ?? numbered!.content;
            const num      = numbered?.num ?? null;
            // Replace existing expiry or append new one
            const parts      = splitItem(content);
            const newContent = parseExpiry(parts.body)
                ? joinItem({ ...parts, body: parts.body.replace(/@expires:\d{4}-\d{2}-\d{2}/, `@expires:${dateStr}`) })
                : appendToItemBody(content, `@expires:${dateStr}`);
            const newLine = num !== null
                ? `${chevrons} ${num}. ${newContent}`
                : `${chevrons} ${prefix} ${newContent}`;
            eb.replace(doc.lineAt(i).range, newLine);
            changed++;
        }
    });

    vscode.window.showInformationMessage(
        changed > 0 ? `CL: Set expiry on ${changed} item${changed === 1 ? '' : 's'}` : 'CL: No items found'
    );
}
