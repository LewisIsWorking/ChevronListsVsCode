import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader } from './patterns';
import { isPinned } from './pinState';
import { lineAfter, sectionContentEnd } from './lineEdits';

interface SectionPickItem extends vscode.QuickPickItem {
    uri:       vscode.Uri;
    lineIndex: number;
    pinned:    boolean;
}

/** Finds all sections in the active document, pinned ones first */
function getSectionPickItems(
    document: vscode.TextDocument,
    context:  vscode.ExtensionContext
): SectionPickItem[] {
    const items: SectionPickItem[] = [];
    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text;
        if (!isHeader(text)) { continue; }
        const name   = text.replace(/^> /, '');
        const pinned = isPinned(context, name);
        items.push({
            label:       `${pinned ? '$(pin) ' : ''}${name}`,
            description: pinned ? 'pinned' : undefined,
            uri:         document.uri,
            lineIndex:   i,
            pinned,
        });
    }
    return items.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
}

/**
 * Command: Quick Capture — prompts for text and appends it as a new item
 * to a selected section (pinned sections appear first).
 */
export async function onQuickCapture(context: vscode.ExtensionContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
        vscode.window.showInformationMessage('CL: Open a markdown file to use Quick Capture');
        return;
    }

    const { prefix } = getConfig();
    const sections   = getSectionPickItems(editor.document, context);

    if (sections.length === 0) {
        vscode.window.showInformationMessage('CL: No sections found in this file');
        return;
    }

    // Step 1: pick a target section
    const targetPick = await vscode.window.showQuickPick(sections, {
        placeHolder: 'Capture to which section?',
    });
    if (!targetPick) { return; }

    // Step 2: type the item text
    const text = await vscode.window.showInputBox({
        prompt:      `Add item to "${targetPick.label.replace('$(pin) ', '')}"`,
        placeHolder: 'Item text...',
    });
    if (!text?.trim()) { return; }

    // Step 3: insert at the end of the target section
    const ins = lineAfter(editor.document, sectionContentEnd(editor.document, targetPick.lineIndex), `>> ${prefix} ${text.trim()}`);
    await editor.edit(eb => eb.insert(ins.position, ins.text));
}
