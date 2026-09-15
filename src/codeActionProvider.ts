import * as vscode from 'vscode';
import { parseNumbered, parseBullet, replaceDate, stripDate, markDone, shiftDate, todayDate } from './patterns';
import { prevNumberAtDepth } from './documentUtils';
import { getConfig } from './config';
import { makeEdit, makeAction } from './codeActionHelpers';
import { parseExpiry } from './expiryParser';
import { lineAfter, wholeLineRange } from './lineEdits';

const QF = vscode.CodeActionKind.QuickFix;

function badNumberingActions(doc: vscode.TextDocument, diags: vscode.Diagnostic[]): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    for (const diag of diags) {
        const line     = diag.range.start.line;
        const numbered = parseNumbered(doc.lineAt(line).text);
        if (!numbered) { continue; }
        const expected = prevNumberAtDepth(doc, line, numbered.chevrons) + 1;
        actions.push(makeAction(`CL: Fix: change ${numbered.num} to ${expected}`, QF, diag, {
            preferred: true,
            edit: makeEdit(doc.uri, doc.lineAt(line).range,
                `${numbered.chevrons} ${expected}. ${numbered.content}`),
        }));
        actions.push(makeAction('CL: Set custom start number here…', QF, diag, {
            command: { command: 'chevron-lists.setListStartNumber', title: 'CL: Set List Start Number' },
        }));
    }
    if (diags.length > 0) {
        const a = new vscode.CodeAction('CL: Fix all numbering in file', QF);
        a.diagnostics = diags;
        a.command = { command: 'chevron-lists.fixNumbering', title: 'CL: Fix Numbering' };
        actions.push(a);
    }
    return actions;
}

function duplicateHeaderActions(doc: vscode.TextDocument, diags: vscode.Diagnostic[]): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    for (const diag of diags) {
        const line = diag.range.start.line;
        const name = doc.lineAt(line).text.replace(/^> /, '').trim();
        let suffix = 2;
        for (let i = 0; i < doc.lineCount; i++) {
            if (doc.lineAt(i).text === `> ${name} ${suffix}`) { suffix++; }
        }
        actions.push(makeAction(`CL: Rename section "${name}"…`, QF, diag, {
            preferred: true, command: { command: 'chevron-lists.renameSection', title: 'CL: Rename Section' },
        }));
        actions.push(makeAction(`CL: Make unique: rename to "${name} ${suffix}"`, QF, diag, {
            edit: makeEdit(doc.uri, doc.lineAt(line).range, `> ${name} ${suffix}`),
        }));
    }
    return actions;
}

function emptySectionActions(doc: vscode.TextDocument, diags: vscode.Diagnostic[]): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const { prefix } = getConfig();
    for (const diag of diags) {
        const line      = diag.range.start.line;
        const ins       = lineAfter(doc, line, `>> ${prefix} Item`);
        const addItem   = new vscode.WorkspaceEdit();
        addItem.insert(doc.uri, ins.position, ins.text);
        const delEdit = new vscode.WorkspaceEdit();
        delEdit.delete(doc.uri, wholeLineRange(doc, line));
        actions.push(makeAction('CL: Add placeholder item', QF, diag, { preferred: true, edit: addItem }));
        actions.push(makeAction('CL: Delete this empty section', QF, diag, { edit: delEdit }));
        actions.push(makeAction('CL: Quick capture to this section…', QF, diag, {
            command: { command: 'chevron-lists.quickCapture', title: 'CL: Quick Capture' },
        }));
    }
    return actions;
}

