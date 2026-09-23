# Chevron Lists - Settings Reference

All settings are under the `chevron-lists.*` namespace.

## Core Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `listPrefix` | string | `-` | Bullet prefix character for items (`-`, `*`, `•`) |
| `blankLineAfterHeader` | boolean | `false` | Insert a blank line after `> Header` on Enter |
| `snippetTrigger` | string | `tab` | Snippet trigger: `tab`, `ctrl+enter`, or `none` |
| `colourPreset` | string | `default` | Active colour theme preset |
| `autoArchive` | boolean | `false` | Auto-move `[x]` items to `> Archive` on toggle done |
| `autoFixNumbering` | boolean | `false` | Auto-correct numbered item sequences on save |

## Daily Notes Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `dailyNotesFolder` | string | `""` | Folder for daily notes, relative to workspace root or absolute |
| `dailyNoteTemplate` | string | `""` | Template for new daily notes. Supports `{{date}}`, `{{weekday}}`, `{{day}}` |

## Focus & Timers

| Setting | Type | Default | Description |
|---|---|---|---|
| `focusTimerMinutes` | number | `25` | Duration in minutes for `CL: Start Focus Timer` |

## Smart Behaviours

| Setting | Type | Default | Description |
|---|---|---|---|
| `escalateOverdue` | boolean | `false` | Auto-add `!!!` to items overdue by more than 7 days on refresh |

## AI Assist

| Setting | Type | Default | Description |
|---|---|---|---|
| `anthropicApiKey` | string | `""` | Anthropic API key for AI commands. Get one at [console.anthropic.com](https://console.anthropic.com) |

## Templates

| Setting | Type | Default | Description |
|---|---|---|---|
| `templates` | array | `[]` | Array of custom templates for `CL: Insert Template`. Each entry: `{ name: string, content: string }` |

## Colour Presets

Available values for `chevron-lists.colourPreset`:

| Preset | Header colour | Number colour | Prefix colour |
|---|---|---|---|
| `default` | violet `#A855F7` | lime `#84CC16` | slate `#637880` |
| `classic` | amber `#E5C07B` | blue `#61AFEF` | grey `#5C6370` |
| `ocean` | cyan | teal | steel blue |
| `forest` | green | yellow-green | olive |
| `sunset` | orange | gold | coral |
| `monochrome` | light grey | medium grey | dark grey |
| `midnight` | purple | violet | indigo |
| `rose` | pink | rose | mauve |
| `autumn` | burnt orange | gold | brown |
| `arctic` | ice blue | white | slate |
| `neon` | neon green | hot pink | electric blue |
| `sepia` | sepia | warm yellow | tan |
| `custom` | Uses VS Code theme colours |

Use `CL: Colour Theme` to switch presets via the command palette.

## Editing Settings in VS Code

1. Open Settings (`Ctrl+,`)
2. Search for `chevron-lists`
3. All settings appear under the **Chevron Lists** section

Or edit `settings.json` directly:
```json
{
  "chevron-lists.listPrefix": "-",
  "chevron-lists.blankLineAfterHeader": false,
  "chevron-lists.colourPreset": "default",
  "chevron-lists.autoArchive": false,
  "chevron-lists.dailyNotesFolder": "daily",
  "chevron-lists.escalateOverdue": false,
  "chevron-lists.focusTimerMinutes": 25
}
```
