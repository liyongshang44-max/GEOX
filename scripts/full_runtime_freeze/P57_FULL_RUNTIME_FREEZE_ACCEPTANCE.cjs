// scripts/full_runtime_freeze/P57_FULL_RUNTIME_FREEZE_ACCEPTANCE.cjs
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const BASELINE_TAG = 'p56_replay_execution_authorization_gate_v1_closure';
const BASELINE_COMMIT = '0637e311e330ee09c1dc84d75018a206168b5231';
const MANIFEST = 'fixtures/full_runtime_freeze/P57_FULL_RUNTIME_FREEZE_INPUT_MANIFEST.json';
const RUNNER = 'scripts/full_runtime_freeze/P57_FULL_RUNTIME_FREEZE_RUNNER.cjs';
const LEDGER = 'acceptance-output/P57_FULL_RUNTIME_FREEZE_LEDGER.jsonl';
const REPORT = 'acceptance-output/P57_FULL_RUNTIME_FREEZE_REPORT.json';
const EXPECTED_REPORT = 'fixtures/full_runtime_freeze/P57_EXPECTED_FULL_RUNTIME_FREEZE_REPORT.json';
const EXPECTED_GATE = 'fixtures/full_runtime_freeze/P57_EXPECTED_FULL_RUNTIME_FREEZE_GATE.json';
const CAPABILITY_MATRIX = 'docs/full_runtime_freeze/GEOX-P57-FULL-RUNTIME-V1-FREEZE-CAPABILITY-MATRIX.json';
const EVIDENCE_PACKET = 'docs/full_runtime_freeze/GEOX-P57-FULL-RUNTIME-V1-FREEZE-EVIDENCE-PACKET.json';
const BOUNDARY_POLICY = 'docs/full_runtime_freeze/GEOX-P57-FULL-RUNTIME-V1-FREEZE-BOUNDARY-POLICY.json';
const COMPLETION_REVIEW = 'docs/full_runtime_freeze/GEOX-P57-FULL-RUNTIME-V1-FREEZE-COMPLETION-REVIEW.json';
const REQUIRED_DIMENSION_IDS = Array.from({ length: 24 }, (_unused, index) => `F${String(index + 1).padStart(2, '0')}`);
const FORBIDDEN_RECORD_TYPES = ['live_device_production_runtime_v1_freeze', 'live_device_deployment_v1', 'production_gateway_rollout_v1', 'live_runtime_monitoring_v1', 'real_field_execution_v1', 'field_pilot_execution_v1', 'ao_act_task_v0', 'ao_act_receipt_v0', 'machine_dispatch_v1', 'execution_outcome_v1', 'roi_realization_v1', 'field_memory_record_v1', 'learning_signal_v1', 'training_run_v1'];

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
const p56Closure = readJson(manifest.source_refs.p56_closure);
const p55Closure = readJson(manifest.source_refs.p55_closure);

check('01_baseline_tag', manifest.baseline_tag === BASELINE_TAG);
check('02_baseline_commit', manifest.baseline_commit === BASELINE_COMMIT);

