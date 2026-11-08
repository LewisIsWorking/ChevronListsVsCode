import * as vscode from 'vscode';
import { getConfig } from './config';
import { uniqueTags, renameTagInItem } from './tagParser';

function validateTagName(value: string): string | null {
    return /^#?\w[\w-]*$/.test(value.trim()) ? null : 'Tags can only contain letters, numbers, hyphens and underscores';
}

/** Command: renames a #tag across all items in the current file */
export async function onRenameTag(): Promise<void> {
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
        tags.map(t => ({ label: `$(tag) #${t}`, tag: t })),
        { placeHolder: 'Select a tag to rename...' }
    );
    if (!picked) { return; }

    const newTag = await vscode.window.showInputBox({
        prompt: `Rename #${picked.tag} to`,
        value:  picked.tag,
        validateInput: validateTagName,
    });
    if (!newTag?.trim() || newTag.trim() === picked.tag) { return; }

    let count = 0;
    await editor.edit(eb => {
        for (let i = 0; i < doc.lineCount; i++) {
            const text    = doc.lineAt(i).text;
            const renamed = renameTagInItem(text, prefix, picked.tag, newTag.trim());
            if (renamed !== text) { eb.replace(doc.lineAt(i).range, renamed); count++; }
        }
    });

    vscode.window.showInformationMessage(`CL: Renamed #${picked.tag} → #${newTag.trim()} on ${count} line${count === 1 ? '' : 's'}`);
}

/** Command: renames a #tag across all markdown files in the workspace */
export async function onRenameTagWorkspace(): Promise<void> {
    const { prefix } = getConfig();

    // Build global tag list across all files
    const files = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
    const allTags = new Set<string>();
    for (const uri of files) {
        const doc = await vscode.workspace.openTextDocument(uri);
        for (const t of uniqueTags(doc, prefix)) { allTags.add(t); }
    }

    if (allTags.size === 0) {
        vscode.window.showInformationMessage('CL: No #tags found in workspace');
        return;
    }

    const picked = await vscode.window.showQuickPick(
        [...allTags].sort().map(t => ({ label: `$(tag) #${t}`, tag: t })),
        { placeHolder: 'Select a tag to rename across all workspace files...' }
    );
    if (!picked) { return; }

    const newTag = await vscode.window.showInputBox({
        prompt: `Rename #${picked.tag} to (workspace-wide)`,
        value:  picked.tag,
        validateInput: validateTagName,
    });
    if (!newTag?.trim() || newTag.trim() === picked.tag) { return; }

    let totalLines = 0;
    let filesChanged = 0;
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `CL: Renaming #${picked.tag}...`, cancellable: false },
        async () => {
            for (const uri of files) {
                const doc  = await vscode.workspace.openTextDocument(uri);
                const edit = new vscode.WorkspaceEdit();
                let changed = false;
                for (let i = 0; i < doc.lineCount; i++) {
                    const text    = doc.lineAt(i).text;
                    const renamed = renameTagInItem(text, prefix, picked.tag, newTag.trim());
                    if (renamed !== text) {
                        edit.replace(uri, doc.lineAt(i).range, renamed);
                        totalLines++; changed = true;
                    }
                }
                if (changed) { await vscode.workspace.applyEdit(edit); filesChanged++; }
            }
        }
    );

    vscode.window.showInformationMessage(
        `CL: Renamed #${picked.tag} → #${newTag.trim()} on ${totalLines} line${totalLines === 1 ? '' : 's'} across ${filesChanged} file${filesChanged === 1 ? '' : 's'}`
    );
}
