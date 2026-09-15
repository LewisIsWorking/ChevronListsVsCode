/**
 * Covers src/outlineProvider.ts.
 *
 * The previous version of this file rebuilt the outline logic locally --
 * "Pure outline-building logic mirrored from outlineProvider.ts" -- and tested
 * that copy, so ChevronOutlineProvider itself was never executed and the module
 * sat at 0%. These tests drive the real provider through the editor harness.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { makeEditor } from './helpers/editorHarness';
import { ChevronOutlineProvider } from '../outlineProvider';

const mock = vscode as unknown as { __reset(): void };

/** Runs the real provider over `lines`. */
function outline(lines: string[]) {
    const { document } = makeEditor(lines);
    return new ChevronOutlineProvider().provideDocumentSymbols(document as never);
}

beforeEach(() => mock.__reset());

describe('ChevronOutlineProvider', () => {
    it('returns nothing for a document with no headers', () => {
        expect(outline(['just prose', '>> - an orphan item'])).toHaveLength(0);
    });

    it('emits one symbol per header, named without the marker', () => {
        const symbols = outline(['> First', '> Second']);
        expect(symbols.map((s) => s.name)).toEqual(['First', 'Second']);
    });

    it('labels the item count, pluralised', () => {
        const two = outline(['> Tasks', '>> - a', '>> - b']);
        expect(two[0].detail).toBe('2 items');
    });

    it('uses the singular for exactly one item', () => {
        const one = outline(['> Tasks', '>> - only']);
        expect(one[0].detail).toBe('1 item');
    });

    it('reports zero items for an empty section', () => {
        const none = outline(['> Empty', 'prose, not an item']);
        expect(none[0].detail).toBe('0 items');
    });

    it('adds a child per bullet, carrying the content as the name', () => {
        const [section] = outline(['> Tasks', '>> - write tests', '>> - ship it']);
        expect(section.children.map((c) => c.name)).toEqual(['write tests', 'ship it']);
        expect(section.children.every((c) => c.kind === vscode.SymbolKind.String)).toBe(true);
    });

    it('prefixes numbered children with their number', () => {
        const [section] = outline(['> Tasks', '>> 1. first', '>> 4. fourth']);
        expect(section.children.map((c) => c.name)).toEqual(['1. first', '4. fourth']);
        expect(section.children.every((c) => c.kind === vscode.SymbolKind.Number)).toBe(true);
    });

    it('mixes bullet and numbered children in document order', () => {
        const [section] = outline(['> Tasks', '>> - bullet', '>> 2. numbered']);
        expect(section.children.map((c) => c.name)).toEqual(['bullet', '2. numbered']);
    });

    it('skips lines that are neither bullet nor numbered', () => {
        const [section] = outline(['> Tasks', '>> - kept', 'plain prose', '   ', '>> 1. also kept']);
        expect(section.children.map((c) => c.name)).toEqual(['kept', '1. also kept']);
    });

    it('skips a bullet with empty content', () => {
        // `>> - ` parses as a bullet but has nothing to show in the outline.
        const [section] = outline(['> Tasks', '>> - ', '>> - real']);
        expect(section.children.map((c) => c.name)).toEqual(['real']);
    });

    it('keeps each section to its own children', () => {
        const [one, two] = outline(['> One', '>> - a', '> Two', '>> - b', '>> - c']);
        expect(one.children.map((c) => c.name)).toEqual(['a']);
        expect(two.children.map((c) => c.name)).toEqual(['b', 'c']);
        expect(one.detail).toBe('1 item');
        expect(two.detail).toBe('2 items');
    });

    it('spans the section in its range and the header line in its selection', () => {
        const [section] = outline(['> Tasks', '>> - a', '>> - b']);
        expect(section.selectionRange.start.line).toBe(0);
        expect(section.range.start.line).toBe(0);
        expect(section.range.end.line).toBe(2);
    });

    it('marks a section as a Module symbol', () => {
        const [section] = outline(['> Tasks']);
        expect(section.kind).toBe(vscode.SymbolKind.Module);
    });
});
