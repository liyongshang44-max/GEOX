#!/usr/bin/env node
const { spawnSync } = require('child_process');
const scripts = [
  'ci:frontend:operator-twin-overview-canonical',
  'ci:frontend:operator-field-twin-workspace-canonical',
  'ci:frontend:operator-field-twin-forecast-panel-canonical',
  'ci:frontend:operator-field-twin-scenario-compare-canonical',
];
for (const script of scripts) {
  const result = spawnSync('pnpm', ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('[operator-twin-runtime-suite] PASS');
