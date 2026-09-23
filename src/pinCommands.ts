import * as vscode from 'vscode';
import { isHeader } from './patterns';
import { togglePin, getPinnedSections } from './pinState';

/** Command: toggle pin on the section header nearest the cursor */
export async function onTogglePin(context: vscode.ExtensionContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

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

    const name  = doc.lineAt(headerLine).text.replace(/^> /, '');
    const pinned = await togglePin(context, name);
    vscode.window.showInformationMessage(
        pinned ? `CL: Pinned "${name}"` : `CL: Unpinned "${name}"`
    );
}

interface PinPickItem extends vscode.QuickPickItem {
    lineIndex: number;
}

/** Command: shows a quick pick of pinned sections for fast navigation */
export async function onFilterPinnedSections(
    context: vscode.ExtensionContext
): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const doc   = editor.document;
    const pins  = getPinnedSections(context);

    if (pins.size === 0) {
        vscode.window.showInformationMessage('CL: No pinned sections - use CL: Toggle Pin to pin a section');
        return;
    }

    const items: PinPickItem[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (isHeader(text)) {
            const name = text.replace(/^> /, '');
            if (pins.has(name.toLowerCase())) {
                items.push({ label: `$(pin) ${name}`, lineIndex: i });
            }
        }
    }

    if (items.length === 0) {
        vscode.window.showInformationMessage('CL: No pinned sections found in this file');
        return;
    }

    const pick = vscode.window.createQuickPick<PinPickItem>();
    pick.items       = items;
    pick.placeholder = 'Jump to a pinned section...';

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
            const pos = new vscode.Position(originalPos.line, originalPos.character);
            editor.selection = new vscode.Selection(pos, pos);
        }
        pick.dispose();
    });
    pick.show();
}
