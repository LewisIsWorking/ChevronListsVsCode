import { describe, it, expect } from 'bun:test';
import { buildKanbanHtml } from '../kanbanCommands';

describe('buildKanbanHtml', () => {
    it('escapes card text, section names and the file name', () => {
        const html = buildKanbanHtml([{ content: 'a < b & c', section: 'Q&A "<i>"', line: 1 }], [], [], '<x>.md');
        expect(html).toContain('a &lt; b &amp; c');
        expect(html).toContain('title="Q&amp;A &quot;&lt;i&gt;&quot;"');
        expect(html).toContain('<span class="sec">Q&amp;A &quot;&lt;i&gt;&quot;</span>');
        expect(html).toContain('&lt;x&gt;.md');
        expect(html).not.toContain('<i>');
    });
});
