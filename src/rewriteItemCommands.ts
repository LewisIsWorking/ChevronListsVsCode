import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { stripAllMetadata } from './metadataStripper';

/** Command: rewrites the item at the cursor using Claude, preserving all markers */
export async function onRewriteItem(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const cfg = vscode.workspace.getConfiguration('chevron-lists');
    const apiKey = cfg.get<string>('anthropicApiKey', '');
    if (!apiKey) {
        vscode.window.showWarningMessage('CL: Set chevron-lists.anthropicApiKey to use AI commands');
        return;
    }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const lineIndex  = editor.selection.active.line;
    const text       = doc.lineAt(lineIndex).text;
    const bullet     = parseBullet(text, prefix);
    const numbered   = parseNumbered(text);

    if (!bullet && !numbered) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item to rewrite it');
        return;
    }

    const chevrons = bullet?.chevrons ?? numbered!.chevrons;
    const content  = bullet?.content  ?? numbered!.content;
    const num      = numbered?.num ?? null;
    const plain    = stripAllMetadata(content);

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'CL: Rewriting item…', cancellable: false },
        async () => {
            try {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                        model: 'claude-haiku-4-5-20251001',
                        max_tokens: 200,
                        messages: [{
                            role: 'user',
                            content: `Rewrite this list item to be clearer and more concise. Return ONLY the rewritten text, no explanation, no quotes.\n\nItem: ${plain}`,
                        }],
                    }),
                });
                const data     = await response.json() as { content?: Array<{ text: string }> };
                const rewritten = data.content?.[0]?.text?.trim();
                if (!rewritten) { vscode.window.showWarningMessage('CL: AI returned no content'); return; }

                // Rebuild line: replace the plain text portion, keep all markers
                const newContent = content.replace(plain, rewritten);
                const newLine    = num !== null
                    ? `${chevrons} ${num}. ${newContent}`
                    : `${chevrons} ${prefix} ${newContent}`;
                await editor.edit(eb => eb.replace(doc.lineAt(lineIndex).range, newLine));
            } catch (e) {
                vscode.window.showErrorMessage(`CL: AI request failed - ${e}`);
            }
        }
    );
}
