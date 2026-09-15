import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';
import { stripAllMetadata } from './metadataStripper';

type ExportFormat = 'Markdown' | 'Plain Text' | 'JSON' | 'CSV' | 'HTML';

const FORMATS: ExportFormat[] = ['Markdown', 'Plain Text', 'JSON', 'CSV', 'HTML'];

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Command: copy current section in a chosen format */
export async function onCopySectionAs(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const format = await vscode.window.showQuickPick(
        FORMATS.map(f => ({ label: f })),
        { placeHolder: 'Copy section as…' }
    );
    if (!format) { return; }

    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const sectionName = doc.lineAt(headerLine).text.replace(/^> /, '');
    const [, end]     = getSectionRange(doc, headerLine);
    const items: Array<{ content: string; plain: string; depth: number; num: number | null }> = [];

    for (let i = headerLine + 1; i <= end; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        if (!bullet && !numbered) { continue; }
        const content = bullet?.content ?? numbered!.content;
        const depth   = (bullet?.chevrons ?? numbered!.chevrons).length - 2;
        items.push({ content, plain: stripAllMetadata(content), depth, num: numbered?.num ?? null });
    }

    let output = '';
    switch (format.label as ExportFormat) {
        case 'Markdown':
            // Numbered items keep their number, as in Copy Section as Markdown;
            // they used to come out as "- " bullets.
            output = `## ${sectionName}\n\n` + items.map(i =>
                `${'  '.repeat(i.depth)}${i.num !== null ? `${i.num}.` : '-'} ${i.content}`).join('\n');
            break;
        case 'Plain Text':
            output = `${sectionName}\n\n` + items.map(i =>
                `${'  '.repeat(i.depth)}${i.num !== null ? `${i.num}. ` : '• '}${i.plain}`).join('\n');
            break;
        case 'JSON':
            output = JSON.stringify({ section: sectionName, items: items.map((i, idx) => ({ index: idx + 1, content: i.content, plain: i.plain, depth: i.depth })) }, null, 2);
            break;
        case 'CSV':
            output = 'index,depth,content\n' + items.map((i, idx) =>
                `${idx + 1},${i.depth},"${i.plain.replace(/"/g, '""')}"`).join('\n');
            break;
        case 'HTML':
            output = `<section>\n<h2>${escapeHtml(sectionName)}</h2>\n<ul>\n` +
                items.map(i => `  <li>${escapeHtml(i.plain)}</li>`).join('\n') +
                '\n</ul>\n</section>';
            break;
    }

    await vscode.env.clipboard.writeText(output);
    vscode.window.showInformationMessage(`CL: Copied as ${format.label}`);
}
