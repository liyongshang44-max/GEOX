'use strict';

// scripts/governance_acceptance/ACCEPTANCE_H54_7_AS_EXECUTED_LINKAGE_V1.cjs
// Purpose: wrap the existing as-executed-from-completion runtime for the H54.7 task line.

const { execFileSync } = require('node:child_process');

const ACCEPTANCE = 'ACCEPTANCE_H54_7_AS_EXECUTED_LINKAGE_V1';
const EXISTING_RUNTIME = 'scripts/runtime_acceptance/ACCEPTANCE_AS_EXECUTED_FROM_AO_ACT_RECEIPT_V1_RUNTIME.cjs';
const EXPECTED_TAIL = 'ACCEPTANCE_AS_EXECUTED_FROM_AO_ACT_RECEIPT_V1_RUNTIME passed';

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
  if (!output.includes(EXPECTED_TAIL)) fail('EXISTING_RUNTIME_DID_NOT_PASS', { output });
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, as_executed_linkage_runtime: 'PASS', as_executed_created: true, as_applied_created: true, evidence_artifact_created: false, acceptance_created: false, roi_created: false, field_memory_created: false }, null, 2));
} catch (error) {
  fail(error.message);
}
