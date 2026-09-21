import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { stripAllMetadata } from './metadataStripper';
import { lineAfter } from './lineEdits';

/** Command: clones the item below itself with [x] prepended */
export async function onCloneItemAsDone(): Promise<void> {
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
    const chevrons   = bullet?.chevrons ?? numbered!.chevrons;
    const content    = bullet?.content  ?? numbered!.content;
    const num        = numbered?.num ?? null;
    const newContent = content.startsWith('[x]') || content.startsWith('[ ]')
        ? content.replace(/^\[.\]\s*/, '[x] ')
        : `[x] ${content}`;
    const newLine = num !== null
        ? `${chevrons} ${num}. ${newContent}`
        : `${chevrons} ${prefix} ${newContent}`;
    const ins = lineAfter(doc, lineIndex, newLine);
    await editor.edit(eb => eb.insert(ins.position, ins.text));
}

/** Command: clones the item below itself with all markers stripped */
export async function onCloneItemStripped(): Promise<void> {
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
    const chevrons   = bullet?.chevrons ?? numbered!.chevrons;
    const content    = bullet?.content  ?? numbered!.content;
    const num        = numbered?.num ?? null;
    const stripped   = stripAllMetadata(content);
    const newLine    = num !== null
        ? `${chevrons} ${num}. ${stripped}`
        : `${chevrons} ${prefix} ${stripped}`;
    const ins = lineAfter(doc, lineIndex, newLine);
    await editor.edit(eb => eb.insert(ins.position, ins.text));
}
