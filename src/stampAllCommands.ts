import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, formatDate } from './patterns';
import { addCreatedDate, parseCreatedDate } from './itemAgeParser';
import { getSectionRange, findHeaderAbove } from './documentUtils';

/** Command: adds @created:today to every item in the section that doesn't already have one */
export async function onStampAllItems(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const [, end]     = getSectionRange(doc, headerLine);
    const today       = formatDate(new Date());
    let   stamped     = 0;

    await editor.edit(eb => {
        for (let i = headerLine + 1; i <= end; i++) {
            const text    = doc.lineAt(i).text;
            const bullet  = parseBullet(text, prefix);
            const numbered = parseNumbered(text);
            if (!bullet && !numbered) { continue; }
            const chevrons = bullet?.chevrons ?? numbered!.chevrons;
            const content  = bullet?.content  ?? numbered!.content;
            const num      = numbered?.num ?? null;
            if (parseCreatedDate(content)) { continue; } // already stamped
            const newContent = addCreatedDate(content, today);
            const newLine    = num !== null
                ? `${chevrons} ${num}. ${newContent}`
                : `${chevrons} ${prefix} ${newContent}`;
            eb.replace(doc.lineAt(i).range, newLine);
            stamped++;
        }
    });

    vscode.window.showInformationMessage(
        stamped > 0
            ? `CL: Stamped ${stamped} item${stamped === 1 ? '' : 's'} with @created:${today}`
            : 'CL: All items already have @created: stamps'
    );
}
