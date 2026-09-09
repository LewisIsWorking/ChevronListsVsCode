/**
 * Covers src/codeActionProvider.ts -- the quick fixes offered for each
 * Chevron Lists diagnostic. 99 statements, previously 2%.
 *
 * The provider is a pure function of (document, diagnostics), so it needs only
 * the harness document plus hand-built diagnostics. Each family is keyed off a
 * diagnostic `code` AND `source === 'Chevron Lists'`, so foreign diagnostics
 * must be ignored -- that filter is asserted explicitly below.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { makeEditor } from './helpers/editorHarness';
import { ChevronCodeActionProvider } from '../codeActionProvider';

const mock = vscode as unknown as { __reset(): void };

/** A Chevron Lists diagnostic of `code` anchored on `line`. */
function diag(line: number, code: string, source = 'Chevron Lists'): vscode.Diagnostic {
    const d = new vscode.Diagnostic(
        new vscode.Range(line, 0, line, 1), `test ${code}`, vscode.DiagnosticSeverity.Warning
    );
    d.code = code;
    d.source = source;
    return d;
}

/** Runs the provider over `lines` with `diags`. */
function actions(lines: string[], diags: vscode.Diagnostic[]) {
    const { document } = makeEditor(lines);
    return new ChevronCodeActionProvider().provideCodeActions(
        document as never,
        new vscode.Range(0, 0, 0, 0),
        { diagnostics: diags, only: undefined, triggerKind: 1 } as never
    );
}

const titles = (lines: string[], diags: vscode.Diagnostic[]) => actions(lines, diags).map((a) => a.title);

beforeEach(() => mock.__reset());

describe('ChevronCodeActionProvider', () => {
    it('advertises the quick-fix kind', () => {
        expect(ChevronCodeActionProvider.providedCodeActionKinds).toEqual([vscode.CodeActionKind.QuickFix]);
    });

    it('offers nothing when there are no diagnostics', () => {
        expect(actions(['> Tasks', '>> 1. a'], [])).toHaveLength(0);
    });

    it('ignores diagnostics from another extension', () => {
        const foreign = diag(1, 'bad-numbering', 'SomeOtherLinter');
        expect(actions(['> Tasks', '>> 5. a'], [foreign])).toHaveLength(0);
    });

    it('ignores a Chevron diagnostic whose code it does not handle', () => {
        expect(actions(['> Tasks', '>> 5. a'], [diag(1, 'not-a-real-code')])).toHaveLength(0);
    });
});

describe('bad-numbering fixes', () => {
    it('offers the corrected number, a custom start, and a fix-all', () => {
        const t = titles(['> Tasks', '>> 1. a', '>> 5. b'], [diag(2, 'bad-numbering')]);
        expect(t).toEqual([
            'CL: Fix: change 5 to 2',
            'CL: Set custom start number here…',
            'CL: Fix all numbering in file',
        ]);
    });

    it('marks the corrected number as the preferred fix', () => {
        const [first] = actions(['> Tasks', '>> 1. a', '>> 5. b'], [diag(2, 'bad-numbering')]);
        expect(first.isPreferred).toBe(true);
    });

    it('rewrites the line to the expected number', () => {
        const [first] = actions(['> Tasks', '>> 1. a', '>> 5. b'], [diag(2, 'bad-numbering')]);
        expect(first.edit?.operations[0].text).toBe('>> 2. b');
    });

    it('skips a diagnostic anchored on a line that is not numbered', () => {
        // No per-line fixes, but the file-wide fix-all is still offered.
        expect(titles(['> Tasks', 'prose'], [diag(1, 'bad-numbering')]))
            .toEqual(['CL: Fix all numbering in file']);
    });

    it('offers one fix-all no matter how many diagnostics there are', () => {
        const t = titles(['> T', '>> 4. a', '>> 9. b'], [diag(1, 'bad-numbering'), diag(2, 'bad-numbering')]);
        expect(t.filter((x) => x === 'CL: Fix all numbering in file')).toHaveLength(1);
    });
});

