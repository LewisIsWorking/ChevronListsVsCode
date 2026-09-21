import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';
import { parseCheck } from './checkParser';
import { parsePriority } from './priorityParser';
import { stripAllMetadata } from './metadataStripper';

/** Pure: converts priority level to an HTML badge */
function priorityBadge(level: number): string {
    if (level === 3) { return '<span style="color:#E06C75;font-weight:bold">🔴 </span>'; }
    if (level === 2) { return '<span style="color:#E5C07B;font-weight:bold">🟠 </span>'; }
    if (level === 1) { return '<span style="color:#E5C07B">🟡 </span>'; }
    return '';
}

/** Command: copies the current section as a rich HTML snippet to the clipboard */
export async function onCopySectionAsHtml(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const name    = doc.lineAt(headerLine).text.replace(/^> /, '').trim();
    const [, end] = getSectionRange(doc, headerLine);
    const lines: string[] = [];

    for (let i = headerLine + 1; i <= end; i++) {
        const text     = doc.lineAt(i).text;
        const bullet   = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }

        const depth    = (bullet?.chevrons ?? numbered!.chevrons).length - 2;
        const indent   = '&nbsp;'.repeat(depth * 4);
        const check    = parseCheck(content);
        const priority = parsePriority(content)?.level ?? 0;
        const plain    = stripAllMetadata(content)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const badge    = priorityBadge(priority);

        if (check) {
            const box = check.state === 'done'
                ? '<input type="checkbox" checked disabled>'
                : '<input type="checkbox" disabled>';
            lines.push(`<li style="margin:.2em 0">${indent}${box} ${badge}${plain}</li>`);
        } else if (numbered) {
            lines.push(`<li style="list-style:decimal;margin:.2em 0">${indent}${badge}${plain}</li>`);
        } else {
            lines.push(`<li style="list-style:disc;margin:.2em 0">${indent}${badge}${plain}</li>`);
        }
    }

    const html = `<section><h3 style="margin:0 0 .5em">${name}</h3><ul style="padding-left:1.2em;margin:0">${lines.join('')}</ul></section>`;
    await vscode.env.clipboard.writeText(html);
    vscode.window.showInformationMessage(`CL: "${name}" copied as HTML (${lines.length} items)`);
}
