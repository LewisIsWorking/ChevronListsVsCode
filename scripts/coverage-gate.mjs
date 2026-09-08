#!/usr/bin/env node
/**
 * coverage-gate.mjs -- enforces the repository coverage policy.
 *
 * Policy is 100% coverage, no exclusions, on all four metrics: statements,
 * branches, functions and lines. This gate is a RATCHET towards that: it fails
 * when any metric drops below the floor recorded in coverage-policy.json, so
 * the numbers can only go up. Raise the floors as tests land; never lower them.
 *
 * Reads coverage/coverage-final.json -- the standard istanbul coverage map,
 * written by scripts/istanbul-preload.ts during `bun test`.
 *
 * Why not Bun's built-in coverage:
 *   * Its lcov output carries no BRDA/BRF/BRH records, so BRANCH coverage is
 *     absent entirely (oven-sh/bun#7100). Branch is half the policy.
 *   * Its `coverageThreshold` is applied PER FILE, so with any file at 0% the
 *     only value that passes is 0 -- it cannot express a global floor while the
 *     codebase is mid-ratchet.
 *   * Its headline percentage is an unweighted MEAN of per-file percentages,
 *     which on this repo reads ~19 points higher than the weighted truth.
 *
 * Bun is still the test runner; only the measurement is istanbul's.
 *
 * Run: node scripts/coverage-gate.mjs   (after `bun test`)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MAP    = resolve('coverage/coverage-final.json');
const POLICY = resolve('coverage-policy.json');

if (!existsSync(MAP)) {
  console.error('coverage/coverage-final.json not found. Run: bun test src/__tests__');
  console.error('(scripts/istanbul-preload.ts writes it via an afterAll hook.)');
  process.exit(1);
}

const policy = JSON.parse(readFileSync(POLICY, 'utf8'));
const map    = JSON.parse(readFileSync(MAP, 'utf8'));

/**
 * Test infrastructure is not production code. This is NOT a policy exclusion --
 * the instrumenter already skips __tests__ and __mocks__; this is belt and
 * braces. Every file that ships to a user is measured.
 */
const isTestInfra = (f) => {
  const p = f.replace(/\\/g, '/');
  return p.includes('/__tests__/') || p.includes('/__mocks__/') || p.includes('/test-shims/');
};

// ------------------------------------------------------------------ tally
const totals = { statements: [0, 0], branches: [0, 0], functions: [0, 0], lines: [0, 0] };
const perFile = [];

for (const [file, cov] of Object.entries(map)) {
  if (isTestInfra(file)) continue;

  const s = Object.values(cov.s ?? {});
  const f = Object.values(cov.f ?? {});
  // Each entry in `b` is an array with one counter per path of that branch,
  // so an if/else contributes two paths and both must be taken for 100%.
  const b = Object.values(cov.b ?? {}).flat();

  // Lines are derived from statement counters grouped by their start line:
  // a line counts as covered when any statement on it ran.
  const byLine = new Map();
  for (const [id, meta] of Object.entries(cov.statementMap ?? {})) {
    const line = meta.start.line;
    byLine.set(line, (byLine.get(line) ?? 0) + (cov.s?.[id] ?? 0));
  }
  const lineHits = [...byLine.values()];

  const pairs = {
    statements: [s.filter((n) => n > 0).length, s.length],
    branches:   [b.filter((n) => n > 0).length, b.length],
    functions:  [f.filter((n) => n > 0).length, f.length],
    lines:      [lineHits.filter((n) => n > 0).length, lineHits.length],
  };

  for (const k of Object.keys(totals)) {
    totals[k][0] += pairs[k][0];
    totals[k][1] += pairs[k][1];
  }

  perFile.push({ file: file.replace(/\\/g, '/').replace(/^.*\/src\//, 'src/'), pairs });
}

if (perFile.length === 0) {
  console.error('No production files in the coverage map -- refusing to pass a gate on nothing.');
  process.exit(1);
}

const pct = ([hit, tot]) => (tot === 0 ? 100 : (hit / tot) * 100);
const fmt = (n) => n.toFixed(2).padStart(6);

// ----------------------------------------------------------------- report
const METRICS = ['statements', 'branches', 'functions', 'lines'];
const actual = Object.fromEntries(METRICS.map((m) => [m, pct(totals[m])]));

console.log('');
console.log('Coverage gate');
console.log('-------------');
console.log(`  files measured : ${perFile.length}`);
for (const m of METRICS) {
  console.log(
    `  ${m.padEnd(11)}: ${fmt(actual[m])}%   floor ${fmt(policy.floor[m])}%   ` +
    `target ${fmt(policy.target[m])}%   (${totals[m][0]}/${totals[m][1]})`
  );
}

const incomplete = perFile
  .filter((f) => METRICS.some((m) => pct(f.pairs[m]) < 100))
  .sort((a, b) => pct(a.pairs.lines) - pct(b.pairs.lines));

console.log(`  files at 100%  : ${perFile.length - incomplete.length} / ${perFile.length}`);
console.log('');

if (incomplete.length > 0) {
  console.log(`  ${incomplete.length} file(s) short of 100%. Lowest 15 by line coverage:`);
  for (const f of incomplete.slice(0, 15)) {
    console.log(
      `    lines ${fmt(pct(f.pairs.lines))}%  branches ${fmt(pct(f.pairs.branches))}%  ${f.file}`
    );
  }
  console.log('');
}

// ---------------------------------------------------------------- verdict
const failures = METRICS
  .filter((m) => actual[m] + 1e-9 < policy.floor[m])
  .map((m) => `${m} coverage ${actual[m].toFixed(2)}% is below the floor of ${policy.floor[m]}%`);

if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  console.error('');
  console.error('Coverage regressed. Add tests -- do not lower the floor.');
  process.exit(1);
}

const slack = Math.min(...METRICS.map((m) => actual[m] - policy.floor[m]));
if (slack > policy.slackWarning) {
  console.log(`NOTE: every metric is at least ${slack.toFixed(2)} points above its floor.`);
  console.log('      Raise "floor" in coverage-policy.json to lock the gain in.');
  console.log('');
}

console.log('Coverage gate passed.');
