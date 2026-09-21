import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { parseCheck } from './checkParser';

type EditBuilder = vscode.TextEditorEdit;

/** Rebuilds a line with new content, preserving chevrons/prefix/num */
function rebuildLine(
    text: string, newContent: string, prefix: string
): string | null {
    const bullet   = parseBullet(text, prefix);
    const numbered = parseNumbered(text);
    if (bullet)   { return `${bullet.chevrons} ${prefix} ${newContent}`; }
    if (numbered) { return `${numbered.chevrons} ${numbered.num}. ${newContent}`; }
    return null;
}

/** Command: toggles done state on every cursor's item simultaneously */
export async function onToggleDoneAllCursors(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;

    // Deduplicate line numbers across all cursors
    const lines = [...new Set(editor.selections.map(s => s.active.line))];
    await editor.edit((eb: EditBuilder) => {
        for (const lineIndex of lines) {
            const text    = doc.lineAt(lineIndex).text;
            const bullet  = parseBullet(text, prefix);
            const numbered = parseNumbered(text);
            const content  = bullet?.content ?? numbered?.content ?? null;
            if (!content) { continue; }
            const check = parseCheck(content);
            let newContent: string;
            if (!check) {
                newContent = `[ ] ${content}`;
            } else if (check.state === 'done') {
                newContent = `[ ] ${check.contentWithout}`;
            } else {
                newContent = `[x] ${check.contentWithout}`;
            }
            const newLine = rebuildLine(text, newContent, prefix);
            if (newLine) { eb.replace(doc.lineAt(lineIndex).range, newLine); }
        }
    });
}

/** Command: sets the same priority on every cursor's item simultaneously */
export async function onSetPriorityAllCursors(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const pick = await vscode.window.showQuickPick(
        [
            { label: '$(error) !!! Urgent',  priority: '!!!' },
            { label: '$(warning) !! High',   priority: '!!' },
            { label: '$(info) ! Normal',     priority: '!' },
            { label: '$(circle-slash) None', priority: '' },
        ],
        { placeHolder: 'Set priority on all cursor items…' }
    );
    if (!pick) { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const lines      = [...new Set(editor.selections.map(s => s.active.line))];

    await editor.edit((eb: EditBuilder) => {
        for (const lineIndex of lines) {
            const text    = doc.lineAt(lineIndex).text;
            const bullet  = parseBullet(text, prefix);
            const numbered = parseNumbered(text);
            const content  = bullet?.content ?? numbered?.content ?? null;
            if (!content) { continue; }
            // Strip existing priority
            const stripped = content.replace(/^(!{1,3})\s*/, '').trim();
            const newContent = pick.priority ? `${pick.priority} ${stripped}` : stripped;
            const newLine    = rebuildLine(text, newContent, prefix);
            if (newLine) { eb.replace(doc.lineAt(lineIndex).range, newLine); }
        }
    });
}
