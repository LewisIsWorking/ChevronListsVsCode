import * as vscode from 'vscode';
import { getConfig } from './config';
import { collectRecurringItems, nextOccurrence } from './recurrenceParser';
import { extractDate } from './dueDateParser';
import { parseBullet, parseNumbered, todayDate } from './patterns';

interface RecurPickItem extends vscode.QuickPickItem {
    lineIndex: number;
}

function revealLine(editor: vscode.TextEditor, lineIndex: number): void {
    const pos = new vscode.Position(lineIndex, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/** Command: lists all recurring items in the file */
export async function onShowRecurring(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const items      = collectRecurringItems(editor.document, prefix);

    if (items.length === 0) {
        vscode.window.showInformationMessage('CL: No recurring items found (use @daily, @weekly, or @monthly in item content)');
        return;
    }

    const pick = vscode.window.createQuickPick<RecurPickItem>();
    pick.items = items.map(item => ({
        label:       `$(sync) @${item.type} — ${item.content}`,
        description: item.section,
        lineIndex:   item.line,
    }));
    pick.placeholder = 'Recurring items in this file';

    const originalPos = editor.selection.active;
    pick.onDidChangeActive(active => {
        if (active[0]) { revealLine(editor, active[0].lineIndex); }
    });
    pick.onDidAccept(() => {
        if (pick.activeItems[0]) { revealLine(editor, pick.activeItems[0].lineIndex); }
        pick.hide();
    });
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) {
            const pos = new vscode.Position(originalPos.line, originalPos.character);
            editor.selection = new vscode.Selection(pos, pos);
        }
        pick.dispose();
    });
    pick.show();
}

/** Command: clones the recurring item at the cursor with the next due date */
export async function onGenerateNextOccurrence(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix }  = getConfig();
    const doc         = editor.document;
    const lineIndex   = editor.selection.active.line;
    const text        = doc.lineAt(lineIndex).text;
    const bullet      = parseBullet(text, prefix);
    const numbered    = parseNumbered(text);
    const content     = bullet?.content ?? numbered?.content;

    if (!content) {
        vscode.window.showInformationMessage('CL: Place cursor on a recurring item');
        return;
    }

    const recMatch = content.match(/@(daily|weekly|monthly)/i);
    if (!recMatch) {
        vscode.window.showInformationMessage('CL: Item has no @daily/@weekly/@monthly marker');
        return;
    }

    const type      = recMatch[1].toLowerCase() as 'daily' | 'weekly' | 'monthly';
    const dateMatch = extractDate(content);
    const baseDate  = dateMatch?.dateStr ?? todayDate();
    const newDate   = nextOccurrence(baseDate, type);
    // `content` only exists when the line parsed as a bullet or a numbered item,
    // so exactly one of them is set here.
    const source    = (numbered ?? bullet)!;
    // Keep the item's own kind. This used to write `${prefix}` unconditionally,
    // turning `>> 3. Review` into `>> - Review`. A numbered item continues the
    // sequence the same way the Enter handler does.
    const marker    = numbered ? `${numbered.num + 1}.` : prefix;
    const cleanText = content.replace(dateMatch ? `@${dateMatch.dateStr}` : '', '').trim();
    const newItem   = `${source.chevrons} ${marker} ${cleanText} @${newDate}`;

    // Inserting at Position(lineIndex + 1, 0) on the LAST line of a file with no
    // trailing newline targets a position that does not exist, which resolves to
    // the end of the same line and glued the new item onto the old one. Append
    // after a newline there instead.
    const isLastLine = lineIndex === doc.lineCount - 1;
    await editor.edit(eb => {
        if (isLastLine) {
            eb.insert(doc.lineAt(lineIndex).range.end, `\n${newItem}`);
        } else {
            eb.insert(new vscode.Position(lineIndex + 1, 0), `${newItem}\n`);
        }
    });
}
