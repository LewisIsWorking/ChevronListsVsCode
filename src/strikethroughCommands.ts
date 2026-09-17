import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, removeStrikethrough, toggleStrikethrough } from './patterns';

async function transformContent(transform: (s: string) => string): Promise<void> {
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
    const newContent = transform(content);
    const newLine    = num !== null
        ? `${chevrons} ${num}. ${newContent}`
        : `${chevrons} ${prefix} ${newContent}`;
    await editor.edit(eb => eb.replace(doc.lineAt(lineIndex).range, newLine));
}

/** Command: toggles ~~strikethrough~~ on item content */
export const onStrikethroughItem   = () => transformContent(toggleStrikethrough);

/** Command: removes ~~strikethrough~~ markers from item content */
export const onRemoveStrikethrough = () => transformContent(removeStrikethrough);
