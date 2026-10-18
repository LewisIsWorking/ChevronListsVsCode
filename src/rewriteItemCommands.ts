import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { callClaude, getApiKey } from './aiCommands';

const SYSTEM_REWRITE = `You are a helpful writing assistant for a bullet list tool.
Rewrite the list item you are given to be clearer and more concise.
Return ONLY the rewritten text, no explanation, no quotes.`;

// Markers at the front of the content, in any order
const LEAD_RES = [
    /^\[(?:[xX]| ?)\]\s*/,                               // checkbox
    /^!{1,3}\s+/,                                        // priority
    /^[*?]\s+/,                                          // star or flag
    /^(?:⭐|📌|🚩|📝)\s*/u,                              // marker emoji
    /^\{(?:red|green|blue|yellow|orange|purple)\}\s*/,   // colour label
];
// Metadata anywhere in the rest of the content
const META_RES = [
    /(?:^|\s)\/\/.*$/g,                                  // inline comment
    /(?:^|\s)\+\d+(?=\s*(?:\/\/.*)?$)/g,                 // votes, before any comment
    /(?:^|\s)#[A-Za-z][\w-]*/g,                          // tags
    /@created:\d{4}-\d{2}-\d{2}/g,                       // creation dates
    /@\d{4}-\d{2}-\d{2}/g,                               // due dates
    /@(?:daily|weekly|monthly)/g,                        // recurrence
    /~\d+h(?:\d+m)?|~\d+m/g,                             // time estimates
    /\{(?:red|green|blue|yellow|orange|purple)\}/g,      // colour labels
    /\[\[[^\]]+\]\]/g,                                   // section and file links
    /⭐|📌|🚩|📝/gu,                                     // marker emoji
];

/** An item's content split for rewriting: markers in front, the words, metadata after */
export interface RewriteSplit { lead: string; plain: string; tail: string }

/**
 * Pure: splits item content so only the words go to Claude. The rewrite used to
 * search the original line for the stripped words, so metadata in the middle of
 * the text ("fix the #urgent bug") meant no match and the rewrite was dropped.
 * Null when there are no words to rewrite.
 */
export function splitForRewrite(content: string): RewriteSplit | null {
    let rest = content.trim();
    const lead: string[] = [];
    for (;;) {
        const m = LEAD_RES.map(re => re.exec(rest)).find(Boolean);
        if (!m) { break; }
        lead.push(m[0].trim());
        rest = rest.slice(m[0].length);
    }
    // Metadata in the order it appears; where matches overlap the first one wins
    const found = META_RES.flatMap(re => [...rest.matchAll(re)])
        .map(m => ({ start: m.index!, end: m.index! + m[0].length, text: m[0].trim() }))
        .sort((a, b) => a.start - b.start);
    const kept: typeof found = [];
    for (const f of found) { if (kept.every(k => f.start >= k.end)) { kept.push(f); } }
    let plain = rest;
    for (const k of [...kept].reverse()) { plain = plain.slice(0, k.start) + ' ' + plain.slice(k.end); }
    plain = plain.replace(/\s+/g, ' ').trim();
    if (!plain) { return null; }
    return { lead: lead.join(' '), plain, tail: kept.map(k => k.text).join(' ') };
}

/** Command: rewrites the item at the cursor using Claude, preserving all markers */
export async function onRewriteItem(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    if (!(await getApiKey())) {
        vscode.window.showWarningMessage('CL: Run CL: Set Anthropic API Key to use AI commands');
        return;
    }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const text       = doc.lineAt(lineIndex).text;
    const bullet     = parseBullet(text, prefix);
    const numbered   = parseNumbered(text);
    const split      = (bullet || numbered) ? splitForRewrite(bullet?.content ?? numbered!.content) : null;

    if (!split) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item to rewrite it');
        return;
    }

    const chevrons = bullet?.chevrons ?? numbered!.chevrons;
    const start    = numbered ? `${chevrons} ${numbered.num}.` : `${chevrons} ${prefix}`;

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'CL: Rewriting item…', cancellable: false },
        async () => {
            try {
                // It used to read only the first content block and ignore HTTP errors,
                // so a failed request showed "AI returned no content"
                const rewritten = (await callClaude(SYSTEM_REWRITE, `Item: ${split.plain}`)).replace(/\s+/g, ' ').trim();
                if (!rewritten) { vscode.window.showWarningMessage('CL: AI returned no content'); return; }

                // Rebuild line: markers, the new words, then the metadata
                const newLine = [start, split.lead, rewritten, split.tail].filter(Boolean).join(' ');
                await editor.edit(eb => eb.replace(doc.lineAt(lineIndex).range, newLine));
            } catch (e) {
                vscode.window.showErrorMessage(`CL: AI request failed - ${(e as Error).message}`);
            }
        }
    );
}
