import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { stripAllMetadata } from './metadataStripper';
import { callClaude, getApiKey } from './aiCommands';

const SYSTEM_REWRITE = `You are a helpful writing assistant for a bullet list tool.
Rewrite the list item you are given to be clearer and more concise.
Return ONLY the rewritten text, no explanation, no quotes.`;

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
                // It used to read only the first content block and ignore HTTP errors,
                // so a failed request showed "AI returned no content"
                const rewritten = (await callClaude(SYSTEM_REWRITE, `Item: ${plain}`)).trim();
                if (!rewritten) { vscode.window.showWarningMessage('CL: AI returned no content'); return; }

                // Rebuild line: replace the plain text portion, keep all markers
                const newContent = content.replace(plain, rewritten);
                const newLine    = num !== null
                    ? `${chevrons} ${num}. ${newContent}`
                    : `${chevrons} ${prefix} ${newContent}`;
                await editor.edit(eb => eb.replace(doc.lineAt(lineIndex).range, newLine));
            } catch (e) {
                vscode.window.showErrorMessage(`CL: AI request failed - ${(e as Error).message}`);
            }
        }
    );
}
