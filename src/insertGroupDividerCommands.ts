import * as vscode from 'vscode';

/** Command: inserts a >> -- Name group divider below the cursor line */
export async function onInsertGroupDivider(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const name = await vscode.window.showInputBox({
        prompt:      'Group divider name',
        placeHolder: 'e.g. Act One, Phase 2, Backlog…',
    });
    if (!name?.trim()) { return; }

    const doc        = editor.document;
    const cursorLine = editor.selection.active.line;
    const insertLine = cursorLine + 1;
    const divider    = `>> -- ${name.trim()}`;
    // The last line has no line after it to insert at; VS Code would clamp that
    // position to the end of the file and glue the divider onto the last line.
    const isLastLine = cursorLine === doc.lineCount - 1;
    await editor.edit(eb => {
        if (isLastLine) { eb.insert(doc.lineAt(cursorLine).range.end, `\n${divider}`); }
        else            { eb.insert(new vscode.Position(insertLine, 0), `${divider}\n`); }
    });

    // Place cursor after the inserted divider: the start of the following line,
    // or the end of the divider when it is now the last line
    const newPos = isLastLine
        ? new vscode.Position(insertLine, divider.length)
        : new vscode.Position(insertLine + 1, 0);
    editor.selection = new vscode.Selection(newPos, newPos);
    vscode.window.showInformationMessage(`CL: Inserted group "-- ${name.trim()}"`);
}
