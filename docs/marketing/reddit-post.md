# Reddit Post Drafts

## r/vscode (primary - 120k members)

**Title:** I built a markdown list manager with 300+ commands for VS Code - smart Enter, live decorations, kanban, AI assist

**Body:**
Hey r/vscode,

I've been building Chevron Lists for a while - it's a VS Code extension that turns markdown files into a full task/notes/project management system without leaving your editor.

The core idea: you write `> Section Name` as a header, and `>> - Item` as items. Then everything else layers on top of plain, readable markdown.

What it does:

- **Smart Enter** - press Enter after a header and it auto-starts a `>> -` item. Press Enter on an empty item to stop the list. Tab promotes depth, Shift+Tab demotes.
- **Live decorations** - section summaries, checklist progress bars, priority backgrounds (`!!!` = red, `!!` = amber), `⏰ due soon` ghost text, sticky header when scrolled
- **300+ commands** - filter by tag, sort by due date, kanban view, today view, export to Obsidian, AI suggestions via Claude API
- **Autocomplete** - type `#` for tag suggestions, `@` for mention names, `[[` for section links, `~` for time estimates
- **Diagnostics** - Problems panel flags duplicate headers, empty sections, overdue items, out-of-sequence numbers with quick fixes

Everything stays in plain markdown - readable in any editor, Git-diff friendly, no lock-in.

Search for **Chevron Lists** in the VS Code extension marketplace, or:
https://marketplace.visualstudio.com/items?itemName=lewisisworking.chevron-lists

Happy to answer questions! I use it every day for personal projects and it's become essential to how I work.

---

## r/productivity

**Title:** I spent a year building a task manager inside VS Code using plain markdown - here's what it can do

**Body:**
If you already live in VS Code, switching to another app just to manage tasks always felt like friction. So I built an extension that turns markdown files into a proper task system.

The syntax is simple blockquote nesting:
```
> Sprint 12
>> - !!! Fix auth bug #backend @2026-04-01 ~2h
>> - [ ] Write tests +3
>> - [x] Deploy to staging
```

That single item has: urgent priority, a tag, a due date, a time estimate. All plain text.

On top of that: live decorations, a kanban view, today view for overdue items, tag filtering, export to Obsidian, and optional AI suggestions.

It's called **Chevron Lists** - free on the VS Code marketplace:
https://marketplace.visualstudio.com/items?itemName=lewisisworking.chevron-lists

---

## r/ObsidianMD

**Title:** Built a VS Code extension with Obsidian export - for people who draft in VS Code and publish to Obsidian

**Body:**
I know many people use both VS Code and Obsidian. I built an extension called Chevron Lists that manages tasks/notes in VS Code using a simple `>> -` markdown syntax, and added an `Export to Obsidian` command that converts everything to proper Obsidian format: YAML frontmatter, `##` section headers, `[[wiki links]]` preserved, emoji priority markers.

The idea is: draft and manage in VS Code (with 300+ commands, live decorations, AI assist), publish/archive to Obsidian.

https://marketplace.visualstudio.com/items?itemName=lewisisworking.chevron-lists
