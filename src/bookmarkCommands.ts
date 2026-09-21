import * as vscode from 'vscode';
import { collectBookmarks, parseBookmark } from './bookmarkParser';
import { wholeLineRange } from './lineEdits';

interface BookmarkPickItem extends vscode.QuickPickItem { lineIndex: number; }

/** Command: inserts a bookmark marker at the cursor */
export async function onAddBookmark(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const name = await vscode.window.showInputBox({
        prompt:      'Bookmark name',
        placeHolder: 'e.g. Chapter 3 start, Key decision point',
    });
    if (!name?.trim()) { return; }

    const insertPos = new vscode.Position(editor.selection.active.line, 0);
    await editor.edit(eb => eb.insert(insertPos, `>> [bookmark:${name.trim()}]\n`));
}

/** Command: shows a quick pick of all bookmarks in the file */
export async function onJumpToBookmark(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const bookmarks = collectBookmarks(editor.document);

    if (bookmarks.length === 0) {
        vscode.window.showInformationMessage('CL: No bookmarks found (use CL: Add Bookmark to add one)');
        return;
    }

    const pick = vscode.window.createQuickPick<BookmarkPickItem>();
    pick.items = bookmarks.map(b => ({ label: `$(bookmark) ${b.name}`, lineIndex: b.line }));
    pick.placeholder = 'Jump to a bookmark...';

    const originalPos = editor.selection.active;
    pick.onDidChangeActive(active => {
        if (!active[0]) { return; }
        const pos = new vscode.Position(active[0].lineIndex, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    });
    pick.onDidAccept(() => { pick.hide(); });
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) {
            const pos = new vscode.Position(originalPos.line, originalPos.character);
            editor.selection = new vscode.Selection(pos, pos);
        }
        pick.dispose();
    });
    pick.show();
}

/** Command: removes the bookmark on the current line */
export async function onRemoveBookmark(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const lineIndex = editor.selection.active.line;
    if (!parseBookmark(editor.document.lineAt(lineIndex).text)) {
        vscode.window.showInformationMessage('CL: No bookmark found on this line');
        return;
    }

    await editor.edit(eb =>
        eb.delete(wholeLineRange(editor.document, lineIndex))
    );
}
