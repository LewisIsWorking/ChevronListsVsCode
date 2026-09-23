# Chevron Lists

**The markdown list manager you didn't know VS Code was missing.**

Chevron Lists turns VS Code into a fully-featured task, notes, and project management system - without leaving markdown. It uses a clean, readable `>> -` blockquote syntax and layers on 250+ commands, live decorations, autocomplete, and AI assistance - all zero-config out of the box.

> **749 unit tests · 100% line coverage · 250 commands · 66 test files**

---

## Why Chevron Lists?

Plain markdown is great for writing. It's not great for *managing work*. Chevron Lists bridges that gap:

| Plain markdown problem | Chevron Lists solution |
|---|---|
| No task tracking beyond `- [ ]` | Priorities `!!!`, tags `#urgent`, votes `+5`, ratings `★4` |
| Can't filter or jump between ideas | 30+ filter/search commands with instant quick-pick |
| No project structure | Sections, groups, links `[[Section]]`, dependencies |
| No time awareness | Due dates, overdue warnings, estimates `~2h`, daily notes |
| Decorations? What decorations? | Live sparklines, progress bars, heat maps, urgency tints |
| AI assist requires switching apps | Built-in Claude AI: suggest, expand, summarise, rewrite |

---

## Syntax at a Glance

```markdown
> Project Alpha                        ← section header
>> - !!! Fix critical bug #backend     ← urgent, tagged
>> - [ ] Write tests @2026-04-15 ~2h   ← due date + estimate
>> - [x] Deploy to staging +3          ← done, 3 votes
>> 1. Step one                         ← numbered item
>>> - Nested sub-task                  ← deep nesting
```

Everything is plain markdown - readable anywhere, Git-diff friendly, no lock-in.


---

## Quick Start

1. Install the extension
2. Open any `.md` file
3. Type `> ` and a section name, press **Enter**
4. Start typing items - **Enter** continues the list, **Tab** nests deeper

Type `CL:` in the Command Palette (`Ctrl+Shift+P`) to explore 250+ commands.

---

## Item Markers

Add any of these directly in item content - they're parsed live:

| Marker | Example | What it does |
|--------|---------|-------------|
| `[ ]` / `[x]` | `>> - [x] Done` | Checkboxes |
| `#tag` | `>> - Deploy #backend` | Tags (autocomplete from file) |
| `!` `!!` `!!!` | `>> - !!! Critical` | Priority (yellow/amber/red bg) |
| `@YYYY-MM-DD` | `>> - Ship @2026-04-01` | Due date (overdue warnings) |
| `~2h` / `~30m` | `>> - Setup ~2h` | Time estimate |
| `+N` | `>> - Great idea +5` | Vote count |
| `[[SectionName]]` | `>> - See [[Act Two]]` | Section link (hover preview) |
| `★N` | `>> - ★4 great idea` | Star rating 1–5 |
| `@created:YYYY-MM-DD` | `>> - task @created:2026-01-01` | Creation date stamp |
| `@expires:YYYY-MM-DD` | `>> - offer @expires:2026-12-31` | Expiry date |
| `{red}` `{green}` etc. | `>> - {red} blocked` | Colour label |
| `[LABEL]` | `>> - [ACTION] fix it` | Square bracket label (gold) |
| `// note` | `>> - Deploy // check DNS first` | Inline comment (muted) |
| `~~text~~` | `>> - ~~cancelled~~` | Strikethrough |
| `? ` | `>> - ? unclear spec` | Question flag |

### Section Syntax

| Syntax | Example | Feature |
|--------|---------|---------|
| `==N` | `> Docs ==500` | Word count goal |
| `>> -- Name` | `>> -- Act One` | Group divider |
| `>> [locked]` | `>> [locked]` | Lock section (save warns) |
| `>> [frozen]` | `>> [frozen]` | Freeze section |
| `>>depends:Name` | `>>depends:Phase One` | Dependency marker |


---

## Smart Keyboard Behaviour

| Key | What happens |
|-----|-------------|
| **Enter** after `> Header` | Starts a `>> -` item, triggers autocomplete |
| **Enter** on empty `>> -` | Stops the list (no trailing empties) |
| **Enter** after `>> N.` | Auto-increments to next number |
| **Enter** mid-line | Splits item at cursor |
| **Tab** on item | Promotes depth `>> -` → `>>> -`, shifts children |
| **Shift+Tab** | Demotes depth, shifts children |
| **Ctrl+Alt+Down/Up** | Jump to next/previous section header |
| **Ctrl+Alt+N** | Toggle inline note |

---

## Live Decorations

