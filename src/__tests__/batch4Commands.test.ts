/**
 * Covers presetCommands, richTextCommands, sectionColourCommands,
 * itemComplexityCommands, navigationHandler and structuredExportCommands.
 *
 * Bugs fixed, with regression tests checked against the original code:
 *  - switching colour preset wrote "[markdown]": { enabled: true } into
 *    editor.semanticTokenColorCustomizations, where "[...]" names a colour theme,
 *    so semantic highlighting was never turned on for markdown (and the stray key
 *    stayed in settings); it now sets editor.semanticHighlighting.enabled for
 *    markdown and removes the stray key;
 *  - Export as JSON / CSV gave an untitled document a bare relative save path.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { onSwitchColourPreset, applyConfiguredPreset } from '../presetCommands';
import { COLOUR_PRESETS } from '../colourPresets';
import { onCopyItemAsRichText } from '../richTextCommands';
import { onSetSectionColour } from '../sectionColourCommands';
import { onShowItemComplexity } from '../itemComplexityCommands';
import { onNextHeader, onPrevHeader } from '../navigationHandler';
import { onExportAsJson, onExportAsCsv } from '../structuredExportCommands';

type Pos = { line: number; character: number };
const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[]; clipboard: string; quickPickCalls: { items: { label: string; description?: string; detail?: string }[] }[] };
    queued: { quickPick: unknown[]; saveDialog: unknown[] };
    window: Record<string, unknown>;
    workspace: Record<string, unknown> & { fs: Record<string, unknown> };
};
const setting = <T>(section: string, key: string) =>
    (vscode.workspace.getConfiguration(section) as unknown as { get(k: string): T }).get(key);
const cursorOf = (e: unknown) => {
    const a = (e as { selection: { active: Pos } }).selection.active;
    return [a.line, a.character];
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('colour presets', () => {
    it('turns on semantic highlighting for markdown and drops the stray theme-scoped key', async () => {
        mock.__setConfig('editor.semanticTokenColorCustomizations', {
            '[markdown]': { enabled: true },
            '[Monokai]': { rules: { keyword: '#fff' } },
            rules: { mine: { foreground: '#123456' }, chevronHeader: { foreground: '#000000' } },
        });
        await applyConfiguredPreset();
        const custom = setting<Record<string, unknown>>('editor', 'semanticTokenColorCustomizations');
        expect(custom['[markdown]']).toBeUndefined();
        expect(custom['[Monokai]']).toEqual({ rules: { keyword: '#fff' } });
        expect((custom.rules as Record<string, unknown>).mine).toEqual({ foreground: '#123456' });
        expect((custom.rules as Record<string, unknown>).chevronHeader).toEqual(COLOUR_PRESETS[0].tokens.chevronHeader);
        expect(setting<boolean>('editor', 'semanticHighlighting.enabled')).toBe(true);
    });

    it('lists presets marking the active one, applies the pick and records it', async () => {
        mock.__setConfig('chevron-lists.colourPreset', 'ocean');
        mock.queued.quickPick.push({ preset: COLOUR_PRESETS.find(p => p.id === 'custom') });
        await onSwitchColourPreset();
        const items = mock.recorded.quickPickCalls[0].items;
        expect(items).toHaveLength(COLOUR_PRESETS.length);
        expect(items.find(i => i.label.includes('Ocean'))!.detail).toBe('$(check) Currently active');
        expect(setting<string>('chevron-lists', 'colourPreset')).toBe('custom');
        const rules = setting<Record<string, Record<string, unknown>>>('editor', 'semanticTokenColorCustomizations').rules;
        expect(Object.keys(rules).filter(k => k.startsWith('chevron'))).toEqual([]);
        expect(mock.recorded.info.at(-1)).toBe('Chevron Lists: Colour preset changed to "custom"');
    });

    it('does nothing when cancelled or when the configured preset is unknown', async () => {
        await onSwitchColourPreset();
        mock.__setConfig('chevron-lists.colourPreset', 'no-such-preset');
        await applyConfiguredPreset();
        expect(setting('editor', 'semanticTokenColorCustomizations')).toBeUndefined();
        expect(mock.recorded.info).toEqual([]);
    });
});

describe('copy item as rich text', () => {
    it('copies the readable form, indented by depth', async () => {
        openEditor(['>>> 2. [x] !! done +3'], { cursor: 0 });
        await onCopyItemAsRichText();
        expect(mock.recorded.clipboard).toBe('  ✓ 🟠 done (+3)');
        expect(mock.recorded.info.at(-1)).toBe('CL: Copied as rich text');
    });

    it('asks for an item, and ignores other editors', async () => {
        await onCopyItemAsRichText();
        openEditor(['>> - a'], { languageId: 'plaintext' });
        await onCopyItemAsRichText();
        openEditor(['> Header']);
        await onCopyItemAsRichText();
        expect(mock.recorded.info).toEqual(['CL: Place cursor on a chevron item to copy']);
    });
});

describe('set section colour', () => {
    it('marks the current colour, sets a new one and removes it', async () => {
        const h = openEditor(['> Plan [colour:blue]', '>> - a'], { cursor: 1 });
        mock.queued.quickPick.push({ colour: 'red' });
        await onSetSectionColour();
        expect(mock.recorded.quickPickCalls[0].items.find(i => i.label === '{blue}')!.description).toBe('← current');
        expect(h.lines()[0]).toBe('> Plan [colour:red]');
        mock.queued.quickPick.push({ colour: null });
        await onSetSectionColour();
        expect(h.lines()[0]).toBe('> Plan');
    });

    it('reports no section, and changes nothing when cancelled', async () => {
        await onSetSectionColour();
        openEditor(['> S'], { languageId: 'plaintext' });
        await onSetSectionColour();
        openEditor(['prose']);
        await onSetSectionColour();
        expect(mock.recorded.info).toEqual(['CL: No section header found at cursor']);
        const h = openEditor(['> S']);
        await onSetSectionColour();
        expect(h.lines()).toEqual(['> S']);
    });
});

describe('item complexity', () => {
    it('shows a bar, percentage and breakdown', async () => {
        const shown: unknown[][] = [];
        const real = mock.window.showInformationMessage;
        mock.window.showInformationMessage = (...args: unknown[]) => { shown.push(args); return Promise.resolve(undefined); };
        try {
            openEditor(['>> - !!! fix #a #b ~2h @2026-01-01 [TODO] @expires:2026-02-01 +1'], { cursor: 0 });
            await onShowItemComplexity();
            openEditor(['>> - plain'], { cursor: 0 });
            await onShowItemComplexity();
        } finally { mock.window.showInformationMessage = real; }
        expect(shown[0][0]).toBe('CL: Complexity ▓▓▓▓▓▓▓▓▓▓ 100%\nPriority: 3 · Tags: 2 · Estimate: 1 · Due: 1 · Expiry: 1 · Vote: 1 · Label: 1');
        expect(shown[0].slice(1)).toEqual([{ modal: true }, 'OK']);
        expect(shown[1][0]).toBe('CL: Complexity ░░░░░░░░░░ 0%\nPriority: 0 · Tags: 0 · Estimate: 0 · Due: 0 · Expiry: 0 · Vote: 0 · Label: 0');
    });

    it('asks for an item', async () => {
        await onShowItemComplexity();
        openEditor(['>> - a'], { languageId: 'plaintext' });
        await onShowItemComplexity();
        openEditor(['> Header']);
        await onShowItemComplexity();
        expect(mock.recorded.info).toEqual(['CL: Place cursor on a chevron item']);
    });
});

describe('header navigation', () => {
    it('moves to the next and previous header, and says when there is none', () => {
        onNextHeader();
        onPrevHeader();
        const h = openEditor(['> A', '>> - a', '> B', '>> - b'], { cursor: 1, character: 3 });
        onNextHeader();
        expect(cursorOf(h.editor)).toEqual([2, 0]);
        onNextHeader();
        expect(mock.recorded.info.at(-1)).toBe('Chevron Lists: no next header found');
        onPrevHeader();
        expect(cursorOf(h.editor)).toEqual([0, 0]);
        onPrevHeader();
        expect(mock.recorded.info.at(-1)).toBe('Chevron Lists: no previous header found');
        expect(h.revealed).toHaveLength(2);
    });
});

describe('structured export', () => {
    let written: string[];
    let dialogs: { defaultUri?: vscode.Uri }[];
    const real = { showSaveDialog: mock.window.showSaveDialog, writeFile: mock.workspace.fs.writeFile };
    beforeEach(() => {
        written = []; dialogs = [];
        mock.window.showSaveDialog = (o: { defaultUri?: vscode.Uri }) => { dialogs.push(o); return Promise.resolve(mock.queued.saveDialog.shift()); };
        mock.workspace.fs.writeFile = (_u: unknown, b: Uint8Array) => { written.push(Buffer.from(b).toString('utf-8')); return Promise.resolve(); };
    });
    afterEach(() => { mock.window.showSaveDialog = real.showSaveDialog; mock.workspace.fs.writeFile = real.writeFile; });

    it('exports JSON beside the file and CSV for an untitled document', async () => {
        openEditor(['> S', '>> - a'], { fileName: 'C:/notes/list.md' });
        mock.queued.saveDialog.push(vscode.Uri.file('C:/notes/list.json'));
        await onExportAsJson();
        expect(dialogs[0].defaultUri?.fsPath.replace(/\\/g, '/')).toBe('C:/notes/list.json');
        expect(JSON.parse(written[0])[0].name).toBe('S');
        expect(mock.recorded.info.at(-1)).toBe('CL: Exported to list.json');

        const h = openEditor(['> S', '>> - a'], { fileName: 'Untitled-1' });
        (h.document as { isUntitled: boolean }).isUntitled = true;
        mock.queued.saveDialog.push(vscode.Uri.file('C:/x.csv'));
        await onExportAsCsv();
        expect(dialogs[1].defaultUri).toBeUndefined();
        expect(written[1].split('\n')[0]).toBe('Section,Depth,Numbered,Number,Content,Tags,Priority,DueDate,Done');
    });

    it('asks for a markdown file, and writes nothing when cancelled', async () => {
        await onExportAsJson();
        await onExportAsCsv();
        expect(mock.recorded.info).toEqual(['CL: Open a markdown file to export', 'CL: Open a markdown file to export']);
        openEditor(['> S']);
        await onExportAsJson();
        expect(written).toEqual([]);
    });
});
