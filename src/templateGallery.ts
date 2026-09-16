import * as vscode from 'vscode';
import { getTemplates } from './templateCommands';

interface TemplateEntry { name: string; body: string; }

function buildGalleryHtml(templates: TemplateEntry[], webview: vscode.Webview): string {
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const cards = templates.map((t, i) => `
        <div class="card" onclick="insert(${i})">
            <div class="name">${esc(t.name)}</div>
            <pre class="preview">${esc(t.body.slice(0, 300))}${t.body.length > 300 ? '\n…' : ''}</pre>
            <button>Insert</button>
        </div>`).join('');

    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
<title>CL: Template Gallery</title>
<style>
  body   { font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:1rem; }
  h1     { font-size:1.1rem;color:var(--vscode-textLink-foreground);margin-bottom:1rem; }
  .grid  { display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0.75rem; }
  .card  { background:var(--vscode-editor-inactiveSelectionBackground);border-radius:6px;padding:0.75rem;cursor:pointer;border:1px solid transparent; }
  .card:hover { border-color:var(--vscode-focusBorder); }
  .name  { font-weight:bold;margin-bottom:0.4rem;font-size:0.9rem; }
  pre    { font-size:0.75rem;opacity:0.75;white-space:pre-wrap;max-height:120px;overflow:hidden;margin:0 0 0.5rem; }
  button { font-size:0.75rem;padding:0.2rem 0.6rem;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:3px;cursor:pointer; }
</style>
</head><body>
<h1>📋 Template Gallery</h1>
<div class="grid">${cards}</div>
<script>
  const vscode = acquireVsCodeApi();
  function insert(i) { vscode.postMessage({ command: 'insert', index: i }); }
</script>
</body></html>`;
}

let galleryPanel: vscode.WebviewPanel | undefined;
/** The templates the gallery is showing now; card indexes refer to this list */
let galleryEntries: TemplateEntry[] = [];
/** The text editor to insert into: clicking a card focuses the gallery, not the editor */
let galleryTarget: vscode.TextEditor | undefined;

/** Command: opens the template gallery webview */
export function onBrowseTemplates(): void {
    galleryEntries = getTemplates();
    galleryTarget  = vscode.window.activeTextEditor ?? galleryTarget;

    if (galleryPanel) { galleryPanel.reveal(); }
    else {
        galleryPanel = vscode.window.createWebviewPanel(
            'chevron-lists.templateGallery', 'CL: Template Gallery',
            vscode.ViewColumn.Beside, { enableScripts: true }
        );
        // Follow the user to another text editor while the gallery stays open.
        const follow = vscode.window.onDidChangeActiveTextEditor(e => { if (e) { galleryTarget = e; } });
        galleryPanel.onDidDispose(() => { follow.dispose(); galleryPanel = undefined; });
        galleryPanel.webview.onDidReceiveMessage(async msg => {
            if (msg.command !== 'insert') { return; }
            // The current list, not the one from when the panel was first opened:
            // reopening after templates changed used to insert the wrong template.
            const entry  = galleryEntries[msg.index];
            // A click focuses the webview, which leaves no active text editor, so
            // insert into the editor the user came from.
            const editor = vscode.window.activeTextEditor ?? galleryTarget;
            if (!entry) { return; }
            if (!editor || !vscode.window.visibleTextEditors.includes(editor)) {
                vscode.window.showInformationMessage('CL: Open a file to insert the template into');
                return;
            }
            await editor.insertSnippet(new vscode.SnippetString(entry.body));
        });
    }
    galleryPanel.webview.html = buildGalleryHtml(galleryEntries, galleryPanel.webview);
}
