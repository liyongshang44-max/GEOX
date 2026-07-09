// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_01_S4_CLOSURE.cjs
// Purpose: validate S4 A0 Runtime closure evidence, established claims, successor authorization, changed-file boundary, and preserved capability nonclaims.
// Boundary: governance/static acceptance only; no Replay execution, State computation, PostgreSQL access, canonical write, propagation, Scenario, Recommendation, or AO-ACT.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '5d17e6ad9944376bbb5a71c9d801aa4472afe592';
const CANDIDATE = '62a3906812ef048ca1e35ced192556b4f843c5b7';
const S4 = 'MCFT-CAP-01.MCFT-04-05-08-09.A0-RUNTIME-INTEGRATION-V1';
const S5 = 'MCFT-CAP-01.CLOSURE-V1';

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

const delivery = readJson('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS.json');
const status = readJson('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-S4-STATUS.json');
const runtimeDoc = fs.readFileSync(path.join(ROOT, 'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-A0-RUNTIME-INTEGRATION.md'), 'utf8');
const expected = readJson('fixtures/mcft/water_state/expected/MCFT_CAP_01_A0_RUNTIME_EXPECTED.json');
const negative = readJson('fixtures/mcft/water_state/negative/MCFT_CAP_01_A0_RUNTIME_NEGATIVE_FIXTURES.json');

check(delivery.capability_line_id === 'MCFT-CAP-01', 'capability line identity');
check(delivery.status === 'IN_IMPLEMENTATION', 'capability line remains IN_IMPLEMENTATION before S5');
check(delivery.slices.length === 5, 'exact completed delivery-slice count is five');
const s4Slice = delivery.slices.find((slice) => slice.delivery_slice_id === S4);
check(s4Slice?.status === 'COMPLETE', 'S4 delivery slice is COMPLETE');
check(s4Slice?.primary_owner_work_package_id === 'MCFT-04', 'S4 primary owner is MCFT-04');
check(JSON.stringify(s4Slice?.contributing_work_package_ids) === JSON.stringify(['MCFT-05', 'MCFT-08', 'MCFT-09']), 'S4 contributing work packages are exact');
check(s4Slice?.depends_on_delivery_slice_ids?.length === 4, 'S4 records all four completed dependencies');
check(JSON.stringify(delivery.next_authorized_slice_ids) === JSON.stringify([S5]), 'S5 is the only next authorized slice');
check(delivery.s4_closure?.implementation_candidate_head === CANDIDATE, 'S4 implementation candidate head recorded');
check(delivery.s4_closure?.implementation_candidate_ci?.run_number === 4456, 'S4 exact-head CI run recorded');
check(delivery.s4_closure?.implementation_candidate_ci?.conclusion === 'success', 'S4 exact-head CI success recorded');
check(delivery.s4_closure?.local_acceptance?.s4_a0_runtime_static === '20_PASS_0_FAIL', 'S4 static Gate evidence recorded');
check(delivery.s4_closure?.local_acceptance?.s4_a0_runtime_postgres === '12_PASS_0_FAIL', 'S4 PostgreSQL Gate evidence recorded');
check(delivery.s4_closure?.local_acceptance?.postgres_fault_stages === '17_ROLLBACK_0_PARTIAL_WRITE', '17 fault-stage rollback evidence recorded');
check(delivery.s4_closure?.local_acceptance?.canonical_fact_count === 9, 'nine canonical facts evidence recorded');
check(delivery.s4_closure?.local_acceptance?.projection_count === 6, 'six projections evidence recorded');
check(delivery.s4_closure?.local_acceptance?.successful_forecast_latest_count === 0, 'successful Forecast latest remains empty');
check(delivery.s4_closure?.transition_effective_condition === 'PR_2314_MERGED_AND_VERIFIED_ON_MAIN', 'S4 closure effectiveness condition recorded');

check(status.delivery_slice_id === S4, 'S4 status identity');
check(status.status === 'COMPLETE', 'S4 status file is COMPLETE');
check(status.implementation_candidate_head === CANDIDATE, 'S4 status candidate head');
check(status.evidence?.local?.s4_a0_runtime_static === '20_PASS_0_FAIL', 'S4 status static evidence');
check(status.evidence?.local?.s4_a0_runtime_postgres === '12_PASS_0_FAIL', 'S4 status PostgreSQL evidence');
check(status.evidence?.ci?.run_number === 4456 && status.evidence?.ci?.conclusion === 'success', 'S4 status CI evidence');
check(status.next_authorized_slice_id === S5, 'S4 status authorizes S5 next');
check(runtimeDoc.includes('status: COMPLETE'), 'A0 Runtime document records COMPLETE');
check(runtimeDoc.includes('S4 A0 Runtime static Gate: 20 PASS, 0 FAIL'), 'A0 Runtime document records static Gate result');
check(runtimeDoc.includes('S4 A0 Runtime PostgreSQL Gate: 12 PASS, 0 FAIL'), 'A0 Runtime document records PostgreSQL Gate result');

