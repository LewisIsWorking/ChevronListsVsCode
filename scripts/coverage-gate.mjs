#!/usr/bin/env node
/**
 * coverage-gate.mjs -- enforces the repository coverage policy.
 *
 * Policy is 100% coverage with no exclusions. This gate is a RATCHET towards
 * that: it fails when coverage drops below the recorded floor in
 * coverage-policy.json, so the number can only ever go up. Raise the floor as
 * tests land; never lower it.
 *
 * Why a custom gate rather than Bun's own `coverageThreshold`: Bun applies its
 * threshold PER FILE. With any file at 0% the only value that passes is 0, so it
 * cannot express a global floor while the codebase is mid-ratchet. Verified: a
 * threshold of `{ lines = 0.10 }` still fails at 24.61% global coverage.
 *
 * Once every file reaches 100%, Bun's native per-file check becomes the simpler
 * enforcement and this script can be retired for:
 *     coverageThreshold = { lines = 1.0, functions = 1.0 }
 *
 * NOTE the plural keys. Bun accepts `lines`/`functions`; the singular
 * `line`/`function` are accepted by the TOML parser and then silently ignored,
 * which fails open. If you edit that config, verify it still fails by raising it
 * above actual coverage -- do not assume it is wired up.
 *
 * Run: node scripts/coverage-gate.mjs
 * (expects `bun test --coverage --coverage-reporter=lcov` to have run first)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const LCOV   = resolve('coverage/lcov.info');
const POLICY = resolve('coverage-policy.json');

if (!existsSync(LCOV)) {
  console.error('coverage/lcov.info not found. Run: bun run test:coverage');
  process.exit(1);
}

const policy = JSON.parse(readFileSync(POLICY, 'utf8'));

/**
 * Files that are not production code. This is NOT a policy exclusion -- these
 * are test infrastructure, the same category as the test files Bun already
 * skips. Every file that ships to a user is measured.
 */
const isTestInfra = (f) =>
  f.includes('__mocks__') || f.includes('__tests__') || f.includes('test-shims');

// ------------------------------------------------------------- parse lcov
// Bun emits FNF/FNH (functions) and DA (lines). It emits NO BRDA/BRF/BRH,
// so branch coverage is not measurable with this runner -- see README.
const files = [];
let cur = null;
for (const raw of readFileSync(LCOV, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (line.startsWith('SF:')) {
    cur = { file: line.slice(3).replace(/\\/g, '/'), fnf: 0, fnh: 0, lines: 0, hit: 0 };
  } else if (!cur) {
    continue;
  } else if (line.startsWith('FNF:')) {
    cur.fnf = Number(line.slice(4));
  } else if (line.startsWith('FNH:')) {
    cur.fnh = Number(line.slice(4));
  } else if (line.startsWith('DA:')) {
    const [, count] = line.slice(3).split(',');
    cur.lines += 1;
    if (Number(count) > 0) cur.hit += 1;
  } else if (line === 'end_of_record') {
    if (!isTestInfra(cur.file)) files.push(cur);
    cur = null;
  }
}

if (files.length === 0) {
  console.error('No production files found in lcov.info -- refusing to pass a gate on nothing.');
  process.exit(1);
}

// ------------------------------------------------------------- totals
const sum = (k) => files.reduce((a, f) => a + f[k], 0);
const pct = (h, t) => (t === 0 ? 100 : (h / t) * 100);

const lineePct = pct(sum('hit'), sum('lines'));
const funcPct  = pct(sum('fnh'), sum('fnf'));

const belowTarget = files
  .filter((f) => pct(f.hit, f.lines) < 100)
  .sort((a, b) => pct(a.hit, a.lines) - pct(b.hit, b.lines));

// ------------------------------------------------------------- report
const fmt = (n) => n.toFixed(2).padStart(6);
console.log('');
console.log('Coverage gate');
console.log('-------------');
console.log(`  files measured : ${files.length}`);
console.log(`  lines          : ${fmt(lineePct)}%   floor ${fmt(policy.floor.line)}%   target ${fmt(policy.target.line)}%`);
console.log(`  functions      : ${fmt(funcPct)}%   floor ${fmt(policy.floor.function)}%   target ${fmt(policy.target.function)}%`);
console.log(`  branches       :    n/a    -- ${policy.branchNote}`);
console.log(`  files at 100%  : ${files.length - belowTarget.length} / ${files.length}`);
console.log('');

if (belowTarget.length > 0) {
  console.log(`  ${belowTarget.length} file(s) below the 100% target. Lowest 15:`);
  for (const f of belowTarget.slice(0, 15)) {
    console.log(`    ${fmt(pct(f.hit, f.lines))}%  ${f.file}`);
  }
  console.log('');
}

// ------------------------------------------------------------- verdict
const failures = [];
if (lineePct + 1e-9 < policy.floor.line) {
  failures.push(`line coverage ${lineePct.toFixed(2)}% is below the floor of ${policy.floor.line}%`);
}
if (funcPct + 1e-9 < policy.floor.function) {
  failures.push(`function coverage ${funcPct.toFixed(2)}% is below the floor of ${policy.floor.function}%`);
}

if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  console.error('');
  console.error('Coverage regressed. Add tests, or justify the change -- do not lower the floor.');
  process.exit(1);
}

// Nudge the floor upwards when real coverage has moved well past it, so the
// ratchet does not silently go slack after a batch of tests lands.
const slack = Math.min(lineePct - policy.floor.line, funcPct - policy.floor.function);
if (slack > policy.slackWarning) {
  console.log(`NOTE: coverage is ${slack.toFixed(2)} points above the floor.`);
  console.log('      Raise "floor" in coverage-policy.json to lock the gain in.');
  console.log('');
}

console.log('Coverage gate passed.');
