import * as vscode from 'vscode';
import { getConfig } from './config';
import { collectMentions } from './mentionParser';

interface MentionPickItem extends vscode.QuickPickItem { tag: string; }
interface ItemPickItem extends vscode.QuickPickItem { uri: vscode.Uri; lineIndex: number; }

function revealEntry(uri: vscode.Uri, lineIndex: number): void {
    vscode.workspace.openTextDocument(uri).then(doc =>
        vscode.window.showTextDocument(doc, { preserveFocus: true }).then(editor => {
            const pos = new vscode.Position(lineIndex, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        })
    );
}

/** Command: filter items by @mention across all workspace markdown files */
export async function onFilterByMentionWorkspace(): Promise<void> {
    const { prefix } = getConfig();
    const files      = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
    const mentionMap = new Map<string, Array<{ uri: vscode.Uri; fileName: string; section: string; itemText: string; line: number }>>();

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'CL: Scanning workspace mentions...', cancellable: false },
        async () => {
            for (const uri of files) {
                const doc      = await vscode.workspace.openTextDocument(uri);
                const fileName = uri.fsPath.split(/[\\/]/).pop() ?? uri.fsPath;
                for (const occ of collectMentions(doc, prefix)) {
                    if (!mentionMap.has(occ.name)) { mentionMap.set(occ.name, []); }
                    mentionMap.get(occ.name)!.push({ uri, fileName, section: occ.section, itemText: occ.itemText, line: occ.line });
                }
            }
        }
    );

    if (mentionMap.size === 0) {
        vscode.window.showInformationMessage('CL: No @mentions found in workspace');
        return;
    }

    const names = [...mentionMap.keys()].sort();
    const namePick = await vscode.window.showQuickPick(
        names.map(n => ({ label: `$(person) @${n}`, description: `${mentionMap.get(n)!.length} items`, tag: n })) as MentionPickItem[],
        { placeHolder: 'Select a person to search across the workspace...' }
    );
    if (!namePick) { return; }

    const matches = mentionMap.get(namePick.tag)!;
    const pick    = vscode.window.createQuickPick<ItemPickItem>();
    pick.items = matches.map(m => ({ label: m.itemText, description: `${m.fileName} › ${m.section}`, uri: m.uri, lineIndex: m.line }));
    pick.placeholder = `Items mentioning @${namePick.tag} — workspace`;
    pick.onDidAccept(() => { if (pick.activeItems[0]) { revealEntry(pick.activeItems[0].uri, pick.activeItems[0].lineIndex); } pick.hide(); });
    pick.onDidHide(() => pick.dispose());
    pick.show();
}
