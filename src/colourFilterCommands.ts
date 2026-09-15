import * as vscode from 'vscode';
import { getConfig } from './config';
import { collectColourLabels } from './colourLabelParser';
import type { ColourLabel } from './colourLabelParser';

interface ColourPickItem extends vscode.QuickPickItem { colour: ColourLabel; }
interface ItemPickItem extends vscode.QuickPickItem { lineIndex: number; }

/** Command: quick pick of all {colour} labelled items, grouped by colour */
export async function onFilterByColourLabel(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const all        = collectColourLabels(editor.document, prefix);
    if (all.length === 0) {
        vscode.window.showInformationMessage('CL: No colour-labelled items found (use {red}, {green}, etc.)');
        return;
    }

    // Count by colour for the picker
    const counts = new Map<ColourLabel, number>();
    for (const item of all) { counts.set(item.label, (counts.get(item.label) ?? 0) + 1); }

    const colourPick = await vscode.window.showQuickPick(
        [...counts.entries()].sort((a, b) => b[1] - a[1])
            .map(([colour, count]) => ({ label: `{${colour}}`, description: `${count} item${count === 1 ? '' : 's'}`, colour })) as ColourPickItem[],
        { placeHolder: 'Select a colour label to filter…' }
    );
    if (!colourPick) { return; }

    const matches = all.filter(i => i.label === colourPick.colour);
    const pick    = vscode.window.createQuickPick<ItemPickItem>();
    pick.items    = matches.map(i => ({
        label:       `{${i.label}} ${i.content}`,
        description: i.section,
        lineIndex:   i.line,
    }));
    pick.placeholder = `Items labelled {${colourPick.colour}}`;
    const originalPos = editor.selection.active;
    pick.onDidChangeActive(active => {
        if (!active[0]) { return; }
        const pos = new vscode.Position(active[0].lineIndex, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    });
    pick.onDidAccept(() => { pick.hide(); });
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) {
            editor.selection = new vscode.Selection(originalPos, originalPos);
        }
        pick.dispose();
    });
    pick.show();
}
