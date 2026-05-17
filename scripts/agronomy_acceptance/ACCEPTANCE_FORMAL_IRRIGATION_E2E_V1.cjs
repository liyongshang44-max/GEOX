#!/usr/bin/env node
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const entry = path.join(__dirname, 'ACCEPTANCE_FORMAL_IRRIGATION_E2E_V1.ts');
const args = process.argv.slice(2);
const result = spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'tsx', entry, ...args],
  { stdio: 'inherit', cwd: process.cwd(), env: process.env },
);
process.exit(result.status ?? 1);
