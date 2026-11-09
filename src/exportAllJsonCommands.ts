import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { getSectionRange } from './documentUtils';
import { extractTags } from './tagParser';
import { parseCheck } from './checkParser';
import { parsePriority } from './priorityParser';
import { extractDate } from './dueDateParser';
import { parseEstimate } from './estimateParser';
import { parseVote } from './voteParser';
import { parseColourLabel } from './colourLabelParser';
import { parseFlag } from './flagParser';
import { parseComment } from './commentParser';
import { parseRating } from './ratingParser';
import { parseStar } from './starParser';

/** Command: exports every section in the file as a single JSON file */
export async function onExportAllSectionsAsJson(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const fileName   = path.basename(doc.fileName, '.md');

    const saveUri = await vscode.window.showSaveDialog({
        // An untitled document has no folder, so its default would be a bare relative path.
        defaultUri: doc.isUntitled ? undefined : vscode.Uri.file(path.join(path.dirname(doc.fileName), `${fileName}.json`)),
        filters: { 'JSON Files': ['json'] },
    });
    if (!saveUri) { return; }

    const sections: object[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
        if (!isHeader(doc.lineAt(i).text)) { continue; }
        const name    = doc.lineAt(i).text.replace(/^> /, '');
        const [, end] = getSectionRange(doc, i);
        const items: object[] = [];
        for (let j = i + 1; j <= end; j++) {
            const text    = doc.lineAt(j).text;
            const bullet  = parseBullet(text, prefix);
            const numbered = parseNumbered(text);
            if (!bullet && !numbered) { continue; }
            const content  = bullet?.content ?? numbered!.content;
            const depth    = (bullet?.chevrons ?? numbered!.chevrons).length - 2;
            const check    = parseCheck(content);
            const prio     = parsePriority(content);
            const date     = extractDate(content);
            const est      = parseEstimate(content);
            const vote     = parseVote(content);
            const colour   = parseColourLabel(content);
            const flag     = parseFlag(content);
            const comment  = parseComment(content);
            const rating   = parseRating(content);
            items.push({
                depth, type: numbered ? 'numbered' : 'bullet', num: numbered?.num ?? null,
                content, done: check?.state === 'done' || false,
                priority: prio?.level ?? null, dueDate: date?.dateStr ?? null,
                estimate: est?.display ?? null, votes: vote?.count ?? null,
                starred: parseStar(content) !== null, colour: colour ?? null, flagged: flag !== null,
                comment: comment?.comment ?? null, rating: rating ?? null,
                tags: extractTags(content),
            });
        }
        sections.push({ section: name, items });
    }

    const json = JSON.stringify({ file: fileName, sections }, null, 2);
    await vscode.workspace.fs.writeFile(saveUri, Buffer.from(json, 'utf-8'));
    vscode.window.showInformationMessage(`CL: Exported ${sections.length} section${sections.length === 1 ? '' : 's'} to JSON`);
}
