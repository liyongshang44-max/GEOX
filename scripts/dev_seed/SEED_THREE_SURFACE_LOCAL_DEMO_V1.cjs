#!/usr/bin/env node
// Compatibility entrypoint for the historical local-demo command.
// The implementation is now a real, development-only MCFT-CAP-07 data loader rather than a contract placeholder.
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(
  executable,
  ['exec', 'tsx', path.join(__dirname, 'seed_three_surface_local_demo_v1.ts'), ...process.argv.slice(2)],
  { cwd: root, env: process.env, stdio: 'inherit' },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
