# Changelog

## [26.7.0] - 2026-09-21
A large bug-fix release. Every fix below has a regression test that fails on the old code.

### Added
- **Pasting several lines into an item puts each line on its own item.** Paste a chat log or an e-mail into `>> 1. ` and every non-blank line becomes an item at the same depth: numbered items keep counting (and the items after them are renumbered), bullets use your prefix. Indentation is trimmed and a line that is already a chevron item keeps only its text. It is the default paste inside an item; the paste widget still offers plain text, and `chevron-lists.pasteLinesAsItems` turns it off. Needs VS Code 1.97 or later; older versions paste as before.

### Fixed
**Editing items and sections**
- Commands that add a line after an item (clone, duplicate, notes, paste, lock/freeze/hide markers, AI suggestions and more) glued the new text onto the last line of a file with no trailing newline. The lock, freeze and hide markers renamed the section header.
- "Add to the end of the section" commands (quick capture, clone or move to section, move to bottom, archive) put the item after the blank line before the next header, detached from its list.
- Deleting the last line of a file left an empty line behind.
- New Section, Insert Table of Contents and Paste as Section inserted a header at the cursor, so the items below the cursor silently moved into the new section.
- Several commands lost the cursor's place after an edit; Focus Section moved the cursor away from where it was.
- Move Item to File deleted the item even when adding it to the other file failed.
- Edit Item Content silently discarded the edit whenever a tag or date sat among the words, and could rename a tag instead of a word.
- Set Item Colour, Strikethrough, Set Due Date, Quick Note and voting moved each other's markers: a colour label before the checkbox hid it, strikethrough wrapped the checkbox, a date or note after a vote hid the vote, and a vote on an item with a comment went inside the comment.

**Numbered lists**
- The children of two different items were numbered as one list. Numbering warnings flagged correctly restarted sub-lists, and auto-fix numbering (on by default) renumbered them as you typed; Renumber, Rebase, Set List Start and Convert Bullets did the same.
- The numbering quick fix changed the wrong item ("change 2 to 2") and fixed nothing.
- Duplicating or cloning a numbered item repeated its number, and put the copy between the item and its children.
- Offset List Numbers applied an offset to some items and skipped the rest; Duplicate and Increment could change a date instead of a step number.

**Tags, mentions, words and dates**
- Dates were a day early outside UTC; a monthly recurrence from the 31st skipped a month; item age was off by one across a clock change.
- A URL fragment (`page#section`) was treated as a tag and cut out of the URL, and a URL's `//` was treated as a comment. `#to-do` was the tag "to" in several features.
- `@daily`, `@weekly`, `@monthly`, `@created:` and e-mail addresses were listed as people; `@Mary-Jane` was cut to "Mary".
- Word counts included markup such as `[ ]` and `#tags`, differed between features, and said "1 words". "1 days", "1 items" and similar are fixed throughout.
- Rename Tag (section) skipped items and rewrote longer tags; Bulk Tag skipped items containing a longer tag.

**Exports, reports and views**
- Obsidian, Markdown and Copy Section As exports dropped item numbers; the Obsidian export wrote `- - [x]` and put its frontmatter mid-file.
- Template import dropped nested items and broke on `$` or `}`; template export wrote headers twice.
- Tag Stats, Mentions Report, Item Age Report and Section Growth displayed `<`, `&` and quotes as markup; the statistics CSV broke on quotes in section names.
- Colour presets never switched semantic highlighting on for markdown, and left a stray key in your settings.
- The Template Gallery could insert the wrong template, or nothing, when a card was clicked.
- Reading Mode, reused for another file, jumped back to the first file whenever that one was edited.
- Item snippets defaulted to a due date in the past.

## [26.6.0] - 2026-09-06
### Fixed
- **Diagnostics were retained for every markdown file opened in a session.** All four `DiagnosticCollection`s (`chevron-lists`, `chevron-lists-dates`, `chevron-lists-wordgoals`, `chevron-lists-expiry`) called `.set(uri, ...)` on each refresh but never released the entry when the document closed — `onDidCloseTextDocument` only cleared jump history. A `DiagnosticCollection` is a strong URI-keyed map owned by the extension host, so each file kept four `Diagnostic[]` arrays alive until the window was reloaded. Closing a document now clears all four via the new `diagnosticCleanup` / `diagnosticSinks` pair. This is the leak the 26.4.2 audit missed.
- **Two diagnostic collections were never disposed.** The collections in `diagnosticProvider.ts` and `expiryDiagnostics.ts` are created at module scope and were never added to `context.subscriptions`, so they outlived the extension across reloads. Both are now registered in `activate`.
- **`onDidCloseTextDocument` was registered twice** — once in `extension.ts` and again in `commandRegistrationsB.ts` — so every document close ran the jump-history cleanup twice. The duplicate registration is removed.

