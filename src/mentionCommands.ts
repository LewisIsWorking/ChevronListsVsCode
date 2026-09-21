import * as vscode from 'vscode';
import { getConfig } from './config';
import { collectMentions, uniqueMentions } from './mentionParser';

interface MentionPickItem extends vscode.QuickPickItem { tag: string; }
interface ItemPickItem extends vscode.QuickPickItem { lineIndex: number; }

function revealLine(editor: vscode.TextEditor, lineIndex: number): void {
    const pos = new vscode.Position(lineIndex, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/** Command: filter items by @mention in the current file */
export async function onFilterByMention(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const names      = uniqueMentions(editor.document, prefix);

    if (names.length === 0) {
        vscode.window.showInformationMessage('CL: No @mentions found (use @Name in item content)');
        return;
    }

    const all      = collectMentions(editor.document, prefix);
    const countOf  = (n: string) => all.filter(m => m.name === n).length;
    const namePick = await vscode.window.showQuickPick(
        names.map(n => {
            const count = countOf(n);
            return { label: `$(person) @${n}`, description: `${count} item${count === 1 ? '' : 's'}`, tag: n };
        }) as MentionPickItem[],
        { placeHolder: 'Select a person to filter items...' }
    );
    if (!namePick) { return; }

    const matches = all.filter(m => m.name === namePick.tag);
    const pick    = vscode.window.createQuickPick<ItemPickItem>();
    pick.items = matches.map(m => ({ label: m.itemText, description: m.section, lineIndex: m.line }));
    pick.placeholder = `Items mentioning @${namePick.tag}`;

    const originalPos = editor.selection.active;
    pick.onDidChangeActive(active => { if (active[0]) { revealLine(editor, active[0].lineIndex); } });
    pick.onDidAccept(() => { if (pick.activeItems[0]) { revealLine(editor, pick.activeItems[0].lineIndex); } pick.hide(); });
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) { const pos = new vscode.Position(originalPos.line, originalPos.character); editor.selection = new vscode.Selection(pos, pos); }
        pick.dispose();
    });
    pick.show();
}
