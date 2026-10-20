import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { findHeaderAbove, getSectionRange } from './documentUtils';

/** An item as a markdown list line without its indent, and its depth (>> = 0), or null */
function itemToMarkdown(text: string, prefix: string): { depth: number; item: string } | null {
    const numbered = parseNumbered(text);
    if (numbered) { return { depth: numbered.chevrons.length - 2, item: `${numbered.num}. ${numbered.content}` }; }
    const bullet = parseBullet(text, prefix);
    if (bullet) { return { depth: bullet.chevrons.length - 2, item: `- ${bullet.content}` }; }
    return null;
}

/**
 * Indents each item to its parent's text, so it nests under a numbered item
 * too: CommonMark needs three spaces under "1. ", and the two used for every
 * level let the child fall out of the list. With no parent, two spaces a level.
 */
function nestMarkdown(items: { depth: number; item: string }[]): string[] {
    const textColumn: number[] = [];   // by depth, for the latest item at it
    return items.map(({ depth, item }) => {
        textColumn.length = Math.min(textColumn.length, depth);
        const parent = textColumn.filter(c => c !== undefined).pop();
        const indent = parent ?? 2 * depth;
        textColumn[depth] = indent + item.indexOf(' ') + 1;
        return ' '.repeat(indent) + item;
    });
}

/** Copies the current section as standard markdown (heading + list items) */
export async function onCopySectionAsMarkdown(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const { prefix }     = getConfig();
    const headerLine     = findHeaderAbove(editor.document, editor.selection.active.line);
    if (headerLine < 0) { return; }

    const headerText = editor.document.lineAt(headerLine).text;
    const heading    = `## ${headerText.replace(/^> /, '')}`;
    const [, end]    = getSectionRange(editor.document, headerLine);
    const items: { depth: number; item: string }[] = [];

    for (let i = headerLine + 1; i <= end; i++) {
        const md = itemToMarkdown(editor.document.lineAt(i).text, prefix);
        if (md) { items.push(md); }
    }
    const lines = [heading, '', ...nestMarkdown(items)];

    await vscode.env.clipboard.writeText(lines.join('\n'));
    vscode.window.showInformationMessage('Chevron Lists: Section copied as Markdown');
}

/** Copies the current section as plain text (header + item text only, no prefixes) */
export async function onCopySectionAsPlainText(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const { prefix }     = getConfig();
    const headerLine     = findHeaderAbove(editor.document, editor.selection.active.line);
    if (headerLine < 0) { return; }

    const headerText = editor.document.lineAt(headerLine).text.replace(/^> /, '');
    const [, end]    = getSectionRange(editor.document, headerLine);
    const lines: string[] = [headerText, ''];

    for (let i = headerLine + 1; i <= end; i++) {
        const text     = editor.document.lineAt(i).text;
        const bullet   = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        if (bullet)   { lines.push(bullet.content); }
        else if (numbered) { lines.push(numbered.content); }
    }

    await vscode.env.clipboard.writeText(lines.join('\n'));
    vscode.window.showInformationMessage('Chevron Lists: Section copied as plain text');
}
