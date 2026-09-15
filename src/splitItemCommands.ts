import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';

/** Command: splits the item at the cursor position into two items */
export async function onSplitItemAtCursor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const cursor     = editor.selection.active;
    const lineIndex  = cursor.line;
    const text       = doc.lineAt(lineIndex).text;
    const bullet     = parseBullet(text, prefix);
    const numbered   = parseNumbered(text);

    if (!bullet && !numbered) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item to split it');
        return;
    }

    const chevrons  = bullet?.chevrons ?? numbered!.chevrons;
    const content   = bullet?.content  ?? numbered!.content;
    const num       = numbered?.num ?? null;

    // Find cursor offset within the content portion of the line
    const linePrefix = num !== null ? `${chevrons} ${num}. ` : `${chevrons} ${prefix} `;
    const contentStart = linePrefix.length;
    const cursorInContent = Math.max(0, cursor.character - contentStart);

    const beforeSplit = content.slice(0, cursorInContent).trimEnd();
    const afterSplit  = content.slice(cursorInContent).trimStart();

    if (!beforeSplit || !afterSplit) {
        vscode.window.showInformationMessage('CL: Place cursor inside the item content to split');
        return;
    }

    const makeItem = (c: string, n: number | null) =>
        n !== null ? `${chevrons} ${n}. ${c}` : `${chevrons} ${prefix} ${c}`;

    const nextNum  = num !== null ? num + 1 : null;
    const lineA    = makeItem(beforeSplit, num);
    const lineB    = makeItem(afterSplit, nextNum);

    await editor.edit(eb =>
        eb.replace(doc.lineAt(lineIndex).range, `${lineA}\n${lineB}`)
    );

    // Place cursor at start of second item
    const pos = new vscode.Position(lineIndex + 1, lineB.length);
    editor.selection = new vscode.Selection(pos, pos);
}
