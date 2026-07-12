'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const json = (relativePath) => JSON.parse(read(relativePath));
const pass = [];
const ok = (message) => {
  pass.push(message);
  console.log(`PASS ${message}`);
};

const matrixPath = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const mapPath = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';
const taskPath = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md';
const statusPath = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-P0-STATUS.json';
const acceptancePath = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_P0_PREDECESSOR_SSOT.cjs';
const mainVerificationPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json';
const finalVerificationPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-FINAL-VERIFICATION.json';

const expectedBoundary = [
  matrixPath,
  mapPath,
  taskPath,
  statusPath,
  acceptancePath,
].sort();

const mainVerification = json(mainVerificationPath);
const finalVerification = json(finalVerificationPath);
assert.equal(mainVerification.status, 'VERIFIED_ON_MAIN');
assert.equal(mainVerification.verified_on_main, true);
assert.equal(mainVerification.closure_effective, true);
assert.equal(mainVerification.capability_complete, true);
assert.equal(mainVerification.post_completion_remediation_verification.r4_a_status, 'MERGED_EFFECTIVE');
assert.equal(mainVerification.post_completion_remediation_verification.r4_b_status, 'MERGED_EFFECTIVE');
assert.equal(mainVerification.post_completion_remediation_verification.r4_c_status, 'MERGED_EFFECTIVE');
assert.equal(mainVerification.post_completion_remediation_verification.remaining_nonconformant_hard_acceptance_count, 0);
assert.equal(mainVerification.post_completion_remediation_verification.remaining_unadjudicated_contract_deviation_count, 0);
assert.equal(finalVerification.status, 'VERIFIED_ON_MAIN');
assert.equal(finalVerification.effectiveness_condition_satisfied, true);
assert.equal(finalVerification.task_conformance.remaining_nonconformant_count, 0);
assert.equal(finalVerification.task_conformance.remaining_unadjudicated_contract_deviation_count, 0);
ok('CAP-03 predecessor evidence is complete, effective, and task-conformant');

const matrix = json(matrixPath);
const cap03 = matrix.capability_lines.find((entry) => entry.capability_line_id === 'MCFT-CAP-03');
const cap04 = matrix.capability_lines.find((entry) => entry.capability_line_id === 'MCFT-CAP-04');
assert.ok(cap03);
assert.equal(cap03.status, 'COMPLETE');
assert.equal(cap03.implementation_status, 'VERIFIED_ON_MAIN');
assert.equal(cap03.authorization_status, 'EFFECTIVE');
assert.equal(cap03.authorization_effective, true);
assert.equal(cap03.runtime_source_authorized, true);
assert.equal(cap03.closure_effective, true);
assert.equal(cap03.capability_complete, true);
assert.equal(cap03.active_delivery_slice_id, null);
assert.deepEqual(cap03.pending_completion_claims, []);
assert.equal(cap03.successor_capability_line_id, 'MCFT-CAP-04');
assert.equal(cap03.successor_authorized, false);
const cap03Serialized = JSON.stringify(cap03);
assert.equal(cap03Serialized.includes('READY_FOR_MERGE'), false);
assert.equal(cap03Serialized.includes('FINALIZATION_READY'), false);
ok('global matrix reconciles CAP-03 to effective merged-main SSOT');

assert.ok(cap04);
assert.equal(cap04.status, 'NOT_AUTHORIZED');
assert.equal(cap04.design_status, 'FINAL_FROZEN_CANDIDATE_V0_5');
assert.equal(cap04.implementation_status, 'NOT_AUTHORIZED');
assert.equal(cap04.authorization_status, 'NOT_AUTHORIZED');
assert.equal(cap04.authorization_effective, false);
assert.equal(cap04.runtime_source_authorized, false);
assert.equal(cap04.successor_authorized, false);
assert.equal(cap04.delivery_slices[0].delivery_slice_id, 'MCFT-CAP-04.P0.PREDECESSOR-SSOT-AND-TASK-FREEZE-V1');
assert.equal(cap04.delivery_slices[0].status, 'READY_FOR_MERGE');
for (const slice of cap04.delivery_slices.slice(1)) {
  assert.equal(slice.status, 'BLOCKED', `${slice.delivery_slice_id} must remain BLOCKED`);
}
ok('CAP-04 remains unauthorized and only the governance P0 slice is merge-ready');

