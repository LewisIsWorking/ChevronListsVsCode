import * as vscode from 'vscode';
import { getConfig } from './config';
import { convertToObsidian } from './patterns';

/** Command: exports the current file as Obsidian-compatible markdown in a side panel */
export async function onExportToObsidian(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc    = editor.document;
    const lines  = Array.from({ length: doc.lineCount }, (_, i) => doc.lineAt(i).text);
    const result = convertToObsidian(lines, prefix);
    const mdDoc  = await vscode.workspace.openTextDocument({ content: result, language: 'markdown' });
    await vscode.window.showTextDocument(mdDoc, vscode.ViewColumn.Beside);
    vscode.window.showInformationMessage('CL: Obsidian export ready - save the file to use in Obsidian');
}
