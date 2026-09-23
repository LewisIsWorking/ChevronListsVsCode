/**
 * Keeps the repo free of em dashes (Lewis, 2026-09-21: none in any repo - code,
 * comments, docs, UI text or the shipped bundle). Escapes count too, since they
 * still print one. Write " - ", a comma, a colon or a full stop instead.
 */
import { describe, it, expect } from 'bun:test';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dir, '..', '..');

// Built in pieces so this file does not contain what it searches for
const forbidden = [String.fromCharCode(0x2014), '&' + 'mdash;', '\\' + 'u2014'];
const binary = /\.(png|ico|jpg|gif|vsix|lockb)$/i;

function trackedFiles(): string[] {
    return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
        .split('\n')
        .filter(f => f && !binary.test(f));
}

describe('no em dashes', () => {
    it('scans the whole repo, including the shipped bundle', () => {
        const files = trackedFiles();
        // A guard that scans nothing would pass for ever
        expect(files).toContain('src/extension.ts');
        expect(files).toContain('dist/extension.js');
        expect(files).toContain('CHANGELOG.md');
    });

    it('finds none in any tracked file', () => {
        const offenders: string[] = [];
        for (const file of trackedFiles()) {
            const lines = readFileSync(join(root, file), 'utf8').split('\n');
            const hits = lines.flatMap((line, i) => forbidden.some(f => line.includes(f)) ? [i + 1] : []);
            if (hits.length > 0) { offenders.push(`${file}: lines ${hits.join(', ')}`); }
        }
        expect(offenders).toEqual([]);
    });
});
