import * as vscode from 'vscode';
import { getConfig } from './config';
import { collectPriorityItems, PRIORITY_LABELS, type PriorityLevel } from './priorityParser';

interface PriorityLevelPickItem extends vscode.QuickPickItem {
    level: PriorityLevel | 'all';
}

interface ItemPickItem extends vscode.QuickPickItem {
    lineIndex: number;
}

function revealLine(editor: vscode.TextEditor, lineIndex: number): void {
    const pos = new vscode.Position(lineIndex, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/** Command: filter items by priority level */
export async function onFilterByPriority(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const all = collectPriorityItems(editor.document, prefix);

    if (all.length === 0) {
        vscode.window.showInformationMessage('CL: No priority items found (use !, !!, or !!! at the start of item content)');
        return;
    }

    const levelItems: PriorityLevelPickItem[] = [
        { label: '$(list-unordered) All priorities', description: `${all.length} items`, level: 'all' },
        { label: '$(warning) !!! Critical', description: `${all.filter(i => i.level === 3).length} items`, level: 3 },
        { label: '$(info) !! Medium',       description: `${all.filter(i => i.level === 2).length} items`, level: 2 },
        { label: '$(circle-outline) ! Low', description: `${all.filter(i => i.level === 1).length} items`, level: 1 },
    ];

    const levelPick = await vscode.window.showQuickPick(levelItems, {
        placeHolder: 'Select a priority level to filter...',
    });
    if (!levelPick) { return; }

    const filtered = levelPick.level === 'all'
        ? all
        : all.filter(i => i.level === levelPick.level);

    const pick = vscode.window.createQuickPick<ItemPickItem>();
    pick.items = filtered.map(item => ({
        label:       `${PRIORITY_LABELS[item.level]} - ${item.content}`,
        description: item.section,
        lineIndex:   item.line,
    }));
    pick.placeholder = `Items with priority ${levelPick.level === 'all' ? 'any' : PRIORITY_LABELS[levelPick.level as PriorityLevel]}`;

    const originalPos = editor.selection.active;
    pick.onDidChangeActive(active => {
        if (active[0]) { revealLine(editor, active[0].lineIndex); }
    });
    pick.onDidAccept(() => {
        if (pick.activeItems[0]) { revealLine(editor, pick.activeItems[0].lineIndex); }
        pick.hide();
    });
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) {
            const pos = new vscode.Position(originalPos.line, originalPos.character);
            editor.selection = new vscode.Selection(pos, pos);
        }
        pick.dispose();
    });
    pick.show();
}
