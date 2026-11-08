import * as vscode from 'vscode';
import { getConfig } from './config';
import { joinItem, splitItem } from './itemParts';
import { parseBullet, parseNumbered } from './patterns';
import { stripAllMetadata } from './metadataStripper';
import { applyItemCopy, itemCopyBelow } from './lineEdits';

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
    const parts = splitItem((numbered ?? bullet)!.content);
    const copy  = itemCopyBelow(doc, lineIndex, prefix, joinItem({ ...parts, check: '[x]' }));
    await editor.edit(eb => applyItemCopy(eb, doc, copy));
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
    const copy = itemCopyBelow(doc, lineIndex, prefix, stripAllMetadata((numbered ?? bullet)!.content));
    await editor.edit(eb => applyItemCopy(eb, doc, copy));
}
