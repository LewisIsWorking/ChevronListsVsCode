import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange } from './documentUtils';
import { stripAllMetadata } from './metadataStripper';

/** Command: shows two sections side by side as a Markdown comparison table */
export async function onCompareTwoSectionsAsTable(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;

    // Build section list
    interface SectionItem extends vscode.QuickPickItem { headerLine: number; }
    const sections: SectionItem[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
        const t = doc.lineAt(i).text;
        if (t.startsWith('> ') && !t.startsWith('>> ')) {
            sections.push({ label: t.replace(/^> /, ''), headerLine: i });
        }
    }
    if (sections.length < 2) {
        vscode.window.showInformationMessage('CL: Need at least 2 sections to compare'); return;
    }

    const pickA = await vscode.window.showQuickPick(sections, { placeHolder: 'Select first section…' });
    if (!pickA) { return; }
    const pickB = await vscode.window.showQuickPick(
        sections.filter(s => s.headerLine !== pickA.headerLine),
        { placeHolder: 'Select second section…' }
    );
    if (!pickB) { return; }

    const getItems = (headerLine: number): string[] => {
        const [, end] = getSectionRange(doc, headerLine);
        const items: string[] = [];
        for (let i = headerLine + 1; i <= end; i++) {
            const t = doc.lineAt(i).text;
            const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
            if (content) { items.push(stripAllMetadata(content)); }
        }
        return items;
    };

    const aItems = getItems(pickA.headerLine);
    const bItems = getItems(pickB.headerLine);
    const maxLen = Math.max(aItems.length, bItems.length);
    const esc    = (s: string) => s.replace(/\|/g, '\\|');

    const rows = Array.from({ length: maxLen }, (_, i) =>
        `| ${esc(aItems[i] ?? '')} | ${esc(bItems[i] ?? '')} |`
    ).join('\n');

    const content = `# ${pickA.label} vs ${pickB.label}\n\n| ${pickA.label} | ${pickB.label} |\n|---|---|\n${rows}\n`;
    const mdDoc   = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
    await vscode.window.showTextDocument(mdDoc, vscode.ViewColumn.Beside);
}
