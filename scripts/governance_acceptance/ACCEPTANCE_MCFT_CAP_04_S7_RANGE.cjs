// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S7_RANGE.cjs
// Purpose: verify the exact MCFT-CAP-04 S7 24-tick range implementation, dual Forecast pointer correction, frozen PostgreSQL cardinalities, final file boundary, and S8 blocking.
// Boundary: repository governance verification only; no database mutation, Runtime execution, restart/backfill mode, route, scheduler, recommendation, decision, or field claim.

'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '01be1e85dc409eee30bc3464dad30f7005b135c4';
const BRANCH = 'agent/mcft-cap-04-s7-twenty-four-tick-range-v1';
const S7 = 'MCFT-CAP-04.MCFT-04-07-09-10.TWENTY-FOUR-TICK-FORECAST-SCENARIO-RANGE-V1';
const S8 = 'MCFT-CAP-04.MCFT-03-04-07-09-10.RESTART-BACKFILL-FAILURE-RECOVERY-V1';
const TASK_SHA = 'ea63e92a64b760b84c49428b1d3a245ce5cd94bb08daa9c6b971a53861b90a63';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : process.argv.includes('--final') ? 'final' : 'draft';
const FILES = [
  'apps/server/src/runtime/twin_runtime/forecast_scenario_range_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S7-RANGE-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S7-RANGE-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S7_RANGE.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_04_twenty_four_tick_range_fixture_v1.ts',
].sort();

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const run = (exe, args) => {
  const result = cp.spawnSync(exe, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${exe} ${args.join(' ')}\n${result.stdout || ''}\n${result.stderr || ''}`);
  return String(result.stdout || '').trim();
};
const git = (args) => run(process.platform === 'win32' ? 'git.exe' : 'git', args);
let pass = 0;
let fail = 0;
const check = (value, message) => {
  if (value) { pass += 1; console.log(`PASS ${message}`); }
  else { fail += 1; console.error(`FAIL ${message}`); }
};
const same = (actual, expected) => JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());

for (const file of FILES) check(fs.existsSync(path.join(ROOT, file)), `file exists: ${file}`);
const task = read('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md');
check(Buffer.byteLength(task, 'utf8') === 77603, 'complete task byte length exact');
check(crypto.createHash('sha256').update(task).digest('hex') === TASK_SHA, 'complete task SHA exact');

const status = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S7-RANGE-STATUS.json');
const contract = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S7-RANGE-CONTRACT.json');
const auth = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json');
const delivery = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
const s7 = delivery.slices.find((slice) => slice.delivery_slice_id === S7);
const s8 = delivery.slices.find((slice) => slice.delivery_slice_id === S8);

check(status.schema_version === 'geox_mcft_cap_04_s7_range_status_v2', 'S7 status schema v2 exact');
check(status.status === 'IMPLEMENTATION_CANDIDATE', 'S7 status candidate exact');
check(status.implementation_status === 'VALIDATED_PENDING_MERGE', 'S7 implementation validated pending merge');
check(status.baseline_main_commit === BASELINE && status.branch === BRANCH, 'S7 identity exact');
check(status.predecessor_effectiveness.postmerge_workflow_run === 29245469293, 'S6 postmerge evidence exact');
check(status.activation_effectiveness.activation_merge_commit === BASELINE, 'S7 activation merge baseline exact');
check(status.target_contract.logical_tick_count === 24, '24 logical ticks exact');
check(status.target_contract.all_ticks_operation_variant === 'A1_COMPLETED', 'standard fixture all A1 exact');
check(status.target_contract.new_posterior_state_count === 24, '24 posterior States exact');
check(status.target_contract.successful_forecast_run_count === 24, '24 successful Forecast Runs exact');
check(status.target_contract.scenario_set_count === 24, '24 Scenario Sets exact');
check(status.target_contract.forecast_point_count === 1728, '1728 Forecast points exact');
check(status.target_contract.scenario_point_count === 5184, '5184 Scenario points exact');
check(status.target_contract.range_operation_canonical_fact_count === 216, '216 operation facts exact');
check(status.target_contract.standard_config_plus_range_fact_count === 240, '240 Config plus operation facts exact');
check(status.target_contract.checkpoint_sequence_start === 49 && status.target_contract.checkpoint_sequence_end === 72, 'checkpoint sequence 49 through 72 exact');
check(status.target_contract.next_tick_logical_time === '2026-06-04T02:00:00.000Z', 'final next tick exact');
check(status.target_contract.closure_fixture_allows_a2 === false, 'closure fixture forbids A2');
check(status.corrective_boundary.authorized_under === 'S7_A2_EXPLICIT_RANGE_STOP_ACCEPTANCE', 'dual pointer corrective authority exact');
check(status.candidate_validation.positive_negative_recheck_workflow_run === 29247534180, 'positive negative workflow evidence exact');
check(status.candidate_validation.isolated_postgresql_workflow_run === 29247696055, 'PostgreSQL workflow evidence exact');
check(status.candidate_validation.postgresql_operation_fact_count === 216, 'PostgreSQL operation count evidence exact');
check(status.candidate_validation.postgresql_config_plus_operation_fact_count === 240, 'PostgreSQL total count evidence exact');
check(same(status.exact_changed_file_boundary, FILES), 'status exact changed-file boundary');

check(contract.contract_id === 'MCFT_CAP_04_TWENTY_FOUR_TICK_FORECAST_SCENARIO_RANGE_V1', 'range contract ID exact');
check(contract.range_semantics.maximum_tick_count === 24, 'range maximum 24 exact');
check(contract.preexecution_validation.all_runtime_config_refs_required_before_first_write === true, 'Config refs prevalidated before writes');
check(contract.preexecution_validation.all_runtime_config_hashes_required_before_first_write === true, 'Config hashes prevalidated before writes');
check(contract.per_tick_execution.entry_service === 'CAP04_PENDING_SCENARIO_BARRIER_SINGLE_TICK_SERVICE_V1', 'range reuses pending-B single-tick entry');
check(contract.per_tick_execution.state_forecast_scenario_math_reimplementation === 'FORBIDDEN', 'range duplicates no domain math');
check(contract.standard_closure_fixture.range_operation_canonical_fact_count === 216, 'contract operation facts exact');
check(contract.blocked_path.range_status === 'BLOCKED' && contract.blocked_path.range_stops_immediately === true, 'A2 explicit stop contract');
check(contract.failed_path.terminal_tick_written_for_failing_hour === false, 'FAILED writes no terminal tick');
check(contract.checkpoint_forecast_pointers.pointers_are_independent_after_a2 === true, 'dual Forecast pointers independent');
check(contract.idempotency.completed_target_replay_status === 'ALREADY_COMPLETE', 'completed replay status exact');
check(contract.persistence.new_migration === false, 'no new migration');

check(auth.active_delivery_slice_id === S7, 'authorization active S7');
check(auth.repository_write_scope === 'S7_TWENTY_FOUR_TICK_RANGE_ONLY', 'authorization write scope S7 exact');
check(auth.implementation_status === 'S7_IMPLEMENTATION_CANDIDATE', 'authorization candidate status exact');
check(same(auth.exact_changed_file_boundary, FILES), 'authorization exact boundary mirror');
check(delivery.status === 'S7_IMPLEMENTATION_CANDIDATE', 'delivery status S7 candidate');
check(delivery.active_delivery_slice_id === S7, 'delivery active S7');
check(s7.status === 'IMPLEMENTATION_CANDIDATE' && s7.runtime_source_authorized === true, 'delivery S7 candidate authorized');
check(same(s7.exact_changed_file_boundary, FILES), 'delivery S7 exact boundary mirror');
check(s8.status === 'BLOCKED' && s8.runtime_source_authorized === false, 'S8 remains blocked');
check(cap04.active_delivery_slice_id === S7 && cap04.implementation_status === 'S7_IMPLEMENTATION_CANDIDATE', 'matrix active S7 candidate');
check(cap04.next_delivery_slice_id === S8 && cap04.next_delivery_slice_authorized === false, 'matrix S8 unauthorized');

const rangeService = read('apps/server/src/runtime/twin_runtime/forecast_scenario_range_service_v1.ts');
for (const marker of [
  'MAX_CAP04_FORECAST_SCENARIO_RANGE_TICKS_V1 = 24',
  'CAP04_RANGE_RUNTIME_CONFIG_REF_REQUIRED',
  'CAP04_RANGE_RUNTIME_CONFIG_HASH_REQUIRED',
  'CAP04_RANGE_MAX_TICKS_EXCEEDED',
  'status: "ALREADY_COMPLETE"',
  'status: "BLOCKED"',
  'CAP04_RANGE_NONCONTIGUOUS_COMMITTED_HANDOFF',
  'CAP04_RANGE_NONCONTIGUOUS_COMMITTED_SEQUENCE',
]) check(rangeService.includes(marker), `range service marker ${marker}`);

const nextTick = read('apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts');
check(!nextTick.includes('SUCCESSFUL_FORECAST_POINTER_RESULT_MISMATCH'), 'invalid Forecast pointer equality removed');
check(nextTick.includes('latest Forecast result and latest successful Forecast are independent'), 'dual pointer boundary documented');

for (const [file, markers] of Object.entries({
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE.ts': ['exactly 24 ticks execute','1728 Forecast points','ALREADY_COMPLETE replay performs zero Evidence loads'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE_NEGATIVE.ts': ['five A1 ticks precede exactly one A2','malformed sixth forcing window is FAILED','Config prevalidation failure performs zero Evidence loads'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE_DB.ts': ['192 A members + 24 B sets + 24 Configs','sequence 72','ALREADY_COMPLETE with zero new facts'],
})) {
  const content = read(file);
  for (const marker of markers) check(content.includes(marker), `${file} marker ${marker}`);
}

const range = MODE === 'postmerge' ? `${BASELINE}...HEAD` : BASELINE;
const tracked = git(['diff', '--name-only', range]).split(/\r?\n/).filter(Boolean);
const untracked = MODE === 'postmerge' ? [] : git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
const changed = [...new Set([...tracked, ...untracked])].sort();
check(same(changed, FILES), `${MODE} exact changed-file boundary`);
check(changed.every((file) => !file.startsWith('apps/server/db/migrations/')), 'no migration changed');
check(changed.every((file) => !file.startsWith('apps/server/src/routes/')), 'no route changed');
check(changed.every((file) => !file.startsWith('apps/web/')), 'no web changed');
check(changed.every((file) => !file.startsWith('.github/workflows/')), 'no workflow changed');
check(changed.every((file) => !file.startsWith('.cap04-s7/')), 'no temporary files changed');

if (MODE === 'postmerge') {
  check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge main equals origin/main');
} else {
  check(git(['branch', '--show-current']) === BRANCH, `${MODE} Gate branch exact`);
  check(git(['rev-parse', 'origin/main']) === BASELINE, `${MODE} origin/main baseline exact`);
}
try { git(['diff', '--check', range]); check(true, 'git diff --check PASS'); }
catch { check(false, 'git diff --check PASS'); }

console.log(`MCFT-CAP-04 S7 range governance ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
