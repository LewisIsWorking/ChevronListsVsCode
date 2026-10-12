import * as vscode from 'vscode';
import { getConfig } from './config';
import { findSets, setSummary } from './sets';

const TOTALS_DECORATION = vscode.window.createTextEditorDecorationType({
    after: {
        margin:    '0 0 0 1em',
        color:     new vscode.ThemeColor('editorLineNumber.foreground'),
        fontStyle: 'normal',
    },
});

/** Shows each `#set` heading's totals after it, such as "23 Paid, 3 Hasn't paid, 3 Not going, 28 in all" */
export function updateSetTotalsDecorations(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const lines      = Array.from({ length: doc.lineCount }, (_, i) => doc.lineAt(i).text);
    const options: vscode.DecorationOptions[] = [];
    for (const set of findSets(lines)) {
        const summary = setSummary(lines, set.headingLine, prefix);
        if (!summary) { continue; }
        options.push({
            range: doc.lineAt(set.headingLine).range,
            renderOptions: { after: { contentText: summary } },
        });
    }
    editor.setDecorations(TOTALS_DECORATION, options);
}
