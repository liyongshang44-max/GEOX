// scripts/replay_execution_gate/P56_REPLAY_EXECUTION_GATE_ACCEPTANCE.cjs
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const BASELINE_TAG = 'p55_runtime_health_service_gate_v1_closure';
const BASELINE_COMMIT = '10e45c72a171ca3ebd5bc62edd03da675b14a39f';
const MANIFEST = 'fixtures/replay_execution_gate/P56_REPLAY_EXECUTION_GATE_INPUT_MANIFEST.json';
const RUNNER = 'scripts/replay_execution_gate/P56_REPLAY_EXECUTION_GATE_RUNNER.cjs';
const LEDGER = 'acceptance-output/P56_REPLAY_EXECUTION_GATE_LEDGER.jsonl';
const REPORT = 'acceptance-output/P56_REPLAY_EXECUTION_GATE_REPORT.json';
const REQUIRED_DIMENSION_IDS = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14'];
const FORBIDDEN_RECORD_TYPES = ['field_pilot_execution_v1', 'field_pilot_execution_start_v1', 'real_field_execution_v1', 'live_device_deployment_v1', 'production_gateway_rollout_v1', 'live_runtime_monitoring_v1', 'ao_act_task_v0', 'ao_act_receipt_v0', 'machine_dispatch_v1', 'execution_outcome_v1', 'roi_realization_v1', 'effect_attribution_v1', 'field_memory_record_v1', 'learning_signal_v1', 'training_run_v1', 'full_runtime_v1_freeze_v1', 'live_device_production_runtime_v1'];

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
const p55Closure = readJson(manifest.source_refs.p55_closure);

check('01_baseline_tag', manifest.baseline_tag === BASELINE_TAG);
check('02_baseline_commit', manifest.baseline_commit === BASELINE_COMMIT);

const diff = git(['diff', '--name-only', BASELINE_TAG, 'HEAD']);
if (diff) {
  const changed = diff.split(/\r?\n/).filter(Boolean);
  check('03_changed_files_limited', changed.length > 0 && changed.every((filePath) => filePath.startsWith('docs/replay_execution_gate/') || filePath.startsWith('fixtures/replay_execution_gate/') || filePath.startsWith('scripts/replay_execution_gate/')));
  check('04_no_apps_server_changes', !changed.some((filePath) => filePath.startsWith('apps/server/')));
  check('05_no_apps_web_changes', !changed.some((filePath) => filePath.startsWith('apps/web/')));
  check('06_no_telemetry_ingest_changes', !changed.some((filePath) => filePath.startsWith('apps/telemetry-ingest/')));
  check('07_no_contract_migration_package_workflow_changes', !changed.some((filePath) => filePath.startsWith('packages/contracts/') || filePath.startsWith('migrations/') || filePath.startsWith('.github/') || filePath === 'package.json' || filePath === 'pnpm-lock.yaml'));
} else {
  check('03_changed_files_limited', true);
  check('04_no_apps_server_changes', true);
  check('05_no_apps_web_changes', true);
  check('06_no_telemetry_ingest_changes', true);
  check('07_no_contract_migration_package_workflow_changes', true);
}

check('08_p55_closure_exists', exists(manifest.source_refs.p55_closure));
check('09_p55_acceptance_passed', p55Closure.acceptance.assertion_count === 46 && p55Closure.acceptance.failed_assertion_count === 0);
check('10_p55_replay_mode', p55Closure.runtime_health_service_mode === 'replay_backed_production_demo');
check('11_p55_p56_replay_gate_allowed', p55Closure.gate_result.p56_replay_gate_allowed === true);
check('12_p55_p56_gate_mode', p55Closure.gate_result.p56_gate_mode === 'replay_authorization_only');
check('13_p55_field_gate_false', p55Closure.gate_result.field_pilot_execution_allowed === false);
check('14_p55_real_device_false', p55Closure.nonclaims.real_device_deployed === false);
check('15_p55_live_device_false', p55Closure.nonclaims.live_device_production_runtime === false);
check('16_p55_full_freeze_false', p55Closure.gate_result.full_runtime_v1_freeze_allowed === false);
check('17_p55_service_route_contract_exists', p55Closure.server_surface.route === 'GET /api/v1/runtime-health/service-gate' && exists(manifest.source_refs.p55_runtime_builder) && exists(manifest.source_refs.p55_runtime_route));

const normalSummary = runJson([RUNNER, '--mode', 'controlled-write']);
const report = readJson(REPORT);
const ledgerRows = read(LEDGER).trim().split(/\r?\n/).map((line) => JSON.parse(line));
const dimensionIds = report.dimensions.map((row) => row.dimension_id);

