import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { parseVote, setVoteCount } from './voteParser';
import { sortSectionBy } from './sortCommands';

/** Adjusts vote count on the item at the cursor by delta (+1 or -1) */
async function adjustVote(delta: 1 | -1): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const text       = doc.lineAt(lineIndex).text;
    const bullet     = parseBullet(text, prefix);
    const numbered   = parseNumbered(text);
    if (!bullet && !numbered) { vscode.window.showInformationMessage('CL: Place cursor on a chevron item to vote'); return; }

    const chevrons   = bullet?.chevrons ?? numbered!.chevrons;
    const content    = bullet?.content  ?? numbered!.content;
    const num        = numbered?.num ?? null;
    const current    = parseVote(content)?.count ?? 0;
    const newCount   = Math.max(0, current + delta);
    const newContent = setVoteCount(content, newCount);
    const newLine    = num !== null ? `${chevrons} ${num}. ${newContent}` : `${chevrons} ${prefix} ${newContent}`;
    await editor.edit(eb => eb.replace(doc.lineAt(lineIndex).range, newLine));
}

const votesOf = (content: string): number => parseVote(content)?.count ?? 0;

/** Command: sorts items in the current section by vote count, most first, keeping nested items with their parent */
export const onSortByVotes = () => sortSectionBy((a, b) => votesOf(b) - votesOf(a));

export const onAddVote    = () => adjustVote(1);
export const onRemoveVote = () => adjustVote(-1);
