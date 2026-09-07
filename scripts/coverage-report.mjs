#!/usr/bin/env node
/**
 * coverage-report.mjs -- renders the standard istanbul reports.
 *
 * Proof that `bun test` + scripts/istanbul-preload.ts produces a genuine
 * istanbul coverage map: these are istanbul's own reporters, the exact ones
 * `vitest --coverage.provider=istanbul` and `nyc` use. If they render it, the
 * data is not an approximation of istanbul's -- it IS istanbul's.
 *
 * Outputs:
 *   coverage/index.html    browsable, line- and branch-annotated source
 *   coverage/lcov.info     lcov WITH BRDA/BRF/BRH (Bun's own lcov has none)
 *   stdout                 text summary
 *
 * Run: node scripts/coverage-report.mjs   (after `bun test`)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import libCoverage from 'istanbul-lib-coverage';
import { createContext } from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const MAP = resolve('coverage/coverage-final.json');
if (!existsSync(MAP)) {
  console.error('coverage/coverage-final.json not found. Run: bun test src/__tests__');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(MAP, 'utf8'));

// Drop test infrastructure, matching the gate.
const isTestInfra = (f) => {
  const p = f.replace(/\\/g, '/');
  return p.includes('/__tests__/') || p.includes('/__mocks__/') || p.includes('/test-shims/');
};
const filtered = Object.fromEntries(Object.entries(raw).filter(([f]) => !isTestInfra(f)));

const map = libCoverage.createCoverageMap(filtered);
const context = createContext({ dir: resolve('coverage'), coverageMap: map });

for (const name of ['html', 'lcovonly', 'text-summary']) {
  reports.create(name, name === 'lcovonly' ? { file: 'lcov.info' } : {}).execute(context);
}

console.log('');
console.log('Wrote coverage/index.html and coverage/lcov.info');
