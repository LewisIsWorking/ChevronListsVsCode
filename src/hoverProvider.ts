import * as vscode from 'vscode';
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { getConfig } from './config';
import { getSectionRange } from './documentUtils';
import { parseCheck } from './checkParser';
import { itemWordCount } from './metadataStripper';

const SECTION_LINK_RE = /\[\[([^\]#:]+?)(?:#([^\]]+))?\]\]/g;
const MAX_PREVIEW_ITEMS = 5;

/** Builds a markdown preview of up to N items from a section */
function buildSectionPreview(
    doc: vscode.TextDocument, headerLine: number, prefix: string
): string {
    const [, end] = getSectionRange(doc, headerLine);
    const items: string[] = [];
    for (let i = headerLine + 1; i <= end && items.length < MAX_PREVIEW_ITEMS; i++) {
        const t       = doc.lineAt(i).text;
        const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
        if (!content) { continue; }
        const check = parseCheck(content);
        const tick  = check?.state === 'done' ? '✓' : check ? '☐' : '·';
        items.push(`${tick} ${content.slice(0, 60)}${content.length > 60 ? '…' : ''}`);
    }
    const total = end - headerLine;
    const more  = total > MAX_PREVIEW_ITEMS ? `\n_...and ${total - MAX_PREVIEW_ITEMS} more_` : '';
    return items.join('\n\n') + more;
}

/** Provides hover tooltips on chevron headers and [[links]] */
export class ChevronHoverProvider implements vscode.HoverProvider {
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.Hover | undefined {
        const { prefix } = getConfig();
        const lineText   = document.lineAt(position.line).text;

        // ── [[SectionName]] link hover ───────────────────────────────────────
        for (const match of lineText.matchAll(SECTION_LINK_RE)) {
            const start = match.index!;
            const end   = start + match[0].length;
            if (position.character < start || position.character > end) { continue; }
            const targetName = match[1].trim().toLowerCase();
            for (let i = 0; i < document.lineCount; i++) {
                const t = document.lineAt(i).text;
                if (isHeader(t) && t.replace(/^> /, '').trim().toLowerCase() === targetName) {
                    const preview = buildSectionPreview(document, i, prefix);
                    const md = new vscode.MarkdownString(
                        `**[[${match[1]}]]**\n\n${preview || '_Empty section_'}`
                    );
                    return new vscode.Hover(md, new vscode.Range(position.line, start, position.line, end));
                }
            }
            const md = new vscode.MarkdownString(`**[[${match[1]}]]** — ⚠ Section not found`);
            return new vscode.Hover(md);
        }

        // ── Section header hover ─────────────────────────────────────────────
        if (!isHeader(lineText)) { return; }
        const [start, end]  = getSectionRange(document, position.line);
        let itemCount = 0, wordCount = 0, doneCount = 0, totalChecks = 0;
        for (let i = start + 1; i <= end; i++) {
            const t       = document.lineAt(i).text;
            const content = parseBullet(t, prefix)?.content ?? parseNumbered(t)?.content ?? null;
            if (!content) { continue; }
            itemCount++;
            wordCount += itemWordCount(content);
            const check = parseCheck(content);
            if (check) { totalChecks++; if (check.state === 'done') { doneCount++; } }
        }
        const checkLine = totalChecks > 0 ? `\n- Progress: ${doneCount}/${totalChecks} done` : '';
        const md = new vscode.MarkdownString(
            `**Chevron Section**\n\n- Items: ${itemCount}\n- Words: ${wordCount}${checkLine}`
        );
        return new vscode.Hover(md);
    }
}
