import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, isHeader, getFirstItemPrefix } from './patterns';
import { renumberFollowing } from './numberingRuns';

type EditBuilder = vscode.TextEditorEdit;

function isCursorAtLineEnd(editor: vscode.TextEditor): boolean {
    const cursor = editor.selection.active;
    return cursor.character === editor.document.lineAt(cursor.line).text.length;
}

async function handleNumbered(
    editor:   vscode.TextEditor,
    cursor:   vscode.Position,
    chevrons: string,
    num:      number,
    content:  string,
    fullLine: string
): Promise<void> {
    // Empty content at end of line → clear the item (stop the list)
    if (content === '' && isCursorAtLineEnd(editor)) {
        await editor.edit((eb: EditBuilder) =>
            eb.delete(new vscode.Range(cursor.with(undefined, 0), cursor)));
        return;
    }

    const nextPrefix = `${chevrons} ${num + 1}. `;
    const atEnd      = cursor.character >= fullLine.length;

    // The items below move down one number, so the list stays in sequence
    const renumber   = renumberFollowing(editor.document, cursor.line, chevrons, 1);

    await editor.edit((eb: EditBuilder) => {
        if (atEnd) {
            // Normal end-of-line: just insert a new line with next number
            eb.insert(cursor, `\n${nextPrefix}`);
        } else {
            // Mid-line split: keep text before cursor, put remainder on new numbered line
            const before = fullLine.slice(0, cursor.character).trimEnd();
            const after  = fullLine.slice(cursor.character).trimStart();
            eb.replace(editor.document.lineAt(cursor.line).range, `${before}\n${nextPrefix}${after}`);
        }
        for (const r of renumber) { eb.replace(editor.document.lineAt(r.line).range, r.text); }
    });

    const newPos = new vscode.Position(cursor.line + 1, nextPrefix.length);
    editor.selection = new vscode.Selection(newPos, newPos);
    editor.revealRange(new vscode.Range(newPos, newPos));
}

async function handleBullet(
    editor:   vscode.TextEditor,
    cursor:   vscode.Position,
    chevrons: string,
    content:  string,
    prefix:   string,
    fullLine: string
): Promise<void> {
    // Empty content at end of line → clear the item (stop the list)
    if (content === '' && isCursorAtLineEnd(editor)) {
        await editor.edit((eb: EditBuilder) =>
            eb.delete(new vscode.Range(cursor.with(undefined, 0), cursor)));
        return;
    }

    const pfx   = `${chevrons} ${prefix} `;
    const atEnd = cursor.character >= fullLine.length;

    if (atEnd) {
        await editor.edit((eb: EditBuilder) => eb.insert(cursor, `\n${pfx}`));
    } else {
        // Mid-line split: keep text before cursor, put remainder on new bullet line
        const before = fullLine.slice(0, cursor.character).trimEnd();
        const after  = fullLine.slice(cursor.character).trimStart();
        await editor.edit((eb: EditBuilder) =>
            eb.replace(editor.document.lineAt(cursor.line).range,
                `${before}\n${pfx}${after}`));
    }

    const newPos = new vscode.Position(cursor.line + 1, pfx.length);
    editor.selection = new vscode.Selection(newPos, newPos);
    editor.revealRange(new vscode.Range(newPos, newPos));
}

/**
 * Enter at the end of a header with a list straight under it: starts a new
 * first item of that list's type, numbered 1 with the rest renumbered, or
 * the list's bullet. False when no list follows, so the default applies.
 */
async function startListAbove(editor: vscode.TextEditor, cursor: vscode.Position, prefix: string): Promise<boolean> {
    const doc      = editor.document;
    const nextLine = cursor.line + 1 < doc.lineCount ? doc.lineAt(cursor.line + 1).text : '';
    const numbered = parseNumbered(nextLine);
    const bullet   = numbered ? null : parseBullet(nextLine, prefix);
    if ((numbered ?? bullet)?.chevrons !== '>>') { return false; }

    const pfx      = numbered ? '>> 1. ' : `>> ${prefix} `;
    const renumber = numbered ? renumberFollowing(doc, cursor.line, '>>', 1) : [];
    await editor.edit((eb: EditBuilder) => {
        eb.insert(cursor, `
${pfx}`);
        for (const r of renumber) { eb.replace(doc.lineAt(r.line).range, r.text); }
    });
    const newPos = new vscode.Position(cursor.line + 1, pfx.length);
    editor.selection = new vscode.Selection(newPos, newPos);
    editor.revealRange(new vscode.Range(newPos, newPos));
    await vscode.commands.executeCommand('editor.action.triggerSuggest');
    return true;
}

/** Handles the Enter key in markdown files */
export async function onEnter(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { await vscode.commands.executeCommand('default:type', { text: '\n' }); return; }

    const cursor   = editor.selection.active;
    const lineText = editor.document.lineAt(cursor.line).text;
    const { prefix, blankLine, defaultNewListType } = getConfig();

    const numbered = parseNumbered(lineText);
    if (numbered) {
        await handleNumbered(editor, cursor, numbered.chevrons, numbered.num, numbered.content, lineText);
        return;
    }
    const bullet = parseBullet(lineText, prefix);
    if (bullet) {
        await handleBullet(editor, cursor, bullet.chevrons, bullet.content, prefix, lineText);
        return;
    }
    if (isHeader(lineText)) {
        if (!isCursorAtLineEnd(editor)) {
            // Mid-line on a header: split into two headers
            const cursor = editor.selection.active;
            const before = lineText.slice(0, cursor.character).trimEnd();
            const after  = lineText.slice(cursor.character).trimStart();
            const newLine = after ? `\n> ${after}` : '\n> ';
            await editor.edit((eb: EditBuilder) =>
                eb.replace(editor.document.lineAt(cursor.line).range, `${before}${newLine}`)
            );
            const newPos = new vscode.Position(cursor.line + 1, 2);
            editor.selection = new vscode.Selection(newPos, newPos);
            return;
        }
        if (await startListAbove(editor, cursor, prefix)) { return; }
        const firstPrefix = getFirstItemPrefix(prefix, defaultNewListType);
        const newItem = blankLine ? `\n\n>> ${firstPrefix} ` : `\n>> ${firstPrefix} `;
        await vscode.commands.executeCommand('default:type', { text: newItem });
        // Auto-trigger suggestions so user can immediately pick a tag or template
        await vscode.commands.executeCommand('editor.action.triggerSuggest');
        return;
    }
    await vscode.commands.executeCommand('default:type', { text: '\n' });
}
