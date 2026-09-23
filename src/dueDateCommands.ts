import * as vscode from 'vscode';
import { getConfig } from './config';
import { collectDueDates } from './dueDateParser';

interface DueDatePickItem extends vscode.QuickPickItem {
    lineIndex: number;
}

function revealLine(editor: vscode.TextEditor, lineIndex: number): void {
    const pos = new vscode.Position(lineIndex, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/** Command: shows all items with due dates, sorted chronologically */
export async function onShowUpcoming(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const items      = collectDueDates(editor.document, prefix);

    if (items.length === 0) {
        vscode.window.showInformationMessage('CL: No due dates found (use @YYYY-MM-DD in item content)');
        return;
    }

    const pickItems: DueDatePickItem[] = items.map(item => ({
        label:       `$(calendar) ${item.dateStr}${item.overdue ? ' ⚠️ OVERDUE' : ''} - ${item.content}`,
        description: item.section,
        detail:      item.overdue ? 'Overdue' : undefined,
        lineIndex:   item.line,
    }));

    const pick = vscode.window.createQuickPick<DueDatePickItem>();
    pick.items       = pickItems;
    pick.placeholder = 'Items with due dates - sorted chronologically';

    const originalPos = editor.selection.active;
    pick.onDidChangeActive(active => {
        if (active[0]) { revealLine(editor, active[0].lineIndex); }
    });
    pick.onDidAccept(() => {
        if (pick.activeItems[0]) { revealLine(editor, pick.activeItems[0].lineIndex); }
        pick.hide();
    });
    pick.onDidHide(() => {
        if (!pick.activeItems[0]) {
            const pos = new vscode.Position(originalPos.line, originalPos.character);
            editor.selection = new vscode.Selection(pos, pos);
        }
        pick.dispose();
    });
    pick.show();
}

/** Adds overdue diagnostics to the Problems panel */
export function updateDueDateDiagnostics(
    document: vscode.TextDocument,
    collection: vscode.DiagnosticCollection,
    prefix: string
): void {
    if (document.languageId !== 'markdown') { return; }
    const items = collectDueDates(document, prefix);
    const diagnostics = items
        .filter(item => item.overdue)
        .map(item => {
            const range = document.lineAt(item.line).range;
            const d     = new vscode.Diagnostic(
                range,
                `Overdue: "${item.content}" was due ${item.dateStr}`,
                vscode.DiagnosticSeverity.Warning
            );
            d.source = 'Chevron Lists';
            d.code   = 'overdue';
            return d;
        });
    collection.set(document.uri, diagnostics);
}
