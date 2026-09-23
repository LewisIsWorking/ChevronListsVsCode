import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { parseCheck } from './checkParser';
import { getSectionRange } from './documentUtils';

const makeProgressDec = (color: string) => vscode.window.createTextEditorDecorationType({
    after: { margin: '0 0 0 0.5em', color },
});
const DEC_RED   = makeProgressDec('#E06C75');
const DEC_AMBER = makeProgressDec('#E5C07B');
const DEC_GREEN = makeProgressDec('#98C379');

/** Builds a progress bar string of given length */
function buildBar(done: number, total: number, length: number): string {
    const bars = Math.round((done / total) * length);
    return '▓'.repeat(bars) + '░'.repeat(length - bars);
}

/** Pushes a decoration into the correct colour bucket */
function pushDecoration(
    opt: vscode.DecorationOptions,
    pct: number,
    red: vscode.DecorationOptions[],
    amber: vscode.DecorationOptions[],
    green: vscode.DecorationOptions[]
): void {
    if (pct >= 1)        { green.push(opt); }
    else if (pct >= 0.5) { amber.push(opt); }
    else                 { red.push(opt); }
}

/** Returns the chevron string one depth deeper - ">>" → ">>>" */
function oneDeeper(chevrons: string): string {
    return chevrons + '>';
}

/** Updates checklist progress bars on section headers AND numbered sub-group headers.
 *
 * Sub-group rule: a >> N. item gets a 6-block mini bar only when the items
 * immediately following it are at exactly one depth level deeper (>>> -).
 * This is opt-in - you choose the sub-group structure by indenting with Tab.
 */
export function updateChecklistProgressDecorations(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const red: vscode.DecorationOptions[]   = [];
    const amber: vscode.DecorationOptions[] = [];
    const green: vscode.DecorationOptions[] = [];

    for (let i = 0; i < doc.lineCount; i++) {
        if (!isHeader(doc.lineAt(i).text)) { continue; }
        const [, sectionEnd] = getSectionRange(doc, i);

        // ── Section-level progress bar (10 blocks, all checkboxes) ───────
        let done = 0, total = 0;
        for (let j = i + 1; j <= sectionEnd; j++) {
            const content = parseBullet(doc.lineAt(j).text, prefix)?.content
                         ?? parseNumbered(doc.lineAt(j).text)?.content ?? null;
            if (!content) { continue; }
            const check = parseCheck(content);
            if (!check) { continue; }
            total++;
            if (check.state === 'done') { done++; }
        }
        if (total > 0) {
            const pct = done / total;
            pushDecoration({
                range:         doc.lineAt(i).range,
                renderOptions: { after: { contentText: `  ${buildBar(done, total, 10)} ${done}/${total}` } },
            }, pct, red, amber, green);
        }

        // ── Numbered item sub-group bars (6 blocks, deeper children only) ─
        // Rule: >> N. gets a bar only if the lines after it are at >>> depth.
        for (let j = i + 1; j <= sectionEnd; j++) {
            const numbered = parseNumbered(doc.lineAt(j).text);
            if (!numbered) { continue; }
            // Skip numbered items that are themselves checkboxes
            if (parseCheck(numbered.content)) { continue; }

            const childChevrons = oneDeeper(numbered.chevrons);

            // Peek at the next non-blank line - if it isn't at childChevrons depth, skip
            let firstChild = -1;
            for (let k = j + 1; k <= sectionEnd; k++) {
                const t = doc.lineAt(k).text.trim();
                if (!t) { continue; }
                const b = parseBullet(doc.lineAt(k).text, prefix);
                const n = parseNumbered(doc.lineAt(k).text);
                if ((b && b.chevrons === childChevrons) || (n && n.chevrons === childChevrons)) {
                    firstChild = k;
                }
                break; // only peek one line
            }
            if (firstChild < 0) { continue; } // no deeper children - no bar

            // Count checkboxes that are exactly at childChevrons depth
            let gDone = 0, gTotal = 0;
            for (let k = j + 1; k <= sectionEnd; k++) {
                const lineText = doc.lineAt(k).text;
                const b = parseBullet(lineText, prefix);
                const n = parseNumbered(lineText);
                const chevs  = b?.chevrons ?? n?.chevrons ?? null;
                const content = b?.content  ?? n?.content  ?? null;
                // Stop when we return to the same or shallower depth
                if (chevs && chevs.length <= numbered.chevrons.length) { break; }
                if (!content || chevs !== childChevrons) { continue; }
                const check = parseCheck(content);
                if (!check) { continue; }
                gTotal++;
                if (check.state === 'done') { gDone++; }
            }

            if (gTotal === 0) { continue; }
            const gPct = gDone / gTotal;
            pushDecoration({
                range:         doc.lineAt(j).range,
                renderOptions: { after: { contentText: `  ${buildBar(gDone, gTotal, 6)} ${gDone}/${gTotal}` } },
            }, gPct, red, amber, green);
        }
    }

    editor.setDecorations(DEC_RED,   red);
    editor.setDecorations(DEC_AMBER, amber);
    editor.setDecorations(DEC_GREEN, green);
}
