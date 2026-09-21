import * as vscode from 'vscode';
import { isHeader } from './patterns';
import { sectionBlockInsert } from './lineEdits';

const TOC_HEADER = 'Table of Contents';

/** Command: inserts a linked table of contents at the cursor */
export async function onInsertTableOfContents(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc = editor.document;
    const headers: string[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        const name = text.replace(/^> /, '').trim();
        // A table of contents from an earlier run is not a section to list.
        if (isHeader(text) && name !== TOC_HEADER) { headers.push(name); }
    }

    if (headers.length === 0) {
        vscode.window.showInformationMessage('CL: No sections found to build a table of contents');
        return;
    }

    const ins = sectionBlockInsert(doc, editor.selection.active.line, [
        `> ${TOC_HEADER}`,
        ...headers.map(h => `>> - [[${h}]]`),
    ]);
    await editor.edit(eb => eb.insert(ins.position, ins.text));
    vscode.window.showInformationMessage(`CL: Inserted table of contents with ${headers.length} section${headers.length === 1 ? '' : 's'}`);
}
