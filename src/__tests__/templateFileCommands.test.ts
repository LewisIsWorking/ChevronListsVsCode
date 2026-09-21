/**
 * Covers src/templateFileCommands.ts. WORKSPACE family.
 *
 * Bugs fixed, with regression tests checked against the original code:
 *  - import kept only ">> " lines, dropping nested items;
 *  - import pasted item text into snippet syntax unescaped, so "$5" became a
 *    tab stop and "}" ended a placeholder early;
 *  - export added "> name" above a body that already starts with its header,
 *    writing the header twice (and an extra template on re-import).
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { makeEditor, deactivate } from './helpers/editorHarness';
import { onImportTemplatesFromFile, onExportTemplatesToFile } from '../templateFileCommands';

type Template = { name: string; description: string; body: string };
const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[] };
    queued: { saveDialog: unknown[] };
    window: Record<string, unknown>;
    workspace: Record<string, unknown> & { fs: Record<string, unknown>; getConfiguration(s: string): { get<T>(k: string, d: T): T } };
};
const realOpenDialog = mock.window.showOpenDialog;
const realOpen = mock.workspace.openTextDocument;
const realWrite = mock.workspace.fs.writeFile;

const templates = () => mock.workspace.getConfiguration('chevron-lists').get<Template[]>('templates', []);

function importing(lines: string[]) {
    const uri = vscode.Uri.file('C:/tmp/team-templates.md');
    mock.window.showOpenDialog = () => Promise.resolve([uri]);
    mock.workspace.openTextDocument = () => Promise.resolve(makeEditor(lines).document);
}

function exporting() {
    const written: string[] = [];
    mock.queued.saveDialog.push(vscode.Uri.file('C:/tmp/out.md'));
    mock.workspace.fs.writeFile = (_u: unknown, bytes: Uint8Array) => {
        written.push(Buffer.from(bytes).toString('utf-8'));
        return Promise.resolve();
    };
    return written;
}

beforeEach(() => { mock.__reset(); deactivate(); });
afterEach(() => {
    mock.window.showOpenDialog = realOpenDialog;
    mock.workspace.openTextDocument = realOpen;
    mock.workspace.fs.writeFile = realWrite;
});

describe('onImportTemplatesFromFile', () => {
    it('does nothing when no file is chosen', async () => {
        await onImportTemplatesFromFile();
        mock.window.showOpenDialog = () => Promise.resolve([]);
        await onImportTemplatesFromFile();
        expect(templates()).toEqual([]);
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('reports a file with no sections', async () => {
        importing(['just prose', '>> - orphan item']);
        await onImportTemplatesFromFile();
        expect(mock.recorded.info.at(-1)).toBe('CL: No sections found in the selected file');
        expect(templates()).toEqual([]);
    });

    it('turns each section into a template with a tab stop per item', async () => {
        importing(['> Standup', '>> - yesterday', '>> 1. today', 'notes are skipped', '> Retro', '>> - went well']);
        await onImportTemplatesFromFile();
        expect(templates()).toEqual([
            { name: 'Standup', description: 'Imported from team-templates.md', body: '> ${1:Standup}\n>> - ${2:yesterday}\n>> 1. ${3:today}\n$0' },
            { name: 'Retro', description: 'Imported from team-templates.md', body: '> ${1:Retro}\n>> - ${2:went well}\n$0' },
        ]);
        expect(mock.recorded.info.at(-1)).toBe('CL: Imported 2 templates');
    });

    it('keeps existing templates and says "1 template"', async () => {
        mock.__setConfig('chevron-lists.templates', [{ name: 'Old', description: 'd', body: 'b' }]);
        importing(['> New', '>> - x']);
        await onImportTemplatesFromFile();
        expect(templates().map(t => t.name)).toEqual(['Old', 'New']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Imported 1 template');
    });

    it('imports nested items', async () => {
        importing(['> Trip', '>> - pack', '>>> - socks', '>>>> 1. wool']);
        await onImportTemplatesFromFile();
        expect(templates()[0].body).toBe('> ${1:Trip}\n>> - ${2:pack}\n>>> - ${3:socks}\n>>>> 1. ${4:wool}\n$0');
    });

    it('escapes snippet syntax in names and items', async () => {
        importing(['> Budget {Q1}', '>> - costs $5', '>> - back\\slash}']);
        await onImportTemplatesFromFile();
        expect(templates()[0].body).toBe('> ${1:Budget {Q1\\}}\n>> - ${2:costs \\$5}\n>> - ${3:back\\\\slash\\}}\n$0');
    });

    it('gives an empty item a placeholder', async () => {
        importing(['> Blank', '>> - ']);
        await onImportTemplatesFromFile();
        expect(templates()[0].body).toBe('> ${1:Blank}\n>> - ${2:item}\n$0');
    });
});

describe('onExportTemplatesToFile', () => {
    it('reports when there are no user templates', async () => {
        const written = exporting();
        await onExportTemplatesToFile();
        expect(mock.recorded.info.at(-1)).toBe('CL: No user-defined templates to export');
        expect(written).toEqual([]);
    });

    it('does nothing when the save dialog is cancelled', async () => {
        mock.__setConfig('chevron-lists.templates', [{ name: 'T', description: '', body: '>> - x' }]);
        await onExportTemplatesToFile();
        expect(mock.recorded.info).toHaveLength(0);
    });

    it('writes each header once, adding one only for bodies without their own', async () => {
        mock.__setConfig('chevron-lists.templates', [
            { name: 'Standup', description: '', body: '> ${1:Standup}\n>> - ${2:yesterday}\n$0' },
            { name: 'Loose',   description: '', body: '>> - $1 first\n>> - ${2:second}' },
        ]);
        const written = exporting();
        await onExportTemplatesToFile();
        expect(written).toEqual(['> Standup\n>> - yesterday\n\n> Loose\n>> -  first\n>> - second\n']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Exported 2 templates');
    });

    it('unescapes snippet syntax, so an import then export gives back the original text', async () => {
        importing(['> Budget {Q1}', '>> - costs $5', '>>> - back\\slash}']);
        await onImportTemplatesFromFile();
        const written = exporting();
        await onExportTemplatesToFile();
        expect(written).toEqual(['> Budget {Q1}\n>> - costs $5\n>>> - back\\slash}\n']);
        expect(mock.recorded.info.at(-1)).toBe('CL: Exported 1 template');
    });
});
