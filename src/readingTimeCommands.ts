import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, countWords, formatReadingTime } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';
import { stripAllMetadata } from './metadataStripper';

/** Command: shows estimated reading time for the current section or whole file */
export async function onShowReadingTime(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }   = getConfig();
    const doc          = editor.document;
    const headerLine   = findHeaderAbove(doc, editor.selection.active.line);

    const getContents = (start: number, end: number): string[] => {
        const out: string[] = [];
        for (let i = start; i <= end; i++) {
            const t = doc.lineAt(i).text;
            const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
            if (content) { out.push(stripAllMetadata(content)); }
        }
        return out;
    };

    if (headerLine >= 0) {
        const name    = doc.lineAt(headerLine).text.replace(/^> /, '');
        const [, end] = getSectionRange(doc, headerLine);
        const words   = countWords(getContents(headerLine + 1, end));
        vscode.window.showInformationMessage(
            `CL: "${name}" — ${words} word${words === 1 ? '' : 's'}, ~${formatReadingTime(words)} to read`
        );
    } else {
        const words = countWords(getContents(0, doc.lineCount - 1));
        vscode.window.showInformationMessage(
            `CL: Whole file — ${words} word${words === 1 ? '' : 's'}, ~${formatReadingTime(words)} to read`
        );
    }
}
