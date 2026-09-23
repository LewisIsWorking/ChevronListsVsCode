import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, isHeader } from './patterns';
import { extractTags } from './tagParser';

interface TagPickItem extends vscode.QuickPickItem { tag: string; }
interface ItemPickItem extends vscode.QuickPickItem { lineIndex: number; }

/** Command: filter items by multiple tags with AND/OR logic */
export async function onFilterByMultipleTags(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;

    // Collect all tags from file
    const allTags = new Set<string>();
    for (let i = 0; i < doc.lineCount; i++) {
        const t = doc.lineAt(i).text;
        const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
        if (content) { for (const tag of extractTags(content)) { allTags.add(tag); } }
    }
    if (allTags.size === 0) { vscode.window.showInformationMessage('CL: No tags found in this file'); return; }

    const tagItems: TagPickItem[] = [...allTags].sort().map(t => ({ label: `#${t}`, tag: t }));
    const pickedTags = await vscode.window.showQuickPick(tagItems, {
        canPickMany: true, placeHolder: 'Select tags to filter by…',
    });
    if (!pickedTags?.length) { return; }

    const mode = await vscode.window.showQuickPick(
        [{ label: 'AND - items must have ALL selected tags' }, { label: 'OR - items with ANY selected tag' }],
        { placeHolder: 'Match mode…' }
    );
    if (!mode) { return; }

    const tags     = pickedTags.map(p => p.tag);
    const isAnd    = mode.label.startsWith('AND');
    let   section  = '';
    const matches: ItemPickItem[] = [];
    const originalPos = editor.selection.active;

    for (let i = 0; i < doc.lineCount; i++) {
        const t = doc.lineAt(i).text;
        if (isHeader(t)) { section = t.replace(/^> /, '').trim(); continue; }
        const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
        if (!content) { continue; }
        const itemTags = extractTags(content);
        const match    = isAnd ? tags.every(tag => itemTags.includes(tag)) : tags.some(tag => itemTags.includes(tag));
        if (!match) { continue; }
        matches.push({ label: content.slice(0, 70), description: section, lineIndex: i });
    }

    if (matches.length === 0) { vscode.window.showInformationMessage(`CL: No items match the selected tags`); return; }

    const pick = vscode.window.createQuickPick<ItemPickItem>();
    pick.items       = matches;
    pick.placeholder = `${matches.length} item${matches.length === 1 ? '' : 's'} matching [${tags.map(t => '#' + t).join(isAnd ? ' & ' : ' | ')}]`;
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