const task = read(taskPath);
for (const token of [
  'previous posterior State',
  'runtime_config_ref',
  'runtime_config_hash',
  'latest_successful_forecast_ref: string | null',
  'evidence_window_ref',
  'state_transition_ref',
  'assimilation_update_ref',
  'posterior_state_ref',
  'forecast_result_ref',
  'checkpoint_ref',
  'health.payload.tick_ref',
  'Weather Evidence refs',
  'ET0 Evidence refs',
  'P42',
  'P50',
  'REFERENCE_ONLY',
  'REUSE_WITH_ADAPTER',
  'REUSE_AS_IS',
  'EXTRACT_ALGORITHM',
  'REPLACE',
  'apps/server/src/projections/root_zone_soil_water_forecast_v1.ts',
  'apps/server/src/projections/root_zone_irrigation_scenario_set_v1.ts',
  'apps/server/src/projections/irrigation_scenario_set_v1.ts',
  'assumption_ref` is forbidden',
  'S10A',
  'S10B',
  'S10C',
]) {
  assert.ok(task.includes(token), `missing frozen task token: ${token}`);
}
for (const forbidden of [
  'active_runtime_config_ref',
  'latest_active_runtime_config',
  'selectActiveRuntimeConfig',
]) {
  assert.equal(task.includes(forbidden), false, `forbidden Runtime Config lookup marker: ${forbidden}`);
}
ok('CAP-04 task freezes Runtime Config, Tick-root, provenance, reuse, projection, identity, and finalization corrections');

const map = read(mapPath);
assert.ok(map.includes('<!-- MCFT-CAP-04-P0-AUTHORITY-START -->'));
assert.ok(map.includes('implementation_status: VERIFIED_ON_MAIN'));
assert.ok(map.includes('design_status: FINAL_FROZEN_CANDIDATE_V0_5'));
assert.ok(map.includes('S10C'));
ok('implementation map records the reconciled predecessor and serial CAP-04 lifecycle');

const status = json(statusPath);
assert.equal(status.status, 'P0_READY_FOR_MERGE');
assert.equal(status.effectiveness_condition_satisfied, false);
assert.equal(status.authorization_effective, false);
assert.equal(status.runtime_source_authorized, false);
assert.equal(status.predecessor.status, 'VERIFIED_ON_MAIN');
assert.equal(status.predecessor.remaining_nonconformant_hard_acceptance_count, 0);
assert.equal(status.predecessor.remaining_unadjudicated_contract_deviation_count, 0);
assert.deepEqual([...status.exact_changed_file_boundary].sort(), expectedBoundary);
ok('P0 status preserves the exact five-file boundary and non-effective state');

if (process.argv.includes('--enforce-diff')) {
  const output = execFileSync(
    'git',
    ['diff', '--name-only', 'origin/main'],
    { cwd: root, encoding: 'utf8' },
  );
  const changed = output.split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, expectedBoundary);
  const forbiddenPrefixes = [
    'apps/server/src/runtime/',
    'apps/server/src/routes/',
    'apps/server/src/db/',
    'apps/web/',
    'migrations/',
  ];
  for (const file of changed) {
    assert.equal(
      forbiddenPrefixes.some((prefix) => file.startsWith(prefix)),
      false,
      `unauthorized P0 file: ${file}`,
    );
  }
  ok('working-tree diff is exactly the five authorized governance files');
}

console.log(`MCFT-CAP-04 P0 predecessor SSOT acceptance: ${pass.length} PASS, 0 FAIL`);
