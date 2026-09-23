# test-shims

## `vscode`

A `file:` devDependency named `vscode`, so production modules can be loaded by
`bun test` unchanged.

### Why it exists

`bunfig.toml` used to carry:

```toml
[test.moduleNameMapper]
"vscode" = "./src/__mocks__/vscode.ts"
```

`moduleNameMapper` is a **Jest** key. Bun does not read it, so the mapping never
happened - and because no test imported a `vscode`-dependent module, nothing ever
failed to reveal that. The consequence was severe: of 265 source files, only the
41 pure-logic ones were reachable from tests. The other 224 were not scored 0%,
they were **absent from the coverage report entirely**, and Bun's average over the
reachable 15% read 99.64%.

Every bug found in the September 2026 audit lived in those 224 files.

### Why a package rather than a plugin

Bun's runtime `plugin()` / `onResolve` does not intercept **bare specifiers** - a
preload plugin filtering `/^vscode$/` registers fine and is simply never called,
so `import 'vscode'` still fails to resolve. A real package in `node_modules` is
what Bun's resolver actually honours.

### How it type-checks

The shim package deliberately ships **no** type declarations and sets no `types`
field. TypeScript therefore finds no types on the package and falls through to
`@types/vscode`, which declares the module ambiently - so `tsc --noEmit` checks
against the real API while Bun resolves the runtime value to
`src/__mocks__/vscode.ts`.

### It never ships

`esbuild.mjs` marks `vscode` external, and `.vscodeignore` excludes `test-shims/`,
so this folder is absent from the `.vsix`.

### Extending the mock

Add to `src/__mocks__/vscode.ts`. It is a working fake, not a stub wall:
`Position`/`Range`/`Selection` carry real semantics, `DiagnosticCollection` really
stores, and the `window.show*` prompts record what the user was shown. Use
`__reset()` between tests, `queued.*` to answer prompts, and `recorded.*` to
assert on them.
