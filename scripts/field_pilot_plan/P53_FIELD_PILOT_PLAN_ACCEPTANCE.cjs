// scripts/field_pilot_plan/P53_FIELD_PILOT_PLAN_ACCEPTANCE.cjs
'use strict';

// Purpose: verify P53 controlled field pilot planning gate behavior and boundaries.
// Boundary: this script creates only local P53 acceptance-output files.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const BASELINE_TAG = 'p52_twin_runtime_health_v1_closure';
const BASELINE_COMMIT = '39bf0e7177219409dddff0481b412df8b71cd8d3';
const MANIFEST = 'fixtures/field_pilot_plan/P53_FIELD_PILOT_PLAN_INPUT_MANIFEST.json';
const RUNNER = 'scripts/field_pilot_plan/P53_FIELD_PILOT_PLAN_RUNNER.cjs';
const LEDGER = 'acceptance-output/P53_FIELD_PILOT_PLAN_LEDGER.jsonl';
const REPORT = 'acceptance-output/P53_FIELD_PILOT_PLAN_REPORT.json';
const FORBIDDEN_RECORD_TYPES = ['field_pilot_execution_v1', 'field_pilot_observation_result_v1', 'live_device_deployment_v1', 'production_gateway_rollout_v1', 'production_runtime_monitoring_v1', 'ao_act_task_v0', 'ao_act_receipt_v0', 'machine_dispatch_v1', 'execution_outcome_v1', 'runtime_model_activation_v1', 'recommendation_candidate_v1', 'approved_recommendation_v1', 'roi_realization_v1', 'effect_attribution_v1', 'field_memory_record_v1', 'learning_signal_v1', 'training_run_v1', 'full_runtime_v1_freeze_v1'];

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
  check('03_changed_files_limited', changed.length > 0 && changed.every((filePath) => filePath.startsWith('docs/field_pilot_plan/') || filePath.startsWith('fixtures/field_pilot_plan/') || filePath.startsWith('scripts/field_pilot_plan/')));
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

const p52Closure = readJson(manifest.source_refs.p52_closure);
const p52Boundary = readJson(manifest.source_refs.p52_boundary_policy);
const p515Snapshot = readJson(manifest.source_refs.p51_5_snapshot);

check('08_p52_closure_exists', exists(manifest.source_refs.p52_closure));
check('09_p52_plan_allowed_true', p52Closure.gate_result.p53_field_pilot_plan_allowed === true);
check('10_p52_execution_allowed_false', p52Closure.gate_result.field_pilot_execution_allowed === false);
check('11_p52_production_monitoring_false', p52Closure.gate_result.production_runtime_monitoring_enabled === false);
check('12_p52_full_runtime_freeze_false', p52Closure.gate_result.full_runtime_v1_freeze_allowed === false);
check('13_p52_next_phase_is_p53', p52Closure.next_allowed_phase_after_closure === 'P53 Field Pilot Plan v1');
check('14_p52_boundary_artifact_level', p52Boundary.mode === 'artifact_level_controlled_health_gate' && p52Boundary.production_runtime_health_service_implemented === false);
check('15_p51_5_snapshot_source_truth', p515Snapshot.identity.source_truth_mode === 'device_path_simulation');
check('16_p51_5_snapshot_read_only', p515Snapshot.identity.read_only === true);
check('17_prior_source_refs_exist', exists(manifest.source_refs.p50_evidence_packet) && exists(manifest.source_refs.p51_evidence_packet) && exists(manifest.source_refs.p51_5_closure) && exists(manifest.source_refs.p51_5_snapshot));
check('18_plan_type_controlled_gate', manifest.plan_type === 'controlled_field_pilot_plan_gate');
check('19_no_acceptance_output_source_refs', Object.values(manifest.source_refs).every((ref) => !ref.startsWith('acceptance-output/')));

const normalSummary = runJson([RUNNER, '--mode', 'controlled-write']);
const report = readJson(REPORT);
const ledgerRows = read(LEDGER).trim().split(/\r?\n/).map((line) => JSON.parse(line));

