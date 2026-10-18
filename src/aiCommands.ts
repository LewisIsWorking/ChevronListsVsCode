import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange } from './documentUtils';
import { findHeaderAbove } from './documentUtils';
import { lineAfter, sectionContentEnd } from './lineEdits';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-opus-5-5';

const SECRET_KEY = 'chevron-lists.anthropicApiKey';

/** VS Code's encrypted secret storage, set on activation */
let secretStore: vscode.SecretStorage | undefined;

/** Called from activate(): keeps the API key in secret storage, not settings.json */
export function initAiKeyStore(secrets: vscode.SecretStorage): void {
    secretStore = secrets;
}

/**
 * The Anthropic API key: from secret storage, else the old plain-text
 * setting (still read so existing setups keep working), else ANTHROPIC_API_KEY.
 */
export async function getApiKey(): Promise<string | undefined> {
    const stored  = await secretStore?.get(SECRET_KEY);
    const setting = vscode.workspace.getConfiguration('chevron-lists').get<string>('anthropicApiKey');
    return stored || setting || process.env.ANTHROPIC_API_KEY || undefined;
}

/** Command: asks for the API key and saves it in secret storage; blank removes it */
export async function onSetApiKey(): Promise<void> {
    if (!secretStore) { return; }
    const key = await vscode.window.showInputBox({
        prompt: 'Anthropic API key for the AI commands (blank to remove). Kept in VS Code secret storage.',
        password: true, ignoreFocusOut: true,
    });
    if (key === undefined) { return; }
    if (key.trim()) { await secretStore.store(SECRET_KEY, key.trim()); }
    else { await secretStore.delete(SECRET_KEY); }
    // Move any key out of plain-text settings, where it used to be kept
    const cfg = vscode.workspace.getConfiguration('chevron-lists');
    if (cfg.get<string>('anthropicApiKey')) {
        await cfg.update('anthropicApiKey', undefined, vscode.ConfigurationTarget.Global);
        if (vscode.workspace.workspaceFolders?.length) {
            await cfg.update('anthropicApiKey', undefined, vscode.ConfigurationTarget.Workspace);
        }
    }
    vscode.window.showInformationMessage(key.trim() ? 'CL: API key saved' : 'CL: API key removed');
}

/** Makes a request to the Anthropic messages API */
export async function callClaude(system: string, user: string): Promise<string> {
    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error('No API key - run CL: Set Anthropic API Key');
    }

    const response = await fetch(API_URL, {
        method:  'POST',
        headers: {
            'content-type':      'application/json',
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta':    'server-side-fallback-2026-07-01',
        },
        body: JSON.stringify({
            model:      MODEL,
            // The model always thinks before answering, so leave room for that
            // as well as the short reply. 512 could be spent on thinking alone.
            max_tokens: 16000,
            // Short list edits need little thinking: low effort keeps them quick
            output_config: { effort: 'low' },
            // If the model declines, the server retries on its default fallback
            fallbacks: 'default',
            system,
            messages: [{ role: 'user', content: user }],
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = await response.json() as { content: { type: string; text?: string }[]; stop_reason?: string };
    if (data.stop_reason === 'refusal') { throw new Error('Claude declined this request'); }
    return data.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('');
}

// A bullet, star, number or chevron marker Claude sometimes adds despite the prompt
const REPLY_MARKER = /^(>+\s*)?([-*•]|\d+[.)])\s+/;

/** Pure: Claude's reply as items, one per non-blank line, with any list marker removed */
export function replyItems(reply: string): string[] {
    return reply.split('\n').map(l => l.trim().replace(REPLY_MARKER, '').trim()).filter(Boolean);
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
                const suggestions = replyItems(reply);

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
                const subItems = replyItems(reply);
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
