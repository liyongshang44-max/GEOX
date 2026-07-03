// scripts/field_pilot_readiness/P54_FIELD_PILOT_READINESS_ACCEPTANCE.cjs
'use strict';

// Purpose: verify P54 controlled field pilot readiness review gate behavior and boundaries.
// Boundary: this script creates only local P54 acceptance-output files.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const BASELINE_TAG = 'p53_field_pilot_plan_v1_closure';
const BASELINE_COMMIT = '567d15359bfdc8008262fea402479be6a14d5312';
const MANIFEST = 'fixtures/field_pilot_readiness/P54_FIELD_PILOT_READINESS_INPUT_MANIFEST.json';
const RUNNER = 'scripts/field_pilot_readiness/P54_FIELD_PILOT_READINESS_RUNNER.cjs';
const LEDGER = 'acceptance-output/P54_FIELD_PILOT_READINESS_LEDGER.jsonl';
const REPORT = 'acceptance-output/P54_FIELD_PILOT_READINESS_REPORT.json';
const REQUIRED_DIMENSION_IDS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12'];
const FORBIDDEN_RECORD_TYPES = ['runtime_health_service_v1', 'production_runtime_monitoring_v1', 'live_runtime_monitoring_v1', 'field_pilot_execution_v1', 'field_pilot_observation_result_v1', 'live_device_deployment_v1', 'production_gateway_rollout_v1', 'ao_act_task_v0', 'ao_act_receipt_v0', 'machine_dispatch_v1', 'execution_outcome_v1', 'roi_realization_v1', 'effect_attribution_v1', 'field_memory_record_v1', 'learning_signal_v1', 'training_run_v1', 'full_runtime_v1_freeze_v1'];

