import * as vscode from 'vscode';
import { isHeader } from './patterns';
import { collectGroups } from './groupParser';

interface GroupPickItem extends vscode.QuickPickItem {
    lineIndex: number;
}

function revealLine(editor: vscode.TextEditor, lineIndex: number): void {
    const pos = new vscode.Position(lineIndex, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/**
 * Command: wraps the selected lines (or cursor section) under a named group divider.
 * Inserts `>> -- <name>` above the nearest header at or above the cursor.
 */
export async function onGroupSections(context: vscode.ExtensionContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const name = await vscode.window.showInputBox({
        prompt:      'Enter a name for this section group',
        placeHolder: 'e.g. Act One, Chapter 2, Phase 1...',
    });
    if (!name?.trim()) { return; }

    const doc    = editor.document;
    const cursor = editor.selection.active;

    // Find nearest header at or above cursor
    let headerLine = -1;
    for (let i = cursor.line; i >= 0; i--) {
        if (isHeader(doc.lineAt(i).text)) { headerLine = i; break; }
    }

    if (headerLine < 0) {
        vscode.window.showInformationMessage('CL: No section header found at cursor');
        return;
    }

    await editor.edit(eb => {
        const insertPos = new vscode.Position(headerLine, 0);
        eb.insert(insertPos, `>> -- ${name.trim()}\n`);
    });
}

/** Command: shows all groups in the file as a quick pick for navigation */
export async function onFilterGroups(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const groups = collectGroups(editor.document);

    if (groups.length === 0) {
        vscode.window.showInformationMessage('CL: No section groups found (use CL: Group Sections or type >> -- Group Name)');
        return;
    }

    const items: GroupPickItem[] = groups.map(g => ({
        label:       `$(folder) ${g.name}`,
        description: `${g.sections.length} section${g.sections.length === 1 ? '' : 's'}: ${g.sections.join(', ')}`,
        lineIndex:   g.line,
    }));

    const pick = vscode.window.createQuickPick<GroupPickItem>();
    pick.items       = items;
    pick.placeholder = 'Jump to a section group...';

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