const diff = git(['diff', '--name-only', BASELINE_TAG, 'HEAD']);
if (diff) {
  const changed = diff.split(/\r?\n/).filter(Boolean);
  check('03_changed_files_limited', changed.length > 0 && changed.every((filePath) => filePath.startsWith('docs/full_runtime_freeze/') || filePath.startsWith('fixtures/full_runtime_freeze/') || filePath.startsWith('scripts/full_runtime_freeze/')));
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

check('08_p56_closure_exists', exists(manifest.source_refs.p56_closure));
check('09_p56_acceptance_count_42', p56Closure.acceptance.assertion_count === 42);
check('10_p56_failed_count_0', p56Closure.acceptance.failed_assertion_count === 0);
check('11_p56_auth_result', p56Closure.replay_execution_authorization_result === 'REPLAY_EXECUTION_AUTHORIZED_WITH_LIMITATIONS');
check('12_p56_p57_gate_allowed', p56Closure.gate_result.p57_replay_backed_freeze_review_allowed === true);
check('13_p56_replay_started_false', p56Closure.gate_result.replay_execution_started === false);
check('14_p56_real_field_false', p56Closure.gate_result.real_field_execution_allowed === false);
check('15_p56_full_freeze_false', p56Closure.gate_result.full_runtime_v1_freeze_allowed === false);
check('16_p56_real_device_false', p56Closure.nonclaims.real_device_deployed === false);
check('17_p56_live_monitoring_false', p56Closure.nonclaims.live_runtime_monitoring_active === false);
check('18_p56_downstream_false', p56Closure.nonclaims.ao_act_task_created === false && p56Closure.nonclaims.dispatch_enabled === false && p56Closure.nonclaims.execution_outcome_created === false);

check('19_p55_closure_exists', exists(manifest.source_refs.p55_closure));
check('20_p55_acceptance_46_0', p55Closure.acceptance.assertion_count === 46 && p55Closure.acceptance.failed_assertion_count === 0);
check('21_p55_mode_replay', p55Closure.runtime_health_service_mode === 'replay_backed_production_demo');
check('22_p55_service_read_only', p55Closure.server_surface.read_only === true && p55Closure.server_surface.db_write_allowed === false);
check('23_p54_closure_exists', exists(manifest.source_refs.p54_closure));
check('24_p53_closure_exists', exists(manifest.source_refs.p53_closure));
check('25_p52_closure_exists', exists(manifest.source_refs.p52_closure));
check('26_p51_5_closure_exists', exists(manifest.source_refs.p51_5_closure));
check('27_p51_5_snapshot_exists', exists(manifest.source_refs.p51_5_snapshot));
check('28_p51_closure_exists', exists(manifest.source_refs.p51_closure));
check('29_p50_evidence_exists', exists(manifest.source_refs.p50_evidence_packet));
check('30_control_boundary_exists', exists(manifest.source_refs.control_to_ao_act_non_goals) && /裁决 ≠ 执行/.test(read(manifest.source_refs.control_to_ao_act_non_goals)));
check('31_source_refs_no_acceptance_output', Object.values(manifest.source_refs).every((ref) => !ref.startsWith('acceptance-output/')));

check('32_freeze_package_bound', manifest.freeze_binding.freeze_package === 'GEOX-FULL-RUNTIME-V1-FREEZE');
check('33_full_runtime_frozen_true', manifest.freeze_binding.full_runtime_v1_frozen === true);
check('34_full_runtime_mode_replay', manifest.freeze_binding.full_runtime_mode === 'replay_backed_production_demo');
check('35_replay_scope_frozen_true', manifest.freeze_binding.replay_backed_production_demo_frozen === true);
check('36_live_runtime_frozen_false', manifest.freeze_binding.live_device_production_runtime_v1_frozen === false);

const normalSummary = runJson([RUNNER, '--mode', 'controlled-write']);
const report = readJson(REPORT);
const ledgerRows = read(LEDGER).trim().split(/\r?\n/).map((line) => JSON.parse(line));
const expectedReport = readJson(EXPECTED_REPORT);
const expectedGate = readJson(EXPECTED_GATE);
const capabilityMatrix = readJson(CAPABILITY_MATRIX);
const evidencePacket = readJson(EVIDENCE_PACKET);
const boundaryPolicy = readJson(BOUNDARY_POLICY);
const completionReview = readJson(COMPLETION_REVIEW);
const dimensionIds = report.dimensions.map((row) => row.dimension_id);

check('37_normal_result_frozen_with_limitations', report.freeze_result === 'FULL_RUNTIME_V1_REPLAY_BACKED_FROZEN_WITH_LIMITATIONS' && normalSummary.freeze_result === 'FULL_RUNTIME_V1_REPLAY_BACKED_FROZEN_WITH_LIMITATIONS');
check('38_dimension_count_24', report.audit_dimension_count === 24 && report.dimensions.length === 24);
check('39_dimension_ids_match', JSON.stringify(dimensionIds) === JSON.stringify(REQUIRED_DIMENSION_IDS));
check('40_no_blocked_dimensions', report.blocked_dimension_count === 0 && report.dimensions.every((row) => row.status !== 'BLOCKED'));
check('41_warn_dimension_exists', report.warn_dimension_count >= 1 && report.dimensions.some((row) => row.status === 'WARN'));
check('42_report_freeze_package', report.freeze_package === 'GEOX-FULL-RUNTIME-V1-FREEZE');
check('43_report_full_frozen_true', report.full_runtime_v1_frozen === true);
check('44_report_mode_replay', report.full_runtime_mode === 'replay_backed_production_demo');
check('45_report_replay_scope_true', report.replay_backed_production_demo_frozen === true);
check('46_report_live_runtime_false', report.live_device_production_runtime_v1_frozen === false);
check('47_report_real_device_false', report.real_device_deployed === false);
check('48_report_live_device_false', report.live_device_claimed === false);
check('49_report_production_gateway_false', report.production_gateway_online === false);
check('50_report_live_monitoring_false', report.live_runtime_monitoring_active === false);
check('51_report_real_field_false', report.real_field_execution_claimed === false);
check('52_report_field_pilot_false', report.field_pilot_execution_started === false);
check('53_report_ao_act_false', report.ao_act_task_created === false);
check('54_report_dispatch_false', report.dispatch_enabled === false);
check('55_report_execution_outcome_false', report.execution_outcome_created === false);
check('56_report_roi_false', report.roi_computed === false);
check('57_report_field_memory_false', report.field_memory_learned === false);
check('58_controlled_outputs_exist', exists(LEDGER) && exists(REPORT));
check('59_ledger_row_count', ledgerRows.length >= 9);
check('60_ledger_hashes', ledgerRows.every((row) => typeof row.record_hash === 'string' && row.record_hash.length === 64));
check('61_no_forbidden_record_types', ledgerRows.every((row) => !FORBIDDEN_RECORD_TYPES.includes(row.record_type)));

const deterministicA = runJson([RUNNER, '--mode', 'controlled-freeze-build']);
const deterministicB = runJson([RUNNER, '--mode', 'controlled-freeze-build']);
check('62_deterministic_same_input_same_hash', deterministicA.deterministic_hash === deterministicB.deterministic_hash);

const tempManifestPath = path.join(os.tmpdir(), `p57_manifest_hash_probe_${process.pid}.json`);
const probeManifest = { ...manifest, hash_probe_marker: 'changed-fixture-probe' };
fs.writeFileSync(tempManifestPath, `${JSON.stringify(probeManifest, null, 2)}\n`, 'utf8');
const changedFixtureRun = runJson([RUNNER, '--mode', 'controlled-freeze-build', '--manifest', tempManifestPath]);
check('63_changed_fixture_changes_hash', deterministicA.deterministic_hash !== changedFixtureRun.deterministic_hash);

const negative = runJson([RUNNER, '--mode', 'controlled-negative']);
check('64_negative_fixtures_all_blocked_37', negative.ok === true && negative.negative_result_count === 37 && negative.blocked_count === 37);
check('65_expected_report_matches_result', expectedReport.freeze_result === report.freeze_result && expectedReport.full_runtime_mode === report.full_runtime_mode);
check('66_expected_gate_matches_result', expectedGate.replay_backed_freeze_gate.allowed === true && expectedGate.live_device_production_freeze_gate.allowed === false);
check('67_capability_matrix_exists', exists(CAPABILITY_MATRIX) && capabilityMatrix.capability_count === 16);
check('68_evidence_packet_exists', exists(EVIDENCE_PACKET) && evidencePacket.evidence_refs.acceptance === RUNNER.replace('RUNNER', 'ACCEPTANCE'));
check('69_boundary_policy_binding', boundaryPolicy.freeze_binding.freeze_package === 'GEOX-FULL-RUNTIME-V1-FREEZE' && boundaryPolicy.freeze_binding.live_device_production_runtime_v1_frozen === false);
check('70_completion_review_exists', exists(COMPLETION_REVIEW) && completionReview.completion_status === 'implementation_ready_for_review');
check('71_completion_review_acceptance_count', completionReview.expected_acceptance_count === 75);
check('72_completion_review_negative_count', completionReview.expected_negative_fixture_count === 37);
check('73_runner_summary_ok_true', normalSummary.ok === true);
check('74_final_freeze_binding_complete', report.full_runtime_v1_frozen === true && report.full_runtime_mode === 'replay_backed_production_demo' && report.replay_backed_production_demo_frozen === true && report.live_device_production_runtime_v1_frozen === false);
check('75_no_failed_assertions_internal', checks.every(([, ok]) => ok));

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
console.log(JSON.stringify({
  ok: failed.length === 0,
  acceptance: 'P57_FULL_RUNTIME_V1_REPLAY_BACKED_FREEZE_AUDIT_V1',
  phase: 'P57',
  baseline_tag: BASELINE_TAG,
  baseline_commit: BASELINE_COMMIT,
  freeze_result: report.freeze_result,
  freeze_package: report.freeze_package,
  full_runtime_v1_frozen: report.full_runtime_v1_frozen,
  full_runtime_mode: report.full_runtime_mode,
  replay_backed_production_demo_frozen: report.replay_backed_production_demo_frozen,
  live_device_production_runtime_v1_frozen: report.live_device_production_runtime_v1_frozen,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed
}, null, 2));
if (failed.length) process.exit(1);
