import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, isHeader } from './patterns';
import { stripAllMetadata } from './metadataStripper';

interface DupItem extends vscode.QuickPickItem { lineIndex: number; }

/** Command: finds items with identical plain-text content across the entire file */
export async function onShowDuplicateItems(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;

    // Build content → [line, section] map
    const seen    = new Map<string, Array<{ line: number; section: string }>>();
    let   section = '';

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (isHeader(text)) { section = text.replace(/^> /, '').trim(); continue; }
        const bullet   = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const plain = stripAllMetadata(content).trim().toLowerCase();
        if (!plain) { continue; }
        if (!seen.has(plain)) { seen.set(plain, []); }
        seen.get(plain)!.push({ line: i, section });
    }

    // Only keep content that appeared more than once
    const duplicates = [...seen.entries()].filter(([, occ]) => occ.length > 1);

    if (duplicates.length === 0) {
        vscode.window.showInformationMessage('CL: No duplicate items found in this file');
        return;
    }

    const items: DupItem[] = duplicates.flatMap(([plain, occs]) =>
        occs.map((occ, i) => ({
            label:       i === 0 ? `$(warning) ${plain}` : `  ↪ duplicate`,
            description: `${occ.section} - line ${occ.line + 1}`,
            lineIndex:   occ.line,
        }))
    );

    const pick        = vscode.window.createQuickPick<DupItem>();
    pick.items        = items;
    pick.placeholder  = `${duplicates.length} duplicate item${duplicates.length === 1 ? '' : 's'} found`;
    const originalPos = editor.selection.active;
    pick.onDidChangeActive(active => {
        if (!active[0]) { return; }
        const pos = new vscode.Position(active[0].lineIndex, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    });
    pick.onDidAccept(() => { pick.hide(); });
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) { editor.selection = new vscode.Selection(originalPos, originalPos); }
        pick.dispose();
    });
    pick.show();
}
