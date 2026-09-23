import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, isHeader } from './patterns';
import { getSectionRange } from './documentUtils';
import { parseWordCountGoal } from './wordGoalParser';
import { itemWordCount } from './metadataStripper';

let nudgeBar: vscode.StatusBarItem | undefined;

/** Updates the word goal nudge status bar item for the current cursor section */
export function updateWordGoalNudge(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== 'markdown') {
        nudgeBar?.hide();
        return;
    }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const curLine    = editor.selection.active.line;

    // Find the header above the cursor
    let headerLine = -1;
    for (let i = curLine; i >= 0; i--) {
        if (isHeader(doc.lineAt(i).text)) { headerLine = i; break; }
    }
    if (headerLine < 0) { nudgeBar?.hide(); return; }

    const headerText = doc.lineAt(headerLine).text;
    const goal       = parseWordCountGoal(headerText);
    if (!goal) { nudgeBar?.hide(); return; }

    const [, end] = getSectionRange(doc, headerLine);
    let words = 0;
    for (let i = headerLine + 1; i <= end; i++) {
        const t = doc.lineAt(i).text;
        const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
        if (content) { words += itemWordCount(content); }
    }

    const remaining = goal - words;
    if (remaining <= 0) { nudgeBar?.hide(); return; }

    if (!nudgeBar) {
        nudgeBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -50);
        nudgeBar.tooltip = 'Word goal progress - CL: Set Word Count Goal to change';
    }
    nudgeBar.text = `📝 ${remaining} word${remaining === 1 ? '' : 's'} to go`;
    nudgeBar.show();
}
