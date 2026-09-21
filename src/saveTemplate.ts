import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange } from './documentUtils';
import { findHeaderAbove } from './documentUtils';
import type { ChevronTemplate } from './templateData';

/** Converts the section at the cursor into a snippet body with Tab stops */
function sectionToSnippetBody(
    document: vscode.TextDocument,
    prefix: string,
    headerLine: number
): string {
    const [, end] = getSectionRange(document, headerLine);
    const headerName = document.lineAt(headerLine).text.replace(/^> /, '');
    const lines: string[] = [`> \${1:${headerName}}`];
    let tabStop = 2;

    for (let i = headerLine + 1; i <= end; i++) {
        const text    = document.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        if (bullet) {
            lines.push(`${bullet.chevrons} ${prefix} \${${tabStop++}:${bullet.content || 'item'}}`);
        } else if (numbered) {
            lines.push(`${numbered.chevrons} ${numbered.num}. \${${tabStop++}:${numbered.content || 'item'}}`);
        }
    }
    lines.push('$0');
    return lines.join('\n');
}

/** Command: saves the current section as a user-defined template */
export async function onSaveSectionAsTemplate(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const cursor     = editor.selection.active;
    const headerLine = findHeaderAbove(editor.document, cursor.line);

    if (headerLine < 0) {
        vscode.window.showInformationMessage('CL: No section header found at cursor');
        return;
    }

    const defaultName = editor.document.lineAt(headerLine).text.replace(/^> /, '');

    const name = await vscode.window.showInputBox({
        prompt:      'Template name',
        value:       defaultName,
        placeHolder: 'e.g. My Custom Template',
    });
    if (!name?.trim()) { return; }

    const description = await vscode.window.showInputBox({
        prompt:      'Short description',
        placeHolder: 'e.g. Standard project kickoff structure',
    });
    if (description === undefined) { return; }

    const body = sectionToSnippetBody(editor.document, prefix, headerLine);
    const cfg  = vscode.workspace.getConfiguration('chevron-lists');
    const existing = cfg.get<ChevronTemplate[]>('templates', []);

    await cfg.update(
        'templates',
        [...existing, { name: name.trim(), description: description.trim(), body }],
        vscode.ConfigurationTarget.Global
    );

    vscode.window.showInformationMessage(`CL: Template "${name.trim()}" saved`);
}
