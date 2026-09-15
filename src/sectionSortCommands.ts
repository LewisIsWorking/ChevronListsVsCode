import * as vscode from 'vscode';
import { isHeader } from './patterns';

interface SectionBlock { name: string; lines: string[]; }

/** Collects all sections as named blocks of lines */
function collectSectionBlocks(document: vscode.TextDocument): SectionBlock[] {
    const blocks: SectionBlock[] = [];
    let current: SectionBlock | null = null;

    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text;
        if (isHeader(text)) {
            if (current) { blocks.push(current); }
            current = { name: text.replace(/^> /, '').toLowerCase(), lines: [text] };
        } else if (current) {
            current.lines.push(text);
        }
    }
    if (current) { blocks.push(current); }
    return blocks;
}

async function sortSections(ascending: boolean): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc    = editor.document;
    const blocks = collectSectionBlocks(doc);
    if (blocks.length < 2) {
        vscode.window.showInformationMessage('CL: Need at least 2 sections to sort');
        return;
    }

    const sorted = [...blocks].sort((a, b) =>
        ascending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );

    // Find the first header line to determine where sections start
    let firstHeader = 0;
    for (let i = 0; i < doc.lineCount; i++) {
        if (isHeader(doc.lineAt(i).text)) { firstHeader = i; break; }
    }

    const newContent = sorted.map(b => b.lines.join('\n')).join('\n');
    const range      = new vscode.Range(firstHeader, 0, doc.lineCount, 0);

    await editor.edit(eb => eb.replace(range, newContent + '\n'));
    vscode.window.showInformationMessage(`CL: Sorted ${blocks.length} sections ${ascending ? 'A → Z' : 'Z → A'}`);
}

/** Command: sorts all sections A → Z by header name */
export const onSortSectionsAZ = () => sortSections(true);

/** Command: sorts all sections Z → A by header name */
export const onSortSectionsZA = () => sortSections(false);
