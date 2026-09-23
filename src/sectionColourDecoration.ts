import * as vscode from 'vscode';
import { isHeader, parseSectionColour } from './patterns';

/** Hex values matching the [colour:X] tag options */
const COLOUR_HEX: Record<string, string> = {
    red:    '#E06C75',
    green:  '#98C379',
    blue:   '#61AFEF',
    yellow: '#E5C07B',
    orange: '#FF9800',
    purple: '#C792EA',
};

/** One decoration type per colour, created lazily */
const decorationTypes = new Map<string, vscode.TextEditorDecorationType>();

function getDecType(colour: string): vscode.TextEditorDecorationType {
    if (!decorationTypes.has(colour)) {
        decorationTypes.set(colour, vscode.window.createTextEditorDecorationType({
            color: COLOUR_HEX[colour],
            fontWeight: 'bold',
        }));
    }
    return decorationTypes.get(colour)!;
}

/** Updates section header colour decorations based on [colour:X] tags */
export function updateSectionColourDecorations(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const doc = editor.document;

    // Collect ranges per colour
    const rangesByColour = new Map<string, vscode.Range[]>();
    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (!isHeader(text)) { continue; }
        const colour = parseSectionColour(text);
        if (!colour) { continue; }
        if (!rangesByColour.has(colour)) { rangesByColour.set(colour, []); }
        rangesByColour.get(colour)!.push(doc.lineAt(i).range);
    }

    // Apply decorations - clear colours that have no ranges
    for (const colour of Object.keys(COLOUR_HEX)) {
        editor.setDecorations(getDecType(colour), rangesByColour.get(colour) ?? []);
    }
}
