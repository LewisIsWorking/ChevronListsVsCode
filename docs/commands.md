# Chevron Lists - Full Command Reference

All 250+ commands, grouped by area. Access any command via `CL:` in the Command Palette (`Ctrl+Shift+P`).

## Navigation

| Command | Keybinding | Description |
|---|---|---|
| Next Header | `Ctrl+Alt+Down` | Jump to the next `> Header` |
| Previous Header | `Ctrl+Alt+Up` | Jump to the previous `> Header` |
| `CL: Filter Sections` | - | Fuzzy-search jump to any section in the current file |
| `CL: Filter Sections (Workspace)` | - | Same across all workspace markdown files |
| `CL: Jump Back` | - | Return to previous cursor position |
| `CL: Show Jump History` | - | Quick pick of 10 stored positions |
| `CL: Filter Groups` | - | Jump to a named `>> --` group divider |
| `CL: Jump to Bookmark` | - | Quick pick of all `[bookmark:Name]` markers |
| `CL: Focus on Section` | - | Folds all other sections |
| `CL: Unfocus` | - | Restores all folded sections |
| `CL: Fold All Sections` | - | Folds every section |
| `CL: Unfold All Sections` | - | Unfolds all sections |

## Search & Filter

| Command | Description |
|---|---|
| `CL: Search Items` | Live search across all items in the file |
| `CL: Search Items (Workspace)` | Same across all workspace files |
| `CL: Filter by Tag` | Filter items by `#tag` |
| `CL: Filter by Tag (Workspace)` | Same across workspace |
| `CL: Filter by Multiple Tags` | Multi-tag AND/OR filter |
| `CL: Filter by Priority` | Filter by `!` / `!!` / `!!!` |
| `CL: Filter by Mention` | Filter by `@PersonName` |
| `CL: Filter by Colour Label` | Quick pick by `{colour}` label |
| `CL: Filter by Rating` | Items at or above chosen `★N` threshold |
| `CL: Filter Starred Items` | All `* ` starred items |
| `CL: Filter Flagged Items` | All `? ` flagged items |
| `CL: Show Upcoming` / `CL: Today View` | `@date` items sorted chronologically |
| `CL: Show Expired Items` | All `@expires:` items past date |
| `CL: Show Old Items` | All `@created:` items older than N days |
| `CL: Show Recurring` | All `@daily/@weekly/@monthly` items |

## Section Actions

| Command | Description |
|---|---|
| `CL: New Section` | Prompt for name, insert header + blank item |
| `CL: Clone Section` | Duplicate entire section below with `(copy)` suffix |
| `CL: Rename Section` | Rename header + update all `[[links]]` in file |
| `CL: Delete Section` | Delete header and all items |
| `CL: Duplicate Section` | Copy section directly below itself |
| `CL: Move Section Up/Down` | Swap with neighbour section |
| `CL: Merge Section Below` | Combine with section below |
| `CL: Split Section Here` | Split at cursor into two named sections |
| `CL: Diff Two Sections` | Side-panel line diff of any two sections |
| `CL: Freeze Section` / `CL: Unfreeze Section` | Add/remove `>> [frozen]` marker |
| `CL: Lock Section` / `CL: Unlock Section` | Add/remove `>> [locked]` (warns on save) |
| `CL: Show Section Growth` | Bar chart of item count per section |
| `CL: Show Section Time Estimate` | Sum of all `~estimate` markers |
| `CL: Show Nesting Breakdown` | Item count per chevron depth |
| `CL: Show Section Path` | Orientation: name, line, items, words |
| `CL: Show Vote Leaderboard (Section)` | Items ranked by `+N` vote count |
| `CL: Group Items by Mention` | Split into `>> -- Name` groups by `@mention` |
| `CL: Rename Tag (Section)` | Rename a `#tag` within this section only |
| `CL: Change Item Prefix` | Change bullet prefix for all section items |
| `CL: Sort by Due Date` | Sort items by `@YYYY-MM-DD` ascending |
| `CL: Batch Replace Text` | Find/replace in section items with preview |
| `CL: Extract URLs from Section` | Collect and open URLs from section items |

## Item Actions

| Command | Description |
|---|---|
| `CL: Toggle Item Done` | Toggle `[ ]` ↔ `[x]` |
| `CL: Toggle Star` | Toggle `* ` star marker |
| `CL: Toggle Note` | Add/remove `>> > Note` line |
| `CL: Toggle Flag` | Toggle `? ` question flag |
| `CL: Add Vote` / `CL: Remove Vote` | Increment/decrement `+N` |
| `CL: Duplicate Item` | Copy item below itself |
| `CL: Move Item Up/Down` | Reorder within section |
| `CL: Move Item to Section` | Move to another section |
| `CL: Edit Item Content` | Input box (markers hidden, preserved on save) |
| `CL: Snapshot Item` | Store item content |
| `CL: Diff Item with Snapshot` | Word-level before/after diff |
| `CL: Smart Paste` | Paste as chevron items, auto-detects format |
| `CL: Wrap Item Text` | Split item at cursor into continuation lines |
| `CL: Show Item Complexity` | Marker density score with visual bar |
| `CL: Evaluate Expression in Item` | Evaluates `=expr` inline |
| `CL: Insert Date Stamp` | Inserts `@YYYY-MM-DD` at cursor |
| `CL: Convert Item to Section Link` | Replace item with `[[SectionName]]` |
| `CL: Send to Daily Note` | Copy item to today's Inbox |
| `CL: Start/Stop Item Timer` | Elapsed timer stamped on stop |