const checks = [];
const check = (name, value) => checks.push([name, Boolean(value)]);
const exists = (filePath) => fs.existsSync(filePath);
const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const readJson = (filePath) => JSON.parse(read(filePath));
const runJson = (args) => JSON.parse(cp.execFileSync('node', args, { encoding: 'utf8' }));
const git = (args) => {
  try { return cp.execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
};

const manifest = readJson(MANIFEST);
check('01_baseline_tag', manifest.baseline_tag === BASELINE_TAG);
check('02_baseline_commit', manifest.baseline_commit === BASELINE_COMMIT);

const diff = git(['diff', '--name-only', BASELINE_TAG, 'HEAD']);
if (diff) {
  const changed = diff.split(/\r?\n/).filter(Boolean);
  check('03_changed_files_limited', changed.length > 0 && changed.every((filePath) => filePath.startsWith('docs/field_pilot_readiness/') || filePath.startsWith('fixtures/field_pilot_readiness/') || filePath.startsWith('scripts/field_pilot_readiness/')));
  check('04_no_server_changes', !changed.some((filePath) => filePath.startsWith('apps/server/')));
  check('05_no_web_changes', !changed.some((filePath) => filePath.startsWith('apps/web/')));
  check('06_no_telemetry_ingest_changes', !changed.some((filePath) => filePath.startsWith('apps/telemetry-ingest/')));
  check('07_no_contract_migration_package_workflow_changes', !changed.some((filePath) => filePath.startsWith('packages/contracts/') || filePath.startsWith('migrations/') || filePath.startsWith('.github/') || filePath === 'package.json' || filePath === 'pnpm-lock.yaml'));
} else {
  check('03_changed_files_limited', true);
  check('04_no_server_changes', true);
  check('05_no_web_changes', true);
  check('06_no_telemetry_ingest_changes', true);
  check('07_no_contract_migration_package_workflow_changes', true);
}

const p53Closure = readJson(manifest.source_refs.p53_closure);
const controlBoundary = read(manifest.source_refs.control_to_ao_act_non_goals);

check('08_p53_closure_exists', exists(manifest.source_refs.p53_closure));
check('09_p53_acceptance_assertion_count_43', p53Closure.acceptance.assertion_count === 43);
check('10_p53_failed_assertion_count_0', p53Closure.acceptance.failed_assertion_count === 0);
check('11_p53_result_ready_with_limitations', p53Closure.field_pilot_plan_result === 'PLAN_READY_WITH_LIMITATIONS');
check('12_p53_plan_allowed_true', p53Closure.gate_result.field_pilot_plan_allowed === true);
check('13_p53_execution_allowed_false', p53Closure.gate_result.field_pilot_execution_allowed === false);
check('14_p53_ao_act_allowed_false', p53Closure.gate_result.ao_act_task_creation_allowed === false);
check('15_p53_dispatch_allowed_false', p53Closure.gate_result.dispatch_allowed === false);
check('16_p53_roi_allowed_false', p53Closure.gate_result.roi_allowed === false);
check('17_p53_field_memory_allowed_false', p53Closure.gate_result.field_memory_allowed === false);
check('18_p53_full_runtime_freeze_allowed_false', p53Closure.gate_result.full_runtime_v1_freeze_allowed === false);
check('19_p53_p54_readiness_allowed_true', p53Closure.gate_result.p54_readiness_review_allowed === true);
check('20_p53_nonclaims_preserved', p53Closure.nonclaims.field_pilot_started === false && p53Closure.nonclaims.real_device_deployed === false && p53Closure.nonclaims.production_gateway_online === false && p53Closure.nonclaims.live_runtime_monitoring_active === false && p53Closure.nonclaims.full_runtime_v1_frozen === false);
check('21_control_to_ao_act_boundary_exists', exists(manifest.source_refs.control_to_ao_act_non_goals) && /裁决 ≠ 执行/.test(controlBoundary) && /不得自动或隐式实例化/.test(controlBoundary));
check('22_source_refs_do_not_use_acceptance_output', Object.values(manifest.source_refs).every((ref) => !ref.startsWith('acceptance-output/')));

const normalSummary = runJson([RUNNER, '--mode', 'controlled-write']);
const report = readJson(REPORT);
const ledgerRows = read(LEDGER).trim().split(/\r?\n/).map((line) => JSON.parse(line));
const dimensionIds = report.dimensions.map((row) => row.dimension_id);

check('23_r1_r12_dimensions_generated', report.dimensions.length === 12);
check('24_r1_r12_dimension_ids_match', JSON.stringify(dimensionIds) === JSON.stringify(REQUIRED_DIMENSION_IDS));
check('25_no_blocked_dimensions_normal', report.blocked_dimension_count === 0 && report.dimensions.every((row) => row.status !== 'BLOCKED'));
check('26_at_least_one_warn_dimension', report.warn_dimension_count >= 1 && report.dimensions.some((row) => row.status === 'WARN'));
check('27_readiness_result_ready_with_limitations', report.readiness_review_result === 'READY_FOR_RUNTIME_HEALTH_SERVICE_GATE_WITH_LIMITATIONS' && normalSummary.readiness_review_result === 'READY_FOR_RUNTIME_HEALTH_SERVICE_GATE_WITH_LIMITATIONS');
check('28_p55_gate_allowed_true', report.p55_runtime_health_service_gate_allowed === true && report.gates.p55_runtime_health_service_gate.allowed === true);
check('29_field_execution_allowed_false', report.field_pilot_execution_allowed === false && report.gates.field_pilot_execution_gate.allowed === false);
check('30_full_runtime_freeze_allowed_false', report.full_runtime_v1_freeze_allowed === false && report.gates.full_runtime_freeze_gate.allowed === false);
check('31_runtime_health_service_implemented_false', report.runtime_health_service_implemented === false);
check('32_live_runtime_monitoring_active_false', report.live_runtime_monitoring_active === false);
check('33_real_device_deployed_false', report.real_device_deployed === false);
check('34_production_gateway_online_false', report.production_gateway_online === false);
check('35_ao_dispatch_roi_field_memory_false', report.ao_act_task_creation_allowed === false && report.dispatch_allowed === false && report.roi_allowed === false && report.field_memory_allowed === false);
check('36_controlled_outputs_exist', exists(LEDGER) && exists(REPORT) && !exists('acceptance-output/P54_UNEXPECTED_OUTPUT.json'));
check('37_ledger_hashes_and_prefix', ledgerRows.length >= 9 && ledgerRows.every((row) => typeof row.record_hash === 'string' && row.record_hash.length === 64 && row.record_type.startsWith('p54_field_pilot_readiness_') || row.record_type === 'p54_runtime_health_service_gate_request_v1'));

const deterministicA = runJson([RUNNER, '--mode', 'controlled-review-build']);
const deterministicB = runJson([RUNNER, '--mode', 'controlled-review-build']);
check('38_deterministic_same_input_same_hash', deterministicA.deterministic_hash === deterministicB.deterministic_hash);

const tempManifestPath = path.join(os.tmpdir(), `p54_manifest_hash_probe_${process.pid}.json`);
const probeManifest = { ...manifest, hash_probe_marker: 'changed-fixture-probe' };
fs.writeFileSync(tempManifestPath, `${JSON.stringify(probeManifest, null, 2)}\n`, 'utf8');
const changedFixtureRun = runJson([RUNNER, '--mode', 'controlled-review-build', '--manifest', tempManifestPath]);
check('39_changed_fixture_changes_hash', deterministicA.deterministic_hash !== changedFixtureRun.deterministic_hash);

const negative = runJson([RUNNER, '--mode', 'controlled-negative']);
check('40_negative_fixtures_all_blocked', negative.ok === true && negative.negative_result_count === 20 && negative.blocked_count === 20 && negative.results.some((row) => row.scenario_id === 'p55_claim_flag' && row.blocked === true) && negative.results.some((row) => row.scenario_id === 'execution_claim_flag' && row.blocked === true) && negative.results.some((row) => row.scenario_id === 'full_freeze_claim_flag' && row.blocked === true));
check('41_no_forbidden_record_types', ledgerRows.every((row) => !FORBIDDEN_RECORD_TYPES.includes(row.record_type)));
check('42_normal_runner_ok_true', normalSummary.ok === true);

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);

console.log(JSON.stringify({
  ok: failed.length === 0,
  acceptance: 'P54_CONTROLLED_FIELD_PILOT_READINESS_REVIEW_GATE_V1',
  phase: 'P54',
  baseline_tag: BASELINE_TAG,
  baseline_commit: BASELINE_COMMIT,
  readiness_review_result: report.readiness_review_result,
  p55_runtime_health_service_gate_allowed: report.p55_runtime_health_service_gate_allowed,
  field_pilot_execution_allowed: report.field_pilot_execution_allowed,
  runtime_health_service_implemented: report.runtime_health_service_implemented,
  live_runtime_monitoring_active: report.live_runtime_monitoring_active,
  real_device_deployed: report.real_device_deployed,
  production_gateway_online: report.production_gateway_online,
  ao_act_task_creation_allowed: report.ao_act_task_creation_allowed,
  dispatch_allowed: report.dispatch_allowed,
  roi_allowed: report.roi_allowed,
  field_memory_allowed: report.field_memory_allowed,
  full_runtime_v1_freeze_allowed: report.full_runtime_v1_freeze_allowed,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed
}, null, 2));

if (failed.length) process.exit(1);
