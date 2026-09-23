import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { getSectionRange } from './documentUtils';

const BADGE_DECORATION = vscode.window.createTextEditorDecorationType({
    after: {
        margin:    '0 0 0 0.75em',
        color:     new vscode.ThemeColor('editorLineNumber.foreground'),
    },
});

let badgesEnabled = false; // off by default - section summary already shows item count

/** Updates the item count badge decorations on all section headers */
export function updateBadgeDecorations(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    if (!badgesEnabled) { editor.setDecorations(BADGE_DECORATION, []); return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const ranges: vscode.DecorationOptions[] = [];

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (!isHeader(text)) { continue; }
        const [, end] = getSectionRange(doc, i);
        let count = 0;
        for (let j = i + 1; j <= end; j++) {
            const t = doc.lineAt(j).text;
            if (parseBullet(t, prefix) || parseNumbered(t)) { count++; }
        }
        const range = doc.lineAt(i).range;
        ranges.push({
            range: new vscode.Range(range.end, range.end),
            renderOptions: { after: { contentText: `  (${count})` } },
        });
    }
    editor.setDecorations(BADGE_DECORATION, ranges);
}

/** Command: toggles the item count badge on all section headers */
export async function onToggleItemCountBadge(): Promise<void> {
    badgesEnabled = !badgesEnabled;
    updateBadgeDecorations(vscode.window.activeTextEditor);
    vscode.window.showInformationMessage(
        `CL: Item count badges ${badgesEnabled ? 'enabled' : 'disabled'}`
    );
}
