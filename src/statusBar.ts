import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { parseCheck } from './checkParser';
import { parseWordCountGoal } from './wordGoalParser';
import { getSectionRange } from './documentUtils';
import { findHeaderAbove } from './documentUtils';
import { itemWordCount } from './metadataStripper';

let statusBarItem: vscode.StatusBarItem | undefined;

/** Creates and returns the status bar item (call once in activate) */
export function createStatusBar(): vscode.StatusBarItem {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    return statusBarItem;
}

/** Counts words in all items of a section (start to end inclusive) */
function countSectionWords(document: vscode.TextDocument, prefix: string, start: number, end: number): number {
    let words = 0;
    for (let i = start + 1; i <= end; i++) {
        const text    = document.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (content) { words += itemWordCount(content); }
    }
    return words;
}

/** Updates the status bar with section, item, completion and word-goal counts */
export function updateStatusBar(editor?: vscode.TextEditor): void {
    if (!statusBarItem) { return; }
    if (!editor || editor.document.languageId !== 'markdown') {
        statusBarItem.hide();
        return;
    }
    const { prefix } = getConfig();
    const doc        = editor.document;
    let sections = 0, items = 0, done = 0, total = 0;

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (isHeader(text)) {
            sections++;
        } else {
            const bullet  = parseBullet(text, prefix);
            const numbered = parseNumbered(text);
            const content  = bullet?.content ?? numbered?.content ?? null;
            if (content !== null) {
                items++;
                const check = parseCheck(content);
                if (check) { total++; if (check.state === 'done') { done++; } }
            }
        }
    }

    // Word count goal for current section
    let goalPart = '';
    const cursorLine = editor.selection.active.line;
    const headerLine = findHeaderAbove(doc, cursorLine);
    if (headerLine >= 0) {
        const headerText = doc.lineAt(headerLine).text;
        const goal       = parseWordCountGoal(headerText);
        if (goal !== null) {
            const [start, end] = getSectionRange(doc, headerLine);
            const words        = countSectionWords(doc, prefix, start, end);
            goalPart           = `  $(book) ${words}/${goal}w`;
        }
    }

    const checkPart = total > 0 ? `  $(check) ${done}/${total}` : '';
    statusBarItem.text    = `$(list-unordered) ${sections}  $(symbol-enum-member) ${items}${checkPart}${goalPart}`;

    // Rich tooltip with full stats
    const md = new vscode.MarkdownString(
        `**Chevron Lists**\n\n` +
        `Sections: ${sections}  ·  Items: ${items}` +
        (total > 0 ? `  ·  Done: ${done}/${total} (${Math.round((done/total)*100)}%)` : '') +
        (goalPart ? `  ·  Word goal active` : '') +
        `\n\n_Click to open statistics panel_`
    );
    md.isTrusted = true;
    statusBarItem.tooltip = md;
    statusBarItem.command = 'chevron-lists.showStatistics';
    statusBarItem.show();
}
