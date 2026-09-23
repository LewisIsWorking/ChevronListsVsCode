import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const snippetsPath = join(import.meta.dir, '../../snippets/chevron-lists.code-snippets');
const snippets = JSON.parse(readFileSync(snippetsPath, 'utf-8'));

// Mirror of SNIPPETS map in tabHandler.ts - must stay in sync
const SNIPPETS: Record<string, string> = {
    'chl': '> ${1:Section Header}\n>> - ${2:First item}\n>> - ${3:Second item}\n>> - $0',
    'chn': '> ${1:Section Header}\n>> 1. ${2:First item}\n>> 2. ${3:Second item}\n>> 3. $0',
};

describe('SNIPPETS map (tabHandler)', () => {
    it('contains chl and chn', () => {
        expect(Object.keys(SNIPPETS)).toContain('chl');
        expect(Object.keys(SNIPPETS)).toContain('chn');
    });
    it('chl body starts with > header line', () => {
        expect(SNIPPETS['chl'].split('\n')[0]).toMatch(/^> /);
    });
    it('chl body has >> - items', () => {
        expect(SNIPPETS['chl']).toContain('>> - ');
    });
    it('chn body has >> 1. items', () => {
        expect(SNIPPETS['chn']).toContain('>> 1. ');
    });
    it('chl and chn bodies end with $0 final cursor', () => {
        expect(SNIPPETS['chl'].endsWith('$0')).toBe(true);
        expect(SNIPPETS['chn'].endsWith('$0')).toBe(true);
    });
    it('SNIPPETS map matches snippet file prefixes', () => {
        expect(snippets['Chevron Bullet List'].prefix).toBe('chl');
        expect(snippets['Chevron Numbered List'].prefix).toBe('chn');
    });
    it('valid trigger values are tab, ctrl+enter, none', () => {
        const validTriggers = ['tab', 'ctrl+enter', 'none'];
        // Verify the package.json enum matches
        const pkgPath = join(import.meta.dir, '../../package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        const enumValues = pkg.contributes.configuration.properties['chevron-lists.snippetTrigger'].enum;
        expect(enumValues).toEqual(validTriggers);
    });
    it('default trigger is tab', () => {
        const pkgPath = join(import.meta.dir, '../../package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        expect(pkg.contributes.configuration.properties['chevron-lists.snippetTrigger'].default).toBe('tab');
    });
});

describe('chevron-lists snippets file', () => {
    it('contains both snippets', () => {
        expect(snippets).toHaveProperty('Chevron Bullet List');
        expect(snippets).toHaveProperty('Chevron Numbered List');
    });

    describe('chl - Chevron Bullet List', () => {
        const s = snippets['Chevron Bullet List'];
        it('has prefix chl', ()         => expect(s.prefix).toBe('chl'));
        it('is scoped to markdown', ()  => expect(s.scope).toBe('markdown'));
        it('starts with a > header', () => expect(s.body[0]).toMatch(/^> /));
        it('has >> - items', ()         => expect(s.body[1]).toMatch(/^>> - /));
        it('ends with a $0 cursor', ()  => expect(s.body[s.body.length - 1]).toContain('$0'));
        it('has a description', ()      => expect(s.description.length).toBeGreaterThan(0));
    });

    describe('chn - Chevron Numbered List', () => {
        const s = snippets['Chevron Numbered List'];
        it('has prefix chn', ()              => expect(s.prefix).toBe('chn'));
        it('is scoped to markdown', ()       => expect(s.scope).toBe('markdown'));
        it('starts with a > header', ()      => expect(s.body[0]).toMatch(/^> /));
        it('has >> 1. numbered items', ()    => expect(s.body[1]).toMatch(/^>> 1\. /));
        it('increments numbers correctly', () => {
            const numbers = s.body.slice(1).map((line: string) => {
                const match = line.match(/^>> (\d+)\./);
                return match ? parseInt(match[1]) : null;
            }).filter(Boolean);
            expect(numbers).toEqual([1, 2, 3]);
        });
        it('ends with a $0 cursor', ()  => expect(s.body[s.body.length - 1]).toContain('$0'));
        it('has a description', ()      => expect(s.description.length).toBeGreaterThan(0));
    });
});
