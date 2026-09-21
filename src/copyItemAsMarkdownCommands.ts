import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, itemToMarkdown } from './patterns';

/** Command: copies the item at cursor as standard markdown to the clipboard */
export async function onCopyItemAsMarkdown(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const lineIndex  = editor.selection.active.line;
    const text       = editor.document.lineAt(lineIndex).text;
    const bullet     = parseBullet(text, prefix);
    const numbered   = parseNumbered(text);
    const content    = bullet?.content ?? numbered?.content ?? null;
    if (!content) { vscode.window.showInformationMessage('CL: Place cursor on a chevron item'); return; }

    const depth  = (bullet?.chevrons ?? numbered!.chevrons).length - 2;
    const indent = '  '.repeat(depth);
    // Numbered items stay numbered; they used to be copied as "- " bullets.
    const md     = indent + itemToMarkdown(content, numbered?.num ?? null);

    await vscode.env.clipboard.writeText(md);
    vscode.window.showInformationMessage('CL: Copied as markdown');
}
