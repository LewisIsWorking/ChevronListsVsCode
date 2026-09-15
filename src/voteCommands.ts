import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { parseVote, setVoteCount } from './voteParser';
import { getSectionRange } from './documentUtils';
import { findHeaderAbove } from './documentUtils';

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

/** Command: sorts items in the current section by vote count descending */
export async function onSortByVotes(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const [, end]     = getSectionRange(doc, headerLine);

    const lines: string[] = [];
    for (let i = headerLine + 1; i <= end; i++) { lines.push(doc.lineAt(i).text); }

    const sorted = [...lines].sort((a, b) => {
        const bv = parseBullet(b, prefix) ?? parseNumbered(b);
        const av = parseBullet(a, prefix) ?? parseNumbered(a);
        const bc = bv ? (bv as any).content ?? '' : '';
        const ac = av ? (av as any).content ?? '' : '';
        return (parseVote(bc)?.count ?? 0) - (parseVote(ac)?.count ?? 0);
    }).reverse();

    await editor.edit(eb => {
        sorted.forEach((line, idx) => eb.replace(doc.lineAt(headerLine + 1 + idx).range, line));
    });
}

export const onAddVote    = () => adjustVote(1);
export const onRemoveVote = () => adjustVote(-1);
