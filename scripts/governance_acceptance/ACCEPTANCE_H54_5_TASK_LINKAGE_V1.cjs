'use strict';

// scripts/governance_acceptance/ACCEPTANCE_H54_5_TASK_LINKAGE_V1.cjs
// Purpose: wrap the existing ready-operation-plan task runtime for the H54.5 task line.

const { execFileSync } = require('node:child_process');

const ACCEPTANCE = 'ACCEPTANCE_H54_5_TASK_LINKAGE_V1';
const EXISTING_RUNTIME = 'scripts/runtime_acceptance/ACCEPTANCE_TASK_FROM_READY_OPERATION_PLAN_RUNTIME_V1.cjs';

function fail(error, details = {}) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error, details }, null, 2));
  process.exit(1);
}

try {
  const output = execFileSync(process.execPath, [EXISTING_RUNTIME], {
    cwd: process.cwd(),
    env: { ...process.env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!output.includes('[task-from-ready-operation-plan-runtime] PASS')) {
    fail('EXISTING_RUNTIME_DID_NOT_PASS', { output });
  }
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, task_linkage_runtime: 'PASS', task_created: true, receipt_created: false, acceptance_created: false, verification_created: false, roi_created: false, field_memory_created: false }, null, 2));
} catch (error) {
  fail(error.message);
}
