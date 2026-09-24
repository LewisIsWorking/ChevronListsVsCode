import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { findHeaderAbove, getSectionRange } from './documentUtils';
import { NumberingRuns } from './numberingRuns';

type EditBuilder = vscode.TextEditorEdit;

interface SortItem { head: string; depth: number; key: string; num: number | null }

function sortItemOf(line: string, prefix: string): SortItem | null {
    const n = parseNumbered(line);
    if (n) { return { head: line, depth: n.chevrons.length, key: n.content.toLowerCase(), num: n.num }; }
    const b = parseBullet(line, prefix);
    return b ? { head: line, depth: b.chevrons.length, key: b.content.toLowerCase(), num: null } : null;
}

/**
 * Pure: the lines of a section body with its items sorted. Siblings are sorted,
 * not lines: each item keeps everything nested under it, and nested items are
 * sorted among themselves. Lines that are not items stay put and split the
 * lists around them. Numbers stay with their positions, so 1, 2, 3 still reads
 * 1, 2, 3.
 *
 * The sort used to reorder every bullet line in the section regardless of depth,
 * so nested items ended up under the wrong parent. Mirrors computeSortSection in
 * the JetBrains plugin.
 */
export function sortItems(lines: string[], descending: boolean, prefix: string): string[] {
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
        const first = sortItemOf(lines[i], prefix);
        if (!first) { out.push(lines[i]); i++; continue; }

        const blocks: { item: SortItem; children: string[] }[] = [];
        while (i < lines.length) {
            const item = sortItemOf(lines[i], prefix);
            if (!item || item.depth !== first.depth) { break; }
            let end = i + 1;
            while (end < lines.length && (sortItemOf(lines[end], prefix)?.depth ?? 0) > first.depth) { end++; }
            blocks.push({ item, children: sortItems(lines.slice(i + 1, end), descending, prefix) });
            i = end;
        }

        // Array.prototype.sort is stable, so equal items keep their order
        const sorted  = [...blocks].sort((a, b) => (descending ? -1 : 1) * a.item.key.localeCompare(b.item.key));
        const numbers = blocks.flatMap(b => b.item.num === null ? [] : [b.item.num]).sort((a, b) => a - b);
        for (const { item, children } of sorted) {
            if (item.num === null) { out.push(item.head); }
            else {
                const n = parseNumbered(item.head)!;
                out.push(`${n.chevrons} ${numbers.shift()}. ${n.content}`);
            }
            out.push(...children);
        }
    }
    return out;
}

async function sortSection(descending: boolean): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { return; }
    const [, end]    = getSectionRange(doc, headerLine);
    const before     = Array.from({ length: end - headerLine }, (_, k) => doc.lineAt(headerLine + 1 + k).text);
    const after      = sortItems(before, descending, prefix);
    if (after.every((text, k) => text === before[k])) { return; }
    await editor.edit((eb: EditBuilder) => {
        after.forEach((text, k) => {
            if (text !== before[k]) { eb.replace(doc.lineAt(headerLine + 1 + k).range, text); }
        });
    });
}

/** Sorts the items in the current section A to Z, keeping nested items with their parent */
export function onSortItemsAZ(): Promise<void> { return sortSection(false); }

/** Sorts the items in the current section Z to A, keeping nested items with their parent */
export function onSortItemsZA(): Promise<void> { return sortSection(true); }

/** Resets numbering on all numbered items per chevron depth */
export async function onRenumberItems(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const headerLine = findHeaderAbove(editor.document, editor.selection.active.line);
    if (headerLine < 0) { return; }
    const [, end]    = getSectionRange(editor.document, headerLine);
    const renumbered = renumber(Array.from({ length: end - headerLine }, (_, k) => editor.document.lineAt(headerLine + 1 + k).text));
    await editor.edit((eb: EditBuilder) => {
        renumbered.forEach((text, k) => {
            const line = editor.document.lineAt(headerLine + 1 + k);
            if (parseNumbered(line.text)) { eb.replace(line.range, text); }
        });
    });
}

/**
 * Converts all >> - bullet items in the section to numbered items,
 * continuing from the highest existing number. Sentence order preserved.
 */
export async function onConvertBulletsToNumbered(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const [, end]    = getSectionRange(doc, headerLine);
    // Which list each bullet joins once numbered, and the highest number already
    // in each list: a bullet continues its own list, not every list at its depth.
    const runs       = new NumberingRuns();
    const runOf      = new Map<number, number>();
    const maxNum     = new Map<number, number>();
    for (let i = headerLine + 1; i <= end; i++) {
        const text = doc.lineAt(i).text;
        const run  = runs.visit(text, parseBullet(text, prefix) !== null);
        if (run === null) { continue; }
        runOf.set(i, run);
        const n = parseNumbered(text);
        if (n) { maxNum.set(run, Math.max(maxNum.get(run) ?? 0, n.num)); }
    }
    let converted = 0;
    await editor.edit((eb: EditBuilder) => {
        for (let i = headerLine + 1; i <= end; i++) {
            const bullet = parseBullet(doc.lineAt(i).text, prefix);
            if (!bullet) { continue; }
            const run  = runOf.get(i)!;
            const next = (maxNum.get(run) ?? 0) + 1;
            maxNum.set(run, next);
            eb.replace(doc.lineAt(i).range, `${bullet.chevrons} ${next}. ${bullet.content}`);
            converted++;
        }
    });
    if (converted === 0) { vscode.window.showInformationMessage('CL: No bullet items found to convert'); }
}

/**
 * Converts all >> N. numbered items in the section to bullet items.
 * Sentence order is fully preserved - only the prefix changes.
 */
export async function onConvertNumberedToBullets(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const [, end]    = getSectionRange(doc, headerLine);
    let converted = 0;
    await editor.edit((eb: EditBuilder) => {
        for (let i = headerLine + 1; i <= end; i++) {
            const numbered = parseNumbered(doc.lineAt(i).text);
            if (!numbered) { continue; }
            eb.replace(doc.lineAt(i).range, `${numbered.chevrons} ${prefix} ${numbered.content}`);
            converted++;
        }
    });
    if (converted === 0) { vscode.window.showInformationMessage('CL: No numbered items found to convert'); }
}

/** Pure: numbers every list from 1, each list counted separately (see NumberingRuns) */
export function renumber(lines: string[]): string[] {
    const counters = new Map<number, number>();
    const runs     = new NumberingRuns();
    return lines.map(text => {
        const run = runs.visit(text);
        if (run === null) { return text; }
        const numbered = parseNumbered(text)!;
        const next = (counters.get(run) ?? 0) + 1;
        counters.set(run, next);
        return `${numbered.chevrons} ${next}. ${numbered.content}`;
    });
}
