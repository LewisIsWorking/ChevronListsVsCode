import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { stripAllMetadata } from './metadataStripper';
import { joinItem, splitItem } from './itemParts';

/** The metadata stripAllMetadata hides from among an item's words */
const INLINE_METADATA = /(?<!\S)(?:#\w[\w-]*|@\d{4}-\d{2}-\d{2}|@created:\d{4}-\d{2}-\d{2}|@(?:daily|weekly|monthly)|~\d+h(?:\d+m)?|~\d+m|\{(?:red|green|blue|yellow|orange|purple)\}|\[\[[^\]]+\]\])(?!\S)/g;

/**
 * Command: opens an input box with the item's plain content (markers hidden).
 * On save, writes the new text back while preserving all original markers.
 */
export async function onEditItemContent(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const text       = doc.lineAt(lineIndex).text;
    const bullet     = parseBullet(text, prefix);
    const numbered   = parseNumbered(text);

    if (!bullet && !numbered) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item to edit it');
        return;
    }

    const chevrons = bullet?.chevrons ?? numbered!.chevrons;
    const content  = bullet?.content  ?? numbered!.content;
    const num      = numbered?.num ?? null;

    // Show plain text (metadata stripped) but preserve the full content for rebuild
    const plainText = stripAllMetadata(content);

    const newPlain = await vscode.window.showInputBox({
        prompt:      'Edit item content',
        value:       plainText,
        placeHolder: 'Item text (markers will be preserved)',
    });
    if (newPlain === undefined || newPlain === plainText || !newPlain.trim()) { return; }

    // Rebuild from the item's parts: the new words, then the metadata that sat among
    // the old ones. This used to be content.replace(plainText, newPlain), but the
    // plain text is not a substring once metadata sits between words, so the edit
    // was silently dropped; and when it was, the first match could be inside a tag
    // ("#milk milk" edited to "bread" became "#bread milk").
    const parts  = splitItem(content);
    const kept   = parts.body.match(INLINE_METADATA) ?? [];
    const struck = /^~~.+~~$/.test(parts.body.replace(INLINE_METADATA, '').replace(/\s{2,}/g, ' ').trim());
    const words  = struck ? `~~${newPlain.trim()}~~` : newPlain.trim();
    const newContent = joinItem({ ...parts, body: [words, ...kept].join(' ') });
    const newLine    = num !== null
        ? `${chevrons} ${num}. ${newContent}`
        : `${chevrons} ${prefix} ${newContent}`;

    await editor.edit(eb => eb.replace(doc.lineAt(lineIndex).range, newLine));
}
