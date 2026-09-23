# Chevron Lists - Contributing

## Prerequisites

- [Bun](https://bun.sh/) (package manager + test runner)
- Node.js 20+
- VS Code 1.80+

## Setup

```bash
git clone https://github.com/LewisIsWorking/ChevronLists
cd ChevronLists
bun install
```

## Development Workflow

```bash
bun run compile                     # Type-check only (fast)
bun test src/__tests__ --coverage   # Run all tests with coverage
node esbuild.mjs                    # Dev build with source maps
node esbuild.mjs --production       # Production build (minified)
bunx @vscode/vsce package           # Package as VSIX
```

To test locally:
```bash
code --install-extension chevron-lists-X.X.X.vsix --force
```

## Architecture Rules

See [ARCHITECTURE.md](../ARCHITECTURE.md) for the full module boundary rules. The key rule:

**Pure functions must never live in `*Commands.ts` files.**

If a function does not call `vscode.*`, it belongs in:
- `src/patterns.ts` - re-exports from `patternsUtils.ts`, `patternsExport.ts`, `patternsExtra.ts`
- A `*Parser.ts` file - domain-specific parsing

This keeps all logic unit-testable without a VS Code extension host.

## File Length Rule

**Maximum 200 lines per source file.** This is enforced in CI. If a file exceeds 200 lines:
1. Extract pure functions to `patternsExport.ts` or `patternsExtra.ts`
2. Split command registration into a new `commandRegistrationsX.ts`
3. **Never remove comments, whitespace, or code to hit the limit** - extract instead

## Adding a New Feature

1. **Pure logic** → add to `patternsExport.ts` or `patternsExtra.ts` (re-exported via `patterns.ts`)
2. **Command** → create `src/myFeatureCommands.ts`, import from `patterns`
3. **Register** → add to `commandRegistrationsD.ts` (or create E if D hits 200 lines)
4. **Package** → add command title to `package.json` `contributes.commands`
5. **Tests** → add `src/__tests__/myFeature.test.ts`, import pure functions from `../patterns`
6. **Docs** → update `docs/commands.md` and `CHANGELOG.md`

## Test Requirements

- All pure functions must have tests
- Tests import from `../patterns`, never from `*Commands.ts` files
- Run `bun test src/__tests__ --coverage` - target 100% line coverage

## Commit Convention

```
v24.1.0 - Phase 52: Feature Name, Another Feature; N tests
```

## Pull Requests

PRs welcome. Please:
- Follow the architecture rules above
- Add tests for all new pure logic
- Update `CHANGELOG.md` with the change
- Keep files under 200 lines
