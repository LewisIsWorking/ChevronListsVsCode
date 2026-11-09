import * as vscode from 'vscode';
import { onBoldText, onItalicText, onUnderlineText, onMonoText, onStrikeText } from './richTextSimCommands';
import { toTitleCase } from './patterns';

interface TransformItem extends vscode.QuickPickItem { action: () => Promise<void>; }

/** Command: unified quick pick for all text transforms */
export async function onTextTransformPalette(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const items: TransformItem[] = [
        { label: '$(bold) Bold',         description: 'Wrap in **bold**',      action: onBoldText },
        { label: '$(italic) Italic',     description: 'Wrap in _italic_',      action: onItalicText },
        { label: '$(symbol-text) Underline', description: 'Unicode underline combining chars', action: onUnderlineText },
        { label: '$(code) Mono',         description: 'Wrap in `backticks`',   action: onMonoText },
        { label: '$(close) Strikethrough', description: 'Wrap in ~~strike~~',  action: onStrikeText },
        { label: '$(arrow-up) UPPERCASE', description: 'Convert to UPPERCASE', action: async () => applyCase('upper') },
        { label: '$(arrow-down) lowercase', description: 'Convert to lowercase', action: async () => applyCase('lower') },
        { label: '$(symbol-key) Title Case', description: 'Convert to Title Case', action: async () => applyCase('title') },
    ];

    const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Choose text transform…' });
    if (pick) { await pick.action(); }
}

/** The text in the given case */
export function casedText(mode: 'upper' | 'lower' | 'title', text: string): string {
    if (mode === 'upper') { return text.toUpperCase(); }
    if (mode === 'lower') { return text.toLowerCase(); }
    return toTitleCase(text);
}

async function applyCase(mode: 'upper' | 'lower' | 'title'): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const sel   = editor.selection;
    const range = sel.isEmpty ? editor.document.getWordRangeAtPosition(sel.active) ?? sel : new vscode.Range(sel.start, sel.end);
    const text  = editor.document.getText(range);
    if (!text.trim()) { return; }
    await editor.edit(eb => eb.replace(range, casedText(mode, text)));
}
