'use strict';

// scripts/governance_acceptance/ACCEPTANCE_H54_8_EVIDENCE_ARTIFACT_LINKAGE_V1.cjs
// Purpose: wrap the existing evidence-artifact-from-as-executed runtime for the H54.8 task line.

const { execFileSync } = require('node:child_process');

const ACCEPTANCE = 'ACCEPTANCE_H54_8_EVIDENCE_ARTIFACT_LINKAGE_V1';
const EXISTING_RUNTIME = 'scripts/runtime_acceptance/ACCEPTANCE_EVIDENCE_ARTIFACT_FROM_AS_EXECUTED_V1_RUNTIME.cjs';

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
  if (!output.includes('EVIDENCE_ARTIFACTS_RECORDED')) fail('EXISTING_RUNTIME_DID_NOT_PASS', { output });
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, evidence_artifact_linkage_runtime: 'PASS', evidence_artifact_created: true, acceptance_created: false, verification_created: false, roi_created: false, field_memory_created: false }, null, 2));
} catch (error) {
  fail(error.message);
}
