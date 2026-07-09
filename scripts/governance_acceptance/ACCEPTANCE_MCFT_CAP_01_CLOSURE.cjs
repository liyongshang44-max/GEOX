// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_01_CLOSURE.cjs
// Purpose: validate the governance-only MCFT-CAP-01 closure candidate, predecessor evidence, bounded claims, owner work-package statuses, and changed-file boundary.
// Boundary: static governance acceptance only; no Replay execution, State computation, PostgreSQL access, canonical write, Runtime source change, propagation, Forecast success, Scenario, Recommendation, Decision, or AO-ACT.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '4a0fd03beb05298028101a4999c67a5e053dadb8';
const CAPABILITY = 'MCFT-CAP-01';
const CLOSURE_SLICE = 'MCFT-CAP-01.CLOSURE-V1';
const EXPECTED_HASHES = {
  reality_binding_hash: 'sha256:bf1da664164a4fedda249bcb0e330c1af2083173a52bd704f01eac3ad277ba4f',
  source_matrix_hash: 'sha256:c5187c23be0d058ffa23d464ae1139f924f5af064a270248746fbabde4c3e51b',
  configuration_matrix_hash: 'sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5',
  geometry_semantic_hash: 'sha256:d3dbc5495485e7af68acdc4b32e6061c2ea99772835be2805ae706b74d75ca51',
};

let pass = 0;
let fail = 0;
function check(value, message) {
  if (value) {
    pass += 1;
    console.log(`PASS ${message}`);
  } else {
    fail += 1;
    console.error(`FAIL ${message}`);
  }
}
function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}
function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const delivery = readJson('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS.json');
const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const record = readJson('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-CLOSURE-RECORD.json');
const closureDoc = readText('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-CLOSURE.md');
const implementationMap = readText('docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md');
const s3bStatus = readJson('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-S3B-STATUS.json');
const s4Status = readJson('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-S4-STATUS.json');

check(delivery.capability_line_id === CAPABILITY, 'delivery status capability identity');
check(delivery.status === 'IN_IMPLEMENTATION', 'capability remains IN_IMPLEMENTATION before closure merge');
check(delivery.runtime_delivery_main_commit === BASELINE, 'runtime delivery main commit is exact');
check(delivery.active_delivery_slice_id === CLOSURE_SLICE, 'closure is the only active slice');
check(Array.isArray(delivery.next_authorized_slice_ids) && delivery.next_authorized_slice_ids.length === 0, 'no successor slice is implicitly authorized');
check(delivery.slices.length === 6, 'exact delivery-slice count is six including closure');
const predecessorSlices = delivery.slices.filter((slice) => slice.delivery_slice_id !== CLOSURE_SLICE);
check(predecessorSlices.length === 5, 'exact predecessor slice count is five');
check(predecessorSlices.every((slice) => slice.status === 'COMPLETE'), 'all five predecessor slices remain COMPLETE');
const closureSlice = delivery.slices.find((slice) => slice.delivery_slice_id === CLOSURE_SLICE);
check(closureSlice?.status === 'IN_IMPLEMENTATION', 'closure slice is not prematurely COMPLETE');
check(closureSlice?.primary_owner_work_package_id === 'MCFT-08', 'closure primary owner is MCFT-08');
check(JSON.stringify(closureSlice?.contributing_work_package_ids) === JSON.stringify(['MCFT-01', 'MCFT-02', 'MCFT-03', 'MCFT-04', 'MCFT-05', 'MCFT-07', 'MCFT-09']), 'closure contributing owners are exact');
check(JSON.stringify(closureSlice?.depends_on_delivery_slice_ids) === JSON.stringify(['MCFT-CAP-01.MCFT-04-05-08-09.A0-RUNTIME-INTEGRATION-V1']), 'closure dependency is exact');
check(delivery.nonclaims.includes('NO_MCFT_CAP_01_CLOSURE'), 'closure nonclaim remains active before merge');
check(delivery.nonclaims.includes('NO_MCFT_GATE_A_CLOSURE'), 'Gate A nonclaim preserved');
check(delivery.nonclaims.includes('NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM'), 'Minimum Complete Field Twin nonclaim preserved');

