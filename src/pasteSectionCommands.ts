import * as vscode from 'vscode';
import { getConfig } from './config';
import { sectionBlockInsert } from './lineEdits';

/** Command: pastes clipboard text as a new chevron section */
export async function onPasteAsSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const clipText   = await vscode.env.clipboard.readText();
    const lines      = clipText.split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length === 0) {
        vscode.window.showInformationMessage('CL: Clipboard is empty');
        return;
    }

    // First line → header, remaining → items. Markers already on the copied
    // text are replaced, not stacked: "> Title" used to become "> > Title" and
    // "- milk" became ">> - - milk". A numbered line stays numbered.
    const name  = lines[0].replace(/^(?:>+|#+)\s*/, '');
    const items = lines.slice(1).map(l => {
        const text     = l.replace(/^>{2,}\s+/, '');
        const numbered = /^(\d+)[.)]\s+(.*)$/.exec(text);
        if (numbered) { return `>> ${numbered[1]}. ${numbered[2]}`; }
        return `>> ${prefix} ${text.replace(/^[-*+•]\s+/, '')}`;
    });

    const ins = sectionBlockInsert(editor.document, editor.selection.active.line, [`> ${name}`, ...items]);
    await editor.edit(eb => eb.insert(ins.position, ins.text));

    vscode.window.showInformationMessage(
        `CL: Pasted as section "${name}" with ${items.length} item${items.length === 1 ? '' : 's'}`
    );
}
