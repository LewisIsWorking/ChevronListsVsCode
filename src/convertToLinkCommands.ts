import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, isHeader } from './patterns';
import { stripTags } from './tagParser';

/** Command: replaces the cursor item with a [[SectionName]] link if a matching section exists */
export async function onConvertItemToSectionLink(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const lineIndex   = editor.selection.active.line;
    const text        = doc.lineAt(lineIndex).text;
    const bullet      = parseBullet(text, prefix);
    const numbered    = parseNumbered(text);
    if (!bullet && !numbered) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item');
        return;
    }
    const chevrons    = bullet?.chevrons ?? numbered!.chevrons;
    const content     = bullet?.content  ?? numbered!.content;
    const num         = numbered?.num ?? null;
    // Strip markers to get plain name for matching
    const plainName   = stripTags(content).replace(/\[.\]\s*|[!]+\s*|@\S+|~\S+|\+\d+|\/\/.*$/g, '').trim();

    // Find a section with matching name (case-insensitive)
    let matchedName: string | null = null;
    for (let i = 0; i < doc.lineCount; i++) {
        if (i === lineIndex) { continue; }
        const t = doc.lineAt(i).text;
        if (isHeader(t)) {
            const sectionName = t.replace(/^> /, '').trim();
            if (sectionName.toLowerCase() === plainName.toLowerCase()) {
                matchedName = sectionName;
                break;
            }
        }
    }

    if (!matchedName) {
        vscode.window.showInformationMessage(`CL: No section named "${plainName}" found in this file`);
        return;
    }

    const newContent = `[[${matchedName}]]`;
    const newLine    = num !== null
        ? `${chevrons} ${num}. ${newContent}`
        : `${chevrons} ${prefix} ${newContent}`;
    await editor.edit(eb => eb.replace(doc.lineAt(lineIndex).range, newLine));
    vscode.window.showInformationMessage(`CL: Converted to [[${matchedName}]]`);
}
