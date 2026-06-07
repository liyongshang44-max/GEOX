#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const result = spawnSync('pnpm', ['-w', 'exec', 'tsx', 'apps/web/src/viewmodels/customerC8FormalReportVm.test.ts'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  console.error('[ACCEPTANCE_C8_CUSTOMER_REPORT_API_SOURCE_V1] FAIL');
  process.exit(result.status || 1);
}
console.log('[ACCEPTANCE_C8_CUSTOMER_REPORT_API_SOURCE_V1] PASS');
