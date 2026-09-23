# How I Built a 300-Command VS Code Extension for Markdown Productivity

*Originally published on dev.to - feel free to adapt before posting*

---

I spend most of my day in VS Code. Notes, tasks, planning, documentation - all of it. For years I kept switching between VS Code and other apps to manage my work, and every switch felt like friction.

So I built Chevron Lists: a VS Code extension that turns markdown files into a full task and project management system, without leaving your editor.

This is the story of how it grew from "smart Enter key" to 300+ commands, 737 unit tests, and a live decoration system that updates as you type.

## The Core Idea

The syntax is simple markdown blockquote nesting:

```markdown
> Project Alpha
>> - Fix the auth bug
>> - Write tests
>> - Deploy to staging
```

`> ` is a section header. `>> -` is an item. Deep nesting works at any level (`>>>`, `>>>>`, etc.). Everything is valid markdown - readable in any editor, Git-diffable, no binary formats.

That's the foundation. Everything else is additive.

## Step 1: Smart Enter

The first thing I built was a smarter Enter key. Press Enter after `> My Section` and it auto-starts a `>> -` item. Press Enter on an empty item and it stops the list. Tab promotes depth, Shift+Tab demotes - and both carry children with them.

This alone made the syntax feel natural. Instead of manually typing `>> - ` every time, the editor just knows what you want.

## Step 2: Item Markers

Then I added markers. All optional, all combinable:

```markdown
>> - !!! Fix auth bug #backend @2026-04-01 ~2h +3
```

- `!!!` - urgent priority (also `!!` medium, `!` low)
- `#backend` - tag (autocompleted from existing tags in the file)
- `@2026-04-01` - due date
- `~2h` - time estimate
- `+3` - vote count

These are parsed live. The extension extracts them for filtering, sorting, diagnostics, and decorations - but they stay as plain text in the file.

## Step 3: Live Decorations

This is where it got interesting. VS Code's decoration API lets you add ghost text, background colours, and overview ruler markers to any line. I built a decoration system that updates on every keystroke:

- **Section summary** - `5 items · ▁▃▅░ 2 done · 3 tags · 1 urgent` after every header
- **Checklist progress bar** - `▓▓▓░░ 3/5` that turns green when complete
- **Priority backgrounds** - `!!!` items get a faint red tint, `!!` amber, `!` yellow
- **Due soon ghost text** - `⏰ due soon` inline on items within 3 days
- **Sticky header** - section name stays at the top of the viewport when you scroll deep
- **Urgency ruler tint** - red left-gutter marker when a section has 2+ urgent items

All of these update in real time. Zero commands needed.

## Step 4: Architecture

With features multiplying, I needed discipline. The rule I settled on:

**Pure functions must never live in `*Commands.ts` files.**

Every command file imports `vscode` to call VS Code APIs. Bun (my test runner) has no VS Code host, so any file that imports `vscode` can't be tested. The solution: all pure logic lives in `patterns.ts` (and its siblings `patternsUtils.ts`, `patternsExport.ts`, `patternsExtra.ts`), re-exported through one import. Command files import from `patterns` and call VS Code APIs - nothing else.

The result: 737 unit tests, 100% line coverage, zero VS Code mocking needed.

I also enforced a 200-line-per-file rule. When a file gets too long, extract logic using OOP/SOLID patterns - never remove comments or code to hit the limit.

## Step 5: Commands (lots of them)

With solid architecture in place, features came fast. A selection:

**Navigation:** `Ctrl+Alt+Down/Up` jumps between sections. `CL: Filter Sections` is a fuzzy-search quick pick over every header in the file.

**Kanban:** `CL: Show Kanban` opens a webview grouping items as Todo, In Progress (starred `*`), and Done.

**Today View:** `CL: Today View` shows all overdue and due-today items across the entire workspace.

**Sort by Due Date:** sorts items in a section ascending by `@date`, undated items last.

**Export to Obsidian:** converts everything to proper Obsidian format - YAML frontmatter, `##` headings, `[[wiki links]]` preserved, emoji priority markers.

**AI Assist:** optional Claude API integration for `CL: Suggest Items (AI)`, `CL: Expand Item (AI)`, `CL: Rewrite Item (AI)`.

## Step 6: Diagnostics

The Problems panel integration turned out to be one of the most useful features. The extension flags:

- Duplicate section names → quick fix: rename or append number
- Empty sections → quick fix: add placeholder or delete
- Out-of-sequence numbered items → quick fix: fix this one or all in file
- Overdue items → quick fix: reschedule to today, remove date, or mark done
- Expired `@expires:` items → quick fix: extend by 7 days or remove

Every diagnostic has a `CL:` prefix to distinguish them from language server diagnostics.

## What I Learned

**The 200-line rule is worth it.** Enforcing file length limits forced me to think carefully about module boundaries. The codebase is now ~380 modules, but any individual file is trivially understandable.

**Decorations are underused.** Most VS Code extensions use text decorations for simple highlighting. The combination of ghost text + background colour + overview ruler markers creates a genuinely information-dense editing experience without cluttering the document.

**Test runner choice matters.** Switching from Jest to Bun cut test time from ~3 seconds to ~300ms for 737 tests. That's the difference between "I'll run tests sometimes" and "I always run tests."

**Keywords matter for Marketplace visibility.** The extension had zero keywords for the first 18 versions. Adding 28 targeted keywords (`markdown`, `todo`, `kanban`, `bullet journal`, `daily notes`, `gtd`) immediately improved search ranking.

## The Result

Chevron Lists is now at v24.1.0 with:
- 300+ commands
- 737 unit tests, 100% line coverage
- ~260KB bundle, ~50ms activation
- VS Code Walkthrough for onboarding
- Tip of the Day system to surface hidden features

If you spend your day in VS Code and manage any kind of lists, it might be worth trying:

👉 [Chevron Lists on the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lewisisworking.chevron-lists)

The source is on [GitHub](https://github.com/LewisIsWorking/ChevronLists) - happy to discuss architecture, the decoration system, or testing approach in the comments.

---

*Tags: vscode, productivity, typescript, opensource, webdev*
