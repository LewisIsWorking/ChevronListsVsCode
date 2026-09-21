import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { parseBullet, parseNumbered, formatDate } from './patterns';
import { lineAfter } from './lineEdits';

/** Command: copies the cursor item to today's daily note under > Inbox */
export async function onSendToDailyNote(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix, dailyNotesFolder } = getConfig();
    if (!dailyNotesFolder) {
        vscode.window.showInformationMessage('CL: Set chevron-lists.dailyNotesFolder in settings first');
        return;
    }

    const lineIndex = editor.selection.active.line;
    const text      = editor.document.lineAt(lineIndex).text;
    const bullet    = parseBullet(text, prefix);
    const numbered  = parseNumbered(text);
    const content   = bullet?.content ?? numbered?.content ?? null;
    if (!content) { vscode.window.showInformationMessage('CL: Place cursor on a chevron item'); return; }

    const today    = formatDate(new Date());
    const fileName = `${today}.md`;
    const folders  = vscode.workspace.workspaceFolders;
    if (!folders?.length) { vscode.window.showInformationMessage('CL: No workspace folder open'); return; }

    const notePath  = path.join(folders[0].uri.fsPath, dailyNotesFolder, fileName);
    const noteUri   = vscode.Uri.file(notePath);
    const itemLine  = `>> ${prefix} ${content}`;
    const INBOX_HDR = '> Inbox';

    let noteDoc: vscode.TextDocument;
    try {
        noteDoc = await vscode.workspace.openTextDocument(noteUri);
    } catch {
        // Create the file with an Inbox section
        const we = new vscode.WorkspaceEdit();
        we.createFile(noteUri, { overwrite: false, ignoreIfExists: true });
        we.insert(noteUri, new vscode.Position(0, 0), `# ${today}\n\n${INBOX_HDR}\n${itemLine}\n`);
        await vscode.workspace.applyEdit(we);
        vscode.window.showInformationMessage(`CL: Created ${fileName} and added item to Inbox`);
        return;
    }

    // Find or append Inbox section
    const inbox_hdr_lower = INBOX_HDR.toLowerCase();
    let inboxLine = -1;
    for (let i = 0; i < noteDoc.lineCount; i++) {
        if (noteDoc.lineAt(i).text.trim().toLowerCase() === inbox_hdr_lower) { inboxLine = i; break; }
    }
    const ins = inboxLine >= 0
        ? lineAfter(noteDoc, inboxLine, itemLine)
        : { position: new vscode.Position(noteDoc.lineCount, 0), text: `\n${INBOX_HDR}\n${itemLine}\n` };

    const we = new vscode.WorkspaceEdit();
    we.insert(noteUri, ins.position, ins.text);
    await vscode.workspace.applyEdit(we);
    vscode.window.showInformationMessage(`CL: Sent to ${fileName} › Inbox`);
}
