import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, isHeader } from './patterns';
import { parseCheck } from './checkParser';

interface KanbanCard { content: string; section: string; line: number; }

function collectKanban(doc: vscode.TextDocument, prefix: string): {
    todo: KanbanCard[]; inProgress: KanbanCard[]; done: KanbanCard[];
} {
    const todo: KanbanCard[] = [], inProgress: KanbanCard[] = [], done: KanbanCard[] = [];
    let section = '';
    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (isHeader(text)) { section = text.replace(/^> /, '').trim(); continue; }
        const bullet   = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        const check  = parseCheck(content);
        const isStar = content.trimStart().startsWith('* ');
        const plain  = content.replace(/^\[.\]\s*/, '').replace(/^\*\s+/, '').trim();
        const card   = { content: plain, section, line: i };
        if (check?.state === 'done') { done.push(card); }
        else if (isStar)             { inProgress.push(card); }
        else                         { todo.push(card); }
    }
    return { todo, inProgress, done };
}

function buildKanbanHtml(
    todo: KanbanCard[], inProgress: KanbanCard[], done: KanbanCard[], fileName: string
): string {
    const card = (c: KanbanCard) =>
        `<div class="card" title="${c.section}">${c.content.replace(/</g, '&lt;')}<span class="sec">${c.section}</span></div>`;
    const col  = (title: string, cls: string, cards: KanbanCard[]) =>
        `<div class="col"><div class="col-title ${cls}">${title} <span class="count">${cards.length}</span></div>
${cards.map(card).join('')}</div>`;

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Kanban</title>
<style>
body{font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-foreground);padding:1rem;margin:0}
h1{font-size:.9rem;opacity:.6;margin-bottom:1rem}
.board{display:flex;gap:1rem;align-items:flex-start}
.col{flex:1;background:var(--vscode-editorWidget-background);border-radius:6px;padding:.6rem;min-height:100px}
.col-title{font-weight:bold;font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;padding:.3rem .4rem;border-radius:4px;margin-bottom:.5rem}
.col-title .count{opacity:.5;font-weight:normal}
.todo{color:#A855F7}.inprog{color:#84CC16}.done{color:#637880}
.card{background:var(--vscode-editor-background);border:1px solid var(--vscode-widget-border,#444);border-radius:4px;padding:.4rem .5rem;margin-bottom:.4rem;font-size:.85rem;line-height:1.4;cursor:default}
.sec{display:block;font-size:.7rem;opacity:.45;margin-top:.2rem}
</style></head><body>
<h1>📋 ${fileName}</h1>
<div class="board">
${col('☐ Todo', 'todo', todo)}
${col('⭐ In Progress', 'inprog', inProgress)}
${col('✓ Done', 'done', done)}
</div></body></html>`;
}

let kanbanPanel: vscode.WebviewPanel | undefined;

/** Command: opens a Kanban board webview for the current file */
export async function onShowKanban(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc      = editor.document;
    const fileName = doc.fileName.split(/[\\/]/).pop() ?? 'file';
    const { todo, inProgress, done } = collectKanban(doc, prefix);

    if (kanbanPanel) { kanbanPanel.reveal(); }
    else {
        kanbanPanel = vscode.window.createWebviewPanel(
            'chevron-lists.kanban', 'CL: Kanban',
            vscode.ViewColumn.Beside, { enableScripts: false }
        );
        kanbanPanel.onDidDispose(() => { kanbanPanel = undefined; });
    }
    kanbanPanel.webview.html = buildKanbanHtml(todo, inProgress, done, fileName);
}
