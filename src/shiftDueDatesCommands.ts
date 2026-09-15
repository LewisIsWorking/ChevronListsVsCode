import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, shiftDate } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';

/** Command: shifts the @YYYY-MM-DD due dates of the section's items by N days */
export async function onShiftAllDueDates(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const input = await vscode.window.showInputBox({
        prompt:       'Shift all due dates by how many days? (use negative to move back)',
        placeHolder:  'e.g. 7 or -3',
        validateInput: v => /^-?\d+$/.test(v.trim()) && v.trim() !== '0'
            ? null : 'Enter a non-zero integer',
    });
    if (!input?.trim()) { return; }

    const { prefix }  = getConfig();
    const days        = Number(input.trim());
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const [, end]     = getSectionRange(doc, headerLine);

    // Only list items have due dates. Every @YYYY-MM-DD on every line used to
    // move, dates written in prose and notes included. The count is of dates,
    // not lines: a line with two dates used to report "Shifted 1 date".
    let shifted = 0;
    await editor.edit(eb => {
        for (let i = headerLine + 1; i <= end; i++) {
            const text = doc.lineAt(i).text;
            if (!parseBullet(text, prefix) && !parseNumbered(text)) { continue; }
            const newText = text.replace(/@(\d{4}-\d{2}-\d{2})/g, (_, d: string) => {
                shifted++;
                return `@${shiftDate(d, days)}`;
            });
            if (newText !== text) { eb.replace(doc.lineAt(i).range, newText); }
        }
    });

    const dayWord = `day${Math.abs(days) === 1 ? '' : 's'}`;
    vscode.window.showInformationMessage(
        shifted > 0
            ? `CL: Shifted ${shifted} date${shifted === 1 ? '' : 's'} by ${days > 0 ? '+' : ''}${days} ${dayWord}`
            : 'CL: No due dates found in this section'
    );
}
