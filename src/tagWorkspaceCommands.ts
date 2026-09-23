import * as vscode from 'vscode';
import { getConfig } from './config';
import { collectTags } from './tagParser';
import type { TagOccurrence } from './tagParser';

interface TagPickItem extends vscode.QuickPickItem {
    tag: string;
}

interface ItemPickItem extends vscode.QuickPickItem {
    uri:       vscode.Uri;
    lineIndex: number;
}

function revealEntry(uri: vscode.Uri, lineIndex: number): void {
    vscode.workspace.openTextDocument(uri).then(doc =>
        vscode.window.showTextDocument(doc, { preserveFocus: true }).then(editor => {
            const pos = new vscode.Position(lineIndex, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        })
    );
}

/** Collects all tags across every markdown file in the workspace */
async function collectWorkspaceTags(prefix: string): Promise<Map<string, Array<TagOccurrence & { uri: vscode.Uri; fileName: string }>>> {
    const files  = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
    const tagMap = new Map<string, Array<TagOccurrence & { uri: vscode.Uri; fileName: string }>>();

    for (const uri of files) {
        const doc      = await vscode.workspace.openTextDocument(uri);
        const fileName = uri.fsPath.split(/[\\/]/).pop() ?? uri.fsPath;
        const occs     = collectTags(doc, prefix);
        for (const occ of occs) {
            const key = occ.tag;
            if (!tagMap.has(key)) { tagMap.set(key, []); }
            tagMap.get(key)!.push({ ...occ, uri, fileName });
        }
    }
    return tagMap;
}

/** Command: filter items by tag across all workspace markdown files */
export async function onFilterByTagWorkspace(): Promise<void> {
    const { prefix } = getConfig();

    let tagMap: Map<string, Array<TagOccurrence & { uri: vscode.Uri; fileName: string }>>;

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'CL: Scanning workspace tags...', cancellable: false },
        async () => { tagMap = await collectWorkspaceTags(prefix); }
    );

    if (tagMap!.size === 0) {
        vscode.window.showInformationMessage('CL: No #tags found in workspace');
        return;
    }

    const sortedTags = [...tagMap!.keys()].sort();
    const tagItems: TagPickItem[] = sortedTags.map(tag => ({
        label:       `$(tag) #${tag}`,
        description: `${tagMap!.get(tag)!.length} item${tagMap!.get(tag)!.length === 1 ? '' : 's'} across workspace`,
        tag,
    }));

    const tagPick = await vscode.window.showQuickPick(tagItems, {
        placeHolder: 'Select a tag to search across the workspace...',
    });
    if (!tagPick) { return; }

    const matches = tagMap!.get(tagPick.tag)!;
    const pick    = vscode.window.createQuickPick<ItemPickItem>();
    pick.items = matches.map(m => ({
        label:       m.itemText,
        description: `${m.fileName} › ${m.section}`,
        uri:         m.uri,
        lineIndex:   m.line,
    }));
    pick.placeholder = `Items tagged #${tagPick.tag} - workspace`;

    pick.onDidAccept(() => {
        if (pick.activeItems[0]) { revealEntry(pick.activeItems[0].uri, pick.activeItems[0].lineIndex); }
        pick.hide();
    });
    pick.onDidHide(() => pick.dispose());
    pick.show();
}
