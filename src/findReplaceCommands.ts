import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange } from './documentUtils';
import { findHeaderAbove } from './documentUtils';

/** Command: find and replace within the current section's items only */
export async function onReplaceInSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const find = await vscode.window.showInputBox({ prompt: 'Find text in section items', placeHolder: 'Search term' });
    if (!find?.trim()) { return; }

    const replace = await vscode.window.showInputBox({ prompt: `Replace "${find}" with`, placeHolder: 'Replacement (leave blank to delete)' });
    if (replace === undefined) { return; }

    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const [, end] = getSectionRange(doc, headerLine);
    let count = 0;

    await editor.edit(eb => {
        for (let i = headerLine + 1; i <= end; i++) {
            const text    = doc.lineAt(i).text;
            const bullet  = parseBullet(text, prefix);
            const numbered = parseNumbered(text);
            if (!bullet && !numbered) { continue; }
            // Only the item's words. The whole line used to be searched, so
            // replacing "-" or "1" rewrote the list marker or the number.
            const content = bullet?.content ?? numbered!.content;
            const pieces  = content.split(find);
            if (pieces.length < 2) { continue; }
            const marker  = text.slice(0, text.length - content.length);
            eb.replace(doc.lineAt(i).range, marker + pieces.join(replace));
            count += pieces.length - 1;
        }
    });

    vscode.window.showInformationMessage(
        count > 0
            ? `CL: Replaced ${count} occurrence${count === 1 ? '' : 's'} in section`
            : `CL: No occurrences of "${find}" found in section`
    );
}

/** Command: find items in the current file matching a search term */
export async function onFindInSections(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const term = await vscode.window.showInputBox({ prompt: 'Search item content', placeHolder: 'Search term' });
    if (!term?.trim()) { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    interface ResultItem extends vscode.QuickPickItem { lineIndex: number; }
    const results: ResultItem[] = [];
    let section = '';

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (text.startsWith('> ') && !text.startsWith('>> ')) { section = text.replace(/^> /, ''); continue; }
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content || !content.toLowerCase().includes(term.toLowerCase())) { continue; }
        results.push({ label: content, description: section, lineIndex: i });
    }

    if (results.length === 0) {
        vscode.window.showInformationMessage(`CL: No items matching "${term}"`);
        return;
    }

    const pick = vscode.window.createQuickPick<ResultItem>();
    pick.items = results;
    pick.placeholder = `${results.length} item${results.length === 1 ? '' : 's'} matching "${term}"`;

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
