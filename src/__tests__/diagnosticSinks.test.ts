/**
 * Regression tests for the session-long diagnostic retention leak.
 *
 * Four DiagnosticCollections call `.set(uri, ...)` on every refresh
 * (chevron-lists, -dates, -wordgoals, -expiry). None released the entry when
 * the document closed, so every markdown file opened during a session stayed
 * retained. `clearSinks` is the cleanup core wired to onDidCloseTextDocument.
 */
import { describe, it, expect } from 'bun:test';
import { clearSinks, type DiagnosticSink, type UriLike } from '../diagnosticSinks';

/** Map-backed stand-in for vscode.DiagnosticCollection */
class FakeCollection implements DiagnosticSink {
    readonly entries = new Map<string, unknown[]>();
    set(uri: UriLike, diags: unknown[]): void { this.entries.set(uri.toString(), diags); }
    delete(uri: never): void { this.entries.delete((uri as UriLike).toString()); }
    get size(): number { return this.entries.size; }
}

const uri = (p: string): UriLike => ({ toString: () => p });

/** The four collections the extension writes into */
function fourCollections(): FakeCollection[] {
    return [new FakeCollection(), new FakeCollection(), new FakeCollection(), new FakeCollection()];
}

describe('clearSinks', () => {
    it('releases the entry in every collection', () => {
        const colls = fourCollections();
        const doc   = uri('/tmp/notes.md');
        for (const c of colls) { c.set(doc, []); }
        for (const c of colls) { expect(c.size).toBe(1); }

        clearSinks(colls, doc);

        for (const c of colls) { expect(c.size).toBe(0); }
    });

    it('leaves entries for other documents untouched', () => {
        const colls  = fourCollections();
        const closed = uri('/tmp/closed.md');
        const open   = uri('/tmp/still-open.md');
        for (const c of colls) { c.set(closed, []); c.set(open, []); }

        clearSinks(colls, closed);

        for (const c of colls) {
            expect(c.size).toBe(1);
            expect(c.entries.has('/tmp/still-open.md')).toBe(true);
        }
    });

    it('does not accumulate across many open/close cycles', () => {
        const colls = fourCollections();
        for (let i = 0; i < 500; i++) {
            const doc = uri(`/tmp/note-${i}.md`);
            for (const c of colls) { c.set(doc, []); }
            clearSinks(colls, doc);
        }
        // Without the close-time delete this would be 500 per collection
        for (const c of colls) { expect(c.size).toBe(0); }
    });

    it('is a no-op for a document that was never diagnosed', () => {
        const colls = fourCollections();
        expect(() => clearSinks(colls, uri('/tmp/never-seen.md'))).not.toThrow();
        for (const c of colls) { expect(c.size).toBe(0); }
    });

    it('handles an empty sink list', () => {
        expect(() => clearSinks([], uri('/tmp/x.md'))).not.toThrow();
    });
});
