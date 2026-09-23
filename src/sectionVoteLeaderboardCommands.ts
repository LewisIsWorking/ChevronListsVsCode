import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { parseVote } from './voteParser';
import { getSectionRange, findHeaderAbove } from './documentUtils';

interface VoteItem extends vscode.QuickPickItem { lineIndex: number; }

/** Command: shows items in the current section ranked by +N vote count */
export async function onShowSectionVoteLeaderboard(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const name        = doc.lineAt(headerLine).text.replace(/^> /, '').trim();
    const [, end]     = getSectionRange(doc, headerLine);
    const ranked: Array<{ content: string; votes: number; line: number }> = [];

    for (let i = headerLine + 1; i <= end; i++) {
        const text    = doc.lineAt(i).text;
        const content = parseBullet(text, prefix)?.content ?? parseNumbered(text)?.content ?? null;
        if (!content) { continue; }
        const vote = parseVote(content);
        if (!vote) { continue; }
        ranked.push({ content, votes: vote.count, line: i });
    }

    if (ranked.length === 0) {
        vscode.window.showInformationMessage(`CL: "${name}" - no voted items found (use +N)`);
        return;
    }

    ranked.sort((a, b) => b.votes - a.votes);
    const items: VoteItem[] = ranked.map((r, i) => ({
        label:       `$(star-full) +${r.votes}  ${r.content.slice(0, 60)}`,
        description: `#${i + 1}`,
        lineIndex:   r.line,
    }));

    const originalPos = editor.selection.active;
    const pick = vscode.window.createQuickPick<VoteItem>();
    pick.items       = items;
    pick.placeholder = `"${name}" - ${items.length} voted item${items.length === 1 ? '' : 's'}`;
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
