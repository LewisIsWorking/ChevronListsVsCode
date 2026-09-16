import { isHeader, parseBullet, parseNumbered } from './patterns';
import { parseCheck } from './checkParser';
import type { LineReader } from './types';
import { TAG_RE } from './tagParser';

/** Escapes HTML special characters, quotes included so the result is also safe inside an attribute */
export function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Renders item content — converts #tags to badges and [[links]] to anchors */
export function renderContent(content: string): string {
    // Split on [[links]] and #tags, escape everything else. A "#" or "[" that
    // starts neither is plain text, so a URL fragment is not turned into a badge.
    return content
        .replace(new RegExp(`\\[\\[([^\\]]+)\\]\\]|${TAG_RE.source}|([^[#]+|[[#])`, 'g'), (_match, link, tag, plain) => {
            if (link !== undefined) {
                return `<a class="cl-link" href="#section-${slugify(link)}">${escHtml(link)}</a>`;
            }
            if (tag !== undefined) {
                return `<span class="cl-tag">#${escHtml(tag)}</span>`;
            }
            return escHtml(plain);
        });
}

/** Converts a section name to a URL-safe slug */
export function slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Builds a complete HTML document from the document lines */
export function buildHtml(doc: LineReader, prefix: string, fileName: string): string {
    const sections: string[] = [];
    let   sectionLines: string[] = [];
    let   currentHeader = '';

    const flushSection = () => {
        if (!currentHeader) { return; }
        const id    = slugify(currentHeader);
        const items = sectionLines.join('\n');
        sections.push(`
<details id="section-${escHtml(id)}" open>
  <summary class="cl-header">${escHtml(currentHeader)}</summary>
  <ul class="cl-list">${items}</ul>
</details>`);
        sectionLines = [];
    };

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (isHeader(text)) {
            flushSection();
            currentHeader = text.replace(/^> /, '');
            continue;
        }
        const bullet  = parseBullet(text, prefix);
        const numbered = parseNumbered(text);
        const content  = bullet?.content ?? numbered?.content ?? null;
        if (!content) { continue; }

        const check    = parseCheck(content);
        const rawText  = check ? check.contentWithout : content;
        const rendered = renderContent(rawText);
        const depth    = (bullet?.chevrons ?? numbered?.chevrons ?? '>>').length - 2;
        const indent   = depth > 0 ? ` style="margin-left:${depth * 1.25}rem"` : '';
        const doneClass = check?.state === 'done' ? ' cl-done' : '';
        const checkBox = check ? `<span class="cl-check">${check.state === 'done' ? '✅' : '☐'}</span> ` : '';
        const num      = numbered ? `<span class="cl-num">${numbered.num}.</span> ` : '';

        sectionLines.push(`<li class="cl-item${doneClass}"${indent}>${checkBox}${num}${rendered}</li>`);
    }
    flushSection();

    return HTML_TEMPLATE
        .replace('{{TITLE}}', escHtml(fileName))
        .replace('{{BODY}}', sections.join('\n'));
}

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{TITLE}}</title>
<style>
  :root { --accent: #E5C07B; --muted: #5C6370; --bg: #1e2127; --surface: #282c34; --text: #abb2bf; --done: #5C6370; }
  body  { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); max-width: 860px; margin: 2rem auto; padding: 0 1.5rem; }
  h1    { color: var(--accent); border-bottom: 1px solid var(--muted); padding-bottom: .5rem; }
  details { background: var(--surface); border-radius: 6px; margin: .75rem 0; overflow: hidden; }
  summary.cl-header { cursor: pointer; padding: .65rem 1rem; font-weight: bold; color: var(--accent); list-style: none; }
  summary.cl-header::before { content: "▶ "; font-size: .75em; opacity: .6; }
  details[open] summary.cl-header::before { content: "▼ "; }
  ul.cl-list  { margin: 0; padding: .5rem 1rem 1rem 1.5rem; list-style: none; }
  li.cl-item  { padding: .2rem 0; font-size: .93rem; }
  li.cl-done  { color: var(--done); text-decoration: line-through; }
  .cl-check   { font-size: .9em; }
  .cl-num     { color: #61AFEF; font-size: .85em; margin-right: .25rem; }
  .cl-tag     { background: #3e4451; color: #98C379; border-radius: 3px; padding: 1px 5px; font-size: .8em; margin: 0 1px; }
  .cl-link    { color: #61AFEF; text-decoration: none; border-bottom: 1px dotted #61AFEF; }
  .cl-link:hover { border-bottom-style: solid; }
</style>
</head>
<body>
<h1>{{TITLE}}</h1>
{{BODY}}
</body>
</html>`;
