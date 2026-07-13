// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S6_SINGLE_TICK.cjs
// Purpose: verify the exact remediated MCFT-CAP-04 S6 boundary, S5B merged-main effectiveness, R1-A through R1-I authority closure, S7 blocking, and preserved nonclaims.
// Boundary: repository governance verification only; no database mutation, range loop, restart/backfill, route, scheduler, recommendation, decision, or field claim.

'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '63c8ba7b8dd314c1224ca8de2914b663b3551092';
const BRANCH = 'agent/mcft-cap-04-s6-single-tick-integration-v1';
const S5B = 'MCFT-CAP-04.MCFT-03-09-10.A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1';
const S6 = 'MCFT-CAP-04.MCFT-04-05-06-07-08-09-10.SINGLE-TICK-FORECAST-SCENARIO-INTEGRATION-V1';
const S7 = 'MCFT-CAP-04.MCFT-04-07-09-10.TWENTY-FOUR-TICK-FORECAST-SCENARIO-RANGE-V1';
const TASK_SHA = 'ea63e92a64b760b84c49428b1d3a245ce5cd94bb08daa9c6b971a53861b90a63';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : process.argv.includes('--final') ? 'final' : 'draft';

const FILES = [
  'apps/server/src/domain/twin_runtime/forecast_canonical_authority_v1.ts',
  'apps/server/src/domain/twin_runtime/forecast_math_contracts_v1.ts',
  'apps/server/src/domain/twin_runtime/forecast_record_set_recovery_authority_v1.ts',
  'apps/server/src/domain/twin_runtime/forecast_scenario_record_set_validator_v1.ts',
  'apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/blocked_forecast_payload_builder_v1.ts',
  'apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.ts',
  'apps/server/src/runtime/twin_runtime/forecast_scenario_persistence_ports_v1.ts',
  'apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/forecast_scenario_state_source_builder_v1.ts',
  'apps/server/src/runtime/twin_runtime/future_forcing_outcome_classifier_v1.ts',
  'apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/ports.ts',
  'apps/server/src/runtime/twin_runtime/scenario_set_record_builder_v1.ts',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S5B-PERSISTENCE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-INTEGRATION-V1.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S6_SINGLE_TICK.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PENDING_SCENARIO_BARRIER.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_FORECAST_MATH.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_FORECAST_MATH_NEGATIVE.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_04_single_tick_fixture_v1.ts',
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
const exactSet = (actual, expected, label) => {
  check(Array.isArray(actual), `${label} is array`);
  if (Array.isArray(actual)) check(JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()), `${label} exact`);
};

for (const file of FILES) check(fs.existsSync(path.join(ROOT, file)), `file exists: ${file}`);
const task = read('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md');
check(Buffer.byteLength(task, 'utf8') === 77603, 'complete task byte length exact');
check(crypto.createHash('sha256').update(task).digest('hex') === TASK_SHA, 'complete task SHA exact');

const s5bStatus = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S5B-PERSISTENCE-STATUS.json');
const s6Status = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-STATUS.json');
const contract = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-CONTRACT.json');
const delivery = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json');
const authorization = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
const s5b = delivery.slices.find((slice) => slice.delivery_slice_id === S5B);
const s6 = delivery.slices.find((slice) => slice.delivery_slice_id === S6);
const s7 = delivery.slices.find((slice) => slice.delivery_slice_id === S7);

check(s5bStatus.status === 'MERGED_EFFECTIVE', 'S5B status merged effective');
check(s5bStatus.effectiveness_condition_satisfied === true, 'S5B effectiveness satisfied');
check(s5bStatus.merge_evidence.pr_number === 2394, 'S5B PR exact');
check(s5bStatus.merge_evidence.exact_head_commit === 'f6e30f3e865ac92bc23158c1ac2c55907ce5200a', 'S5B exact head exact');
check(s5bStatus.merge_evidence.exact_head_ci_run === 29231823745, 'S5B exact-head CI exact');
check(s5bStatus.merge_evidence.merge_commit === BASELINE, 'S5B merge commit exact');
check(s5bStatus.merge_evidence.postmerge_probe_pr_number === 2395, 'S5B postmerge probe PR exact');
check(s5bStatus.merge_evidence.postmerge_workflow_run === 29232760223, 'S5B postmerge workflow exact');
check(s5bStatus.merge_evidence.postmerge_gate === 'PASS', 'S5B postmerge Gate PASS');

