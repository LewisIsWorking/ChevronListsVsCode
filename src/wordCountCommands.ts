import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { parseWordCountGoal, headerNameWithoutGoal } from './wordGoalParser';
import { getSectionRange, findHeaderAbove } from './documentUtils';
import { itemWordCount } from './metadataStripper';

interface WordCountPickItem extends vscode.QuickPickItem { lineIndex: number; }

/** Command: shows word counts for every section in the file */
export async function onShowWordCount(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const items: WordCountPickItem[] = [];

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (!isHeader(text)) { continue; }

        const goal       = parseWordCountGoal(text);
        const name       = headerNameWithoutGoal(text);
        const [, end]    = getSectionRange(doc, i);
        let words = 0;
        for (let j = i + 1; j <= end; j++) {
            const line    = doc.lineAt(j).text;
            const bullet  = parseBullet(line, prefix);
            const numbered = parseNumbered(line);
            const content  = bullet?.content ?? numbered?.content ?? null;
            if (content) { words += itemWordCount(content); }
        }

        const description = goal !== null
            ? `${words} / ${goal} words${words >= goal ? ' ✅' : ''}`
            : `${words} word${words === 1 ? '' : 's'}`;

        items.push({ label: name, description, lineIndex: i });
    }

    if (items.length === 0) {
        vscode.window.showInformationMessage('CL: No sections found in this file');
        return;
    }

    const pick = vscode.window.createQuickPick<WordCountPickItem>();
    pick.items       = items;
    pick.placeholder = 'Word counts per section (sections with ==N goals show progress)';

    const originalPos = editor.selection.active;
    pick.onDidChangeActive(active => {
        if (!active[0]) { return; }
        const pos = new vscode.Position(active[0].lineIndex, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    });
    pick.onDidAccept(() => { pick.hide(); });
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) {
            const pos = new vscode.Position(originalPos.line, originalPos.character);
            editor.selection = new vscode.Selection(pos, pos);
        }
        pick.dispose();
    });
    pick.show();
}

/** Command: shows a nesting depth breakdown for the current section */
export async function onShowNestingSummary(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }

    const name       = doc.lineAt(headerLine).text.replace(/^> /, '');
    const [, end]    = getSectionRange(doc, headerLine);
    const depths     = new Map<number, number>();

    for (let i = headerLine + 1; i <= end; i++) {
        const text    = doc.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const chevrons = bullet?.chevrons ?? numbered?.chevrons ?? null;
        if (!chevrons) { continue; }
        const depth = chevrons.length - 2;
        depths.set(depth, (depths.get(depth) ?? 0) + 1);
    }

    if (depths.size === 0) {
        vscode.window.showInformationMessage(`CL: "${name}" has no items`);
        return;
    }

    const lines = [...depths.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([d, n]) => `Depth ${d}: ${n} item${n === 1 ? '' : 's'}`);

    vscode.window.showInformationMessage(`"${name}" - ${lines.join(', ')}`);
}
