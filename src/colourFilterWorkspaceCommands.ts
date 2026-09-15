import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { collectColourLabels } from './colourLabelParser';
import type { ColourLabel } from './colourLabelParser';

interface ColourPickItem extends vscode.QuickPickItem { colour: ColourLabel; }
interface ItemPickItem extends vscode.QuickPickItem { uri: vscode.Uri; lineIndex: number; }

/** Command: filter {colour} labelled items across all workspace files */
export async function onFilterByColourLabelWorkspace(): Promise<void> {
    const { prefix } = getConfig();
    const files      = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
    const colourMap  = new Map<ColourLabel, Array<{ uri: vscode.Uri; fileName: string; section: string; content: string; line: number }>>();

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'CL: Scanning colour labels…', cancellable: false },
        async () => {
            for (const uri of files) {
                const doc      = await vscode.workspace.openTextDocument(uri);
                const fileName = path.basename(uri.fsPath);
                for (const occ of collectColourLabels(doc, prefix)) {
                    if (!colourMap.has(occ.label)) { colourMap.set(occ.label, []); }
                    colourMap.get(occ.label)!.push({ uri, fileName, section: occ.section, content: occ.content, line: occ.line });
                }
            }
        }
    );

    if (colourMap.size === 0) {
        vscode.window.showInformationMessage('CL: No colour-labelled items found in workspace');
        return;
    }

    const colourPick = await vscode.window.showQuickPick(
        [...colourMap.entries()].sort((a, b) => b[1].length - a[1].length)
            .map(([colour, items]) => ({ label: `{${colour}}`, description: `${items.length} items across ${new Set(items.map(i => i.uri.toString())).size} files`, colour })) as ColourPickItem[],
        { placeHolder: 'Select a colour label to filter across workspace…' }
    );
    if (!colourPick) { return; }

    const matches = colourMap.get(colourPick.colour)!;
    const pick    = vscode.window.createQuickPick<ItemPickItem>();
    pick.items    = matches.map(m => ({
        label:       `{${colourPick.colour}} ${m.content}`,
        description: `${m.fileName} › ${m.section}`,
        uri:         m.uri,
        lineIndex:   m.line,
    }));
    pick.placeholder = `Items labelled {${colourPick.colour}} — workspace`;
    pick.onDidAccept(() => {
        if (pick.activeItems[0]) {
            vscode.workspace.openTextDocument(pick.activeItems[0].uri).then(doc =>
                vscode.window.showTextDocument(doc).then(editor => {
                    const pos = new vscode.Position(pick.activeItems[0].lineIndex, 0);
                    editor.selection = new vscode.Selection(pos, pos);
                    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                })
            );
        }
        pick.hide();
    });
    pick.onDidHide(() => pick.dispose());
    pick.show();
}