check(s6Status.schema_version === 'geox_mcft_cap_04_s6_single_tick_status_v2', 'S6 remediation status schema exact');
check(s6Status.status === 'IMPLEMENTATION_CANDIDATE', 'S6 status candidate exact');
check(s6Status.implementation_status === 'REMEDIATED_AND_VALIDATED_PENDING_MERGE', 'S6 remediation implementation status exact');
check(s6Status.baseline_main_commit === BASELINE, 'S6 baseline exact');
check(s6Status.branch === BRANCH, 'S6 branch exact');
check(s6Status.runtime_source_authorized === true, 'S6 Runtime source authorized');
check(s6Status.activation_fields_status === 'FROZEN', 'S6 activation fields frozen');
check(s6Status.contracts.logical_tick_count === 1, 'S6 logical tick count exact');
check(s6Status.contracts.a_member_count === 8 && s6Status.contracts.scenario_option_count === 3, 'S6 A/B cardinalities exact');
check(s6Status.contracts.forecast_point_count === 72 && s6Status.contracts.scenario_point_count === 216, 'S6 Forecast and Scenario point counts exact');
check(s6Status.contracts.pending_scenario_recovery_policy === 'CHECKPOINT_FORECAST_CANONICAL_AUTHORITY_COMMIT_B_ONLY_ZERO_EVIDENCE_RESELECTION', 'S6 pending B policy exact');
check(s6Status.contracts.forcing_outcome_policy === 'SELECTED_A1_OR_UNAVAILABLE_A2_OR_MALFORMED_FAILED', 'S6 forcing outcome policy exact');
check(s6Status.contracts.facts_recovery_policy === 'TICK_AND_SCENARIO_FACT_ROOT_WITH_GUARD_SELF_REPAIR', 'S6 facts recovery policy exact');
check(s6Status.contracts.validator_dispatch_policy === 'EXACT_CONTRACT_ID_AND_OPERATION_VARIANT', 'S6 dispatch policy exact');
check(s6Status.remediation_line.length === 9, 'R1-A through R1-I remediation count exact');
check(s6Status.candidate_validation.strict_pipefail_remediation_workflow_run === 29243149582, 'strict remediation workflow exact');
check(s6Status.candidate_validation.strict_pipefail_remediation_workflow_result === 'PASS', 'strict remediation workflow PASS');
check(s6Status.candidate_validation.bounded_postgresql_diagnostic_workflow_run === 29243149618, 'bounded PostgreSQL workflow exact');
check(s6Status.candidate_validation.bounded_postgresql_diagnostic_exit_code === 0, 'bounded PostgreSQL exit zero');
check(s6Status.candidate_validation.bounded_postgresql_diagnostic_result === '6_PASS_0_FAIL', 'bounded PostgreSQL 6 PASS exact');
check(s6Status.candidate_validation.temporary_workflow_removed === true, 'temporary workflows removed');
exactSet(s6Status.exact_changed_file_boundary, FILES, 'S6 authoritative changed-file boundary');

check(contract.schema_version === 'geox_mcft_cap_04_s6_single_tick_contract_v2', 'single-tick contract schema v2 exact');
check(contract.contract_id === 'MCFT_CAP_04_SINGLE_TICK_FORECAST_SCENARIO_INTEGRATION_V1', 'single-tick contract ID exact');
check(contract.logical_tick_count === 1, 'contract one logical tick exact');
check(contract.pre_tick_barrier.authority === 'PREVIOUS_CHECKPOINT_FORECAST_RESULT_REF', 'pre-tick barrier authority exact');
check(contract.pre_tick_barrier.forcing_reselection === 'FORBIDDEN', 'barrier forcing reselection forbidden');
check(contract.successful_path.includes('CANONICAL_FORECAST_AUTHORITY') && contract.successful_path.includes('A1_COMMIT') && contract.successful_path.includes('B_COMMIT'), 'successful A1+B path exact');
check(contract.blocked_path.includes('A2_BLOCKED_FORECAST_COMMIT') && contract.blocked_path.includes('NO_SCENARIO_SET'), 'legal A2 blocked path exact');
check(contract.failed_path.canonical_terminal_write === false, 'malformed/conflicting forcing has no terminal write');
check(contract.canonical_forecast_authority.uncertainty_point_trace_count === 72, 'canonical uncertainty trace count exact');
check(contract.canonical_forecast_authority.physical_bound_trace_count === 72, 'canonical physical-bound trace count exact');
check(contract.canonical_forecast_authority.forecast_forcing_full_field_equality_required === true, 'Forecast and Forcing full equality required');
check(contract.completed_idempotent_replay === 'ZERO_RECOMPUTE_ZERO_WRITE', 'completed idempotent policy exact');
check(contract.pending_scenario_recovery === 'CHECKPOINT_FORECAST_CANONICAL_AUTHORITY_COMMIT_B_ONLY_ZERO_EVIDENCE_RESELECTION', 'pending Scenario recovery exact');
check(contract.facts_based_recovery.second_terminal_rejected_after_guard_loss === true, 'second terminal rejected after guard loss');
check(contract.facts_based_recovery.second_scenario_set_rejected_after_guard_loss === true, 'second Scenario rejected after guard loss');
check(contract.validator_dispatch === 'EXACT_CONTRACT_ID_AND_OPERATION_VARIANT', 'exact validator dispatch contract');
check(contract.no_new_migration === true, 'S6 adds no migration');

check(delivery.status === 'S6_IMPLEMENTATION_CANDIDATE', 'delivery status S6 candidate');
check(delivery.baseline_main_commit === BASELINE && delivery.branch === BRANCH, 'delivery activation identity exact');
check(delivery.active_delivery_slice_id === S6, 'delivery active slice S6');
check(s5b.status === 'MERGED_EFFECTIVE' && s5b.effectiveness_condition_satisfied === true, 'delivery S5B merged effective');
check(s6.status === 'IMPLEMENTATION_CANDIDATE' && s6.runtime_source_authorized === true && s6.activation_fields_status === 'FROZEN', 'delivery S6 activated and frozen');
check(s7.status === 'BLOCKED' && s7.runtime_source_authorized === false, 'S7 remains blocked');