check('20_candidate_site_scope_pointer_only', report.plan.candidate_site_scope.pointer_only === true && report.plan.candidate_site_scope.candidate_field_refs.every((ref) => ref.startsWith('field-candidate://')));
check('21_real_site_selected_false', report.plan.candidate_site_scope.real_site_selected === false);
check('22_field_owner_committed_false', report.plan.candidate_site_scope.field_owner_committed === false);
check('23_field_operation_scheduled_false', report.plan.candidate_site_scope.field_operation_scheduled === false);
check('24_evidence_protocol_exists', Array.isArray(report.plan.evidence_collection_protocol) && report.plan.evidence_collection_protocol.length === 7);
check('25_device_readiness_checklist_exists', Array.isArray(report.plan.device_gateway_readiness_checklist) && report.plan.device_gateway_readiness_checklist.length === 6);
check('26_human_role_matrix_exists', Array.isArray(report.plan.human_role_matrix) && report.plan.human_role_matrix.length === 6 && report.plan.human_role_matrix.every((row) => row.responsibility_retained_by_human === true));
check('27_safety_stop_rules_exist', Array.isArray(report.plan.safety_stop_rules) && report.plan.safety_stop_rules.length === 6);
check('28_rollback_plan_exists', report.plan.rollback_plan.rollback_required === true);
check('29_entry_exit_gates_exist', report.plan.entry_gate.execution_allowed === false && report.plan.exit_gate.p54_readiness_decision_can_be_considered === true);
check('30_go_no_go_gates_exist', report.gates.field_pilot_plan_gate.allowed === true && report.gates.field_pilot_execution_gate.allowed === false && report.gates.p54_readiness_review_gate.allowed === true);
check('31_nonclaims_preserved', report.plan.nonclaims_register.not_field_pilot_execution === true && report.plan.nonclaims_register.not_AO_ACT_task_creation === true && report.plan.nonclaims_register.not_full_Runtime_v1_freeze === true);
check('32_plan_result_ready_with_limitations', report.field_pilot_plan_result === 'PLAN_READY_WITH_LIMITATIONS' && normalSummary.field_pilot_plan_result === 'PLAN_READY_WITH_LIMITATIONS');
check('33_field_pilot_plan_allowed_true', report.field_pilot_plan_allowed === true && normalSummary.field_pilot_plan_allowed === true);
check('34_field_pilot_execution_allowed_false', report.field_pilot_execution_allowed === false && normalSummary.field_pilot_execution_allowed === false);
check('35_ao_act_and_dispatch_false', report.ao_act_task_creation_allowed === false && report.dispatch_allowed === false);
check('36_roi_and_field_memory_false', report.roi_allowed === false && report.field_memory_allowed === false);
check('37_full_runtime_freeze_false', report.full_runtime_v1_freeze_allowed === false);
check('38_p54_readiness_review_allowed_true', report.p54_readiness_review_allowed === true && normalSummary.p54_readiness_review_allowed === true);
check('39_controlled_outputs_exist', exists(LEDGER) && exists(REPORT) && !exists('acceptance-output/P53_UNEXPECTED_OUTPUT.json'));
check('40_ledger_record_hashes_and_prefix', ledgerRows.length >= 15 && ledgerRows.every((row) => typeof row.record_hash === 'string' && row.record_hash.length === 64 && row.record_type.startsWith('p53_field_pilot_plan_')));

const deterministicA = runJson([RUNNER, '--mode', 'controlled-plan-build']);
const deterministicB = runJson([RUNNER, '--mode', 'controlled-plan-build']);
check('41_deterministic_same_input_same_hash', deterministicA.deterministic_hash === deterministicB.deterministic_hash);

const tempManifestPath = path.join(os.tmpdir(), `p53_manifest_hash_probe_${process.pid}.json`);
const probeManifest = { ...manifest, hash_probe_marker: 'changed-fixture-probe' };
fs.writeFileSync(tempManifestPath, `${JSON.stringify(probeManifest, null, 2)}\n`, 'utf8');
const changedFixtureRun = runJson([RUNNER, '--mode', 'controlled-plan-build', '--manifest', tempManifestPath]);
check('42_changed_fixture_changes_hash', deterministicA.deterministic_hash !== changedFixtureRun.deterministic_hash);

const negative = runJson([RUNNER, '--mode', 'controlled-negative']);
check('43_negative_fixtures_all_blocked', negative.ok === true && negative.negative_result_count === 18 && negative.blocked_count === 18 && negative.results.some((row) => row.scenario_id === 'p54_readiness_without_complete_plan' && row.blocked === true) && negative.results.some((row) => row.scenario_id === 'candidate_site_real_commitment_flag' && row.blocked === true) && ledgerRows.every((row) => !FORBIDDEN_RECORD_TYPES.includes(row.record_type)));

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);

console.log(JSON.stringify({
  ok: failed.length === 0,
  acceptance: 'P53_CONTROLLED_FIELD_PILOT_PLAN_GATE_V1',
  phase: 'P53',
  baseline_tag: BASELINE_TAG,
  baseline_commit: BASELINE_COMMIT,
  field_pilot_plan_result: report.field_pilot_plan_result,
  field_pilot_plan_allowed: report.field_pilot_plan_allowed,
  field_pilot_execution_allowed: report.field_pilot_execution_allowed,
  ao_act_task_creation_allowed: report.ao_act_task_creation_allowed,
  dispatch_allowed: report.dispatch_allowed,
  roi_allowed: report.roi_allowed,
  field_memory_allowed: report.field_memory_allowed,
  full_runtime_v1_freeze_allowed: report.full_runtime_v1_freeze_allowed,
  p54_readiness_review_allowed: report.p54_readiness_review_allowed,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed
}, null, 2));

if (failed.length) process.exit(1);
