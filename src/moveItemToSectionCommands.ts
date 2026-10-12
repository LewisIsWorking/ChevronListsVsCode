import * as vscode from 'vscode';
import { getConfig } from './config';
import { computeMoveToSection, moveTargetsFor } from './sets';

interface SectionPickItem extends vscode.QuickPickItem { headerLine: number; }

/**
 * Command: moves the item at the cursor, with anything nested under it, to the
 * end of a chosen section, in that section's list type, renumbering both.
 * Inside a `#set` heading the choices are the set's other lists.
 */
export async function onMoveItemToSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const lines      = Array.from({ length: doc.lineCount }, (_, i) => doc.lineAt(i).text);
    const targets    = moveTargetsFor(lines, lineIndex, prefix);

    if (targets.length === 0) {
        vscode.window.showInformationMessage('CL: Place cursor on a top-level chevron item, in a file with another section');
        return;
    }

    const sections: SectionPickItem[] = targets.map(t => ({ label: t.name, headerLine: t.header }));
    const picked = await vscode.window.showQuickPick(sections, { placeHolder: 'Move item to section…' });
    if (!picked) { return; }

    const after = computeMoveToSection(lines, lineIndex, picked.headerLine, prefix);
    if (!after) { return; }

    // Replace only the lines that changed: from the first difference to the last
    let first = 0;
    while (first < lines.length && lines[first] === after[first]) { first++; }
    let last = lines.length - 1;
    while (last > first && lines[last] === after[last]) { last--; }
    const range = new vscode.Range(first, 0, last, doc.lineAt(last).text.length);
    await editor.edit(eb => eb.replace(range, after.slice(first, last + 1).join('\n')));

    vscode.window.showInformationMessage(`CL: Moved item to "${picked.label}"`);
}
