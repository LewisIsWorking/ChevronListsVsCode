import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { parseWordCountGoal, headerNameWithoutGoal } from './wordGoalParser';
import { getSectionRange } from './documentUtils';
import { itemWordCount } from './metadataStripper';

// Three decoration types — one per progress band
const makeDecoration = (color: string) => vscode.window.createTextEditorDecorationType({
    after: { margin: '0 0 0 0.5em', color },
    borderStyle: 'none',
    textDecoration: `none; border-bottom: 2px solid ${color}`,
});

const DEC_RED    = makeDecoration('#E06C75');
const DEC_AMBER  = makeDecoration('#E5C07B');
const DEC_GREEN  = makeDecoration('#98C379');

/** Updates the word-goal progress bar decorations on headers */
export function updateGoalDecorations(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const red: vscode.DecorationOptions[]   = [];
    const amber: vscode.DecorationOptions[] = [];
    const green: vscode.DecorationOptions[] = [];

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (!isHeader(text)) { continue; }
        const goal = parseWordCountGoal(text);
        if (goal === null) { continue; }

        const [, end] = getSectionRange(doc, i);
        let words = 0;
        for (let j = i + 1; j <= end; j++) {
            const t = doc.lineAt(j).text;
            const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
            if (content) { words += itemWordCount(content); }
        }

        const pct  = Math.min(words / goal, 1);
        const bars = Math.round(pct * 10);
        const bar  = '▓'.repeat(bars) + '░'.repeat(10 - bars);
        const opt: vscode.DecorationOptions = {
            range: doc.lineAt(i).range,
            renderOptions: { after: { contentText: `  ${bar} ${words}/${goal}` } },
        };
        if (pct >= 1)        { green.push(opt); }
        else if (pct >= 0.7) { amber.push(opt); }
        else                 { red.push(opt); }
    }

    editor.setDecorations(DEC_RED,   red);
    editor.setDecorations(DEC_AMBER, amber);
    editor.setDecorations(DEC_GREEN, green);
}
