#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = process.cwd();
const scripts = [
  'scripts/governance_acceptance/ACCEPTANCE_BASE_CONTRACT_NEGATIVE_CHAIN_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_FLIGHT_TABLE_NOT_CUSTOMER_VALID_CHAIN_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_ROI_MEMORY_TRUST_LANE_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_FIELD_MEMORY_TRUST_LANE_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_OPERATOR_LEARNING_NOT_OBJECT_EXISTENCE_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_OPERATOR_BACKEND_LEARNING_VALIDATION_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_LEGACY_DIAGNOSTICS_LEARNING_BOUNDARY_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_FRONTEND_CUSTOMER_TRUST_GATE_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_VARIABLE_TASK_NOT_AUTO_ACKED_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_CONTRACT_ALIGNMENT_V1.cjs',
];

const results = [];
for (const rel of scripts) {
  const abs = path.join(root, rel);
  const result = spawnSync(process.execPath, [abs], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  results.push({ script: rel, status: result.status, stdout: result.stdout, stderr: result.stderr });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(`[BASE_CONTRACT_NEGATIVE_RELEASE_GATE_V1] FAILED at ${rel}`);
    process.exit(result.status || 1);
  }
}

console.log('[BASE_CONTRACT_NEGATIVE_RELEASE_GATE_V1] PASSED');
console.log(`[BASE_CONTRACT_NEGATIVE_RELEASE_GATE_V1] Ran ${results.length} static governance negative gates.`);
