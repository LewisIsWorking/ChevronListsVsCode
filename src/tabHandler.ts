import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { prevNumberAtDepth } from './documentUtils';

type EditBuilder = vscode.TextEditorEdit;

// Snippet definitions - must stay in sync with snippets/chevron-lists.code-snippets
export const SNIPPETS: Record<string, string> = {
    'chl': '> ${1:Section Header}\n>> - ${2:First item}\n>> - ${3:Second item}\n>> - $0',
    'chn': '> ${1:Section Header}\n>> 1. ${2:First item}\n>> 2. ${3:Second item}\n>> 3. $0',
};

/**
 * Checks if the text before the cursor on the active line is a snippet prefix.
 * Returns the prefix string if matched, null otherwise.
 */
export function getSnippetPrefix(editor: vscode.TextEditor): string | null {
    const cursor          = editor.selection.active;
    const textBeforeCursor = editor.document.lineAt(cursor.line).text
        .substring(0, cursor.character)
        .trimStart();
    return SNIPPETS[textBeforeCursor] !== undefined ? textBeforeCursor : null;
}

/** Expands the snippet prefix before the cursor, if one is present. */
export async function expandSnippet(editor: vscode.TextEditor): Promise<boolean> {
    const snippetPrefix = getSnippetPrefix(editor);
    if (!snippetPrefix) { return false; }
    const cursor      = editor.selection.active;
    const lineText    = editor.document.lineAt(cursor.line).text;
    const prefixStart = new vscode.Position(cursor.line, lineText.indexOf(snippetPrefix));
    await editor.edit((eb: EditBuilder) =>
        eb.delete(new vscode.Range(prefixStart, cursor))
    );
    await editor.insertSnippet(new vscode.SnippetString(SNIPPETS[snippetPrefix]));
    return true;
}

/**
 * Command: expand snippet via its configured trigger key.
 * Called directly by the Ctrl+Enter keybinding.
 */
export async function onExpandSnippet(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    await expandSnippet(editor);
}

/**
 * Expands all selections (including range selections from Shift+click) into a
 * deduplicated flat list of line numbers that contain chevron items.
 */
function getChevronLines(editor: vscode.TextEditor, prefix: string): number[] {
    const lines = new Set<number>();
    for (const sel of editor.selections) {
        const start = Math.min(sel.anchor.line, sel.active.line);
        const end   = Math.max(sel.anchor.line, sel.active.line);
        for (let i = start; i <= end; i++) {
            const text = editor.document.lineAt(i).text;
            if (parseBullet(text, prefix) || parseNumbered(text)) { lines.add(i); }
        }
    }
    return Array.from(lines).sort((a, b) => a - b);
}

/** Applies a Tab indent to one line */
function applyIndent(
    eb: EditBuilder,
    doc: vscode.TextDocument,
    lineIndex: number,
    prefix: string
): void {
    const lineText  = doc.lineAt(lineIndex).text;
    const lineRange = doc.lineAt(lineIndex).range;
    const numbered  = parseNumbered(lineText);
    if (numbered) {
        const newChevrons = `>${numbered.chevrons}`;
        const prevNum     = prevNumberAtDepth(doc, lineIndex, newChevrons);
        eb.replace(lineRange, `${newChevrons} ${prevNum + 1}. ${numbered.content}`);
        return;
    }
    const bullet = parseBullet(lineText, prefix);
    if (bullet) {
        eb.replace(lineRange, `>${bullet.chevrons} ${prefix} ${bullet.content}`);
    }
}

/** Applies a Shift+Tab dedent to one line */
function applyDedent(
    eb: EditBuilder,
    doc: vscode.TextDocument,
    lineIndex: number,
    prefix: string
): void {
    const lineText  = doc.lineAt(lineIndex).text;
    const lineRange = doc.lineAt(lineIndex).range;
    const numbered  = parseNumbered(lineText);
    if (numbered) {
        if (numbered.chevrons.length <= 2) { return; }
        const newChevrons = numbered.chevrons.slice(1);
        const prevNum     = prevNumberAtDepth(doc, lineIndex, newChevrons);
        eb.replace(lineRange, `${newChevrons} ${prevNum + 1}. ${numbered.content}`);
        return;
    }
    const bullet = parseBullet(lineText, prefix);
    if (bullet && bullet.chevrons.length > 2) {
        eb.replace(lineRange, `${bullet.chevrons.slice(1)} ${prefix} ${bullet.content}`);
    }
}

/**
 * Collects all child item lines directly below lineIndex whose chevron
 * depth is strictly greater than the item at lineIndex.
 */
function collectChildLines(doc: vscode.TextDocument, lineIndex: number, itemChevrons: string, prefix: string): number[] {
    const children: number[] = [];
    for (let i = lineIndex + 1; i < doc.lineCount; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const chevrons = bullet?.chevrons ?? numbered?.chevrons ?? null;
        if (!chevrons) { break; } // non-chevron line ends the child block
        if (chevrons.length <= itemChevrons.length) { break; } // back to same or lower depth
        children.push(i);
    }
    return children;
}

/** Handles Tab - accepts autocomplete suggestion if open, expands snippet if trigger=tab, promotes chevron items, or falls through */
export async function onTab(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    // If the suggest widget is open, let it accept the suggestion first
    const suggestVisible = await vscode.commands.executeCommand<boolean>('editor.action.inlineSuggest.isVisible');
    if (suggestVisible) {
        await vscode.commands.executeCommand('acceptSelectedSuggestion');
        return;
    }

    const { prefix, snippetTrigger } = getConfig();

    if (snippetTrigger === 'tab') {
        const expanded = await expandSnippet(editor);
        if (expanded) { return; }
    }

    const chevronLines = getChevronLines(editor, prefix);
    if (chevronLines.length === 0) { await vscode.commands.executeCommand('tab'); return; }

    await editor.edit((eb: EditBuilder) => {
        // Process lines in reverse order to avoid index shift issues
        const allLines = new Set(chevronLines);
        // Also collect children for single-cursor case
        if (chevronLines.length === 1) {
            const text     = editor.document.lineAt(chevronLines[0]).text;
            const chevrons = parseBullet(text, prefix)?.chevrons ?? parseNumbered(text)?.chevrons;
            if (chevrons) {
                for (const child of collectChildLines(editor.document, chevronLines[0], chevrons, prefix)) {
                    allLines.add(child);
                }
            }
        }
        for (const line of [...allLines].sort((a, b) => a - b)) {
            applyIndent(eb, editor.document, line, prefix);
        }
    });
}

/** Handles Shift+Tab - demotes chevron items across all cursors and range selections */
export async function onShiftTab(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const { prefix }   = getConfig();
    const chevronLines = getChevronLines(editor, prefix);
    if (chevronLines.length === 0) { await vscode.commands.executeCommand('outdent'); return; }

    await editor.edit((eb: EditBuilder) => {
        const allLines = new Set(chevronLines);
        if (chevronLines.length === 1) {
            const text     = editor.document.lineAt(chevronLines[0]).text;
            const chevrons = parseBullet(text, prefix)?.chevrons ?? parseNumbered(text)?.chevrons;
            if (chevrons) {
                for (const child of collectChildLines(editor.document, chevronLines[0], chevrons, prefix)) {
                    allLines.add(child);
                }
            }
        }
        for (const line of [...allLines].sort((a, b) => a - b)) {
            applyDedent(eb, editor.document, line, prefix);
        }
    });
}