check(delivery.foundation_closure?.merged_main_commit === 'b0b364933956a65345b927c6c5618e9d4ebe22af', 'foundation merge commit recorded');
check(delivery.foundation_closure?.local_acceptance?.s1_replay_dataset === '12_PASS_0_FAIL', 'S1 evidence recorded');
check(delivery.foundation_closure?.local_acceptance?.s2_contracts_config === '10_PASS_0_FAIL', 'S2 evidence recorded');
check(delivery.foundation_closure?.local_acceptance?.s3a_static_persistence === '16_PASS_0_FAIL', 'S3A static evidence recorded');
check(delivery.foundation_closure?.local_acceptance?.s3a_postgres === '8_PASS_0_FAIL', 'S3A PostgreSQL evidence recorded');
check(delivery.s3b_closure?.merged_main_commit === '5d17e6ad9944376bbb5a71c9d801aa4472afe592', 'S3B merge commit recorded');
check(delivery.s3b_closure?.local_acceptance?.s3b_state_math === '108_PASS_0_FAIL', 'S3B State Math evidence recorded');
check(delivery.s3b_closure?.local_acceptance?.s3b_closure === '36_PASS_0_FAIL', 'S3B closure evidence recorded');
check(delivery.s4_closure?.merged_main_commit === BASELINE, 'S4 merge commit recorded as runtime delivery main');
check(delivery.s4_closure?.local_acceptance?.s4_a0_runtime_static === '20_PASS_0_FAIL', 'S4 static evidence recorded');
check(delivery.s4_closure?.local_acceptance?.s4_a0_runtime_postgres === '12_PASS_0_FAIL', 'S4 PostgreSQL evidence recorded');
check(delivery.s4_closure?.local_acceptance?.s4_closure === '57_PASS_0_FAIL', 'S4 closure evidence recorded');
check(delivery.s4_closure?.local_acceptance?.postgres_fault_stages === '17_ROLLBACK_0_PARTIAL_WRITE', '17 fault-stage rollback evidence recorded');
check(delivery.s4_closure?.local_acceptance?.canonical_fact_count === 9, 'nine canonical facts recorded');
check(delivery.s4_closure?.local_acceptance?.projection_count === 6, 'six projections recorded');
check(delivery.s4_closure?.local_acceptance?.successful_forecast_latest_count === 0, 'successful Forecast latest remains empty');
check(s3bStatus.status === 'COMPLETE', 'S3B independent status remains COMPLETE');
check(s4Status.status === 'COMPLETE', 'S4 independent status remains COMPLETE');

const line = matrix.capability_lines.find((item) => item.capability_line_id === CAPABILITY);
check(Boolean(line), 'capability matrix contains MCFT-CAP-01');
check(line?.status === 'CLOSURE_IN_REVIEW', 'matrix status is CLOSURE_IN_REVIEW');
check(line?.runtime_delivery_main_commit === BASELINE, 'matrix runtime delivery commit is exact');
check(line?.active_delivery_slice_id === CLOSURE_SLICE, 'matrix active slice is closure');
check(line?.delivery_slices?.length === 6, 'matrix contains exact six delivery slices');
check(line?.delivery_slices?.filter((slice) => slice.delivery_slice_id !== CLOSURE_SLICE).every((slice) => slice.status === 'COMPLETE'), 'matrix predecessor slices are COMPLETE');
check(line?.delivery_slices?.find((slice) => slice.delivery_slice_id === CLOSURE_SLICE)?.status === 'IN_IMPLEMENTATION', 'matrix closure slice is IN_IMPLEMENTATION');
check(line?.forbidden_claims?.includes('successful 72-point Forecast established'), 'matrix forbids successful Forecast claim');
check(line?.forbidden_claims?.includes('MCFT Gate A complete'), 'matrix forbids Gate A claim');
check(line?.forbidden_claims?.includes('Minimum Complete Field Twin complete'), 'matrix forbids Minimum Complete Field Twin claim');

const expectedOwnerStatuses = {
  'MCFT-01': 'COMPLETE',
  'MCFT-02': 'PARTIALLY_ESTABLISHED',
  'MCFT-03': 'PARTIALLY_ESTABLISHED',
  'MCFT-04': 'PARTIALLY_ESTABLISHED',
  'MCFT-05': 'PARTIALLY_ESTABLISHED',
  'MCFT-06': 'NOT_STARTED',
  'MCFT-07': 'PARTIALLY_ESTABLISHED',
  'MCFT-08': 'PARTIALLY_ESTABLISHED',
  'MCFT-09': 'PARTIALLY_ESTABLISHED',
};
for (const [workPackageId, expectedStatus] of Object.entries(expectedOwnerStatuses)) {
  check(matrix.actual_status_at_mcft_cap_01_closure_candidate?.[workPackageId]?.status === expectedStatus, `matrix owner status ${workPackageId} = ${expectedStatus}`);
}
check(matrix.actual_status_at_mcft_cap_01_closure_candidate?.['MCFT-06']?.established_scope === 'none', 'MCFT-06 propagation remains unstarted');

