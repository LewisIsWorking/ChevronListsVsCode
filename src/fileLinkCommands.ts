import * as vscode from 'vscode';
import * as path from 'path';
import { extractFileLinks, type FileLink } from './fileLinkParser';
import { findHeaderLine } from './linkParser';

/** Finds the [[file:...]] link under the cursor */
function getFileLinkAtCursor(editor: vscode.TextEditor): FileLink | undefined {
    const lineIndex = editor.selection.active.line;
    const col       = editor.selection.active.character;
    const links     = extractFileLinks(editor.document.lineAt(lineIndex).text, lineIndex);
    return links.find(l => col >= l.start && col <= l.end);
}

/** Resolves a filename relative to the current document */
function resolveFile(document: vscode.TextDocument, filename: string): vscode.Uri {
    const dir = path.dirname(document.fileName);
    return vscode.Uri.file(path.join(dir, filename));
}

/** Command: opens the linked file under the cursor, at the section if the link names one */
export async function onGoToLinkedFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const link = getFileLinkAtCursor(editor);
    if (!link) { vscode.window.showInformationMessage('CL: No [[file:...]] link found at cursor'); return; }
    const { filename, section } = link;

    const uri = resolveFile(editor.document, filename);
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        const opened   = await vscode.window.showTextDocument(document);
        if (!section) { return; }
        const line = findHeaderLine(document, section);
        if (line < 0) { vscode.window.showWarningMessage(`CL: Section "${section}" not found in ${filename}`); return; }
        const position = new vscode.Position(line, 0);
        opened.selection = new vscode.Selection(position, position);
        opened.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    } catch {
        vscode.window.showErrorMessage(`CL: Could not open file "${filename}"`);
    }
}

/** Hover provider: shows first line of linked file on hover */
export class ChevronFileLinkHoverProvider implements vscode.HoverProvider {
    async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
        const links = extractFileLinks(document.lineAt(position.line).text, position.line);
        const link  = links.find(l => position.character >= l.start && position.character <= l.end);
        if (!link) { return; }

        const uri = resolveFile(document, link.filename);
        try {
            const linkedDoc  = await vscode.workspace.openTextDocument(uri);
            const firstLines = Array.from({ length: Math.min(5, linkedDoc.lineCount) }, (_, i) =>
                linkedDoc.lineAt(i).text
            ).filter(Boolean).join('\n');
            const md = new vscode.MarkdownString(`**${link.filename}**\n\n\`\`\`\n${firstLines}\n\`\`\``);
            return new vscode.Hover(md);
        } catch {
            return new vscode.Hover(new vscode.MarkdownString(`**${link.filename}** *(file not found)*`));
        }
    }
}
