import * as vscode from 'vscode';
import * as path from 'path';
import { isHeader } from './patterns';
import { getSectionRange } from './documentUtils';
import type { ChevronTemplate } from './templateData';

/**
 * Escapes the characters VS Code snippet syntax treats specially. Item text was
 * pasted into placeholders as-is, so "costs $5" became a tab stop and a "}"
 * ended its placeholder early.
 */
function escapeSnippet(text: string): string {
    return text.replace(/[\\$}]/g, '\\$&');
}

/** Turns a snippet body back into the text it inserts: placeholders become their defaults. */
function snippetToText(body: string): string {
    return body
        .replace(/\$\{[0-9]+:((?:\\.|[^}\\])*)\}/g, '$1')
        .replace(/(?<!\\)\$[0-9]+/g, '')
        .replace(/\\([\\$}])/g, '$1');
}

/** Command: imports all sections from a .md file as named templates */
export async function onImportTemplatesFromFile(): Promise<void> {
    const fileUris = await vscode.window.showOpenDialog({
        filters: { 'Markdown Files': ['md'] },
        canSelectMany: false,
        openLabel: 'Import Templates from File',
    });
    if (!fileUris?.length) { return; }

    const doc = await vscode.workspace.openTextDocument(fileUris[0]);
    const imported: ChevronTemplate[] = [];

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (!isHeader(text)) { continue; }
        const name     = text.replace(/^> /, '');
        const [, end]  = getSectionRange(doc, i);
        const bodyLines = [`> \${1:${escapeSnippet(name)}}`];
        let   tabStop  = 2;
        for (let j = i + 1; j <= end; j++) {
            // Lines at every depth: only ">> " lines used to be imported, so nested
            // items were silently dropped from the template.
            const item = /^(>{2,} \S+ )(.*)$/.exec(doc.lineAt(j).text);
            if (!item) { continue; }
            bodyLines.push(`${item[1]}\${${tabStop++}:${escapeSnippet(item[2] || 'item')}}`);
        }
        bodyLines.push('$0');
        imported.push({ name, description: `Imported from ${path.basename(fileUris[0].fsPath)}`, body: bodyLines.join('\n') });
    }

    if (imported.length === 0) {
        vscode.window.showInformationMessage('CL: No sections found in the selected file');
        return;
    }

    const cfg      = vscode.workspace.getConfiguration('chevron-lists');
    const existing = cfg.get<ChevronTemplate[]>('templates', []);
    await cfg.update('templates', [...existing, ...imported], vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`CL: Imported ${imported.length} template${imported.length === 1 ? '' : 's'}`);
}

/** Command: exports all user-defined templates to a .md file */
export async function onExportTemplatesToFile(): Promise<void> {
    const cfg       = vscode.workspace.getConfiguration('chevron-lists');
    const templates = cfg.get<ChevronTemplate[]>('templates', []);

    if (templates.length === 0) {
        vscode.window.showInformationMessage('CL: No user-defined templates to export');
        return;
    }

    const saveUri = await vscode.window.showSaveDialog({ filters: { 'Markdown Files': ['md'] } });
    if (!saveUri) { return; }

    // A body that starts with its own "> Header" line is written as it is. Adding
    // "> name" on top wrote every imported template's header twice, and importing
    // that file again produced an extra, empty template.
    const content = templates.map(t => {
        const text = snippetToText(t.body).replace(/\s+$/, '');
        return isHeader(text.split('\n')[0]) ? text : `> ${t.name}\n${text}`;
    }).join('\n\n') + '\n';

    await vscode.workspace.fs.writeFile(saveUri, Buffer.from(content, 'utf-8'));
    vscode.window.showInformationMessage(`CL: Exported ${templates.length} template${templates.length === 1 ? '' : 's'}`);
}
