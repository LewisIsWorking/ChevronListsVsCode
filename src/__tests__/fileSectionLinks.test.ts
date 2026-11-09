/**
 * Covers [[file:name.md#Section]] links, which Insert File Section Link writes:
 * the part after # is a section, not part of the file name.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { extractFileLinks } from '../fileLinkParser';
import { extractLinks } from '../linkParser';
import { onGoToLinkedFile } from '../fileLinkCommands';

type Opened = { selection: vscode.Selection; document: unknown; revealRange(): void };
const mock = vscode as unknown as {
    __reset(): void;
    recorded: { warning: string[]; error: string[] };
    workspace: { openTextDocument(u: unknown): Promise<unknown> };
    window: { showTextDocument(d: unknown): Promise<unknown> };
};
const realOpen = mock.workspace.openTextDocument;
const realShow = mock.window.showTextDocument;
const target = ['> First', '>> - a', '> Wanted', '>> - b'];

let openedPaths: string[];
let shown: Opened | undefined;

beforeEach(() => {
    mock.__reset();
    openedPaths = [];
    shown = undefined;
    mock.workspace.openTextDocument = (u: unknown) => {
        openedPaths.push((u as { fsPath: string }).fsPath);
        return Promise.resolve({ lineCount: target.length, lineAt: (i: number) => ({ text: target[i] }) });
    };
    mock.window.showTextDocument = (document: unknown) => {
        shown = { document, selection: new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0)), revealRange: () => {} };
        return Promise.resolve(shown);
    };
});

afterEach(() => {
    mock.workspace.openTextDocument = realOpen;
    mock.window.showTextDocument = realShow;
    deactivate();
});

const onLink = (link: string) => openEditor([`>> - see ${link}`], { cursor: 0, character: 12, fileName: 'C:/tmp/notes.md' });

describe('file section links', () => {
    it('separates the file name from the section', () => {
        const [link] = extractFileLinks('[[file:a.md#Wanted]]', 0);
        expect(link.filename).toBe('a.md');
        expect(link.section).toBe('Wanted');
    });

    it('has no section on a plain file link', () => {
        const [link] = extractFileLinks('[[file:a.md]]', 0);
        expect(link.filename).toBe('a.md');
        expect(link.section).toBeUndefined();
    });

    it('still spans the whole link', () => {
        const [link] = extractFileLinks('x [[file:a.md#Wanted]] y', 0);
        expect([link.start, link.end]).toEqual([2, 22]);
    });

    it('opens the file, not a file named with the section', async () => {
        onLink('[[file:a.md#Wanted]]');
        await onGoToLinkedFile();
        expect(openedPaths).toHaveLength(1);
        expect(openedPaths[0]).not.toContain('#');
        expect(openedPaths[0].endsWith('a.md')).toBe(true);
        expect(mock.recorded.error).toEqual([]);
    });

    it('moves to the linked section', async () => {
        onLink('[[file:a.md#wanted]]');
        await onGoToLinkedFile();
        expect(shown!.selection.active.line).toBe(2);
    });

    it('says when the file has no such section', async () => {
        onLink('[[file:a.md#Missing]]');
        await onGoToLinkedFile();
        expect(mock.recorded.warning).toEqual(['CL: Section "Missing" not found in a.md']);
        expect(shown!.selection.active.line).toBe(0);
    });

    it('does not treat a file link as a section link', () => {
        expect(extractLinks('[[file:a.md]] and [[file:a.md#S]] and [[Real]]').map(l => l.target)).toEqual(['Real']);
    });
});
