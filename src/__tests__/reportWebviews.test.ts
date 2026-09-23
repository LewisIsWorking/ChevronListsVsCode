/**
 * Covers the report webviews (Tag Stats, Mentions Report, Item Age Report,
 * Section Growth), Export Statistics, the Template Gallery and Reading Time.
 *
 * Bugs fixed, with regression tests checked against the original code:
 *  - the four reports wrote file names, section names and item text into HTML
 *    unescaped, so "a < b" or "<b>" broke the table or rendered as markup;
 *  - the statistics CSV did not double quotes inside section names;
 *  - Export Statistics defaulted an untitled document's save path to a bare
 *    relative path;
 *  - the Template Gallery kept the template list from when it was first opened,
 *    so after templates changed a card inserted the wrong template;
 *  - clicking a gallery card focuses the webview, leaving no active text
 *    editor, so nothing was inserted;
 *  - Reading Time showed a section's "==500" word goal marker in its name.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate, activate } from './helpers/editorHarness';
import { onShowTagStats } from '../tagStatsCommands';
import { onShowMentionsReport } from '../mentionsReportCommands';
import { onShowItemAgeReport } from '../itemAgeReportCommands';
import { onShowSectionGrowth } from '../sectionGrowthCommands';
import { onExportStatsAsCsv, onExportStatsAsJson } from '../statsExportCommands';
import { onBrowseTemplates } from '../templateGallery';
import { onShowReadingTime } from '../readingTimeCommands';

type Panel = { title: string; webview: { html: string; send(msg: unknown): Promise<void> }; revealed: number; dispose(): void };
const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[] };
    queued: { saveDialog: unknown[] };
    window: Record<string, unknown>;
    workspace: Record<string, unknown> & { fs: Record<string, unknown> };
};
const real = {
    createWebviewPanel: mock.window.createWebviewPanel,
    onDidChangeActiveTextEditor: mock.window.onDidChangeActiveTextEditor,
    showSaveDialog: mock.window.showSaveDialog,
    writeFile: mock.workspace.fs.writeFile,
};

let panels: Panel[];
let activeListeners: ((e: unknown) => void)[];

beforeEach(() => {
    mock.__reset();
    deactivate();
    panels = []; activeListeners = [];
    mock.window.createWebviewPanel = (_type: string, title: string) => {
        let onDispose = () => {};
        let onMessage: (m: unknown) => Promise<void> = async () => {};
        const panel = {
            title, revealed: 0,
            webview: {
                html: '',
                onDidReceiveMessage: (f: (m: unknown) => Promise<void>) => { onMessage = f; return { dispose() {} }; },
                send: (m: unknown) => onMessage(m),
            },
            onDidDispose: (f: () => void) => { onDispose = f; },
            reveal: () => { panel.revealed++; },
            dispose: () => onDispose(),
        };
        panels.push(panel);
        return panel;
    };
    mock.window.onDidChangeActiveTextEditor = (f: (e: unknown) => void) => { activeListeners.push(f); return { dispose() {} }; };
});
afterEach(() => {
    panels.forEach(p => p.dispose());
    Object.assign(mock.window, {
        createWebviewPanel: real.createWebviewPanel,
        onDidChangeActiveTextEditor: real.onDidChangeActiveTextEditor,
        showSaveDialog: real.showSaveDialog,
    });
    mock.workspace.fs.writeFile = real.writeFile;
});

const HOSTILE = { fileName: 'C:/notes/a&b "<x>".md' };

describe('report webviews escape what they show', () => {
    it('tag stats', async () => {
        openEditor(['> S', '>> - [x] a #work', '>> - b #work'], HOSTILE);
        await onShowTagStats();
        const html = panels[0].webview.html;
        expect(html).toContain('Tag Stats - a&amp;b &quot;&lt;x&gt;&quot;.md');
        expect(html).toContain('<td>#work</td><td>2</td><td>1</td>');
        expect(html).toContain('50%');
    });

    it('mentions report', async () => {
        openEditor(['> S', '>> - ask @Sam'], HOSTILE);
        await onShowMentionsReport();
        const html = panels[0].webview.html;
        expect(html).toContain('Mentions Report - a&amp;b &quot;&lt;x&gt;&quot;.md');
        expect(html).toContain('<td>@Sam</td>');
    });

    it('item age report, cutting long text before escaping it', async () => {
        const long = `<b>${'x'.repeat(90)}`;
        openEditor(['> Plans & <Ideas>', `>> - ${long} @created:2020-01-01`, '>> - a < b @created:2020-01-02'], HOSTILE);
        await onShowItemAgeReport();
        const html = panels[0].webview.html;
        expect(html).toContain('Item Age Report - a&amp;b &quot;&lt;x&gt;&quot;.md (oldest 2 of 2)');
        expect(html).toContain('Plans &amp; &lt;Ideas&gt;');
        expect(html).toContain('a &lt; b');
        expect(html).toContain(`&lt;b&gt;${'x'.repeat(77)}…`);
        expect(html).not.toContain('<b>');
    });

    it('section growth, in the tooltip and the label', async () => {
        openEditor(['> Say "hi" & <wave> to everyone in the whole room', '>> - a', '> Short', '>> - b', '>> - c'], HOSTILE);
        await onShowSectionGrowth();
        const html = panels[0].webview.html;
        expect(html).toContain('Section Growth - a&amp;b &quot;&lt;x&gt;&quot;.md');
        expect(html).toContain('title="Say &quot;hi&quot; &amp; &lt;wave&gt; to everyone in the whole room"');
        expect(html).toContain('>Say &quot;hi&quot; &amp; &lt;wave&gt; to everyo…</div>');
        expect(html).toContain('>Short</div>');
    });
});

describe('report webviews: panels and empty states', () => {
    const cases: [string, () => Promise<void>, string][] = [
        ['tag stats', onShowTagStats, 'No tags found in this file'],
        ['mentions', onShowMentionsReport, 'No @Mentions found'],
        ['item age', onShowItemAgeReport, 'No items with @created: dates found'],
        ['section growth', onShowSectionGrowth, 'No sections found'],
    ];

    for (const [name, run, empty] of cases) {
        it(`${name}: ignores other editors, shows the empty state, reuses its panel`, async () => {
            await run();
            openEditor(['x'], { languageId: 'plaintext' });
            await run();
            expect(panels).toHaveLength(0);
            openEditor(['prose'], { fileName: 'plain' });
            await run();
            expect(panels[0].webview.html).toContain(empty);
            await run();
            expect(panels).toHaveLength(1);
            expect(panels[0].revealed).toBe(1);
        });
    }
});

describe('export statistics', () => {
    let written: string[];
    let dialogs: { defaultUri?: vscode.Uri }[];
    beforeEach(() => {
        written = []; dialogs = [];
        mock.window.showSaveDialog = (o: { defaultUri?: vscode.Uri }) => { dialogs.push(o); return Promise.resolve(mock.queued.saveDialog.shift()); };
        mock.workspace.fs.writeFile = (_u: unknown, b: Uint8Array) => { written.push(Buffer.from(b).toString('utf-8')); return Promise.resolve(); };
    });

    it('doubles quotes inside section names in the CSV', async () => {
        openEditor(['> Say "hi"', '>> - one two'], { fileName: 'C:/notes/list.md' });
        mock.queued.saveDialog.push(vscode.Uri.file('C:/notes/list-stats.csv'));
        await onExportStatsAsCsv();
        expect(written[0]).toBe('Section,Items,Words\n"Say ""hi""",1,2\n"TOTAL",1,2');
        expect(dialogs[0].defaultUri?.fsPath.replace(/\\/g, '/')).toBe('C:/notes/list-stats.csv');
        expect(mock.recorded.info.at(-1)).toBe('CL: Statistics exported to list-stats.csv');
    });

    it('writes JSON, and lets the dialog choose for an untitled document', async () => {
        const h = openEditor(['> S', '>> - a'], { fileName: 'Untitled-1' });
        (h.document as { isUntitled: boolean }).isUntitled = true;
        mock.queued.saveDialog.push(vscode.Uri.file('C:/x.json'));
        await onExportStatsAsJson();
        expect(dialogs[0].defaultUri).toBeUndefined();
        expect(JSON.parse(written[0]).totalItems).toBe(1);
    });

    it('writes nothing when cancelled or outside markdown', async () => {
        await onExportStatsAsCsv();
        await onExportStatsAsJson();
        openEditor(['> S'], { languageId: 'plaintext' });
        await onExportStatsAsCsv();
        await onExportStatsAsJson();
        openEditor(['> S']);
        await onExportStatsAsCsv();
        expect(written).toEqual([]);
    });
});

describe('template gallery', () => {
    const tpl = (name: string, body: string) => ({ name, description: '', body });

    it('inserts into the editor the user came from, even though the click focused the gallery', async () => {
        const h = openEditor(['']);
        mock.__setConfig('chevron-lists.templates', [tpl('Mine', 'MINE')]);
        onBrowseTemplates();
        const index = (panels[0].webview.html.match(/onclick="insert\((\d+)\)"/g) ?? []).length - 1;
        deactivate();
        (vscode.window as unknown as { visibleTextEditors: unknown[] }).visibleTextEditors = [h.editor];
        await panels[0].webview.send({ command: 'insert', index });
        expect(h.snippets).toEqual(['MINE']);
    });

    it('inserts from the current list after the templates change', async () => {
        const h = openEditor(['']);
        mock.__setConfig('chevron-lists.templates', [tpl('Old', 'OLD')]);
        onBrowseTemplates();
        const oldIndex = (panels[0].webview.html.match(/onclick="insert\((\d+)\)"/g) ?? []).length - 1;
        mock.__setConfig('chevron-lists.templates', [tpl('First', 'FIRST'), tpl('Old', 'OLD')]);
        onBrowseTemplates();
        expect(panels).toHaveLength(1);
        await panels[0].webview.send({ command: 'insert', index: oldIndex });
        expect(h.snippets).toEqual(['FIRST']);
        expect(panels[0].webview.html).toContain('First');
    });

    it('follows the user to another editor, and says so when there is none', async () => {
        const first = openEditor(['']);
        onBrowseTemplates();
        const second = makeEditor(['']);
        activeListeners.forEach(f => f(undefined));
        activeListeners.forEach(f => f(second.editor));
        deactivate();
        (vscode.window as unknown as { visibleTextEditors: unknown[] }).visibleTextEditors = [second.editor];
        await panels[0].webview.send({ command: 'insert', index: 0 });
        expect(second.snippets).toHaveLength(1);
        expect(first.snippets).toEqual([]);
        (vscode.window as unknown as { visibleTextEditors: unknown[] }).visibleTextEditors = [];
        await panels[0].webview.send({ command: 'insert', index: 0 });
        expect(mock.recorded.info.at(-1)).toBe('CL: Open a file to insert the template into');
    });

    it('ignores other messages and unknown cards, and shows an empty gallery', async () => {
        const h = openEditor(['']);
        onBrowseTemplates();
        await panels[0].webview.send({ command: 'other', index: 0 });
        await panels[0].webview.send({ command: 'insert', index: 999 });
        expect(h.snippets).toEqual([]);
        activate(h);
    });
});

describe('report and gallery details', () => {
    const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
    const stamp = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    it('item age report colours items by age and says "1 day"', async () => {
        openEditor(['> S',
            `>> - ancient @created:${stamp(daysAgo(100))}`,
            `>> - month @created:${stamp(daysAgo(40))}`,
            `>> - fresh @created:${stamp(daysAgo(1))}`]);
        await onShowItemAgeReport();
        const html = panels[0].webview.html;
        expect(html).toContain('color:#E06C75;font-weight:bold">100 days');
        expect(html).toContain('color:#E5C07B;font-weight:bold">40 days');
        expect(html).toContain('color:#98C379;font-weight:bold">1 day<');
    });

    it('template gallery previews a long template shortened with an ellipsis', () => {
        openEditor(['']);
        mock.__setConfig('chevron-lists.templates', [{ name: 'Long', description: '', body: 'y'.repeat(301) }]);
        onBrowseTemplates();
        expect(panels[0].webview.html).toContain(`${'y'.repeat(300)}\n…</pre>`);
    });
});
describe('reading time', () => {
    it('names the section without its word goal marker', async () => {
        openEditor(['> Draft ==500', '>> - one two three', '>> 1. four #tag'], { cursor: 1 });
        await onShowReadingTime();
        expect(mock.recorded.info.at(-1)).toMatch(/^CL: "Draft" - 4 words, ~/);
    });

    it('counts the whole file above the first header, and says "1 word"', async () => {
        openEditor(['>> - solo', '> Later'], { cursor: 0 });
        await onShowReadingTime();
        expect(mock.recorded.info.at(-1)).toMatch(/^CL: Whole file - 1 word, ~/);
        openEditor(['>> - two words', '> Later', '>> - one'], { cursor: 2 });
        await onShowReadingTime();
        expect(mock.recorded.info.at(-1)).toMatch(/^CL: "Later" - 1 word, ~/);
        openEditor(['>> - two words', '> Later'], { cursor: 0 });
        await onShowReadingTime();
        expect(mock.recorded.info.at(-1)).toMatch(/^CL: Whole file - 2 words, ~/);
    });

    it('does nothing outside markdown', async () => {
        await onShowReadingTime();
        openEditor(['> S'], { languageId: 'plaintext' });
        await onShowReadingTime();
        expect(mock.recorded.info).toEqual([]);
    });
});
