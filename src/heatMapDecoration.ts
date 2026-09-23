import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered, computeSectionWeight } from './patterns';
import { getSectionRange } from './documentUtils';
import { extractTags } from './tagParser';
import { parsePriority } from './priorityParser';
import { parseVote } from './voteParser';

const BUCKETS = 10;

/**
 * One decoration type per intensity bucket, created ONCE at module load.
 * Reused across every editor and every refresh - no per-keystroke allocation.
 * Previously these were created inside the update function, leaking 11
 * `TextEditorDecorationType` objects per keystroke (10 buckets + 1 throwaway).
 */
const BUCKET_DECS: vscode.TextEditorDecorationType[] = Array.from({ length: BUCKETS }, (_, b) => {
    const intensity = Math.round(((b + 1) / BUCKETS) * 255);
    return vscode.window.createTextEditorDecorationType({
        overviewRulerLane:  vscode.OverviewRulerLane.Right,
        overviewRulerColor: `rgba(${intensity}, ${Math.round(intensity * 0.5)}, 255, 0.8)`,
    });
});

/** Updates the overview ruler heat map markers based on section weight */
export function updateHeatMapDecorations(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const weights: Array<{ line: number; weight: number }> = [];
    for (let i = 0; i < doc.lineCount; i++) {
        if (!isHeader(doc.lineAt(i).text)) { continue; }
        const [, end] = getSectionRange(doc, i);
        let items = 0, prioritySum = 0, votes = 0, tags = 0;
        for (let j = i + 1; j <= end; j++) {
            const t       = doc.lineAt(j).text;
            const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
            if (!content) { continue; }
            items++;
            prioritySum += parsePriority(content)?.level ?? 0;
            votes       += parseVote(content)?.count ?? 0;
            tags        += extractTags(content).length;
        }
        weights.push({ line: i, weight: computeSectionWeight(items, prioritySum, votes, tags) });
    }

    const maxWeight = Math.max(...weights.map(w => w.weight), 1);

    // Group lines by bucket so we can apply each decoration type in a single batch
    const rangesByBucket: vscode.Range[][] = Array.from({ length: BUCKETS }, () => []);
    for (const { line, weight } of weights) {
        const bucketIndex = Math.min(BUCKETS - 1, Math.floor((weight / maxWeight) * BUCKETS));
        rangesByBucket[bucketIndex].push(doc.lineAt(line).range);
    }

    // Apply each bucket's ranges. setDecorations replaces any previous ranges for the
    // same type on this editor, so old markers are cleared automatically without any
    // throwaway allocations.
    for (let b = 0; b < BUCKETS; b++) {
        editor.setDecorations(BUCKET_DECS[b], rangesByBucket[b]);
    }
}
