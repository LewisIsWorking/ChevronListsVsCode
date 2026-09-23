# Chevron Lists - Syntax Reference

Full reference for all markers, section syntax, and nesting rules.

## Nesting Levels

```markdown
> Section header                  ← depth 0 (header only)
>> - Item                         ← depth 1 (standard item)
>>> - Nested item                 ← depth 2
>>>> - Deep item                  ← depth 3
```

The `>>` prefix is the minimum for items. Any number of `>` characters above 2 works.

## Item Types

### Bullet Items
```
>> - Content here
>> * Content here
>> • Content here
```
Prefix character is configured via `chevron-lists.listPrefix` (default `-`).

### Numbered Items
```
>> 1. First step
>> 2. Second step
>> 3. Third step
```
**Enter** after a numbered item auto-increments. **Tab** promotes depth.

## Item Markers (all optional, combinable)

### Checkboxes
```
>> - [ ] Unchecked task
>> - [x] Completed task
>> - []  Also treated as unchecked
```

### Priority
```
>> - ! Low priority       ← yellow background
>> - !! Medium priority   ← amber background
>> - !!! High priority    ← red background
```

### Tags
```
>> - Deploy the thing #backend #urgent
```
Tags are autocompleted from existing tags in the file, sorted by frequency.

### Due Dates
```
>> - Fix the bug @2026-04-15
>> - Daily standup @daily
>> - Weekly review @weekly
>> - Monthly report @monthly
```
Items past their date trigger the `⚠ N overdue` status bar indicator.
Items within 3 days show `⏰ due soon` ghost text.

### Time Estimates
```
>> - Write tests ~2h
>> - Fix typo ~15m
>> - Large refactor ~1h30m
```
`CL: Show Section Time Estimate` sums all estimates in a section.

### Votes
```
>> - Great idea +5
>> - Less popular idea +1
```
`CL: Sort by Votes` and `CL: Show Vote Leaderboard (Section)` use this.

### Ratings
```
>> - ★3 Good approach
>> - ★5 Perfect solution
```

### Section Links
```
>> - See [[Act Two]] for details
>> - See [[file:notes.md]] for context
>> - See [[file:notes.md#Section]] for specifics
```
Hover shows a preview of the linked section's top 5 items.

### Colour Labels
```
>> - {red} Blocked item
>> - {green} Ready to go
>> - {blue} In progress
>> - {yellow} Needs review
>> - {orange} Waiting on external
>> - {purple} Nice to have
```

### Square Bracket Labels
```
>> - [ACTION] Do the thing
>> - [BLOCKED] Waiting on Alice
>> - [REVIEW] Ready for review
```
Labels render in gold in the editor.

### Inline Comments
```
>> - Deploy to prod // check DNS config first
```
Comment portion renders muted/italic.

### Question Flag
```
>> - ? Is this the right approach?
```

### Star Marker
```
>> - * Key deliverable this week
```

### Strikethrough
```
>> - ~~Cancelled approach~~
```

### Expiry Date
```
>> - Limited offer @expires:2026-12-31
```
Expired items appear in the Problems panel.

### Creation Date (auto-stamped)
```
>> - Idea @created:2026-03-27
```
Items 30+ days old render muted and italic.

## Section Header Syntax

```markdown
> Section Name
> Section with Goal ==500
> Section ==500 [colour:purple]
```

| Modifier | Example | Effect |
|---|---|---|
| `==N` | `> Docs ==500` | Word count goal, shown as progress bar |
| `[colour:X]` | `> Chapter ==200 [colour:blue]` | Header renders in that colour |

## Section-Level Markers (items, not headers)

```markdown
>> -- Group Name          ← named group divider
>> > Note text            ← inline note
>> [bookmark:Key Scene]   ← named bookmark
>> [hidden]               ← hidden section marker
>> [locked]               ← lock (warns on save)
>> [frozen]               ← freeze marker
>> >>depends:Phase One    ← dependency marker
```

## Combining Markers

All markers are additive and order-independent:

```markdown
>> - !!! [x] Fix critical auth bug #backend @2026-04-01 ~2h @Alice +3
```

This single item has: urgent priority, done state, tag, due date, estimate, mention, and vote count.
