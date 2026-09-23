import * as vscode from 'vscode';
import { findHeaderAbove } from './documentUtils';

/** Command: renames the current section header and updates all [[links]] in the file */
export async function onRenameSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section header found at cursor'); return; }

    const oldName = doc.lineAt(headerLine).text.replace(/^> /, '').trim();

    const newName = await vscode.window.showInputBox({
        prompt: 'New section name',
        value:  oldName,
    });
    if (!newName?.trim() || newName.trim() === oldName) { return; }

    const cleanNew = newName.trim();
    let linkUpdates = 0;

    await editor.edit(eb => {
        // Rename the header line itself
        eb.replace(doc.lineAt(headerLine).range, `> ${cleanNew}`);

        // Update all [[OldName]] links throughout the file
        for (let i = 0; i < doc.lineCount; i++) {
            if (i === headerLine) { continue; }
            const text = doc.lineAt(i).text;
            const escapedOld = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const linkRE = new RegExp(`\\[\\[${escapedOld}\\]\\]`, 'g');
            if (!linkRE.test(text)) { continue; }
            eb.replace(doc.lineAt(i).range, text.split(`[[${oldName}]]`).join(`[[${cleanNew}]]`));
            linkUpdates++;
        }
    });

    vscode.window.showInformationMessage(
        `CL: Renamed to "${cleanNew}"${linkUpdates > 0 ? ` - updated ${linkUpdates} link${linkUpdates === 1 ? '' : 's'}` : ''}`
    );
}
