import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { parseCreatedDate, ageInDays } from './itemAgeParser';
import { getSectionRange, findHeaderAbove } from './documentUtils';

/** Command: shows age statistics for @created: stamped items in the current section */
export async function onShowAgeStats(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const name        = doc.lineAt(headerLine).text.replace(/^> /, '');
    const [, end]     = getSectionRange(doc, headerLine);
    const today       = new Date();
    const ages: Array<{ age: number; content: string; dateStr: string }> = [];

    for (let i = headerLine + 1; i <= end; i++) {
        const t = doc.lineAt(i).text;
        const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
        if (!content) { continue; }
        const dateStr = parseCreatedDate(content);
        if (!dateStr) { continue; }
        ages.push({ age: ageInDays(dateStr, today), content, dateStr });
    }

    if (ages.length === 0) {
        vscode.window.showInformationMessage(`CL: "${name}" — no @created: stamps found. Use CL: Stamp Item to add them.`);
        return;
    }

    ages.sort((a, b) => b.age - a.age);
    const oldest  = ages[0];
    const newest  = ages[ages.length - 1];
    const avgAge  = Math.round(ages.reduce((s, a) => s + a.age, 0) / ages.length);
    const stamped = ages.length;

    const msg = [
        `"${name}" — ${stamped} stamped item${stamped === 1 ? '' : 's'}`,
        `Oldest: ${oldest.dateStr} (${oldest.age}d) — ${oldest.content.slice(0, 40)}`,
        `Newest: ${newest.dateStr} (${newest.age}d) — ${newest.content.slice(0, 40)}`,
        `Average age: ${avgAge} day${avgAge === 1 ? '' : 's'}`,
    ].join('\n');

    vscode.window.showInformationMessage(msg, { modal: true }, 'OK');
}
