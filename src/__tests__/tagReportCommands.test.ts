/**
 * Covers src/tagReportCommands.ts. WORKSPACE family.
 *
 * Files were keyed by base name, so two notes.md files in different folders
 * were reported as one file with their counts added together. The regression
 * test was checked against that code.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { makeEditor, deactivate } from './helpers/editorHarness';
import { onShowTagReportWorkspace } from '../tagReportCommands';

const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[] };
    workspace: Record<string, unknown>;
};
const realWorkspace = { ...mock.workspace };

/** Serves `files` (path -> lines) to the command and captures the report it opens. */
function workspaceOf(files: Record<string, string[]>) {
    const reports: string[] = [];
    mock.workspace.findFiles = () => Promise.resolve(Object.keys(files).map(p => vscode.Uri.file(p)));
    mock.workspace.asRelativePath = (u: vscode.Uri) => u.fsPath.replace(/^C:\/ws\//, '');
    mock.workspace.openTextDocument = (arg: vscode.Uri | { content: string }) => {
        if ('content' in arg) { reports.push(arg.content); return Promise.resolve({}); }
        return Promise.resolve(makeEditor(files[arg.fsPath]).document);
    };
    return reports;
}

beforeEach(() => { mock.__reset(); deactivate(); });
afterEach(() => { Object.assign(mock.workspace, realWorkspace); });

describe('onShowTagReportWorkspace', () => {
    it('reports when no item in the workspace has a tag', async () => {
        const reports = workspaceOf({ 'C:/ws/a.md': ['> S', '>> - plain', 'prose #not-an-item'] });
        await onShowTagReportWorkspace();
        expect(mock.recorded.info.at(-1)).toBe('CL: No #tags found in workspace');
        expect(reports).toEqual([]);
    });

    it('lists tags by total, with a line per file and singular counts', async () => {
        const reports = workspaceOf({
            'C:/ws/a.md': ['> S', '>> - one #work', '>> 1. two #work #home'],
            'C:/ws/b.md': ['> T', '>> - three #work'],
        });
        await onShowTagReportWorkspace();
        expect(reports).toEqual([
            '# Tag Report - Workspace\n\n2 unique tags across 2 files\n\n' +
            '## #work (3 total)\n\n  - a.md: 2 items\n  - b.md: 1 item\n\n' +
            '## #home (1 total)\n\n  - a.md: 1 item',
        ]);
    });

    it('keeps files with the same name in different folders apart', async () => {
        const reports = workspaceOf({
            'C:/ws/work/notes.md': ['> S', '>> - a #todo'],
            'C:/ws/home/notes.md': ['> S', '>> - b #todo', '>> - c #todo'],
        });
        await onShowTagReportWorkspace();
        expect(reports[0]).toContain('  - work/notes.md: 1 item\n  - home/notes.md: 2 items');
    });

    it('uses the configured bullet prefix to recognise items', async () => {
        mock.__setConfig('chevron-lists.listPrefix', '*');
        const reports = workspaceOf({ 'C:/ws/a.md': ['> S', '>> * star #yes', '>> - dash #no'] });
        await onShowTagReportWorkspace();
        expect(reports[0]).toContain('## #yes');
        expect(reports[0]).not.toContain('#no');
    });
});
