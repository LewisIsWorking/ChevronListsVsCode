import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange } from './documentUtils';
import { appendBlock, lineAfter, wholeLineRanges } from './lineEdits';
import { parseCheck } from './checkParser';
import { parseCreatedDate, ageInDays } from './itemAgeParser';

/** Command: archives [x] done items older than N days to > Archive */
export async function onArchiveOldDoneItems(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const input = await vscode.window.showInputBox({
        prompt:       'Archive done items older than how many days?',
        value:        '30',
        validateInput: v => /^\d+$/.test(v.trim()) && Number(v.trim()) > 0 ? null : 'Enter a positive integer',
    });
    if (!input?.trim()) { return; }

    const { prefix } = getConfig();
    const days       = Number(input.trim());
    const dayWord    = `${days} day${days === 1 ? '' : 's'}`;
    const doc        = editor.document;
    const today      = new Date();

    // Items already in the Archive stay where they are. They used to be counted
    // again and moved back to the top of the Archive on every run.
    let archiveLine = -1;
    for (let i = 0; i < doc.lineCount; i++) {
        if (doc.lineAt(i).text.toLowerCase() === '> archive') { archiveLine = i; break; }
    }
    const [archiveStart, archiveEnd] = archiveLine >= 0 ? getSectionRange(doc, archiveLine) : [-1, -1];

    const toArchive: number[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
        if (i >= archiveStart && i <= archiveEnd) { continue; }
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const check = parseCheck(content);
        if (check?.state !== 'done') { continue; }
        const dateStr = parseCreatedDate(content);
        if (!dateStr || ageInDays(dateStr, today) < days) { continue; }
        toArchive.push(i);
    }

    if (toArchive.length === 0) {
        vscode.window.showInformationMessage(`CL: No done items older than ${dayWord} found`);
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `Archive ${toArchive.length} done item${toArchive.length === 1 ? '' : 's'} older than ${dayWord}?`,
        { modal: true }, 'Archive'
    );
    if (confirm !== 'Archive') { return; }

    // One insertion for all the items, in document order. Inserting each item on
    // its own put them into the Archive in reverse, and with no Archive section
    // created a new "> Archive" header for every item.
    const archived = toArchive.map(line => doc.lineAt(line).text).join('\n');
    await editor.edit(eb => {
        for (const range of wholeLineRanges(doc, toArchive)) { eb.delete(range); }
        const ins = archiveLine >= 0
            ? lineAfter(doc, archiveLine, archived)
            : appendBlock(doc, `> Archive\n${archived}`, toArchive);
        eb.insert(ins.position, ins.text);
    });

    vscode.window.showInformationMessage(`CL: Archived ${toArchive.length} item${toArchive.length === 1 ? '' : 's'}`);
}
