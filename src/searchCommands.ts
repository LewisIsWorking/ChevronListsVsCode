import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, isHeader } from './patterns';

/** Represents a single item entry for the quick pick */
interface ItemEntry extends vscode.QuickPickItem {
    lineIndex: number;
}

/** Collects every chevron item across the entire document */
function collectAllItems(
    doc: vscode.TextDocument,
    prefix: string
): ItemEntry[] {
    const entries: ItemEntry[] = [];
    let currentHeader = '';

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;

        if (isHeader(text)) {
            currentHeader = text.replace(/^> /, '');
            continue;
        }

        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);

        if (bullet) {
            const depth  = bullet.chevrons.length - 2;
            const indent = '  '.repeat(depth);
            entries.push({
                label:       `${indent}$(list-unordered) ${bullet.content}`,
                description: currentHeader,
                lineIndex:   i,
            });
        } else if (numbered) {
            const depth  = numbered.chevrons.length - 2;
            const indent = '  '.repeat(depth);
            entries.push({
                label:       `${indent}$(symbol-numeric) ${numbered.num}. ${numbered.content}`,
                description: currentHeader,
                lineIndex:   i,
            });
        }
    }
    return entries;
}

/** Collects every header as a quick pick entry */
function collectAllHeaders(doc: vscode.TextDocument): ItemEntry[] {
    const entries: ItemEntry[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (isHeader(text)) {
            entries.push({
                label:     `$(symbol-namespace) ${text.replace(/^> /, '')}`,
                lineIndex: i,
            });
        }
    }
    return entries;
}

/** Reveals a line in the editor, centring it in the viewport */
function revealLine(editor: vscode.TextEditor, lineIndex: number): void {
    const pos = new vscode.Position(lineIndex, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(
        new vscode.Range(pos, pos),
        vscode.TextEditorRevealType.InCenterIfOutsideViewport
    );
}

/**
 * Search Items - shows a quick pick of every chevron item in the file.
 * Supports live filtering. Selecting an item jumps to its line.
 */
export async function onSearchItems(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const items      = collectAllItems(editor.document, prefix);

    if (items.length === 0) {
        vscode.window.showInformationMessage('Chevron Lists: no items found in this file');
        return;
    }

    const pick = vscode.window.createQuickPick<ItemEntry>();
    pick.items       = items;
    pick.placeholder = 'Type to filter chevron list items...';
    pick.matchOnDescription = true;

    // Live preview - jump to item as user moves through the list
    pick.onDidChangeActive(active => {
        if (active[0]) { revealLine(editor, active[0].lineIndex); }
    });

    pick.onDidAccept(() => {
        const selected = pick.activeItems[0];
        if (selected) { revealLine(editor, selected.lineIndex); }
        pick.hide();
    });

    // Restore original position if user cancels
    const originalPos = editor.selection.active;
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) {
            const pos = new vscode.Position(originalPos.line, originalPos.character);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos));
        }
        pick.dispose();
    });

    pick.show();
}

/**
 * Filter Sections - shows a quick pick of all headers in the file.
 * Supports live filtering. Selecting a header jumps to that section.
 */
export async function onFilterSections(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const headers = collectAllHeaders(editor.document);

    if (headers.length === 0) {
        vscode.window.showInformationMessage('Chevron Lists: no headers found in this file');
        return;
    }

    const pick = vscode.window.createQuickPick<ItemEntry>();
    pick.items       = headers;
    pick.placeholder = 'Type to filter sections...';

    pick.onDidChangeActive(active => {
        if (active[0]) { revealLine(editor, active[0].lineIndex); }
    });

    pick.onDidAccept(() => {
        const selected = pick.activeItems[0];
        if (selected) { revealLine(editor, selected.lineIndex); }
        pick.hide();
    });

    const originalPos = editor.selection.active;
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) {
            const pos = new vscode.Position(originalPos.line, originalPos.character);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos));
        }
        pick.dispose();
    });

    pick.show();
}
