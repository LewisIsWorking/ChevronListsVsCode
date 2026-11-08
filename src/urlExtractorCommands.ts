import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered } from './patterns';
import { getSectionRange, findHeaderAbove } from './documentUtils';

const URL_RE = /https?:\/\/[^\s)"'>]+/g;
/** Punctuation that ends the sentence around a link rather than the link */
const TRAILING_PUNCTUATION = /[.,;:!?\]]+$/;

interface UrlPickItem extends vscode.QuickPickItem { url: string; }

/** Command: collects all URLs from item content in the current section */
export async function onExtractUrlsFromSection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const doc         = editor.document;
    const headerLine  = findHeaderAbove(doc, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const name        = doc.lineAt(headerLine).text.replace(/^> /, '').trim();
    const [, end]     = getSectionRange(doc, headerLine);
    const seen        = new Set<string>();
    const urls: UrlPickItem[] = [];

    for (let i = headerLine + 1; i <= end; i++) {
        const text    = doc.lineAt(i).text;
        const content = parseBullet(text, prefix)?.content ?? parseNumbered(text)?.content ?? null;
        if (!content) { continue; }
        for (const m of content.matchAll(URL_RE)) {
            const url = m[0].replace(TRAILING_PUNCTUATION, '');
            if (!seen.has(url)) {
                seen.add(url);
                urls.push({ label: url, url });
            }
        }
    }

    if (urls.length === 0) {
        vscode.window.showInformationMessage(`CL: "${name}" - no URLs found`);
        return;
    }

    const pick = await vscode.window.showQuickPick(urls, {
        placeHolder: `${urls.length} URL${urls.length === 1 ? '' : 's'} in "${name}" - select to open`,
    });
    if (!pick) { return; }
    await vscode.env.openExternal(vscode.Uri.parse(pick.url));
}
