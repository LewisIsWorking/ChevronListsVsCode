import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, isHeader } from './patterns';
import { parseVote } from './voteParser';

interface VoteItem extends vscode.QuickPickItem { lineIndex: number; votes: number; }

/** Command: shows all +N voted items across the file sorted by vote count */
export async function onShowVoteLeaderboard(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const items: VoteItem[] = [];
    let section = '';

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (isHeader(text)) { section = text.replace(/^> /, '').trim(); continue; }
        const bullet   = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const vote = parseVote(content);
        if (!vote || vote.count <= 0) { continue; }
        items.push({
            label:       `$(star-full) +${vote.count}  ${content.replace(/\+\d+/, '').trim()}`,
            description: section,
            lineIndex:   i,
            votes:       vote.count,
        });
    }

    if (items.length === 0) {
        vscode.window.showInformationMessage('CL: No voted items found (use +N in item content)');
        return;
    }

    items.sort((a, b) => b.votes - a.votes);
    const pick        = vscode.window.createQuickPick<VoteItem>();
    pick.items        = items;
    pick.placeholder  = `${items.length} voted item${items.length === 1 ? '' : 's'} - sorted by votes`;
    const originalPos = editor.selection.active;
    pick.onDidChangeActive(active => {
        if (!active[0]) { return; }
        const pos = new vscode.Position(active[0].lineIndex, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    });
    pick.onDidAccept(() => { pick.hide(); });
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) { editor.selection = new vscode.Selection(originalPos, originalPos); }
        pick.dispose();
    });
    pick.show();
}
