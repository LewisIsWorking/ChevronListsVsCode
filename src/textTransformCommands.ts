import * as vscode from 'vscode';
import { getConfig } from './config';
import { joinItem, splitItem } from './itemParts';
import { parseBullet, parseNumbered, toTitleCase } from './patterns';

/** A [[link]], #tag, @mention or web address: changing its case changes what it points at */
const REFERENCE_RE = /\[\[.*?\]\]|(?<!\S)[#@]\S+|(?<!\S)\w+:\/\/\S+/g;

/** Pure: applies a case change to the words of item content, leaving its markers, vote, comment and references alone */
function changeWords(content: string, change: (s: string) => string): string {
    const parts = splitItem(content);
    let body = '';
    let from = 0;
    for (const ref of parts.body.matchAll(REFERENCE_RE)) {
        body += change(parts.body.slice(from, ref.index)) + ref[0];
        from = ref.index + ref[0].length;
    }
    return joinItem({ ...parts, body: body + change(parts.body.slice(from)) });
}

/** Applies a text transform to the content of the item at the cursor */
async function transformItemText(transform: (s: string) => string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const lineIndex   = editor.selection.active.line;
    const text        = doc.lineAt(lineIndex).text;
    const bullet      = parseBullet(text, prefix);
    const numbered    = parseNumbered(text);
    if (!bullet && !numbered) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item to transform it');
        return;
    }
    const chevrons   = bullet?.chevrons ?? numbered!.chevrons;
    const content    = bullet?.content  ?? numbered!.content;
    const num        = numbered?.num ?? null;
    const newContent = changeWords(content, transform);
    const newLine    = num !== null
        ? `${chevrons} ${num}. ${newContent}`
        : `${chevrons} ${prefix} ${newContent}`;
    await editor.edit(eb => eb.replace(doc.lineAt(lineIndex).range, newLine));
}

/** Command: converts item content to UPPERCASE */
export const onUppercaseItem = () => transformItemText(s => s.toUpperCase());

/** Command: converts item content to lowercase */
export const onLowercaseItem = () => transformItemText(s => s.toLowerCase());

/** Command: converts item content to Title Case */
export const onTitleCaseItem = () => transformItemText(toTitleCase);