### Performance
- **The full decoration/diagnostic refresh is now debounced by 150ms.** `refreshEditor` runs 21 separate full-document passes (17 decoration updates, 4 diagnostic updates), each with its own `for (i = 0; i < lineCount; i++)` loop. It was wired directly to `onDidChangeTextDocument`, so a single keystroke in a 500-line file allocated ~10,500 line objects plus the Range arrays for every pass. Keystroke bursts now collapse into one pass after typing pauses. Switching editors still refreshes immediately; only text edits are debounced. A pending refresh is cancelled on deactivate.

### Notes
- The 812-test suite covers pure logic only — no tested module imports `vscode`, and `bunfig.toml`'s `[test.moduleNameMapper]` is a Jest key that Bun does not honour, so the mock has never actually resolved. This is why every leak above lives in the untested VS Code integration layer. The new cleanup logic is split into a pure `diagnosticSinks.ts` core (5 new tests) following the same pure-core / thin-bridge split as `patterns.ts`.

## [26.5.0] - 2026-05-21
### Fixed
- **`autoFixNumbering` listener could die silently**. If `applyEdit` threw mid-fix (e.g. file closed during the async operation), the internal `isApplyingFix` flag stayed `true` forever, disabling auto-fix until VS Code restart. The fix is now wrapped in `try/finally` so the flag always resets, plus a `console.warn` for diagnostics.
- **`sectionCollapseMemory` accumulated stale workspace state keys forever**. Every markdown file ever opened added a permanent entry; deleting or renaming a file orphaned its key. Now listens to `onDidDeleteFiles` to drop keys for removed files, and `onDidRenameFiles` to migrate state to the new path.
- Removed dead `saveFoldState` export from `sectionCollapseMemory.ts` — it was unused and only re-saved the existing value.

### Performance
- **`autoFixNumbering` now debounces edits by 250ms** before scanning. Previously every keystroke triggered a full document scan + per-line allocation; on a 1000-line file that meant ~1000 short-lived objects allocated per keystroke. The debounce collapses keystroke bursts into a single scan after the user pauses, eliminating the GC churn that may have manifested as memory pressure during heavy editing.

## [26.4.2] - 2026-05-17
### Fixed
- **Jump-history map cleanup**. The per-file jump history map (`jumpHistory.ts`) accumulated one entry per markdown file opened during the session and never released them. Now wired to `onDidCloseTextDocument` so closed files free their entry immediately.
- **Section timer status bar item leak**. `onStopSectionTimer` called `statusBarItem.hide()` instead of `.dispose()`, keeping a `StatusBarItem` allocated for the rest of the extension lifetime. Now properly disposed and recreated on next start.

### Audit notes
- Audited every `*Decoration*.ts` file for `createTextEditorDecorationType` inside update functions — only `heatMapDecoration.ts` had the per-keystroke leak (fixed in 26.4.1).
- Verified all event listeners go through `context.subscriptions`, all webview panels use the singleton + `onDidDispose` pattern, all `setInterval` calls have matching `clearInterval`, and module-level `Map`/`Set` caches are bounded.

