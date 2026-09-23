import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { findHeaderAbove, getSectionRange } from './documentUtils';
import { NumberingRuns } from './numberingRuns';

type EditBuilder = vscode.TextEditorEdit;

interface ItemLine { lineIndex: number; text: string; sortKey: string; }

function collectBulletItems(doc: vscode.TextDocument, start: number, end: number, prefix: string): ItemLine[] {
    const items: ItemLine[] = [];
    for (let i = start + 1; i <= end; i++) {
        const text   = doc.lineAt(i).text;
        const bullet = parseBullet(text, prefix);
        if (bullet) { items.push({ lineIndex: i, text, sortKey: bullet.content.toLowerCase() }); }
    }
    return items;
}

async function replaceItems(editor: vscode.TextEditor, original: ItemLine[], sorted: ItemLine[]): Promise<void> {
    await editor.edit((eb: EditBuilder) => {
        for (let i = 0; i < original.length; i++) {
            eb.replace(editor.document.lineAt(original[i].lineIndex).range, sorted[i].text);
        }
    });
}

/** Sorts all bullet items in the current section A → Z */
export async function onSortItemsAZ(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const { prefix } = getConfig();
    const headerLine = findHeaderAbove(editor.document, editor.selection.active.line);
    if (headerLine < 0) { return; }
    const [, end]    = getSectionRange(editor.document, headerLine);
    const items      = collectBulletItems(editor.document, headerLine, end, prefix);
    if (items.length < 2) { return; }
    await replaceItems(editor, items, [...items].sort((a, b) => a.sortKey.localeCompare(b.sortKey)));
}

/** Sorts all bullet items in the current section Z → A */
export async function onSortItemsZA(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const { prefix } = getConfig();
    const headerLine = findHeaderAbove(editor.document, editor.selection.active.line);
    if (headerLine < 0) { return; }
    const [, end]    = getSectionRange(editor.document, headerLine);
    const items      = collectBulletItems(editor.document, headerLine, end, prefix);
    if (items.length < 2) { return; }
    await replaceItems(editor, items, [...items].sort((a, b) => b.sortKey.localeCompare(a.sortKey)));
}

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
