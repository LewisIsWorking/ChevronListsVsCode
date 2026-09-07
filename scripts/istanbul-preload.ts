/**
 * istanbul-preload.ts -- gives `bun test` real BRANCH coverage.
 *
 * Bun's built-in coverage is line + function only; its lcov output carries no
 * BRDA/BRF/BRH records, because JavaScriptCore tracks basic execution blocks
 * rather than AST branches (oven-sh/bun#7100). That is a limitation of Bun's
 * *reporter*, not of Bun as a runner -- so instead of changing runners we
 * instrument the source ourselves and let Bun execute the instrumented code.
 *
 * Bun's plugin `onLoad` hook does fire for relative file imports (unlike
 * `onResolve`, which never sees bare specifiers -- see test-shims/README.md).
 * We transform each production .ts on load with istanbul-lib-instrument, which
 * injects the standard `__coverage__` counters including branch counters.
 *
 * scripts/coverage-gate.mjs then reads the dumped map and enforces the policy.
 */
import { plugin } from 'bun';
import { createInstrumenter } from 'istanbul-lib-instrument';
import { afterAll } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const SRC = resolve(ROOT, 'src');

/** Test infrastructure is not production code and is never instrumented. */
function isProductionSource(file: string): boolean {
  if (!file.startsWith(SRC)) return false;
  const rel = relative(SRC, file).split(sep).join('/');
  return !rel.startsWith('__tests__/') && !rel.startsWith('__mocks__/');
}

const instrumenter = createInstrumenter({
  esModules: true,
  compact: true,
  produceSourceMap: false,
  coverageVariable: '__coverage__',
  // istanbul parses with Babel configured for plain JavaScript by default, so
  // the very first `import type { ... }` throws "Unexpected token, expected
  // from". The TypeScript plugin is required, and the rest cover the syntax
  // this codebase actually uses.
  parserPlugins: [
    'typescript',
    'classProperties',
    'optionalChaining',
    'nullishCoalescingOperator',
    'objectRestSpread',
    'topLevelAwait',
  ],
});

plugin({
  name: 'istanbul-branch-coverage',
  setup(build) {
    // NOTE: onLoad fires for EVERY .ts, test files included, and returning
    // undefined does not mean "pass through" -- it blanks the module and the
    // run dies with no output. Always return contents; only instrument
    // production source.
    build.onLoad({ filter: /\.ts$/ }, (args) => {
      const source = readFileSync(args.path, 'utf8');
      if (!isProductionSource(args.path)) {
        return { contents: source, loader: 'ts' as const };
      }
      return {
        contents: instrumenter.instrumentSync(source, args.path),
        loader: 'ts' as const,
      };
    });
  },
});

// Dump the accumulated counters once the suite finishes.
//
// This uses bun:test's afterAll, NOT process.on('exit'): under `bun test` the
// exit hook never runs, so an exit-based dump silently produces nothing while
// every test still passes. __coverage__ accumulates across the whole run in one
// process, so the final write holds the complete map.
afterAll(() => {
  const map = (globalThis as { __coverage__?: unknown }).__coverage__;
  if (!map) return;
  try {
    mkdirSync(resolve(ROOT, 'coverage'), { recursive: true });
    writeFileSync(resolve(ROOT, 'coverage/coverage-final.json'), JSON.stringify(map), 'utf8');
  } catch {
    // Never fail the test run over reporting.
  }
});
