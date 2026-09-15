import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { extractTags } from './tagParser';
import { uniqueTags } from './tagParser';

interface TagPickItem extends vscode.QuickPickItem { tag: string; }

/** Command: gathers all items with a chosen tag into a new Results section */
export async function onCollectItemsByTag(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const tags       = uniqueTags(doc, prefix);

    if (tags.length === 0) {
        vscode.window.showInformationMessage('CL: No #tags found in this file');
        return;
    }

    const picked = await vscode.window.showQuickPick(
        tags.map(t => ({ label: `$(tag) #${t}`, tag: t })) as TagPickItem[],
        { placeHolder: 'Select a tag to collect items for…' }
    );
    if (!picked) { return; }

    const matchingLines: string[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        if (extractTags(content).includes(picked.tag)) {
            matchingLines.push(text);
        }
    }

    if (matchingLines.length === 0) {
        vscode.window.showInformationMessage(`CL: No items found with #${picked.tag}`);
        return;
    }

    const newSection = [`> #${picked.tag} Results`, ...matchingLines, ''].join('\n');
    const insertPos  = new vscode.Position(doc.lineCount, 0);
    await editor.edit(eb => eb.insert(insertPos, '\n' + newSection));
    vscode.window.showInformationMessage(
        `CL: Collected ${matchingLines.length} item${matchingLines.length === 1 ? '' : 's'} into "#${picked.tag} Results"`
    );
}
