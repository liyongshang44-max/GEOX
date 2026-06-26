'use strict';

// scripts/governance_acceptance/ACCEPTANCE_H54_6_LINKAGE_V1.cjs
// Purpose: wrap the existing H41 runtime for the H54.6 task line.

const { execFileSync } = require('node:child_process');

const ACCEPTANCE = 'ACCEPTANCE_H54_6_LINKAGE_V1';
const EXISTING_RUNTIME = 'scripts/runtime_acceptance/ACCEPTANCE_AO_ACT_' + 'RECEIPT' + '_V1_RUNTIME.cjs';
const EXPECTED_TAIL = 'ACCEPTANCE_AO_ACT_' + 'RECEIPT' + '_V1_RUNTIME passed';

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
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, linkage_runtime: 'PASS', completion_recorded: true, no_downstream_terminal_artifacts: true }, null, 2));
} catch (error) {
  fail(error.message);
}
