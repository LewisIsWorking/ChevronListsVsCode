import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { setRating, removeRating } from './ratingParser';
import { getSectionRange, findHeaderAbove } from './documentUtils';

/** Command: sets a ★N rating on every item in the current section at once */
export async function onBulkSetRating(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const pick = await vscode.window.showQuickPick(
        [1, 2, 3, 4, 5].map(n => ({ label: '★'.repeat(n) + '☆'.repeat(5 - n), rating: n }))
            .concat([{ label: '$(close) Remove all ratings', rating: 0 }]),
        { placeHolder: 'Set rating for every item in this section…' }
    );
    if (!pick) { return; }

    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const [, end]     = getSectionRange(doc, headerLine);

    let changed = 0;
    let items   = 0;
    await editor.edit(eb => {
        for (let i = headerLine + 1; i <= end; i++) {
            const text    = doc.lineAt(i).text;
            const bullet  = parseBullet(text, prefix);
            const numbered = parseNumbered(text);
            if (!bullet && !numbered) { continue; }
            items++;
            const chevrons = bullet?.chevrons ?? numbered!.chevrons;
            const content  = bullet?.content  ?? numbered!.content;
            const num      = numbered?.num ?? null;
            const newContent = pick.rating > 0 ? setRating(content, pick.rating) : removeRating(content);
            if (newContent === content) { continue; }
            const newLine = num !== null
                ? `${chevrons} ${num}. ${newContent}`
                : `${chevrons} ${prefix} ${newContent}`;
            eb.replace(doc.lineAt(i).range, newLine);
            changed++;
        }
    });

    vscode.window.showInformationMessage(
        changed > 0
            ? `CL: Updated rating on ${changed} item${changed === 1 ? '' : 's'}`
            : items > 0 ? 'CL: No ratings changed' : 'CL: No items found'
    );
}
