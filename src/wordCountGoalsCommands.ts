import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { parseWordCountGoal, headerNameWithoutGoal } from './wordGoalParser';
import { getSectionRange } from './documentUtils';
import { itemWordCount } from './metadataStripper';

interface GoalItem extends vscode.QuickPickItem {
    lineIndex: number;
}

/** Command: lists all ==N word goal sections with current progress, sorted by furthest from target */
export async function onShowWordCountGoals(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;

    const results: Array<{ name: string; words: number; goal: number; line: number }> = [];

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (!isHeader(text)) { continue; }
        const goal = parseWordCountGoal(text);
        if (goal === null) { continue; }

        const name    = headerNameWithoutGoal(text);
        const [, end] = getSectionRange(doc, i);
        let words = 0;
        for (let j = i + 1; j <= end; j++) {
            const t       = doc.lineAt(j).text;
            const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
            if (content) { words += itemWordCount(content); }
        }
        results.push({ name, words, goal, line: i });
    }

    if (results.length === 0) {
        vscode.window.showInformationMessage('CL: No word count goals found - add `==N` to a section header');
        return;
    }

    // Sort: incomplete first (furthest from goal), then completed
    results.sort((a, b) => {
        const aRemain = Math.max(0, a.goal - a.words);
        const bRemain = Math.max(0, b.goal - b.words);
        return bRemain - aRemain;
    });

    const items: GoalItem[] = results.map(r => {
        const pct      = Math.min(100, Math.round((r.words / r.goal) * 100));
        const bars     = Math.round(pct / 10);
        const bar      = '▓'.repeat(bars) + '░'.repeat(10 - bars);
        const icon     = pct >= 100 ? '$(check)' : pct >= 50 ? '$(dash)' : '$(circle-outline)';
        const remain   = r.goal - r.words;
        const detail   = remain > 0 ? `${remain} words to go` : `✓ ${r.words - r.goal} over goal`;
        return {
            label:       `${icon} ${r.name}`,
            description: `${bar} ${r.words}/${r.goal} (${pct}%)`,
            detail,
            lineIndex:   r.line,
        };
    });

    const originalPos = editor.selection.active;
    const pick        = vscode.window.createQuickPick<GoalItem>();
    pick.items        = items;
    pick.placeholder  = `${results.length} word goal section${results.length === 1 ? '' : 's'} - press Enter to jump`;
    pick.onDidChangeActive(active => {
        if (!active[0]) { return; }
        const pos = new vscode.Position(active[0].lineIndex, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    });
    pick.onDidAccept(() => { pick.hide(); });
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) { editor.selection = new vscode.Selection(originalPos, originalPos); }
        pick.dispose();
    });
    pick.show();
}
