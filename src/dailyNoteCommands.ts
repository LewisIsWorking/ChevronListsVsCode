import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { formatDate } from './patterns';

/** Fills template placeholders with today's date values */
export function fillDateTemplate(template: string, today: Date): string {
    const dateStr   = formatDate(today);
    const dayNames  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const weekday   = dayNames[today.getDay()];
    const day       = today.getDate().toString();
    return template
        .replace(/\{\{date\}\}/g,    dateStr)
        .replace(/\{\{weekday\}\}/g, weekday)
        .replace(/\{\{day\}\}/g,     day);
}

/**
 * The folder daily notes live in: the setting when absolute, else the setting
 * under the first workspace folder; that folder itself when the setting is blank.
 * Shared by Open and Send so both put today's note in the same place.
 */
export function dailyNotesBase(dailyNotesFolder: string): string | undefined {
    const roots = vscode.workspace.workspaceFolders;
    return dailyNotesFolder
        ? (path.isAbsolute(dailyNotesFolder)
            ? dailyNotesFolder
            : roots ? path.join(roots[0].uri.fsPath, dailyNotesFolder) : dailyNotesFolder)
        : (roots ? roots[0].uri.fsPath : undefined);
}

/** Command: opens or creates a daily note for today */
export async function onOpenDailyNote(): Promise<void> {
    const { dailyNotesFolder, dailyNoteTemplate, prefix } = getConfig();
    const today    = new Date();
    const todayStr = formatDate(today);
    const fileName = `${todayStr}.md`;

    const base = dailyNotesBase(dailyNotesFolder);

    if (!base) {
        vscode.window.showInformationMessage('CL: Open a workspace folder first, or set chevron-lists.dailyNotesFolder');
        return;
    }

    const filePath = path.join(base, fileName);
    const fileUri  = vscode.Uri.file(filePath);

    try {
        await vscode.workspace.fs.stat(fileUri);
    } catch {
        // Build content from template or default
        const rawTemplate = dailyNoteTemplate.trim()
            ? dailyNoteTemplate
            : `> {{date}}\n>> ${prefix} `;
        const content = fillDateTemplate(rawTemplate, today) + '\n';
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
    }

    const doc    = await vscode.workspace.openTextDocument(fileUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Place cursor on the first blank item line
    for (let i = 0; i < doc.lineCount; i++) {
        const lineText = doc.lineAt(i).text;
        if (lineText.match(/^>> [^ ]+ $/) || lineText.endsWith(`${prefix} `)) {
            const pos = new vscode.Position(i, lineText.length);
            editor.selection = new vscode.Selection(pos, pos);
            break;
        }
    }
}