These update as you type - no commands needed:

| Decoration | What it shows |
|------------|---------------|
| **Section Summary** | `5 items · ▁▃▅░ 2 done · 3 tags · 1 urgent · 2 old` |
| **Checklist Progress Bar** | `▓▓▓░░ 3/5` (red → amber → green) |
| **Word Goal Bar** | `▓▓▓▓░░ 147/500` (on `==N` sections) |
| **Priority Backgrounds** | `!!!` red · `!!` amber · `!` yellow item tints |
| **Section Heat Map** | Overview ruler markers coloured by section weight |
| **Urgency Ruler Tint** | Red left-gutter when a section has 2+ `!!!` items |
| **Sticky Header** | Section name shown at top of viewport when scrolled |
| **Item Age Highlight** | 30+ day old items rendered muted and italic |
| **Section Colour** | `[colour:X]` header tags render in that colour |
| **Overdue Status Bar** | `⚠ N overdue` - click to open Today View |
| **Word Goal Nudge** | `📝 N words to go` when below section goal |

---

## Autocomplete

| Trigger | Suggestions |
|---------|-------------|
| `#` | All tags in the file, sorted by frequency |
| `@` | All `@PersonName` mentions in the file |
| `[[` | All section headers in the file |
| `!` | Priority levels with descriptions |
| `@` (date) | today · tomorrow · next week · next month |
| `~` | Common time estimates |
| `★` | Star ratings 1–5 |
| `>` | Section header completions |

---

## Diagnostics (Problems Panel)

The Problems panel flags issues with quick-fix actions (`Ctrl+.`):

| Problem | Quick Fixes |
|---------|-------------|
| Duplicate section names | Rename · Make unique |
| Empty sections | Add placeholder · Delete · Quick capture |
| Out-of-sequence numbering | Fix this · Fix all in file |
| Overdue items | Reschedule to today · Remove date · Mark done |
| Below word goal | Update goal · Remove goal |
| Expired items | Extend by 7 days · Remove expiry |


---

## All Commands

Type `CL:` in the Command Palette (`Ctrl+Shift+P`). Commands are grouped by area.

### Navigation
`CL: Filter Sections` · `CL: Filter Sections (Workspace)` · `CL: Jump Back` · `CL: Show Jump History` · `CL: Filter Groups` · `CL: Jump to Bookmark` · `CL: Focus on Section` · `CL: Unfocus` · `CL: Fold All Sections` · `CL: Unfold All Sections`

### Search & Filter
`CL: Search Items` · `CL: Search Items (Workspace)` · `CL: Filter by Tag` · `CL: Filter by Priority` · `CL: Filter by Mention` · `CL: Filter by Multiple Tags` · `CL: Filter by Colour Label` · `CL: Filter by Rating` · `CL: Show Upcoming` · `CL: Today View` · `CL: Show Expired Items` · `CL: Show Old Items` · `CL: Show Recurring`

### Section Actions
`CL: New Section` · `CL: Clone Section` · `CL: Rename Section` · `CL: Delete Section` · `CL: Duplicate Section` · `CL: Move Section Up/Down` · `CL: Merge Section Below` · `CL: Split Section Here` · `CL: Diff Two Sections` · `CL: Archive Done Items` · `CL: Freeze Section` · `CL: Unfreeze Section` · `CL: Lock Section` · `CL: Unlock Section` · `CL: Freeze Section` · `CL: Show Section Growth` · `CL: Show Section Time Estimate` · `CL: Show Nesting Breakdown`

### Item Actions
`CL: Toggle Item Done` · `CL: Toggle Star` · `CL: Toggle Note` · `CL: Toggle Flag` · `CL: Add Vote` · `CL: Duplicate Item` · `CL: Move Item Up/Down` · `CL: Move Item to Section` · `CL: Edit Item Content` · `CL: Snapshot Item` · `CL: Diff Item with Snapshot` · `CL: Smart Paste` · `CL: Wrap Item Text` · `CL: Show Item Complexity` · `CL: Evaluate Expression in Item` · `CL: Insert Date Stamp` · `CL: Convert Item to Section Link` · `CL: Send to Daily Note`

### Bulk Actions
`CL: Mark All Done (Section)` · `CL: Mark All Undone (Section)` · `CL: Toggle Done (All Cursors)` · `CL: Set Priority (All Cursors)` · `CL: Bulk Tag Items` · `CL: Bulk Set Priority` · `CL: Bulk Set Due Date` · `CL: Clear All Priority` · `CL: Shift All Due Dates` · `CL: Batch Replace Text` · `CL: Change Item Prefix` · `CL: Rename Tag (Section)` · `CL: Sort by Due Date`

