import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { openDueDate } from './dueDateParser';

const DUE_SOON_DAYS  = 3;

const DUE_SOON_DEC = vscode.window.createTextEditorDecorationType({
    after: {
        contentText:     ' ⏰ due soon',
        color:           new vscode.ThemeColor('editorWarning.foreground'),
        fontStyle:       'italic',
        margin:          '0 0 0 .5em',
    },
});

const OVERDUE_DEC = vscode.window.createTextEditorDecorationType({
    after: {
        contentText:     ' ⚠ overdue',
        color:           new vscode.ThemeColor('editorError.foreground'),
        fontStyle:       'italic',
        margin:          '0 0 0 .5em',
    },
});

/** Updates due-soon and overdue inline ghost text decorations */
export function updateDueSoonDecorations(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }   = getConfig();
    const doc          = editor.document;
    const today        = new Date();
    today.setHours(0, 0, 0, 0);
    const soonDate     = new Date(today);
    soonDate.setDate(soonDate.getDate() + DUE_SOON_DAYS);

    const overdueRanges:  vscode.Range[] = [];
    const dueSoonRanges:  vscode.Range[] = [];

    for (let i = 0; i < doc.lineCount; i++) {
        const text    = doc.lineAt(i).text;
        const content = parseBullet(text, prefix)?.content ?? parseNumbered(text)?.content ?? null;
        if (!content) { continue; }
        const m = openDueDate(content);
        if (!m) { continue; }
        const [y, mo, d] = m.split('-').map(Number);
        const due = new Date(y, mo - 1, d);
        const range = new vscode.Range(i, doc.lineAt(i).range.end.character, i, doc.lineAt(i).range.end.character);
        if (due < today)       { overdueRanges.push(range); }
        else if (due <= soonDate) { dueSoonRanges.push(range); }
    }

    editor.setDecorations(OVERDUE_DEC,   overdueRanges);
    editor.setDecorations(DUE_SOON_DEC,  dueSoonRanges);
}
