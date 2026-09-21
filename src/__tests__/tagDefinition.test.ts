/**
 * One definition of a #tag, used everywhere (see TAG_RE in tagParser.ts).
 *
 * Tags used to be matched several ways, none anchored: "#to-do" was "to" in
 * exports, stats, complexity and rename, a URL fragment was a tag (and was
 * deleted from the URL when metadata was stripped), and "C#" could start one.
 * Alongside that: Bulk Tag skipped "#tag" on items containing "#tagging";
 * section Rename Tag rewrote "#to-do" when renaming "#to" and skipped items
 * because its global regex carried lastIndex between lines; tag stats counted
 * "#Work" and "#work" apart; and the Obsidian export wrote "- - [x] done",
 * dropped item numbers, and replaced "[x]" and "!!!" in the middle of text.
 *
 * The regression tests below were checked against the original code.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, makeEditor, deactivate } from './helpers/editorHarness';
import { extractTags, stripTags, hasTag, renameTagInText } from '../tagParser';
import { stripAllMetadata } from '../metadataStripper';
import { renderContent } from '../htmlExporter';
import { collectTagStats, convertToObsidian, scoreItemComplexity, itemToMarkdown } from '../patterns';
import { onBulkTagItems } from '../bulkCommands';
import { onRenameTagSection } from '../renameTagSectionCommands';
import { onConvertItemToSectionLink } from '../convertToLinkCommands';
import { ChevronTagCompletionProvider } from '../completionProviders';
import { todayDate } from '../patterns';

const mock = vscode as unknown as {
    __reset(): void;
    recorded: { info: string[]; inputBoxCalls: { validateInput(v: string): string | null }[] };
    queued: { quickPick: unknown[]; inputBox: (string | undefined)[] };
};

beforeEach(() => { mock.__reset(); deactivate(); });

describe('what is a tag', () => {
    it('a # at the start or after whitespace, then a word character, then word characters or hyphens', () => {
        expect(extractTags('#first mid #to-do\t#tab #2024 #snake_case')).toEqual(['first', 'to-do', 'tab', '2024', 'snake_case']);
    });

    it('not a URL fragment, not C#, not "#-" or a lone #', () => {
        expect(extractTags('see example.com/guide#setup, C# and #- and # alone')).toEqual([]);
    });

    it('compares tags without case', () => {
        expect(extractTags('#Work #work #WORK')).toEqual(['work']);
        expect(hasTag('ship it #Urgent', 'urgent')).toBe(true);
        expect(hasTag('ship it', '#urgent')).toBe(false);
    });

    it('a tag is not a longer tag that starts with it', () => {
        expect(hasTag('#tagging', 'tag')).toBe(false);
        expect(hasTag('#tag-two', 'tag')).toBe(false);
        expect(hasTag('#tag)', 'tag')).toBe(true);
    });
});

describe('every feature uses that definition', () => {
    const URL_ITEM = 'read example.com/guide#setup #docs';

    it('stripping tags and metadata keeps a URL fragment', () => {
        expect(stripTags(URL_ITEM)).toBe('read example.com/guide#setup');
        expect(stripAllMetadata(URL_ITEM)).toBe('read example.com/guide#setup');
    });

    it('the HTML export badges tags only, escaping everything else', () => {
        expect(renderContent('a<b> [x #to-do example.com/p#frag [[S]]')).toBe(
            'a&lt;b&gt; [x <span class="cl-tag">#to-do</span> example.com/p#frag ' +
            '<a class="cl-link" href="#section-s">S</a>'
        );
    });

    it('tag stats merge case, count an item once, and keep hyphens', () => {
        const stats = collectTagStats([
            { text: '>> - [x] a #Work #work' },
            { text: '>> - b #work #to-do example.com/x#frag' },
        ], '-');
        expect(stats).toEqual([
            { tag: 'work', total: 2, done: 1 },
            { tag: 'to-do', total: 1, done: 0 },
        ]);
    });

    it('complexity counts distinct tags', () => {
        expect(scoreItemComplexity('x #a #a example.com/y#frag').tags).toBe(1);
    });

    it('markdown conversion bolds whole tags only', () => {
        expect(itemToMarkdown('see example.com/p#frag #to-do')).toBe('- see example.com/p#frag **#to-do**');
    });

    it('convert to section link ignores a hyphenated tag when matching the section name', async () => {
        const h = openEditor(['> Deploy', '> Other', '>> - Deploy #v2-launch'], { cursor: 2 });
        await onConvertItemToSectionLink();
        expect(h.lines()[2]).toBe('>> - [[Deploy]]');
    });

    it('tag completion is not offered after C# or inside a URL', () => {
        const provider = new ChevronTagCompletionProvider();
        const { document } = makeEditor(['>> - x #known', '>> - C#', '>> - example.com/p#', '>> - new #']);
        const at = (line: number) => provider.provideCompletionItems(document as never, new vscode.Position(line, (document as { lineAt(i: number): { text: string } }).lineAt(line).text.length) as never);
        expect(at(1)).toEqual([]);
        expect(at(2)).toEqual([]);
        expect(at(3).map(i => i.label)).toEqual(['known']);
    });
});

describe('bulk tag items', () => {
    it('adds the tag to an item that only has a longer tag starting with it', async () => {
        const h = openEditor(['> S', '>> - a #tagging', '>> - b #Tag'], { cursor: 0 });
        mock.queued.inputBox.push('tag');
        await onBulkTagItems();
        expect(h.lines()).toEqual(['> S', '>> - a #tagging #tag', '>> - b #Tag']);
    });

    it('accepts the tag typed with its #', async () => {
        const h = openEditor(['> S', '>> - a'], { cursor: 0 });
        mock.queued.inputBox.push(' #urgent ');
        await onBulkTagItems();
        expect(h.lines()).toEqual(['> S', '>> - a #urgent']);
    });
});

describe('rename a tag in a section', () => {
    it('renames the tag in every item, in any case, and nothing else', async () => {
        const h = openEditor([
            '> S', '>> - one #to', '>> - two #TO', '>> 1. three #to', 'prose #to', '>> - keep #to-do',
        ], { cursor: 0 });
        mock.queued.quickPick.push('#to');
        mock.queued.inputBox.push('done-soon');
        await onRenameTagSection();
        expect(h.lines()).toEqual([
            '> S', '>> - one #done-soon', '>> - two #done-soon', '>> 1. three #done-soon', 'prose #to', '>> - keep #to-do',
        ]);
        expect(mock.recorded.info.at(-1)).toBe('CL: Renamed #to → #done-soon in 3 items');
    });

    it('accepts hyphenated names and a leading #', async () => {
        openEditor(['> S', '>> - a #x'], { cursor: 0 });
        mock.queued.quickPick.push('#x');
        await onRenameTagSection();
        const validate = mock.recorded.inputBoxCalls[0].validateInput;
        expect(validate('to-do')).toBeNull();
        expect(validate('#to-do')).toBeNull();
        expect(validate('two words')).toBe('Tag names can only contain letters, numbers, underscores and hyphens');
    });

    it('renameTagInText renames before punctuation but not inside longer tags', () => {
        expect(renameTagInText('#to, #to-do and #To.', 'to', '#done')).toBe('#done, #to-do and #done.');
    });
});

describe('Obsidian export', () => {
    const today = todayDate();

    it('writes items with one marker, keeping numbers and only leading checkbox and priority', () => {
        expect(convertToObsidian([
            '> S', '>> - [x] done #to-do', '>> 2. [ ] second', '>>> - !!! urgent @2026-01-02',
            '>> - array[x] here', '>> - wow!!! great', '>> - [X] upper',
        ], '-').split('\n')).toEqual([
            '---', `created: ${today}`, 'tags:', '  - to-do', '---', '',
            '## S', '- [x] done #to-do', '2. [ ] second', '  - 🔴 urgent 📅 2026-01-02',
            '- array[x] here', '- wow!!! great', '- [x] upper',
        ]);
    });

    it('puts the frontmatter at the top even when items come before the first header', () => {
        expect(convertToObsidian(['>> - loose #a', '> S', '>> - b'], '-').split('\n')).toEqual([
            '---', `created: ${today}`, 'tags:', '  - a', '---', '', '- loose #a', '', '## S', '- b',
        ]);
    });

    it('keeps tags from a file with no header', () => {
        expect(convertToObsidian(['>> - only #solo'], '-')).toContain('tags:\n  - solo\n---');
    });
});
