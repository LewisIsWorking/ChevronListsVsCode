import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered, formatDate } from './patterns';
import { parseCheck, countChecks } from './checkParser';
import { getSectionRange } from './documentUtils';
import { collectDueDates } from './dueDateParser';
import { parseWordCountGoal } from './wordGoalParser';

/** Command: opens a side panel with a per-section progress report */
export async function onShowProgressReport(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const today      = new Date();
    const todayStr   = formatDate(today);
    const lines: string[] = [`# Progress Report — ${doc.fileName.split(/[\\/]/).pop()}\n`];

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (!isHeader(text)) { continue; }
        const name    = text.replace(/^> /, '');
        const goal    = parseWordCountGoal(text);
        const [, end] = getSectionRange(doc, i);
        let items = 0, words = 0, flagged = 0, overdue = 0;
        const { done, total } = countChecks(doc, i + 1, end, prefix);

        for (let j = i + 1; j <= end; j++) {
            const t       = doc.lineAt(j).text;
            const bullet  = parseBullet(t, prefix);
            const numbered = parseNumbered(t);
            const content  = bullet?.content ?? numbered?.content ?? null;
            if (!content) { continue; }
            items++;
            words += content.trim().split(/\s+/).filter(Boolean).length;
            if (content.startsWith('? ')) { flagged++; }
            const dateMatch = content.match(/@(\d{4}-\d{2}-\d{2})/);
            if (dateMatch && dateMatch[1] < todayStr) { overdue++; }
        }

        const pct      = total > 0 ? Math.round((done / total) * 100) : null;
        const goalLine = goal !== null ? ` · ${words}/${goal} words (${Math.min(100, Math.round((words/goal)*100))}%)` : '';
        const parts    = [
            `**${items}** item${items === 1 ? '' : 's'}`,
            pct !== null ? `${done}/${total} done (${pct}%)` : null,
            flagged > 0  ? `${flagged} flagged` : null,
            overdue > 0  ? `⚠ ${overdue} overdue` : null,
        ].filter(Boolean);

        lines.push(`## ${name}`);
        lines.push(parts.join(' · ') + goalLine);
        lines.push('');
    }

    const content = lines.join('\n');
    const mdDoc   = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
    await vscode.window.showTextDocument(mdDoc, vscode.ViewColumn.Beside);
}
