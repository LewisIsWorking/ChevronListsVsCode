import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { parseCreatedDate, ageInDays } from './itemAgeParser';

const OLD_ITEM_DECORATION = vscode.window.createTextEditorDecorationType({
    opacity: '0.55',
    fontStyle: 'italic',
});

/** Updates the age-highlight decorations - items older than 30 days are muted */
export function updateAgeDecorations(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const today      = new Date();
    const old: vscode.DecorationOptions[] = [];

    for (let i = 0; i < doc.lineCount; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const dateStr = parseCreatedDate(content);
        if (!dateStr) { continue; }
        if (ageInDays(dateStr, today) >= 30) {
            old.push({ range: doc.lineAt(i).range });
        }
    }
    editor.setDecorations(OLD_ITEM_DECORATION, old);
}
