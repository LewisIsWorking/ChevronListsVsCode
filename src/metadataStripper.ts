import type { LineReader } from './types';

/** Strips all known Chevron Lists markers from item content, leaving plain text */
export function stripAllMetadata(content: string): string {
    // Each marker is stripped only where its PARSER recognises it. Previously the
    // position-sensitive markers were stripped anywhere, which ate ordinary prose:
    //   "Why? Because"  -> "WhyBecause"   (flag)
    //   "Wow!! amazing" -> "Wowamazing"   (priority)
    //   "C++11 rocks"   -> "C+ rocks"     (vote)
    //   "5 * 3 = 15"    -> "5 3 = 15"     (star)
    // and stripped text the rest of the extension does not treat as metadata at
    // all (a mid-sentence "!!!" is never a priority to parsePriority).
    //
    // Leading markers follow the parsers' own order: checkbox, then priority,
    // then star or flag -- the same sequence previewItemCommands applies.
    let s = content.trim();
    s = s.replace(/^\[(?:x| ?)\]\s*/i, '');         // checkbox      (CHECK_RE, start)
    s = s.replace(/^!{1,3} +/, '');                 // priority      (PRIORITY_RE, start)
    s = s.replace(/^\* +/, '');                     // star marker   (STAR_RE, start)
    s = s.replace(/^\? +/, '');                     // flag marker   (FLAG_RE, start)
    // Votes are only recognised at the very end, so strip them before the comment:
    // in "idea +5 // note" the +5 is not at the end and parseVote ignores it.
    s = s.replace(/\s*\+\d+\s*$/, '');              // votes         (VOTE_RE, end)
    s = s.replace(/(?:^|\s+)\/\/.*$/, '');          // inline comment (COMMENT_RE; not URLs)
    // These parsers match anywhere in the content.
    s = s.replace(/#[\w-]+/g, '');                  // tags
    s = s.replace(/@\d{4}-\d{2}-\d{2}/g, '');       // due dates
    s = s.replace(/@created:\d{4}-\d{2}-\d{2}/g, ''); // creation dates
    s = s.replace(/@(?:daily|weekly|monthly)/g, ''); // recurrence
    s = s.replace(/~\d+h(?:\d+m)?/g, '');           // time estimates (hours)
    s = s.replace(/~\d+m/g, '');                    // time estimates (minutes)
    s = s.replace(/\{(?:red|green|blue|yellow|orange|purple)\}\s*/g, ''); // colour labels
    s = s.replace(/~~(.+?)~~/g, '$1');              // strikethrough (keep text)
    s = s.replace(/\[\[[\w\s]+\]\]/g, '');          // section links
    s = s.replace(/\[\[file:[^\]]+\]\]/g, '');      // file links
    s = s.replace(/\s{2,}/g, ' ').trim();
    return s;
}
