/**
 * Covers src/lineEdits.ts: the shared "put this on the next line" and "end of
 * this section's content" helpers that replaced ~30 hand-rolled inserts.
 * Each case is applied through the editor harness so the assertions are on the
 * resulting document, not on positions.
 */
import { describe, it, expect } from 'bun:test';
import { makeEditor } from './helpers/editorHarness';
import { appendBlock, lineAfter, sectionContentEnd, wholeLineRange, wholeLineRanges } from '../lineEdits';

type Doc = { lineCount: number; lineAt(i: number): { text: string } };
type Ed = { document: Doc; edit(cb: (eb: { insert(p: unknown, t: string): void; delete(r: unknown): void }) => void): Promise<boolean> };

async function apply(lines: string[], after: number, text: string) {
    const h = makeEditor(lines);
    const ed = h.editor as Ed;
    const ins = lineAfter(ed.document, after, text);
    await ed.edit(eb => eb.insert(ins.position, ins.text));
    return { lines: h.lines(), line: ins.line };
}

describe('lineAfter', () => {
    it('inserts before the following line in the middle of a file', async () => {
        expect(await apply(['a', 'b'], 0, 'X')).toEqual({ lines: ['a', 'X', 'b'], line: 1 });
    });

    it('puts text on its own line after a last line with no trailing newline', async () => {
        expect(await apply(['a', 'b'], 1, 'X')).toEqual({ lines: ['a', 'b', 'X'], line: 2 });
    });

    it('uses the empty last line of a file that ends with a newline, keeping the newline', async () => {
        expect(await apply(['a', ''], 0, 'X')).toEqual({ lines: ['a', 'X', ''], line: 1 });
        expect(await apply(['a', ''], 1, 'X')).toEqual({ lines: ['a', 'X', ''], line: 1 });
    });

    it('treats a line past the end as the last line', async () => {
        expect(await apply(['a'], 5, 'X')).toEqual({ lines: ['a', 'X'], line: 1 });
    });

    it('inserts multi-line text as consecutive lines', async () => {
        expect(await apply(['a'], 0, 'X\nY')).toEqual({ lines: ['a', 'X', 'Y'], line: 1 });
        expect(await apply(['a', 'b'], 0, 'X\nY')).toEqual({ lines: ['a', 'X', 'Y', 'b'], line: 1 });
    });
});

describe('sectionContentEnd', () => {
    const doc = (lines: string[]): Doc => ({ lineCount: lines.length, lineAt: i => ({ text: lines[i] }) });

    it('skips the blank lines separating a section from the next header', () => {
        expect(sectionContentEnd(doc(['> A', '>> - a', '', '  ', '> B']), 0)).toBe(1);
    });

    it('is the last line when the section runs to the end of the file', () => {
        expect(sectionContentEnd(doc(['> A', '>> - a', '>> - b']), 0)).toBe(2);
    });

    it('skips the empty line a trailing newline leaves', () => {
        expect(sectionContentEnd(doc(['> A', '>> - a', '']), 0)).toBe(1);
    });

    it('keeps non-item content that belongs to the section', () => {
        expect(sectionContentEnd(doc(['> A', '>> - a', 'prose', '', '> B']), 0)).toBe(2);
    });

    it('is the header itself for an empty section', () => {
        expect(sectionContentEnd(doc(['> A', '', '> B']), 0)).toBe(0);
        expect(sectionContentEnd(doc(['> A']), 0)).toBe(0);
    });
});

describe('appendBlock', () => {
    async function append(lines: string[], text: string, deleted: number[] = []) {
        const h = makeEditor(lines);
        const ed = h.editor as Ed;
        const ins = appendBlock(ed.document, text, deleted);
        const ranges = wholeLineRanges(ed.document, deleted);
        await ed.edit(eb => { for (const r of ranges) { eb.delete(r); } eb.insert(ins.position, ins.text); });
        return h.lines();
    }

    it('leaves one blank line after text', async () => {
        expect(await append(['a'], 'X', [])).toEqual(['a', '', 'X']);
    });

    it('keeps the trailing newline and still leaves one blank line', async () => {
        expect(await append(['a', ''], 'X', [])).toEqual(['a', '', 'X', '']);
    });

    it('adds no second blank line after a blank line', async () => {
        expect(await append(['a', '', ''], 'X', [])).toEqual(['a', '', 'X', '']);
    });

    it('judges the gap against the lines left after the deletions', async () => {
        expect(await append(['a', '', 'gone', 'gone too', ''], 'X', [2, 3])).toEqual(['a', '', 'X', '']);
        expect(await append(['a', 'gone'], 'X', [1])).toEqual(['a', '', 'X']);
    });

    it('adds no gap when nothing is left before it', async () => {
        expect(await append([''], 'X', [])).toEqual(['X', '']);
    });
});

async function remove(lines: string[], which: number[]) {
    const h = makeEditor(lines);
    const ed = h.editor as Ed;
    const ranges = wholeLineRanges(ed.document, which);
    await ed.edit(eb => { for (const r of ranges) { eb.delete(r); } });
    return h.lines();
}

describe('wholeLineRanges', () => {
    it('deletes a line in the middle of the file', async () => {
        expect(await remove(['a', 'b', 'c'], [1])).toEqual(['a', 'c']);
    });

    it('deletes the last line without leaving an empty line', async () => {
        expect(await remove(['a', 'b'], [1])).toEqual(['a']);
    });

    it('keeps the trailing newline of a file that has one', async () => {
        expect(await remove(['a', 'b', ''], [1])).toEqual(['a', '']);
    });

    it('keeps the trailing newline when the run includes the empty last line', async () => {
        expect(await remove(['a', 'b', ''], [1, 2])).toEqual(['a', '']);
    });

    it('deletes just the empty last line by taking the break before it', async () => {
        expect(await remove(['a', ''], [1])).toEqual(['a']);
    });

    it('deletes the only line', async () => {
        expect(await remove(['a'], [0])).toEqual(['']);
    });

    it('deletes every line', async () => {
        expect(await remove(['a', 'b'], [0, 1])).toEqual(['']);
    });

    it('merges consecutive lines so the ranges never overlap', async () => {
        expect(await remove(['a', 'b', 'c', 'd'], [3, 2])).toEqual(['a', 'b']);
        expect(await remove(['a', 'b', 'c', 'd', 'e'], [0, 1, 3])).toEqual(['c', 'e']);
    });

    it('ignores duplicates', async () => {
        expect(await remove(['a', 'b', 'c'], [1, 1])).toEqual(['a', 'c']);
    });

    it('wholeLineRange is the single-line form', async () => {
        const h = makeEditor(['a', 'b']);
        const r = wholeLineRange((h.editor as Ed).document, 1);
        expect([r.start.line, r.start.character, r.end.line, r.end.character]).toEqual([0, 1, 1, 1]);
    });
});
