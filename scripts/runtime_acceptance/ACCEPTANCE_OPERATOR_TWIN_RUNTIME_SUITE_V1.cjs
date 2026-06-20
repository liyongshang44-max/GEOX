#!/usr/bin/env node
const { spawnSync } = require('child_process');

const checks = [
  ['frontend canonical overview', 'ci:frontend:operator-twin-overview-canonical'],
  ['frontend canonical field workspace', 'ci:frontend:operator-field-twin-workspace-canonical'],
  ['frontend canonical forecast panel', 'ci:frontend:operator-field-twin-forecast-panel-canonical'],
  ['frontend canonical scenario compare', 'ci:frontend:operator-field-twin-scenario-compare-canonical'],
  ['runtime overview/read API', 'ci:runtime:operator-twin-read-api'],
  ['runtime field workspace shape', 'ci:runtime:operator-field-twin-workspace-shape'],
  ['runtime forecast panel shape', 'ci:runtime:operator-field-twin-forecast-panel-shape'],
  ['runtime scenario compare shape', 'ci:runtime:operator-field-twin-scenario-compare-shape'],
  ['runtime evidence quality shape', 'ci:runtime:operator-field-twin-evidence-quality-shape'],
  ['runtime calibration replay shape', 'ci:runtime:operator-field-twin-calibration-replay-shape'],
];

for (const [label, script] of checks) {
  console.log(`[operator-twin-runtime-suite] RUN ${label}: ${script}`);
  const result = spawnSync('pnpm', ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`[operator-twin-runtime-suite] FAIL ${label}: ${script}`);
    process.exit(result.status || 1);
  }
  console.log(`[operator-twin-runtime-suite] PASS ${label}: ${script}`);
}

console.log('[operator-twin-runtime-suite] PASS');
