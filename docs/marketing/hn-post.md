# Hacker News - Show HN Post

**Title:** Show HN: Chevron Lists – I turned VS Code into a full task manager using plain markdown

**URL:** https://marketplace.visualstudio.com/items?itemName=lewisisworking.chevron-lists

**Body (comment):**

I've been building this VS Code extension for about a year. The premise: you already have VS Code open all day - why switch to another app to manage tasks?

The syntax is minimal blockquote nesting that renders cleanly in any markdown viewer:

```
> Project Alpha
>> - !!! Fix the auth bug #backend @2026-04-01 ~2h
>> - [ ] Write tests
>> - [x] Deploy to staging +3
```

That item has: urgent priority, a tag, a due date, an estimate, and a vote count. All plain text, Git-diffable.

What it grew into over a year of iteration:

**Live decorations** - progress bars, sparklines, priority backgrounds, `⏰ due soon` ghost text on items within 3 days, sticky header when you scroll deep into a section, section heat map in the overview ruler.

**300+ commands** - kanban view, today view, tag filtering, sort by due date, bulk operations, Obsidian export, time estimate summaries, section growth charts.

**Smart keyboard** - Enter continues a list, Tab promotes depth (with children), Shift+Tab demotes, autocomplete for `#tags`, `@mentions`, `[[section links]]`, and `~time` estimates.

**Diagnostics** - Problems panel flags duplicate sections, empty sections, overdue items, out-of-sequence numbers, with one-click quick fixes.

**AI assist** - optional Claude API integration for item suggestions, expansion, and rewriting.

The whole thing bundles to ~260KB and activates in ~50ms. Everything is SOLID/OOP, 737 unit tests, 100% line coverage, all modules under 200 lines.

GitHub: https://github.com/LewisIsWorking/ChevronLists