function overdueActions(doc: vscode.TextDocument, diags: vscode.Diagnostic[]): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const { prefix } = getConfig();
    const today      = todayDate();
    for (const diag of diags) {
        const line     = diag.range.start.line;
        const text     = doc.lineAt(line).text;
        const bullet   = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        if (!bullet && !numbered) { continue; }
        const chevrons = bullet?.chevrons ?? numbered!.chevrons;
        const content  = bullet?.content  ?? numbered!.content;
        const num      = numbered?.num ?? null;
        const rebuild  = (c: string) => num !== null ? `${chevrons} ${num}. ${c}` : `${chevrons} ${prefix} ${c}`;
        actions.push(makeAction(`CL: Reschedule to today (${today})`, QF, diag, {
            preferred: true, edit: makeEdit(doc.uri, doc.lineAt(line).range, rebuild(replaceDate(content, today))),
        }));
        actions.push(makeAction('CL: Remove due date', QF, diag, {
            edit: makeEdit(doc.uri, doc.lineAt(line).range, rebuild(stripDate(content))),
        }));
        actions.push(makeAction('CL: Mark item done', QF, diag, {
            edit: makeEdit(doc.uri, doc.lineAt(line).range, rebuild(markDone(content))),
        }));
    }
    return actions;
}

function wordGoalActions(doc: vscode.TextDocument, diags: vscode.Diagnostic[]): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    for (const diag of diags) {
        const line     = diag.range.start.line;
        const stripped = doc.lineAt(line).text.replace(/\s*==\d+/, '').trimEnd();
        actions.push(makeAction('CL: Update word count goal…', QF, diag, {
            preferred: true, command: { command: 'chevron-lists.setWordCountGoal', title: 'CL: Set Word Count Goal' },
        }));
        actions.push(makeAction('CL: Remove word count goal', QF, diag, {
            edit: makeEdit(doc.uri, doc.lineAt(line).range, stripped),
        }));
        actions.push(makeAction('CL: Show word count breakdown', QF, diag, {
            command: { command: 'chevron-lists.showWordCount', title: 'CL: Show Word Count' },
        }));
    }
    return actions;
}

function expiryActions(doc: vscode.TextDocument, diags: vscode.Diagnostic[]): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const { prefix } = getConfig();
    for (const diag of diags) {
        const line     = diag.range.start.line;
        const text     = doc.lineAt(line).text;
        const bullet   = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        if (!bullet && !numbered) { continue; }
        const chevrons = bullet?.chevrons ?? numbered!.chevrons;
        const content  = bullet?.content  ?? numbered!.content;
        const num      = numbered?.num ?? null;
        const rebuild  = (c: string) => num !== null ? `${chevrons} ${num}. ${c}` : `${chevrons} ${prefix} ${c}`;
        const dateStr  = parseExpiry(content);
        if (!dateStr) { continue; }
        const extend7  = shiftDate(dateStr, 7);
        const extend30 = shiftDate(dateStr, 30);
        const newContent = (d: string) => content.replace(/@expires:\d{4}-\d{2}-\d{2}/, `@expires:${d}`);
        const stripped   = content.replace(/\s*@expires:\d{4}-\d{2}-\d{2}/, '').trim();
        actions.push(makeAction(`CL: Extend expiry by 7 days (→ ${extend7})`, QF, diag, {
            preferred: true, edit: makeEdit(doc.uri, doc.lineAt(line).range, rebuild(newContent(extend7))),
        }));
        actions.push(makeAction(`CL: Extend expiry by 30 days (→ ${extend30})`, QF, diag, {
            edit: makeEdit(doc.uri, doc.lineAt(line).range, rebuild(newContent(extend30))),
        }));
        actions.push(makeAction('CL: Remove expiry date', QF, diag, {
            edit: makeEdit(doc.uri, doc.lineAt(line).range, rebuild(stripped)),
        }));
    }
    return actions;
}

/** Provides quick-fix code actions for all Chevron Lists diagnostics */
export class ChevronCodeActionProvider implements vscode.CodeActionProvider {
    static readonly providedCodeActionKinds = [QF];

    provideCodeActions(doc: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] {
        const by = (code: string) => context.diagnostics.filter(d => d.code === code && d.source === 'Chevron Lists');
        return [
            ...badNumberingActions(doc,    by('bad-numbering')),
            ...duplicateHeaderActions(doc, by('duplicate-header')),
            ...emptySectionActions(doc,    by('empty-section')),
            ...overdueActions(doc,         by('overdue')),
            ...wordGoalActions(doc,        by('word-goal')),
            ...expiryActions(doc,          by('expired')),
        ];
    }
}