check(authorization.status === 'AUTHORIZATION_EFFECTIVE', 'authorization remains effective');
check(authorization.active_delivery_slice_id === S6, 'authorization active S6');
check(authorization.repository_write_scope === 'S6_SINGLE_TICK_INTEGRATION_ONLY', 'authorization write scope S6 exact');
check(cap04.status === 'IN_PROGRESS' && cap04.design_status === 'DESIGN_FROZEN', 'matrix CAP-04 remains in progress and frozen');
check(cap04.active_delivery_slice_id === S6 && cap04.next_delivery_slice_id === S7 && cap04.next_delivery_slice_authorized === false, 'matrix delivery pointers exact and S7 unauthorized');

for (const [file, markers] of Object.entries({
  'apps/server/src/domain/twin_runtime/forecast_canonical_authority_v1.ts': ['CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1','CAP04_CANONICAL_FORECAST_PRECIPITATION_AUTHORITY_MISMATCH','CAP04_CANONICAL_FORECAST_POINT_TRACE_HASH_MISMATCH'],
  'apps/server/src/domain/twin_runtime/forecast_record_set_recovery_authority_v1.ts': ['CAP04_TICK_RECOVERY_AUTHORITY_CONTRACT_ID_V1','materializeCap04TickRecoveryAuthorityV1'],
  'apps/server/src/runtime/twin_runtime/future_forcing_outcome_classifier_v1.ts': ['status: "FAILED"','MALFORMED_FORCING_RECORD'],
  'apps/server/src/runtime/twin_runtime/blocked_forecast_payload_builder_v1.ts': ['buildCap04BlockedForecastPayloadV1','status: "BLOCKED"'],
  'apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts': ['BLOCKED_INSERTED','CAP04_SINGLE_TICK_FORCING_FAILED','canonicalForecastMathV1','RECOVERED_PENDING_SCENARIO'],
  'apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.ts': ['recoverPreviousPendingScenarioV1','CAP04_PENDING_B_CHECKPOINT_FORECAST_AUTHORITY_MISMATCH'],
  'apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.ts': ['recoverAByTickWithTransactionV1','PENDING_SCENARIO_CHECKPOINT_FORECAST_REF_REQUIRED','SCENARIO_SET_CANONICAL_UNIQUENESS_CONFLICT'],
  'apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts': ['exactCap04TerminalTickV1','CAP04_EXACT_FORECAST_AUTHORITY_CONTRACT_REQUIRED'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_DB.ts': ['deleted A/B guards are reconstructed','canonical Tick facts reject a second terminal variant','pending B recovery consumes canonical Forecast authority with zero forcing reselection'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PENDING_SCENARIO_BARRIER.ts': ['inner tick executor starts only after the barrier completes','zero current-tick Evidence or forcing selection reads'],
})) {
  const content = read(file);
  for (const marker of markers) check(content.includes(marker), `${file} marker ${marker}`);
}

const nextTickRepository = read('apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts');
check(!nextTickRepository.includes('startsWith("MCFT_CAP_04_")'), 'payload-prefix dispatch removed');
check(!nextTickRepository.includes('A1_COMPLETED_FORECAST'), 'invalid A1_COMPLETED_FORECAST marker removed');

const changedRange = MODE === 'postmerge' ? `${BASELINE}...HEAD` : BASELINE;
const tracked = git(['diff', '--name-only', changedRange]).split(/\r?\n/).filter(Boolean);
const untracked = MODE === 'postmerge' ? [] : git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
const changed = [...new Set([...tracked, ...untracked])].sort();
exactSet(changed, FILES, `${MODE} changed-file boundary`);
check(changed.every((file) => !file.startsWith('apps/server/db/migrations/')), 'no migration changed');
check(changed.every((file) => !file.startsWith('apps/server/src/routes/')), 'no route changed');
check(changed.every((file) => !file.startsWith('apps/web/')), 'no web changed');
check(changed.every((file) => !file.startsWith('.github/workflows/')), 'no workflow changed');
check(changed.every((file) => !file.startsWith('.cap04-s6/')), 'no temporary S6 files changed');
check(changed.every((file) => !file.startsWith('acceptance-output/')), 'no generated acceptance evidence committed');

if (MODE === 'postmerge') {
  check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge main equals origin/main');
} else {
  check(git(['branch', '--show-current']) === BRANCH, `${MODE} Gate runs on S6 branch`);
  check(git(['rev-parse', 'origin/main']) === BASELINE, `${MODE} origin/main equals S5B merge baseline`);
}
try { git(['diff', '--check', changedRange]); check(true, 'git diff --check PASS'); }
catch { check(false, 'git diff --check PASS'); }

console.log(`MCFT-CAP-04 S6 remediation governance ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