### Sorting & Numbering
`CL: Sort Items A→Z` · `CL: Sort by Votes` · `CL: Sort by Due Date` · `CL: Renumber Items` · `CL: Fix Numbering` · `CL: Convert Bullets to Numbered` · `CL: Convert Numbered to Bullets`

### Statistics & Analytics
`CL: Show File Statistics` · `CL: Quick Stats` · `CL: Show Tag Stats` · `CL: Show Mentions Report` · `CL: Show Section Growth` · `CL: Show Vote Leaderboard (Section)` · `CL: Count Word Frequency` · `CL: Show Reading Time` · `CL: Show Section Time Estimate` · `CL: Show Item Complexity`

### Export & Copy
`CL: Copy Section As…` · `CL: Copy Section as CSV Row` · `CL: Copy Section as JSON` · `CL: Extract URLs from Section` · `CL: Export to Obsidian` · `CL: Export File as HTML/JSON/CSV/Markdown`

### Views & Webviews
`CL: Show Kanban` · `CL: Today View` · `CL: Show Archive` · `CL: Show Tag Stats` · `CL: Show Mentions Report` · `CL: Show Section Growth`

### Timers
`CL: Start/Stop Item Timer` · `CL: Start/Stop Focus Timer` (configurable, default 25 min) · `CL: Start/Stop Section Timer`

### Appearance
`CL: Colour Theme` (13 presets) · `CL: Toggle Section Summary` · `CL: Toggle Checklist Progress Bar` · `CL: Toggle Word Goal Bar` · `CL: Toggle Age Highlight` · `CL: Toggle All Decorations`

### AI Assist
Requires `chevron-lists.anthropicApiKey`.

`CL: Suggest Items (AI)` · `CL: Summarise Section (AI)` · `CL: Expand Item (AI)` · `CL: Rewrite Item (AI)`


---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `chevron-lists.listPrefix` | `-` | Bullet prefix character |
| `chevron-lists.blankLineAfterHeader` | `false` | Blank line after header on Enter |
| `chevron-lists.snippetTrigger` | `tab` | Snippet trigger: `tab`, `ctrl+enter`, or `none` |
| `chevron-lists.colourPreset` | `default` | Colour theme preset |
| `chevron-lists.templates` | `[]` | Custom templates |
| `chevron-lists.anthropicApiKey` | `""` | API key for AI Assist |
| `chevron-lists.autoArchive` | `false` | Auto-move `[x]` items to Archive on toggle |
| `chevron-lists.dailyNotesFolder` | `""` | Folder for daily notes |
| `chevron-lists.dailyNoteTemplate` | `""` | Daily note template (`{{date}}`, `{{weekday}}`, `{{day}}`) |
| `chevron-lists.autoFixNumbering` | `false` | Auto-correct numbering on save |
| `chevron-lists.escalateOverdue` | `false` | Auto-add `!!!` to items overdue 7+ days |
| `chevron-lists.focusTimerMinutes` | `25` | Focus timer duration |

---

## Who Uses This?

Chevron Lists works great for:

- **Writers** - chapter outlines, scene cards, revision notes with word goals
- **Developers** - feature tracking, bug lists, sprint notes, dependency mapping
- **Project managers** - kanban-style section boards, task assignment via `@mentions`
- **Students** - lecture notes with tags, revision checklists, due date tracking
- **Personal productivity** - daily notes, GTD capture, habit tracking
- **Game designers** - combo trees, card lists, balance tracking with votes

---

## Development

```bash
bun install
bun run compile                        # type-check
bun test src/__tests__ --coverage      # 749 tests, 100% line coverage
bunx @vscode/vsce package              # package VSIX
```

**749 unit tests · 100% line coverage · 66 test files · all source modules under 200 lines**

Architecture: SOLID principles throughout. Pure functions live in `patterns.ts` / `*Parser.ts` - never in `*Commands.ts`. Event-driven, single-responsibility modules. See `ARCHITECTURE.md`.

---

## Links

- [Marketplace](https://marketplace.visualstudio.com/items?itemName=lewisisworking.chevron-lists)
- [GitHub](https://github.com/LewisIsWorking/ChevronLists)
- [Full Command Reference](docs/commands.md)
- [Syntax Reference](docs/syntax.md)
- [Settings Reference](docs/settings.md)
- [Contributing](docs/contributing.md)
- [Changelog](CHANGELOG.md)
- [Roadmap](ROADMAP.md)

## License

CC BY-NC-ND 4.0 - © Lewis Creelman. Free for personal use.
