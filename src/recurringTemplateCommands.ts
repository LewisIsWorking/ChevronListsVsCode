import * as vscode from 'vscode';
import { getConfig } from './config';
import { lineAfter } from './lineEdits';

interface RecurringTemplate { name: string; description: string; content: string; }

const TEMPLATES: RecurringTemplate[] = [
    { name: 'Daily Standup',    description: 'What did I do / doing / blocked', content: '[ ] Daily standup @daily' },
    { name: 'Weekly Review',    description: 'End-of-week reflection',           content: '[ ] Weekly review @weekly' },
    { name: 'Monthly Report',   description: 'Monthly progress report',          content: '[ ] Monthly report @monthly' },
    { name: 'Daily Check-in',   description: 'Brief daily check-in note',        content: '[ ] Check in @daily' },
    { name: 'Weekly Planning',  description: 'Plan the week ahead',              content: '[ ] Weekly planning @weekly' },
    { name: 'Monthly Goals',    description: 'Review and set monthly goals',     content: '[ ] Review monthly goals @monthly' },
];

interface TemplatePickItem extends vscode.QuickPickItem { tmpl: RecurringTemplate; }

/** Command: inserts a pre-formed recurring item with @daily/weekly/monthly */
export async function onInsertRecurringItem(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const pick = await vscode.window.showQuickPick(
        TEMPLATES.map(t => ({ label: t.name, description: t.description, tmpl: t })) as TemplatePickItem[],
        { placeHolder: 'Insert a recurring item…' }
    );
    if (!pick) { return; }

    const { prefix }  = getConfig();
    const cursor      = editor.selection.active;
    const itemLine    = `>> ${prefix} ${pick.tmpl.content}`;
    const ins         = lineAfter(editor.document, cursor.line, itemLine);
    await editor.edit(eb => eb.insert(ins.position, ins.text));

    const pos = new vscode.Position(ins.line, itemLine.length);
    editor.selection = new vscode.Selection(pos, pos);
}
