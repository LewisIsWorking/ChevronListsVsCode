import * as vscode from 'vscode';
import { parseSectionColour, setSectionColour } from './patterns';
import { findHeaderAbove } from './documentUtils';

const VALID_COLOURS = ['red','green','blue','yellow','orange','purple'] as const;
type SectionColour = typeof VALID_COLOURS[number];

interface ColourPickItem extends vscode.QuickPickItem { colour: SectionColour | null; }

/** Command: sets a [colour:X] section colour tag on the header at cursor */
export async function onSetSectionColour(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const doc        = editor.document;
    const headerLine = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) {
        vscode.window.showInformationMessage('CL: No section header found at cursor'); return;
    }
    const current = parseSectionColour(doc.lineAt(headerLine).text);
    const picks: ColourPickItem[] = [
        ...VALID_COLOURS.map(c => ({ label: `{${c}}`, description: c === current ? '← current' : undefined, colour: c as SectionColour })),
        { label: '$(close) Remove colour', colour: null },
    ];
    const pick = await vscode.window.showQuickPick(picks, { placeHolder: 'Set section header colour…' });
    if (!pick) { return; }
    const newLine = setSectionColour(doc.lineAt(headerLine).text, pick.colour);
    await editor.edit(eb => eb.replace(doc.lineAt(headerLine).range, newLine));
}
