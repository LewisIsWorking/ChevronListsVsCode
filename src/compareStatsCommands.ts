import * as vscode from 'vscode';
import { getConfig } from './config';
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { extractTags } from './tagParser';
import { parseCheck } from './checkParser';
import { getSectionRange } from './documentUtils';
import { itemWordCount } from './metadataStripper';

interface SectionStats {
    name:    string;
    line:    number;
    items:   number;
    words:   number;
    done:    number;
    total:   number;
    tags:    number;
}

function computeSectionStats(document: vscode.TextDocument, prefix: string, headerLine: number): SectionStats {
    const name   = document.lineAt(headerLine).text.replace(/^> /, '');
    const [, end] = getSectionRange(document, headerLine);
    let items = 0, words = 0, done = 0, total = 0, tags = 0;
    for (let i = headerLine + 1; i <= end; i++) {
        const text    = document.lineAt(i).text;
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }
        items++;
        words += itemWordCount(content);
        tags  += extractTags(content).length;
        const check = parseCheck(content);
        if (check) { total++; if (check.state === 'done') { done++; } }
    }
    return { name, line: headerLine, items, words, done, total, tags };
}

/** Command: side-by-side comparison of any two sections */
export async function onCompareStatistics(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }

    const { prefix } = getConfig();
    const doc        = editor.document;
    const headers: Array<{ label: string; line: number }> = [];
    for (let i = 0; i < doc.lineCount; i++) {
        if (isHeader(doc.lineAt(i).text)) {
            headers.push({ label: doc.lineAt(i).text.replace(/^> /, ''), line: i });
        }
    }
    if (headers.length < 2) {
        vscode.window.showInformationMessage('CL: Need at least 2 sections to compare');
        return;
    }

    const pickA = await vscode.window.showQuickPick(headers.map(h => ({ label: h.label, line: h.line })), { placeHolder: 'Select first section...' });
    if (!pickA) { return; }
    const pickB = await vscode.window.showQuickPick(headers.filter(h => h.line !== pickA.line).map(h => ({ label: h.label, line: h.line })), { placeHolder: 'Select second section...' });
    if (!pickB) { return; }

    const a = computeSectionStats(doc, prefix, pickA.line);
    const b = computeSectionStats(doc, prefix, pickB.line);

    const rows = [
        `| Metric | ${a.name} | ${b.name} |`,
        `|--------|${'-'.repeat(a.name.length + 2)}|${'-'.repeat(b.name.length + 2)}|`,
        `| Items  | ${a.items} | ${b.items} |`,
        `| Words  | ${a.words} | ${b.words} |`,
        `| Done   | ${a.done}/${a.total} | ${b.done}/${b.total} |`,
        `| Tags   | ${a.tags} | ${b.tags} |`,
    ];
    const mdDoc = await vscode.workspace.openTextDocument({ content: rows.join('\n'), language: 'markdown' });
    await vscode.window.showTextDocument(mdDoc, vscode.ViewColumn.Beside);
}