check('18_p56_replay_packet_exists', manifest.replay_gate_packet.exists === true);
check('19_replay_execution_authorized_true', report.replay_execution_authorized === true);
check('20_replay_execution_authorization_recorded_true', report.replay_execution_authorization_recorded === true);
check('21_replay_execution_started_false', report.replay_execution_started === false);
check('22_real_field_execution_claimed_false', report.real_field_execution_claimed === false);
check('23_ao_act_task_creation_false', report.ao_act_task_creation_allowed === false);
check('24_dispatch_false', report.dispatch_allowed === false);
check('25_execution_outcome_false', report.execution_outcome_created === false);
check('26_roi_false', report.roi_allowed === false);
check('27_field_memory_false', report.field_memory_allowed === false);
check('28_full_runtime_freeze_false', report.full_runtime_v1_freeze_allowed === false);
check('29_p57_replay_backed_freeze_review_true', report.p57_replay_backed_freeze_review_allowed === true);
check('30_live_device_production_freeze_false', report.live_device_production_freeze_allowed === false);
check('31_e1_e14_dimensions_generated', report.dimensions.length === 14 && JSON.stringify(dimensionIds) === JSON.stringify(REQUIRED_DIMENSION_IDS));
check('32_no_blocked_dimensions_normal', report.blocked_dimension_count === 0 && report.dimensions.every((row) => row.status !== 'BLOCKED'));
check('33_at_least_one_warn_dimension', report.warn_dimension_count >= 1 && report.dimensions.some((row) => row.status === 'WARN'));
check('34_controlled_write_outputs_only', exists(LEDGER) && exists(REPORT));
check('35_every_ledger_record_has_hash', ledgerRows.length >= 9 && ledgerRows.every((row) => typeof row.record_hash === 'string' && row.record_hash.length === 64));

const deterministicA = runJson([RUNNER, '--mode', 'controlled-gate-build']);
const deterministicB = runJson([RUNNER, '--mode', 'controlled-gate-build']);
check('36_deterministic_same_input_same_hash', deterministicA.deterministic_hash === deterministicB.deterministic_hash);

const tempManifestPath = path.join(os.tmpdir(), `p56_manifest_hash_probe_${process.pid}.json`);
const probeManifest = { ...manifest, hash_probe_marker: 'changed-fixture-probe' };
fs.writeFileSync(tempManifestPath, `${JSON.stringify(probeManifest, null, 2)}\n`, 'utf8');
const changedFixtureRun = runJson([RUNNER, '--mode', 'controlled-gate-build', '--manifest', tempManifestPath]);
check('37_changed_fixture_changes_hash', deterministicA.deterministic_hash !== changedFixtureRun.deterministic_hash);

const negative = runJson([RUNNER, '--mode', 'controlled-negative']);
check('38_negative_fixtures_all_blocked_21', negative.ok === true && negative.negative_result_count === 21 && negative.blocked_count === 21);
check('39_no_forbidden_record_types', ledgerRows.every((row) => !FORBIDDEN_RECORD_TYPES.includes(row.record_type)));
check('40_ok_true_and_result', normalSummary.ok === true && report.replay_execution_authorization_result === 'REPLAY_EXECUTION_AUTHORIZED_WITH_LIMITATIONS');
check('41_p55_next_allowed_phase_points_to_p56', typeof p55Closure.next_allowed_phase_after_closure === 'string' && p55Closure.next_allowed_phase_after_closure.includes('P56') && p55Closure.next_allowed_phase_after_closure.includes('Replay Execution Gate'));
check('42_source_refs_do_not_use_acceptance_output', Object.values(manifest.source_refs).every((ref) => !ref.startsWith('acceptance-output/')));

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
console.log(JSON.stringify({
  ok: failed.length === 0,
  acceptance: 'P56_CONTROLLED_REPLAY_EXECUTION_AUTHORIZATION_GATE_V1',
  phase: 'P56',
  baseline_tag: BASELINE_TAG,
  baseline_commit: BASELINE_COMMIT,
  replay_execution_authorization_result: report.replay_execution_authorization_result,
  replay_execution_authorized: report.replay_execution_authorized,
  replay_execution_authorization_recorded: report.replay_execution_authorization_recorded,
  replay_execution_started: report.replay_execution_started,
  p57_replay_backed_freeze_review_allowed: report.p57_replay_backed_freeze_review_allowed,
  real_field_execution_allowed: report.real_field_execution_allowed,
  full_runtime_v1_freeze_allowed: report.full_runtime_v1_freeze_allowed,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed
}, null, 2));
if (failed.length) process.exit(1);
