import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange } from './documentUtils';
import { findHeaderAbove } from './documentUtils';
import { lineAfter, sectionContentEnd } from './lineEdits';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-sonnet-4-20250514';

/** Reads the user's Anthropic API key from VS Code settings */
function getApiKey(): string | undefined {
    return vscode.workspace.getConfiguration('chevron-lists').get<string>('anthropicApiKey');
}

/** Makes a request to the Anthropic messages API */
async function callClaude(system: string, user: string): Promise<string> {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('No API key — set chevron-lists.anthropicApiKey in settings');
    }

    const response = await fetch(API_URL, {
        method:  'POST',
        headers: {
            'content-type':      'application/json',
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model:      MODEL,
            max_tokens: 512,
            system,
            messages: [{ role: 'user', content: user }],
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = await response.json() as { content: { type: string; text: string }[] };
    return data.content.find(b => b.type === 'text')?.text ?? '';
}

/** Collects the existing items in the section under the cursor */
function getSectionText(document: vscode.TextDocument, prefix: string, cursorLine: number): { header: string; items: string[] } {
    const headerLine = findHeaderAbove(document, cursorLine);
    if (headerLine < 0) { return { header: '', items: [] }; }
    const header    = document.lineAt(headerLine).text.replace(/^> /, '');
    const [, end]   = getSectionRange(document, headerLine);
    const items: string[] = [];
    for (let i = headerLine + 1; i <= end; i++) {
        const text = document.lineAt(i).text;
        const b = parseBullet(text, prefix);
        const n = parseNumbered(text);
        if (b?.content) { items.push(b.content); }
        else if (n?.content) { items.push(`${n.num}. ${n.content}`); }
    }
    return { header, items };
}

const SYSTEM_SUGGEST = `You are a helpful writing assistant for a bullet list tool.
Given a section header and existing list items, suggest 3-5 additional relevant items.
Return ONLY the items, one per line, with no numbering, bullets, or explanation.
Keep each item concise (under 10 words).`;

const SYSTEM_SUMMARISE = `You are a helpful writing assistant.
Given a section header and its list items, write a single concise summary sentence (max 15 words).
Return ONLY the summary sentence, nothing else.`;

const SYSTEM_EXPAND = `You are a helpful writing assistant for a bullet list tool.
Given a section header and a single item, expand it into 3-5 sub-items.
Return ONLY the sub-items, one per line, with no numbering, bullets, or explanation.
Keep each sub-item concise (under 10 words).`;

/** Command: suggests additional items for the current section */
export async function onSuggestItems(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const { header, items } = getSectionText(editor.document, prefix, editor.selection.active.line);
    if (!header) { vscode.window.showInformationMessage('CL: No section header found at cursor'); return; }
    // Read before awaiting Claude: the cursor may be anywhere by the time it replies
    const headerLine = findHeaderAbove(editor.document, editor.selection.active.line);

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'CL: Asking Claude for suggestions...', cancellable: false },
        async () => {
            try {
                const user  = `Section: "${header}"\nExisting items:\n${items.map(i => `- ${i}`).join('\n') || '(none yet)'}`;
                const reply = await callClaude(SYSTEM_SUGGEST, user);
                const suggestions = reply.split('\n').map(l => l.trim()).filter(Boolean);

                const picks = await vscode.window.showQuickPick(
                    suggestions.map(s => ({ label: s, picked: true })),
                    { canPickMany: true, placeHolder: 'Select suggestions to insert' }
                );
                if (!picks?.length) { return; }

                const ins = lineAfter(editor.document, sectionContentEnd(editor.document, headerLine),
                    picks.map(p => `>> ${prefix} ${p.label}`).join('\n'));
                await editor.edit(eb => eb.insert(ins.position, ins.text));
            } catch (e: unknown) {
                vscode.window.showErrorMessage(`CL: ${(e as Error).message}`);
            }
        }
    );
}

/** Command: generates a one-line summary of the current section */
export async function onSummariseSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const { header, items } = getSectionText(editor.document, prefix, editor.selection.active.line);
    if (!header) { vscode.window.showInformationMessage('CL: No section header found at cursor'); return; }
    // Read before awaiting Claude: the cursor may be anywhere by the time it replies
    const headerLine = findHeaderAbove(editor.document, editor.selection.active.line);

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'CL: Summarising section...', cancellable: false },
        async () => {
            try {
                const user    = `Section: "${header}"\nItems:\n${items.map(i => `- ${i}`).join('\n')}`;
                const summary = (await callClaude(SYSTEM_SUMMARISE, user)).trim();

                const ins = lineAfter(editor.document, headerLine, `>> ${prefix} _${summary}_`);
                await editor.edit(eb => eb.insert(ins.position, ins.text));
            } catch (e: unknown) {
                vscode.window.showErrorMessage(`CL: ${(e as Error).message}`);
            }
        }
    );
}

/** Command: expands the item at the cursor into sub-items */
export async function onExpandItem(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix }  = getConfig();
    const cursorLine  = editor.selection.active.line;
    const text        = editor.document.lineAt(cursorLine).text;
    const bullet      = parseBullet(text, prefix);
    const numbered    = parseNumbered(text);
    const content     = bullet?.content ?? numbered?.content;

    if (!content) { vscode.window.showInformationMessage('CL: Place cursor on a chevron item to expand it'); return; }
    const headerLine  = findHeaderAbove(editor.document, cursorLine);
    const header      = headerLine >= 0 ? editor.document.lineAt(headerLine).text.replace(/^> /, '') : '';

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'CL: Expanding item...', cancellable: false },
        async () => {
            try {
                const user     = `Section: "${header}"\nItem to expand: "${content}"`;
                const reply    = await callClaude(SYSTEM_EXPAND, user);
                const subItems = reply.split('\n').map(l => l.trim()).filter(Boolean);
                if (subItems.length === 0) {
                    vscode.window.showInformationMessage('CL: Claude suggested no sub-items');
                    return;
                }
                const depth    = (bullet?.chevrons ?? numbered?.chevrons ?? '>>').length;
                const newChevs = '>'.repeat(depth + 1);
                const ins      = lineAfter(editor.document, cursorLine,
                    subItems.map(s => `${newChevs} ${prefix} ${s}`).join('\n'));
                await editor.edit(eb => eb.insert(ins.position, ins.text));
            } catch (e: unknown) {
                vscode.window.showErrorMessage(`CL: ${(e as Error).message}`);
            }
        }
    );
}
