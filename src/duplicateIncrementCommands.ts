import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, incrementFirstNumber } from './patterns';
import { lineAfter } from './lineEdits';

/** Command: duplicates item below itself with the first number in content incremented */
export async function onDuplicateItemAndIncrement(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const text       = doc.lineAt(lineIndex).text;
    const bullet     = parseBullet(text, prefix);
    const numbered   = parseNumbered(text);

    if (!bullet && !numbered) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item');
        return;
    }

    const chevrons  = bullet?.chevrons ?? numbered!.chevrons;
    const content   = bullet?.content  ?? numbered!.content;
    const num       = numbered?.num ?? null;
    const newContent = incrementFirstNumber(content) ?? content;
    const newLine    = num !== null
        ? `${chevrons} ${num}. ${newContent}`
        : `${chevrons} ${prefix} ${newContent}`;

    const character = editor.selection.active.character;
    const ins       = lineAfter(doc, lineIndex, newLine);
    await editor.edit(eb => eb.insert(ins.position, ins.text));

    const pos = new vscode.Position(ins.line, character);
    editor.selection = new vscode.Selection(pos, pos);
}
