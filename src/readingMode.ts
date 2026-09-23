import * as vscode from 'vscode';
import { getConfig } from './config';
import { buildHtml } from './htmlExporter';
import * as path from 'path';

let readingPanel: vscode.WebviewPanel | undefined;
/** The live-update listener for the document currently shown in the panel */
let readingSub: vscode.Disposable | undefined;

/** Command: opens the current file in a clean reading mode webview */
export function onEnterReadingMode(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
        vscode.window.showInformationMessage('CL: Open a markdown file to enter reading mode');
        return;
    }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const fileName   = path.basename(doc.fileName, path.extname(doc.fileName));

    if (readingPanel) {
        readingPanel.reveal();
    } else {
        readingPanel = vscode.window.createWebviewPanel(
            'chevron-lists.reading',
            `${fileName} - Reading Mode`,
            vscode.ViewColumn.Beside,
            { enableScripts: false }
        );
        readingPanel.onDidDispose(() => {
            readingSub?.dispose();
            readingSub   = undefined;
            readingPanel = undefined;
        });
    }

    // Reusing the panel for another file: retitle it and stop listening to the
    // previous file. Every call used to add a listener that lived as long as
    // the panel, so edits to the first file flipped the panel back to it.
    readingPanel.title = `${fileName} - Reading Mode`;
    readingPanel.webview.html = buildHtml(doc, prefix, fileName);

    // Live-update when the document changes
    readingSub?.dispose();
    readingSub = vscode.workspace.onDidChangeTextDocument(event => {
        if (readingPanel && event.document === doc) {
            readingPanel.webview.html = buildHtml(doc, prefix, fileName);
        }
    });
}
