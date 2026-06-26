'use strict';

// scripts/governance_acceptance/ACCEPTANCE_H55_ACCEPTANCE_BOUNDARY_V1.cjs
// Purpose: wrap the existing acceptance-result-from-evidence-artifacts runtime for the H55 line.

const { execFileSync } = require('node:child_process');

const ACCEPTANCE = 'ACCEPTANCE_H55_ACCEPTANCE_BOUNDARY_V1';
const EXISTING_RUNTIME = 'scripts/runtime_acceptance/ACCEPTANCE_RESULT_FROM_EVIDENCE_ARTIFACTS_V1_RUNTIME.cjs';
const EXPECTED_TAIL = 'PASS H44 runtime acceptance';

function fail(error, details = {}) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error, details }, null, 2));
  process.exit(1);
}

try {
  const env = {
    ...process.env,
    GEOX_ACCEPTANCE_TOKEN:
      process.env.GEOX_ACCEPTANCE_TOKEN ||
      process.env.GEOX_TOKEN ||
      process.env.GEOX_AO_ACT_TOKEN ||
      'set-via-env-or-external-secret-file-operator',
    GEOX_EXECUTOR_ACCEPTANCE_TOKEN:
      process.env.GEOX_EXECUTOR_ACCEPTANCE_TOKEN || 'set-via-env-or-external-secret-file-executor',
    GEOX_APPROVER_ONLY_TOKEN:
      process.env.GEOX_APPROVER_ONLY_TOKEN || 'set-via-env-or-external-secret-file-approver',
    GEOX_CLIENT_TOKEN: process.env.GEOX_CLIENT_TOKEN || 'set-via-env-or-external-secret-file-client',
    GEOX_VIEWER_TOKEN: process.env.GEOX_VIEWER_TOKEN || 'set-via-env-or-external-secret-file-viewer',
  };
  const output = execFileSync(process.execPath, [EXISTING_RUNTIME], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!output.includes(EXPECTED_TAIL)) fail('EXISTING_RUNTIME_DID_NOT_PASS', { output });
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, acceptance_boundary_runtime: 'PASS', acceptance_created: true, verification_created: false, roi_created: false, field_memory_created: false }, null, 2));
} catch (error) {
  fail(error.message);
}
