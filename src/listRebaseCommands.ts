import * as vscode from 'vscode';
import { parseNumbered } from './patterns';
import { findHeaderAbove, getSectionRange } from './documentUtils';
import { NumberingRuns } from './numberingRuns';

type EditBuilder = vscode.TextEditorEdit;

/** Command: renumbers items from the cursor line onwards, leaving items above untouched */
export async function onRebaseListFromHere(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const text       = doc.lineAt(lineIndex).text;
    const numbered   = parseNumbered(text);
    if (!numbered) {
        vscode.window.showInformationMessage('CL: Place cursor on a numbered item to rebase from here');
        return;
    }
    const headerLine = findHeaderAbove(doc, lineIndex);
    if (headerLine < 0) { return; }
    const [, end]    = getSectionRange(doc, headerLine);

    // Each list continues from its last number above the cursor; see NumberingRuns.
    // Counters used to be kept per depth, so the child lists of different parents
    // were numbered as one list.
    const runs     = new NumberingRuns();
    const counters = new Map<number, number>();
    let changed = 0;
    await editor.edit((eb: EditBuilder) => {
        for (let i = headerLine + 1; i <= end; i++) {
            const t   = doc.lineAt(i).text;
            const run = runs.visit(t);
            if (run === null) { continue; }
            const n = parseNumbered(t)!;
            if (i < lineIndex) { counters.set(run, n.num); continue; }
            const next = (counters.get(run) ?? 0) + 1;
            counters.set(run, next);
            if (n.num !== next) {
                eb.replace(doc.lineAt(i).range, `${n.chevrons} ${next}. ${n.content}`);
                changed++;
            }
        }
    });
    vscode.window.showInformationMessage(
        changed > 0 ? `CL: Rebased ${changed} item${changed === 1 ? '' : 's'}` : 'CL: All items already in sequence'
    );
}

/** Command: offsets all numbered items in the section by a fixed amount */
export async function onOffsetListNumbers(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const [, end]    = getSectionRange(doc, headerLine);

    const input = await vscode.window.showInputBox({
        prompt:       'Offset all numbers by (use negative to subtract)',
        placeHolder:  'e.g. 10 or -5',
        validateInput: v => /^-?\d+$/.test(v.trim()) && v.trim() !== '0' ? null : 'Enter a non-zero integer',
    });
    if (!input?.trim()) { return; }
    const offset = Number(input.trim());

    const numberedLines: number[] = [];
    for (let i = headerLine + 1; i <= end; i++) {
        if (parseNumbered(doc.lineAt(i).text)) { numberedLines.push(i); }
    }
    // All or nothing. Items that would go below 1 used to be skipped silently
    // while the rest moved, so "1, 2, 10" offset by -5 became "1, 2, 5" and the
    // message only said "Offset 1 item by -5".
    const tooLow = numberedLines.filter(i => parseNumbered(doc.lineAt(i).text)!.num + offset < 1).length;
    if (tooLow > 0) {
        vscode.window.showInformationMessage(
            `CL: Offsetting by ${offset} would take ${tooLow} item${tooLow === 1 ? '' : 's'} below 1 — nothing changed`
        );
        return;
    }

    const changed = numberedLines.length;
    await editor.edit((eb: EditBuilder) => {
        for (const i of numberedLines) {
            const n = parseNumbered(doc.lineAt(i).text)!;
            eb.replace(doc.lineAt(i).range, `${n.chevrons} ${n.num + offset}. ${n.content}`);
        }
    });
    vscode.window.showInformationMessage(
        changed > 0 ? `CL: Offset ${changed} item${changed === 1 ? '' : 's'} by ${offset > 0 ? '+' : ''}${offset}` : 'CL: No numbered items to offset'
    );
}
