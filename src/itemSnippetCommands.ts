import * as vscode from 'vscode';
import { getConfig } from './config';
import { lineAfter } from './lineEdits';

interface ItemSnippet { name: string; description: string; template: string; }

const ITEM_SNIPPETS: ItemSnippet[] = [
    { name: 'Task',           description: '[ ] task with due date and tag',    template: '[ ] ${1:task} @${2:2026-01-01} #${3:tag}' },
    { name: 'Urgent Task',    description: '!!! priority task with due date',   template: '!!! [ ] ${1:task} @${2:2026-01-01}' },
    { name: 'Starred Note',   description: '* starred item',                    template: '* ${1:note}' },
    { name: 'Flagged Item',   description: '? question-flagged item',           template: '? ${1:unclear thing}' },
    { name: 'Timed Task',     description: 'task with time estimate',           template: '${1:task} ~${2:1h}' },
    { name: 'Assigned Task',  description: 'task assigned to a person',         template: '${1:task} @${2:Person}' },
    { name: 'Coloured Item',  description: '{colour} labelled item',            template: '{${1|red,green,blue,yellow|}} ${2:item}' },
    { name: 'Voted Item',     description: 'item with vote count',              template: '${1:item} +${2:1}' },
    { name: 'Commented Item', description: 'item with inline comment',          template: '${1:item} // ${2:note}' },
    { name: 'Stamped Item',   description: 'item with creation date',           template: '${1:item} @created:${2:2026-01-01}' },
];

interface SnippetPickItem extends vscode.QuickPickItem { snippet: ItemSnippet; }

/** Command: inserts a pre-configured item snippet at the cursor */
export async function onInsertItemSnippet(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const pick = await vscode.window.showQuickPick(
        ITEM_SNIPPETS.map(s => ({ label: s.name, description: s.description, snippet: s })) as SnippetPickItem[],
        { placeHolder: 'Select an item snippet to insert…' }
    );
    if (!pick) { return; }

    const cursor    = editor.selection.active;
    const chevrons  = '>>';
    const itemStart = `${chevrons} ${prefix} `;
    const ins       = lineAfter(editor.document, cursor.line, itemStart);
    await editor.edit(eb => eb.insert(ins.position, ins.text));

    const snippetPos = new vscode.Position(ins.line, itemStart.length);
    editor.selection = new vscode.Selection(snippetPos, snippetPos);
    await editor.insertSnippet(new vscode.SnippetString(pick.snippet.template), snippetPos);
}
