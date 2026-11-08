import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';

const CHOICES = ['-', '*', '•'];

/** Command: changes the bullet prefix on all items in the current section */
export async function onChangeItemPrefix(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const newPrefix = await vscode.window.showQuickPick(
        [
            { label: '- Hyphen',   prefix: '-' },
            { label: '* Asterisk', prefix: '*' },
            { label: '• Bullet',   prefix: '•' },
        ],
        { placeHolder: 'Choose item prefix for this section…' }
    );
    if (!newPrefix) { return; }

    const [, end] = getSectionRange(doc, headerLine);
    let changed   = 0;
    // Every prefix on offer is read, or a section once changed could not be changed back.
    const readable = [prefix, ...CHOICES];

    await editor.edit(eb => {
        for (let i = headerLine + 1; i <= end; i++) {
            const text   = doc.lineAt(i).text;
            const bullet = readable.map(p => parseBullet(text, p)).find(b => b !== null);
            if (!bullet) { continue; }
            const newLine = `${bullet.chevrons} ${newPrefix.prefix} ${bullet.content}`;
            if (newLine === text) { continue; }
            eb.replace(doc.lineAt(i).range, newLine);
            changed++;
        }
    });

    vscode.window.showInformationMessage(
        changed > 0
            ? `CL: Changed prefix to "${newPrefix.prefix}" on ${changed} item${changed === 1 ? '' : 's'}`
            : 'CL: No bullet items to change in this section'
    );
}
