/**
 * Pure logic for sets: a markdown heading tagged `#set` makes the `> Sections`
 * under it the buckets of one group (Paid, Hasn't paid, Not going), so each
 * item belongs in exactly one of them. A set runs until the next heading of
 * the same or a higher level. No vscode imports. Mirrors Sets.kt in the
 * JetBrains plugin.
 */
import { isHeader, parseBullet, parseNumbered } from './patterns';
import { renumberLines } from './numberingRuns';
import type { DiagnosticIssue } from './diagnostics';

const SET_TAG              = /(?:^|\s)#set(?=\s|$)/i;
const SUBHEADING           = /^(#{1,6})\s+(.+)$/;
const CHECKBOX_MARK        = /^\[[ xX]?]\s*/;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

/** A `#set` heading and the header lines of the sections under it */
export interface ChevronSet { headingLine: number; sections: number[]; }

/** A target section's header line and name, as the move picker shows it */
export interface MoveTarget { header: number; name: string; }

function subheading(line: string): { level: number; content: string } | null {
    if (isHeader(line)) { return null; }
    const m = line.match(SUBHEADING);
    return m ? { level: m[1].length, content: m[2] } : null;
}

const isBoundary = (line: string): boolean => isHeader(line) || subheading(line) !== null;

/** Every `#set` heading in the document, with its sections */
export function findSets(lines: string[]): ChevronSet[] {
    const sets: ChevronSet[] = [];
    lines.forEach((line, i) => {
        const heading = subheading(line);
        if (!heading || !SET_TAG.test(heading.content)) { return; }
        const sections: number[] = [];
        for (let j = i + 1; j < lines.length; j++) {
            const next = subheading(lines[j]);
            if (next && next.level <= heading.level) { break; }
            if (isHeader(lines[j])) { sections.push(j); }
        }
        sets.push({ headingLine: i, sections });
    });
    return sets;
}

/** What two items must share to be the same member: case, a checkbox and end punctuation do not count */
export function setMemberKey(content: string): string {
    return content.replace(CHECKBOX_MARK, '').trim().replace(TRAILING_PUNCTUATION, '').trim()
        .replace(/\s+/g, ' ').toLowerCase();
}

function itemOf(line: string, prefix: string): { chevrons: string; content: string } | null {
    return parseNumbered(line) ?? parseBullet(line, prefix);
}

/** The top-level item lines of the section headed at `header`; nested notes and empty items are left out */
export function sectionMembers(lines: string[], header: number, prefix: string): number[] {
    const out: number[] = [];
    for (let i = header + 1; i < lines.length && !isBoundary(lines[i]); i++) {
        const item = itemOf(lines[i], prefix);
        if (item && item.chevrons.length === 2 && item.content.trim() !== '') { out.push(i); }
    }
    return out;
}

const chevronsOf  = (line: string): number => line.match(/^>*/)![0].length;
const sectionName = (lines: string[], header: number): string => lines[header].replace(/^>\s*/, '').trim();

/** Flags every item that is in a set more than once, naming where else it is */
export function collectSetDuplicates(lines: string[], prefix: string): DiagnosticIssue[] {
    const out: DiagnosticIssue[] = [];
    for (const set of findSets(lines)) {
        const where = new Map<string, { line: number; header: number }[]>();
        for (const header of set.sections) {
            for (const line of sectionMembers(lines, header, prefix)) {
                const key = setMemberKey(itemOf(lines[line], prefix)!.content);
                if (!where.has(key)) { where.set(key, []); }
                where.get(key)!.push({ line, header });
            }
        }
        for (const hits of where.values()) {
            if (hits.length < 2) { continue; }
            for (const { line } of hits) {
                const others = hits.filter(h => h.line !== line)
                    .map(h => `"${sectionName(lines, h.header)}" (line ${h.line + 1})`).join(', ');
                out.push({ line, message: `In this set more than once: also in ${others}`, kind: 'set-duplicate' });
            }
        }
    }
    return out;
}

/** The sections the item at `itemLine` can move to: its set's other lists, or every other section; empty when not a top-level item */
export function moveTargetsFor(lines: string[], itemLine: number, prefix: string): MoveTarget[] {
    if (itemOf(lines[itemLine] ?? '', prefix)?.chevrons.length !== 2) { return []; }
    let from = itemLine;
    while (from >= 0 && !isHeader(lines[from])) { from--; }
    if (from < 0) { return []; }
    const set     = findSets(lines).find(s => s.sections.includes(from));
    const headers = set ? set.sections : lines.flatMap((l, i) => isHeader(l) ? [i] : []);
    return headers.filter(h => h !== from).map(h => ({ header: h, name: sectionName(lines, h) }));
}

function renumberSection(lines: string[], header: number): void {
    let end = header + 1;
    while (end < lines.length && !isBoundary(lines[end])) { end++; }
    lines.splice(header + 1, end - header - 1, ...renumberLines(lines.slice(header + 1, end)));
}

/** `line` in the list type of the target's existing top-level items: numbered or bulleted */
function matchListType(line: string, lines: string[], target: number, prefix: string): string {
    const sibling = sectionMembers(lines, target, prefix)[0];
    const item    = itemOf(line, prefix);
    if (sibling === undefined || !item) { return line; }
    return parseNumbered(lines[sibling]) ? `${item.chevrons} 1. ${item.content}` : `${item.chevrons} ${prefix} ${item.content}`;
}

/**
 * The document with the top-level item at `itemLine`, and anything nested under
 * it, moved to the end of the section headed at `targetHeader`. It takes the
 * target's list type, and both sections are renumbered. Null when the line is
 * not a top-level item or the target is not one it may move to.
 */
export function computeMoveToSection(lines: string[], itemLine: number, targetHeader: number, prefix: string): string[] | null {
    if (!moveTargetsFor(lines, itemLine, prefix).some(t => t.header === targetHeader)) { return null; }
    let fromHeader = itemLine;
    while (!isHeader(lines[fromHeader])) { fromHeader--; }
    let end = itemLine;
    while (end + 1 < lines.length && chevronsOf(lines[end + 1]) > 2) { end++; }
    const rest   = [...lines];
    const block  = rest.splice(itemLine, end - itemLine + 1);
    const target = targetHeader > end ? targetHeader - block.length : targetHeader;

    // Land after the target's last item, before the blank lines that close it
    let insertAt = target + 1;
    for (let i = target + 1; i < rest.length && !isBoundary(rest[i]); i++) {
        if (chevronsOf(rest[i]) >= 2) { insertAt = i + 1; }
    }
    block[0] = matchListType(block[0], rest, target, prefix);
    rest.splice(insertAt, 0, ...block);
    renumberSection(rest, target);
    renumberSection(rest, insertAt <= fromHeader ? fromHeader + block.length : fromHeader);
    return rest;
}

/**
 * The totals shown after the `#set` heading at `headingLine`, such as
 * "23 Paid, 3 Hasn't paid, 3 Not going, 28 in all". "In all" counts each
 * member once, so a name in two lists is not counted twice. Null when the
 * line is not a set heading or the set has no sections.
 */
export function setSummary(lines: string[], headingLine: number, prefix: string): string | null {
    const set = findSets(lines).find(s => s.headingLine === headingLine);
    if (!set || set.sections.length === 0) { return null; }
    const members = set.sections.map(h => ({ header: h, items: sectionMembers(lines, h, prefix) }));
    const unique  = new Set(members.flatMap(m => m.items.map(i => setMemberKey(itemOf(lines[i], prefix)!.content)))).size;
    return members.map(m => `${m.items.length} ${sectionName(lines, m.header).replace(/\.+$/, '')}`).join(', ') + `, ${unique} in all`;
}