describe('duplicate-header fixes', () => {
    it('offers a rename and a uniquified name', () => {
        const t = titles(['> Tasks', '> Tasks'], [diag(1, 'duplicate-header')]);
        expect(t).toEqual(['CL: Rename section "Tasks"…', 'CL: Make unique: rename to "Tasks 2"']);
    });

    it('skips past a suffix already in use', () => {
        const t = titles(['> Tasks', '> Tasks 2', '> Tasks'], [diag(2, 'duplicate-header')]);
        expect(t[1]).toBe('CL: Make unique: rename to "Tasks 3"');
    });

    it('writes the uniquified header as the edit', () => {
        const a = actions(['> Tasks', '> Tasks'], [diag(1, 'duplicate-header')]);
        expect(a[1].edit?.operations[0].text).toBe('> Tasks 2');
    });
});

describe('empty-section fixes', () => {
    it('offers a placeholder, a delete and a quick capture', () => {
        expect(titles(['> Empty'], [diag(0, 'empty-section')])).toEqual([
            'CL: Add placeholder item',
            'CL: Delete this empty section',
            'CL: Quick capture to this section…',
        ]);
    });

    it('inserts the placeholder on the line below the header', () => {
        const [add] = actions(['> Empty'], [diag(0, 'empty-section')]);
        expect(add.edit?.operations[0].kind).toBe('insert');
        expect(add.edit?.operations[0].text).toContain('Item');
    });
});

describe('overdue fixes', () => {
    const today = new Date().toISOString().slice(0, 10);

    it('offers reschedule, remove and mark-done for a bullet', () => {
        const t = titles(['>> - task @2020-01-01'], [diag(0, 'overdue')]);
        expect(t).toEqual([
            `CL: Reschedule to today (${today})`,
            'CL: Remove due date',
            'CL: Mark item done',
        ]);
    });

    it('rebuilds a numbered item keeping its number', () => {
        const [reschedule] = actions(['>> 3. task @2020-01-01'], [diag(0, 'overdue')]);
        expect(reschedule.edit?.operations[0].text).toContain('>> 3. ');
    });

    it('rebuilds a bullet keeping its marker', () => {
        const [reschedule] = actions(['>> - task @2020-01-01'], [diag(0, 'overdue')]);
        expect(reschedule.edit?.operations[0].text).toContain('>> - ');
    });

    it('skips a line that is neither bullet nor numbered', () => {
        expect(actions(['plain prose @2020-01-01'], [diag(0, 'overdue')])).toHaveLength(0);
    });
});

describe('word-goal fixes', () => {
    it('offers update, remove and breakdown', () => {
        expect(titles(['> Chapter ==500'], [diag(0, 'word-goal')])).toEqual([
            'CL: Update word count goal…',
            'CL: Remove word count goal',
            'CL: Show word count breakdown',
        ]);
    });

    it('strips the goal marker in the remove edit', () => {
        const a = actions(['> Chapter ==500'], [diag(0, 'word-goal')]);
        expect(a[1].edit?.operations[0].text).toBe('> Chapter');
    });
});

describe('expiry fixes', () => {
    it('offers two extensions and a removal', () => {
        const t = titles(['>> - task @expires:2026-01-10'], [diag(0, 'expired')]);
        expect(t).toEqual([
            'CL: Extend expiry by 7 days (→ 2026-01-17)',
            'CL: Extend expiry by 30 days (→ 2026-02-09)',
            'CL: Remove expiry date',
        ]);
    });

    it('removes the marker entirely in the removal edit', () => {
        const a = actions(['>> - task @expires:2026-01-10'], [diag(0, 'expired')]);
        expect(a[2].edit?.operations[0].text).toBe('>> - task');
    });

    it('skips a line with no expiry marker', () => {
        expect(actions(['>> - task with no expiry'], [diag(0, 'expired')])).toHaveLength(0);
    });

    it('skips a line that is neither bullet nor numbered', () => {
        expect(actions(['prose @expires:2026-01-10'], [diag(0, 'expired')])).toHaveLength(0);
    });

    it('rebuilds a numbered item keeping its number', () => {
        const [ext7] = actions(['>> 2. task @expires:2026-01-10'], [diag(0, 'expired')]);
        expect(ext7.edit?.operations[0].text).toContain('>> 2. ');
    });
});

describe('mixed diagnostics', () => {
    it('returns each family in a stable order', () => {
        const t = titles(
            ['> Tasks', '>> 5. a @2020-01-01'],
            [diag(1, 'overdue'), diag(1, 'bad-numbering')]
        );
        // bad-numbering is emitted before overdue regardless of input order
        expect(t[0]).toContain('CL: Fix: change 5');
        expect(t.some((x) => x.startsWith('CL: Reschedule'))).toBe(true);
    });
});
