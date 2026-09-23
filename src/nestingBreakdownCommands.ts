import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';

/** Command: shows how many items are at each chevron depth in the current section */
export async function onShowNestingBreakdown(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const name        = doc.lineAt(headerLine).text.replace(/^> /, '').trim();
    const [, end]     = getSectionRange(doc, headerLine);
    const depthCounts = new Map<number, number>();

    for (let i = headerLine + 1; i <= end; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const chevrons = bullet?.chevrons ?? numbered?.chevrons ?? null;
        if (!chevrons) { continue; }
        const depth = chevrons.length - 2; // >> = depth 0, >>> = depth 1, etc.
        depthCounts.set(depth, (depthCounts.get(depth) ?? 0) + 1);
    }

    if (depthCounts.size === 0) {
        vscode.window.showInformationMessage(`CL: "${name}" - no items found`);
        return;
    }

    const parts = [...depthCounts.entries()]
        .sort(([a], [b]) => a - b)
        .map(([depth, count]) => `${'›'.repeat(depth + 1)} Depth ${depth + 1}: ${count} item${count === 1 ? '' : 's'}`);

    vscode.window.showInformationMessage(
        `CL: "${name}" nesting breakdown\n${parts.join('\n')}`,
        { modal: true }, 'OK'
    );
}