for (const claim of [
  'A0_RUNTIME_EXECUTION_ESTABLISHED',
  'BOOTSTRAP_STATE_COMMITTED',
  'ACTIVE_INITIAL_LINEAGE_ESTABLISHED',
  'INITIAL_CHECKPOINT_ESTABLISHED',
  'BLOCKED_FORECAST_RESULT_ESTABLISHED',
  'NEXT_TICK_HANDOFF_ESTABLISHED',
]) {
  check(status.completion_claims.includes(claim), `completion claim recorded: ${claim}`);
}

for (const removedNonclaim of [
  'NO_A0_RUNTIME_EXECUTION',
  'NO_BOOTSTRAP_STATE_COMMITTED',
  'NO_ACTIVE_INITIAL_LINEAGE',
  'NO_INITIAL_CHECKPOINT',
]) {
  check(!delivery.nonclaims.includes(removedNonclaim), `established S4 claim removed from nonclaims: ${removedNonclaim}`);
}

for (const nonclaim of [
  'NO_PROPAGATION',
  'NO_SUCCESSFUL_FORECAST',
  'NO_SCENARIO',
  'NO_RECOMMENDATION',
  'NO_AO_ACT',
  'NO_CONTINUOUS_RUNTIME',
  'NO_RESTART_BACKFILL_PROOF',
  'NO_LATE_EVIDENCE_REVISION_RUNTIME',
  'NO_LIVE_FIELD_CLAIM',
  'NO_MCFT_GATE_A_CLOSURE',
  'NO_MCFT_CAP_01_CLOSURE',
]) {
  check(status.nonclaims.includes(nonclaim), `S4 nonclaim preserved: ${nonclaim}`);
}

check(expected.canonical_member_count === 9 && expected.projection_count === 6, 'expected fixture preserves nine-fact six-projection contract');
check(expected.forecast_status === 'BLOCKED' && expected.forecast_points_count === 0 && expected.latest_successful_forecast_count === 0, 'expected fixture preserves BLOCKED Forecast boundary');
check(expected.next_tick_logical_time === '2026-06-01T02:00:00.000Z', 'expected fixture preserves next-tick handoff');
check(Array.isArray(negative.fixtures) && negative.fixtures.length >= 20, 'negative fixture catalog is complete');
check(negative.fixtures.every((fixture) => fixture.expected_fact_delta === 0 && fixture.expected_projection_delta === 0 && fixture.expected_pointer_delta === 0), 'all negative fixtures preserve zero-write contract');

try {
  const changed = cp.execFileSync('git', ['diff', '--name-only', `${BASELINE}...HEAD`], { cwd: ROOT, encoding: 'utf8' })
    .trim().split(/\r?\n/).filter(Boolean);
  const allowedPatterns = [
    /^apps\/server\/src\/runtime\/twin_runtime\/(ports|evidence_window_builder_v1|a0_record_set_builder_v1|a0_bootstrap_runtime_service_v1)\.ts$/,
    /^apps\/server\/src\/adapters\/twin_runtime\/canonical_replay_file_source_v1\.ts$/,
    /^scripts\/runtime_acceptance\/ACCEPTANCE_MCFT_CAP_01_A0_RUNTIME(_DB)?\.ts$/,
    /^scripts\/governance_acceptance\/ACCEPTANCE_MCFT_CAP_01_S4_CLOSURE\.cjs$/,
    /^fixtures\/mcft\/water_state\/(expected|negative)\/MCFT_CAP_01_A0_RUNTIME_/,
    /^docs\/digital_twin\/mcft\/cap_01\/(GEOX-MCFT-CAP-01-A0-RUNTIME-INTEGRATION\.md|GEOX-MCFT-CAP-01-S4-STATUS\.json|GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS\.json)$/,
  ];
  const forbidden = changed.filter((file) => !allowedPatterns.some((pattern) => pattern.test(file)));
  check(changed.length === 13, `exact S4 closure changed-file count is 13, got ${changed.length}`);
  check(forbidden.length === 0, `S4 closure changed-file boundary: ${forbidden.join(',')}`);
  check(changed.every((file) => !file.startsWith('apps/server/src/persistence/') && !file.startsWith('apps/server/src/routes/') && !file.startsWith('apps/web/') && !file.includes('/migrations/') && !file.includes('propagation') && !file.includes('scenario') && !file.includes('recommendation') && !file.includes('ao_act')), 'no persistence route web migration propagation Scenario Recommendation or AO-ACT changes');
} catch (error) {
  check(false, `git changed-file boundary: ${error.message}`);
}

console.log(`MCFT-CAP-01 S4 closure: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
