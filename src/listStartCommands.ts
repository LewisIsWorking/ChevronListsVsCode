import * as vscode from 'vscode';
import { parseNumbered } from './patterns';
import { findHeaderAbove, getSectionRange } from './documentUtils';
import { lineAfter } from './lineEdits';
import { NumberingRuns } from './numberingRuns';

/**
 * Command: two behaviours depending on cursor position:
 *
 * ON a numbered item — renumbers that item and the rest of its list to start
 * from the entered number. Items above, and other lists, are untouched.
 *
 * NOT on a numbered item — inserts a new ">> N. " item at the cursor
 * ready to type, with Enter continuing from N+1.
 */
export async function onSetListStartNumber(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const cursor      = editor.selection.active;
    const doc         = editor.document;
    const lineText    = doc.lineAt(cursor.line).text;
    const existing    = parseNumbered(lineText);
    const chevrons    = existing?.chevrons ?? '>>';

    const defaultN = existing ? existing.num : 1;
    const input = await vscode.window.showInputBox({
        prompt:      existing
            ? `Renumber from here — current value is ${existing.num}. New start number:`
            : 'Start numbered list at…',
        value:       String(defaultN),
        placeHolder: 'e.g. 69',
        validateInput: v => /^\d+$/.test(v.trim()) && Number(v.trim()) > 0
            ? null
            : 'Enter a positive integer',
    });
    if (!input?.trim()) { return; }

    const startNum = Number(input.trim());

    if (existing) {
        // ── Rebase mode: renumber from cursor item downwards ─────────────────
        const headerLine = findHeaderAbove(doc, cursor.line);
        const end        = headerLine >= 0 ? getSectionRange(doc, headerLine)[1] : doc.lineCount - 1;

        // Only the cursor item's own list is renumbered. Every numbered item below
        // the cursor used to be, so nested items under it took the new start number
        // too ("5." under "5."), and lists further down the section were changed.
        const runs      = new NumberingRuns();
        let   cursorRun: number | null = null;
        let   next      = startNum;
        await editor.edit(eb => {
            for (let i = headerLine + 1; i <= end; i++) {
                const t   = doc.lineAt(i).text;
                const run = runs.visit(t);
                if (i === cursor.line) { cursorRun = run; }
                if (run === null || i < cursor.line || run !== cursorRun) { continue; }
                const n = parseNumbered(t)!;
                eb.replace(doc.lineAt(i).range, `${n.chevrons} ${next++}. ${n.content}`);
            }
        });
        vscode.window.showInformationMessage(`CL: Renumbered from ${startNum}`);
    } else {
        // ── Insert mode: add a fresh numbered item at cursor ──────────────────
        const itemPrefix = `${chevrons} ${startNum}. `;
        const ins        = lineAfter(editor.document, cursor.line, itemPrefix);
        await editor.edit(eb => eb.insert(ins.position, ins.text));
        const newPos = new vscode.Position(ins.line, itemPrefix.length);
        editor.selection = new vscode.Selection(newPos, newPos);
        editor.revealRange(new vscode.Range(newPos, newPos));
    }
}