check(record.capability_line_id === CAPABILITY, 'closure record capability identity');
check(record.delivery_slice_id === CLOSURE_SLICE, 'closure record slice identity');
check(record.status === 'CANDIDATE', 'closure record is candidate, not effective completion');
check(record.authority?.runtime_delivery_main_commit === BASELINE, 'closure record runtime delivery commit');
for (const [field, expected] of Object.entries(EXPECTED_HASHES)) {
  check(record.authority?.[field] === expected, `closure record frozen authority ${field}`);
}
check(record.completed_delivery_slices?.length === 5, 'closure record contains exact five completed predecessor slices');
check(record.completed_delivery_slices?.every((slice) => slice.status === 'COMPLETE'), 'closure record predecessor statuses are COMPLETE');
check(record.closure_proof?.controlled_bootstrap_posterior === true, 'controlled bootstrap posterior proof');
check(record.closure_proof?.a0_atomicity === true, 'A0 atomicity proof');
check(record.closure_proof?.a0_idempotency === true, 'A0 idempotency proof');
check(record.closure_proof?.projection_rebuild === true, 'projection rebuild proof');
check(record.closure_proof?.next_tick_handoff === true, 'next-tick handoff proof');
check(record.closure_proof?.explicit_replay_clock === true, 'explicit Replay clock proof');
check(record.closure_proof?.no_future_leakage === true, 'no-future-leakage proof');
check(record.closure_proof?.blocked_forecast_without_success_claim === true, 'BLOCKED Forecast boundary proof');
check(record.closure_proof?.one_semantic_core_preserved === true, 'one semantic core preserved');
check(JSON.stringify(record.candidate_completion_claims) === JSON.stringify(['MCFT_CAP_01_COMPLETE', 'FIRST_CLASS_WATER_STATE_ESTIMATE_LEVEL_A_ESTABLISHED', 'CONTROLLED_REPLAY_BOOTSTRAP_CLOSURE_ESTABLISHED']), 'candidate completion claims are exact');
check(record.preserved_nonclaims?.includes('NO_PROPAGATION'), 'closure record preserves propagation nonclaim');
check(record.preserved_nonclaims?.includes('NO_SUCCESSFUL_FORECAST'), 'closure record preserves successful Forecast nonclaim');
check(record.preserved_nonclaims?.includes('NO_MCFT_GATE_A_CLOSURE'), 'closure record preserves Gate A nonclaim');
check(record.preserved_nonclaims?.includes('NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM'), 'closure record preserves Minimum Complete Field Twin nonclaim');
check(record.closure_does_not_change?.runtime_source === true, 'closure record declares Runtime source unchanged');
check(record.closure_does_not_change?.database_schema === true, 'closure record declares database schema unchanged');
check(record.closure_does_not_change?.canonical_facts === true, 'closure record declares canonical facts unchanged');
check(record.transition_effective_condition === 'CLOSURE_PR_MERGED_AND_VERIFIED_ON_MAIN', 'closure transition condition is explicit');
check(Array.isArray(record.next_authorized_slice_ids) && record.next_authorized_slice_ids.length === 0, 'closure record authorizes no successor implicitly');
for (const [workPackageId, expectedStatus] of Object.entries(expectedOwnerStatuses)) {
  check(record.owner_work_package_statuses?.[workPackageId]?.status === expectedStatus, `closure record owner status ${workPackageId} = ${expectedStatus}`);
}

check(closureDoc.includes('status: CANDIDATE'), 'closure narrative records candidate status');
check(closureDoc.includes('MCFT_CAP_01_COMPLETE'), 'closure narrative names bounded completion claim');
check(closureDoc.includes('NO_PROPAGATION'), 'closure narrative preserves propagation nonclaim');
check(closureDoc.includes('NO_MCFT_GATE_A_CLOSURE'), 'closure narrative distinguishes Gate A');
check(closureDoc.includes('NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM'), 'closure narrative distinguishes Minimum Complete Field Twin');
check(implementationMap.includes('main@4a0fd03beb05298028101a4999c67a5e053dadb8'), 'implementation map records runtime delivery main');
check(implementationMap.includes('MCFT-CAP-01 closure is not MCFT-GATE-A'), 'implementation map preserves closure hierarchy');
check(implementationMap.includes('MCFT-06 NOT_STARTED'), 'implementation map preserves MCFT-06 status');

try {
  cp.execFileSync('git', ['merge-base', '--is-ancestor', BASELINE, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });
  check(true, 'closure branch descends from exact runtime delivery main commit');
} catch {
  check(false, 'closure branch descends from exact runtime delivery main commit');
}

try {
  const changed = cp.execFileSync('git', ['diff', '--name-only', `${BASELINE}...HEAD`], { cwd: ROOT, encoding: 'utf8' })
    .trim().split(/\r?\n/).filter(Boolean);
  const allowed = new Set([
    'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
    'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
    'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-CLOSURE-RECORD.json',
    'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-CLOSURE.md',
    'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS.json',
    'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_01_CLOSURE.cjs',
  ]);
  const forbidden = changed.filter((file) => !allowed.has(file));
  check(changed.length === 6, `exact closure changed-file count is six, got ${changed.length}`);
  check(forbidden.length === 0, `closure governance-only changed-file boundary: ${forbidden.join(',')}`);
  check(changed.every((file) => file.startsWith('docs/digital_twin/') || file === 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_01_CLOSURE.cjs'), 'all closure changes are governance-only');
  check(changed.every((file) => !file.startsWith('apps/server/') && !file.startsWith('apps/web/') && !file.startsWith('fixtures/') && !file.startsWith('.github/') && !file.includes('/migrations/')), 'no Runtime web fixture workflow or migration changes');
} catch (error) {
  check(false, `git changed-file boundary: ${error.message}`);
}

console.log(`MCFT-CAP-01 closure readiness: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
