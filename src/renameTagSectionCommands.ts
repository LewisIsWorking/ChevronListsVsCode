import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';
import { extractTags, hasTag, renameTagInText } from './tagParser';

/** Command: renames a #tag within the current section only */
export async function onRenameTagSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const [, end]     = getSectionRange(doc, headerLine);

    const itemContent = (i: number): string | null => {
        const text = doc.lineAt(i).text;
        return parseBullet(text, prefix)?.content ?? parseNumbered(text)?.content ?? null;
    };

    // Collect tags in section
    const tagsInSection = new Set<string>();
    for (let i = headerLine + 1; i <= end; i++) {
        for (const tag of extractTags(itemContent(i) ?? '')) { tagsInSection.add(tag); }
    }

    if (tagsInSection.size === 0) {
        vscode.window.showInformationMessage('CL: No tags found in this section');
        return;
    }

    const oldTag = await vscode.window.showQuickPick(
        [...tagsInSection].sort().map(t => `#${t}`),
        { placeHolder: 'Select tag to rename…' }
    );
    if (!oldTag) { return; }

    const newName = await vscode.window.showInputBox({
        prompt:       `Rename ${oldTag} to`,
        placeHolder:  'new-tag-name (no # needed)',
        validateInput: v => /^#?\w[\w-]*$/.test(v.trim())
            ? null
            : 'Tag names can only contain letters, numbers, underscores and hyphens',
    });
    if (!newName?.trim()) { return; }
    const newTag = newName.trim().replace(/^#/, '');

    // Only item lines, and only the tag itself. The old regex ended in \b, so
    // renaming #to also rewrote #to-do; and as a global regex tested line after
    // line it carried lastIndex over, silently skipping matching items.
    let changed = 0;
    await editor.edit(eb => {
        for (let i = headerLine + 1; i <= end; i++) {
            const content = itemContent(i);
            if (content === null || !hasTag(content, oldTag)) { continue; }
            const text = doc.lineAt(i).text;
            eb.replace(doc.lineAt(i).range, text.slice(0, text.length - content.length) + renameTagInText(content, oldTag, newTag));
            changed++;
        }
    });
    vscode.window.showInformationMessage(
        `CL: Renamed ${oldTag} → #${newTag} in ${changed} item${changed === 1 ? '' : 's'}`
    );
}
