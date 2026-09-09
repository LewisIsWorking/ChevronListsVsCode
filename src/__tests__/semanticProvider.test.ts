/**
 * Covers src/semanticProvider.ts.
 *
 * The previous version of this file rebuilt the tokenising logic locally and
 * tested that copy, leaving the real provider at 6%. These tests run the actual
 * provider and decode what it emitted.
 *
 * The mock's SemanticTokensBuilder stores what was pushed rather than the
 * relative-delta encoding real VS Code uses, so the decoded values below are
 * absolute (line, char) -- which is what the assertions want anyway.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { makeEditor } from './helpers/editorHarness';
import { ChevronSemanticTokensProvider, buildLegend } from '../semanticProvider';

const mock = vscode as unknown as { __reset(): void };

const TYPES = ['chevronHeader', 'chevronPrefix', 'chevronNumber', 'chevronContent', 'chevronLabel'];

interface Token { line: number; char: number; len: number; type: string; }

/** Runs the real provider and decodes its token stream. */
function tokens(lines: string[]): Token[] {
    const { document } = makeEditor(lines);
    const built = new ChevronSemanticTokensProvider(buildLegend())
        .provideDocumentSemanticTokens(document as never);
    const data = (built as unknown as { data: Uint32Array }).data;
    const out: Token[] = [];
    for (let i = 0; i < data.length; i += 5) {
        out.push({ line: data[i], char: data[i + 1], len: data[i + 2], type: TYPES[data[i + 3]] });
    }
    return out;
}

const typesOn = (lines: string[]) => tokens(lines).map((t) => t.type);

beforeEach(() => mock.__reset());

describe('buildLegend', () => {
    it('lists the five contributed token types in order', () => {
        expect(buildLegend().tokenTypes).toEqual(TYPES);
    });

    it('contributes no modifiers', () => {
        expect(buildLegend().tokenModifiers).toEqual([]);
    });
});

describe('ChevronSemanticTokensProvider', () => {
    it('emits nothing for a document with no chevron lines', () => {
        expect(tokens(['just prose', ''])).toHaveLength(0);
    });

    it('splits a header into marker and text', () => {
        const t = tokens(['> Tasks']);
        expect(t).toEqual([
            { line: 0, char: 0, len: 2, type: 'chevronPrefix' },
            { line: 0, char: 2, len: 5, type: 'chevronHeader' },
        ]);
    });

    it('splits a bullet into chevrons, marker and content', () => {
        const t = tokens(['>> - milk']);
        expect(t).toEqual([
            { line: 0, char: 0, len: 3, type: 'chevronPrefix' },   // ">> "
            { line: 0, char: 3, len: 2, type: 'chevronNumber' },   // "- "
            { line: 0, char: 5, len: 4, type: 'chevronContent' },  // "milk"
        ]);
    });

    it('accounts for depth in a nested bullet', () => {
        const t = tokens(['>>> - milk']);
        expect(t[0]).toEqual({ line: 0, char: 0, len: 4, type: 'chevronPrefix' });
        expect(t[2]).toEqual({ line: 0, char: 6, len: 4, type: 'chevronContent' });
    });

    it('emits no content token for an empty bullet', () => {
        expect(typesOn(['>> - '])).toEqual(['chevronPrefix', 'chevronNumber']);
    });

    it('splits a numbered item into chevrons, number, dot and content', () => {
        const t = tokens(['>> 7. milk']);
        expect(t).toEqual([
            { line: 0, char: 0, len: 3, type: 'chevronPrefix' },   // ">> "
            { line: 0, char: 3, len: 1, type: 'chevronNumber' },   // "7"
            { line: 0, char: 4, len: 2, type: 'chevronPrefix' },   // ". "
            { line: 0, char: 6, len: 4, type: 'chevronContent' },  // "milk"
        ]);
    });

    it('handles a multi-digit number', () => {
        const t = tokens(['>> 12. milk']);
        expect(t[1]).toEqual({ line: 0, char: 3, len: 2, type: 'chevronNumber' });
        expect(t[3]).toEqual({ line: 0, char: 7, len: 4, type: 'chevronContent' });
    });

    it('emits no content token for an empty numbered item', () => {
        expect(typesOn(['>> 1. '])).toEqual(['chevronPrefix', 'chevronNumber', 'chevronPrefix']);
    });

    it('carves a label out of the surrounding content', () => {
        // "before [LABEL] after" -> content, label, content
        expect(typesOn(['>> - before [LABEL] after']).slice(2)).toEqual(
            ['chevronContent', 'chevronLabel', 'chevronContent']
        );
    });

    it('emits no leading content token when the label starts the content', () => {
        expect(typesOn(['>> - [LABEL] after']).slice(2)).toEqual(
            ['chevronLabel', 'chevronContent']
        );
    });

    it('emits no trailing content token when the label ends the content', () => {
        expect(typesOn(['>> - before [LABEL]']).slice(2)).toEqual(
            ['chevronContent', 'chevronLabel']
        );
    });

    it('handles a content region that is only a label', () => {
        expect(typesOn(['>> - [LABEL]']).slice(2)).toEqual(['chevronLabel']);
    });

    it('handles two labels in one item', () => {
        expect(typesOn(['>> - a [ONE] b [TWO] c']).slice(2)).toEqual(
            ['chevronContent', 'chevronLabel', 'chevronContent', 'chevronLabel', 'chevronContent']
        );
    });

    it('tokenises every line of a mixed document', () => {
        const t = tokens(['> Tasks', '>> - milk', 'prose', '>> 2. eggs']);
        expect(t.map((x) => x.line)).toEqual([0, 0, 1, 1, 1, 3, 3, 3, 3]);
    });

    it('skips a zero-length token rather than emitting it', () => {
        // `push` guards on length > 0. Nothing reachable through a document can
        // produce a zero-length span, so drive the guard directly.
        const provider = new ChevronSemanticTokensProvider(buildLegend());
        const builder = new vscode.SemanticTokensBuilder(buildLegend());
        (provider as unknown as {
            push(b: unknown, l: number, s: number, n: number, t: string): void;
        }).push(builder, 0, 0, 0, 'chevronContent');
        expect((builder.build() as unknown as { data: Uint32Array }).data).toHaveLength(0);
    });
});