## [26.4.1] - 2026-05-17
### Fixed
- **Memory leak in heat-map decorations**. `updateHeatMapDecorations` was creating 11 new `TextEditorDecorationType` objects on every keystroke (10 intensity buckets + 1 "throwaway" type that didn't actually clear anything). Typing 1000 characters leaked ~11,000 native rendering handles. The decoration types are now created once at module load and reused across all editors and refreshes — zero per-keystroke allocation.
- Removed a smaller related leak in `decorationToggles.ts` where toggling a decoration off created a fresh useless decoration type. The bogus code never actually cleared anything either; the disabled-decorations-not-clearing UX issue is now documented in a comment for a proper future fix.

## [26.4.0] - 2026-05-17
### Changed
- The `chevron-lists.defaultNewListType` setting now displays **Bullet list (>> -)** and **Numbered list (>> 1.)** in the dropdown instead of the raw values `unordered` / `ordered`. Stored values are unchanged so existing settings keep working. This change propagates back from the JetBrains plugin where the same UX improvement was identified.

## [26.3.2] - 2026-04-22
### Added
- Duplicate `##` markdown subheadings (and `###`, `####` etc.) now get the same warning underline as duplicate `> ` chevron headers. The hover message shows the subheading text and the line number of the first occurrence.

## [26.3.1] - 2026-04-22
### Fixed
- `autoFixNumbering` was incorrectly treating numbered lists across different section headers as one continuous sequence. Lists in separate sections now renumber independently.

## [26.3.0] - 2026-04-20
### Added
- `CL: Open Settings` — a webview panel with two tabs: **Settings** (all configuration options as proper UI controls with real-time writes) and **Commands** (all 300+ CL commands grouped by category, clickable to run without touching the command palette). Opens automatically on first install with a welcome message. `colourPreset` and `anthropicApiKey` are now part of `ChevronConfig` so all settings flow through a single config read.

## [26.2.0] - 2026-04-20
### Changed
- `chevron-lists.autoFixNumbering` now defaults to `true`. Duplicate or out-of-sequence numbered items (e.g. two `>> 2.` lines) are fixed automatically as you type. The setting is now also properly declared in `package.json` so it appears in VS Code's settings UI.

## [26.1.0] - 2026-04-19
### Added
- New setting `chevron-lists.defaultNewListType` (`unordered` / `ordered`). When set to `ordered`, pressing Enter on a `> Header` line now inserts `>> 1.` as the first item instead of `>> -`. Subsequent Enter presses continue the sequence as normal (`>> 2.`, `>> 3.` etc.). The existing `listPrefix` setting is unaffected — it still controls bullet continuation for unordered lists.

## [26.0.0] - 2026-03-27
### Changed
- Sub-group progress bars on numbered items now require children to be at one deeper chevron level (`>>> -`) rather than just any same-depth checkbox. This makes sub-groups opt-in via Tab indent — no false positives on regular numbered lists that happen to mix with bullet items.

**To use:**
```markdown
>> 1. Character tokens.    ▓▓▓░░░ 3/6
>>> - [X] Ger.
>>> - [X] Atticus.
>>> - [X] Nariya.
>>> - [] Mr Serious.
```
Use Tab on the `>> -` lines to promote them to `>>> -`.

## [25.9.0] - 2026-03-27
### Added
- Numbered items (`>> 1.`, `>> 2.` etc.) that have checkbox sub-items now show their own 6-block mini progress bar inline — distinct from the 10-block section bar. Works automatically when numbered items are used as group headers within a section.

## [25.8.0] - 2026-03-27
### Added
- `CL: Toggle Focus Mode` — dims all sections except the one the cursor is in; toggle again to restore. Updates live as you move the cursor.
- `CL: Insert Group Divider` — prompts for a name and inserts a `>> -- Name` group divider below the cursor line
- `CL: Copy Section as HTML` — copies the section as a rich HTML snippet (checkboxes, priority emoji, nested indentation) ready to paste into docs or email
- `CL: Show Priority Summary` — jump-to quick pick of all `!`/`!!`/`!!!` items across the file, grouped by urgency level with separator headers

## [25.4.0] - 2026-03-27
### Added
- `CL: Duplicate Section to File` — copies the current section (header + all items) into any other markdown file in the workspace
- `CL: Show Item Age Report` — webview showing all items with `@created:` dates, sorted oldest first with red/amber/green age colouring
- Section collapse memory — fold state for sections is remembered between sessions and restored when the file reopens (uses `>> -- Name` group markers)
- `CL: Copy Item as Markdown` — copies the item at cursor as standard markdown: checkboxes, priority emoji, bold tags, proper indent for nested items

## [25.0.0] - 2026-03-27
### Changed
- README: updated to 749 tests · 66 test files · 250 commands (was stale 725/731/300+)
- ARCHITECTURE.md: updated to v24.9.0 counts — 251 source modules, 66 test files, 749 unit tests, 250 commands, ~268KB bundle
- docs/commands.md: updated command count heading
- package.json: bumped to 25.0.0; all counts now accurate after 53-duplicate removal

## [24.9.0] - 2026-03-27
### Added
- Tips now display the relevant keybinding inline (e.g. `[Ctrl+Alt+Down / Ctrl+Alt+Up]`) where one exists; 4 new tips added (jump sections, toggle note, word count goals, rich text)
- `CL: Show Word Count Goals` — quick pick of all `==N` goal sections with progress bar, %, and words remaining; sorted by furthest from target; press Enter to jump
- `{colour}` label on an item now also tints the bullet `-` or number `N.` prefix in that same colour, making colour-coded items more visually distinct

## [24.5.1] - 2026-03-27
### Fixed
- Removed 53 duplicate command registrations in `package.json` that had accumulated across phases — no user-facing behaviour change, but reduces extension manifest size
- ROADMAP: marked v24.2–24.6 as ✅ (all were already built and shipped)

## [24.5.0] - 2026-03-27
### Fixed
- Section summary no longer shows `▁▁▁▁ 0 done` on sections with no checkbox items — the sparkline and done count only appear when at least one `[ ]` or `[x]` item exists
- Bullet prefix `-` now renders in the same lime/green colour as numbered `1.` — previously it was grey (slate) like the `>>` chevrons


## [24.4.0] - 2026-03-27
### Added
- `CL: Bold Text` / `CL: Italic Text` / `CL: Mono Text` / `CL: Strikethrough Text` — smart toggles that wrap the selection (or word at cursor) in `**`, `_`, backtick, or `~~`; applying again unwraps
- `CL: Underline Text` — applies Unicode combining low line (U+0332) to simulate underline in plain text — toggles off if already applied
- `CL: Text Transform` — unified quick pick for all text transforms: Bold, Italic, Underline, Mono, Strikethrough, UPPERCASE, lowercase, Title Case
- `docs/marketing/` folder — ready-to-post drafts for Reddit, Hacker News, awesome-vscode PR, and a full dev.to article
- ROADMAP: marketing tasks M1–M5 added; all stale ⬜ entries corrected to ✅

## [24.1.0] - 2026-03-27
### Added
- `CL: Show Tip of the Day` — rotating tips on activation with Try It / Next Tip / Dismiss; re-enable at any time
- VS Code Walkthrough ("Get Started with Chevron Lists") — 5-step onboarding that appears in the Welcome tab
- `docs/` folder — `syntax.md`, `settings.md`, `contributing.md`, `commands.md` technical reference
- `walkthroughs/` folder — step-by-step markdown content for the walkthrough
### Changed
- `package.json`: gallery banner (deep indigo), repository + bugs links, `CL: Show Tip of the Day` command
- README updated to reference `docs/` for technical detail

## [24.0.0] - 2026-03-26
### Added
- `CL: Group Items by Mention` — groups section items into `>> -- Name` sub-groups by `@mention`, great for delegation views
- `CL: Show Section Path` — shows section name, line position, item count and word count as a quick orientation message
- `⏰ due soon` / `⚠ overdue` inline ghost text on items due within 3 days or already past their date
### Changed
- Marketplace: added 28 search keywords, 3 extra categories (`Notebooks`, `Other`, `Formatters`)
- README completely rewritten with value-first framing, use-case table, and "Who Uses This?" section
- package.json description updated to sell the extension's full value

## [23.6.0] - 2026-03-26
### Added
- `CL: Count Word Frequency` — shows top 10 most-used words across section items, filtering stop words
- `CL: Show Vote Leaderboard (Section)` — section-scoped `+N` vote ranking as a jump-to quick pick
- `⚠ N overdue` persistent status bar item — shows overdue item count in the active file at a glance, clicking opens Today View
- `@mention` autocomplete now suggests names already used in the current file (was already implemented via `ChevronMentionCompletionProvider`)

## [23.2.0] - 2026-03-26
### Added
- `!!!` / `!!` / `!` priority items now get faint red / amber / yellow background decorations in the editor
- `>> [locked]` marker in a section warns before save and offers to unlock — opt-in section protection
- After pressing Enter on a section header, VS Code's suggestion widget opens automatically so you can immediately type a tag or pick a completion
### Changed
- README test count updated to 725 / 63 test files
- ARCHITECTURE.md updated with current module layout and counts

## [22.8.0] - 2026-03-26
### Added
- `CL: Filter by Multiple Tags` — multi-select tag picker with AND/OR logic; shows matching items as a jump-to quick pick
- `CL: Extract URLs from Section` — collects all URLs from the current section and presents them as a clickable list
- `CL: Clone Section` — duplicates the entire section below itself with a `(copy)` suffix on the header

## [22.4.0] - 2026-03-26
### Added
- `CL: Convert Item to Section Link` — replaces the cursor item with a `[[SectionName]]` link if a matching section exists in the file
- Sections with 2+ `!!!` items automatically get a red tint in the left overview ruler — a live urgency signal
- `CL: Change Item Prefix` — changes the bullet prefix (`-`, `*`, `•`) on all items in the current section at once
- `CL: Show Section Growth` — webview bar chart of item count per section, sorted descending

## [22.0.0] - 2026-03-26
### Added
- `CL: Show Nesting Breakdown` — info message showing item count at each chevron depth in the current section
- `CL: Rename Tag (Section)` — renames a `#tag` within the current section only, without touching the rest of the file
- `CL: Show Section Time Estimate` — sums all `~Nh`/`~Nm` estimate markers in the section and shows the total
- `CL: Send to Daily Note` — copies the cursor item to today's daily note under `> Inbox`

## [21.6.0] - 2026-03-26
### Added
- Section summary ghost text now shows a mini sparkline `▁▃▅▇░` representing completion ratio
- Section summary ghost text now shows `N old` count for items with `@created:` dates 30+ days old
- `CL: Quick Stats` — single-line info message with items, done %, words, tags, overdue count for the cursor section
- `CL: Insert Date Stamp` — inserts `@YYYY-MM-DD` (today) at the cursor position within an item

## [21.2.0] - 2026-03-26
### Added
- `CL: Sort by Due Date` — sorts items in the current section by `@YYYY-MM-DD` ascending; undated items go last
- `CL: Copy Section as CSV Row` — copies section items as a single comma-separated row for pasting into spreadsheets
- `CL: Wrap Item Text` — splits item content at cursor position into two continuation lines with matching prefix
- `chevron-lists.escalateOverdue` setting (default `false`) — when on, items overdue by 7+ days automatically gain `!!!` priority on save

## [20.8.0] - 2026-03-26
### Added
- `CL: Batch Replace Text` — find/replace plain text across all items in the current section with a preview count before applying
- Word goal nudge — `📝 N words to go` status bar item appears when the cursor is in a section below its `==N` goal
- Sticky header — when scrolled deep into a section, the section name appears as a subtle prefix on the first visible item so you always know where you are
- `CL: Show Mentions Report` — webview table of every `@Name` mention in the file with item count, done count, and completion % bar

## [20.4.0] - 2026-03-26
### Added
- `CL: Show Item Complexity` — scores the item at cursor by marker density (priority, tags, estimate, due date, expiry, vote, label) with a visual bar
- `CL: Freeze Section` / `CL: Unfreeze Section` — marks a section with `>> [frozen]`; warns before edits
- `CL: Evaluate Expression in Item` — finds the first `=expr` pattern in the item, evaluates it as a math expression, and replaces it with the result
- `CL: Show Archive` — quick pick of all items in the `> Archive` section with jump-to-line

## [20.0.0] - 2026-03-26
### Added
- Section headers with `[colour:X]` tags now render in that colour in the editor (red, green, blue, yellow, orange, purple)
- `[[SectionLink]]` hover now shows a rich preview of the linked section's top 5 items with checkbox states
- `CL: Show Tag Stats` — webview table of every `#tag` with item count, done count, and completion % bar
- `CL: Toggle Done (All Cursors)` — toggles checkbox state on every cursor's item simultaneously
- `CL: Set Priority (All Cursors)` — sets the same priority on every cursor's item at once

## [19.6.0] - 2026-03-26
### Added
- `CL: Start Focus Timer` / `CL: Stop Focus Timer` — configurable countdown (default 25 min) shown in the status bar; pings when complete. Set duration via `chevron-lists.focusTimerMinutes`
- Section heat map — overview ruler markers coloured by section weight; heavier sections glow brighter in the minimap
- `CL: Mark All Done (Section)` / `CL: Mark All Undone (Section)` — bulk checkbox toggle scoped to the current section only
- `CL: Snapshot Item` — stores the item content at cursor; `CL: Diff Item with Snapshot` — shows a word-level before/after diff in a side panel
- `CL: Smart Paste` — detects numbered lists, bullet lists, or plain lines in the clipboard and converts to the correct chevron format automatically
- `CL: Show Reading Time` — estimates reading time for the current section or file at 200 wpm

## [19.0.0] - 2026-03-26
### Added
- `@expires:` items now appear in the Problems panel with a warning squiggle — quick fixes: `CL: Extend expiry by 7 days`, `CL: Extend expiry by 30 days`, `CL: Remove expiry date`
- Section summary ghost text now shows `· N urgent` when `!!!` priority items are present
- `CL: Today View` — workspace-wide quick pick of every item due today or overdue, sorted by days overdue, jump-to-line on accept
- `CL: Show Kanban` — webview with three columns: ☐ Todo / ⭐ In Progress (starred `*` items) / ✓ Done
- `CL: Export to Obsidian` — converts the current file to Obsidian-compatible markdown: `##` headings, YAML frontmatter with tags, `[[wikilinks]]`, emoji markers for priority/dates
- `CL: Start Item Timer` / `CL: Stop Item Timer` — stopwatch on the cursor item shown in the status bar; stamps `~elapsed` on stop

## [18.4.0] - 2026-03-26
### Changed
- Default colour theme updated to **violet headers · lime numbers · slate prefixes** — matching the extension icon
- Previous default (amber/blue) preserved as a new named theme: **Classic**
- `CL: Switch Colour Preset` renamed to `CL: Colour Theme` in the command palette

## [18.3.0] - 2026-03-26
### Added
- `chevron-lists.autoFixNumbering` setting (default `false`) — when enabled, automatically re-sequences numbered items at the same depth after an edit, so inserting a duplicate number cascades the rest forward. Defaults to **off** to preserve intentional custom start numbers and non-sequential lists.
- `CL:` prefix on all quick-fix actions in the Problems panel lightbulb menu — makes it clear at a glance which fixes come from Chevron Lists
### Changed
- Extension icon updated — violet/lime/slate palette replacing the previous amber/teal scheme

## [18.2.0] - 2026-03-26
### Added
- Extension icon — dark slate background with nested chevron rows in amber/teal/muted colours, representing the `>`, `>>`, `>>>` nesting hierarchy

## [18.1.0] - 2026-03-26
### Fixed
- `[]` (no space) now correctly counts as a to-do item, same as `[ ]` — affects status bar completion count, checklist progress bar, diagnostics, and all commands that use checkbox state
- `[]` normalises to `[ ]` on first toggle, then cycles `[ ]` ↔ `[x]` as normal

## [18.0.0] - 2026-03-26
### Added
- `CL: Sort by Priority` — sorts items within a section `!!!` → `!!` → `!` → none
- `CL: Archive Old Done Items` — archives `[x]` items with `@created:` dates older than N days
- `CL: Find Dead Links` — scans all workspace files for broken `[[section]]` and `[[file:]]` links
- `CL: Add Quick Note to Item` — prompts and appends `// comment` to the cursor item
### Fixed
- Item count badge now defaults to **off** — section summary already shows the item count, eliminating the duplicate `(20)  (20 items)` display
### Internal
- `patterns.ts` split into `patterns.ts` + `patternsUtils.ts` to stay under 200 lines

## [17.9.0] - 2026-03-20
### Added
- `CL: Sort by Priority` — sorts items in the current section by priority level descending (`!!!` → `!!` → `!` → none)
- `CL: Archive Old Done Items` — moves `[x]` items with `@created:` dates older than N days to `> Archive`
- `CL: Find Dead Links` — scans all `[[SectionName]]` and `[[file:name.md]]` links and reports those pointing to non-existent targets
- `CL: Add Quick Note to Item` — prompts for a note and appends it as `// comment` to the item at cursor

## [17.5.0] - 2026-03-20
### Added
- `Ctrl+Alt+N` keybinding for `CL: Toggle Note` — adds/removes `>> > Note` below the cursor item
- `CL: Compare Two Sections as Table` — picks two sections and opens a side-by-side Markdown table
- `CL: Insert Recurring Item` — quick pick of 6 pre-built recurring patterns (daily standup, weekly review, etc.) with correct `@daily/weekly/monthly` markers
- `CL: Rename Section (Workspace)` — renames a section and updates all `[[links]]` across every workspace markdown file

## [17.1.0] - 2026-03-20
### Added
- `CL: Show Age Stats` — oldest, newest, and average age of `@created:` stamped items in the current section
- `CL: Set Section Colour` — tags the section header with `[colour:X]` and renders it in that colour token
- `CL: Stamp All Items` — adds `@created:today` to every unstamped item in the section at once
### Improved
- Status bar tooltip now shows full stats with completion % and links to statistics panel

## [16.7.0] - 2026-03-20
### Added
- `CL: Show Word Cloud` — proportionally-sized SVG word cloud for the most frequent words in the current section
- `CL: Set Due Date` — natural-language date input on the item at cursor: ISO, weekday names, `+7`, `today`, `next week`, `next month`
- `CL: Find Similar Sections` — Levenshtein similarity flags section name pairs that may be duplicates
- `CL: Show Vote Leaderboard` — all `+N` voted items across the file sorted by vote count descending

## [15.9.0] - 2026-03-20
### Added
- `CL: Group Items by Tag` — clusters items in the section by primary `#tag`, inserting `// #tag` divider lines between groups
- `CL: Show Progress Report` — opens a side panel with per-section summary: items, done/total %, words/goal, flagged, overdue
- `CL: Merge Item with Next` — joins the item at the cursor with the item below it, separated by ` — `
- `CL: Split Item at Cursor` — splits the item at the cursor position into two separate items

## [15.5.0] - 2026-03-20
### Added
- **Smart Tab for autocomplete** — Tab now confirms the suggestion widget if open, falling through to indent only when it's not
- `CL: Copy Item as Rich Text` — converts marker syntax to readable symbols (✓/☐, 🔴/🟠/🟡, ⭐, ❓) before copying
- `CL: Show Dependency Graph` — webview SVG graph of all `>>depends:` relationships in the file
- `CL: Set Expiry on All Items` — sets `@expires:YYYY-MM-DD` on every item in the current section at once

## [15.1.0] - 2026-03-20
### Added
- `CL: Toggle Section Summary` / `CL: Toggle Checklist Progress Bar` / `CL: Toggle Word Goal Bar` / `CL: Toggle Age Highlight` / `CL: Toggle All Decorations`
- `CL: Filter by Colour Label (Workspace)` — cross-file colour filter
- `@expires:YYYY-MM-DD` syntax + `CL: Show Expired Items`
- `CL: Browse Templates` — webview gallery with preview and one-click insert

## [14.7.0] - 2026-03-20
### Added
- **Section Summary Decoration** — live `(N items · N done · N tags)` ghost text after every header
- **Checklist Progress Bar** — live `▓▓▓░░ N/N` bar on headers with checkbox items (red/amber/green)
- `CL: Export All Sections as JSON` — full file export to JSON on disk
- `CL: Rewrite Item (AI)` — Claude rewrites item content, all markers preserved

## [14.3.0] - 2026-03-20
### Added
- `chevron-lists.dailyNoteTemplate` setting with `{{date}}`, `{{weekday}}`, `{{day}}` placeholders
- `CL: Copy Section As…` — Markdown, Plain Text, JSON, CSV, HTML in one quick pick
- **Item Age Highlight** — items with `@created:` dates 30+ days old rendered muted/italic
- `CL: Bulk Set Rating` — sets `★N` on every item in the section at once

## [13.9.0] - 2026-03-20
### Added
- **Overdue count badge** — `⚠ N overdue` in status bar; click opens `CL: Show Upcoming`
- `CL: Copy Section as JSON` — full structured JSON with all parsed marker data
- `CL: Move Item to File` — moves item to any section in any workspace file
- `CL: Open Daily Note` — opens/creates `YYYY-MM-DD.md`; `chevron-lists.dailyNotesFolder` setting

## [13.5.0] - 2026-03-20
### Added
- **Rating autocomplete** — `★` triggers `★1`–`★5` with star previews
- `CL: Show Section Weights` — ranks sections by composite score (items×3 + priority + votes + tags)
- `CL: Shift All Due Dates` — shifts every `@date` in section by ±N days
- `CL: Show Completion Streak` — sections where all checkboxes are done

## [13.1.0] - 2026-03-20
### Added
- `CL: Filter by Colour Label` — grouped colour quick pick with counts
- `CL: Pin Section to Top` — moves section to first position
- `★N` star rating syntax (1–5) + `CL: Set Item Rating` + `CL: Filter by Rating`
- `CL: Start Section Timer` + `CL: Stop Section Timer` — live elapsed-time decoration
### Fixed
- `CL: Set List Start Number` now has two modes: **rebase** (on a numbered item — renumbers from cursor down) and **insert** (on a blank line — drops a new item)
- `bad-numbering` diagnostic now squiggles the item **before** the break, not after

## [12.7.0] - 2026-03-20
### Added
- **Estimate autocomplete** — `~` triggers `~15m`, `~30m`, `~1h`, `~2h`, `~4h`, `~1d`
- **Statistics panel refreshed** — done/total, tags, colour labels, flagged, commented, stamped per section; word goal bars
- `CL: Show Tag Report (Workspace)` — all tags with per-file item counts

## [12.3.0] - 2026-03-20
### Added
- **Priority autocomplete** — `!` triggers `!`/`!!`/`!!!` with descriptions
- **Date autocomplete** — `@` triggers today/tomorrow/next Friday/next week/next month
- `CL: Insert Item Snippet` — 10 pre-configured item templates
- `CL: Insert File Section Link` — inserts `[[file:name.md#SectionName]]`

## [11.9.0] - 2026-03-20
### Added
- `CL: Section Health Check` — empty-content, duplicate, and too-long item detection
- **Tag autocomplete** — `#` suggests existing tags sorted by frequency
- **Mention autocomplete** — `@` suggests known `@PersonName` mentions
- **Section link autocomplete** — `[[` suggests all section headers

## [11.5.0] - 2026-03-20
### Added
- `CL: Show Jump History` — quick pick of all 10 stored positions
- `CL: Duplicate Item and Increment` — `Draw card 1` → `Draw card 2`
- **Word Goal Progress Bar** — live `▓▓▓░░░░░░░ 147/500` on headers with `==N` goals
- `CL: New Section` — prompts for name, inserts header + blank item

## [11.1.0] - 2026-03-20
### Added
- **Smart Header Split** — Enter mid-line on `> Header` splits into two headers
- `CL: Paste Clipboard as Section` — first line → header, remaining lines → items
- `CL: Fold All Sections` + `CL: Unfold All Sections`
- `CL: Remove Old Items` — deletes items older than N days with confirmation

## [10.7.0] - 2026-03-20
### Added
- `CL: Move Item to Section` — true move (removes original)
- `CL: Diff Two Sections` — `+`/`-` diff in side panel
- `CL: Clear All Priority` + `CL: Clear All Due Dates`
- `CL: Toggle Item Count Badge` — live `(N)` decoration on headers

## [10.3.0] - 2026-03-20
### Added
- `CL: Edit Item Content` — input box with plain text; markers preserved on save
- `CL: Collect Items by Tag` — gathers tagged items into a new Results section
- `CL: Convert Section to Markdown Table` — items → `| # | Content |` table
- `chevron-lists.autoArchive` — auto-moves `[x]` items to `> Archive`

## [9.9.0] - 2026-03-20
### Added
- `CL: Rebase List From Here` + `CL: Offset List Numbers`
- `CL: Strip All Metadata` — removes all marker syntax from section items
- `CL: Show Word Frequency` — most-used words in the file
### Fixed
- `[LABEL]` square bracket highlighting no longer overlaps `chevronContent` tokens
- `bad-numbering` diagnostic: first item in a section can now start at any number

## [9.5.0] - 2026-03-20
### Added
- Full `CodeActionProvider` for all 5 diagnostic kinds (bad-numbering, duplicate-header, empty-section, overdue, word-goal)

## [9.4.0] - 2026-03-20
### Added
- `CL: Set List Start Number` — inserts or rebases a numbered list from a given number
- Code actions for `bad-numbering`: Fix this number · Set list start here · Fix all in file

## [9.3.0] - 2026-03-20
### Added
- `CL: Set List Start Number`

## [9.2.0] - 2026-03-20
### Added
- `CL: Move to Top of Section` + `CL: Move to Bottom of Section`
- `CL: Show Tag Heatmap` + `CL: Show Completion Heatmap`
- `@created:YYYY-MM-DD` syntax + `CL: Stamp Item with Date` + `CL: Show Old Items`
- `CL: Insert Table of Contents`

## [8.8.0] - 2026-03-20
### Added
- **esbuild bundling** — VSIX shrunk from 234KB/230 files to ~55KB/13 files
- **Colour theme fix** — `[markdown]: { enabled: true }` ensures semantic tokens fire in all themes
- 12 built-in colour presets: default, ocean, forest, sunset, monochrome, midnight, rose, autumn, arctic, neon, sepia, custom
- `ARCHITECTURE.md` — module boundary rules documented

---

*For history before v8.8.0 see the [GitHub repository](https://github.com/LewisIsWorking/ChevronLists).*
