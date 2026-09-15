import * as vscode from 'vscode';
import * as path from 'path';
import { isHeader } from './patterns';

const SECTION_LINK_RE = /\[\[([^\]#|]+?)(?:#[^\]]+)?\]\]/g;
const FILE_LINK_RE    = /\[\[file:([^\]]+?)\]\]/g;

interface DeadLink extends vscode.QuickPickItem { lineIndex: number; }

/** Command: scans [[links]] in the file and reports dead ones */
export async function onFindDeadLinks(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const doc       = editor.document;
    const dead: DeadLink[] = [];

    // Collect all section names in the file
    const sectionNames = new Set<string>();
    for (let i = 0; i < doc.lineCount; i++) {
        if (isHeader(doc.lineAt(i).text)) {
            sectionNames.add(doc.lineAt(i).text.replace(/^> /, '').trim().toLowerCase());
        }
    }

    // Collect workspace file names
    const workspaceFiles = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
    const fileNames = new Set(workspaceFiles.map(f => path.basename(f.fsPath).toLowerCase()));

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;

        // Check [[SectionName]] links
        for (const match of text.matchAll(SECTION_LINK_RE)) {
            const target = match[1].trim();
            if (target.startsWith('file:')) { continue; } // handled separately
            if (!sectionNames.has(target.toLowerCase())) {
                dead.push({
                    label:       `$(link-broken) [[${target}]]`,
                    description: `Line ${i + 1} — no section named "${target}" in this file`,
                    lineIndex:   i,
                });
            }
        }

        // Check [[file:name.md]] links
        for (const match of text.matchAll(FILE_LINK_RE)) {
            const target = match[1].trim().toLowerCase();
            if (!fileNames.has(target)) {
                dead.push({
                    label:       `$(link-broken) [[file:${match[1].trim()}]]`,
                    description: `Line ${i + 1} — no file named "${match[1].trim()}" in workspace`,
                    lineIndex:   i,
                });
            }
        }
    }

    if (dead.length === 0) {
        vscode.window.showInformationMessage('CL: No dead links found ✅'); return;
    }

    const pick        = vscode.window.createQuickPick<DeadLink>();
    pick.items        = dead;
    pick.placeholder  = `${dead.length} dead link${dead.length === 1 ? '' : 's'} found`;
    const originalPos = editor.selection.active;
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
