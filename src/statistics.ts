import { isHeader, parseBullet, parseNumbered } from './patterns';
import { getSectionRange } from './documentUtils';
import { extractTags } from './tagParser';
import { parseCheck } from './checkParser';
import { parseColourLabel } from './colourLabelParser';
import { parseFlag } from './flagParser';
import { parseComment } from './commentParser';
import { parseCreatedDate } from './itemAgeParser';
import { parseWordCountGoal } from './wordGoalParser';
import type { LineReader } from './types';
import { itemWordCount } from './metadataStripper';

/** Statistics for a single chevron section */
export interface SectionStats {
    name:        string;
    itemCount:   number;
    wordCount:   number;
    lineIndex:   number;
    done:        number;
    total:       number;
    tagCount:    number;
    coloured:    number;
    flagged:     number;
    commented:   number;
    stamped:     number;
    wordGoal:    number | null;
}

/** Aggregated statistics for an entire document */
export interface FileStats {
    totalSections:  number;
    totalItems:     number;
    totalWords:     number;
    totalDone:      number;
    totalChecks:    number;
    totalTags:      number;
    totalColoured:  number;
    totalFlagged:   number;
    totalCommented: number;
    totalStamped:   number;
    avgItems:       number;
    mostPopulated:  SectionStats | null;
    leastPopulated: SectionStats | null;
    sections:       SectionStats[];
}

/** Computes statistics for all chevron sections in a document */
export function computeFileStats(doc: LineReader, prefix: string): FileStats {
    const sections: SectionStats[] = [];

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (!isHeader(text)) { continue; }

        const name      = text.replace(/^> /, '');
        const goal      = parseWordCountGoal(text);
        const [, end]   = getSectionRange(doc, i);
        let items = 0, words = 0, tags = 0, coloured = 0, flagged = 0, commented = 0, stamped = 0;
        let done = 0, total = 0;

        for (let j = i + 1; j <= end; j++) {
            const line    = doc.lineAt(j).text;
            const bullet  = parseBullet(line, prefix);
            const numbered = parseNumbered(line);
            const content  = bullet?.content ?? numbered?.content ?? null;
            if (!content) { continue; }
            items++;
            words     += itemWordCount(content);
            tags      += extractTags(content).length;
            if (parseColourLabel(content)) { coloured++; }
            if (parseFlag(content))        { flagged++; }
            if (parseComment(content))     { commented++; }
            if (parseCreatedDate(content)) { stamped++; }
            const check = parseCheck(content);
            if (check) { total++; if (check.state === 'done') { done++; } }
        }
        sections.push({ name, itemCount: items, wordCount: words, lineIndex: i,
            done, total, tagCount: tags, coloured, flagged, commented, stamped, wordGoal: goal });
    }

    const totalSections  = sections.length;
    const totalItems     = sections.reduce((s, c) => s + c.itemCount, 0);
    const totalWords     = sections.reduce((s, c) => s + c.wordCount, 0);
    const totalDone      = sections.reduce((s, c) => s + c.done, 0);
    const totalChecks    = sections.reduce((s, c) => s + c.total, 0);
    const totalTags      = sections.reduce((s, c) => s + c.tagCount, 0);
    const totalColoured  = sections.reduce((s, c) => s + c.coloured, 0);
    const totalFlagged   = sections.reduce((s, c) => s + c.flagged, 0);
    const totalCommented = sections.reduce((s, c) => s + c.commented, 0);
    const totalStamped   = sections.reduce((s, c) => s + c.stamped, 0);
    const avgItems       = totalSections > 0 ? totalItems / totalSections : 0;
    const sorted         = [...sections].sort((a, b) => b.itemCount - a.itemCount);

    return {
        totalSections, totalItems, totalWords, totalDone, totalChecks,
        totalTags, totalColoured, totalFlagged, totalCommented, totalStamped,
        avgItems, mostPopulated: sorted[0] ?? null,
        leastPopulated: sorted[sorted.length - 1] ?? null, sections,
    };
}