## Bulk Actions

| Command | Description |
|---|---|
| `CL: Mark All Done (Section)` / `CL: Mark All Undone (Section)` | Bulk checkbox toggle in section |
| `CL: Toggle Done (All Cursors)` | Toggle done on every active cursor |
| `CL: Set Priority (All Cursors)` | Set same priority on every cursor |
| `CL: Bulk Tag Items` | Add `#tag` to every section item |
| `CL: Bulk Set Priority` | Set priority on every section item |
| `CL: Bulk Set Due Date` | Set due date on every section item |
| `CL: Clear All Priority` | Remove all `!` markers from section |
| `CL: Shift All Due Dates` | Shift every `@date` by ±N days |

## Sorting & Numbering

| Command | Description |
|---|---|
| `CL: Sort Items A→Z / Z→A` | Alphabetical sort |
| `CL: Sort by Votes` | Sort by `+N` descending |
| `CL: Sort by Due Date` | Sort by `@date` ascending, undated last |
| `CL: Renumber Items` | Reset numbered sequence per depth |
| `CL: Fix Numbering` | Auto-correct all out-of-sequence numbers |
| `CL: Convert Bullets to Numbered` | `>> -` → `>> N.` |
| `CL: Convert Numbered to Bullets` | `>> N.` → `>> -` |

## Statistics & Analytics

| Command | Description |
|---|---|
| `CL: Show File Statistics` | Webview: full file stats |
| `CL: Quick Stats` | One-line section summary message |
| `CL: Show Tag Stats` | Webview: done/total/% per tag |
| `CL: Show Mentions Report` | Webview: `@Name` assignment table |
| `CL: Count Word Frequency` | Top 10 words in section, stop-word filtered |
| `CL: Show Reading Time` | 200wpm estimate for section or file |
| `CL: Show Section Time Estimate` | Sum of all `~estimate` markers |
| `CL: Show Item Complexity` | Marker density score |

## Views & Webviews

| Command | Description |
|---|---|
| `CL: Show Kanban` | Items grouped as Todo / In Progress / Done |
| `CL: Today View` | All overdue and due-today items |
| `CL: Show Archive` | Jump-to quick pick of archived items |
| `CL: Show Tag Stats` | Tag completion % webview |
| `CL: Show Mentions Report` | `@Name` assignment webview |
| `CL: Show Section Growth` | Bar chart of items per section |

## Timers

| Command | Description |
|---|---|
| `CL: Start/Stop Item Timer` | Elapsed timer, stamps `~elapsed` on stop |
| `CL: Start/Stop Focus Timer` | Configurable countdown (default 25 min) |
| `CL: Start/Stop Section Timer` | Elapsed timer on section header |

## Export & Copy

| Command | Description |
|---|---|
| `CL: Copy Section As…` | Markdown, Plain Text, JSON, CSV, or HTML |
| `CL: Copy Section as CSV Row` | Items as a single comma-separated row |
| `CL: Extract URLs from Section` | Open URLs from section items |
| `CL: Export to Obsidian` | YAML frontmatter + `##` sections + emoji markers |
| `CL: Export File as HTML/JSON/CSV/Markdown` | Full file export |

## Appearance

| Command | Description |
|---|---|
| `CL: Colour Theme` | Choose from 13 colour presets |
| `CL: Toggle Section Summary` | Show/hide ghost text summary |
| `CL: Toggle Checklist Progress Bar` | Show/hide `▓▓▓░░` bar |
| `CL: Toggle Word Goal Bar` | Show/hide word goal bar |
| `CL: Toggle Age Highlight` | Show/hide 30-day-old item fade |
| `CL: Toggle All Decorations` | Master toggle |

## Daily Notes

| Command | Description |
|---|---|
| `CL: Open Daily Note` | Open/create today's daily note |
| `CL: Send to Daily Note` | Copy cursor item to today's Inbox |

Configure with `chevron-lists.dailyNotesFolder` and `chevron-lists.dailyNoteTemplate`.

## AI Assist

Requires `chevron-lists.anthropicApiKey`.

| Command | Description |
|---|---|
| `CL: Suggest Items (AI)` | Claude suggests 3–5 items for the section |
| `CL: Summarise Section (AI)` | One-line summary as first item |
| `CL: Expand Item (AI)` | Expand item into sub-items |
| `CL: Rewrite Item (AI)` | Rewrite for clarity, markers preserved |

## Help

| Command | Description |
|---|---|
| `CL: Show Tip of the Day` | Show a random feature tip (re-enables if disabled) |
