import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, isEscalatable } from './patterns';
import { joinItem, splitItem } from './itemParts';

/** The item raised to urgent, its other markers in place, or null when it should stay as it is */
export function escalatedContent(content: string, today: Date): string | null {
    const parts = splitItem(content);
    if (parts.priority === '!!!' || !isEscalatable(content, today)) { return null; }
    return joinItem({ ...parts, priority: '!!!' });
}

/** Applies overdue escalation across the document if the setting is enabled */
export function applyOverdueEscalation(editor: vscode.TextEditor): void {
    const cfg = vscode.workspace.getConfiguration('chevron-lists');
    if (!cfg.get<boolean>('escalateOverdue', false)) { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const today      = new Date();
    const edits: Array<{ line: number; newText: string }> = [];

    for (let i = 0; i < doc.lineCount; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const newContent = escalatedContent(content, today);
        if (newContent === null) { continue; }
        const chevrons   = bullet?.chevrons ?? numbered!.chevrons;
        const num        = numbered?.num ?? null;
        edits.push({
            line:    i,
            newText: num !== null
                ? `${chevrons} ${num}. ${newContent}`
                : `${chevrons} ${prefix} ${newContent}`,
        });
    }

    if (edits.length === 0) { return; }
    const we = new vscode.WorkspaceEdit();
    for (const e of edits) { we.replace(doc.uri, doc.lineAt(e.line).range, e.newText); }
    vscode.workspace.applyEdit(we);
}
